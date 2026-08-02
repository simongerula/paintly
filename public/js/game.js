class Game {
  constructor(canvas, net) {
    this.cvs = canvas;
    this.ctx = canvas.getContext('2d');
    this.net = net;
    this.paint = new Paint();
    this.map = null;
    this.me = null;
    this.players = {};
    this.role = null;
    this.state = 'lobby';
    this.timer = 0;
    this.round = 0;
    this.maxRounds = 3;
    this.mouse = { x: 0, y: 0, down: false };
    this.mapMouse = { x: 0, y: 0 };
    this.scale = 1;
    this.ox = 0;
    this.oy = 0;
    this.drag = false;
    this.dragOff = { x: 0, y: 0 };
    this.sampleMode = false;
    this.onScreen = 'lobby-screen';
    this.userZoom = 1;
    this.zoomX = 0;
    this.zoomY = 0;
    this.shootsLeft = 0;

    this.bindInput();
    this.bindNet();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.cvs.width = window.innerWidth;
    this.cvs.height = window.innerHeight;
  }

  show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    this.onScreen = id;
  }

  screenToMap(sx, sy) {
    const z = this.userZoom;
    return {
      x: (sx - this.ox - this.zoomX) / (this.scale * z),
      y: (sy - this.oy - this.zoomY) / (this.scale * z)
    };
  }

  // ───── Input ─────
  bindInput() {
    const c = this.cvs;

    c.addEventListener('mousedown', e => {
      this.mouse.down = true;
      const r = c.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.mapMouse = this.screenToMap(this.mouse.x, this.mouse.y);

      if (this.role === 'hider' && this.state === 'prep') {
        if (this.sampleMode) {
          this.doSample();
          this.sampleMode = false;
          this.updateToolbar();
        } else if (!this.paint.active && this.me && this.paint.hitTest(this.mapMouse.x, this.mapMouse.y, this.me.x, this.me.y)) {
          this.drag = true;
          this.dragOff.x = this.mapMouse.x - this.me.x;
          this.dragOff.y = this.mapMouse.y - this.me.y;
        } else if (this.paint.active) {
          this.doStroke();
        }
      }

      if (this.role === 'seeker' && this.state === 'hunt') {
        this.doGuess();
      }
    });

    c.addEventListener('mousemove', e => {
      const r = c.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.mapMouse = this.screenToMap(this.mouse.x, this.mouse.y);

      if (this.drag && this.me) {
        this.me.x = clamp(this.mapMouse.x - this.dragOff.x, 0, this.mapW() - 24);
        this.me.y = clamp(this.mapMouse.y - this.dragOff.y, 0, this.mapH() - 48);
        this.net.socket.emit('move', { x: this.me.x, y: this.me.y });
      }

      if (this.paint.active && this.mouse.down && this.role === 'hider' && this.state === 'prep') {
        this.doStroke();
      }
    });

    c.addEventListener('mouseup', () => { this.mouse.down = false; this.drag = false; });
    c.addEventListener('contextmenu', e => e.preventDefault());

    // Custom zoom (ctrl+scroll) — only on game screen, only hiders during prep
    window.addEventListener('wheel', e => {
      if (e.ctrlKey && this.onScreen === 'game-screen' && this.role === 'hider' && this.state === 'prep') {
        e.preventDefault();
        const prev = this.userZoom;
        this.userZoom *= e.deltaY < 0 ? 1.03 : 0.97;
        this.userZoom = Math.max(0.5, Math.min(5, this.userZoom));
        // Zoom toward cursor
        const r = c.getBoundingClientRect();
        const cx = e.clientX - r.left;
        const cy = e.clientY - r.top;
        this.zoomX = cx - this.ox - ((cx - this.ox - this.zoomX) / prev) * this.userZoom;
        this.zoomY = cy - this.oy - ((cy - this.oy - this.zoomY) / prev) * this.userZoom;
      }
    }, { passive: false });
    window.addEventListener('keydown', e => {
      if (e.ctrlKey && (e.key === '=' || e.key === '-' || e.key === '0') && this.onScreen === 'game-screen' && this.role === 'hider' && this.state === 'prep') {
        e.preventDefault();
        const prev = this.userZoom;
        const r = c.getBoundingClientRect();
        const cx = c.width / 2;
        const cy = c.height / 2;
        if (e.key === '=') this.userZoom = Math.min(5, this.userZoom * 1.05);
        else if (e.key === '-') this.userZoom = Math.max(0.5, this.userZoom / 1.05);
        else { this.userZoom = 1; this.zoomX = 0; this.zoomY = 0; return; }
        this.zoomX = cx - this.ox - ((cx - this.ox - this.zoomX) / prev) * this.userZoom;
        this.zoomY = cy - this.oy - ((cy - this.oy - this.zoomY) / prev) * this.userZoom;
      }
    });

    window.addEventListener('keydown', e => {
      if (e.key === 'p' && this.role === 'hider' && this.state === 'prep') {
        this.paint.active = !this.paint.active;
        this.updateToolbar();
      }
      if (e.key === 'd' && this.role === 'hider' && this.state === 'prep') {
        this.paint.active = false;
        this.sampleMode = false;
        this.updateToolbar();
      }
      if (e.key === ' ' && this.role === 'hider' && this.state === 'prep') {
        e.preventDefault();
        this.sampleMode = true;
        this.paint.active = false;
        this.updateToolbar();
      }
      if (e.key === 'q' && this.role === 'hider' && this.state === 'prep') {
        this.paint.size = Math.max(2, this.paint.size - 2);
        this.syncSizeSlider();
      }
      if (e.key === 'e' && this.role === 'hider' && this.state === 'prep') {
        this.paint.size = Math.min(16, this.paint.size + 2);
        this.syncSizeSlider();
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.net.socket.emit('undo');
        this.paint.undoStroke(this.net.myId);
      }
    });

    document.querySelectorAll('.pal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.paint.color = btn.dataset.color;
        this.paint.active = true;
        this.syncColorPicker();
        this.updateToolbar();
      });
    });

    document.getElementById('color-pick').addEventListener('input', e => {
      this.paint.color = e.target.value;
      this.paint.active = true;
      this.updateToolbar();
    });

    document.getElementById('size-pick').addEventListener('input', e => {
      this.paint.size = parseInt(e.target.value);
    });

    document.getElementById('tool-brush').addEventListener('click', () => {
      this.paint.active = true;
      this.updateToolbar();
    });

    document.getElementById('tool-sample').addEventListener('click', () => {
      this.sampleMode = true;
      this.paint.active = false;
      this.updateToolbar();
    });

    document.getElementById('tool-clear').addEventListener('click', () => {
      this.net.socket.emit('clear');
      this.paint.clearStrokes(this.net.myId);
    });

    document.getElementById('tool-undo').addEventListener('click', () => {
      this.net.socket.emit('undo');
      this.paint.undoStroke(this.net.myId);
    });
  }

  doStroke() {
    if (!this.me) return;
    const lx = this.mapMouse.x - this.me.x;
    const ly = this.mapMouse.y - this.me.y;
    const s = { x: lx, y: ly, color: this.paint.color, size: this.paint.size };
    this.paint.addStroke(this.net.myId, s);
    this.net.socket.emit('stroke', s);
  }

  doSample() {
    if (!this.map) return;
    const col = this.map.getColorAt(this.mapMouse.x, this.mapMouse.y);
    this.paint.color = col;
    this.paint.active = true;
    this.syncColorPicker();
    this.updateToolbar();
  }

  doGuess() {
    if (this.shootsLeft <= 0) return;
    this.shootsLeft--;
    this.net.socket.emit('guess', { x: this.mapMouse.x, y: this.mapMouse.y });
    this.updateUI();
  }

  syncColorPicker() {
    document.getElementById('color-pick').value = this.paint.color;
  }

  syncSizeSlider() {
    document.getElementById('size-pick').value = this.paint.size;
  }

  mapW() { return this.map ? this.map.width : 900; }
  mapH() { return this.map ? this.map.height : 600; }

  // ───── Network ─────
  bindNet() {
    this.net.on('room-update', d => {
      this.state = d.state;
      this.round = d.round;
      this.maxRounds = d.maxRounds;
      this.mergePlayers(d.players);
      this.updateUI();
      if (d.state === 'lobby') this.show('room-screen');
    });

    this.net.on('game-started', d => {
      const prevState = this.state;
      this.state = d.state;
      this.map = new GameMap(d.mapData);
      this.round = d.round;
      this.maxRounds = d.maxRounds;
      this.mergePlayers(d.players);
      this.paint.strokes.clear();
      for (const [id, p] of Object.entries(d.players)) {
        if (p.strokes?.length) this.paint.strokes.set(id, p.strokes);
      }
      this.me = this.players[this.net.myId];
      this.role = this.me?.role;
      this.paint.active = false;
      this.drag = false;

      if (this.role === 'hider') {
        this.userZoom = 1;
        this.zoomX = 0;
        this.zoomY = 0;
      }

      if (d.state === 'hunt' && this.role === 'seeker') {
        const hiderCount = Object.values(d.players).filter(p => p.role === 'hider').length;
        this.shootsLeft = hiderCount;
      }

      this.show('game-screen');
      this.updateUI();
      this.loop();
    });

    this.net.on('person-moved', d => {
      if (this.players[d.id]) { this.players[d.id].x = d.x; this.players[d.id].y = d.y; }
    });

    this.net.on('stroke-applied', d => {
      this.paint.addStroke(d.id, { x: d.x, y: d.y, color: d.color, size: d.size });
    });

    this.net.on('paint-cleared', d => this.paint.clearStrokes(d.id));
    this.net.on('paint-undone', d => this.paint.undoStroke(d.id));

    this.net.on('guess-result', d => {
      if (d.found) {
        this.flash(`${d.name} found!`, '#e74c3c');
        if (d.id && this.players[d.id]) this.players[d.id].alive = false;
      } else {
        this.flash('Nothing here', '#95a5a6');
      }
    });

    this.net.on('timer', t => { this.timer = t; this.updateUI(); });

    this.net.on('game-finished', d => {
      this.state = 'finished';
      this.showResults(d);
    });
  }

  mergePlayers(data) {
    for (const [id, p] of Object.entries(data)) {
      if (!this.players[id]) this.players[id] = { ...p };
      else Object.assign(this.players[id], p);
    }
    for (const id of Object.keys(this.players)) {
      if (!data[id]) delete this.players[id];
    }
  }

  // ───── Render ─────
  loop() {
    if (this.onScreen !== 'game-screen') return;
    this.render();
    requestAnimationFrame(() => this.loop());
  }

  render() {
    const ctx = this.ctx;
    const W = this.cvs.width, H = this.cvs.height;
    ctx.clearRect(0, 0, W, H);
    if (!this.map) return;

    this.scale = Math.min(W / this.map.width, H / this.map.height);
    this.ox = (W - this.map.width * this.scale) / 2;
    this.oy = (H - this.map.height * this.scale) / 2;

    ctx.save();
    ctx.translate(this.ox + this.zoomX, this.oy + this.zoomY);
    ctx.scale(this.scale * this.userZoom, this.scale * this.userZoom);

    // Background image
    this.map.draw(ctx);

    // Players
    const mx = this.mapMouse.x, my = this.mapMouse.y;
    const sorted = Object.values(this.players).sort((a, b) => a.y - b.y);
    for (const p of sorted) {
      const isMe = p.id === this.net.myId;

      // Never display seeker's own body
      if (isMe && this.role === 'seeker') continue;

      // Hide seeker body from hiders at all times
      if (this.role === 'hider' && p.role === 'seeker') continue;

      const strokes = this.paint.strokes.get(p.id) || p.strokes || [];
      const opts = {};

      if (isMe && this.state === 'prep') {
        if (!this.paint.active) {
          opts.ring = '#3498db';
        }
        opts.label = 'Drag to hide';
        opts.labelColor = '#3498db';
      } else if (this.role === 'hider' && p.role === 'hider' && !isMe) {
        opts.label = p.name;
        opts.labelColor = '#ffffff';
      } else if (this.role === 'seeker' && p.role === 'hider' && (this.state === 'reveal' || this.state === 'finished')) {
        opts.label = p.name;
        opts.labelColor = '#ffffff';
      }

      if (p.role === 'hider' && !p.alive) {
        opts.ring = '#e74c3c';
        opts.tint = 'rgba(231,76,60,.5)';
      } else if (this.state === 'reveal' || this.state === 'finished') {
        if (p.role === 'hider') {
          opts.ring = '#2ecc71';
          opts.tint = 'rgba(46,204,113,.5)';
        }
      }

      this.paint.drawBody(ctx, p.x, p.y, strokes, opts);
    }

    // Paint cursor (in map space) — colored circle showing brush size
    if (this.role === 'hider' && this.state === 'prep' && this.paint.active) {
      const r = this.paint.size / 2;
      ctx.fillStyle = this.paint.color;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Crosshair (in map space)
    if (this.role === 'seeker' && this.state === 'hunt') {
      const r = 14;
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 2 / (this.scale * this.userZoom);
      ctx.beginPath(); ctx.moveTo(mx - r, my); ctx.lineTo(mx + r, my); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, my - r); ctx.lineTo(mx, my + r); ctx.stroke();
      ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.restore();
  }

  updateUI() {
    const el = id => document.getElementById(id);
    el('timer').textContent = this.timer;
    el('round-info').textContent = `Round ${this.round}/${this.maxRounds}`;
    el('phase-badge').textContent =
      this.state === 'prep' ? 'HIDE & PAINT' :
      this.state === 'hunt' ? 'SEARCH' :
      this.state === 'reveal' ? 'RESULT' :
      this.state === 'between-rounds' ? 'ROUND OVER' : '';

    el('toolbar').style.display = (this.role === 'hider' && this.state === 'prep') ? 'flex' : 'none';

    const badge = el('role-badge');
    badge.textContent = this.role === 'seeker' ? 'You are SEEKER' : 'You are HIDER';
    badge.className = 'role-badge ' + this.role;

    el('controls').style.display = (this.role === 'hider' && this.state === 'prep') ? 'block' : 'none';

    const shootsInfo = el('shoots-info');
    const shootsCount = el('shoots-count');
    if (this.role === 'seeker' && (this.state === 'hunt' || this.state === 'reveal')) {
      shootsInfo.style.display = 'block';
      shootsCount.textContent = this.shootsLeft;
    } else {
      shootsInfo.style.display = 'none';
    }

    const seekerWait = el('seeker-wait');
    const seekerOverlay = el('seeker-overlay');
    if (this.role === 'seeker' && this.state === 'prep') {
      seekerWait.style.display = 'block';
      seekerOverlay.style.display = 'block';
      el('seeker-countdown').textContent = this.timer;
    } else {
      seekerWait.style.display = 'none';
      seekerOverlay.style.display = 'none';
    }

    const betweenRounds = el('between-rounds');
    const nextRoundBtn = el('next-round-btn');
    const betweenWait = el('between-rounds-wait');
    if (this.state === 'between-rounds') {
      betweenRounds.style.display = 'block';
      const me = this.players[this.net.myId];
      if (me?.isHost) {
        nextRoundBtn.style.display = 'block';
        betweenWait.style.display = 'none';
      } else {
        nextRoundBtn.style.display = 'none';
        betweenWait.style.display = 'block';
      }
      const scores = el('between-rounds-scores');
      scores.innerHTML = Object.values(this.players)
        .map(p => `<div class="entry"><b>${p.name}</b>: ${p.score} pts</div>`)
        .join('');
    } else {
      betweenRounds.style.display = 'none';
    }
  }

  updateToolbar() {
    document.querySelectorAll('.tbtn').forEach(b => b.classList.remove('active'));
    if (this.sampleMode) document.getElementById('tool-sample').classList.add('active');
    else if (this.paint.active) document.getElementById('tool-brush').classList.add('active');
  }

  flash(text, color = '#fff') {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.85);color:${color};padding:14px 28px;border-radius:10px;font-size:1.3rem;font-weight:700;z-index:9999;pointer-events:none`;
    d.textContent = text;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1400);
  }

  showResults(data) {
    const box = document.getElementById('final-results');
    box.innerHTML = '';
    Object.values(data.players)
      .sort((a, b) => b.score - a.score)
      .forEach(p => {
        const d = document.createElement('div');
        d.className = 'result-player';
        d.innerHTML = `<span style="color:${p.color || '#888'}">●</span><span>${p.name}</span><span class="score">${p.score} pts</span>`;
        box.appendChild(d);
      });
    const me = data.players[this.net.myId];
    document.getElementById('play-again-btn').style.display = me?.isHost ? 'block' : 'none';
    this.show('finished-screen');
  }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

window.Game = Game;
