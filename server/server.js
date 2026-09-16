'use strict';

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN, credentials: false }));
app.use(express.json());

const server = http.createServer(app);

/* ---------------- In-memory state ---------------- */
const numberToSocket = new Map(); // number -> socket.id
const socketToNumber = new Map(); // socket.id -> number
const activeCalls = new Map();    // socket.id -> peer socket.id

const isValidNumber = (v) => typeof v === 'string' && /^\d{10}$/.test(v);

function generateUniqueNumber() {
  let n;
  let attempts = 0;
  do {
    n = String(Math.floor(1000000000 + Math.random() * 9000000000));
    attempts++;
  } while (numberToSocket.has(n) && attempts < 100);
  return n;
}

function releaseCall(socketId) {
  const peer = activeCalls.get(socketId);
  if (peer) activeCalls.delete(peer);
  activeCalls.delete(socketId);
  return peer || null;
}

/* ---------------- Socket.io ---------------- */
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
  pingTimeout: 25_000,
  pingInterval: 10_000,
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    registeredNumbers: numberToSocket.size,
    activeCalls: activeCalls.size / 2,
  });
});

io.on('connection', (socket) => {
  console.log(`[socket] connected ${socket.id}`);

  /* -------- AUTO-REGISTER: server khud number dega -------- */
  socket.on('register', (payload = {}, ack) => {
    const respond = typeof ack === 'function' ? ack : () => {};

    let number = payload && payload.number;

    // Agar user ne number nahi diya → server khud generate kare
    if (!number) {
      number = generateUniqueNumber();
    }

    if (!isValidNumber(number)) {
      return respond({ ok: false, error: 'Invalid number format' });
    }
    const existing = numberToSocket.get(number);
    if (existing && existing !== socket.id) {
      return respond({ ok: false, error: 'Number already in use' });
    }

    // Purana number chhod do
    const previous = socketToNumber.get(socket.id);
    if (previous && previous !== number && numberToSocket.get(previous) === socket.id) {
      numberToSocket.delete(previous);
    }

    numberToSocket.set(number, socket.id);
    socketToNumber.set(socket.id, number);

    respond({ ok: true, number });
    console.log(`[socket] register ${number} -> ${socket.id}`);
  });

  /* -------- CALL USER -------- */
  socket.on('call-user', (payload = {}) => {
    const { callerName, targetNumber, offer } = payload;
    const callerNumber = socketToNumber.get(socket.id);

    if (!callerNumber) return socket.emit('call-failed', { reason: 'unregistered' });
    if (!isValidNumber(targetNumber)) return socket.emit('call-failed', { reason: 'invalid' });

    const targetSocketId = numberToSocket.get(targetNumber);
    const targetSocket = targetSocketId ? io.sockets.sockets.get(targetSocketId) : null;

    if (!targetSocketId || !targetSocket) {
      return socket.emit('call-failed', { reason: 'offline' });
    }
    if (activeCalls.has(targetSocketId) || activeCalls.has(socket.id)) {
      return socket.emit('call-failed', { reason: 'busy' });
    }

    activeCalls.set(socket.id, targetSocketId);
    activeCalls.set(targetSocketId, socket.id);

    io.to(targetSocketId).emit('incoming-call', {
      callerName: callerName || 'Unknown',
      callerNumber,
      offer,
      from: socket.id,
    });

    console.log(`[socket] call-user ${callerNumber} -> ${targetNumber}`);
  });

  /* -------- MAKE ANSWER -------- */
  socket.on('make-answer', ({ to, answer } = {}) => {
    if (!to || !answer) return;
    io.to(to).emit('call-answered', { answer, from: socket.id });
  });

  /* -------- ICE CANDIDATE -------- */
  socket.on('ice-candidate', ({ to, candidate } = {}) => {
    if (!to || !candidate) return;
    io.to(to).emit('ice-candidate', { candidate, from: socket.id });
  });

  /* -------- REJECT / END -------- */
  socket.on('reject-call', ({ to } = {}) => {
    releaseCall(socket.id);
    if (to) io.to(to).emit('call-rejected', { from: socket.id });
  });

  socket.on('end-call', ({ to } = {}) => {
    releaseCall(socket.id);
    if (to) io.to(to).emit('call-ended', { from: socket.id });
  });

  /* -------- DISCONNECT -------- */
  socket.on('disconnect', (reason) => {
    const peer = releaseCall(socket.id);
    if (peer) io.to(peer).emit('peer-disconnected', { from: socket.id });

    const number = socketToNumber.get(socket.id);
    if (number && numberToSocket.get(number) === socket.id) {
      numberToSocket.delete(number);
    }
    socketToNumber.delete(socket.id);
    console.log(`[socket] disconnected ${socket.id} (${reason})`);
  });
});

server.listen(PORT, () => {
  console.log(`▶ Signaling server listening on http://localhost:${PORT}`);
});

module.exports = { app, server, io };