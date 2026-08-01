const MAPS = require('./maps');

const PHASES = {
  prep: 60,
  hunt: 45,
  reveal: 6
};

class GameRoom {
  constructor(code, mapName, io) {
    this.code = code;
    this.io = io;
    this.hostId = null;
    this.players = new Map();
    this.state = 'lobby';
    this.mapName = mapName || 'starry-night';
    this.mapData = MAPS[this.mapName] || MAPS['starry-night'];
    this.timer = 0;
    this.timerInterval = null;
    this.round = 0;
    this.maxRounds = 3;
    this.shotsFired = 0;
    this.huntStart = 0;
  }

  addPlayer(id, name) {
    if (this.players.size === 0) this.hostId = id;
    this.players.set(id, {
      id, name: name || `P${this.players.size + 1}`,
      role: null, x: 0, y: 0, strokes: [],
      alive: true, score: 0
    });
  }

  removePlayer(id) {
    this.players.delete(id);
    if (id === this.hostId && this.players.size > 0)
      this.hostId = this.players.keys().next().value;
  }

  startGame() {
    this.state = 'prep';
    this.round++;
    this.shotsFired = 0;
    const ids = Array.from(this.players.keys());
    const seekCount = Math.max(1, Math.floor(ids.length / 4));
    const shuffled = ids.sort(() => Math.random() - 0.5);

    shuffled.forEach((id, i) => {
      const p = this.players.get(id);
      p.role = i < seekCount ? 'seeker' : 'hider';
      p.x = this.mapData.width / 2;
      p.y = this.mapData.height / 2;
      p.strokes = [];
      p.alive = true;
    });

    this.tick(PHASES.prep, () => {
      this.state = 'hunt';
      this.huntStart = PHASES.hunt;
      this.tick(PHASES.hunt, () => this.endRound());
      this.emit('game-started', this.serialize());
    });
    this.emit('game-started', this.serialize());
  }

  endRound() {
    this.state = 'reveal';
    const elapsed = this.huntStart - this.timer;
    this.players.forEach(p => {
      if (p.role === 'hider') {
        if (p.alive) {
          p.score += 100 + elapsed * 2;
        } else if (p.foundAt != null) {
          const survived = this.huntStart - p.foundAt;
          p.score += survived * 2;
        }
      }
    });
    this.players.forEach(p => {
      if (p.role === 'seeker') {
        const found = [...this.players].filter(([, h]) => h.role === 'hider' && !h.alive && h.foundBy === p.id).length;
        p.score += found * 50;
      }
    });
    this.emit('room-update', this.serialize());
    this.tick(PHASES.reveal, () => {
      if (this.round >= this.maxRounds) {
        this.endGame();
      } else {
        this.state = 'between-rounds';
        this.emit('room-update', this.serialize());
      }
    });
  }

  nextRound() {
    if (this.state !== 'between-rounds') return;
    this.startGame();
  }

  endGame() {
    this.state = 'finished';
    this.clearTick();
    this.emit('game-finished', this.serialize());
  }

  returnToLobby() {
    this.state = 'lobby';
    this.clearTick();
    this.round = 0;
    this.players.forEach(p => {
      p.role = null; p.alive = true; p.strokes = []; p.score = 0;
    });
    this.emit('room-update', this.serialize());
  }

  tick(secs, cb) {
    this.clearTick();
    this.timer = secs;
    this.emit('timer', this.timer);
    this.timerInterval = setInterval(() => {
      this.timer--;
      this.emit('timer', this.timer);
      if (this.timer <= 0) { this.clearTick(); cb(); }
    }, 1000);
  }

  clearTick() {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  }

  movePerson(id, x, y) {
    const p = this.players.get(id);
    if (!p || p.role !== 'hider' || this.state !== 'prep') return;
    p.x = Math.max(0, Math.min(this.mapData.width - 24, x));
    p.y = Math.max(0, Math.min(this.mapData.height - 48, y));
  }

  addStroke(id, data) {
    const p = this.players.get(id);
    if (!p || p.role !== 'hider' || this.state !== 'prep') return;
    p.strokes.push(data);
  }

  clearStrokes(id) {
    const p = this.players.get(id);
    if (p) p.strokes = [];
  }

  undoStroke(id) {
    const p = this.players.get(id);
    if (p && p.strokes.length) p.strokes.pop();
  }

  sampleColor(x, y) {
    for (const s of this.mapData.surfaces) {
      if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return s.color;
    }
    return this.mapData.background;
  }

  guess(id, x, y) {
    const seeker = this.players.get(id);
    if (!seeker || seeker.role !== 'seeker' || this.state !== 'hunt') return null;

    const hiderCount = [...this.players].filter(([, p]) => p.role === 'hider').length;
    if (this.shotsFired >= hiderCount) return null;
    this.shotsFired++;

    let hit = null;
    this.players.forEach(p => {
      if (p.role === 'hider' && p.alive && !hit) {
        if (x >= p.x && x <= p.x + 24 && y >= p.y && y <= p.y + 48) hit = p;
      }
    });

    if (hit) {
      hit.alive = false;
      hit.foundBy = id;
      hit.foundAt = this.timer;
      const allFound = [...this.players].every(([, p]) => p.role !== 'hider' || !p.alive);
      if (allFound || this.shotsFired >= hiderCount) { this.clearTick(); this.endRound(); }
      return { found: true, name: hit.name, id: hit.id, allFound };
    }
    if (this.shotsFired >= hiderCount) { this.clearTick(); this.endRound(); }
    return { found: false };
  }

  emit(evt, data) { this.io.to(this.code).emit(evt, data); }

  serialize() {
    const players = {};
    this.players.forEach((p, id) => {
      players[id] = {
        id: p.id, name: p.name, role: p.role,
        x: p.x, y: p.y, strokes: p.strokes,
        alive: p.alive, score: p.score,
        isHost: id === this.hostId
      };
    });
    return {
      code: this.code, state: this.state, hostId: this.hostId,
      mapName: this.mapName, mapData: this.mapData,
      players, timer: this.timer,
      round: this.round, maxRounds: this.maxRounds
    };
  }
}

module.exports = GameRoom;
