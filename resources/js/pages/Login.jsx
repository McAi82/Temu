// web/src/pages/Login.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
} from 'lucide-react';
import temuLogo from '../assets/temu-logo.png';

const RESEND_COOLDOWN_SECONDS = 45;

const Login = () => {
  const navigate = useNavigate();
  const { beginLogin, completeLogin } = useAuth();

  /* ---------------- Step 1 state ---------------- */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /* ---------------- Step 2 state ---------------- */
  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [challengeId, setChallengeId] = useState(null);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownTimerRef = useRef(null);

  /* ---------------- Countdown timer for resend ---------------- */
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

  /* ---------------- Cleanup on unmount ---------------- */
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  /* ==================== STEP 1 — Credentials ==================== */
  const handleSubmitCredentials = async (e) => {
    e.preventDefault();
    setError('');
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

  return (
    <div className="min-h-screen flex bg-[#F5F6F8]">
      {/* ---------------- Left brand panel ---------------- */}
      <div className="hidden lg:flex lg:w-[46%] relative bg-[#16233F] flex-col justify-between overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(115deg, transparent, transparent 70px, #F0B429 70px, #F0B429 72px)',
          }}
        />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-12 text-center">
          <img
            src={temuLogo}
            alt="City of El Salvador Seal"
            className="w-40 h-40 mb-8 drop-shadow-lg"
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
              className={`flex flex-col items-center gap-2 py-6 ${i < 2 ? 'border-r border-white/10' : ''
                }`}
            >
              <p.icon className="w-5 h-5 text-[#F0B429]" />
              <span className="text-[11px] uppercase tracking-wider text-[#C7CEDB] font-['Inter']">
                {p.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- Right form panel ---------------- */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobile brand header */}
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

          {step === 'credentials' ? (
            /* ==================== STEP 1 ==================== */
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-['Oswald'] font-semibold text-[#1F2937] tracking-tight">
                  Sign in
                </h2>
                <p className="text-sm text-[#64748B] font-['Inter'] mt-2 leading-relaxed">
                  Enter your credentials to access the TEMU dashboard.
                </p>
              </div>

              <form onSubmit={handleSubmitCredentials} className="space-y-5">
                {error && (
                  <div className="bg-[#FBE7E9] text-[#C8202F] p-3.5 rounded-lg flex items-start gap-2.5 text-sm border-l-4 border-[#C8202F]">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{error}</span>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-2 block text-[#1F2937] font-['Inter']">
                    Email address
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@temu.gov.ph"
                    required
                    autoFocus
                    autoComplete="email"
                    className="w-full h-11 focus-visible:ring-[#F0B429]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-[#1F2937] font-['Inter']">
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-['Inter'] font-medium"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full h-11 focus-visible:ring-[#F0B429]"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-[#1E8449] hover:bg-[#186B3B] text-white font-['Inter'] font-semibold text-sm"
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
            </>
          ) : (
            /* ==================== STEP 2 ==================== */
            <>
              <button
                type="button"
                onClick={handleBackToCredentials}
                className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#16233F] mb-6 font-['Inter']"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </button>

              <div className="mb-8">
                <div className="w-14 h-14 rounded-full bg-[#FBF1DC] border border-[#F0B429]/40 flex items-center justify-center mb-5">
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
                <div className="bg-[#FBE7E9] text-[#C8202F] p-3.5 rounded-lg flex items-start gap-2.5 text-sm border-l-4 border-[#C8202F] mb-5">
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
                className="w-full h-11 bg-[#1E8449] hover:bg-[#186B3B] text-white font-['Inter'] font-semibold text-sm"
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
                    <span className="font-medium text-[#64748B]">
                      {resendCountdown}s
                    </span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={otpSubmitting}
                    className="flex items-center gap-1.5 text-xs text-[#2563EB] hover:text-[#1D4ED8] font-['Inter'] font-medium disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Resend code
                  </button>
                )}
              </div>

              <div className="mt-8 p-4 rounded-lg bg-[#F8F9FA] border border-[#E9ECF2]">
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;