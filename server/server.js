const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameRoom = require('./game/GameRoom');
const { getCategoryList, getImagesInCategory } = require('./game/maps');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(express.static(path.join(__dirname, '..', 'public')));

const rooms = new Map();
const playerRoom = new Map();

function genCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

io.on('connection', socket => {
  socket.on('get-categories', (_, cb) => {
    cb?.(getCategoryList());
  });

  socket.on('create-room', ({ name, category }, cb) => {
    const code = genCode();
    const room = new GameRoom(code, category || 'van-gogh', io);
    rooms.set(code, room);
    room.addPlayer(socket.id, name);
    playerRoom.set(socket.id, code);
    socket.join(code);
    cb({ ok: true, code, room: room.serialize() });
  });

  socket.on('set-category', ({ category }, cb) => {
    const code = playerRoom.get(socket.id);
    if (!code) return cb?.({ ok: false });
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return cb?.({ ok: false });
    if (room.state !== 'lobby') return cb?.({ ok: false });
    room.category = category;
    room.images = getImagesInCategory(category);
    if (room.images.length === 0) {
      room.images = [{ name: 'Fallback', image: null, width: 960, height: 540, background: '#1a1a3e' }];
    }
    room.mapData = room.images[0];
    room.maxRounds = room.images.length;
    cb?.({ ok: true });
    io.to(code).emit('room-update', room.serialize());
  });

  socket.on('join-room', ({ code, name }, cb) => {
    const room = rooms.get(code);
    if (!room) return cb({ ok: false, err: 'Room not found' });
    if (room.players.size >= 8) return cb({ ok: false, err: 'Full' });
    if (room.state !== 'lobby') return cb({ ok: false, err: 'In progress' });
    room.addPlayer(socket.id, name);
    playerRoom.set(socket.id, code);
    socket.join(code);
    cb({ ok: true, code, room: room.serialize() });
    io.to(code).emit('room-update', room.serialize());
  });

  socket.on('start-game', (_, cb) => {
    const code = playerRoom.get(socket.id);
    if (!code) return cb?.({ ok: false });
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return cb?.({ ok: false });
    if (room.players.size < 2) return cb?.({ ok: false, err: 'Need 2+ players' });
    room.startGame();
    cb?.({ ok: true });
  });

  socket.on('move', data => {
    const code = playerRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.movePerson(socket.id, data.x, data.y);
      socket.to(code).emit('person-moved', { id: socket.id, x: data.x, y: data.y });
    }
  });

  socket.on('stroke', data => {
    const code = playerRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.addStroke(socket.id, data);
      socket.to(code).emit('stroke-applied', { id: socket.id, x: data.x, y: data.y, color: data.color, size: data.size });
    }
  });

  socket.on('clear', () => {
    const code = playerRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.clearStrokes(socket.id);
      socket.to(code).emit('paint-cleared', { id: socket.id });
    }
  });

  socket.on('undo', () => {
    const code = playerRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.undoStroke(socket.id);
      socket.to(code).emit('paint-undone', { id: socket.id });
    }
  });

  socket.on('sample', (data, cb) => {
    const code = playerRoom.get(socket.id);
    if (!code) return cb?.(null);
    const room = rooms.get(code);
    cb?.(room ? room.sampleColor(data.x, data.y) : null);
  });

  socket.on('guess', data => {
    const code = playerRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      const res = room.guess(socket.id, data.x, data.y);
      if (res) io.to(code).emit('guess-result', res);
    }
  });

  socket.on('lobby', (_, cb) => {
    const code = playerRoom.get(socket.id);
    if (!code) return cb?.({ ok: false });
    const room = rooms.get(code);
    if (room && room.hostId === socket.id) { room.returnToLobby(); cb?.({ ok: true }); }
  });

  socket.on('next-round', (_, cb) => {
    const code = playerRoom.get(socket.id);
    if (!code) return cb?.({ ok: false });
    const room = rooms.get(code);
    if (room && room.hostId === socket.id) { room.nextRound(); cb?.({ ok: true }); }
  });

  socket.on('disconnect', () => {
    const code = playerRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.removePlayer(socket.id);
      io.to(code).emit('room-update', room.serialize());
      if (room.players.size === 0) rooms.delete(code);
    }
    playerRoom.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
