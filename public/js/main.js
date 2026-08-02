document.addEventListener('DOMContentLoaded', () => {
  const net = new Net();
  net.connect();

  const canvas = document.getElementById('game-canvas');
  const game = new Game(canvas, net);

  let isHost = false;
  let categories = [];

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

  async function loadCategories() {
    categories = await net.getCategories();
    const sel = $('map-select');
    sel.innerHTML = '';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.key;
      opt.textContent = `${cat.name} (${cat.imageCount} images)`;
      sel.appendChild(opt);
    });
    updateImageCount();
  }

  function updateImageCount() {
    const sel = $('map-select');
    const cat = categories.find(c => c.key === sel.value);
    $('image-count').textContent = cat ? `${cat.imageCount} images` : '';
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

    if (data.category) {
      $('map-select').value = data.category;
      updateImageCount();
    }

    $('map-select').disabled = !isHost || data.state !== 'lobby';
  }

  // Name randomizer
  const firstNames = ['Vincent','Pablo','Claude','Leonardo','Frida','Georgia','Salvador','Rembrandt','Henri','Edgar','Wassily','Paul','Jackson','Andy','Mark','Joan','Caravaggio','Raphael','Botticelli','Vermeer','Cezanne','Degas','Goya','Klimt','Munch','Monet','Picasso','Renoir','Titian','Turner'];
  const lastNames = ['Canvas','Brush','Palette','Stroke','Sketch','Color','Paint','Hue','Shade','Gallery','Studio','Easel','Portrait','Landscape','Impasto','Glaze','Underpainting','Chiaroscuro','Sfumato','Fresco','Impression','Abstract','Surreal','Cubist','Baroque','Rococo','Romantic','Modernist','Realist','Expressionist'];

  function randomName() {
    const a = firstNames[Math.floor(Math.random() * firstNames.length)];
    const b = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `${a} ${b}`;
  }

  $('random-name-btn').onclick = () => {
    $('player-name').value = randomName();
    $('player-name').focus();
  };

  // Lobby
  $('create-btn').onclick = async () => {
    const name = $('player-name').value.trim() || 'Player';
    const category = $('map-select').value;
    const res = await net.createRoom(name, category);
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

  $('map-select').onchange = async () => {
    updateImageCount();
    if (isHost) {
      await net.setCategory($('map-select').value);
    }
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

  loadCategories();
});
