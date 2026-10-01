// web/src/pages/Login.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import OtpInput from '../components/ui/OtpInput';
import {
  AlertCircle,
  Mail,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Lock,
  Wrench,
  GraduationCap,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';
import temuLogo from '../assets/temu-logo.png';

const RESEND_COOLDOWN_SECONDS = 45;

/* ============================================================
 |  Validation helpers
 | ============================================================ */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (v) => {
  if (!v) return 'Email is required.';
  if (!EMAIL_RE.test(v.trim())) return 'Please enter a valid email address.';
  return null;
};

const validatePassword = (v) => {
  if (!v) return 'Password is required.';
  return null;
};

/* ============================================================
 |  Floating-label input
 |
 |  `revealed` is driven by the parent so the eye toggle works.
 |  (Before: this component had its own internal `show` state
 |   and the parent's toggle had no effect on the input's type.)
 | ============================================================ */
const FloatingInput = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  icon: Icon,
  autoComplete,
  autoFocus,
  disabled,
  rightSlot,
  revealed = false,
}) => {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const isPassword = type === 'password';
  const actualType = isPassword && revealed ? 'text' : type;

  const filled = value !== '' && value != null;
  const active = focused || filled;
  const hasError = !!error;

  const borderClass = hasError
    ? 'border-[#C8202F] focus-within:ring-[#C8202F]/20'
    : focused
      ? 'border-[#F0B429] focus-within:ring-[#F0B429]/20'
      : 'border-[#E2E8F0] hover:border-[#CBD5E1] focus-within:ring-[#F0B429]/20';

  return (
    <div className="w-full">
      <div
        className={`relative flex items-center w-full h-14 rounded-xl border-2 bg-white transition-all duration-200 ${borderClass} focus-within:ring-4`}
        onClick={() => inputRef.current?.focus()}
      >
        {Icon && (
          <div className="pl-4 pr-2 text-[#94A3B8] flex-shrink-0 pointer-events-none">
            <Icon className="w-5 h-5" />
          </div>
        )}
        {!Icon && <div className="pl-4" />}

        <div className="relative flex-1 h-full">
          <label
            htmlFor={id}
            className={`absolute left-0 pointer-events-none font-['Inter'] transition-all duration-200 origin-left ${active
                ? 'top-2 text-[11px] font-medium text-[#64748B] tracking-wide uppercase'
                : 'top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]'
              }`}
          >
            {label}
          </label>
          <input
            ref={inputRef}
            id={id}
            type={actualType}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e.target.value);
            }}
            autoComplete={autoComplete}
            autoFocus={autoFocus}
            disabled={disabled}
            spellCheck={false}
            className={`w-full h-full bg-transparent outline-none text-[15px] text-[#1F2937] font-['Inter'] pt-5 pb-1 ${disabled ? 'opacity-60 cursor-not-allowed' : ''
              }`}
          />
        </div>

        {rightSlot && (
          <div className="pr-3 pl-1 flex-shrink-0 flex items-center">
            {rightSlot}
          </div>
        )}
        {!rightSlot && <div className="pr-4" />}
      </div>

      <div className="min-h-[18px] mt-1 px-1">
        {error && (
          <p className="text-xs text-[#C8202F] font-['Inter'] flex items-center gap-1">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

/* ============================================================
 |  Password visibility toggle
 | ============================================================ */
const PasswordToggle = ({ shown, onToggle, disabled }) => (
  <button
    type="button"
    tabIndex={-1}
    onClick={(e) => {
      e.stopPropagation();
      onToggle();
    }}
    disabled={disabled}
    aria-label={shown ? 'Hide password' : 'Show password'}
    className="p-1.5 rounded-md text-[#94A3B8] hover:text-[#16233F] hover:bg-[#F1F5F9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
  >
    {shown ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
  </button>
);

/* ============================================================
 |  Login page
 | ============================================================ */
const Login = () => {
  const navigate = useNavigate();
  const { beginLogin, completeLogin } = useAuth();

  /* ---- Step 1 state ---- */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [capsLock, setCapsLock] = useState(false);
  const [shake, setShake] = useState(false);

  /* ---- Step 2 state ---- */
  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [challengeId, setChallengeId] = useState(null);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownTimerRef = useRef(null);

  /* ---- Derived validation ---- */
  const emailError = touchedEmail ? validateEmail(email) : null;
  const passwordError = touchedPassword ? validatePassword(password) : null;

  /* ---- Caps Lock detection ---- */
  const handleKeyEvent = (e) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLock(e.getModifierState('CapsLock'));
    }
  };

  /* ---- Countdown timer ---- */
  useEffect(() => {
    if (resendCountdown <= 0) {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      return;
    }

    countdownTimerRef.current = setInterval(() => {
      setResendCountdown((s) => {
        if (s <= 1) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [resendCountdown]);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  /* ---- Shake animation ---- */
  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  /* ==================== STEP 1 — Credentials ==================== */
  const handleSubmitCredentials = async (e) => {
    e.preventDefault();
    setError('');

    setTouchedEmail(true);
    setTouchedPassword(true);

    const eErr = validateEmail(email);
    const pErr = validatePassword(password);

    if (eErr || pErr) {
      triggerShake();
      return;
    }

    setLoading(true);
    const result = await beginLogin(email, password);
    setLoading(false);

    if (result.success) {
      navigate('/');
      return;
    }

    if (result.requiresOtp) {
      setChallengeId(result.challengeId);
      setMaskedEmail(result.maskedEmail);
      setOtp('');
      setOtpError('');
      setStep('otp');
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
      return;
    }

    setError(result.error || 'Login failed.');
    triggerShake();
  };

  /* ==================== STEP 2 — OTP ==================== */
  const handleVerifyOtp = async (codeFromInput) => {
    const code = codeFromInput || otp;
    if (!code || code.length !== 6) {
      setOtpError('Please enter the 6-digit code.');
      return;
    }

    setOtpError('');
    setOtpSubmitting(true);

    const result = await completeLogin(challengeId, code);

    setOtpSubmitting(false);

    if (result.success) {
      navigate('/');
      return;
    }

    setOtpError(result.error || 'Could not verify the code.');
    setOtp('');
    triggerShake();
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;

    setOtpError('');
    setOtpSubmitting(true);

    const result = await beginLogin(email, password);

    setOtpSubmitting(false);

    if (result.requiresOtp) {
      setChallengeId(result.challengeId);
      setMaskedEmail(result.maskedEmail);
      setOtp('');
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
      return;
    }

    if (result.success) {
      navigate('/');
      return;
    }

    setOtpError(result.error || 'Could not resend the code.');
  };

  const handleBackToCredentials = () => {
    setStep('credentials');
    setChallengeId(null);
    setOtp('');
    setOtpError('');
    setResendCountdown(0);
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  const pillars = [
    { label: 'Engineering', icon: Wrench },
    { label: 'Education', icon: GraduationCap },
    { label: 'Enforcement', icon: ShieldCheck },
  ];

  /* ================================================================ */
  return (
    <div className="min-h-screen flex bg-[#F5F6F8] overflow-hidden">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-6px); }
          40%, 60% { transform: translateX(6px); }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0) translateX(0); }
          50%      { transform: translateY(-24px) translateX(12px); }
        }
        @keyframes floatSlower {
          0%, 100% { transform: translateY(0) translateX(0); }
          50%      { transform: translateY(20px) translateX(-16px); }
        }
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-shake { animation: shake 400ms ease-in-out; }
        .animate-slide-up { animation: slideUpFade 320ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .float-a { animation: floatSlow 9s ease-in-out infinite; }
        .float-b { animation: floatSlower 11s ease-in-out infinite; }
      `}</style>

      {/* ---------------- Left brand panel ---------------- */}
      <div className="hidden lg:flex lg:w-[46%] relative bg-[#16233F] flex-col justify-between overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(115deg, transparent, transparent 70px, #F0B429 70px, #F0B429 72px)',
          }}
        />

        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-[#F0B429]/10 blur-3xl float-a" />
          <div className="absolute bottom-10 right-0 w-80 h-80 rounded-full bg-[#1E8449]/10 blur-3xl float-b" />
          <div className="absolute top-1/2 left-1/3 w-40 h-40 rounded-full bg-white/5 blur-2xl float-a" />
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-12 text-center">
          <img
            src={temuLogo}
            alt="City of El Salvador Seal"
            className="w-40 h-40 mb-8 drop-shadow-lg animate-[floatSlow_7s_ease-in-out_infinite]"
          />
          <p className="uppercase tracking-[0.4em] text-[11px] text-[#F0B429] font-['Inter'] font-medium mb-4">
            City of El Salvador
          </p>
          <h1 className="text-6xl font-['Oswald'] font-semibold text-white tracking-tight mb-4">
            TEMU
          </h1>
          <p className="text-[#C7CEDB] font-['Inter'] max-w-xs leading-relaxed text-sm">
            Traffic Enforcement and Management Unit
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 border-t border-white/10">
          {pillars.map((p, i) => (
            <div
              key={p.label}
              className={`flex flex-col items-center gap-2 py-6 group transition-colors hover:bg-white/5 ${i < 2 ? 'border-r border-white/10' : ''
                }`}
            >
              <p.icon className="w-5 h-5 text-[#F0B429] transition-transform duration-300 group-hover:scale-110" />
              <span className="text-[11px] uppercase tracking-wider text-[#C7CEDB] font-['Inter']">
                {p.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- Right form panel ---------------- */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        <div className="lg:hidden absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[#F0B429]/8 blur-3xl float-a" />
          <div className="absolute bottom-0 -left-20 w-72 h-72 rounded-full bg-[#16233F]/8 blur-3xl float-b" />
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <img
              src={temuLogo}
              alt="City of El Salvador Seal"
              className="w-24 h-24 mb-4"
            />
            <h1 className="text-3xl font-['Oswald'] font-semibold text-[#16233F]">
              TEMU
            </h1>
            <p className="text-sm text-[#64748B] font-['Inter'] mt-1">
              Traffic Enforcement and Management Unit
            </p>
          </div>

          {/* ==================== CREDENTIALS STEP ==================== */}
          {step === 'credentials' && (
            <div
              key="credentials"
              className={`animate-slide-up ${shake ? 'animate-shake' : ''}`}
            >
              <div className="mb-8">
                <h2 className="text-3xl font-['Oswald'] font-semibold text-[#1F2937] tracking-tight">
                  Sign in
                </h2>
                <p className="text-sm text-[#64748B] font-['Inter'] mt-2 leading-relaxed">
                  Enter your credentials to access the TEMU dashboard.
                </p>
              </div>

              <form onSubmit={handleSubmitCredentials} className="space-y-3">
                {error && (
                  <div className="bg-[#FBE7E9] text-[#C8202F] p-3.5 rounded-lg flex items-start gap-2.5 text-sm border-l-4 border-[#C8202F] animate-slide-up">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{error}</span>
                  </div>
                )}

                <FloatingInput
                  id="email"
                  label="Email address"
                  type="email"
                  icon={Mail}
                  value={email}
                  onChange={(v) => {
                    setEmail(v);
                    if (error) setError('');
                  }}
                  onBlur={() => setTouchedEmail(true)}
                  error={emailError}
                  autoComplete="email"
                  autoFocus
                  disabled={loading}
                />

                <FloatingInput
                  id="password"
                  label="Password"
                  type="password"
                  icon={Lock}
                  value={password}
                  onChange={(v) => {
                    setPassword(v);
                    if (error) setError('');
                  }}
                  onBlur={() => setTouchedPassword(true)}
                  error={passwordError}
                  autoComplete="current-password"
                  disabled={loading}
                  revealed={showPassword}
                  rightSlot={
                    <PasswordToggle
                      shown={showPassword}
                      onToggle={() => setShowPassword((s) => !s)}
                      disabled={loading}
                    />
                  }
                />

                {capsLock && (
                  <div className="flex items-center gap-2 text-xs text-[#92600A] bg-[#FBF1DC] px-3 py-2 rounded-lg border border-[#F0B429]/30 animate-slide-up">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Caps Lock is on</span>
                  </div>
                )}

                <div className="hidden">
                  <input
                    type="text"
                    onKeyUp={handleKeyEvent}
                    onKeyDown={handleKeyEvent}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-sm text-[#64748B] font-['Inter'] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-[#CBD5E1] text-[#1E8449] focus:ring-[#F0B429] accent-[#1E8449]"
                    />
                    Remember me
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-['Inter'] font-medium transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 mt-2 bg-[#1E8449] hover:bg-[#186B3B] text-white font-['Inter'] font-semibold text-sm rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#1E8449]/25 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:shadow-none"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </form>

              <div className="mt-8 pt-6 border-t border-[#E9ECF2]">
                <p className="text-xs text-[#94A3B8] font-['Inter'] text-center leading-relaxed">
                  Need help? Contact your system administrator.
                </p>
              </div>

              <p className="text-center text-xs text-[#94A3B8] font-['Inter'] mt-8">
                &copy; {new Date().getFullYear()} TEMU · El Salvador City,
                Philippines
              </p>
            </div>
          )}

          {/* ==================== OTP STEP ==================== */}
          {step === 'otp' && (
            <div
              key="otp"
              className={`animate-slide-up ${shake ? 'animate-shake' : ''}`}
            >
              <button
                type="button"
                onClick={handleBackToCredentials}
                className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#16233F] mb-6 font-['Inter'] transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                Back to sign in
              </button>

              <div className="mb-8">
                <div className="w-14 h-14 rounded-full bg-[#FBF1DC] border border-[#F0B429]/40 flex items-center justify-center mb-5 animate-[floatSlow_6s_ease-in-out_infinite]">
                  <Mail className="w-7 h-7 text-[#92600A]" />
                </div>
                <h2 className="text-3xl font-['Oswald'] font-semibold text-[#1F2937] tracking-tight">
                  Check your email
                </h2>
                <p className="text-sm text-[#64748B] font-['Inter'] mt-2 leading-relaxed">
                  We sent a 6-digit verification code to{' '}
                  <span className="font-medium text-[#16233F]">
                    {maskedEmail}
                  </span>
                  . Enter it below to finish signing in.
                </p>
              </div>

              {otpError && (
                <div className="bg-[#FBE7E9] text-[#C8202F] p-3.5 rounded-lg flex items-start gap-2.5 text-sm border-l-4 border-[#C8202F] mb-5 animate-slide-up">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{otpError}</span>
                </div>
              )}

              <div className="mb-6">
                <label className="text-xs font-medium text-[#1F2937] mb-3 block font-['Inter'] text-center">
                  Verification code
                </label>
                <OtpInput
                  length={6}
                  value={otp}
                  onChange={(v) => {
                    setOtp(v);
                    if (otpError) setOtpError('');
                  }}
                  onComplete={handleVerifyOtp}
                  disabled={otpSubmitting}
                  error={!!otpError}
                />
              </div>

              <Button
                type="button"
                onClick={() => handleVerifyOtp()}
                disabled={otpSubmitting || otp.length !== 6}
                className="w-full h-12 bg-[#1E8449] hover:bg-[#186B3B] text-white font-['Inter'] font-semibold text-sm rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#1E8449]/25 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                {otpSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  'Verify and sign in'
                )}
              </Button>

              <div className="flex items-center justify-center mt-6">
                {resendCountdown > 0 ? (
                  <p className="text-xs text-[#94A3B8] font-['Inter']">
                    Didn&apos;t get the code? You can resend in{' '}
                    <span className="font-medium text-[#64748B] tabular-nums">
                      {resendCountdown}s
                    </span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={otpSubmitting}
                    className="flex items-center gap-1.5 text-xs text-[#2563EB] hover:text-[#1D4ED8] font-['Inter'] font-medium disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Resend code
                  </button>
                )}
              </div>

              <div className="mt-8 p-4 rounded-xl bg-[#F8F9FA] border border-[#E9ECF2]">
                <div className="flex items-start gap-2">
                  <Lock className="w-3.5 h-3.5 text-[#64748B] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#64748B] font-['Inter'] leading-relaxed">
                    <strong className="text-[#1F2937]">
                      Didn&apos;t receive it?
                    </strong>{' '}
                    Check your spam folder. If it still doesn&apos;t arrive,
                    verify the email address is correct or contact an
                    administrator.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;