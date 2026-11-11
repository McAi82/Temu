// web/src/components/ui/ActionButton.jsx
import React from "react";
import { cn } from "../../lib/utils";

/**
 * Icon + label button used in table "Actions" columns.
 *
 * Variants map to your palette:
 *   default  — navy outline (neutral actions)
 *   primary  — green (positive: save, activate, approve, edit)
 *   danger   — red (destructive: delete, deactivate, reject)
 *   warning  — amber (caution: reset password, retry, contest)
 *   info     — slate blue (secondary info: view, details, print, history)
 */
const VARIANTS = {
  default: {
    base: "border-[#16233F]/25 bg-white text-[#16233F] hover:bg-[#E9ECF2] hover:border-[#16233F]/40",
  },
  primary: {
    base: "border-[#1E8449]/30 bg-white text-[#1E8449] hover:bg-[#E5F2EA] hover:border-[#1E8449]/50",
  },
  danger: {
    base: "border-[#C8202F]/30 bg-white text-[#C8202F] hover:bg-[#FBE7E9] hover:border-[#C8202F]/50",
  },
  warning: {
    base: "border-[#F0B429]/40 bg-white text-[#92600A] hover:bg-[#FBF1DC] hover:border-[#F0B429]/60",
  },
  info: {
    base: "border-[#3B5170]/25 bg-white text-[#3B5170] hover:bg-[#EEF1F5] hover:border-[#3B5170]/40",
  },
};

const SIZES = {
  sm: "text-xs px-2.5 py-1.5 gap-1.5",
  md: "text-sm px-3 py-2 gap-2",
};

const ActionButton = ({
  icon: Icon,
  children,
  onClick,
  variant = "default",
  size = "sm",
  disabled = false,
  title,
  type = "button",
  className,
}) => {
  const v = VARIANTS[variant] ?? VARIANTS.default;
  const s = SIZES[size] ?? SIZES.sm;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-medium transition-colors whitespace-nowrap",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0B429] focus-visible:ring-offset-1",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white",
        v.base,
        s,
        className,
      )}
    >
      {Icon ? <Icon className="w-3.5 h-3.5 flex-shrink-0" /> : null}
      <span>{children}</span>
    </button>
  );
};

export default ActionButton;