// web/src/components/ui/OtpInput.jsx
import React, { useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

const OtpInput = ({
  length = 6,
  value = '',
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
  error = false,
}) => {
  const inputsRef = useRef([]);

  // Split value into individual characters, pad with empty strings
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus && inputsRef.current[0]) {
      inputsRef.current[0].focus();
    }
  }, [autoFocus]);

  const setValueAt = (index, char) => {
    const next = digits.slice();
    next[index] = char;
    const joined = next.join('').slice(0, length);
    onChange?.(joined);

    // If complete, fire onComplete with the joined value
    if (joined.length === length && next.every((d) => d !== '')) {
      onComplete?.(joined);
    }
  };

  const handleChange = (e, index) => {
    const raw = e.target.value;
    // Strip everything except digits
    const cleaned = raw.replace(/\D/g, '');

    if (!cleaned) {
      // User cleared the box
      setValueAt(index, '');
      return;
    }

    // Handle the case where the user types fast and the browser shoves
    // multiple chars into one input.
    if (cleaned.length > 1) {
      // Treat as paste starting at this index
      const next = digits.slice();
      for (let i = 0; i < cleaned.length && index + i < length; i++) {
        next[index + i] = cleaned[i];
      }
      const joined = next.join('').slice(0, length);
      onChange?.(joined);

      // Focus the last filled position
      const lastIndex = Math.min(index + cleaned.length, length - 1);
      inputsRef.current[lastIndex]?.focus();

      if (joined.length === length && next.every((d) => d !== '')) {
        onComplete?.(joined);
      }
      return;
    }

    // Single character — store it and advance
    setValueAt(index, cleaned);
    if (index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        // Clear current box
        setValueAt(index, '');
      } else if (index > 0) {
        // Move back and clear previous
        setValueAt(index - 1, '');
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      setValueAt(index, '');
    }
  };

  const handlePaste = (e, index) => {
    e.preventDefault();
    const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '');
    if (!pasted) return;

    const next = digits.slice();
    for (let i = 0; i < pasted.length && index + i < length; i++) {
      next[index + i] = pasted[i];
    }
    const joined = next.join('').slice(0, length);
    onChange?.(joined);

    const lastIndex = Math.min(index + pasted.length, length - 1);
    inputsRef.current[lastIndex]?.focus();

    if (joined.length === length && next.every((d) => d !== '')) {
      onComplete?.(joined);
    }
  };

  const handleFocus = (e) => {
    // Select existing content so typing overwrites it
    e.target.select();
  };

  return (
    <div className="flex gap-2 justify-center" role="group" aria-label="One-time code">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={(e) => handlePaste(e, i)}
          onFocus={handleFocus}
          className={cn(
            'w-12 h-14 text-center text-2xl font-mono font-semibold rounded-lg border-2 transition-all',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            error
              ? 'border-[#C8202F] text-[#C8202F] focus:border-[#C8202F] focus:ring-[#C8202F]/30'
              : digit
                ? 'border-[#1E8449] text-[#16233F] focus:border-[#1E8449] focus:ring-[#1E8449]/30'
                : 'border-[#E9ECF2] text-[#16233F] focus:border-[#F0B429] focus:ring-[#F0B429]/30',
            'bg-white placeholder:text-[#CBD5E1]',
            disabled && 'opacity-50 cursor-not-allowed bg-[#F5F6F8]',
          )}
          placeholder="•"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
};

export default OtpInput;