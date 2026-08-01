document.addEventListener('DOMContentLoaded', () => {
  const net = new Net();
  net.connect();

  const canvas = document.getElementById('game-canvas');
  const game = new Game(canvas, net);

  let isHost = false;

  const $ = id => document.getElementById(id);

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  function showError(msg) {
    const e = $('err');
    e.textContent = msg;
    e.style.display = 'block';
    setTimeout(() => e.style.display = 'none', 3500);
  }

  function updateRoom(data) {
    $('room-code-out').textContent = data.code;
    $('p-count').textContent = Object.keys(data.players).length;
    const ul = $('p-list');
    ul.innerHTML = '';
    for (const p of Object.values(data.players)) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${p.name}</span>${p.isHost ? '<span class="host">HOST</span>' : ''}`;
      ul.appendChild(li);
    }
    const me = data.players[net.myId];
    isHost = me?.isHost;
    $('start-btn').style.display = isHost ? 'block' : 'none';
    $('wait-msg').style.display = isHost ? 'none' : 'block';
  }

  // Lobby
  $('create-btn').onclick = async () => {
    const name = $('player-name').value.trim() || 'Player';
    const res = await net.createRoom(name, 'starry-night');
    if (res.ok) { showScreen('room-screen'); updateRoom(res.room); }
    else showError(res.err);
  };

  $('join-btn').onclick = async () => {
    const name = $('player-name').value.trim() || 'Player';
    const code = $('room-code').value.trim().toUpperCase();
    if (!code || code.length < 4) return showError('Enter a valid code');
    const res = await net.joinRoom(code, name);
    if (res.ok) { showScreen('room-screen'); updateRoom(res.room); }
    else showError(res.err);
  };

  $('start-btn').onclick = async () => {
    const res = await net.startGame();
    if (!res?.ok) showError(res?.err || 'Cannot start');
  };

  $('play-again-btn').onclick = async () => {
    if (isHost) { await net.returnToLobby(); showScreen('room-screen'); }
  };

  $('next-round-btn').onclick = async () => {
    if (isHost) await net.nextRound();
  };

  $('room-code').onkeydown = e => { if (e.key === 'Enter') $('join-btn').click(); };
  $('player-name').onkeydown = e => { if (e.key === 'Enter') $('create-btn').click(); };

  net.on('room-update', d => {
    updateRoom(d);
    if (d.state === 'lobby') showScreen('room-screen');
  });

  net.on('game-finished', d => {
    game.state = 'finished';
    game.showResults(d);
  });
});
