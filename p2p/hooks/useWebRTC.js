'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SIGNALING_URL = process.env.NEXT_PUBLIC_SIGNALING_URL || 'http://localhost:4000';

const RTC_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  iceCandidatePoolSize: 10,
};

export const CALL_STATE = Object.freeze({
  IDLE: 'idle',
  RINGING: 'ringing',
  INCOMING: 'incoming',
  IN_CALL: 'in-call',
});

export const SOCKET_STATUS = Object.freeze({
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
});

function describeMediaError(err) {
  if (!err) return 'Could not access your microphone.';
  switch (err.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone denied. Browser me allow karo aur retry karo.';
    case 'NotFoundError':
      return 'No microphone found on this device.';
    case 'NotReadableError':
      return 'Microphone is in use by another app.';
    default:
      return err.message || 'Microphone error.';
  }
}

export default function useWebRTC() {
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const outboundIceRef = useRef([]);
  const inboundIceRef = useRef([]);
  const peerSocketIdRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const myNumberRef = useRef(null);
  const callStateRef = useRef(CALL_STATE.IDLE);

  const [socketStatus, setSocketStatus] = useState(SOCKET_STATUS.CONNECTING);
  const [myNumber, setMyNumber] = useState(null);
  const [callState, setCallState] = useState(CALL_STATE.IDLE);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activePeer, setActivePeer] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [contacts, setContacts] = useState([]);

  const setPhase = useCallback((p) => {
    callStateRef.current = p;
    setCallState(p);
  }, []);

  const clearMessages = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  const teardownPeer = useCallback(() => {
    const pc = pcRef.current;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      try { pc.close(); } catch (_) {}
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    outboundIceRef.current = [];
    inboundIceRef.current = [];
    peerSocketIdRef.current = null;
    pendingOfferRef.current = null;
  }, []);

  const finishCall = useCallback((msg, kind = 'notice') => {
    teardownPeer();
    setActivePeer(null);
    setIncomingCall(null);
    setPhase(CALL_STATE.IDLE);
    if (msg) {
      if (kind === 'error') { setError(msg); setNotice(null); }
      else { setNotice(msg); setError(null); }
    }
  }, [setPhase, teardownPeer]);

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    return stream;
  }, []);

  const flushOutboundIce = useCallback(() => {
    const to = peerSocketIdRef.current;
    const socket = socketRef.current;
    if (!to || !socket || !outboundIceRef.current.length) return;
    outboundIceRef.current.forEach((c) => socket.emit('ice-candidate', { to, candidate: c }));
    outboundIceRef.current = [];
  }, []);

  const flushInboundIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const queue = inboundIceRef.current;
    inboundIceRef.current = [];
    for (const c of queue) {
      try { await pc.addIceCandidate(c); } catch (_) {}
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const to = peerSocketIdRef.current;
      const socket = socketRef.current;
      if (to && socket) socket.emit('ice-candidate', { to, candidate: e.candidate });
      else outboundIceRef.current.push(e.candidate);
    };

    pc.ontrack = (e) => {
      const [stream] = e.streams || [];
      if (stream && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        const p = remoteAudioRef.current.play?.();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        finishCall('Connection failed. Peer offline ho gaya.', 'error');
      }
    };

    pcRef.current = pc;
    return pc;
  }, [finishCall]);

  /* -------- Contact helpers -------- */
  const saveContact = useCallback((name, number) => {
    if (!name || !number || !/^\d{10}$/.test(number)) return;
    setContacts((prev) => {
      const existing = prev.findIndex((c) => c.number === number);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { name: name.trim(), number };
        return updated;
      }
      return [...prev, { name: name.trim(), number }];
    });
  }, []);

  const removeContact = useCallback((number) => {
    setContacts((prev) => prev.filter((c) => c.number !== number));
  }, []);

  /* -------- Load/Save contacts to localStorage -------- */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('secure-voice-contacts');
      if (saved) setContacts(JSON.parse(saved));
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('secure-voice-contacts', JSON.stringify(contacts));
    } catch (_) {}
  }, [contacts]);

  /* -------- Socket lifecycle + AUTO-REGISTER -------- */
  useEffect(() => {
    const socket = io(SIGNALING_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 20,
      reconnectionDelay: 1500,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketStatus(SOCKET_STATUS.CONNECTED);

      let savedNumber = null;
      try {
        savedNumber = localStorage.getItem('secure-voice-my-number');
      } catch (_) {}

      const payload = savedNumber ? { number: savedNumber } : {};

      socket.emit('register', payload, (ack) => {
        if (ack && ack.ok) {
          myNumberRef.current = ack.number;
          setMyNumber(ack.number);
          try {
            localStorage.setItem('secure-voice-my-number', ack.number);
          } catch (_) {}
        } else {
          // Saved number conflict kiya → naya maango
          socket.emit('register', {}, (ack2) => {
            if (ack2 && ack2.ok) {
              myNumberRef.current = ack2.number;
              setMyNumber(ack2.number);
              try {
                localStorage.setItem('secure-voice-my-number', ack2.number);
              } catch (_) {}
            } else {
              setError((ack2 && ack2.error) || 'Registration failed');
            }
          });
        }
      });
    });

    socket.on('connect_error', () => setSocketStatus(SOCKET_STATUS.DISCONNECTED));

    socket.on('disconnect', () => {
      setSocketStatus(SOCKET_STATUS.DISCONNECTED);
      if (['in-call', 'ringing', 'incoming'].includes(callStateRef.current)) {
        finishCall('Signaling server se disconnect ho gaya.', 'error');
      }
    });

    socket.on('incoming-call', ({ callerName, callerNumber, offer, from }) => {
      if (callStateRef.current !== CALL_STATE.IDLE) {
        socket.emit('reject-call', { to: from });
        return;
      }
      pendingOfferRef.current = { callerName, callerNumber, offer, from };
      setIncomingCall({ callerName, callerNumber });
      setActivePeer({ name: callerName, number: callerNumber });
      setError(null); setNotice(null);
      setPhase(CALL_STATE.INCOMING);
    });

    socket.on('call-answered', async ({ answer, from }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        peerSocketIdRef.current = from;
        await pc.setRemoteDescription(answer);
        flushOutboundIce();
        await flushInboundIce();
        setPhase(CALL_STATE.IN_CALL);
      } catch (_) {
        finishCall('Call setup failed.', 'error');
      }
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      if (!candidate) return;
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        inboundIceRef.current.push(candidate);
        return;
      }
      try { await pc.addIceCandidate(candidate); } catch (_) {}
    });

    socket.on('call-rejected', () => finishCall('Call reject ho gayi.'));
    socket.on('call-ended', () => finishCall('Doosre ne call kaat di.'));
    socket.on('peer-disconnected', () => finishCall('Peer disconnect ho gaya.'));
    socket.on('call-failed', ({ reason } = {}) => {
      const map = {
        offline: 'Ye number abhi online nahi hai. Dono phones pe app khula hona chahiye.',
        busy: 'Ye number already busy hai.',
        invalid: 'Number galat hai.',
        unregistered: 'Registration pending hai, ek second baad try karo.',
      };
      finishCall(map[reason] || 'Call complete nahi ho payi.', 'error');
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [finishCall, flushInboundIce, flushOutboundIce, setPhase]);

  /* -------- Public API: startCall -------- */
  const startCall = useCallback(async (rawName, rawTarget) => {
    const callerName = String(rawName || '').trim() || 'Unknown';
    const targetNumber = String(rawTarget || '').trim();
    const socket = socketRef.current;

    setError(null); setNotice(null);

    if (!myNumberRef.current) return setError('Registration pending, ek second baad try karo.');
    if (!socket || !socket.connected) return setError('Server se connect nahi ho paya.');
    if (!/^\d{10}$/.test(targetNumber)) return setError('Target number 10 digit ka hona chahiye.');
    if (targetNumber === myNumberRef.current) return setError('Khud ko call nahi kar sakte.');
    if (callStateRef.current !== CALL_STATE.IDLE) return setError('Already ek call chal rahi hai.');

    try {
      const stream = await ensureLocalStream();
      const pc = createPeerConnection();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setActivePeer({ name: callerName, number: targetNumber });
      setPhase(CALL_STATE.RINGING);

      // Auto-save contact (agar naam diya hai)
      if (callerName && callerName !== 'Unknown') {
        saveContact(callerName, targetNumber);
      }

      socket.emit('call-user', {
        callerName,
        targetNumber,
        offer: pc.localDescription || offer,
      });
    } catch (err) {
      teardownPeer();
      setActivePeer(null);
      setPhase(CALL_STATE.IDLE);
      setError(describeMediaError(err));
    }
  }, [createPeerConnection, ensureLocalStream, saveContact, setPhase, teardownPeer]);

  const acceptCall = useCallback(async () => {
    const pending = pendingOfferRef.current;
    const socket = socketRef.current;
    if (!pending || !socket) return;

    setError(null); setNotice(null);

    try {
      const stream = await ensureLocalStream();
      peerSocketIdRef.current = pending.from;
      const pc = createPeerConnection();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      await pc.setRemoteDescription(pending.offer);
      flushOutboundIce();
      await flushInboundIce();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('make-answer', { to: pending.from, answer: pc.localDescription || answer });

      pendingOfferRef.current = null;
      setIncomingCall(null);
      setPhase(CALL_STATE.IN_CALL);
    } catch (err) {
      if (socket && pending.from) socket.emit('reject-call', { to: pending.from });
      finishCall(describeMediaError(err), 'error');
    }
  }, [createPeerConnection, ensureLocalStream, finishCall, flushInboundIce, flushOutboundIce, setPhase]);

  const rejectCall = useCallback(() => {
    const pending = pendingOfferRef.current;
    const socket = socketRef.current;
    if (pending && socket) socket.emit('reject-call', { to: pending.from });
    finishCall();
  }, [finishCall]);

  const hangUp = useCallback(() => {
    const peer = peerSocketIdRef.current;
    const socket = socketRef.current;
    if (peer && socket) socket.emit('end-call', { to: peer });
    finishCall('Call ended.');
  }, [finishCall]);

  return {
    socketStatus,
    myNumber,
    callState,
    incomingCall,
    activePeer,
    error,
    notice,
    remoteAudioRef,
    contacts,         // ← add
    saveContact,      // ← add
    removeContact,    // ← add
    startCall,
    acceptCall,
    rejectCall,
    hangUp,
    clearMessages,
  };
}