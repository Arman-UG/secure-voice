'use client';

import { useState, useEffect } from 'react';
import useWebRTC, {
  CALL_STATE,
  SOCKET_STATUS,
} from '../hooks/useWebRTC';

/* =========================================================
   Visual constants (presentation only)
   ========================================================= */

const STATUS_LABEL = {
  [CALL_STATE.IDLE]: 'Ready',
  [CALL_STATE.RINGING]: 'Calling…',
  [CALL_STATE.INCOMING]: 'Incoming',
  [CALL_STATE.IN_CALL]: 'In Call',
};

const SOCKET_TONE = {
  [SOCKET_STATUS.CONNECTED]: 'bg-emerald-400',
  [SOCKET_STATUS.CONNECTING]: 'bg-amber-400 animate-pulse',
  [SOCKET_STATUS.DISCONNECTED]: 'bg-[#EF1D1D]',
};

const INPUT_CLASS =
  'w-full rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] px-4 py-3 text-lg tracking-wider ' +
  'text-[var(--sv-text)] placeholder-[var(--sv-subtle)] outline-none transition ' +
  'focus:border-[#EF1D1D] focus:ring-2 focus:ring-[#EF1D1D]/30 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const PRIMARY_BUTTON_CLASS = 'w-full rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-6 py-3.5 font-semibold text-emerald-300 transition hover:bg-emerald-400/20';

const SECTION_LABEL_CLASS =
  'text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sv-muted)]';

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

function ThemeToggle({ isLightTheme, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface)] text-[var(--sv-secondary)] transition hover:opacity-80"
      aria-label={isLightTheme ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLightTheme ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {isLightTheme ? (
        <IconMoon className="h-4 w-4" />
      ) : (
        <IconSun className="h-4 w-4" />
      )}
    </button>
  );
}

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
  } = useWebRTC();

  const [isLightTheme, setIsLightTheme] = useState(false);

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

  const themeVars = isLightTheme
    ? {
        '--sv-bg': '#F5F7FA',
        '--sv-surface': '#FFFFFF',
        '--sv-surface-2': '#F8FAFC',
        '--sv-text': '#111827',
        '--sv-secondary': '#374151',
        '--sv-muted': '#6B7280',
        '--sv-subtle': '#9CA3AF',
        '--sv-border': '#E5E7EB',
      }
    : {
        '--sv-bg': '#0F1115',
        '--sv-surface': '#141821',
        '--sv-surface-2': '#0B0D11',
        '--sv-text': '#F6F4F1',
        '--sv-secondary': '#D9D1CC',
        '--sv-muted': '#9A9693',
        '--sv-subtle': '#6F6B68',
        '--sv-border': '#2A2E36',
      };

  const handleThemeToggle = () => {
    setIsLightTheme((prev) => !prev);
  };

  /* =========================================================
     Registration form
     ========================================================= */

  const [registrationName, setRegistrationName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');

  /* =========================================================
     Dialer
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

  let registration = null;

  const detectUpdate = async () => {
    try {
      registration = await navigator.serviceWorker.ready;

      const checkWaitingWorker = () => {
        if (
          registration?.waiting &&
          navigator.serviceWorker.controller
        ) {
          console.log('[update] New version detected.');
          setUpdateAvailable(true);
        }
      };

      checkWaitingWorker();

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;

        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            console.log('[update] New version detected.');
            setUpdateAvailable(true);
          }
        });
      });

      await registration.update();

      checkWaitingWorker();
    } catch (err) {
      console.error('[update] Detection failed:', err);
    }
  };

  detectUpdate();
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
  if (callState === CALL_STATE.IDLE) {
    setShowDialer(false);
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

  /* =========================================================
     Registration
     ========================================================= */

const handleRegistration = async (e) => {
  e.preventDefault();

  if (!canRegister) return;

  // Ask for notification permission directly from
  // the user's Register button interaction.
  await requestNotificationPermission();

  registerIdentity(
    registrationName,
    registrationNumber
  );
};

  /* =========================================================
     Dial
     ========================================================= */

  const handleDial = async (e) => {
    e.preventDefault();

    await startCall(targetNumber,);
  };

  /* =========================================================
     REGISTRATION SCREEN
     ========================================================= */

  if (registrationRequired) {
    return (
      <main style={themeVars} className="relative flex min-h-screen items-center justify-center bg-[var(--sv-bg)] p-4 text-[var(--sv-text)] antialiased sm:p-6">
        {/* Soft ambient light (decorative) */}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(239,29,29,0.06),transparent_65%)]"
        />

        <div className="relative w-full max-w-md space-y-5">

          {/* Header */}
 
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface)]">
                <IconShield className="h-5 w-5 text-[var(--sv-secondary)]" />
              </div>

              <div>
                <h1 className="text-lg font-bold tracking-tight">
                  Secure Voice V3
                </h1>

                <p className="text-xs text-[var(--sv-muted)]">
                  End-to-end encrypted P2P calling
                </p>
              </div>
            </div>
          <div className="flex items-center gap-2">
            <ThemeToggle
              isLightTheme={isLightTheme}
              onToggle={handleThemeToggle}
            />
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                SOCKET_TONE[socketStatus]
              }`}
            />
          </div>
          </header>

          {/* Registration Card */}

          <form
            onSubmit={handleRegistration}
            className="space-y-5 rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.35)]"
          >
            <div>
              <h2 className="text-lg font-semibold text-[var(--sv-text)]">
                Register your identity
              </h2>

              <p className="mt-1 text-sm text-[var(--sv-muted)]">
                Choose your name and your 10-digit Secure Voice number.
              </p>
            </div>

            {/* Name */}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--sv-muted)]">
                Your Name
              </label>

              <input
                data-testid="registration-name-input"
                value={registrationName}
                onChange={(e) =>
                  setRegistrationName(e.target.value)
                }
                placeholder="Arman"
                className={INPUT_CLASS}
                autoComplete="name"
                disabled={
                  socketStatus !==
                  SOCKET_STATUS.CONNECTED
                }
              />
            </div>

            {/* Number */}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--sv-muted)]">
                Your Number
              </label>

              <input
                data-testid="registration-number-input"
                value={registrationNumber}
                onChange={(e) =>
                  setRegistrationNumber(
                    digitsOnly(e.target.value)
                  )
                }
                placeholder="9466447743"
                inputMode="numeric"
                maxLength={10}
                className={INPUT_CLASS}
                autoComplete="tel"
                disabled={
                  socketStatus !==
                  SOCKET_STATUS.CONNECTED
                }
              />

              <p className="mt-1.5 text-xs text-[var(--sv-subtle)]">
                Enter exactly 10 digits. No +91 required.
              </p>
            </div>

            {/* Registration error */}

            {registrationError && (
              <div
                data-testid="registration-error"
                className="rounded-xl border border-[#EF1D1D]/30 bg-[#EF1D1D]/10 px-4 py-3 text-sm text-rose-200"
              >
                {registrationError}
              </div>
            )}

            {/* Connection status */}

            {socketStatus !== SOCKET_STATUS.CONNECTED && (
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200/90">
                Connecting to Secure Voice server…
              </div>
            )}

            {/* Register */}

            <button
              data-testid="register-btn"
              type="submit"
              disabled={!canRegister}
              className={`w-full px-6 py-3.5 ${PRIMARY_BUTTON_CLASS}`}
            >
              Register
            </button>

            <p className="text-center text-xs text-[var(--sv-subtle)]">
              Your number will be remembered on this device.
            </p>
          </form>
        </div>
      </main>
    );
  }

  /* =========================================================
     MAIN APPLICATION
     ========================================================= */

  return (
    <main style={themeVars} className="relative flex min-h-screen items-center justify-center bg-[var(--sv-bg)] p-4 text-[var(--sv-text)] antialiased sm:p-6">

      {/* Hidden audio sink */}

      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        className="hidden"
      />

      {/* Soft ambient light (decorative) */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(239,29,29,0.06),transparent_65%)]"
      />

      <div className="relative w-full max-w-md space-y-5">

        {/* Header */}

        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface)]">
              <IconShield className="h-5 w-5 text-[var(--sv-secondary)]" />
            </div>

            <div>
              <h1 className="text-lg font-bold tracking-tight">
                Secure Voice
              </h1>

              <p className="text-xs text-[var(--sv-muted)]">
                End-to-end encrypted P2P calling
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle
              isLightTheme={isLightTheme}
              onToggle={handleThemeToggle}
            />
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                SOCKET_TONE[socketStatus]
              }`}
            />
          </div>
        </header>

        {/* Your identity */}

        <div className="rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface)] px-5 py-4">

          <p className={SECTION_LABEL_CLASS}>
            Profile
          </p>

          <p
            data-testid="my-number"
            className="mt-1.5 font-mono text-2xl tracking-wider text-[var(--sv-text)]"
          >
            {myNumber || '••••••••••'}
          </p>

          {myName && (
            <p className="mt-0.5 text-sm text-[var(--sv-muted)]">
              {myName}
            </p>
          )}

          <button
            type="button"
            onClick={logout}
            className="mt-4 w-full rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
          >
            Logout
          </button>

          <button
  type="button"
  onClick={async () => {
    const confirmed = window.confirm(
      'Delete your Secure Voice account permanently?\n\nYour number will be removed from the database and you will need to register again.'
    );

    if (!confirmed) return;

    await deleteAccount();
  }}
  className="mt-2 w-full rounded-xl border border-red-600/40 bg-red-600/10 px-4 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-600/20"
>
  Delete Account
</button>

          <p className="mt-3 border-t border-[var(--sv-border)] pt-3 text-xs leading-relaxed text-[var(--sv-subtle)]">
            <b className="font-medium text-[var(--sv-secondary)]">Share the numbers with your friends, family, or colleagues to call each other.</b>
          </p>
        </div>

        {/* Error */}

        {error && (
          <div
            data-testid="error-banner"
            className="flex items-start justify-between gap-3 rounded-xl border border-[#EF1D1D]/30 bg-[#EF1D1D]/10 px-4 py-3 text-sm text-rose-200"
          >
            <span>{error}</span>

            <button
              onClick={clearMessages}
              aria-label="Dismiss"
              className="mt-0.5 shrink-0 text-rose-300/80 transition hover:text-rose-200"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Notice */}

        {notice && !error && (
          <div
            data-testid="notice-banner"
            className="flex items-start justify-between gap-3 rounded-xl border border-[#D9D1CC]/15 bg-[#D9D1CC]/5 px-4 py-3 text-sm text-[var(--sv-secondary)]"
          >
            <span>{notice}</span>

            <button
              onClick={clearMessages}
              aria-label="Dismiss"
              className="mt-0.5 shrink-0 text-[var(--sv-secondary)]/60 transition hover:text-[var(--sv-secondary)]"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        )}

        {/*+New Call*/}

                {canDial && (
  <button
    type="button"
    onClick={() => {
  if (isMobileDevice) {
    setShowDialPad(true);
  } else {
    setShowDialer(true);
  }
}}
    className="w-full rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-6 py-3.5 font-semibold text-emerald-300 transition hover:bg-emerald-400/20"
  >
    + New Call
  </button>
)}

{/* Mobile Dial Pad */}

{showDialPad && isMobileDevice && (
  <div className="rounded-3xl border border-[#2A2E36] bg-[#141821] p-5">
    {/* Header */}
    <div className="mb-5 flex items-center justify-between">
      <div>
        <p className={SECTION_LABEL_CLASS}>
          New Call
        </p>

        <p className="mt-1 text-xs text-[#6F6B68]">
          Enter a 10-digit number
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowDialPad(false)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2A2E36] text-[#9A9693] transition hover:bg-[#0B0D11] hover:text-[#F6F4F1]"
        aria-label="Close dial pad"
        title="Close"
      >
        <IconX className="h-4 w-4" />
      </button>
    </div>

    {/* Number display */}
    <div className="mb-6 rounded-2xl border border-[#2A2E36] bg-[#0B0D11] px-4 py-5 text-center">
      <p className="min-h-[32px] break-all font-mono text-2xl tracking-[0.14em] text-[#F6F4F1]">
        {targetNumber || 'Enter number'}
      </p>
    </div>

    {/* Keypad */}
    <div className="grid grid-cols-3 gap-3">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
        <button
          key={digit}
          type="button"
          onClick={() =>
            setTargetNumber((prev) =>
              (prev + digit).slice(0, 10)
            )
          }
          className="flex h-16 items-center justify-center rounded-2xl border border-[#2A2E36] bg-[#0B0D11] text-2xl font-medium text-[#F6F4F1] transition active:scale-95 active:bg-[#141821]"
        >
          {digit}
        </button>
      ))}

      {/* Empty spacer */}
      <div />

      {/* Zero */}
      <button
        type="button"
        onClick={() =>
          setTargetNumber((prev) =>
            (prev + '0').slice(0, 10)
          )
        }
        className="flex h-16 items-center justify-center rounded-2xl border border-[#2A2E36] bg-[#0B0D11] text-2xl font-medium text-[#F6F4F1] transition active:scale-95 active:bg-[#141821]"
      >
        0
      </button>

      {/* Backspace */}
      <button
        type="button"
        onClick={() =>
          setTargetNumber((prev) =>
            prev.slice(0, -1)
          )
        }
        className="flex h-16 items-center justify-center rounded-2xl border border-[#2A2E36] bg-[#0B0D11] text-[#9A9693] transition active:scale-95 active:bg-[#141821] hover:text-[#F6F4F1]"
        aria-label="Delete last digit"
        title="Delete"
      >
        ⌫
      </button>
    </div>

    {/* Call */}
    <button
      type="button"
      onClick={async () => {
        await startCall(targetNumber);
      }}
      disabled={
        !canDial ||
        targetNumber.length !== 10
      }
      className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#EF1D1D] px-6 py-4 text-base font-semibold text-white shadow-[0_8px_24px_rgba(239,29,29,0.18)] transition hover:bg-[#D61A1A] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#2A2E36] disabled:text-[#9A9693] disabled:shadow-none"
    >
      <IconPhone className="h-5 w-5" />
      Call
    </button>
  </div>
)}

{/* Dialer */}
         {(showDialer || callState !== CALL_STATE.IDLE) && (
         <form
          onSubmit={handleDial}
          className="space-y-4 rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface)] p-5"
         >

          {/* Target number */}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--sv-muted)]">
              Enter number
            </label>

            <input
              data-testid="target-number-input"
              value={targetNumber}
              onChange={(e) =>
                setTargetNumber(
                  digitsOnly(e.target.value)
                )
              }
              placeholder="9999xxxxxx"
              inputMode="numeric"
              maxLength={10}
              disabled={!canDial}
              className={INPUT_CLASS}
              autoComplete="off"
            />
          </div>

{/* Buttons */}

{callState !== CALL_STATE.IN_CALL && (
  <div className="flex gap-3">
    <button
      data-testid="call-btn"
      type="submit"
      disabled={
        callState === CALL_STATE.RINGING ||
        !canDial ||
        targetNumber.length !== 10
      }
      className={`flex-1 px-6 py-3.5 ${PRIMARY_BUTTON_CLASS}`}
    >
      <span className="inline-flex items-center justify-center gap-2">
        <IconPhone className="h-4 w-4" />
        {callState === CALL_STATE.RINGING
          ? 'Calling…'
          : 'Call'}
      </span>
    </button>

    {callState === CALL_STATE.RINGING && (
      <button
        type="button"
        onClick={hangUp}
        className="rounded-2xl border border-[var(--sv-border)] px-6 py-3.5 font-semibold text-[var(--sv-muted)] transition hover:border-[#D9D1CC]/25 hover:bg-[var(--sv-surface-2)] hover:text-[var(--sv-text)]"
      >
        Cancel
      </button>
    )}
  </div>
)}

{callState === CALL_STATE.IN_CALL && (
  <button
    data-testid="end-call-btn"
    type="button"
    onClick={hangUp}
    className="w-full rounded-2xl bg-[#EF1D1D] px-6 py-3.5 font-semibold text-white shadow-[0_8px_24px_rgba(239,29,29,0.18)] transition hover:bg-[#D61A1A]"
  >
    End Call
  </button>
)}
        </form>
        )}
    
        {/* Recent Calls */}

         {canDial && recentCalls.length > 0 && (
          <div className="rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface)] p-5">
            <p className={`mb-3 ${SECTION_LABEL_CLASS}`}>
              Recent Calls
            </p>

            <ul className="space-y-2">
              {recentCalls.map((call) => {
                const isExpanded = expandedCallId === call.id;

                return (
                  <li
                    key={call.id}
                    onClick={() => {
                      if (editingCallId === call.id) return;

                      setExpandedCallId((prev) =>
                        prev === call.id ? null : call.id
                      );
                    }}
                    className={`rounded-xl border bg-[var(--sv-surface-2)] px-4 py-3 transition ${
                      isExpanded
                        ? 'border-[#D9D1CC]/25'
                        : 'border-[var(--sv-border)]'
                    } ${
                      !editingCallId || editingCallId !== call.id
                        ? 'cursor-pointer hover:border-[#D9D1CC]/25'
                        : ''
                    }`}
                  >
                    {editingCallId === call.id ? (
                      <div
                        className="space-y-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingCallName}
                            onChange={(e) =>
                              setEditingCallName(e.target.value)
                            }
                            placeholder="Enter name"
                            autoFocus
                            className="min-w-0 flex-1 rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface)] px-3 py-2 text-sm text-[var(--sv-text)] placeholder-[var(--sv-subtle)] outline-none transition focus:border-[#EF1D1D]"
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
                            className="rounded-lg bg-[#EF1D1D] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#D61A1A] disabled:cursor-not-allowed disabled:bg-[#2A2E36] disabled:text-[var(--sv-muted)]"
                          >
                            Save
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingCallId(null);
                              setEditingCallName('');
                            }}
                            className="rounded-lg border border-[var(--sv-border)] px-3.5 py-2 text-xs font-medium text-[var(--sv-muted)] transition hover:bg-[var(--sv-surface)] hover:text-[var(--sv-text)]"
                          >
                            Cancel
                          </button>
                        </div>

                        <p className="font-mono text-xs tracking-wider text-[var(--sv-muted)]">
                          {call.number}
                        </p>

                        <span className="inline-flex items-center gap-1 text-xs text-[var(--sv-muted)]">
                          <IconArrowUpRight className="h-3 w-3" />
                          Outgoing
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--sv-border)] bg-[var(--sv-surface)] text-sm font-semibold text-[var(--sv-secondary)]">
                              {(
                                call.name && call.name !== 'Unknown'
                                  ? call.name
                                  : call.number
                              )
                                .slice(0, 1)
                                .toUpperCase()}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[var(--sv-text)]">
                                {call.name}
                              </p>

                              <p className="mt-0.5 truncate font-mono text-xs tracking-wider text-[var(--sv-muted)]">
                                {call.number}
                              </p>

                              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--sv-subtle)]">
                                <span className="inline-flex items-center gap-1 text-[var(--sv-muted)]">
                                  <IconArrowUpRight className="h-3 w-3" />
                                  Outgoing
                                </span>

                                <span aria-hidden="true">·</span>

                                <span>
                                  {new Date(call.timestamp).toLocaleString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true,
                                  })}
                                </span>

                                {call.duration != null && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>
                                      Duration:{' '}
                                      {Math.floor(call.duration / 60000)
                                        .toString()
                                        .padStart(2, '0')}
                                      :
                                      {Math.floor((call.duration % 60000) / 1000)
                                        .toString()
                                        .padStart(2, '0')}
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>

                          <IconChevronDown
                            className={`h-4 w-4 shrink-0 text-[var(--sv-subtle)] transition-transform duration-300 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </div>

                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`grid transition-all duration-500 ease-in-out ${
                            isExpanded
                              ? 'mt-3 grid-rows-[1fr] opacity-100'
                              : 'mt-0 grid-rows-[0fr] opacity-0'
                          }`}
                        >
                          <div className="min-h-0 overflow-hidden">
                            <div className="flex justify-end gap-2 border-t border-[var(--sv-border)] pt-3">
                              <button
                                type="button"
                                onClick={() => startCall(call.number)}
                                disabled={!canDial}
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EF1D1D] text-white transition hover:bg-[#D61A1A] disabled:cursor-not-allowed disabled:bg-[#2A2E36] disabled:text-[var(--sv-muted)]"
                                title="Call"
                                aria-label="Call"
                              >
                                <IconPhone className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCallId(call.id);
                                  setEditingCallName(
                                    call.name === 'Unknown' ? '' : call.name
                                  );
                                }}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--sv-border)] text-[var(--sv-muted)] transition hover:border-[#D9D1CC]/25 hover:bg-[var(--sv-surface)] hover:text-[var(--sv-text)]"
                                title="Edit name"
                                aria-label="Edit name"
                              >
                                <IconPencil className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => shareRecentCall(call)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--sv-border)] text-[var(--sv-muted)] transition hover:border-[#D9D1CC]/25 hover:bg-[var(--sv-surface)] hover:text-[var(--sv-text)]"
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
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#EF1D1D]/30 text-[#EF1D1D] transition hover:bg-[#EF1D1D]/10"
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


        
        {/* Saved Contacts */}

        {canDial && contacts.length > 0 && (
          <div
            data-testid="contacts-panel"
            className="rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface)] p-5"
          >
            <p className={`mb-3 ${SECTION_LABEL_CLASS}`}>
              Saved Contacts ({contacts.length})
            </p>

            <ul className="space-y-2">
              {contacts.map((contact) => (
                <li
                  key={contact.number}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface-2)] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--sv-text)]">
                      {contact.name}
                    </p>

                    <p className="truncate font-mono text-xs tracking-wider text-[var(--sv-muted)]">
                      {contact.number}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1.5">

                    <button
                      type="button"
                      onClick={() => {
                        setCallerName(contact.name);
                        setTargetNumber(contact.number);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--sv-border)] text-[var(--sv-muted)] transition hover:border-[#D9D1CC]/25 hover:bg-[var(--sv-surface)] hover:text-[var(--sv-text)]"
                      title="Fill in form"
                      aria-label="Fill in form"
                    >
                      <IconPencil className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      data-testid={`call-contact-${contact.number}`}
                      onClick={() =>
                        startCall(
                          contact.name,
                          contact.number
                        )
                      }
                      className="rounded-lg bg-[#EF1D1D] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#D61A1A]"
                    >
                      Call
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            `Remove ${contact.name}?`
                          )
                        ) {
                          removeContact(
                            contact.number
                          );
                        }
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EF1D1D]/30 text-[#EF1D1D] transition hover:bg-[#EF1D1D]/10"
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

        {/* Status */}

        <div className="rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-surface)] px-5 py-3 text-center">
          <p
            data-testid="call-status"
            className="text-sm text-[var(--sv-muted)]"
          >
            Status:{' '}
            <span className="font-medium text-[var(--sv-text)]">
              {STATUS_LABEL[callState]}
            </span>

            {callState === CALL_STATE.IN_CALL &&
              activePeer && (
                <>
                  {' '}
                  with{' '}
                  <span className="font-medium text-[var(--sv-secondary)]">
                    {activePeer.name}
                  </span>
                </>
              )}
          </p>
        </div>

        <p className="text-center text-xs text-[var(--sv-subtle)]">
          Dono phones pe app khuli honi chahiye. WhatsApp jaisa.
        </p>

      </div>

      {/* Incoming call overlay */}

      {incomingCall && (
        <div
          data-testid="incoming-call-panel"
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${
            isLightTheme ? 'bg-white/90' : 'bg-[#0F1115]/90'
          }`}
        >
          <div className="w-full max-w-sm rounded-3xl border border-[var(--sv-border)] bg-[var(--sv-surface)] p-8 text-center shadow-[0_24px_64px_rgba(0,0,0,0.45)]">

            <div className="relative mx-auto h-20 w-20">
              <span
                aria-hidden="true"
                className="absolute inset-0 animate-ping rounded-full bg-[#EF1D1D]/15"
              />

              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-[#EF1D1D]/30 bg-[#EF1D1D]/10 text-[#EF1D1D]">
                <IconPhone className="h-8 w-8" />
              </div>
            </div>

            <h2 className="mt-6 text-xl font-semibold text-[var(--sv-text)]">
              {incomingCall.callerName} is calling…
            </h2>

            <p className="mt-1.5 font-mono text-sm tracking-wider text-[var(--sv-muted)]">
              {incomingCall.callerNumber}
            </p>

            <div className="mt-8 flex gap-3">

              <button
                data-testid="reject-call-btn"
                onClick={rejectCall}
                className="flex-1 rounded-2xl bg-[#EF1D1D] py-3.5 font-semibold text-white transition hover:bg-[#D61A1A]"
              >
                Reject
              </button>

              <button
                data-testid="accept-call-btn"
                onClick={acceptCall}
                className="flex-1 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 py-3.5 font-semibold text-emerald-300 transition hover:bg-emerald-400/20"
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