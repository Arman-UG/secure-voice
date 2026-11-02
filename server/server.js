'use strict';

const express = require('express');
const http = require('http');
const cors = require('cors');
const webpush = require('web-push');
const dotenv = require('dotenv');
dotenv.config();
const { Server } = require('socket.io');
const { Pool } = require('pg');

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

// A pending call older than this is considered stale.
const PENDING_CALL_TTL_MS = 45_000;

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
const pendingCalls = new Map();   // target number -> pending incoming call

const isValidNumber = (v) => typeof v === 'string' && /^\d{10}$/.test(v);

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

/* ---------------- Push subscription routes ---------------- */
app.post('/push/subscribe', async (req, res) => {
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

  try {
    await db.query(
      `
      INSERT INTO public.push_subscriptions (
        number,
        subscription,
        updated_at
      )
      VALUES ($1, $2, NOW())
      ON CONFLICT (number)
      DO UPDATE SET
        subscription = EXCLUDED.subscription,
        updated_at = NOW()
      `,
      [number, JSON.stringify(subscription)]
    );

    console.log(`[push] subscription saved to Neon for ${number}`);

    return res.json({ ok: true });
  } catch (error) {
    console.error(`[push] failed to save subscription for ${number}:`, error);

    return res.status(500).json({
      ok: false,
      error: 'Could not save push subscription',
    });
  }
});

app.post('/push/unsubscribe', async (req, res) => {
  const { number } = req.body || {};

  if (!isValidNumber(number)) {
    return res.status(400).json({
      ok: false,
      error: 'Number must be exactly 10 digits',
    });
  }

  try {
    await db.query(
      `
      DELETE FROM public.push_subscriptions
      WHERE number = $1
      `,
      [number]
    );

    console.log(`[push] subscription removed from Neon for ${number}`);

    return res.json({ ok: true });
  } catch (error) {
    console.error(`[push] failed to remove subscription for ${number}:`, error);

    return res.status(500).json({
      ok: false,
      error: 'Could not remove push subscription',
    });
  }
});

/* ---------------- Socket events ---------------- */
io.on('connection', (socket) => {
  console.log(`[socket] connected ${socket.id}`);

  /* -------- REGISTER -------- */
  socket.on('register', async (payload = {}, ack) => {
    const respond = typeof ack === 'function' ? ack : () => {};

    const number = payload?.number;
    const deviceId = payload?.deviceId;

    // Validate device identity.
    if (
      typeof deviceId !== 'string' ||
      deviceId.length < 10 ||
      deviceId.length > 100
    ) {
      return respond({
        ok: false,
        error: 'Invalid device identity. Please refresh and try again.',
      });
    }

    // Validate phone number.
    if (!isValidNumber(number)) {
      return respond({
        ok: false,
        error: 'Number must be exactly 10 digits',
      });
    }

    try {
      // Find the existing user.
      let result = await db.query(
        `
        SELECT
          id,
          number,
          name,
          device_id,
          created_at,
          is_blocked,
          call_restricted_until
        FROM public.users
        WHERE number = $1
        `,
        [number]
      );

      let user = result.rows[0];

      // Create the user if this number does not exist yet.
      if (!user) {
        result = await db.query(
          `
          INSERT INTO public.users (number)
          VALUES ($1)
          RETURNING
            id,
            number,
            name,
            device_id,
            created_at,
            is_blocked,
            call_restricted_until
          `,
          [number]
        );

        user = result.rows[0];

        console.log(`[db] user created ${number} -> id ${user.id}`);
      } else {
        console.log(`[db] user found ${number} -> id ${user.id}`);
      }

      // Assign an unclaimed number to its first device.
      if (!user.device_id) {
        const claim = await db.query(
          `
          UPDATE public.users
          SET device_id = $1
          WHERE number = $2
            AND device_id IS NULL
          RETURNING device_id
          `,
          [deviceId, number]
        );

        if (claim.rows.length > 0) {
          user.device_id = claim.rows[0].device_id;
        } else {
          // Another connection may have claimed it first.
          const latest = await db.query(
            `
            SELECT device_id
            FROM public.users
            WHERE number = $1
            `,
            [number]
          );

          user.device_id = latest.rows[0]?.device_id || null;
        }
      }

      // Reject a different device before registering its socket.
      if (!user.device_id || user.device_id !== deviceId) {
        return respond({
          ok: false,
          error: 'This number is registered on another device.',
        });
      }

      // Allow the same device to reconnect after refreshing.
      const existing = numberToSocket.get(number);

      if (existing && existing !== socket.id) {
        const existingSocket = io.sockets.sockets.get(existing);

        if (existingSocket) {
          // Remove the old mapping first so its disconnect handler
          // cannot accidentally remove the new socket's mapping.
          socketToNumber.delete(existing);
          numberToSocket.set(number, socket.id);

          // End any call belonging to the old socket.
          const peer = releaseCall(existing);

          if (peer) {
            io.to(peer).emit('peer-disconnected', { from: existing });
          }

          existingSocket.disconnect(true);
        } else {
          numberToSocket.delete(number);
          socketToNumber.delete(existing);
        }
      }

      // Remove any different number previously registered to this socket.
      const previous = socketToNumber.get(socket.id);

      if (
        previous &&
        previous !== number &&
        numberToSocket.get(previous) === socket.id
      ) {
        numberToSocket.delete(previous);
      }

      // Register this socket.
      numberToSocket.set(number, socket.id);
      socketToNumber.set(socket.id, number);

      // Deliver a pending offline call, if one exists and is still fresh.
      let pending = pendingCalls.get(number);

      if (pending && Date.now() - pending.createdAt > PENDING_CALL_TTL_MS) {
        pendingCalls.delete(number);
        console.log(`[call] expired pending call removed for ${number}`);
        pending = null;
      }

      if (pending) {
        const callerSocket = io.sockets.sockets.get(pending.from);

        if (callerSocket) {
          activeCalls.set(socket.id, pending.from);
          activeCalls.set(pending.from, socket.id);

          socket.emit('incoming-call', {
            callerName: pending.callerName,
            callerNumber: pending.callerNumber,
            offer: pending.offer,
            from: pending.from,
          });

          pendingCalls.delete(number);

          console.log(
            `[call] pending call delivered ${pending.callerNumber} -> ${number}`
          );
        } else {
          pendingCalls.delete(number);

          console.log(`[call] stale pending call removed for ${number}`);
        }
      }

      respond({
        ok: true,
        number,
        userId: user.id,
      });

      console.log(`[socket] register ${number} -> ${socket.id}`);
    } catch (error) {
      console.error(`[db] registration failed for ${number}:`, error);

      respond({
        ok: false,
        error: 'Database error',
      });
    }
  });

  /* -------- DELETE ACCOUNT -------- */
  socket.on('delete-account', async (ack) => {
    const respond = typeof ack === 'function' ? ack : () => {};

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

      // End any active call associated with this socket.
      const peer = releaseCall(socket.id);

      if (peer) {
        io.to(peer).emit('peer-disconnected', { from: socket.id });
      }

      console.log(`[db] account deleted ${number} -> id ${result.rows[0].id}`);

      respond({ ok: true });
    } catch (error) {
      console.error(`[db] account deletion failed for ${number}:`, error);

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

    if (!callerNumber) {
      return socket.emit('call-failed', { reason: 'unregistered' });
    }
    if (!isValidNumber(targetNumber)) {
      return socket.emit('call-failed', { reason: 'invalid' });
    }

    const targetSocketId = numberToSocket.get(targetNumber);
    const targetSocket = targetSocketId
      ? io.sockets.sockets.get(targetSocketId)
      : null;

    /* ---- Target is offline: try Web Push ---- */
    if (!targetSocketId || !targetSocket) {
      let subscription;

      try {
        const subscriptionResult = await db.query(
          `
          SELECT subscription
          FROM public.push_subscriptions
          WHERE number = $1
          `,
          [targetNumber]
        );

        subscription = subscriptionResult.rows[0]?.subscription;
      } catch (error) {
        console.error(
          `[push] could not load subscription for ${targetNumber}:`,
          error
        );

        return socket.emit('call-failed', { reason: 'offline' });
      }

      if (!subscription) {
        return socket.emit('call-failed', { reason: 'offline' });
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
          }),
          // High urgency + short TTL so Android delivers it immediately
          // even in Doze mode, and drops it if the call is already stale.
          { urgency: 'high', TTL: 30 }
        );

        console.log(`[push] sent ${callerNumber} -> ${targetNumber}`);

        return socket.emit('call-notification-sent', { targetNumber });
      } catch (error) {
        console.error(
          `[push] failed for ${targetNumber}:`,
          error.statusCode,
          error.body || error.message
        );

        // Push failed, so don't keep a useless pending call.
        pendingCalls.delete(targetNumber);

        // Only delete the subscription if it is really dead.
        if (error.statusCode === 404 || error.statusCode === 410) {
          try {
            await db.query(
              `
              DELETE FROM public.push_subscriptions
              WHERE number = $1
              `,
              [targetNumber]
            );
          } catch (dbError) {
            console.error(
              `[push] could not delete dead subscription for ${targetNumber}:`,
              dbError
            );
          }
        }

        return socket.emit('call-failed', { reason: 'offline' });
      }
    }

    /* ---- Target is online: normal socket call ---- */
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