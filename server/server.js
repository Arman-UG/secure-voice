'use strict';


const express = require('express');
const http = require('http');
const cors = require('cors');
const webpush = require('web-push');
const dotenv = require('dotenv');
dotenv.config();
const { Server } = require('socket.io');
const { Pool } = require('pg');
dotenv.config();

const db = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }
);

db.query('SELECT NOW()')
  .then(() => {
    console.log('[db] PostgreSQL connected successfully');
  })
  .catch((error) => {
    console.error('[db] PostgreSQL connection failed:', error.message);
  });

const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN, credentials: false }));
app.use(express.json());

const server = http.createServer(app);

/* ---------------- In-memory state ---------------- */
const numberToSocket = new Map(); // number -> socket.id
const socketToNumber = new Map(); // socket.id -> number
const activeCalls = new Map();    // socket.id -> peer socket.id
const pushSubscriptions = new Map();  // number -> push subscription
const pendingCalls = new Map(); // target number -> pending incoming call

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

app.post('/push/subscribe', (req, res) => {
  const { number, subscription } = req.body || {};

  if (!isValidNumber(number)) {
    return res.status(400).json({
      ok: false,
      error: 'Number must be exactly 10 digits',
    });
  }

  if (!subscription || typeof subscription !== 'object') {
    return res.status(400).json({
      ok: false,
      error: 'Invalid push subscription',
    });
  }

  pushSubscriptions.set(number, subscription);

  console.log(`[push] subscription saved for ${number}`);

  return res.json({
    ok: true,
  });
});

app.post('/push/unsubscribe', (req, res) => {
  const { number } = req.body || {};

  if (!isValidNumber(number)) {
    return res.status(400).json({
      ok: false,
      error: 'Number must be exactly 10 digits',
    });
  }

  pushSubscriptions.delete(number);

  console.log(`[push] subscription removed for ${number}`);

  return res.json({ ok: true });
});

io.on('connection', (socket) => {
  console.log(`[socket] connected ${socket.id}`);

  /* -------- AUTO-REGISTER: server khud number dega -------- */
socket.on('register', async (payload = {}, ack) => {
  const respond =
    typeof ack === 'function' ? ack : () => {};

  const number = payload?.number;

  // User must provide their own 10-digit number.
  if (!isValidNumber(number)) {
    return respond({
      ok: false,
      error: 'Number must be exactly 10 digits',
    });
  }

  try {
    // ------------------------------------------------------------
    // Find the user in PostgreSQL.
    // If the number does not exist, create it.
    // ------------------------------------------------------------
    let result = await db.query(
      `
      SELECT
        id,
        number,
        name,
        created_at,
        is_blocked,
        call_restricted_until
      FROM public.users
      WHERE number = $1
      `,
      [number]
    );

    let user = result.rows[0];

    if (!user) {
      result = await db.query(
        `
        INSERT INTO public.users (number)
        VALUES ($1)
        RETURNING
          id,
          number,
          name,
          created_at,
          is_blocked,
          call_restricted_until
        `,
        [number]
      );

      user = result.rows[0];

      console.log(
        `[db] user created ${number} -> id ${user.id}`
      );
    } else {
      console.log(
        `[db] user found ${number} -> id ${user.id}`
      );
    }

    // ------------------------------------------------------------
    // Existing socket-number logic
    // ------------------------------------------------------------
    const existing = numberToSocket.get(number);

    if (existing && existing !== socket.id) {
      // Check whether the old socket is actually still connected.
      const existingSocket =
        io.sockets.sockets.get(existing);

      if (existingSocket) {
        return respond({
          ok: false,
          error: 'Number already in use',
        });
      }

      // Old socket is gone → remove stale mapping.
      numberToSocket.delete(number);
      socketToNumber.delete(existing);
    }

    // Remove any previous number belonging to this socket.
    const previous = socketToNumber.get(socket.id);

    if (
      previous &&
      previous !== number &&
      numberToSocket.get(previous) === socket.id
    ) {
      numberToSocket.delete(previous);
    }

    // Register the number with the current socket.
    numberToSocket.set(number, socket.id);
    socketToNumber.set(socket.id, number);

    respond({
      ok: true,
      number,
      userId: user.id,
    });

    console.log(
      `[socket] register ${number} -> ${socket.id}`
    );
  } catch (error) {
    console.error(
      `[db] registration failed for ${number}:`,
      error
    );

    respond({
      ok: false,
      error: 'Database error',
    });
  }
});


/* -------- DELETE ACCOUNT -------- */

socket.on('delete-account', async (ack) => {
  const respond =
    typeof ack === 'function' ? ack : () => {};

  const number = socketToNumber.get(socket.id);

  if (!number) {
    return respond({
      ok: false,
      error: 'No registered account found.',
    });
  }

  try {
    const result = await db.query(
      `
      DELETE FROM public.users
      WHERE number = $1
      RETURNING id, number;
      `,
      [number]
    );

    if (result.rowCount === 0) {
      return respond({
        ok: false,
        error: 'Account not found.',
      });
    }

    // Remove live socket mappings.
    numberToSocket.delete(number);
    socketToNumber.delete(socket.id);

    // Remove push subscription mapping.
    pushSubscriptions.delete(number);

    // End any active call associated with this socket.
    const peer = releaseCall(socket.id);

    if (peer) {
      io.to(peer).emit('peer-disconnected', {
        from: socket.id,
      });
    }

    console.log(
      `[db] account deleted ${number} -> id ${result.rows[0].id}`
    );

    respond({
      ok: true,
    });
  } catch (error) {
    console.error(
      `[db] account deletion failed for ${number}:`,
      error
    );

    respond({
      ok: false,
      error: 'Could not delete account.',
    });
  }
});


  /* -------- CALL USER -------- */
  socket.on('call-user', async (payload = {}) => {
    const { callerName, targetNumber, offer } = payload;
    const callerNumber = socketToNumber.get(socket.id);

    if (!callerNumber) return socket.emit('call-failed', { reason: 'unregistered' });
    if (!isValidNumber(targetNumber)) return socket.emit('call-failed', { reason: 'invalid' });

    const targetSocketId = numberToSocket.get(targetNumber);
    const targetSocket = targetSocketId ? io.sockets.sockets.get(targetSocketId) : null;

    if (!targetSocketId || !targetSocket) {
  const subscription = pushSubscriptions.get(targetNumber);

  if (!subscription) {
    return socket.emit('call-failed', {
      reason: 'offline',
    });
  }

  // Store the complete call so it can be delivered
  // when the receiver opens/reconnects later.
  pendingCalls.set(targetNumber, {
    callerName: callerName || 'Unknown',
    callerNumber,
    offer,
    from: socket.id,
    createdAt: Date.now(),
  });

  console.log(
    `[call] pending call stored ${callerNumber} -> ${targetNumber}`
  );

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        type: 'incoming-call',
        callerName: callerName || 'Unknown',
        callerNumber,
      })
    );

    console.log(
      `[push] incoming call notification sent ${callerNumber} -> ${targetNumber}`
    );

    return socket.emit('call-notification-sent', {
      targetNumber,
    });
  } catch (error) {
    console.error(
      `[push] failed for ${targetNumber}:`,
      error
    );

    // Push failed, so don't keep a useless pending call.
    pendingCalls.delete(targetNumber);
    pushSubscriptions.delete(targetNumber);

    return socket.emit('call-failed', {
      reason: 'offline',
    });
  }
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
  socket.on('make-answer', ({ to, answer, receiverName } = {}) => {
  if (!to || !answer) return;

  io.to(to).emit('call-answered', {
    answer,
    from: socket.id,
    receiverName: receiverName || 'Unknown',
  });
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