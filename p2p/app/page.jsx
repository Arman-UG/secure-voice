'use client';

import { useState } from 'react';
import useWebRTC, { CALL_STATE, SOCKET_STATUS } from '../hooks/useWebRTC';

const STATUS_LABEL = {
  [CALL_STATE.IDLE]: 'Ready',
  [CALL_STATE.RINGING]: 'Calling…',
  [CALL_STATE.INCOMING]: 'Incoming',
  [CALL_STATE.IN_CALL]: 'In Call',
};

const SOCKET_TONE = {
  [SOCKET_STATUS.CONNECTED]: 'bg-emerald-400',
  [SOCKET_STATUS.CONNECTING]: 'bg-amber-400 animate-pulse',
  [SOCKET_STATUS.DISCONNECTED]: 'bg-rose-500',
};

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-lg tracking-wider ' +
  'text-slate-100 placeholder-slate-600 outline-none transition ' +
  'focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-50';

export default function HomePage() {
  const {
    socketStatus, myNumber, callState, incomingCall, activePeer,
    error, notice, remoteAudioRef,
    startCall, acceptCall, rejectCall, hangUp, clearMessages,
    contacts, removeContact,  // ← ye 2 add kiye
  } = useWebRTC();

  const [callerName, setCallerName] = useState('');
  const [targetNumber, setTargetNumber] = useState('');

  const isIdle = callState === CALL_STATE.IDLE;
  const canDial = isIdle && socketStatus === SOCKET_STATUS.CONNECTED && myNumber;
  const digitsOnly = (v) => v.replace(/\D/g, '').slice(0, 10);

  const handleDial = async (e) => {
    e.preventDefault();
    await startCall(callerName, targetNumber);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100">
      {/* hidden audio sink */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Secure Voice</h1>
            <p className="text-xs text-slate-500">End-to-end encrypted P2P calling</p>
          </div>
          <span className={`h-3 w-3 rounded-full ${SOCKET_TONE[socketStatus]}`} />
        </header>

        {/* Your ID */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4">
          <p className="text-xs uppercase tracking-widest text-slate-500">Your ID</p>
          <p data-testid="my-number" className="mt-1 font-mono text-2xl text-sky-300">
            {myNumber || '••••••••••'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Is number ko doosre ko do — wahi tumhe call karega.
          </p>
        </div>

        {/* Error / Notice */}
        {error && (
          <div data-testid="error-banner" className="flex items-start justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span>{error}</span>
            <button onClick={clearMessages} className="text-rose-300">✕</button>
          </div>
        )}
        {notice && !error && (
          <div data-testid="notice-banner" className="flex items-start justify-between gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
            <span>{notice}</span>
            <button onClick={clearMessages} className="text-sky-300">✕</button>
          </div>
        )}

        {/* Dialer */}
        <form onSubmit={handleDial} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div>
            <label className="mb-1.5 block text-sm text-slate-400">Your Name</label>
            <input
              data-testid="caller-name-input"
              value={callerName}
              onChange={(e) => setCallerName(e.target.value)}
              placeholder="Rakesh"
              disabled={!canDial}
              className={INPUT_CLASS}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-slate-400">Call Number</label>
            <input
              data-testid="target-number-input"
              value={targetNumber}
              onChange={(e) => setTargetNumber(digitsOnly(e.target.value))}
              placeholder="7082167660"
              inputMode="numeric"
              maxLength={10}
              disabled={!canDial}
              className={INPUT_CLASS}
              autoComplete="off"
            />
          </div>

          <div className="flex gap-3">
            <button
              data-testid="call-btn"
              type="submit"
              disabled={!canDial || targetNumber.length !== 10}
              className="flex-1 rounded-xl bg-sky-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {callState === CALL_STATE.RINGING ? 'Calling…' : 'Call'}
            </button>

            {callState === CALL_STATE.RINGING && (
              <button type="button" onClick={hangUp} className="rounded-xl border border-slate-700 px-6 py-3 font-semibold hover:bg-slate-800">
                Cancel
              </button>
            )}

            {callState === CALL_STATE.IN_CALL && (
              <button data-testid="end-call-btn" type="button" onClick={hangUp} className="rounded-xl bg-rose-500 px-6 py-3 font-semibold text-white hover:bg-rose-400">
                End
              </button>
            )}
          </div>
        </form>

        {/* Saved Contacts */}
        {canDial && contacts.length > 0 && (
          <div data-testid="contacts-panel" className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="mb-3 text-xs uppercase tracking-widest text-slate-500">
              📇 Saved Contacts ({contacts.length})
            </p>
            <ul className="space-y-2">
              {contacts.map((contact) => (
                <li
                  key={contact.number}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-200">
                      {contact.name}
                    </p>
                    <p className="font-mono text-xs text-slate-500">
                      {contact.number}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCallerName(contact.name);
                        setTargetNumber(contact.number);
                      }}
                      className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
                      title="Fill in form"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      data-testid={`call-contact-${contact.number}`}
                      onClick={() => startCall(contact.name, contact.number)}
                      className="rounded-lg bg-sky-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-sky-400"
                    >
                      Call
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove ${contact.name}?`)) removeContact(contact.number);
                      }}
                      className="rounded-lg border border-rose-500/30 px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Status */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-3 text-center">
          <p data-testid="call-status" className="text-sm text-slate-400">
            Status: <span className="font-semibold text-slate-200">{STATUS_LABEL[callState]}</span>
            {callState === CALL_STATE.IN_CALL && activePeer && (
              <> with <span className="text-emerald-400">{activePeer.name}</span></>
            )}
          </p>
        </div>

        <p className="text-center text-xs text-slate-600">
          Dono phones pe app khuli honi chahiye. WhatsApp jaisa.
        </p>
      </div>

      {/* Incoming call overlay */}
      {incomingCall && (
        <div data-testid="incoming-call-panel" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-sky-500/20 text-4xl">📞</div>
            <h2 className="mt-6 text-2xl font-semibold">{incomingCall.callerName} is calling…</h2>
            <p className="mt-1 font-mono text-sm text-slate-400">{incomingCall.callerNumber}</p>

            <div className="mt-8 flex gap-3">
              <button data-testid="reject-call-btn" onClick={rejectCall} className="flex-1 rounded-xl bg-rose-500 py-3 font-semibold text-white hover:bg-rose-400">Reject</button>
              <button data-testid="accept-call-btn" onClick={acceptCall} className="flex-1 rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950 hover:bg-emerald-400">Accept</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}