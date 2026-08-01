class Net {
  constructor() {
    this.socket = null;
    this.myId = null;
    this._cb = {};
  }

  connect() {
    this.socket = io();
    this.socket.on('connect', () => { this.myId = this.socket.id; });
    this.socket.on('room-update', d => this._fire('room-update', d));
    this.socket.on('game-started', d => this._fire('game-started', d));
    this.socket.on('person-moved', d => this._fire('person-moved', d));
    this.socket.on('stroke-applied', d => this._fire('stroke-applied', d));
    this.socket.on('paint-cleared', d => this._fire('paint-cleared', d));
    this.socket.on('paint-undone', d => this._fire('paint-undone', d));
    this.socket.on('guess-result', d => this._fire('guess-result', d));
    this.socket.on('timer', d => this._fire('timer', d));
    this.socket.on('game-finished', d => this._fire('game-finished', d));
  }

  createRoom(name, map) {
    return new Promise(r => this.socket.emit('create-room', { name, map }, r));
  }

  joinRoom(code, name) {
    return new Promise(r => this.socket.emit('join-room', { code, name }, r));
  }

  startGame() {
    return new Promise(r => this.socket.emit('start-game', null, r));
  }

  returnToLobby() {
    return new Promise(r => this.socket.emit('lobby', null, r));
  }

  nextRound() {
    return new Promise(r => this.socket.emit('next-round', null, r));
  }

  on(evt, fn) {
    if (!this._cb[evt]) this._cb[evt] = [];
    this._cb[evt].push(fn);
  }

  _fire(evt, data) {
    (this._cb[evt] || []).forEach(fn => fn(data));
  }
}

window.Net = Net;
