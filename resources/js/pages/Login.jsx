// web/src/pages/Login.jsx  — redesigned: the traffic signal reacts to the form
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import OtpInput from '../components/ui/OtpInput';
import {
  AlertCircle, Mail, ArrowLeft, RefreshCw, Loader2, Lock, Eye, EyeOff, AlertTriangle, Wrench, GraduationCap, ShieldCheck,
} from 'lucide-react';
import temuLogo from '../assets/temu-logo.png';

const RESEND_COOLDOWN_SECONDS = 45;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validateEmail = (v) => (!v ? 'Email is required.' : !EMAIL_RE.test(v.trim()) ? 'Please enter a valid email address.' : null);
const validatePassword = (v) => (!v ? 'Password is required.' : null);

/* ---------- Floating-label input ---------- */
const Field = ({ id, label, type = 'text', value, onChange, onBlur, error, icon: Icon, autoComplete, autoFocus, disabled, rightSlot, revealed, onKey }) => {
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  const active = focused || (value !== '' && value != null);
  const ring = error ? 'border-[#C8202F]' : focused ? 'border-[#16233F] shadow-[0_0_0_4px_rgba(240,180,41,.35)]' : 'border-[#D5DAE3] hover:border-[#94A3B8]';
  return (
    <div>
      <div onClick={() => ref.current?.focus()} className={`relative flex items-center h-14 rounded-md border-2 bg-white transition-all duration-200 ${ring}`}>
        <Icon className={`ml-4 mr-2 w-5 h-5 shrink-0 transition-colors ${focused ? 'text-[#16233F]' : 'text-[#94A3B8]'}`} />
        <div className="relative flex-1 h-full">
          <label htmlFor={id} className={`absolute left-0 pointer-events-none transition-all duration-200 font-['Inter'] ${active ? 'top-2 text-[11px] font-medium text-[#64748B]' : 'top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]'}`}>{label}</label>
          <input ref={ref} id={id} type={type === 'password' && revealed ? 'text' : type} value={value}
            onChange={(e) => onChange(e.target.value)} onFocus={() => setFocused(true)}
            onBlur={(e) => { setFocused(false); onBlur?.(e.target.value); }}
            onKeyUp={onKey} onKeyDown={onKey}
            autoComplete={autoComplete} autoFocus={autoFocus} disabled={disabled} spellCheck={false}
            className="w-full h-full bg-transparent outline-none text-[15px] text-[#1F2937] font-['Inter'] pt-5 pb-1 disabled:opacity-60" />
        </div>
        <div className="pr-3 pl-1">{rightSlot}</div>
      </div>
      <div className="min-h-[20px] mt-1 px-1">
        {error && <p className="text-xs text-[#C8202F] font-['Inter'] flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
      </div>
    </div>
  );
};

/* ---------- The signal: red = not ready, amber = working, green = clear to go ---------- */
const SIGNAL = {
  stop: { lamp: 0, text: 'Hold. Fill in your credentials.' },
  wait: { lamp: 1, text: 'Checking your clearance…' },
  go: { lamp: 2, text: 'Clear to proceed.' },
  fail: { lamp: 0, text: 'Access denied. Check and try again.' },
};
const Signal = ({ state }) => {
  const s = SIGNAL[state];
  const lamps = ['#E5394A', '#F0B429', '#2FB365'];
  return (
    <>
      {lamps.map((c, i) => {
        const on = s.lamp === i;
        return (
          <div key={c} className={`w-12 h-12 md:w-16 md:h-16 rounded-full transition-all duration-500 ${on && (state === 'wait' || state === 'fail') ? 'sig-pulse' : ''}`}
            style={{ background: on ? c : '#1B2742', boxShadow: on ? `0 0 34px 6px ${c}88, inset 0 -6px 12px #0003` : 'inset 0 4px 10px #0008' }} />
        );
      })}
      <p className="sr-only" aria-live="polite">{s.text}</p>
    </>
  );
};

const PILLARS = [
  { label: 'Engineering', icon: Wrench, text: 'Road design, signage and signals that make safe driving the easy choice.' },
  { label: 'Education', icon: GraduationCap, text: 'Campaigns and licensing programs that teach drivers the rules before they break them.' },
  { label: 'Enforcement', icon: ShieldCheck, text: 'Ticketing, collection and case handling, which is what this dashboard manages.' },
];

const Login = () => {
  const navigate = useNavigate();
  const { beginLogin, completeLogin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [capsLock, setCapsLock] = useState(false);
  const [shake, setShake] = useState(false);

  const [step, setStep] = useState('credentials');
  const [challengeId, setChallengeId] = useState(null);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const timerRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [pillar, setPillar] = useState(null);

  const emailError = touchedEmail ? validateEmail(email) : null;
  const passwordError = touchedPassword ? validatePassword(password) : null;

  const signalState = error || otpError ? 'fail'
    : loading || otpSubmitting ? 'wait'
    : step === 'otp' ? (otp.length === 6 ? 'go' : 'wait')
    : !validateEmail(email) && password ? 'go' : 'stop';

  const handleKeyEvent = (e) => {
    if (typeof e.getModifierState === 'function') setCapsLock(e.getModifierState('CapsLock'));
  };

  useEffect(() => {
    if (resendCountdown <= 0) return;
    timerRef.current = setInterval(() => setResendCountdown((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(timerRef.current);
  }, [resendCountdown > 0]); // eslint-disable-line

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 400); };

  const handleSubmitCredentials = async (e) => {
    e.preventDefault();
    setError('');
    setTouchedEmail(true); setTouchedPassword(true);
    if (validateEmail(email) || validatePassword(password)) { triggerShake(); return; }
    setLoading(true);
    const result = await beginLogin(email, password);
    setLoading(false);
    if (result.success) return navigate('/');
    if (result.requiresOtp) {
      setChallengeId(result.challengeId); setMaskedEmail(result.maskedEmail);
      setOtp(''); setOtpError(''); setStep('otp'); setResendCountdown(RESEND_COOLDOWN_SECONDS);
      return;
    }
    setError(result.error || 'Login failed.');
    triggerShake();
  };

  const handleVerifyOtp = async (codeFromInput) => {
    const code = codeFromInput || otp;
    if (!code || code.length !== 6) { setOtpError('Please enter the 6-digit code.'); return; }
    setOtpError(''); setOtpSubmitting(true);
    const result = await completeLogin(challengeId, code);
    setOtpSubmitting(false);
    if (result.success) return navigate('/');
    setOtpError(result.error || 'Could not verify the code.');
    setOtp(''); triggerShake();
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setOtpError(''); setOtpSubmitting(true);
    const result = await beginLogin(email, password);
    setOtpSubmitting(false);
    if (result.requiresOtp) {
      setChallengeId(result.challengeId); setMaskedEmail(result.maskedEmail);
      setOtp(''); setResendCountdown(RESEND_COOLDOWN_SECONDS);
      return;
    }
    if (result.success) return navigate('/');
    setOtpError(result.error || 'Could not resend the code.');
  };

  const handleBack = () => {
    setStep('credentials'); setChallengeId(null); setOtp(''); setOtpError(''); setResendCountdown(0);
  };

  const btn = "w-full h-12 bg-[#16233F] hover:bg-[#1E3158] text-white font-['Inter'] font-semibold text-sm rounded-md transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className="min-h-screen flex flex-col bg-[#16233F] relative overflow-hidden"
      onMouseMove={(e) => setTilt({ x: (e.clientX / window.innerWidth - 0.5) * 2, y: (e.clientY / window.innerHeight - 0.5) * 2 })}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}>
      <style>{`
        @keyframes shake { 10%,90%{transform:translateX(-2px)} 20%,80%{transform:translateX(4px)} 30%,50%,70%{transform:translateX(-6px)} 40%,60%{transform:translateX(6px)} }
        @keyframes sigPulse { 50% { opacity: .35; } }
        @keyframes rise { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:none} }
        @keyframes laneX { to { background-position-x: 96px; } }
        .lane-x { background-image: repeating-linear-gradient(to right, #F0B429 0 48px, transparent 48px 96px); animation: laneX 1.6s linear infinite; }
        .sig-pulse { animation: sigPulse .9s ease-in-out infinite; }
        .step-in { animation: rise 320ms cubic-bezier(.16,1,.3,1) both; }
        .do-shake { animation: shake 400ms ease-in-out; }
        @media (prefers-reduced-motion: reduce) { .lane-x,.sig-pulse,.step-in,.do-shake { animation: none; } }
      `}</style>
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(115deg, transparent, transparent 70px, #F0B429 70px, #F0B429 72px)' }} />

      {/* Brand bar */}
      <header className="relative z-10 flex items-center gap-4 px-6 sm:px-10 py-5">
        <img src={temuLogo} alt="City of El Salvador Seal" className="w-14 h-14 drop-shadow-lg" />
        <div>
          <p className="uppercase tracking-[0.35em] text-[10px] text-[#F0B429] font-['Inter'] font-medium">City of El Salvador</p>
          <h1 className="text-3xl font-['Oswald'] font-semibold text-white leading-none mt-1">TEMU</h1>
          <p className="text-[#C7CEDB] text-xs font-['Inter'] mt-1">Traffic Enforcement and Management Unit</p>
        </div>
      </header>

      {/* Signal-and-form card, leaning toward the cursor */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-3xl flex flex-col md:flex-row rounded-2xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,.45)] transition-transform duration-200 ease-out"
          style={{ transform: `perspective(1400px) rotateY(${tilt.x * 2.5}deg) rotateX(${tilt.y * -2}deg)` }}>
          <div className="bg-[#0C1427] md:w-40 flex md:flex-col items-center justify-center gap-4 p-5 md:py-10" role="img" aria-label="Sign-in status signal">
            <Signal state={signalState} />
          </div>
          <div className="flex-1 bg-[#F5F6F8] p-7 sm:p-10">
            {step === 'credentials' && (
            <div key="c" className={`step-in ${shake ? 'do-shake' : ''}`}>
              <h2 className="text-4xl font-['Oswald'] font-semibold text-[#16233F] tracking-tight">Sign in</h2>
              <p className="text-sm text-[#64748B] font-['Inter'] mt-2 mb-8">Enter your credentials to access the TEMU dashboard.</p>

              <form onSubmit={handleSubmitCredentials} className="space-y-2">
                {error && (
                  <div className="bg-[#FBE7E9] text-[#C8202F] p-3.5 rounded-md flex gap-2.5 text-sm border-l-4 border-[#C8202F]">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
                  </div>
                )}
                <Field id="email" label="Email address" type="email" icon={Mail} value={email}
                  onChange={(v) => { setEmail(v); if (error) setError(''); }} onBlur={() => setTouchedEmail(true)}
                  error={emailError} autoComplete="email" autoFocus disabled={loading} />
                <Field id="password" label="Password" type="password" icon={Lock} value={password}
                  onChange={(v) => { setPassword(v); if (error) setError(''); }} onBlur={() => setTouchedPassword(true)}
                  error={passwordError} autoComplete="current-password" disabled={loading}
                  revealed={showPassword} onKey={handleKeyEvent}
                  rightSlot={
                    <button type="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); setShowPassword((s) => !s); }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="p-1.5 rounded text-[#94A3B8] hover:text-[#16233F] hover:bg-[#F1F5F9] transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  } />
                {capsLock && (
                  <div className="flex items-center gap-2 text-xs text-[#92600A] bg-[#FBF1DC] px-3 py-2 rounded-md border border-[#F0B429]/40">
                    <AlertTriangle className="w-3.5 h-3.5" /><span>Caps Lock is on</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 pb-2">
                  <label className="flex items-center gap-2 text-sm text-[#64748B] font-['Inter'] cursor-pointer select-none">
                    <input type="checkbox" className="w-4 h-4 accent-[#16233F]" /> Remember me
                  </label>
                  <Link to="/forgot-password" className="text-xs text-[#2563EB] hover:underline font-['Inter'] font-medium">Forgot password?</Link>
                </div>
                <Button type="submit" disabled={loading} className={btn}>
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</> : 'Sign in'}
                </Button>
              </form>
              <p className="text-xs text-[#94A3B8] font-['Inter'] mt-8">Need help? Contact your system administrator.</p>
            </div>
          )}

          {step === 'otp' && (
            <div key="o" className={`step-in ${shake ? 'do-shake' : ''}`}>
              <button type="button" onClick={handleBack} className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#16233F] mb-6 font-['Inter'] group">
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />Back to sign in
              </button>
              <div className="w-14 h-14 rounded-full bg-[#FBF1DC] border border-[#F0B429]/40 flex items-center justify-center mb-5"><Mail className="w-7 h-7 text-[#92600A]" /></div>
              <h2 className="text-4xl font-['Oswald'] font-semibold text-[#16233F] tracking-tight">Check your email</h2>
              <p className="text-sm text-[#64748B] font-['Inter'] mt-2 mb-8 leading-relaxed">
                We sent a 6-digit verification code to <span className="font-medium text-[#16233F]">{maskedEmail}</span>. Enter it below to finish signing in.
              </p>
              {otpError && (
                <div className="bg-[#FBE7E9] text-[#C8202F] p-3.5 rounded-md flex gap-2.5 text-sm border-l-4 border-[#C8202F] mb-5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{otpError}</span>
                </div>
              )}
              <div className="mb-6">
                <label className="text-xs font-medium text-[#1F2937] mb-3 block font-['Inter'] text-center">Verification code</label>
                <OtpInput length={6} value={otp} onChange={(v) => { setOtp(v); if (otpError) setOtpError(''); }}
                  onComplete={handleVerifyOtp} disabled={otpSubmitting} error={!!otpError} />
              </div>
              <Button type="button" onClick={() => handleVerifyOtp()} disabled={otpSubmitting || otp.length !== 6} className={btn}>
                {otpSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</> : 'Verify and sign in'}
              </Button>
              <div className="flex justify-center mt-6">
                {resendCountdown > 0 ? (
                  <p className="text-xs text-[#94A3B8] font-['Inter']">Didn&apos;t get the code? You can resend in <span className="font-medium text-[#64748B] tabular-nums">{resendCountdown}s</span></p>
                ) : (
                  <button type="button" onClick={handleResend} disabled={otpSubmitting}
                    className="flex items-center gap-1.5 text-xs text-[#2563EB] hover:underline font-['Inter'] font-medium disabled:opacity-50">
                    <RefreshCw className="w-3 h-3" />Resend code
                  </button>
                )}
              </div>
              <div className="mt-8 p-4 rounded-md bg-white border border-[#E3E7EE] flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-[#64748B] shrink-0 mt-0.5" />
                <p className="text-xs text-[#64748B] font-['Inter'] leading-relaxed">
                  <strong className="text-[#1F2937]">Didn&apos;t receive it?</strong> Check your spam folder. If it still doesn&apos;t arrive, verify the email address is correct or contact an administrator.
                </p>
              </div>
            </div>
          )}
          
            <p className="text-xs text-[#94A3B8] font-['Inter'] mt-8">&copy; {new Date().getFullYear()} TEMU · El Salvador City, Philippines</p>
          </div>
        </div>
      </main>

      {/* Road + pillars */}
      <div className="lane-x h-1.5 relative z-10" />
      <footer className="relative z-10 grid grid-cols-3 bg-[#0F1A31]">
        {PILLARS.map((x, i) => (
          <button key={x.label} type="button" onMouseEnter={() => setPillar(x.label)} onFocus={() => setPillar(x.label)} onMouseLeave={() => setPillar(null)} onBlur={() => setPillar(null)}
            className={`flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 py-5 transition-colors hover:bg-white/5 ${i < 2 ? 'border-r border-white/10' : ''}`}>
            <x.icon className={`w-5 h-5 transition-all duration-300 ${pillar === x.label ? 'text-[#F0B429] scale-125' : 'text-[#8B97AF]'}`} />
            <span className="text-[11px] uppercase tracking-wider text-[#C7CEDB] font-['Inter']">{x.label}</span>
          </button>
        ))}
      </footer>
    </div>
  );
};

export default Login;