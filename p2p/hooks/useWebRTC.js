'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SIGNALING_URL =
  process.env.NEXT_PUBLIC_SIGNALING_URL || 'http://localhost:4000';

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

const RINGTONES = Object.freeze([
  {
    id: 'secure-voice-default',
    name: 'Secure Voice',
    src: '/audio/ringtone.mp3',
  },
]);


function describeMediaError(err) {
  if (!err) return 'Could not access your microphone.';

  switch (err.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone permission was denied. Allow microphone access and try again.';

    case 'NotFoundError':
      return 'No microphone was found on this device.';

    case 'NotReadableError':
      return 'Microphone could not be accessed right now. Please try again.';

    default:
      return err.message || 'Could not access your microphone.';
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
  const myNameRef = useRef(null);

  const callStateRef = useRef(CALL_STATE.IDLE);
  const activeRecentCallIdRef = useRef(null);
  const callStartedAtRef = useRef(null);
  const ringtoneAudioRef = useRef(null);
  const [socketStatus, setSocketStatus] = useState(SOCKET_STATUS.CONNECTING);

  const [myNumber, setMyNumber] = useState(null);
  const [myName, setMyName] = useState(null);

  const [registrationRequired, setRegistrationRequired] = useState(false);
  const [registrationError, setRegistrationError] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState('default');

  const [callState, setCallState] = useState(CALL_STATE.IDLE);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activePeer, setActivePeer] = useState(null);

  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [contacts, setContacts] = useState([]);
  const [recentCalls, setRecentCalls] = useState([]);
  const [recentCallsLoaded, setRecentCallsLoaded] = useState(false);
  const [selectedRingtone, setSelectedRingtone] = useState('secure-voice-default');

  

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

      try {
        pc.close();
      } catch (_) {}

      pcRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    outboundIceRef.current = [];
    inboundIceRef.current = [];
    peerSocketIdRef.current = null;
    pendingOfferRef.current = null;
  }, []);

  const playRingtone = useCallback(async () => {
  if (typeof window === 'undefined') return;

  const selected = RINGTONES.find(
    (ringtone) => ringtone.id === selectedRingtone
  );

  if (!selected) return;

  try {
    let audio = ringtoneAudioRef.current;

    if (!audio || audio.src !== new URL(
      selected.src,
      window.location.href
    ).href) {
      audio?.pause?.();

      audio = new Audio(selected.src);
      audio.loop = true;
      audio.preload = 'auto';

      ringtoneAudioRef.current = audio;
    }

    audio.currentTime = 0;

    await audio.play();
  } catch (error) {
    console.warn(
      '[sound] Ringtone playback was blocked or failed:',
      error
    );
  }
}, [selectedRingtone]);

const stopRingtone = useCallback(() => {
  const audio = ringtoneAudioRef.current;

  if (!audio) return;

  try {
    audio.pause();
    audio.currentTime = 0;
  } catch (_) {}
}, []);

useEffect(() => {
  if (
    callState === CALL_STATE.RINGING ||
    callState === CALL_STATE.INCOMING
  ) {
    playRingtone();
    return;
  }

  stopRingtone();
}, [
  callState,
  playRingtone,
  stopRingtone,
]);

const selectRingtone = useCallback((ringtoneId) => {
  const exists = RINGTONES.some(
    (ringtone) => ringtone.id === ringtoneId
  );

  if (!exists) return;

  setSelectedRingtone(ringtoneId);

  try {
    localStorage.setItem(
      'secure-voice-selected-ringtone',
      ringtoneId
    );
  } catch (_) {}
}, []);

useEffect(() => {
  return () => {
    const audio = ringtoneAudioRef.current;

    if (!audio) return;

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
    } catch (_) {}
  };
}, []);

const finishCall = useCallback(
  (msg, kind = 'notice') => {
    const startedAt = callStartedAtRef.current;
    const recentCallId = activeRecentCallIdRef.current;

    if (startedAt && recentCallId) {
      const duration = Math.max(0, Date.now() - startedAt);

      setRecentCalls((prev) =>
        prev.map((call) =>
          call.id === recentCallId
            ? {
                ...call,
                duration,
              }
            : call
        )
      );
    }

    callStartedAtRef.current = null;
    activeRecentCallIdRef.current = null;

    teardownPeer();
    setActivePeer(null);
    setIncomingCall(null);
    setPhase(CALL_STATE.IDLE);

    if (msg) {
      if (kind === 'error') {
        setError(msg);
        setNotice(null);
      } else {
        setNotice(msg);
        setError(null);
      }
    }
  },
  [setPhase, teardownPeer]
);

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    localStreamRef.current = stream;
    return stream;
  }, []);

  const flushOutboundIce = useCallback(() => {
    const to = peerSocketIdRef.current;
    const socket = socketRef.current;

    if (!to || !socket || !outboundIceRef.current.length) return;

    outboundIceRef.current.forEach((c) => {
      socket.emit('ice-candidate', {
        to,
        candidate: c,
      });
    });

    outboundIceRef.current = [];
  }, []);

  const flushInboundIce = useCallback(async () => {
    const pc = pcRef.current;

    if (!pc || !pc.remoteDescription) return;

    const queue = inboundIceRef.current;
    inboundIceRef.current = [];

    for (const c of queue) {
      try {
        await pc.addIceCandidate(c);
      } catch (_) {}
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;

      const to = peerSocketIdRef.current;
      const socket = socketRef.current;

      if (to && socket) {
        socket.emit('ice-candidate', {
          to,
          candidate: e.candidate,
        });
      } else {
        outboundIceRef.current.push(e.candidate);
      }
    };

    pc.ontrack = (e) => {
      const [stream] = e.streams || [];

      if (stream && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;

        const p = remoteAudioRef.current.play?.();

        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        finishCall(
          'Connection failed. Peer offline ho gaya.',
          'error'
        );
      }
    };

    pcRef.current = pc;
    return pc;
  }, [finishCall]);

  /* -------- Contact helpers -------- */

  const saveContact = useCallback((name, number) => {
    if (!name || !number || !/^\d{10}$/.test(number)) return;

    setContacts((prev) => {
      const existing = prev.findIndex(
        (c) => c.number === number
      );

      if (existing >= 0) {
        const updated = [...prev];

        updated[existing] = {
          name: name.trim(),
          number,
        };

        return updated;
      }

      return [
        ...prev,
        {
          name: name.trim(),
          number,
        },
      ];
    });
  }, []);

  const removeContact = useCallback((number) => {
    setContacts((prev) =>
      prev.filter((c) => c.number !== number)
    );
  }, []);

  /* -------- Load contacts -------- */

  

  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        'secure-voice-contacts'
      );

      if (saved) {
        setContacts(JSON.parse(saved));
      }
    } catch (_) {}
  }, []);

  /* -------- Load recent calls -------- */

useEffect(() => {
  try {
    const saved = localStorage.getItem(
      'secure-voice-recent-calls'
    );

    if (saved) {
      setRecentCalls(JSON.parse(saved));
    }
  } catch (_) {
    // Ignore invalid localStorage data
  } finally {
    setRecentCallsLoaded(true);
  }
}, []);

useEffect(() => {
  try {
    const savedRingtone = localStorage.getItem(
      'secure-voice-selected-ringtone'
    );

    if (
      savedRingtone &&
      RINGTONES.some((ringtone) => ringtone.id === savedRingtone)
    ) {
      setSelectedRingtone(savedRingtone);
    }
  } catch (_) {}
}, []);

/* -------- Save recent calls -------- */

useEffect(() => {
  if (!recentCallsLoaded) return;

  try {
    localStorage.setItem(
      'secure-voice-recent-calls',
      JSON.stringify(recentCalls)
    );
  } catch (_) {}
}, [recentCalls, recentCallsLoaded]);

const updateRecentCallName = useCallback((id, newName) => {
  const cleanName = String(newName || '').trim();

  if (!id || !cleanName) return;

  setRecentCalls((prev) =>
    prev.map((call) =>
      call.id === id
        ? {
            ...call,
            name: cleanName,
          }
        : call
    )
  );
}, []);

const deleteRecentCall = useCallback((id) => {
  if (!id) return;

  setRecentCalls((prev) =>
    prev.filter((call) => call.id !== id)
  );
}, []);

const shareRecentCall = useCallback(async (call) => {
  if (!call || !call.number) return;

  const name =
    call.name && call.name !== 'Unknown'
      ? call.name
      : '';

  const shareText = name
    ? `${name}\n${call.number}`
    : call.number;

  try {
    if (navigator.share) {
      await navigator.share({
        title: 'Secure Voice Contact',
        text: shareText,
      });
      return;
    }

    await navigator.clipboard.writeText(shareText);
  } catch (_) {
    // User cancelled sharing or clipboard is unavailable.
  }
}, []);

  /* -------- Save contacts -------- */

  useEffect(() => {
    try {
      localStorage.setItem(
        'secure-voice-contacts',
        JSON.stringify(contacts)
      );
    } catch (_) {}
  }, [contacts]);

  /* =========================================================
     IDENTITY / REGISTRATION
     ========================================================= */

  const saveIdentityLocally = useCallback((name, number) => {
    const cleanName = String(name || '').trim();
    const cleanNumber = String(number || '').trim();

    myNameRef.current = cleanName;
    myNumberRef.current = cleanNumber;

    setMyName(cleanName);
    setMyNumber(cleanNumber);

    try {
      localStorage.setItem(
        'secure-voice-my-name',
        cleanName
      );

      localStorage.setItem(
        'secure-voice-my-number',
        cleanNumber
      );
    } catch (_) {}
  }, []);

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData],
    (char) => char.charCodeAt(0)
  );
};


const requestNotificationPermission = useCallback(async () => {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window)
  ) {
    setNotificationPermission('unsupported');
    return false;
  }

  const currentPermission = Notification.permission;
  setNotificationPermission(currentPermission);

  if (currentPermission === 'granted') {
    return true;
  }

  if (currentPermission === 'denied') {
    console.log('[push] Notification permission is denied.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();

    setNotificationPermission(permission);

    if (permission !== 'granted') {
      console.log('[push] Notification permission not granted.');
      return false;
    }

    console.log('[push] Notification permission granted.');
    return true;
  } catch (err) {
    console.error('[push] Permission request failed:', err);
    setNotificationPermission('denied');
    return false;
  }
}, []);

const checkNotificationPermission = useCallback(() => {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window)
  ) {
    setNotificationPermission('unsupported');
    return 'unsupported';
  }

  const permission = Notification.permission;
  setNotificationPermission(permission);

  return permission;
}, []);

const registerPushSubscription = useCallback(async (number) => {
  if (!number) return;

  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return;
  }

  if (Notification.permission !== 'granted') {
    console.log(
      '[push] Notification permission is not granted. Skipping subscription.'
    );
    return;
  }

  try {
    const registration =
      await navigator.serviceWorker.ready;

    const vapidPublicKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
      console.error('[push] VAPID public key missing.');
      return;
    }

    const subscription =
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey:
          urlBase64ToUint8Array(vapidPublicKey),
      });

    const response = await fetch(
      `${SIGNALING_URL}/push/subscribe`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number,
          subscription,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(
        result.error || 'Push subscription failed.'
      );
    }

    console.log(
      `[push] subscription registered for ${number}`
    );
  } catch (err) {
    console.error('[push] Registration failed:', err);
  }
}, []);

const registerIdentity = useCallback(
    (rawName, rawNumber) => {
      const name = String(rawName || '').trim();
      const number = String(rawNumber || '').trim();
      const socket = socketRef.current;

      setRegistrationError(null);
      setError(null);
      setNotice(null);

      if (!name) {
        setRegistrationError('Name is required.');
        return false;
      }

      if (!/^\d{10}$/.test(number)) {
        setRegistrationError(
          'Number 10 digit ka hona chahiye.'
        );
        return false;
      }

      if (!socket || !socket.connected) {
        setRegistrationError(
          'Server se connect nahi ho paya.'
        );
        return false;
      }

      socket.emit(
        'register',
        { number },
        (ack) => {
      if (ack && ack.ok) {
        saveIdentityLocally(name, ack.number);

        setRegistrationRequired(false);
        setRegistrationError(null);

        const permission = checkNotificationPermission();

        if (permission === 'granted') {
          registerPushSubscription(ack.number);
        }

        return; 
      }
          const message =
            (ack && ack.error) ||
            'Registration failed.';

          setRegistrationError(message);
        }
      );

      return true;
    },
    
    [registerPushSubscription,saveIdentityLocally, checkNotificationPermission]
  );

const logout = useCallback(async () => {
  const currentNumber = myNumberRef.current;
  const socket = socketRef.current;

  // Stop any active call/media.
  teardownPeer();

  activeRecentCallIdRef.current = null;
  callStartedAtRef.current = null;
  pendingOfferRef.current = null;

  setActivePeer(null);
  setIncomingCall(null);
  setPhase(CALL_STATE.IDLE);

  // Remove this device's push subscription mapping from the server.
  if (currentNumber) {
    try {
      await fetch(`${SIGNALING_URL}/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: currentNumber,
        }),
      });
    } catch (_) {}
  }

  // Remove saved identity.
  try {
    localStorage.removeItem('secure-voice-my-name');
    localStorage.removeItem('secure-voice-my-number');
  } catch (_) {}

  myNameRef.current = null;
  myNumberRef.current = null;

  setMyName(null);
  setMyNumber(null);
  setRegistrationError(null);
  setError(null);
  setNotice(null);
  setRegistrationRequired(true);

  // Reconnect with no saved identity.
  if (socket) {
    socket.disconnect();
    socket.connect();
  }
}, [setPhase, teardownPeer]);

const deleteAccount = useCallback(async () => {
  const socket = socketRef.current;
  const currentNumber = myNumberRef.current;

  if (!socket || !socket.connected || !currentNumber) {
    setError('No registered account found.');
    return false;
  }

  // Stop any active call/media first.
  teardownPeer();

  activeRecentCallIdRef.current = null;
  callStartedAtRef.current = null;
  pendingOfferRef.current = null;

  setActivePeer(null);
  setIncomingCall(null);
  setPhase(CALL_STATE.IDLE);

  try {
    const result = await new Promise((resolve) => {
      socket.emit('delete-account', (ack) => {
        resolve(ack);
      });
    });

    if (!result?.ok) {
      setError(
        result?.error || 'Could not delete account.'
      );
      return false;
    }

    // Remove saved identity from this device.
    try {
      localStorage.removeItem('secure-voice-my-name');
      localStorage.removeItem('secure-voice-my-number');
    } catch (_) {}

    myNameRef.current = null;
    myNumberRef.current = null;

    setMyName(null);
    setMyNumber(null);

    setRegistrationError(null);
    setError(null);
    setNotice(
      'Account deleted successfully. Please register again.'
    );
    setRegistrationRequired(true);

    // Reconnect without the deleted identity.
    socket.disconnect();
    socket.connect();

    return true;
  } catch (error) {
    console.error(
      '[db] account deletion request failed:',
      error
    );

    setError('Could not delete account.');
    return false;
  }
}, [setPhase, teardownPeer]);



  /* =========================================================
     SOCKET LIFECYCLE
     ========================================================= */

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
      let savedName = null;

      try {
        savedNumber = localStorage.getItem(
          'secure-voice-my-number'
        );

        savedName = localStorage.getItem(
          'secure-voice-my-name'
        );
      } catch (_) {}

      /*
       * Returning user:
       *
       * We already have an identity.
       * Register the SAME number again.
       *
       * We do NOT generate a new number if this fails.
       */

      if (savedNumber && /^\d{10}$/.test(savedNumber)) {
        socket.emit(
          'register',
          { number: savedNumber },
          (ack) => {
            if (ack && ack.ok) {
              myNumberRef.current = ack.number;
              setMyNumber(ack.number);

              myNameRef.current = savedName || '';
              setMyName(savedName || '');

              setRegistrationRequired(false);
              setRegistrationError(null);
              registerPushSubscription(ack.number);

              return;
            }

            /*
             * Important:
             * Never silently replace the user's number.
             */

            myNumberRef.current = null;
            setMyNumber(null);

            myNameRef.current = savedName || '';
            setMyName(savedName || '');

            setRegistrationRequired(true);

            setRegistrationError(
              (ack && ack.error) ||
              'Could not restore your registered number.'
            );
          }
        );

        return;
      }

      /*
       * First-time user:
       *
       * There is no saved identity.
       * Do NOT ask the server to generate one.
       */

      setRegistrationRequired(true);
      setRegistrationError(null);
    });

    socket.on('connect_error', () => {
      setSocketStatus(SOCKET_STATUS.DISCONNECTED);
    });

    socket.on('disconnect', () => {
      setSocketStatus(SOCKET_STATUS.DISCONNECTED);

      if (
        ['in-call', 'ringing', 'incoming'].includes(
          callStateRef.current
        )
      ) {
        finishCall(
          'Signaling server se disconnect ho gaya.',
          'error'
        );
      }
    });

    socket.on(
      'incoming-call',
      ({ callerName, callerNumber, offer, from }) => {
        if (callStateRef.current !== CALL_STATE.IDLE) {
          socket.emit('reject-call', { to: from });
          return;
        }

        pendingOfferRef.current = {
          callerName,
          callerNumber,
          offer,
          from,
        };

        setIncomingCall({
          callerName,
          callerNumber,
        });

        setActivePeer({
          name: callerName,
          number: callerNumber,
        });

        setError(null);
        setNotice(null);

        setPhase(CALL_STATE.INCOMING);
      }
    );

    socket.on(
  'call-answered',
  async ({ answer, from, receiverName }) => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
      peerSocketIdRef.current = from;

      await pc.setRemoteDescription(answer);

      flushOutboundIce();
      await flushInboundIce();

      const cleanReceiverName =
        String(receiverName || '').trim() || 'Unknown';

      setRecentCalls((prev) =>
        prev.map((call) =>
          call.id === activeRecentCallIdRef.current
            ? {
                ...call,
                name: cleanReceiverName,
              }
            : call
        )
      );

      callStartedAtRef.current = Date.now();
      setPhase(CALL_STATE.IN_CALL);
    } catch (_) {
      finishCall(
        'Call setup failed.',
        'error'
      );
    }
  }
);

    socket.on(
      'ice-candidate',
      async ({ candidate }) => {
        if (!candidate) return;

        const pc = pcRef.current;

        if (!pc || !pc.remoteDescription) {
          inboundIceRef.current.push(candidate);
          return;
        }

        try {
          await pc.addIceCandidate(candidate);
        } catch (_) {}
      }
    );

    socket.on(
      'call-rejected',
      () => finishCall('Call reject ho gayi.')
    );

    socket.on(
      'call-ended',
      () => finishCall('Doosre ne call kaat di.')
    );

    socket.on(
      'peer-disconnected',
      () => finishCall('Peer disconnect ho gaya.')
    );

    socket.on('call-failed', ({ reason } = {}) => {
      const map = {
        offline:
          'Ye number abhi online nahi hai. Dono phones pe app khula hona chahiye.',

        busy:
          'Ye number already busy hai.',

        invalid:
          'Number galat hai.',

        unregistered:
          'Registration pending hai, ek second baad try karo.',
      };

      finishCall(
        map[reason] ||
          'Call complete nahi ho payi.',
        'error'
      );
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    finishCall,
    flushInboundIce,
    flushOutboundIce,
    setPhase,
    registerPushSubscription,
  ]);

  /* =========================================================
     PUBLIC API: START CALL
     ========================================================= */

  const startCall = useCallback(
    async (rawTarget) => {
      const callerName =
        String(myNameRef.current || '').trim() ||
        'Unknown';

      const targetNumber =
        String(rawTarget || '').trim();

      const socket = socketRef.current;

      setError(null);
      setNotice(null);

      if (!myNumberRef.current) {
        return setError(
          'Registration pending, ek second baad try karo.'
        );
      }

      if (!socket || !socket.connected) {
        return setError(
          'Server se connect nahi ho paya.'
        );
      }

      if (!/^\d{10}$/.test(targetNumber)) {
        return setError(
          'Target number 10 digit ka hona chahiye.'
        );
      }

      if (targetNumber === myNumberRef.current) {
        return setError(
          'Khud ko call nahi kar sakte.'
        );
      }

      if (
        callStateRef.current !==
        CALL_STATE.IDLE
      ) {
        return setError(
          'Already ek call chal rahi hai.'
        );
      }

      try {
        const stream =
          await ensureLocalStream();

        const pc =
          createPeerConnection();

        stream
          .getTracks()
          .forEach((t) =>
            pc.addTrack(t, stream)
          );

        const offer =
          await pc.createOffer();

        await pc.setLocalDescription(
          offer
        );

        setActivePeer({
          name: callerName,
          number: targetNumber,
        });

        setPhase(
          CALL_STATE.RINGING
        );
        
        const recentCallId = `${Date.now()}-${targetNumber}`;
activeRecentCallIdRef.current = recentCallId;

setRecentCalls((prev) => {
  const existingCall = prev.find(
    (call) => call.number === targetNumber
  );

  return [
    {
      id: recentCallId,
      number: targetNumber,
      name: existingCall?.name || 'Unknown',
      direction: 'outgoing',
      timestamp: Date.now(),
    },
    ...prev,
  ];
});
        socket.emit('call-user', {
          callerName,
          targetNumber,
          offer:
            pc.localDescription ||
            offer,
        });

      } catch (err) {
        teardownPeer();
        setActivePeer(null);
        setPhase(CALL_STATE.IDLE);

        setError(
          describeMediaError(err)
        );
      }
    },
    [
      createPeerConnection,
      ensureLocalStream,
      setPhase,
      teardownPeer,
      setRecentCalls,
    ]
  );

  /* =========================================================
     ACCEPT CALL
     ========================================================= */

  const acceptCall = useCallback(
    async () => {
      const pending =
        pendingOfferRef.current;

      const socket =
        socketRef.current;

      if (!pending || !socket) return;

      setError(null);
      setNotice(null);

      try {
        const stream =
          await ensureLocalStream();

        peerSocketIdRef.current =
          pending.from;

        const pc =
          createPeerConnection();

        stream
          .getTracks()
          .forEach((t) =>
            pc.addTrack(t, stream)
          );

        await pc.setRemoteDescription(
          pending.offer
        );

        flushOutboundIce();
        await flushInboundIce();

        const answer =
          await pc.createAnswer();

        await pc.setLocalDescription(
          answer
        );

        socket.emit(
  'make-answer',
  {
    to: pending.from,
    answer:
      pc.localDescription ||
      answer,
    receiverName:
      String(myNameRef.current || '').trim() ||
      'Unknown',
  }
);

        pendingOfferRef.current = null;

        setIncomingCall(null);

        callStartedAtRef.current = Date.now();
        setPhase(CALL_STATE.IN_CALL);
      } catch (err) {
        if (
          socket &&
          pending.from
        ) {
          socket.emit(
            'reject-call',
            { to: pending.from }
          );
        }

        finishCall(
          describeMediaError(err),
          'error'
        );
      }
    },
    [
      createPeerConnection,
      ensureLocalStream,
      finishCall,
      flushInboundIce,
      flushOutboundIce,
      setPhase,
    ]
  );

  /* =========================================================
     REJECT CALL
     ========================================================= */

  const rejectCall = useCallback(() => {
    const pending =
      pendingOfferRef.current;

    const socket =
      socketRef.current;

    if (pending && socket) {
      socket.emit(
        'reject-call',
        { to: pending.from }
      );
    }

    finishCall();
  }, [finishCall]);

  /* =========================================================
     HANG UP
     ========================================================= */

  const hangUp = useCallback(() => {
    const peer =
      peerSocketIdRef.current;

    const socket =
      socketRef.current;

    if (peer && socket) {
      socket.emit(
        'end-call',
        { to: peer }
      );
    }

    finishCall('Call ended.');
  }, [finishCall]);

  /* =========================================================
     PUBLIC API
     ========================================================= */

  return {
    ringtones: RINGTONES,
selectedRingtone,
selectRingtone,
    socketStatus,

    myNumber,
    myName,

    registrationRequired,
    registrationError,
    registerIdentity,
    logout,
    deleteAccount,
    requestNotificationPermission,
    checkNotificationPermission,
    registerPushSubscription,

    callState,
    incomingCall,
    activePeer,

    error,
    notice,

    remoteAudioRef,

    contacts,
    saveContact,
    removeContact,
    recentCalls,
    updateRecentCallName,
    deleteRecentCall,
    shareRecentCall,

    startCall,
    acceptCall,
    rejectCall,
    hangUp,

    clearMessages,
  };
}