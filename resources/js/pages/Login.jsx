// web/src/pages/Login.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import OtpInput from '../components/ui/OtpInput';
import {
  AlertCircle,
  UserCog,
  UserCheck,
  Wrench,
  GraduationCap,
  ShieldCheck,
  Mail,
  ArrowLeft,
  RefreshCw,
  Loader2,
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

    // Enforcer / role without OTP — straight in
    if (result.success) {
      navigate('/');
      return;
    }

    // Admin/staff — move to step 2
    if (result.requiresOtp) {
      setChallengeId(result.challengeId);
      setMaskedEmail(result.maskedEmail);
      setOtp('');
      setOtpError('');
      setStep('otp');
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
      return;
    }

    // Failure
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
    // Clear the boxes so the user can retype
    setOtp('');
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;

    setOtpError('');
    setOtpSubmitting(true);

    // Re-submit the same credentials — the server reissues a fresh code
    // and invalidates the previous one.
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

  const fillDemoCredentials = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  };

  const demoAccounts = [
    {
      role: 'Admin',
      email: 'occ.balasabas.johnpaul@gmail.com',
      password: 'password123',
      icon: UserCog,
      description: 'Full access to all features',
      accent: '#16233F',
      tint: '#E9ECF2',
    },
    {
      role: 'Staff',
      email: 'luiskarlcons@gmail.com',
      password: 'password123',
      icon: UserCheck,
      description: 'View-only access',
      accent: '#92600A',
      tint: '#FBF1DC',
    },
  ];

  const pillars = [
    { label: 'Engineering', icon: Wrench },
    { label: 'Education', icon: GraduationCap },
    { label: 'Enforcement', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen flex bg-[#F5F6F8]">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[44%] relative bg-[#16233F] flex-col justify-between overflow-hidden">
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
            className="w-36 h-36 mb-8"
          />
          <p className="uppercase tracking-[0.35em] text-xs text-[#F0B429] font-['Inter'] mb-3">
            City of El Salvador
          </p>
          <h1 className="text-6xl font-['Oswald'] font-semibold text-white tracking-tight mb-4">
            TEMU
          </h1>
          <p className="text-[#C7CEDB] font-['Inter'] max-w-xs leading-relaxed">
            Traffic Enforcement and Management Unit
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-3 border-t border-white/10">
          {pillars.map((p, i) => (
            <div
              key={p.label}
              className={`flex flex-col items-center gap-2 py-6 ${i < 2 ? 'border-r border-white/10' : ''}`}
            >
              <p.icon className="w-5 h-5 text-[#F0B429]" />
              <span className="text-[11px] uppercase tracking-wider text-[#C7CEDB] font-['Inter']">
                {p.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobile-only brand header */}
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <img
              src={temuLogo}
              alt="City of El Salvador Seal"
              className="w-20 h-20 mb-3"
            />
            <h1 className="text-3xl font-['Oswald'] font-semibold text-[#16233F]">
              TEMU
            </h1>
            <p className="text-sm text-[#64748B] font-['Inter']">
              Traffic Enforcement and Management Unit
            </p>
          </div>

          {step === 'credentials' ? (
            /* ==================== STEP 1 ==================== */
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-['Oswald'] font-medium text-[#1F2937]">
                  Sign in
                </h2>
                <p className="text-sm text-[#64748B] font-['Inter'] mt-1">
                  Enter your credentials to access the system.
                </p>
              </div>

              <form onSubmit={handleSubmitCredentials} className="space-y-4">
                {error && (
                  <div className="bg-[#FBE7E9] text-[#C8202F] p-3 rounded-md flex items-center gap-2 text-sm border border-[#F3C6CA]">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-1 block text-[#1F2937] font-['Inter']">
                    Email address
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@temu.gov.ph"
                    required
                    className="w-full focus-visible:ring-[#F0B429]"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
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
                    className="w-full focus-visible:ring-[#F0B429]"
                    autoComplete="current-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#1E8449] hover:bg-[#186B3B] text-white font-['Inter'] font-medium"
                  disabled={loading}
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>

              <div className="space-y-3 mt-8">
                {demoAccounts.map((demo) => (
                  <button
                    key={demo.role}
                    type="button"
                    onClick={() =>
                      fillDemoCredentials(demo.email, demo.password)
                    }
                    className="w-full p-4 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all duration-150 text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="p-2 rounded-lg flex-shrink-0"
                        style={{ backgroundColor: demo.tint, color: demo.accent }}
                      >
                        <demo.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3
                            className="font-semibold font-['Inter']"
                            style={{ color: demo.accent }}
                          >
                            {demo.role}
                          </h3>
                          <span className="text-xs text-gray-400 group-hover:text-gray-600 font-['Inter']">
                            Use this →
                          </span>
                        </div>
                        <p className="text-xs text-[#64748B] font-['Inter'] mt-0.5">
                          {demo.description}
                        </p>
                        <div className="mt-1.5 text-xs font-['JetBrains_Mono'] text-[#64748B]">
                          {demo.email}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
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
                <div className="w-12 h-12 rounded-full bg-[#FBF1DC] border border-[#F0B429]/40 flex items-center justify-center mb-4">
                  <Mail className="w-6 h-6 text-[#92600A]" />
                </div>
                <h2 className="text-2xl font-['Oswald'] font-medium text-[#1F2937]">
                  Check your email
                </h2>
                <p className="text-sm text-[#64748B] font-['Inter'] mt-1 leading-relaxed">
                  We sent a 6-digit verification code to{' '}
                  <span className="font-medium text-[#16233F]">
                    {maskedEmail}
                  </span>
                  . Enter it below to finish signing in.
                </p>
              </div>

              {otpError && (
                <div className="bg-[#FBE7E9] text-[#C8202F] p-3 rounded-md flex items-center gap-2 text-sm border border-[#F3C6CA] mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{otpError}</span>
                </div>
              )}

              <div className="mb-6">
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
                className="w-full bg-[#1E8449] hover:bg-[#186B3B] text-white font-['Inter'] font-medium"
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

              <div className="mt-8 p-3 rounded-lg bg-[#F8F9FA] border border-[#E9ECF2]">
                <p className="text-xs text-[#64748B] font-['Inter'] leading-relaxed">
                  <strong className="text-[#1F2937]">Didn&apos;t receive it?</strong>{' '}
                  Check your spam folder. If it still doesn&apos;t arrive, verify
                  the email address is correct or contact an administrator.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;