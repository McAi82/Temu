// web/src/pages/ForgotPassword.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import OtpInput from '../components/ui/OtpInput';
import {
  requestPasswordReset,
  verifyPasswordReset,
} from '../services/api';
import {
  AlertCircle,
  CheckCircle,
  Mail,
  ArrowLeft,
  KeyRound,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import temuLogo from '../assets/temu-logo.png';

const RESEND_COOLDOWN_SECONDS = 45;

const ForgotPassword = () => {
  const navigate = useNavigate();

  /* ---------------- Step 1 — request ---------------- */
  const [email, setEmail] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState('');

  /* ---------------- Step 2 — verify + new password ---------------- */
  const [step, setStep] = useState('request'); // 'request' | 'verify' | 'success'
  const [challengeId, setChallengeId] = useState(null);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownTimerRef = useRef(null);

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

  /* ---------------- Step 1 handler ---------------- */
  const handleRequest = async (e) => {
    e.preventDefault();
    setRequestError('');

    if (!email.trim()) {
      setRequestError('Please enter your email address.');
      return;
    }

    setRequesting(true);

    try {
      const response = await requestPasswordReset(email.trim());
      const data = response.data || {};

      setChallengeId(data.challenge_id);
      setMaskedEmail(data.masked_email || email.trim());
      setOtp('');
      setPassword('');
      setPasswordConfirm('');
      setVerifyError('');
      setStep('verify');
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setRequestError(
        error.response?.data?.message ||
          'Could not send the reset code. Please try again.',
      );
    } finally {
      setRequesting(false);
    }
  };

  /* ---------------- Step 2 handler ---------------- */
  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifyError('');

    if (otp.length !== 6) {
      setVerifyError('Please enter the 6-digit code from your email.');
      return;
    }

    if (password.length < 8) {
      setVerifyError('Password must be at least 8 characters.');
      return;
    }

    if (password !== passwordConfirm) {
      setVerifyError('Passwords do not match.');
      return;
    }

    setVerifying(true);

    try {
      await verifyPasswordReset(challengeId, otp, password, passwordConfirm);
      setStep('success');
    } catch (error) {
      setVerifyError(
        error.response?.data?.message ||
          'Could not reset your password. Please try again.',
      );
      // Clear the OTP on failure so they can retype
      setOtp('');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;

    setVerifyError('');
    setRequesting(true);

    try {
      const response = await requestPasswordReset(email.trim());
      const data = response.data || {};
      setChallengeId(data.challenge_id);
      setMaskedEmail(data.masked_email || email.trim());
      setOtp('');
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setVerifyError(
        error.response?.data?.message || 'Could not resend the code.',
      );
    } finally {
      setRequesting(false);
    }
  };

  const handleBackToRequest = () => {
    setStep('request');
    setChallengeId(null);
    setOtp('');
    setPassword('');
    setPasswordConfirm('');
    setVerifyError('');
    setResendCountdown(0);
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

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
            className="w-32 h-32 mb-6"
          />
          <p className="uppercase tracking-[0.35em] text-xs text-[#F0B429] font-['Inter'] mb-3">
            City of El Salvador
          </p>
          <h1 className="text-5xl font-['Oswald'] font-semibold text-white tracking-tight mb-4">
            TEMU
          </h1>
          <p className="text-[#C7CEDB] font-['Inter'] max-w-xs leading-relaxed">
            Password recovery is protected by a one-time code sent to your
            registered email address.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <img
              src={temuLogo}
              alt="City of El Salvador Seal"
              className="w-20 h-20 mb-3"
            />
            <h1 className="text-3xl font-['Oswald'] font-semibold text-[#16233F]">
              TEMU
            </h1>
          </div>

          {step === 'request' && (
            <>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#16233F] mb-6 font-['Inter']"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </Link>

              <div className="mb-8">
                <h2 className="text-2xl font-['Oswald'] font-medium text-[#1F2937]">
                  Reset your password
                </h2>
                <p className="text-sm text-[#64748B] font-['Inter'] mt-1">
                  Enter your account email and we&apos;ll send you a 6-digit
                  reset code.
                </p>
              </div>

              <form onSubmit={handleRequest} className="space-y-4">
                {requestError && (
                  <div className="bg-[#FBE7E9] text-[#C8202F] p-3 rounded-md flex items-center gap-2 text-sm border border-[#F3C6CA]">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{requestError}</span>
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
                    autoFocus
                    className="w-full focus-visible:ring-[#F0B429]"
                    autoComplete="email"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={requesting}
                  className="w-full bg-[#1E8449] hover:bg-[#186B3B] text-white font-['Inter'] font-medium"
                >
                  {requesting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending code…
                    </>
                  ) : (
                    'Send reset code'
                  )}
                </Button>
              </form>

              <p className="text-center text-xs text-[#94A3B8] font-['Inter'] mt-8">
                &copy; {new Date().getFullYear()} TEMU · El Salvador City,
                Philippines
              </p>
            </>
          )}

          {step === 'verify' && (
            <>
              <button
                type="button"
                onClick={handleBackToRequest}
                className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#16233F] mb-6 font-['Inter']"
              >
                <ArrowLeft className="w-4 h-4" />
                Use a different email
              </button>

              <div className="mb-8">
                <div className="w-12 h-12 rounded-full bg-[#FBF1DC] border border-[#F0B429]/40 flex items-center justify-center mb-4">
                  <Mail className="w-6 h-6 text-[#92600A]" />
                </div>
                <h2 className="text-2xl font-['Oswald'] font-medium text-[#1F2937]">
                  Enter your reset code
                </h2>
                <p className="text-sm text-[#64748B] font-['Inter'] mt-1 leading-relaxed">
                  We sent a 6-digit code to{' '}
                  <span className="font-medium text-[#16233F]">
                    {maskedEmail}
                  </span>
                  . Enter it below and choose a new password.
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                {verifyError && (
                  <div className="bg-[#FBE7E9] text-[#C8202F] p-3 rounded-md flex items-center gap-2 text-sm border border-[#F3C6CA]">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{verifyError}</span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-[#1F2937] mb-2 block font-['Inter'] text-center">
                    Verification code
                  </label>
                  <OtpInput
                    length={6}
                    value={otp}
                    onChange={(v) => {
                      setOtp(v);
                      if (verifyError) setVerifyError('');
                    }}
                    disabled={verifying}
                    error={!!verifyError}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block text-[#1F2937] font-['Inter']">
                    New password
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    className="w-full focus-visible:ring-[#F0B429]"
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block text-[#1F2937] font-['Inter']">
                    Confirm new password
                  </label>
                  <Input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Re-enter the new password"
                    required
                    className="w-full focus-visible:ring-[#F0B429]"
                    autoComplete="new-password"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={
                    verifying ||
                    otp.length !== 6 ||
                    !password ||
                    !passwordConfirm
                  }
                  className="w-full bg-[#1E8449] hover:bg-[#186B3B] text-white font-['Inter'] font-medium"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Resetting password…
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4 mr-2" />
                      Reset password
                    </>
                  )}
                </Button>
              </form>

              <div className="flex items-center justify-center mt-6">
                {resendCountdown > 0 ? (
                  <p className="text-xs text-[#94A3B8] font-['Inter']">
                    You can request a new code in{' '}
                    <span className="font-medium text-[#64748B]">
                      {resendCountdown}s
                    </span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={requesting}
                    className="flex items-center gap-1.5 text-xs text-[#2563EB] hover:text-[#1D4ED8] font-['Inter'] font-medium disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Resend code
                  </button>
                )}
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#E5F2EA] border border-[#1E8449]/30 flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-8 h-8 text-[#1E8449]" />
              </div>
              <h2 className="text-2xl font-['Oswald'] font-medium text-[#1F2937] mb-2">
                Password reset
              </h2>
              <p className="text-sm text-[#64748B] font-['Inter'] mb-6 leading-relaxed">
                Your password has been updated and all other sessions have been
                signed out. You can now sign in with your new password.
              </p>
              <Button
                onClick={() => navigate('/login')}
                className="w-full bg-[#1E8449] hover:bg-[#186B3B] text-white font-['Inter'] font-medium"
              >
                Go to sign in
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;