'use client';

import { useState, useEffect, useRef } from 'react';
import useWebRTC, {
  CALL_STATE,
  SOCKET_STATUS,
} from '../hooks/useWebRTC';

/* =========================================================
   Visual constants & Kinetic CSS classes
   ========================================================= */

const STATUS_LABEL = {
  [CALL_STATE.IDLE]: 'Ready',
  [CALL_STATE.RINGING]: 'Calling…',
  [CALL_STATE.INCOMING]: 'Incoming',
  [CALL_STATE.IN_CALL]: 'In Call',
};

const SOCKET_TONE = {
  [SOCKET_STATUS.CONNECTED]: 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]',
  [SOCKET_STATUS.CONNECTING]: 'bg-amber-400 animate-pulse shadow-[0_0_12px_rgba(251,191,36,0.8)]',
  [SOCKET_STATUS.DISCONNECTED]: 'bg-[#EF1D1D] shadow-[0_0_12px_rgba(239,29,29,0.8)]',
};

const INPUT_CLASS =
  'w-full rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] px-4 py-3.5 text-lg tracking-wider ' +
  'text-[var(--sv-text)] placeholder-[var(--sv-subtle)] outline-none transition-all duration-300 ' +
  ' hover:border-[var(--sv-muted)]/50 focus:border-[#EF1D1D] focus:bg-[var(--sv-surface)] focus:ring-4 focus:ring-[#EF1D1D]/15 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const PRIMARY_BUTTON_CLASS =
  'sv-shimmer-btn w-full rounded-2xl border border-[var(--sv-emerald-border)] bg-[var(--sv-emerald-bg)] px-6 py-3.5 font-semibold text-[var(--sv-emerald-text)] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-6px_rgba(16,185,129,0.28)] active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45';

const DANGER_BUTTON_CLASS =
  'sv-shimmer-btn rounded-2xl bg-gradient-to-r from-[#EF1D1D] to-[#D61A1A] font-semibold text-white shadow-[0_10px_28px_-6px_rgba(239,29,29,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-6px_rgba(239,29,29,0.65)] active:translate-y-0 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-45';

const SECTION_LABEL_CLASS =
  'text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--sv-muted)]';

/* =========================================================
   Custom Keyframe Animations (Injected inline)
   ========================================================= */

function MotionStyles() {
  return (
    <style>{`
      @keyframes svFadeUp {
        0% { opacity: 0; transform: translateY(14px) scale(0.985); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes svPopIn {
        0% { opacity: 0; transform: scale(0.9); }
        70% { transform: scale(1.02); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes svRipple {
        0% { transform: scale(0.85); opacity: 0.75; }
        100% { transform: scale(2.35); opacity: 0; }
      }
      @keyframes svFloatGlow {
        0%, 100% { transform: translate(0px, 0px) scale(1); }
        50% { transform: translate(12px, -18px) scale(1.08); }
      }
      .sv-fade-up {
        animation: svFadeUp 0.42s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      .sv-pop-in {
        animation: svPopIn 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
      .sv-ripple-1 {
        animation: svRipple 2.6s cubic-bezier(0.16, 1, 0.3, 1) infinite;
      }
      .sv-ripple-2 {
        animation: svRipple 2.6s cubic-bezier(0.16, 1, 0.3, 1) 0.85s infinite;
      }
      .sv-ripple-3 {
        animation: svRipple 2.6s cubic-bezier(0.16, 1, 0.3, 1) 1.7s infinite;
      }
      .sv-ambient-blob {
        animation: svFloatGlow 9s ease-in-out infinite;
      }
      .sv-shimmer-btn {
        position: relative;
        overflow: hidden;
      }
      .sv-shimmer-btn::after {
        content: '';
        position: absolute;
        top: 0;
        left: -120%;
        width: 65%;
        height: 100%;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255, 255, 255, 0.16),
          transparent
        );
        transform: skewX(-24deg);
        transition: left 0.65s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: none;
      }
      .sv-shimmer-btn:hover::after {
        left: 150%;
      }
      .sv-rollout {
        display: grid;
        transition:
          grid-template-rows 0.42s cubic-bezier(0.16, 1, 0.3, 1),
          opacity 0.32s ease,
          margin-top 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      }
    `}</style>
  );
}

/* =========================================================
   Decorative inline icons (dependency-free, visual only)
   ========================================================= */

function IconShield({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11.5 14.5 15 10" />
    </svg>
  );
}

function IconPhone({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconPhoneOff({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67" />
      <path d="M5.1 9.18A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.4 5" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function IconPencil({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function IconShare({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function IconUserRound({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
    </svg>
  );
}

function IconCopy({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconTrash({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function IconArrowUpRight({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

function IconArrowDownLeft({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="17" y1="7" x2="7" y2="17" />
      <polyline points="17 17 7 17 7 7" />
    </svg>
  );
}

function IconChevronDown({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconX({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconSun({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
    </svg>
  );
}

function IconMoon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8z" />
    </svg>
  );
}

function IconMic({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function IconMicOff({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M18.89 13.23A7 7 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M9 5a3 3 0 0 1 6 0v7" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function IconKeypad({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className} aria-hidden="true">
      <circle cx="6" cy="6" r="1.8" />
      <circle cx="12" cy="6" r="1.8" />
      <circle cx="18" cy="6" r="1.8" />
      <circle cx="6" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="18" cy="12" r="1.8" />
      <circle cx="6" cy="18" r="1.8" />
      <circle cx="12" cy="18" r="1.8" />
      <circle cx="18" cy="18" r="1.8" />
    </svg>
  );
}

function IconSpeaker({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function formatElapsedSeconds(totalSeconds = 0) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
}

function getCallDirectionMeta(call) {
  const raw = String(call?.direction || call?.type || 'outgoing').toLowerCase();
  if (raw === 'incoming') {
    return { label: 'Incoming', isIncoming: true, isMissed: false };
  }
  if (raw === 'missed') {
    return { label: 'Missed', isIncoming: true, isMissed: true };
  }
  return { label: 'Outgoing', isIncoming: false, isMissed: false };
}

function ThemeToggle({ isLightTheme, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface)] text-[var(--sv-secondary)] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#EF1D1D]/40 hover:text-[var(--sv-text)] active:scale-90"
      aria-label={isLightTheme ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLightTheme ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {isLightTheme ? (
        <IconMoon className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110" />
      ) : (
        <IconSun className="h-4 w-4 transition-transform duration-500 group-hover:rotate-45 group-hover:scale-110" />
      )}
    </button>
  );
}

/* =========================================================
   Active call controls & screens
   ========================================================= */

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

function CallControlButton({
  label,
  onClick,
  active = false,
  activeTone = 'normal',
  disabled = false,
  ariaLabel,
  ariaExpanded,
  isLightTheme,
  children,
}) {
  const activeClasses =
    activeTone === 'danger'
      ? isLightTheme
        ? 'border-red-500/40 bg-red-500/15 text-red-700 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
        : 'border-red-500/50 bg-red-500/20 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.25)]'
      : 'border-[var(--sv-emerald-border)] bg-[var(--sv-emerald-bg)] text-[var(--sv-emerald-text)] shadow-[0_0_20px_rgba(16,185,129,0.2)]';

  return (
    <div className="flex w-16 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={active}
        aria-label={ariaLabel}
        aria-expanded={ariaExpanded}
        title={ariaLabel}
        className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 active:scale-90 disabled:cursor-not-allowed disabled:opacity-45 ${
          active
            ? activeClasses
            : 'border-[var(--sv-border)] bg-[var(--sv-surface)] text-[var(--sv-secondary)] hover:border-[var(--sv-muted)] hover:text-[var(--sv-text)]'
        }`}
      >
        {children}
      </button>

      <span className="max-w-full truncate text-[11px] font-semibold tracking-wide text-[var(--sv-muted)]">
        {label}
      </span>
    </div>
  );
}

function CallKeypad({ onKey, onClose, dtmfSupported, isLightTheme }) {
  const warningClass = isLightTheme
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-800'
    : 'border-amber-400/25 bg-amber-400/10 text-amber-300';

  return (
    <div className="sv-pop-in w-full max-w-[310px] rounded-3xl border border-[var(--sv-border)] bg-[var(--sv-surface)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <p className="text-sm font-bold tracking-wide text-[var(--sv-text)]">DTMF Keypad</p>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close keypad"
          title="Close keypad"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--sv-border)] text-[var(--sv-muted)] transition-all duration-200 hover:rotate-90 hover:border-[#EF1D1D]/40 hover:text-[var(--sv-text)] active:scale-90"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>

      {!dtmfSupported && (
        <div className={`mb-3 rounded-xl border px-3 py-2 text-xs font-medium ${warningClass}`}>
          DTMF tones are not supported in this browser.
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        {KEYPAD_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={!dtmfSupported}
            onClick={() => onKey(key)}
            aria-label={`Send tone ${key}`}
            className="flex h-12 items-center justify-center rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] text-xl font-bold text-[var(--sv-text)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#EF1D1D]/50 hover:bg-[var(--sv-surface)] active:scale-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {key}
          </button>
        ))}
      </div>

      <p className="mt-3 text-center text-[11px] text-[var(--sv-subtle)]">
        Tones are transmitted live over WebRTC.
      </p>
    </div>
  );
}

function ActiveCallScreen({
  peer,
  onHangUp,
  isLightTheme,
  isMuted,
  onToggleMute,
  remoteAudioRef,
  sendDtmf,
  canSendDtmf,
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [dtmfSupported, setDtmfSupported] = useState(true);
  const [speakerSupported, setSpeakerSupported] = useState(false);
  const [selectedSinkId, setSelectedSinkId] = useState('');
  const [speakerBusy, setSpeakerBusy] = useState(false);
  const [speakerError, setSpeakerError] = useState('');

  const startedAtRef = useRef(Date.now());
  const endingRef = useRef(false);
  const endingTimeoutRef = useRef(null);

  useEffect(() => {
    const updateElapsed = () => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000))
      );
    };

    updateElapsed();
    const intervalId = setInterval(updateElapsed, 1000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    return () => {
      if (endingTimeoutRef.current) {
        clearTimeout(endingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const el = remoteAudioRef?.current;
    const hasSetSinkId = typeof el?.setSinkId === 'function';
    const hasSelectAudioOutput =
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.selectAudioOutput === 'function';

    setSpeakerSupported(hasSetSinkId && hasSelectAudioOutput);
    setSelectedSinkId(el?.sinkId || '');
  }, [remoteAudioRef]);

  const handleHangUp = () => {
    if (endingRef.current || isEndingCall) return;

    endingRef.current = true;
    setIsEndingCall(true);

    try {
      onHangUp();
    } finally {
      endingTimeoutRef.current = setTimeout(() => {
        endingRef.current = false;
        setIsEndingCall(false);
      }, 2500);
    }
  };

  const handleToggleKeypad = () => {
    const next = !isKeypadOpen;
    setIsKeypadOpen(next);
    if (next) {
      setDtmfSupported(Boolean(canSendDtmf?.()));
    }
  };

  const handleKeypadKey = (key) => {
    if (!dtmfSupported) return;
    const ok = Boolean(sendDtmf?.(key));
    if (!ok) {
      setDtmfSupported(Boolean(canSendDtmf?.()));
    }
  };

  const handleSpeakerClick = async () => {
    const el = remoteAudioRef?.current;
    if (
      !el ||
      typeof el.setSinkId !== 'function' ||
      typeof navigator === 'undefined' ||
      typeof navigator.mediaDevices?.selectAudioOutput !== 'function'
    ) {
      setSpeakerError('Audio output selection is not supported in this browser.');
      return;
    }

    setSpeakerBusy(true);
    setSpeakerError('');

    try {
      const output = await navigator.mediaDevices.selectAudioOutput();
      if (output?.deviceId) {
        await el.setSinkId(output.deviceId);
        setSelectedSinkId(output.deviceId);
      }
    } catch (err) {
      const errName = err?.name;
      if (
        errName !== 'NotAllowedError' &&
        errName !== 'AbortError' &&
        errName !== 'NotFoundError'
      ) {
        setSpeakerError('Could not change audio output.');
      }
    } finally {
      setSpeakerBusy(false);
    }
  };

  const peerName = String(peer?.name || '').trim();
  const peerNumber = String(peer?.number || '').trim();

  const displayName = peerName || 'Unknown';
  const displayNumber = peerNumber || 'No number available';

  const initialSource =
    peerName && peerName.toLowerCase() !== 'unknown'
      ? peerName
      : peerNumber;

  const initial = initialSource
    ? initialSource.charAt(0).toUpperCase()
    : '•';

  const warningTextClass = isLightTheme ? 'text-amber-700' : 'text-amber-300';
  const speakerActive = Boolean(selectedSinkId && selectedSinkId !== 'default');

  return (
    <section
      data-testid="active-call-panel"
      aria-label="Active call"
      className="sv-fade-up relative z-10 flex min-h-[calc(100vh-2rem)] w-full max-w-md flex-col items-center justify-between gap-6 py-4 sm:min-h-[calc(100vh-3rem)] sm:py-6"
    >
      <header className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface)]/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)]">
            <IconShield className="h-5 w-5 text-[#EF1D1D]" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-[var(--sv-text)]">
              Secure Voice
            </p>
            <p className="text-xs text-[var(--sv-muted)]">
              Encrypted P2P Audio
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--sv-emerald-border)] bg-[var(--sv-emerald-bg)] px-3.5 py-1 text-xs font-semibold text-[var(--sv-emerald-text)]">
          <span
            aria-hidden="true"
            className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]"
          />
          Connected
        </span>
      </header>

      <div className="flex w-full flex-1 flex-col items-center justify-center text-center">
        {isKeypadOpen ? (
          <div className="flex w-full flex-col items-center gap-4">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-[var(--sv-text)]">
                {displayName}
              </p>
              <p
                className="mt-0.5 text-xs font-semibold text-[var(--sv-emerald-text)]"
                role="status"
              >
                Connected
              </p>
              <p
                role="timer"
                aria-label="Call duration"
                className="mt-1 font-mono text-sm font-semibold tracking-[0.18em] text-[var(--sv-secondary)]"
              >
                {formatElapsedSeconds(elapsedSeconds)}
              </p>
            </div>

            <CallKeypad
              onKey={handleKeypadKey}
              onClose={() => setIsKeypadOpen(false)}
              dtmfSupported={dtmfSupported}
              isLightTheme={isLightTheme}
            />
          </div>
        ) : (
          <>
            <div className="relative flex items-center justify-center">
              <span
                aria-hidden="true"
                className="sv-ripple-1 absolute h-28 w-28 rounded-full border border-emerald-500/35"
              />
              <span
                aria-hidden="true"
                className="sv-ripple-2 absolute h-28 w-28 rounded-full border border-emerald-500/20"
              />
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-[var(--sv-emerald-border)] bg-[var(--sv-surface)] text-4xl font-bold text-[var(--sv-text)] shadow-[0_20px_50px_rgba(0,0,0,0.28)]">
                {initial}
              </div>
            </div>

            <h2 className="mt-8 max-w-full break-words text-3xl font-bold tracking-tight text-[var(--sv-text)]">
              {displayName}
            </h2>

            <p className="mt-2 max-w-full break-all font-mono text-sm tracking-[0.16em] text-[var(--sv-muted)]">
              {displayNumber}
            </p>

            <p
              className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--sv-emerald-text)]"
              role="status"
            >
              Connected
            </p>

            <p
              role="timer"
              aria-label="Call duration"
              className="mt-2 rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface)] px-5 py-2 font-mono text-2xl font-semibold tracking-[0.2em] text-[var(--sv-text)] shadow-sm"
            >
              {formatElapsedSeconds(elapsedSeconds)}
            </p>
          </>
        )}
      </div>

      <div className="w-full space-y-5 rounded-3xl border border-[var(--sv-border)] bg-[var(--sv-surface)]/90 p-5 shadow-lg backdrop-blur-md">
        {speakerError && (
          <p className={`text-center text-xs font-medium ${warningTextClass}`}>
            {speakerError}
          </p>
        )}

        <div className="flex items-start justify-center gap-6">
          <CallControlButton
            label={isMuted ? 'Unmute' : 'Mute'}
            active={isMuted}
            activeTone="danger"
            disabled={false}
            onClick={() => onToggleMute?.()}
            ariaLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            isLightTheme={isLightTheme}
          >
            {isMuted ? (
              <IconMicOff className="h-5 w-5" />
            ) : (
              <IconMic className="h-5 w-5" />
            )}
          </CallControlButton>

          <CallControlButton
            label="Keypad"
            active={isKeypadOpen}
            disabled={false}
            onClick={handleToggleKeypad}
            ariaLabel={isKeypadOpen ? 'Close keypad' : 'Open keypad'}
            ariaExpanded={isKeypadOpen}
            isLightTheme={isLightTheme}
          >
            <IconKeypad className="h-5 w-5" />
          </CallControlButton>

          {speakerSupported && (
            <CallControlButton
              label="Speaker"
              active={speakerActive}
              disabled={speakerBusy}
              onClick={handleSpeakerClick}
              ariaLabel="Select audio output"
              isLightTheme={isLightTheme}
            >
              <IconSpeaker className="h-5 w-5" />
            </CallControlButton>
          )}
        </div>

        <div className="flex justify-center pt-1">
          <button
            type="button"
            data-testid="end-call-btn"
            onClick={handleHangUp}
            disabled={isEndingCall}
            aria-label={
              isEndingCall ? 'Ending call' : `End call with ${displayName}`
            }
            title="End call"
            className={`group flex w-full items-center justify-center gap-3 py-4 text-lg ${DANGER_BUTTON_CLASS}`}
          >
            <IconPhoneOff className="h-6 w-6 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
            {isEndingCall ? 'Ending…' : 'End Call'}
          </button>
        </div>
      </div>

      <p data-testid="call-status" className="sr-only">
        Status: In Call with {displayName}
      </p>
    </section>
  );
}

/* =========================================================
   Main Page Component
   ========================================================= */

export default function HomePage() {
  const {
    socketStatus,
    myNumber,
    myName,
    registrationRequired,
    registrationError,
    registerIdentity,
    requestNotificationPermission,
    logout,
    deleteAccount,
    callState,
    incomingCall,
    activePeer,
    error,
    notice,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    updateRecentCallName,
    deleteRecentCall,
    shareRecentCall,
    hangUp,
    clearMessages,
    contacts,
    removeContact,
    recentCalls,
    ringtones,
    selectedRingtone,
    selectRingtone,
    toggleMute,
    canSendDtmf,
    sendDtmf,
    isMuted,
  } = useWebRTC();

  const [isLightTheme, setIsLightTheme] = useState(false);
  const [activeMainSection, setActiveMainSection] = useState('hub');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [copiedMyNumber, setCopiedMyNumber] = useState(false);
  const [pendingNotificationAction, setPendingNotificationAction] =
  useState(null);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('secure-voice-theme');
      setIsLightTheme(savedTheme === 'light');
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'secure-voice-theme',
        isLightTheme ? 'light' : 'dark'
      );
    } catch (_) {}
  }, [isLightTheme]);

  
useEffect(() => {
  if (typeof window === 'undefined') return;

  
const handleNotificationMessage = (event) => {
  if (
    event.data?.type !== 'SECURE_VOICE_CALL_ACTION' ||
    !['accept', 'reject'].includes(event.data.action)
  ) {
    return;
  }

  // Confirm that React received the command.
  event.ports?.[0]?.postMessage({
    type: 'SECURE_VOICE_CALL_ACTION_ACK',
    messageId: event.data.messageId,
  });

  console.log('[ACK] Notification command received:', event.data.action);

  setPendingNotificationAction({
    action: event.data.action,
    callerNumber: event.data.callerNumber || '',
  });
};


  navigator.serviceWorker?.addEventListener(
    'message',
    handleNotificationMessage
  );

  // Handle an action when the notification opened a new app window.
  const params = new URLSearchParams(window.location.search);
const action = params.get('callAction');
const callerNumber = params.get('callerNumber') || '';

if (action === 'accept' || action === 'reject') {
  setPendingNotificationAction({
    action,
    callerNumber,
  });

  params.delete('callAction');
  params.delete('callerNumber');

  const query = params.toString();
  const cleanUrl =
    window.location.pathname +
    (query ? `?${query}` : '') +
    window.location.hash;

  window.history.replaceState({}, '', cleanUrl);
}

  return () => {
    navigator.serviceWorker?.removeEventListener(
      'message',
      handleNotificationMessage
    );
  };
}, []);

useEffect(() => {
  if (!incomingCall || !pendingNotificationAction) return;

  const { action, callerNumber } = pendingNotificationAction;

  // Do not apply an action to a different caller.
  if (
    callerNumber &&
    incomingCall.callerNumber !== callerNumber
  ) {
    return;
  }

  setPendingNotificationAction(null);

  if (action === 'accept') {
    acceptCall();
  } else if (action === 'reject') {
    rejectCall();
  }
}, [
  incomingCall,
  pendingNotificationAction,
  acceptCall,
  rejectCall,
]);


  const themeVars = isLightTheme
    ? {
        '--sv-bg': '#F3F6FA',
        '--sv-surface': '#FFFFFF',
        '--sv-surface-2': '#F8FAFC',
        '--sv-text': '#0F172A',
        '--sv-secondary': '#334155',
        '--sv-muted': '#64748B',
        '--sv-subtle': '#94A3B8',
        '--sv-border': '#E2E8F0',
        '--sv-emerald-bg': 'rgba(16, 185, 129, 0.12)',
        '--sv-emerald-border': 'rgba(16, 185, 129, 0.35)',
        '--sv-emerald-text': '#047857',
        '--sv-danger-bg': 'rgba(239, 29, 29, 0.08)',
        '--sv-danger-border': 'rgba(239, 29, 29, 0.28)',
        '--sv-danger-text': '#B91C1C',
      }
    : {
        '--sv-bg': '#090B10',
        '--sv-surface': '#121620',
        '--sv-surface-2': '#0B0E15',
        '--sv-text': '#F8FAFC',
        '--sv-secondary': '#CBD5E1',
        '--sv-muted': '#94A3B8',
        '--sv-subtle': '#64748B',
        '--sv-border': '#1E2534',
        '--sv-emerald-bg': 'rgba(16, 185, 129, 0.12)',
        '--sv-emerald-border': 'rgba(52, 211, 153, 0.32)',
        '--sv-emerald-text': '#6EE7B7',
        '--sv-danger-bg': 'rgba(239, 29, 29, 0.12)',
        '--sv-danger-border': 'rgba(239, 29, 29, 0.32)',
        '--sv-danger-text': '#FCA5A5',
      };

  const handleThemeToggle = () => {
    setIsLightTheme((prev) => !prev);
  };

  const handleCopyMyNumber = async () => {
    if (!myNumber) return;
    try {
      await navigator.clipboard.writeText(myNumber);
      setCopiedMyNumber(true);
      setTimeout(() => setCopiedMyNumber(false), 2000);
    } catch (_) {}
  };

  /* =========================================================
     Registration form
     ========================================================= */

  const [registrationName, setRegistrationName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');

  /* =========================================================
     Dialer & Service Worker Update
     ========================================================= */

  const [targetNumber, setTargetNumber] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    let isMounted = true;
    let registration = null;
    let installingWorker = null;

    const handleStateChange = () => {
      if (
        isMounted &&
        installingWorker?.state === 'installed' &&
        navigator.serviceWorker.controller
      ) {
        setUpdateAvailable(true);
      }
    };

    const handleUpdateFound = () => {
      installingWorker = registration?.installing;
      if (!installingWorker) return;
      installingWorker.addEventListener('statechange', handleStateChange);
    };

    const detectUpdate = async () => {
      try {
        registration = await navigator.serviceWorker.ready;
        if (!isMounted) return;

        const checkWaitingWorker = () => {
          if (
            isMounted &&
            registration?.waiting &&
            navigator.serviceWorker.controller
          ) {
            setUpdateAvailable(true);
          }
        };

        checkWaitingWorker();
        registration.addEventListener('updatefound', handleUpdateFound);
        await registration.update();
        checkWaitingWorker();
      } catch (err) {
        console.error('[update] Detection failed:', err);
      }
    };

    detectUpdate();

    return () => {
      isMounted = false;
      if (registration) {
        registration.removeEventListener('updatefound', handleUpdateFound);
      }
      if (installingWorker) {
        installingWorker.removeEventListener('statechange', handleStateChange);
      }
    };
  }, []);

  const [editingCallId, setEditingCallId] = useState(null);
  const [editingCallName, setEditingCallName] = useState('');
  const [expandedCallId, setExpandedCallId] = useState(null);
  const [showDialer, setShowDialer] = useState(false);
  const [showDialPad, setShowDialPad] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const detectMobileDevice = () => {
      const ua =
        navigator.userAgent ||
        navigator.vendor ||
        window.opera ||
        '';
      const isMobileUA =
        /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(ua);
      const isIPadOS =
        navigator.maxTouchPoints > 1 &&
        /Macintosh/i.test(ua);
      setIsMobileDevice(isMobileUA || isIPadOS);
    };
    detectMobileDevice();
  }, []);

  useEffect(() => {
    if (callState === CALL_STATE.IDLE || callState === CALL_STATE.IN_CALL) {
      setShowDialer(false);
      setShowDialPad(false);
    }
  }, [callState]);

  const isIdle = callState === CALL_STATE.IDLE;
  const canDial =
    isIdle &&
    socketStatus === SOCKET_STATUS.CONNECTED &&
    !!myNumber;
  const canRegister =
    socketStatus === SOCKET_STATUS.CONNECTED &&
    registrationName.trim().length > 0 &&
    registrationNumber.length === 10;
  const digitsOnly = (value) =>
    value.replace(/\D/g, '').slice(0, 10);

  const handleRegistration = async (e) => {
    e.preventDefault();
    if (!canRegister) return;
    await requestNotificationPermission();
    registerIdentity(registrationName, registrationNumber);
  };

  const handleDial = async (e) => {
    e.preventDefault();
    await startCall(targetNumber);
  };8


  /* =========================================================
     REGISTRATION SCREEN
     ========================================================= */

  if (registrationRequired) {
    return (
      <main
        style={themeVars}
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--sv-bg)] p-4 text-[var(--sv-text)] antialiased transition-colors duration-500 sm:p-6"
      >
        <MotionStyles />
        <div
          aria-hidden="true"
          className="sv-ambient-blob pointer-events-none absolute -top-28 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#EF1D1D]/10 blur-3xl"
        />

        <div className="sv-fade-up relative w-full max-w-md space-y-5">
          <header className="flex items-center justify-between rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface)]/80 px-4 py-3 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] shadow-inner">
                <IconShield className="h-5 w-5 text-[#EF1D1D]" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight">
                  Secure Voice V3
                </h1>
                <p className="text-xs text-[var(--sv-muted)]">
                  End-to-end encrypted P2P calling
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle
                isLightTheme={isLightTheme}
                onToggle={handleThemeToggle}
              />
              <span
                className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${SOCKET_TONE[socketStatus]}`}
              />
            </div>
          </header>

          <form
            onSubmit={handleRegistration}
            className="space-y-5 rounded-3xl border border-[var(--sv-border)] bg-[var(--sv-surface)] p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)]"
          >
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[var(--sv-text)]">
                Claim your identity
              </h2>
              <p className="mt-1 text-sm text-[var(--sv-muted)]">
                Choose your display name and 10-digit Secure Voice number.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--sv-muted)]">
                Your Name
              </label>
              <input
                data-testid="registration-name-input"
                value={registrationName}
                onChange={(e) => setRegistrationName(e.target.value)}
                placeholder="Arman"
                className={INPUT_CLASS}
                autoComplete="name"
                disabled={socketStatus !== SOCKET_STATUS.CONNECTED}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--sv-muted)]">
                Your Number
              </label>
              <input
                data-testid="registration-number-input"
                value={registrationNumber}
                onChange={(e) =>
                  setRegistrationNumber(digitsOnly(e.target.value))
                }
                placeholder="9466447743"
                inputMode="numeric"
                maxLength={10}
                className={`${INPUT_CLASS} font-mono`}
                autoComplete="tel"
                disabled={socketStatus !== SOCKET_STATUS.CONNECTED}
              />
              <p className="mt-1.5 text-xs text-[var(--sv-subtle)]">
                Enter 10 digits without country code (+91).
              </p>
            </div>

            {registrationError && (
              <div
                data-testid="registration-error"
                className="sv-pop-in rounded-2xl border border-[var(--sv-danger-border)] bg-[var(--sv-danger-bg)] px-4 py-3 text-sm font-medium text-[var(--sv-danger-text)]"
              >
                {registrationError}
              </div>
            )}

            {socketStatus !== SOCKET_STATUS.CONNECTED && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-500">
                <span className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
                Connecting to Secure Voice signaling server…
              </div>
            )}

            <button
              data-testid="register-btn"
              type="submit"
              disabled={!canRegister}
              className={PRIMARY_BUTTON_CLASS}
            >
              Initialize Secure Line
            </button>

            <p className="text-center text-xs text-[var(--sv-subtle)]">
              Cryptographically bound to this browser session.
            </p>
          </form>
        </div>
      </main>
    );
  }

  /* =========================================================
     MAIN APPLICATION
     ========================================================= */

  const matchedOutgoingContact = contacts.find(
    (c) => c.number === (activePeer?.number || targetNumber)
  );
  const ringingName =
    activePeer?.name || matchedOutgoingContact?.name || 'Calling Peer';
  const ringingNumber = activePeer?.number || targetNumber || '';

  return (
    <main
      style={themeVars}
      className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-[var(--sv-bg)] p-4 text-[var(--sv-text)] antialiased transition-colors duration-500 sm:p-6"
    >
      <MotionStyles />
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Ambient floating background glow */}
      <div
        aria-hidden="true"
        className="sv-ambient-blob pointer-events-none fixed -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#EF1D1D]/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="sv-ambient-blob pointer-events-none fixed -bottom-36 right-1/4 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl"
      />

      {callState === CALL_STATE.IN_CALL ? (
        <ActiveCallScreen
          peer={activePeer}
          onHangUp={hangUp}
          isLightTheme={isLightTheme}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          remoteAudioRef={remoteAudioRef}
          sendDtmf={sendDtmf}
          canSendDtmf={canSendDtmf}
        />
      ) : (
        <div className="sv-fade-up relative z-10 w-full max-w-md space-y-4">
          {/* App Header: brand/actions and the two remaining sections */}
          <div className="relative rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface)]/90 shadow-sm backdrop-blur-md">
            <header className="flex items-center justify-between gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setActiveMainSection('hub');
                  setShowProfileMenu(false);
                }}
                aria-label="Secure Voice home"
                title="Secure Voice home"
                className="flex min-w-0 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--sv-emerald-border)]"
              >
                <span className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] transition-transform duration-300 hover:scale-105">
                  <IconShield className="h-5 w-5 text-[#EF1D1D] transition-transform duration-300 group-hover:rotate-12" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base font-bold tracking-tight">Secure Voice</span>
                  <span className="block truncate text-[11px] font-medium text-[var(--sv-muted)]">End-to-end encrypted P2P</span>
                </span>
              </button>

              <div className="flex shrink-0 items-center gap-2">
                <ThemeToggle
                  isLightTheme={isLightTheme}
                  onToggle={handleThemeToggle}
                />
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowProfileMenu((prev) => !prev)}
                    aria-label="Open account menu"
                    aria-expanded={showProfileMenu}
                    aria-haspopup="menu"
                    title="Account"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface)] text-[var(--sv-secondary)] transition-all duration-200 hover:border-[var(--sv-muted)] hover:text-[var(--sv-text)] active:scale-95"
                  >
                    <IconUserRound className="h-4.5 w-4.5" />
                  </button>
                  {showProfileMenu && (
                    <div role="menu" aria-label="Account actions" className="sv-pop-in absolute right-0 top-12 z-30 w-56 space-y-1 rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface)] p-2 shadow-xl">
                      <div className="border-b border-[var(--sv-border)] px-3 py-2">
                        <p className="truncate text-sm font-semibold text-[var(--sv-text)]">{myName || 'Your account'}</p>
                        <p className="mt-0.5 truncate font-mono text-xs text-[var(--sv-muted)]">{myNumber || 'No line registered'}</p>
                      </div>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setActiveMainSection('profile');
                          setShowProfileMenu(false);
                        }}
                        className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--sv-secondary)] transition hover:bg-[var(--sv-surface-2)] hover:text-[var(--sv-text)]"
                      >
                        Profile settings
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setShowProfileMenu(false);
                          logout();
                        }}
                        className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-500 transition hover:bg-red-500/10"
                      >
                        Logout Session
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={async () => {
                          setShowProfileMenu(false);
                          const confirmed = window.confirm(
                            'Delete your Secure Voice account permanently?\n\nYour number will be removed from the database and you will need to register again.'
                          );
                          if (!confirmed) return;
                          await deleteAccount();
                        }}
                        className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-red-600/10"
                      >
                        Delete Account Permanently
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            <nav aria-label="Main sections" className="grid grid-cols-2 gap-1 border-t border-[var(--sv-border)] p-1.5">
              <button
                type="button"
                data-testid="profile-nav-btn"
                aria-pressed={activeMainSection === 'profile'}
                onClick={() => {
                  setActiveMainSection('profile');
                  setShowProfileMenu(false);
                }}
                className={`rounded-xl py-2.5 text-center text-xs font-bold tracking-wide transition-colors duration-200 ${
                  activeMainSection === 'profile'
                    ? 'border border-[var(--sv-emerald-border)] bg-[var(--sv-surface-2)] text-[var(--sv-emerald-text)]'
                    : 'border border-transparent text-[var(--sv-muted)] hover:text-[var(--sv-text)]'
                }`}
              >
                Profile
              </button>
              <button
                type="button"
                data-testid="recordings-nav-btn"
                aria-pressed={activeMainSection === 'recordings'}
                onClick={() => {
                  setActiveMainSection('recordings');
                  setShowProfileMenu(false);
                }}
                className={`rounded-xl py-2.5 text-center text-xs font-bold tracking-wide transition-colors duration-200 ${
                  activeMainSection === 'recordings'
                    ? 'border border-[var(--sv-emerald-border)] bg-[var(--sv-surface-2)] text-[var(--sv-emerald-text)]'
                    : 'border border-transparent text-[var(--sv-muted)] hover:text-[var(--sv-text)]'
                }`}
              >
                Recordings
              </button>
            </nav>
          </div>

          {/* Service Worker Update Toast */}
          {updateAvailable && (
            <div
              data-testid="update-banner"
              className="sv-pop-in flex items-center justify-between gap-3 rounded-2xl border border-[var(--sv-emerald-border)] bg-[var(--sv-emerald-bg)] px-4 py-3 text-sm font-medium text-[var(--sv-emerald-text)] shadow-sm"
            >
              <span>New version ready to install!</span>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="shrink-0 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-transform duration-200 hover:scale-105 active:scale-95"
              >
                Update Now
              </button>
            </div>
          )}

          {/* Compact Identity Bar (Always visible so `my-number` testid is always mounted) */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface)] px-4 py-3 shadow-sm transition-all duration-300 hover:border-[var(--sv-muted)]/40">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={SECTION_LABEL_CLASS}>My Line</span>
                {myName && (
                  <span className="truncate rounded-md bg-[var(--sv-surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--sv-secondary)]">
                    {myName}
                  </span>
                )}
              </div>
              <p
                data-testid="my-number"
                className="mt-1 font-mono text-base font-bold tracking-[0.12em] text-[var(--sv-text)]"
              >
                {myNumber || '••••••••••'}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyMyNumber}
                title="Copy my number"
                aria-label="Copy my number"
                className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] px-3 text-xs font-semibold text-[var(--sv-secondary)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--sv-emerald-border)] hover:text-[var(--sv-text)] active:scale-90"
              >
                {copiedMyNumber ? (
                  <>
                    <IconCheck className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-[var(--sv-emerald-text)]">Copied</span>
                  </>
                ) : (
                  <>
                    <IconCopy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {activeMainSection === 'hub' && (
            <>
          {/* Alerts & Notices */}
          {error && (
            <div
              data-testid="error-banner"
              className="sv-pop-in flex items-start justify-between gap-3 rounded-2xl border border-[var(--sv-danger-border)] bg-[var(--sv-danger-bg)] px-4 py-3 text-sm font-medium text-[var(--sv-danger-text)] shadow-sm"
            >
              <span>{error}</span>
              <button
                onClick={clearMessages}
                aria-label="Dismiss"
                className="mt-0.5 shrink-0 opacity-75 transition-transform duration-200 hover:rotate-90 hover:opacity-100"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
          )}

          {notice && !error && (
            <div
              data-testid="notice-banner"
              className="sv-pop-in flex items-start justify-between gap-3 rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface)] px-4 py-3 text-sm font-medium text-[var(--sv-secondary)] shadow-sm"
            >
              <span>{notice}</span>
              <button
                onClick={clearMessages}
                aria-label="Dismiss"
                className="mt-0.5 shrink-0 opacity-70 transition-transform duration-200 hover:rotate-90 hover:opacity-100"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
          )}

            </>
          )}

          {/* Tab Content: Profile */}
          {activeMainSection === 'profile' && (
            <div className="sv-fade-up space-y-4 rounded-3xl border border-[var(--sv-border)] bg-[var(--sv-surface)] p-5 shadow-md">
              <section aria-labelledby="profile-identity-heading" className="space-y-3">
                <div>
                  <p className={SECTION_LABEL_CLASS}>Your Profile</p>
                  <h2 id="profile-identity-heading" className="mt-1 text-lg font-bold text-[var(--sv-text)]">Identity details</h2>
                </div>
                <div className="rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--sv-muted)]">Name</p>
                  <p className="mt-1 break-words text-sm font-semibold text-[var(--sv-text)]">{myName || 'Not available'}</p>
                </div>
                <div className="rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--sv-muted)]">Secure Voice Number</p>
                  <p className="mt-1 break-all font-mono text-sm font-semibold tracking-wider text-[var(--sv-text)]">{myNumber || 'Not available'}</p>
                </div>
              </section>

              <div className="border-t border-[var(--sv-border)] pt-4">
                <p className={SECTION_LABEL_CLASS}>Call Audio & Ringtone</p>
                <label
                  htmlFor="ringtone-select"
                  className="mt-2.5 block text-sm font-semibold text-[var(--sv-secondary)]"
                >
                  Incoming Call Ringtone
                </label>
                <select
                  id="ringtone-select"
                  value={selectedRingtone}
                  onChange={(e) => selectRingtone(e.target.value)}
                  className="mt-2 w-full cursor-pointer rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] px-4 py-3.5 text-sm font-medium text-[var(--sv-text)] outline-none transition-all duration-200 hover:border-[var(--sv-muted)] focus:border-[#EF1D1D] focus:ring-4 focus:ring-[#EF1D1D]/15"
                >
                  {ringtones.map((ringtone) => (
                    <option key={ringtone.id} value={ringtone.id}>
                      {ringtone.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-[var(--sv-subtle)]">
                  Plays automatically when someone dials your 10-digit line.
                </p>
              </div>


            </div>
          )}

          {/* Tab Content: Recordings */}
          {activeMainSection === 'recordings' && (
            <section
              data-testid="recordings-section"
              aria-labelledby="recordings-heading"
              className="sv-fade-up space-y-4 rounded-3xl border border-[var(--sv-border)] bg-[var(--sv-surface)] p-5 shadow-md"
            >
              <div>
                <p className={SECTION_LABEL_CLASS}>Encrypted Vault</p>
                <h2
                  id="recordings-heading"
                  className="mt-1 text-lg font-bold text-[var(--sv-text)]"
                >
                  Call recordings
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--sv-muted)]">
                  Local-first audio capture will be accessible directly from the in-call deck.
                </p>
              </div>

              <div className="border-t border-[var(--sv-border)] pt-4">
                <p className={SECTION_LABEL_CLASS}>Saved Audio</p>
                <div className="mt-3 rounded-2xl border border-dashed border-[var(--sv-border)] bg-[var(--sv-surface-2)]/50 px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-[var(--sv-text)]">
                    No saved recordings yet
                  </p>
                  <p className="mt-1 text-xs text-[var(--sv-muted)]">
                    On-device WebAudio recorder coming in the next feature phase.
                  </p>
                </div>
              </div>
            </section>
          )}

          {activeMainSection === 'hub' && (
            <>
          {/* Dialer is opened by the persistent floating + button below. */}

          {/* Mobile Tactile Dial Pad Rollout */}
          {showDialPad && isMobileDevice && (
            <div className="sv-pop-in rounded-3xl border border-[var(--sv-border)] bg-[var(--sv-surface)] p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className={SECTION_LABEL_CLASS}>Touch Dialer</p>
                  <p className="mt-0.5 text-xs text-[var(--sv-subtle)]">
                    Tap 10 digits to connect
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDialPad(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--sv-border)] text-[var(--sv-muted)] transition-all duration-200 hover:rotate-90 hover:bg-[var(--sv-surface-2)] hover:text-[var(--sv-text)] active:scale-90"
                  aria-label="Close dial pad"
                  title="Close"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-5 rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] px-4 py-4 text-center shadow-inner">
                <p className="min-h-[32px] break-all font-mono text-2xl font-bold tracking-[0.16em] text-[var(--sv-text)]">
                  {targetNumber || 'Enter number'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() =>
                      setTargetNumber((prev) => (prev + digit).slice(0, 10))
                    }
                    className="flex h-14 items-center justify-center rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] text-2xl font-bold text-[var(--sv-text)] shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-[#EF1D1D]/40 active:scale-90 active:bg-[var(--sv-surface)]"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTargetNumber('')}
                  disabled={!targetNumber}
                  className="flex h-14 items-center justify-center rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] text-xs font-bold uppercase tracking-wider text-[var(--sv-muted)] transition-all duration-150 hover:text-[#EF1D1D] active:scale-90 disabled:opacity-35"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTargetNumber((prev) => (prev + '0').slice(0, 10))
                  }
                  className="flex h-14 items-center justify-center rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] text-2xl font-bold text-[var(--sv-text)] shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-[#EF1D1D]/40 active:scale-90 active:bg-[var(--sv-surface)]"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setTargetNumber((prev) => prev.slice(0, -1))}
                  className="flex h-14 items-center justify-center rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] text-xl text-[var(--sv-muted)] transition-all duration-150 hover:text-[var(--sv-text)] active:scale-90"
                  aria-label="Delete last digit"
                  title="Delete"
                >
                  ⌫
                </button>
              </div>

              <button
                type="button"
                onClick={async () => {
                  await startCall(targetNumber);
                }}
                disabled={!canDial || targetNumber.length !== 10}
                className={`mt-5 flex w-full items-center justify-center gap-2 px-6 py-4 text-base ${DANGER_BUTTON_CLASS}`}
              >
                <IconPhone className="h-5 w-5" />
                Call Now
              </button>
            </div>
          )}

          {/* Desktop / Standard Dialer Form Rollout */}
          {(showDialer || callState !== CALL_STATE.IDLE) && (
            <form
              onSubmit={handleDial}
              className="sv-pop-in space-y-4 rounded-3xl border border-[var(--sv-border)] bg-[var(--sv-surface)] p-5 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--sv-muted)]">
                  Dial Recipient Number
                </label>
                {showDialer && callState === CALL_STATE.IDLE && (
                  <button
                    type="button"
                    onClick={() => setShowDialer(false)}
                    className="text-xs font-semibold text-[var(--sv-muted)] transition hover:text-[var(--sv-text)]"
                  >
                    Hide
                  </button>
                )}
              </div>

              <input
                data-testid="target-number-input"
                value={targetNumber}
                onChange={(e) => setTargetNumber(digitsOnly(e.target.value))}
                placeholder="9999xxxxxx"
                inputMode="numeric"
                maxLength={10}
                disabled={!canDial}
                className={`${INPUT_CLASS} font-mono`}
                autoComplete="off"
              />

              <div className="flex gap-3">
                <button
                  data-testid="call-btn"
                  type="submit"
                  disabled={
                    callState === CALL_STATE.RINGING ||
                    !canDial ||
                    targetNumber.length !== 10
                  }
                  className={`flex-1 ${PRIMARY_BUTTON_CLASS}`}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <IconPhone className="h-4 w-4" />
                    {callState === CALL_STATE.RINGING ? 'Calling…' : 'Call'}
                  </span>
                </button>
                {callState === CALL_STATE.RINGING && (
                  <button
                    type="button"
                    onClick={hangUp}
                    className="rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] px-6 py-3.5 font-semibold text-[var(--sv-muted)] transition-all duration-200 hover:border-[#EF1D1D]/40 hover:text-[#EF1D1D] active:scale-95"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Recent Calls Interactive Rollout List */}
          {canDial && recentCalls.length > 0 && (
            <div className="rounded-3xl border border-[var(--sv-border)] bg-[var(--sv-surface)] p-5 shadow-sm">
              <div className="mb-3.5 flex items-center justify-between">
                <p className={SECTION_LABEL_CLASS}>Recent Calls</p>
                <span className="rounded-full bg-[var(--sv-surface-2)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--sv-muted)]">
                  {recentCalls.length}
                </span>
              </div>

              <ul className="space-y-2.5">
                {recentCalls.map((call) => {
                  const isExpanded = expandedCallId === call.id;
                  const directionMeta = getCallDirectionMeta(call);
                  return (
                    <li
                      key={call.id}
                      onClick={() => {
                        if (editingCallId === call.id) return;
                        setExpandedCallId((prev) =>
                          prev === call.id ? null : call.id
                        );
                      }}
                      className={`group rounded-2xl border bg-[var(--sv-surface-2)] px-4 py-3.5 transition-all duration-300 ${
                        isExpanded
                          ? 'border-[#EF1D1D]/40 bg-[var(--sv-surface)] shadow-md'
                          : 'border-[var(--sv-border)] hover:-translate-y-0.5 hover:border-[var(--sv-muted)]/50 hover:shadow-sm'
                      } ${
                        !editingCallId || editingCallId !== call.id
                          ? 'cursor-pointer'
                          : ''
                      }`}
                    >
                      {editingCallId === call.id ? (
                        <div
                          className="sv-fade-up space-y-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editingCallName}
                              onChange={(e) =>
                                setEditingCallName(e.target.value)
                              }
                              placeholder="Enter contact name"
                              autoFocus
                              className="min-w-0 flex-1 rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] px-3.5 py-2 text-sm text-[var(--sv-text)] placeholder-[var(--sv-subtle)] outline-none transition focus:border-[#EF1D1D]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const name = editingCallName.trim();
                                if (!name) return;
                                updateRecentCallName(call.id, name);
                                setEditingCallId(null);
                                setEditingCallName('');
                              }}
                              disabled={!editingCallName.trim()}
                              className="rounded-xl bg-[#EF1D1D] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#D61A1A] active:scale-95 disabled:opacity-40"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCallId(null);
                                setEditingCallName('');
                              }}
                              className="rounded-xl border border-[var(--sv-border)] px-3.5 py-2 text-xs font-semibold text-[var(--sv-muted)] transition hover:text-[var(--sv-text)]"
                            >
                              Cancel
                            </button>
                          </div>
                          <p className="font-mono text-xs tracking-wider text-[var(--sv-muted)]">
                            {call.number}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 flex-1 items-center gap-3.5">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface)] text-sm font-bold text-[var(--sv-secondary)] shadow-sm transition-transform duration-300 group-hover:scale-105">
                                {(call.name && call.name !== 'Unknown'
                                  ? call.name
                                  : call.number
                                )
                                  .slice(0, 1)
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[var(--sv-text)]">
                                  {call.name}
                                </p>
                                <p className="mt-0.5 truncate font-mono text-xs tracking-wider text-[var(--sv-muted)]">
                                  {call.number}
                                </p>
                                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--sv-subtle)]">
                                  <span
                                    className={`inline-flex items-center gap-1 font-medium ${
                                      directionMeta.isMissed
                                        ? 'text-[#EF1D1D]'
                                        : 'text-[var(--sv-muted)]'
                                    }`}
                                  >
                                    {directionMeta.isIncoming ? (
                                      <IconArrowDownLeft className="h-3 w-3" />
                                    ) : (
                                      <IconArrowUpRight className="h-3 w-3" />
                                    )}
                                    {directionMeta.label}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>
                                    {new Date(call.timestamp).toLocaleString(
                                      'en-IN',
                                      {
                                        day: '2-digit',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true,
                                      }
                                    )}
                                  </span>
                                  {call.duration != null && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-mono">
                                        {Math.floor(call.duration / 60000)
                                          .toString()
                                          .padStart(2, '0')}
                                        :
                                        {Math.floor(
                                          (call.duration % 60000) / 1000
                                        )
                                          .toString()
                                          .padStart(2, '0')}
                                      </span>
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-transparent text-[var(--sv-subtle)] transition-all duration-300 group-hover:border-[var(--sv-border)] group-hover:bg-[var(--sv-surface)] ${
                                isExpanded
                                  ? 'rotate-180 border-[var(--sv-border)] bg-[var(--sv-surface)] text-[var(--sv-text)]'
                                  : ''
                              }`}
                            >
                              <IconChevronDown className="h-4 w-4" />
                            </div>
                          </div>

                          {/* Smooth Accordion Rollout Action Bar */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`sv-rollout ${
                              isExpanded
                                ? 'mt-3.5 grid-rows-[1fr] opacity-100'
                                : 'mt-0 grid-rows-[0fr] opacity-0'
                            }`}
                          >
                            <div className="min-h-0 overflow-hidden">
                              <div className="flex items-center justify-end gap-2 border-t border-[var(--sv-border)] pt-3">
                                <button
                                  type="button"
                                  onClick={() => startCall(call.number)}
                                  disabled={!canDial}
                                  className="flex h-9 items-center gap-1.5 rounded-xl bg-[#EF1D1D] px-3.5 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#D61A1A] active:scale-95 disabled:opacity-40"
                                  title="Call"
                                  aria-label="Call"
                                >
                                  <IconPhone className="h-3.5 w-3.5" />
                                  <span>Dial</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCallId(call.id);
                                    setEditingCallName(
                                      call.name === 'Unknown' ? '' : call.name
                                    );
                                  }}
                                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] text-[var(--sv-muted)] transition-all duration-200 hover:-translate-y-0.5 hover:text-[var(--sv-text)] active:scale-90"
                                  title="Edit name"
                                  aria-label="Edit name"
                                >
                                  <IconPencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => shareRecentCall(call)}
                                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] text-[var(--sv-muted)] transition-all duration-200 hover:-translate-y-0.5 hover:text-[var(--sv-text)] active:scale-90"
                                  title="Share contact"
                                  aria-label="Share contact"
                                >
                                  <IconShare className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    deleteRecentCall(call.id);
                                    setExpandedCallId(null);
                                  }}
                                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#EF1D1D]/30 bg-[#EF1D1D]/10 text-[#EF1D1D] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#EF1D1D]/20 active:scale-90"
                                  title="Delete call"
                                  aria-label="Delete call"
                                >
                                  <IconTrash className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Saved Contacts Card */}
          {canDial && contacts.length > 0 && (
            <div
              data-testid="contacts-panel"
              className="rounded-3xl border border-[var(--sv-border)] bg-[var(--sv-surface)] p-5 shadow-sm"
            >
              <p className={`mb-3.5 ${SECTION_LABEL_CLASS}`}>
                Saved Contacts ({contacts.length})
              </p>
              <ul className="space-y-2.5">
                {contacts.map((contact) => (
                  <li
                    key={contact.number}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] px-3.5 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--sv-muted)]/50 hover:bg-[var(--sv-surface)] hover:shadow-sm"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface)] text-xs font-bold text-[var(--sv-secondary)]">
                        {contact.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--sv-text)]">
                          {contact.name}
                        </p>
                        <p className="truncate font-mono text-xs tracking-wider text-[var(--sv-muted)]">
                          {contact.number}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetNumber(contact.number);
                          if (isMobileDevice) {
                            setShowDialPad(true);
                          } else {
                            setShowDialer(true);
                          }
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface)] text-[var(--sv-muted)] transition-all duration-200 hover:-translate-y-0.5 hover:text-[var(--sv-text)] active:scale-90"
                        title="Fill in form"
                        aria-label="Fill in form"
                      >
                        <IconPencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        data-testid={`call-contact-${contact.number}`}
                        onClick={() => startCall(contact.number)}
                        className={`px-3.5 py-1.5 text-xs ${DANGER_BUTTON_CLASS}`}
                      >
                        Call
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Remove ${contact.name}?`)) {
                            removeContact(contact.number);
                          }
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#EF1D1D]/30 text-[#EF1D1D] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#EF1D1D]/15 active:scale-90"
                        title="Remove"
                        aria-label="Remove"
                      >
                        <IconX className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer Status Pill */}
          <div className="flex items-center justify-between rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface)] px-5 py-3 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--sv-muted)]">
              Line Status
            </span>
            <p
              data-testid="call-status"
              className="inline-flex items-center gap-2 text-sm text-[var(--sv-muted)]"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  callState === CALL_STATE.IDLE
                    ? 'bg-emerald-500'
                    : 'animate-ping bg-amber-400'
                }`}
              />
              <span>
                Status:{' '}
                <strong className="font-bold text-[var(--sv-text)]">
                  {STATUS_LABEL[callState]}
                </strong>
              </span>
            </p>
          </div>
            </>
          )}
        </div>
      )}

      {/* Persistent floating new-call action. Opens the existing dialer without hiding Recent Calls. */}
      {callState !== CALL_STATE.IN_CALL && canDial && (
        <button
          type="button"
          data-testid="floating-new-call-btn"
          onClick={() => {
            setActiveMainSection('hub');
            setShowProfileMenu(false);
            if (isMobileDevice) {
              setShowDialPad((prev) => !prev);
              setShowDialer(false);
            } else {
              setShowDialer((prev) => !prev);
              setShowDialPad(false);
            }
          }}
          aria-label="New call"
          title="New call"
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-[calc(1.25rem+env(safe-area-inset-right))] z-30 flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-[#EF1D1D] text-white shadow-[0_10px_30px_rgba(239,29,29,0.35)] transition-all duration-200 hover:-translate-y-1 hover:bg-[#D61A1A] hover:shadow-[0_14px_36px_rgba(239,29,29,0.45)] active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#EF1D1D]/30"
        >
          <IconPhone className="h-6 w-6" />
        </button>
      )}

      {/* =========================================================
          DEDICATED OUTGOING CALL (RINGING) RADAR OVERLAY
         ========================================================= */}
      {callState === CALL_STATE.RINGING && (
        <div
          data-testid="outgoing-call-panel"
          className={`fixed inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-md transition-opacity duration-300 ${
            isLightTheme ? 'bg-white/85' : 'bg-[#090B10]/85'
          }`}
        >
          <div className="sv-pop-in w-full max-w-sm rounded-3xl border border-[var(--sv-border)] bg-[var(--sv-surface)] p-8 text-center shadow-[0_28px_80px_rgba(0,0,0,0.5)]">
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
              <span
                aria-hidden="true"
                className="sv-ripple-1 absolute inset-0 rounded-full border border-emerald-500/40"
              />
              <span
                aria-hidden="true"
                className="sv-ripple-2 absolute inset-0 rounded-full border border-emerald-500/30"
              />
              <span
                aria-hidden="true"
                className="sv-ripple-3 absolute inset-0 rounded-full border border-emerald-500/20"
              />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-[var(--sv-emerald-border)] bg-[var(--sv-emerald-bg)] text-[var(--sv-emerald-text)] shadow-lg">
                <IconPhone className="h-9 w-9 animate-pulse" />
              </div>
            </div>

            <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[var(--sv-emerald-text)]">
              Dialing Peer…
            </p>
            <h2 className="mt-2 truncate text-2xl font-bold text-[var(--sv-text)]">
              {ringingName}
            </h2>
            <p className="mt-1 font-mono text-sm tracking-[0.16em] text-[var(--sv-muted)]">
              {ringingNumber}
            </p>

            <div className="mt-8">
              <button
                type="button"
                data-testid="cancel-outgoing-call-btn"
                onClick={hangUp}
                className={`flex w-full items-center justify-center gap-2.5 py-4 text-base ${DANGER_BUTTON_CLASS}`}
              >
                <IconPhoneOff className="h-5 w-5" />
                Cancel Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          INCOMING CALL MODAL OVERLAY
         ========================================================= */}
      {incomingCall && (
        <div
          data-testid="incoming-call-panel"
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md ${
            isLightTheme ? 'bg-white/85' : 'bg-[#090B10]/85'
          }`}
        >
          <div className="sv-pop-in w-full max-w-sm rounded-3xl border border-[var(--sv-border)] bg-[var(--sv-surface)] p-8 text-center shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
              <span
                aria-hidden="true"
                className="sv-ripple-1 absolute inset-0 rounded-full border border-[#EF1D1D]/45"
              />
              <span
                aria-hidden="true"
                className="sv-ripple-2 absolute inset-0 rounded-full border border-[#EF1D1D]/30"
              />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-[#EF1D1D]/40 bg-[#EF1D1D]/15 text-[#EF1D1D] shadow-lg">
                <IconPhone className="h-9 w-9 animate-bounce" />
              </div>
            </div>

            <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#EF1D1D]">
              Incoming Encrypted Call
            </p>
            <h2 className="mt-2 truncate text-2xl font-bold text-[var(--sv-text)]">
              {incomingCall.callerName} is calling…
            </h2>
            <p className="mt-1 font-mono text-sm tracking-[0.16em] text-[var(--sv-muted)]">
              {incomingCall.callerNumber}
            </p>

            <div className="mt-8 flex gap-3">
              <button
                data-testid="reject-call-btn"
                onClick={rejectCall}
                className={`flex-1 py-3.5 ${DANGER_BUTTON_CLASS}`}
              >
                Reject
              </button>
              <button
                data-testid="accept-call-btn"
                onClick={acceptCall}
                className={`flex-1 py-3.5 ${PRIMARY_BUTTON_CLASS}`}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}