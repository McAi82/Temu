// web/src/pages/Reports.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from '../components/ui/tabs';
import {
    Download,
    TrendingUp,
    TrendingDown,
    Minus,
    Ticket,
    PhilippinePeso,
    AlertCircle,
    RefreshCw,
    Clock,
    CheckCircle,
    XCircle,
    BarChart3,
    Printer,
    Inbox,
    Loader2,
    Wallet,
    CreditCard,
    Banknote,
    Receipt,
    Archive,
    Scale,
    Calendar,
    X,
    Filter,
    LayoutGrid,
    List as ListIcon,
    Car,
    Users,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { getReport, exportReport } from '../services/api';
import {
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Line,
    Area,
    ReferenceLine,
    LabelList,
    XAxis,
    YAxis,
    PieChart as RePieChart,
    Pie,
    Cell,
} from 'recharts';
import temuLogo from '../assets/temu-logo.png';

/* Small icon helper — declared FIRST so it's available everywhere below */
const AlertTriangleIcon = (props) => (
    <svg
        {...props}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
    </svg>
);

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const COLORS = {
    navy: '#16233F',
    red: '#C8202F',
    green: '#1E8449',
    amber: '#F0B429',
    amberDark: '#92600A',
    orange: '#C2541F',
    slate: '#64748B',
    ink: '#1F2937',
    line: '#E9ECF2',
    compare: '#3B5170',
};

const STATUS_META = {
    issued: {
        label: 'Issued',
        color: COLORS.amberDark,
        tint: '#FBF1DC',
        chip: 'bg-[#FBF1DC] text-[#92600A]',
        Icon: Clock,
    },
    paid: {
        label: 'Paid',
        color: COLORS.green,
        tint: '#E5F2EA',
        chip: 'bg-[#E5F2EA] text-[#1E8449]',
        Icon: CheckCircle,
    },
    contested: {
        label: 'Contested',
        color: COLORS.orange,
        tint: '#FBEAE2',
        chip: 'bg-[#FBEAE2] text-[#C2541F]',
        Icon: AlertCircle,
    },
    dismissed: {
        label: 'Dismissed',
        color: COLORS.red,
        tint: '#FBE7E9',
        chip: 'bg-[#FBE7E9] text-[#C8202F]',
        Icon: XCircle,
    },
};

const PAYMENT_METHOD_META = {
    cash: { label: 'Cash', color: COLORS.green, bg: '#E5F2EA', Icon: Banknote },
};

const PERIODS = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
    { key: 'custom', label: 'Custom' },
];

const SCREEN_PER_PAGE = 5;
/* Mutable on purpose: expanded to "all rows" while printing (see beforeprint handler) */
let ITEMS_PER_PAGE = SCREEN_PER_PAGE;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const MONTH_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const toISODate = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const toISOMonth = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

const toISODateForWeekInput = (d) => {
    const target = new Date(
        Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()),
    );
    const dayNum = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
    const pad = (n) => String(n).padStart(2, '0');
    return `${target.getUTCFullYear()}-W${pad(weekNo)}`;
};

const daysAgoISO = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toISODate(d);
};

const toNumber = (value) => {
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : 0;
};

const formatCurrency = (amount) =>
    `₱${toNumber(amount).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const formatCompactCurrency = (amount) => {
    const num = toNumber(amount);
    if (Math.abs(num) >= 1_000_000)
        return `₱${(num / 1_000_000).toFixed(1)}M`;
    if (Math.abs(num) >= 1_000) return `₱${(num / 1_000).toFixed(1)}K`;
    return `₱${num.toFixed(0)}`;
};

const formatLongDate = (isoDate) => {
    if (!isoDate) return '—';
    try {
        const d = new Date(isoDate + 'T00:00:00');
        return d.toLocaleDateString('en-PH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    } catch {
        return isoDate;
    }
};

const formatShortDate = (isoDate) => {
    if (!isoDate) return '—';
    try {
        const d = new Date(isoDate + 'T00:00:00');
        return d.toLocaleDateString('en-PH', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    } catch {
        return isoDate;
    }
};

const getTotalFineFromTicket = (ticket) => {
    if (!ticket) return 0;
    if (Array.isArray(ticket.violations) && ticket.violations.length > 0) {
        return ticket.violations.reduce(
            (sum, v) => sum + toNumber(v?.fine_amount),
            0,
        );
    }
    return toNumber(ticket.total_fine);
};

const getInitials = (name) =>
    String(name || '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || '?';

const readApiError = (error) =>
    error?.response?.data?.message ||
    error?.message ||
    'Something went wrong while loading this report.';

/* X-axis label formatter for the daily chart */
const makeXAxisFormatter = (period) => (row) => {
    const iso = row?.date;
    if (!iso) return row?.day_name || '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;

    switch (period) {
        case 'daily':
            return d.toLocaleDateString('en-PH', { weekday: 'short' });
        case 'weekly':
            return `${d.toLocaleDateString('en-PH', {
                weekday: 'short',
            })} ${d.getDate()}`;
        case 'monthly':
            return String(d.getDate());
        case 'yearly':
            return MONTH_SHORT[d.getMonth()];
        case 'custom': {
            const rangeDays = row?.__rangeDays || 0;
            if (rangeDays && rangeDays <= 31) return String(d.getDate());
            if (rangeDays && rangeDays <= 180) {
                return `${d.toLocaleDateString('en-PH', {
                    weekday: 'short',
                })} ${d.getDate()}`;
            }
            return `${MONTH_SHORT[d.getMonth()]} ${d
                .getFullYear()
                .toString()
                .slice(-2)}`;
        }
        default:
            return row?.day_name || String(d.getDate());
    }
};

/* Count-up animation */
function useCountUp(target, ms = 900) {
    const [v, setV] = useState(0);
    useEffect(() => {
        if (
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ) {
            setV(target);
            return;
        }
        let raf;
        let t0;
        const tick = (t) => {
            t0 ??= t;
            const p = Math.min((t - t0) / ms, 1);
            setV(target * (1 - Math.pow(1 - p, 3)));
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, ms]);
    return v;
}

const AnimatedValue = ({
    value,
    prefix = '',
    suffix = '',
    integer = true,
}) => {
    const raw = toNumber(value);
    const v = useCountUp(raw);
    const display = integer
        ? Math.round(v).toLocaleString()
        : (Math.round(v * 10) / 10).toLocaleString();
    return (
        <>
            {prefix}
            {display}
            {suffix}
        </>
    );
};

/* ------------------------------------------------------------------ */
/* MiniPager                                                           */
/* ------------------------------------------------------------------ */

const MiniPager = ({
    page,
    onPageChange,
    total,
    perPage = ITEMS_PER_PAGE,
    label = 'items',
    dark = false,
}) => {
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (total <= perPage) {
        return (
            <p className={`text-xs mt-3 ${dark ? 'text-[#8D98B3]' : 'text-[#94A3B8]'}`}>
                Showing{' '}
                <span className={`font-medium ${dark ? 'text-[#C7CEDB]' : 'text-[#64748B]'}`}>{total}</span>{' '}
                {total === 1 ? label.replace(/s$/, '') : label}
            </p>
        );
    }

    const from = (page - 1) * perPage + 1;
    const to = Math.min(page * perPage, total);

    const btnBase = dark
        ? 'h-7 w-7 p-0 rounded-full border-white/20 text-white hover:bg-[#F0B429] hover:text-[#16233F] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white'
        : 'h-7 w-7 p-0 rounded-full border-[#16233F]/20 text-[#16233F] hover:bg-[#16233F] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#16233F]';

    return (
        <div className={`mt-4 flex items-center justify-between gap-3 border-t border-dashed pt-3 ${dark ? 'border-white/15' : 'border-[#CBD5E1]'}`}>
            <p className={`text-xs tabular-nums ${dark ? 'text-[#8D98B3]' : 'text-[#94A3B8]'}`}>
                Showing{' '}
                <span className={`font-medium ${dark ? 'text-[#C7CEDB]' : 'text-[#64748B]'}`}>
                    {from}–{to}
                </span>{' '}
                of <span className={`font-medium ${dark ? 'text-[#C7CEDB]' : 'text-[#64748B]'}`}>{total}</span>{' '}
                {label}
            </p>
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className={btnBase}
                    title="Previous"
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className={`text-xs font-medium tabular-nums px-1 ${dark ? 'text-white' : 'text-[#16233F]'}`}>
                    {page} / {totalPages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className={btnBase}
                    title="Next"
                >
                    <ChevronRight className="w-3.5 h-3.5" />
                </Button>
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* Small UI primitives                                                 */
/* ------------------------------------------------------------------ */

const Chip = ({ label, onClear }) => (
    <span className="inline-flex items-center gap-1 bg-[#E9ECF2] text-[#16233F] px-2.5 py-1 rounded-md text-xs">
        {label}
        <button onClick={onClear} className="hover:text-[#C8202F]">
            <X className="w-3 h-3" />
        </button>
    </span>
);

const FieldLabel = ({ icon: I, children }) => (
    <label className="text-xs font-semibold text-[#16233F] mb-1.5 flex items-center gap-1.5">
        {I && <I className="w-3.5 h-3.5 text-[#92600A]" />}
        {children}
    </label>
);

const DeltaBadge = ({ delta }) => {
    if (!delta) return null;

    const { direction, percent, change } = delta;
    const colorMap = { up: COLORS.green, down: COLORS.red, flat: COLORS.slate };
    const bgMap = { up: '#E5F2EA', down: '#FBE7E9', flat: '#F1F5F9' };
    const Icon =
        direction === 'up'
            ? TrendingUp
            : direction === 'down'
                ? TrendingDown
                : Minus;
    const color = colorMap[direction] || COLORS.slate;
    const bg = bgMap[direction] || '#F1F5F9';

    const sign = direction === 'up' ? '+' : direction === 'down' ? '' : '';
    const label = `${sign}${percent.toFixed(1)}%`;

    return (
        <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium print-pill"
            style={{ backgroundColor: bg, color }}
            title={`Change: ${change >= 0 ? '+' : ''}${change}`}
        >
            <Icon className="w-3 h-3" />
            {label}
        </span>
    );
};

/* ------------------------------------------------------------------ */
/* Print styles / header / footer                                      */
/* ------------------------------------------------------------------ */

const makeRefNo = (periodLabel, dateRange) =>
    `TEMU-${String(periodLabel || 'R').charAt(0).toUpperCase()}-${String(
        dateRange?.start || '',
    ).replace(/-/g, '')}`;

const PrintStyles = ({ refNo = 'TEMU-R' }) => (
    <style>{`
    .print-report { counter-reset: formpart; }

    @media print {
      .form-part::before { counter-increment: formpart; content: "PART " counter(formpart); }
      .print-report .form-dark, .print-report .form-dark * { color: #ffffff !important; }
      .print-report .print-note {
        font-size: 9.5px !important; line-height: 1.5 !important; color: #334155 !important;
        margin: 0 0 8px !important; text-align: justify;
      }
      @page {
        size: A4 portrait;
        margin: 12mm 11mm 20mm 11mm;
        @bottom-left {
          content: "FORM TEMU-R1  ·  Ref. ${refNo}";
          font: 7px Arial, Helvetica, sans-serif; color: #475569;
          border-top: 1.5px solid #16233F; padding-top: 4px; vertical-align: top;
        }
        @bottom-center {
          content: "Confidential — for official use only";
          font: 7px Arial, Helvetica, sans-serif; color: #475569;
          border-top: 1.5px solid #16233F; padding-top: 4px; vertical-align: top;
        }
        @bottom-right {
          content: "Page " counter(page) " of " counter(pages);
          font: 7px Arial, Helvetica, sans-serif; color: #475569;
          border-top: 1.5px solid #16233F; padding-top: 4px; vertical-align: top;
        }
      }

      html, body {
        background: #ffffff !important;
        color: #111827 !important;
        font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
        font-size: 10px !important;
        line-height: 1.4 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .no-print, nav, aside, header[role="banner"], .print\\:hidden { display: none !important; }
      .print-only { display: block !important; }

      html, body, #root { height: auto !important; min-height: 0 !important; overflow: visible !important; }
      *:has(.print-report) {
        display: block !important; position: static !important;
        height: auto !important; min-height: 0 !important; max-height: none !important;
        width: auto !important; max-width: none !important;
        overflow: visible !important; margin: 0 !important; padding: 0 !important;
        transform: none !important;
      }
      * { scrollbar-width: none !important; }
      *::-webkit-scrollbar { display: none !important; }
      .print-report .overflow-x-auto, .print-report .overflow-auto, .print-report .overflow-y-auto {
        overflow: visible !important; margin-left: 0 !important; margin-right: 0 !important;
        padding-left: 0 !important; padding-right: 0 !important;
      }
      .print-report, .print-report * { font-family: Arial, Helvetica, sans-serif !important; }
      .print-report table { min-width: 0 !important; }

      .print-report .recharts-wrapper { max-width: 100% !important; margin: 0 auto; }
      .print-report .recharts-tooltip-wrapper { display: none !important; }

      .print-report .navy-stat-grid { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 6px !important; }
      .print-report .navy-stat {
        background: #ffffff !important; border: 1px solid #16233F !important;
        border-top: 3px solid #C8202F !important; padding: 6px 8px !important;
      }
      .print-report .navy-stat p { color: #111827 !important; margin: 0 !important; }
      .print-report .navy-stat p:first-child { font-size: 8px !important; letter-spacing: 0.8px !important; text-transform: uppercase !important; color: #475569 !important; }
      .print-report .navy-stat p:nth-child(2) { font-size: 16px !important; font-weight: 700 !important; color: #16233F !important; }

      /* Navy print sections render as white boxed cards */
      .print-report .bg-\\[\\#16233F\\] {
        background: #ffffff !important;
        border: 1px solid #16233F !important;
        color: #111827 !important;
      }
      .print-report .bg-\\[\\#16233F\\] * {
        color: #111827 !important;
      }
      .print-report .bg-\\[\\#16233F\\] .text-\\[\\#F0B429\\] {
        color: #16233F !important;
      }
      .print-report .bg-\\[\\#16233F\\] .text-\\[\\#C7CEDB\\],
      .print-report .bg-\\[\\#16233F\\] .text-\\[\\#8D98B3\\] {
        color: #475569 !important;
      }
      .print-report .bg-white\\/5,
      .print-report .bg-white\\/10 {
        background: #F5F6F8 !important;
        border-color: #CBD5E1 !important;
      }
      .print-report .border-white\\/10,
      .print-report .border-white\\/15 {
        border-color: #CBD5E1 !important;
      }

      .print-report, .print-report * {
        box-shadow: none !important;
        text-shadow: none !important;
        border-radius: 0 !important;
        background-image: none !important;
      }

      .print-report .print-card {
        border: 1px solid #16233F !important;
        background: #ffffff !important;
        page-break-inside: avoid;
        break-inside: avoid;
        margin-bottom: 8px !important;
        padding: 0 8px 8px !important;
      }

      .print-report .form-bar {
        background: #E4E9F1 !important;
        border: 0 !important;
        border-bottom: 1px solid #16233F !important;
        margin: 0 -8px 8px !important;
        padding: 4px 8px !important;
      }
      .print-report h1, .print-report h2, .print-report h3 { page-break-after: avoid; break-after: avoid; }
      .print-report h2 {
        font-size: 9.5px !important;
        letter-spacing: 1.4px !important;
        text-transform: uppercase !important;
        color: #16233F !important;
      }
      .print-report h2 svg { display: none !important; }

      .print-report table { width: 100% !important; border-collapse: collapse !important; font-size: 9.5px !important; }
      .print-report table thead { display: table-header-group; }
      .print-report table th, .print-report table td {
        border: 1px solid #16233F !important;
        padding: 4px 6px !important;
        color: #111827 !important;
      }
      .print-report table th {
        background: #E4E9F1 !important;
        color: #16233F !important;
        font-weight: 700 !important;
        font-size: 8px !important;
        letter-spacing: 0.8px !important;
        text-transform: uppercase !important;
        text-align: left !important;
      }

      .print-report, .print-report p, .print-report span, .print-report div,
      .print-report li, .print-report h1, .print-report h3, .print-report h4,
      .print-report strong { color: #111827 !important; }
      .print-report .form-part { color: #C8202F !important; font-weight: 700 !important; }
      .print-report .text-muted-print { color: #475569 !important; }

      .print-report .print-pill {
        border: 1px solid #16233F !important;
        background: #ffffff !important;
        color: #111827 !important;
      }
      .print-report .print-bar { display: none !important; }
      .print-report .print-stat { border: 1px solid #16233F !important; padding: 6px 8px !important; background: #ffffff !important; }
      .print-report .print-stat-icon { display: none !important; }
      .print-report .print-stat-value { font-size: 15px !important; color: #16233F !important; }

      .print-report .recharts-surface { overflow: visible !important; }
      .print-report .recharts-text { fill: #334155 !important; }
      .print-report .recharts-cartesian-axis-line,
      .print-report .recharts-cartesian-grid line { stroke: #cbd5e1 !important; }

      .print-break-before { page-break-before: always; break-before: page; }
      .print-break-after { page-break-after: always; break-after: page; }
      .print-avoid-break { page-break-inside: avoid; break-inside: avoid; }
    }

    @media screen {
      .print-only { display: none !important; }
    }
  `}</style>
);

/* Form primitives (print) */
const FORM_INK = '#16233F';
const FormField = ({ label, children, flex = 1, minHeight }) => (
    <div
        style={{
            flex,
            borderRight: `1px solid ${FORM_INK}`,
            padding: '2px 6px 4px',
            minHeight,
        }}
    >
        <div style={{ fontSize: '6.5px', letterSpacing: '1px', textTransform: 'uppercase', color: '#64748B' }}>
            {label}
        </div>
        <div style={{ fontSize: '10px', fontWeight: 600, color: FORM_INK, marginTop: '1px' }}>{children}</div>
    </div>
);
const FormRow = ({ children, last }) => (
    <div style={{ display: 'flex', borderBottom: last ? 'none' : `1px solid ${FORM_INK}` }}>{children}</div>
);
const Check = ({ on, label }) => (
    <span style={{ marginRight: '14px', fontSize: '9px', color: '#111827' }}>
        <span
            style={{
                display: 'inline-block',
                width: '9px',
                height: '9px',
                border: `1px solid ${FORM_INK}`,
                marginRight: '4px',
                verticalAlign: '-1px',
                textAlign: 'center',
                lineHeight: '8px',
                fontSize: '9px',
                fontWeight: 700,
            }}
        >
            {on ? '✕' : ''}
        </span>
        {label}
    </span>
);

const PrintHeader = ({
    periodLabel,
    dateRange,
    compareRange,
    generatedAt,
    includeArchived,
    summary = {},
}) => {
    const fmtRange = (r) =>
        r.start === r.end
            ? formatLongDate(r.start)
            : `${formatLongDate(r.start)} — ${formatLongDate(r.end)}`;
    const refNo = makeRefNo(periodLabel, dateRange);

    return (
        <div className="print-only" style={{ marginBottom: '10px' }}>
            <div style={{ border: `1.5px solid ${FORM_INK}` }}>
                <FormRow>
                    <div style={{ width: '74px', borderRight: `1px solid ${FORM_INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}>
                        <img src={temuLogo} alt="TEMU" style={{ width: '58px', height: '58px', objectFit: 'contain' }} />
                    </div>
                    <div style={{ flex: 1, borderRight: `1px solid ${FORM_INK}`, padding: '6px 10px' }}>
                        <div style={{ fontSize: '7.5px', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#64748B' }}>
                            City of El Salvador · Traffic Enforcement and Management Unit
                        </div>
                        <div style={{ fontSize: '17px', fontWeight: 800, color: FORM_INK, letterSpacing: '0.5px', marginTop: '3px' }}>
                            TRAFFIC ENFORCEMENT REPORT
                        </div>
                        <div style={{ fontSize: '9px', color: '#475569' }}>Violations, enforcement &amp; collections summary</div>
                    </div>
                    <div style={{ width: '128px', padding: '6px 8px' }}>
                        <div style={{ fontSize: '6.5px', letterSpacing: '1px', textTransform: 'uppercase', color: '#64748B' }}>Form No.</div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#C8202F' }}>TEMU-R1</div>
                        <div style={{ fontSize: '6.5px', letterSpacing: '1px', textTransform: 'uppercase', color: '#64748B', marginTop: '4px' }}>Reference No.</div>
                        <div style={{ fontSize: '9.5px', fontWeight: 700, color: FORM_INK }}>{refNo}</div>
                    </div>
                </FormRow>

                <div className="form-dark" style={{ background: FORM_INK, color: '#fff', fontSize: '7.5px', letterSpacing: '2px', padding: '2px 8px', borderTop: `1px solid ${FORM_INK}` }}>
                    <span style={{ color: '#fff' }}>REPORT IDENTIFICATION</span>
                </div>
                <FormRow>
                    <FormField label="1. Report type" flex={1}>{periodLabel}</FormField>
                    <FormField label="2. Coverage period" flex={2.4}>{fmtRange(dateRange)}</FormField>
                    <FormField label="3. Date generated" flex={1.4}>
                        {generatedAt.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                    </FormField>
                </FormRow>
                <FormRow>
                    <FormField label="4. Compared against" flex={2.4}>
                        {compareRange ? fmtRange(compareRange) : 'N/A'}
                    </FormField>
                    <FormField label="5. Classification" flex={1.4}>Confidential</FormField>
                    <div style={{ flex: 2, padding: '2px 6px 4px' }}>
                        <div style={{ fontSize: '6.5px', letterSpacing: '1px', textTransform: 'uppercase', color: '#64748B' }}>6. Options</div>
                        <div style={{ marginTop: '2px' }}>
                            <Check on={includeArchived} label="Archived included" />
                            <Check on={!!compareRange} label="Comparison" />
                        </div>
                    </div>
                </FormRow>

                <div className="form-dark" style={{ background: FORM_INK, color: '#fff', fontSize: '7.5px', letterSpacing: '2px', padding: '2px 8px', borderTop: `1px solid ${FORM_INK}` }}>
                    <span style={{ color: '#fff' }}>SUMMARY OF FIGURES</span>
                </div>
                <FormRow last>
                    <FormField label="7. Total violations">{summary.total_tickets || 0}</FormField>
                    <FormField label="8. Resolved (paid)">{summary.paid_tickets || 0}</FormField>
                    <FormField label="9. Active (issued)">{summary.issued_tickets || 0}</FormField>
                    <div style={{ flex: 1, padding: '2px 6px 4px' }}>
                        <div style={{ fontSize: '6.5px', letterSpacing: '1px', textTransform: 'uppercase', color: '#64748B' }}>10. Collection rate</div>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: FORM_INK, marginTop: '1px' }}>{summary.collection_rate || 0}%</div>
                    </div>
                </FormRow>
            </div>
        </div>
    );
};

const FormBar = ({ children }) => (
    <div className="form-dark" style={{ background: FORM_INK, fontSize: '7.5px', letterSpacing: '2px', padding: '3px 8px' }}>
        {children}
    </div>
);

const maxBy = (rows, key) =>
    rows.reduce((best, r) => (toNumber(r?.[key]) > toNumber(best?.[key]) ? r : best), rows[0]);

const PrintNarrative = ({
    periodLabel, dateRange, rangeDays, summary, chartStats, payments,
    violations, violators, enforcers, compare, includeArchived, generatedAt,
}) => {
    const n = toNumber;
    const total = n(summary.total_tickets);
    const pct = (v) => (total > 0 ? Math.round((n(v) / total) * 100) : 0);
    const range =
        dateRange.start === dateRange.end
            ? formatLongDate(dateRange.start)
            : `${formatLongDate(dateRange.start)} to ${formatLongDate(dateRange.end)}`;

    const findings = [
        `A total of ${total} violation ticket(s) were issued during the period, an average of ${chartStats.avg.toFixed(1)} per day over ${rangeDays} day(s).`,
        `${n(summary.paid_tickets)} ticket(s) (${pct(summary.paid_tickets)}%) have been paid, ${n(summary.issued_tickets)} remain issued and awaiting settlement, ${n(summary.contested_tickets)} are contested and ${n(summary.dismissed_tickets)} were dismissed.`,
        `Fines issued amounted to ${formatCurrency(n(summary.total_fines))}. The collection rate reported by the system for the period is ${n(summary.collection_rate)}%.`,
    ];
    if (payments)
        findings.push(
            `Net collections totaled ${formatCurrency(n(payments.net_collected))} from ${n(payments.payments_count)} payment(s) covering ${n(payments.unique_tickets)} ticket(s), with an average payment of ${formatCurrency(n(payments.average_payment))}.`,
        );
    if (chartStats.peakCount > 0)
        findings.push(`The busiest day was ${formatLongDate(chartStats.peakDate)}, with ${chartStats.peakCount} ticket(s) issued.`);
    if (violations.length) {
        const v = maxBy(violations, 'count');
        findings.push(`The most frequently recorded violation was "${v.violation_name}", with ${n(v.count)} occurrence(s) and total fines of ${formatCurrency(n(v.total_fine))}.`);
    }
    if (violators.length) {
        const v = maxBy(violators, 'tickets_count');
        findings.push(`${[v.firstname, v.lastname].filter(Boolean).join(' ') || 'The top violator'}${v.license ? ` (license ${v.license})` : ''} recorded the most tickets in the period, with ${n(v.tickets_count)}.`);
    }
    if (enforcers.length) {
        const v = maxBy(enforcers, 'tickets_count');
        findings.push(`${v.name} issued the most tickets among enforcers, with ${n(v.tickets_count)}.`);
    }
    if (compare?.summary) {
        const a = total;
        const b = n(compare.summary.total_tickets);
        const diff = a - b;
        const change = b > 0 ? ` (${Math.abs((diff / b) * 100).toFixed(1)}%)` : '';
        findings.push(
            diff === 0
                ? `Ticket volume was unchanged compared with the comparison range (${b} ticket(s)).`
                : `Ticket volume ${diff > 0 ? 'rose' : 'fell'} by ${Math.abs(diff)}${change} compared with the comparison range (${b} ticket(s)).`,
        );
    }

    const para = { fontSize: '9.5px', lineHeight: 1.55, color: '#1F2937', textAlign: 'justify', margin: 0 };
    return (
        <div className="print-only" style={{ border: `1.5px solid ${FORM_INK}`, marginBottom: '10px' }}>
            <FormBar><span>REPORT OVERVIEW</span></FormBar>
            <div style={{ padding: '7px 9px', borderBottom: `1px solid ${FORM_INK}` }}>
                <p style={para}>
                    This {String(periodLabel).toLowerCase()} presents the traffic violations recorded, the enforcement
                    activity and the fines collected by the Traffic Enforcement and Management Unit (TEMU) of the City
                    of El Salvador for the period {range} ({rangeDays} day(s)).
                    {includeArchived ? ' Archived records are included in the figures.' : ''} It was generated from the
                    TEMU Command Center records on{' '}
                    {generatedAt.toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })} and is intended
                    for official monitoring, planning and accountability.
                </p>
            </div>
            <FormBar><span>KEY FINDINGS</span></FormBar>
            <ol style={{ margin: 0, padding: '7px 9px 7px 26px' }}>
                {findings.map((f, i) => (
                    <li key={i} style={{ ...para, marginBottom: '3px' }}>{f}</li>
                ))}
            </ol>
        </div>
    );
};

const PrintNotes = ({ generatedAt, includeArchived }) => {
    const defs = [
        ['Issued', 'A ticket that has been recorded and is awaiting payment or action.'],
        ['Paid', 'A ticket that has been settled through a recorded payment.'],
        ['Contested', 'A ticket that the violator has protested and that is under review.'],
        ['Dismissed', 'A ticket that has been cancelled; no fine is due.'],
        ['Collection rate', 'The share of tickets settled in the period, as computed by the system.'],
        ['Net collected', 'Total payments received less any refunds.'],
        ['Peak day', 'The day in the period with the highest number of tickets issued.'],
        ['Amounts', 'All amounts are in Philippine Peso (₱).'],
    ];
    const small = { fontSize: '9px', lineHeight: 1.5, color: '#1F2937', margin: 0, textAlign: 'justify' };
    return (
        <div className="print-only print-avoid-break" style={{ marginTop: '14px', border: `1.5px solid ${FORM_INK}` }}>
            <FormBar><span>NOTES AND DEFINITIONS</span></FormBar>
            <div style={{ display: 'flex', flexWrap: 'wrap', padding: '6px 9px', gap: '3px 18px' }}>
                {defs.map(([t, d]) => (
                    <p key={t} style={{ ...small, flex: '1 1 45%' }}>
                        <strong>{t}.</strong> {d}
                    </p>
                ))}
            </div>
            <FormBar><span>BASIS OF PREPARATION</span></FormBar>
            <div style={{ padding: '6px 9px' }}>
                <p style={small}>
                    Figures reflect the records held in the TEMU Command Center as of{' '}
                    {generatedAt.toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}
                    {includeArchived ? ', including archived records' : ', excluding archived records'}. Payments,
                    dismissals or corrections recorded after this time are not reflected. Percentages are rounded and
                    may not add up to exactly 100%. This document is confidential and for official use only; it should
                    not be reproduced or shared without the approval of the issuing office.
                </p>
            </div>
            <FormBar><span>REMARKS / RECOMMENDATIONS</span></FormBar>
            <div style={{ padding: '4px 9px 8px' }}>
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} style={{ height: '19px', borderBottom: '1px solid #94A3B8' }} />
                ))}
            </div>
        </div>
    );
};

const PrintEndFooter = ({ refNo, generatedAt }) => (
    <div className="print-only print-avoid-break" style={{ marginTop: '12px', borderTop: `2px solid ${FORM_INK}`, paddingTop: '6px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <img src={temuLogo} alt="" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: FORM_INK, letterSpacing: '0.4px' }}>
                    Traffic Enforcement and Management Unit · City of El Salvador
                </div>
                <div style={{ fontSize: '8px', color: '#475569', lineHeight: 1.5, marginTop: '2px' }}>
                    This report was generated by the TEMU Command Center and is valid only as an unaltered, complete
                    document. For questions or corrections, please contact the issuing office and quote the reference
                    number below.
                </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '8px', color: '#475569', lineHeight: 1.5 }}>
                <div>Ref. No. <strong style={{ color: FORM_INK }}>{refNo}</strong></div>
                <div>Form TEMU-R1</div>
                <div>{generatedAt.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</div>
            </div>
        </div>
        <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '7.5px', letterSpacing: '3px', textTransform: 'uppercase', color: '#64748B' }}>
            — End of report —
        </div>
    </div>
);

const PrintSignatures = () => (
    <div className="print-only print-avoid-break" style={{ marginTop: '14px', border: `1.5px solid ${FORM_INK}` }}>
        <div className="form-dark" style={{ background: FORM_INK, fontSize: '7.5px', letterSpacing: '2px', padding: '2px 8px' }}>
            <span style={{ color: '#fff' }}>CERTIFICATION</span>
        </div>
        <FormRow>
            {['Prepared by', 'Reviewed by', 'Approved by'].map((r, i) => (
                <FormField key={r} label={`${i + 1}. ${r} — name, signature &amp; date`} minHeight="46px">
                    &nbsp;
                </FormField>
            ))}
        </FormRow>
        <FormRow last>
            <FormField label="Date received" flex={1}>&nbsp;</FormField>
            <FormField label="Control no." flex={1}>&nbsp;</FormField>
            <div style={{ flex: 1, padding: '2px 6px 4px', fontSize: '7px', letterSpacing: '1px', textTransform: 'uppercase', color: '#64748B' }}>
                For official use only
            </div>
        </FormRow>
    </div>
);

const PrintFooter = () => null;

/* ------------------------------------------------------------------ */
/* Report-specific components                                          */
/* ------------------------------------------------------------------ */

const EmptyState = ({ message, hint, dark = false }) => (
    <div className="flex flex-col items-center justify-center py-10 text-center">
        <Inbox
            className={`mb-3 h-8 w-8 ${dark ? 'text-white/40' : 'text-[#CBD5E1]'}`}
            aria-hidden="true"
        />
        <p className={`text-sm ${dark ? 'text-[#C7CEDB]' : 'text-[#64748B]'}`}>{message}</p>
        {hint && (
            <p className={`mt-1 text-xs ${dark ? 'text-[#8D98B3]' : 'text-[#94A3B8]'}`}>
                {hint}
            </p>
        )}
    </div>
);

const ErrorState = ({ message, onRetry }) => (
    <Card className="border-[#C8202F]/30 bg-[#FBE7E9]/40">
        <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
                <AlertCircle
                    className="mt-0.5 h-5 w-5 shrink-0 text-[#C8202F]"
                    aria-hidden="true"
                />
                <div>
                    <p className="font-medium text-[#C8202F]">
                        Report didn't load
                    </p>
                    <p className="text-sm text-[#7F1D1D]/80">{message}</p>
                </div>
            </div>
            <Button
                onClick={onRetry}
                variant="outline"
                className="shrink-0 border-[#C8202F]/30 text-[#C8202F] hover:bg-[#FBE7E9]"
            >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
            </Button>
        </CardContent>
    </Card>
);

const SkeletonBlock = ({ className = '' }) => (
    <div className={`animate-pulse rounded bg-[#E9ECF2] ${className}`} />
);

const ReportSkeleton = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-0 rounded-xl border border-[#E3E7EE] overflow-hidden">
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                    key={i}
                    className="p-5 border-r border-b border-dashed border-[#CBD5E1]"
                >
                    <SkeletonBlock className="h-4 w-16 mb-3" />
                    <SkeletonBlock className="h-8 w-20" />
                </div>
            ))}
        </div>
        <Card className="border-[#E3E7EE]">
            <CardContent className="p-6">
                <SkeletonBlock className="h-5 w-40" />
                <SkeletonBlock className="mt-4 h-64 w-full" />
            </CardContent>
        </Card>
    </div>
);

/* Section header — works on navy cards */
const SectionHeader = ({ icon: Icon, color, children, action, note }) => (
    <>
        <div className="form-bar flex items-center justify-between gap-3 mb-5 pb-2 border-b border-white/10">
            <h2 className="flex items-center gap-3 text-[13px] font-['Oswald'] font-medium uppercase tracking-[0.14em] text-white">
                <span className="form-part hidden print:inline text-[11px] font-semibold tracking-[0.18em] text-[#F0B429]" />
                {Icon && <Icon className="w-4 h-4 text-[#F0B429]" />}
                {children}
            </h2>
            {action}
        </div>
        {note && <p className="print-only print-note">{note}</p>}
    </>
);

const StatTile = ({
    title,
    value,
    icon: Icon,
    color,
    tint,
    textColor,
    clickable = false,
    active = false,
    onClick,
    animated,
    suffix,
}) => (
    <button
        type="button"
        disabled={!clickable}
        onClick={onClick}
        aria-pressed={active}
        className={`relative text-left p-5 border-dashed border-[#CBD5E1] border-b border-r transition-all duration-300 ${clickable ? 'hover:bg-[#F8F9FB] cursor-pointer' : 'cursor-default'
            }`}
        style={active ? { background: tint } : undefined}
    >
        <span
            className="absolute top-0 left-0 right-0 h-1.5 transition-transform origin-left duration-500"
            style={{
                background: color,
                transform: `scaleX(${active ? 1 : 0.3})`,
            }}
        />
        <Icon className="w-5 h-5 mb-3" style={{ color: textColor }} />
        <p
            className="text-4xl font-['Oswald'] font-semibold tabular-nums leading-none"
            style={{ color: '#1F2937' }}
        >
            {animated ? (
                <AnimatedValue
                    value={value}
                    prefix={animated.prefix}
                    suffix={animated.suffix || suffix}
                    integer={animated.integer}
                />
            ) : (
                <>
                    {value}
                    {suffix}
                </>
            )}
        </p>
        <p className="text-xs text-gray-500 mt-2">{title}</p>
    </button>
);

const CompareTable = ({ primary, compare, primaryRange, compareRange }) => {
    if (!primary || !compare) return null;

    const metrics = [
        { key: 'total_tickets', label: 'Tickets issued', format: (v) => String(v) },
        { key: 'total_violations', label: 'Violations recorded', format: (v) => String(v) },
        { key: 'total_fines', label: 'Total fines', format: (v) => formatCurrency(v) },
        { key: 'paid_tickets', label: 'Paid tickets', format: (v) => String(v) },
        { key: 'issued_tickets', label: 'Issued (unpaid)', format: (v) => String(v) },
        { key: 'partial_tickets', label: 'Partial payments', format: (v) => String(v) },
        { key: 'contested_tickets', label: 'Contested tickets', format: (v) => String(v) },
        { key: 'dismissed_tickets', label: 'Dismissed tickets', format: (v) => String(v) },
        { key: 'average_daily_tickets', label: 'Avg tickets / day', format: (v) => toNumber(v).toFixed(2) },
        { key: 'collection_rate', label: 'Collection rate', format: (v) => `${toNumber(v).toFixed(1)}%` },
    ];

    const getDelta = (key) => {
        const p = toNumber(primary[key]);
        const c = toNumber(compare[key]);
        const change = p - c;
        const percent = c > 0 ? (change / c) * 100 : p > 0 ? 100 : 0;
        const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
        return { primary: p, compare: c, change, percent, direction };
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 bg-[#16233F] text-white px-2.5 py-1 rounded-full font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#F0B429]" />
                    Primary: {formatShortDate(primaryRange.start)} –{' '}
                    {formatShortDate(primaryRange.end)}
                </span>
                <span className="inline-flex items-center gap-1.5 bg-[#EEF1F5] text-[#3B5170] px-2.5 py-1 rounded-full font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#3B5170]" />
                    Compare: {formatShortDate(compareRange.start)} –{' '}
                    {formatShortDate(compareRange.end)}
                </span>
            </div>

            <div className="-mx-2 overflow-x-auto px-2">
                <table className="w-full min-w-[640px]">
                    <thead className="border-b-2 border-[#E9ECF2]">
                        <tr>
                            <th className="py-3 text-left font-['Inter'] text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                                Metric
                            </th>
                            <th className="py-3 text-right font-['Inter'] text-xs font-semibold uppercase tracking-wider text-[#16233F]">
                                Primary
                            </th>
                            <th className="py-3 text-right font-['Inter'] text-xs font-semibold uppercase tracking-wider text-[#3B5170]">
                                Compare
                            </th>
                            <th className="py-3 text-right font-['Inter'] text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                                Change
                            </th>
                            <th className="py-3 text-right font-['Inter'] text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                                %
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {metrics.map((m) => {
                            const d = getDelta(m.key);
                            const colorMap = {
                                up: COLORS.green,
                                down: COLORS.red,
                                flat: COLORS.slate,
                            };
                            const Icon =
                                d.direction === 'up'
                                    ? TrendingUp
                                    : d.direction === 'down'
                                        ? TrendingDown
                                        : Minus;
                            const color = colorMap[d.direction];
                            return (
                                <tr
                                    key={m.key}
                                    className="border-b border-[#F3F4F6] hover:bg-[#F8F9FA]"
                                >
                                    <td className="py-2.5 text-sm text-[#1F2937]">
                                        {m.label}
                                    </td>
                                    <td className="py-2.5 text-right font-semibold text-[#16233F] tabular-nums">
                                        {m.format(primary[m.key])}
                                    </td>
                                    <td className="py-2.5 text-right font-semibold text-[#3B5170] tabular-nums">
                                        {m.format(compare[m.key])}
                                    </td>
                                    <td
                                        className="py-2.5 text-right font-medium tabular-nums"
                                        style={{ color }}
                                    >
                                        {d.change > 0 ? '+' : ''}
                                        {m.format(d.change)}
                                    </td>
                                    <td
                                        className="py-2.5 text-right font-medium whitespace-nowrap tabular-nums"
                                        style={{ color }}
                                    >
                                        <span className="inline-flex items-center gap-1 justify-end">
                                            <Icon className="w-3 h-3" />
                                            {d.percent > 0 ? '+' : ''}
                                            {d.percent.toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const NavyStat = ({ label, value, prefix = '', suffix = '', accent, sub }) => (
    <div className="navy-stat rounded-xl bg-white/5 border border-white/10 p-4">
        <p className="text-xs text-[#C7CEDB] mb-2">{label}</p>
        <p
            className="text-3xl font-['Oswald'] font-semibold tabular-nums leading-none"
            style={{ color: accent }}
        >
            <AnimatedValue value={value} prefix={prefix} suffix={suffix} />
        </p>
        {sub && <p className="text-[11px] text-[#8D98B3] mt-2">{sub}</p>}
    </div>
);

/* Ranked list row used by top violations / enforcers / violators */
const RankedRow = ({ rank, primary, secondary, value, share, color, badge }) => (
    <li className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
                {badge ? (
                    badge
                ) : rank != null ? (
                    <span className="w-6 h-6 shrink-0 rounded-full bg-[#F0B429] text-[#16233F] flex items-center justify-center text-xs font-bold tabular-nums">
                        {rank}
                    </span>
                ) : null}
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{primary}</p>
                    {secondary && (
                        <p className="truncate text-xs text-[#C7CEDB]">{secondary}</p>
                    )}
                </div>
            </div>
            <span className="shrink-0 text-sm font-semibold text-[#F0B429] tabular-nums">
                {value}
            </span>
        </div>
        <div className="print-bar h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(share, 2)}%`, backgroundColor: color }}
            />
        </div>
    </li>
);

/* Small card used by drill-down lists (payments, tickets) */
const NavyListRow = ({ children }) => (
    <li className="rounded-lg bg-white/5 border border-white/10 p-3 hover:bg-white/10 transition-colors">
        {children}
    </li>
);

/* PaymentsSection — now navy cards */
const PaymentsSection = ({ paymentsSummary }) => {
    const [recentPage, setRecentPage] = useState(1);

    useEffect(() => {
        setRecentPage(1);
    }, [paymentsSummary]);

    if (!paymentsSummary) return null;

    const {
        total_collected = 0,
        refunded_total = 0,
        net_collected = 0,
        payments_count = 0,
        unique_tickets = 0,
        average_payment = 0,
        by_method = [],
        recent_payments = [],
    } = paymentsSummary;

    const maxMethodTotal = Math.max(1, ...by_method.map((m) => m.total));

    const totalRecent = recent_payments.length;
    const totalRecentPages = Math.max(
        1,
        Math.ceil(totalRecent / ITEMS_PER_PAGE),
    );
    const safePage = Math.min(recentPage, totalRecentPages);
    const recentPageItems = recent_payments.slice(
        (safePage - 1) * ITEMS_PER_PAGE,
        safePage * ITEMS_PER_PAGE,
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <NavyStat
                    label="Net Collected"
                    value={net_collected}
                    prefix="₱"
                    accent="#5FD28C"
                    sub={
                        refunded_total > 0
                            ? `Gross ${formatCurrency(
                                total_collected,
                            )} − refunds ${formatCurrency(refunded_total)}`
                            : undefined
                    }
                />
                <NavyStat
                    label="Payments Received"
                    value={payments_count}
                    accent="#F0B429"
                    sub={`${unique_tickets} unique ${unique_tickets === 1 ? 'ticket' : 'tickets'
                        }`}
                />
                <NavyStat
                    label="Average Payment"
                    value={average_payment}
                    prefix="₱"
                    accent="#C7CEDB"
                />
                <NavyStat
                    label="Refunded / Voided"
                    value={refunded_total}
                    prefix="₱"
                    accent="#F3A6AD"
                />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Collections by payment method */}
                <div className="bg-[#16233F] text-white rounded-xl p-6 shadow-sm print-card">
                    <SectionHeader
                        note={`Shows how payments received in the period were settled, by payment method. ${by_method.length} method(s) recorded, with net collections of ${formatCurrency(net_collected)} after refunds of ${formatCurrency(refunded_total)}.`}
                        icon={Wallet}
                        color={COLORS.amber}
                    >
                        Collections by payment method
                    </SectionHeader>
                    {by_method.length > 0 ? (
                        <ul className="space-y-4">
                            {by_method.map((m) => {
                                const meta = PAYMENT_METHOD_META[m.method] || {
                                    label: m.method,
                                    color: COLORS.amber,
                                    Icon: CreditCard,
                                };
                                const share =
                                    maxMethodTotal > 0
                                        ? (m.total / maxMethodTotal) * 100
                                        : 0;
                                const Icon = meta.Icon;
                                return (
                                    <RankedRow
                                        key={m.method}
                                        badge={
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                                                <Icon className="h-4 w-4 text-[#F0B429]" />
                                            </div>
                                        }
                                        primary={meta.label}
                                        secondary={`${m.count} ${m.count === 1 ? 'payment' : 'payments'}`}
                                        value={formatCurrency(m.total)}
                                        share={share}
                                        color={COLORS.amber}
                                    />
                                );
                            })}
                        </ul>
                    ) : (
                        <EmptyState
                            message="No payments collected in this period."
                            hint="Recorded receipts will appear here as staff complete them."
                            dark
                        />
                    )}
                </div>

                {/* Recent payments */}
                <div className="bg-[#16233F] text-white rounded-xl p-6 shadow-sm print-card">
                    <SectionHeader
                        note="Lists the most recent payment transactions in the period, with the receipt and ticket reference, the violator, the payment method, the amount and the date and time of payment."
                        icon={Receipt}
                        color={COLORS.amber}
                        action={
                            totalRecent > 0 ? (
                                <span className="text-xs text-[#C7CEDB] tabular-nums">
                                    {totalRecent} total
                                </span>
                            ) : null
                        }
                    >
                        Recent payments
                    </SectionHeader>
                    {totalRecent > 0 ? (
                        <>
                            <ul className="space-y-2">
                                {recentPageItems.map((p) => {
                                    const meta =
                                        PAYMENT_METHOD_META[p.payment_method] || {};
                                    return (
                                        <NavyListRow key={p.payment_id}>
                                            <div className="flex items-start justify-between gap-3 mb-2">
                                                <div className="min-w-0">
                                                    <p className="font-mono text-sm font-semibold text-white truncate">
                                                        {p.receipt_number || '—'}
                                                    </p>
                                                    <p className="text-xs text-[#C7CEDB] truncate mt-0.5">
                                                        {p.violator_name || '—'}
                                                    </p>
                                                </div>
                                                <p className="text-base font-['Oswald'] font-semibold text-[#F0B429] tabular-nums shrink-0">
                                                    {formatCurrency(p.amount_paid)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-4 flex-wrap text-[11px] text-[#8D98B3]">
                                                <span className="font-mono">
                                                    {p.ticket_number || '—'}
                                                </span>
                                                <span className="capitalize">
                                                    {meta.label || p.payment_method}
                                                </span>
                                                <span>
                                                    {p.payment_date
                                                        ? new Date(
                                                            p.payment_date,
                                                        ).toLocaleString('en-PH', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })
                                                        : '—'}
                                                </span>
                                            </div>
                                        </NavyListRow>
                                    );
                                })}
                            </ul>
                            <MiniPager
                                page={safePage}
                                onPageChange={setRecentPage}
                                total={totalRecent}
                                label="payments"
                                dark
                            />
                        </>
                    ) : (
                        <EmptyState message="No recent payments to show." dark />
                    )}
                </div>
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* Period / compare pickers                                            */
/* ------------------------------------------------------------------ */

const DailyTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload || {};
    const items = [
        ['Tickets', toNumber(row.tickets_count), COLORS.navy, false],
        ['Fines issued', toNumber(row.total_fines), COLORS.amber, true],
        ['Collected', toNumber(row.collected), COLORS.green, true],
    ];
    return (
        <div className="min-w-[180px] rounded-lg border border-[#DDE3EC] bg-white px-3.5 py-3 shadow-xl">
            <p className="mb-2 border-b border-[#E9ECF2] pb-2 text-xs font-semibold text-[#16233F]">
                {row.date ? formatLongDate(row.date) : row.day_name}
            </p>
            {items.map(([name, value, color, money]) => (
                <p key={name} className="flex items-center justify-between gap-6 py-0.5 text-xs text-[#64748B]">
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                        {name}
                    </span>
                    <span className="font-semibold tabular-nums text-[#1F2937]">
                        {money ? formatCurrency(value) : value}
                    </span>
                </p>
            ))}
        </div>
    );
};

const ChartStatsStrip = ({ stats }) => {
    const cells = [
        {
            label: 'Peak day',
            value: stats.peakCount > 0 ? `${stats.peakCount} tickets` : '—',
            sub: stats.peakCount > 0 ? formatShortDate(stats.peakDate) : 'No violations',
            accent: COLORS.red,
        },
        {
            label: 'Average per day',
            value: stats.avg.toFixed(1),
            sub: 'tickets',
            accent: COLORS.navy,
        },
        {
            label: 'Fines issued',
            value: formatCompactCurrency(stats.totalFines),
            sub: `${stats.totalTickets} tickets`,
            accent: COLORS.amberDark,
        },
        {
            label: 'Collected',
            value: formatCompactCurrency(stats.totalCollected),
            sub: stats.totalFines > 0 ? `${Math.round((stats.totalCollected / stats.totalFines) * 100)}% of fines issued` : 'no fines issued',
            accent: COLORS.green,
        },
    ];
    return (
        <div className="mb-5 grid grid-cols-2 border border-[#E3E7EE] md:grid-cols-4 md:divide-x divide-[#E3E7EE]">
            {cells.map((c) => (
                <div key={c.label} className="relative px-4 py-3">
                    <span className="absolute left-0 top-0 h-full w-1" style={{ background: c.accent }} />
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#64748B]">{c.label}</p>
                    <p className="mt-0.5 font-['Oswald'] text-2xl font-semibold tabular-nums text-[#16233F]">{c.value}</p>
                    <p className="text-[11px] text-[#64748B]">{c.sub}</p>
                </div>
            ))}
        </div>
    );
};

const DailyFiguresTable = ({ rows, stats }) => {
    if (!rows.length || rows.length > 31) return null;
    return (
        <div className="print-only" style={{ marginTop: '10px' }}>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th style={{ textAlign: 'right' }}>Tickets</th>
                        <th style={{ textAlign: 'right' }}>Fines issued</th>
                        <th style={{ textAlign: 'right' }}>Collected</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.date}>
                            <td>{formatShortDate(r.date)}</td>
                            <td style={{ textAlign: 'right' }}>{toNumber(r.tickets_count)}</td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(toNumber(r.total_fines))}</td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(toNumber(r.collected))}</td>
                        </tr>
                    ))}
                    <tr style={{ fontWeight: 700 }}>
                        <td>Total</td>
                        <td style={{ textAlign: 'right' }}>{stats.totalTickets}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(stats.totalFines)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(stats.totalCollected)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

const PeriodPicker = ({ period, value, onChange }) => {
    if (period === 'daily') {
        return (
            <Input
                type="date"
                aria-label="Report date"
                value={value.date}
                onChange={(e) => onChange({ date: e.target.value })}
                className="w-44 focus-visible:ring-[#F0B429]"
            />
        );
    }
    if (period === 'weekly') {
        return (
            <Input
                type="week"
                aria-label="Report week"
                value={value.week}
                onChange={(e) => onChange({ week: e.target.value })}
                className="w-44 focus-visible:ring-[#F0B429]"
            />
        );
    }
    if (period === 'monthly') {
        return (
            <Input
                type="month"
                aria-label="Report month"
                value={value.month}
                onChange={(e) => onChange({ month: e.target.value })}
                className="w-44 focus-visible:ring-[#F0B429]"
            />
        );
    }
    if (period === 'yearly') {
        return (
            <Input
                type="number"
                aria-label="Report year"
                min="2000"
                max="2100"
                value={value.year}
                onChange={(e) => onChange({ year: e.target.value })}
                className="w-28 focus-visible:ring-[#F0B429]"
            />
        );
    }
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Input
                type="date"
                aria-label="Start date"
                value={value.start_date}
                onChange={(e) => onChange({ start_date: e.target.value })}
                className="w-40 focus-visible:ring-[#F0B429]"
            />
            <span className="text-[#64748B]">to</span>
            <Input
                type="date"
                aria-label="End date"
                value={value.end_date}
                onChange={(e) => onChange({ end_date: e.target.value })}
                className="w-40 focus-visible:ring-[#F0B429]"
            />
        </div>
    );
};

const CompareRangePicker = ({ value, onChange, disabled }) => (
    <div className="flex flex-wrap items-center gap-2">
        <Input
            type="date"
            aria-label="Compare start date"
            value={value.compare_start}
            onChange={(e) => onChange({ compare_start: e.target.value })}
            disabled={disabled}
            className="w-40 focus-visible:ring-[#F0B429]"
        />
        <span className="text-[#64748B]">to</span>
        <Input
            type="date"
            aria-label="Compare end date"
            value={value.compare_end}
            onChange={(e) => onChange({ compare_end: e.target.value })}
            disabled={disabled}
            className="w-40 focus-visible:ring-[#F0B429]"
        />
    </div>
);

const GlobalViewToggle = ({ views, onChange }) => {
    const current = views.every((v) => v === views[0]) ? views[0] : null;
    return (
        <div
            className="no-print hidden"
            role="group"
            aria-label="Switch all sections between list and cards"
        >
            <div className="flex rounded-full bg-[#E9ECF2] p-1 text-xs">
                {[['list', 'List', ListIcon], ['cards', 'Cards', LayoutGrid]].map(([v, label, I]) => (
                    <button
                        key={v}
                        type="button"
                        onClick={() => onChange(v)}
                        aria-pressed={current === v}
                        title={`Show every section as ${label.toLowerCase()}`}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all ${current === v
                            ? 'bg-[#16233F] text-white'
                            : 'text-[#64748B] hover:text-[#16233F]'
                            }`}
                    >
                        <I className="h-3.5 w-3.5" />
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );
};

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */

const Reports = () => {
    const [period, setPeriod] = useState('daily');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [includeArchived, setIncludeArchived] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [focusTile, setFocusTile] = useState(null);
    const [printing, setPrinting] = useState(false);

    const [violationsPage, setViolationsPage] = useState(1);
    const [violatorsPage, setViolatorsPage] = useState(1);
    const [enforcersPage, setEnforcersPage] = useState(1);
    const [recentTicketsPage, setRecentTicketsPage] = useState(1);

    const [compareEnabled, setCompareEnabled] = useState(false);
    const today = new Date();
    const [picker, setPicker] = useState({
        date: toISODate(today),
        week: toISODateForWeekInput(today),
        month: toISOMonth(today),
        year: String(today.getFullYear()),
        start_date: daysAgoISO(6),
        end_date: toISODate(today),
        compare_start: daysAgoISO(13),
        compare_end: daysAgoISO(7),
    });

    useEffect(() => {
        setViolationsPage(1);
        setViolatorsPage(1);
        setEnforcersPage(1);
        setRecentTicketsPage(1);
    }, [data]);

    const ChartTooltip = ({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="rounded-lg border border-[#E9ECF2] bg-white px-3 py-2 shadow-lg">
                <p className="mb-1 text-xs font-semibold text-[#16233F]">{label}</p>
                {payload.map((entry) => (
                    <p key={entry.dataKey} className="text-xs text-[#64748B]">
                        <span
                            className="inline-block h-2 w-2 rounded-full align-middle"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="ml-1.5">{entry.name}: </span>
                        <span className="font-medium text-[#1F2937]">
                            {entry.dataKey === 'total_fines' ||
                                entry.dataKey === 'collected'
                                ? formatCurrency(entry.value)
                                : entry.value}
                        </span>
                    </p>
                ))}
            </div>
        );
    };

    const buildParams = useCallback(() => {
        const params = {
            period,
            include_archived: includeArchived ? 1 : undefined,
        };
        if (period === 'daily') params.date = picker.date;
        else if (period === 'weekly') {
            if (picker.week) params.week = picker.week;
        } else if (period === 'monthly') params.month = picker.month;
        else if (period === 'yearly') params.year = picker.year;
        else if (period === 'custom') {
            params.start_date = picker.start_date;
            params.end_date = picker.end_date;
        }

        if (compareEnabled) {
            params.compare = 1;
            params.compare_start = picker.compare_start;
            params.compare_end = picker.compare_end;
        }
        return params;
    }, [period, picker, includeArchived, compareEnabled]);

    const fetchReport = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getReport(buildParams());
            setData(response.data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Error fetching report:', err);
            setError(readApiError(err));
        } finally {
            setLoading(false);
        }
    }, [buildParams]);

    useEffect(() => {
        if (period === 'custom' && (!picker.start_date || !picker.end_date))
            return;
        if (compareEnabled && (!picker.compare_start || !picker.compare_end))
            return;
        fetchReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period, includeArchived, compareEnabled]);

    useEffect(() => {
        let saved = null;
        const before = () => {
            saved = {};
            ITEMS_PER_PAGE = 100000;
            flushSync(() => {
                setPrinting(true);
                setViolationsPage(1);
                setViolatorsPage(1);
                setEnforcersPage(1);
                setRecentTicketsPage(1);
            });
        };
        const after = () => {
            ITEMS_PER_PAGE = SCREEN_PER_PAGE;
            flushSync(() => {
                setPrinting(false);
            });
        };
        window.addEventListener('beforeprint', before);
        window.addEventListener('afterprint', after);
        return () => {
            window.removeEventListener('beforeprint', before);
            window.removeEventListener('afterprint', after);
        };
    }, []);

    const handleExportCSV = async () => {
        let range;
        if (period === 'daily')
            range = { start_date: picker.date, end_date: picker.date };
        else if (period === 'custom')
            range = {
                start_date: picker.start_date,
                end_date: picker.end_date,
            };
        else if (data?.date_range)
            range = {
                start_date: data.date_range.start,
                end_date: data.date_range.end,
            };
        else
            range = {
                start_date: picker.start_date,
                end_date: picker.end_date,
            };

        setExporting(true);
        let url;
        try {
            const response = await exportReport({
                ...range,
                include_archived: includeArchived ? 1 : undefined,
            });
            const blob = new Blob([response.data], {
                type: 'text/csv;charset=utf-8;',
            });
            url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `temu_report_${range.start_date}_to_${range.end_date}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Error exporting report:', err);
            setError(readApiError(err));
        } finally {
            if (url) window.URL.revokeObjectURL(url);
            setExporting(false);
        }
    };

    /* ---- Derived ---- */
    const summary = data?.summary || {};
    const compare = data?.compare || null;
    const deltas = compare?.deltas || null;

    const reportRange = data?.date_range || {
        start: picker.date || picker.start_date,
        end: picker.date || picker.end_date,
    };

    const compareRange = compare?.date_range || null;

    const rangeDays = useMemo(() => {
        const start = reportRange?.start;
        const end = reportRange?.end;
        if (!start || !end) return 0;
        try {
            const s = new Date(start + 'T00:00:00');
            const e = new Date(end + 'T00:00:00');
            return Math.round((e - s) / 86400000) + 1;
        } catch {
            return 0;
        }
    }, [reportRange.start, reportRange.end]);

    const allViolations = data?.top_violations || [];
    const allViolators = data?.top_violators || [];
    const allEnforcers = data?.enforcer_performance || [];
    const allRecentTickets = data?.recent_tickets || [];

    const violationsTotalPages = Math.max(
        1,
        Math.ceil(allViolations.length / ITEMS_PER_PAGE),
    );
    const violatorsTotalPages = Math.max(
        1,
        Math.ceil(allViolators.length / ITEMS_PER_PAGE),
    );
    const enforcersTotalPages = Math.max(
        1,
        Math.ceil(allEnforcers.length / ITEMS_PER_PAGE),
    );
    const recentTicketsTotalPages = Math.max(
        1,
        Math.ceil(allRecentTickets.length / ITEMS_PER_PAGE),
    );

    const violationsSafePage = Math.min(violationsPage, violationsTotalPages);
    const violatorsSafePage = Math.min(violatorsPage, violatorsTotalPages);
    const enforcersSafePage = Math.min(enforcersPage, enforcersTotalPages);
    const recentTicketsSafePage = Math.min(
        recentTicketsPage,
        recentTicketsTotalPages,
    );

    const shownViolations = allViolations.slice(
        (violationsSafePage - 1) * ITEMS_PER_PAGE,
        violationsSafePage * ITEMS_PER_PAGE,
    );
    const shownViolators = allViolators.slice(
        (violatorsSafePage - 1) * ITEMS_PER_PAGE,
        violatorsSafePage * ITEMS_PER_PAGE,
    );
    const shownEnforcers = allEnforcers.slice(
        (enforcersSafePage - 1) * ITEMS_PER_PAGE,
        enforcersSafePage * ITEMS_PER_PAGE,
    );
    const shownRecentTickets = allRecentTickets.slice(
        (recentTicketsSafePage - 1) * ITEMS_PER_PAGE,
        recentTicketsSafePage * ITEMS_PER_PAGE,
    );

    const maxTopViolation = Math.max(
        1,
        ...allViolations.map((v) => Number(v.count) || 0),
    );
    const maxTopEnforcer = Math.max(
        1,
        ...allEnforcers.map((e) => Number(e.tickets_count) || 0),
    );
    const maxTopViolator = Math.max(
        1,
        ...allViolators.map((v) => Number(v.tickets_count) || 0),
    );

    const weeklyStatusData = useMemo(() => {
        if (!summary) return [];
        return Object.keys(STATUS_META)
            .map((key) => ({
                key,
                name: STATUS_META[key].label,
                value: Number(summary[`${key}_tickets`]) || 0,
            }))
            .filter((d) => d.value > 0);
    }, [summary]);

    const weeklyStatusTotal = weeklyStatusData.reduce(
        (sum, d) => sum + d.value,
        0,
    );

    const dailyChartData = useMemo(() => {
        const base = data?.daily_breakdown || [];
        const paymentsByDate = new Map(
            (data?.payments_summary?.daily || []).map((d) => [
                d.date,
                Number(d.total) || 0,
            ]),
        );
        return base.map((d) => ({
            ...d,
            __rangeDays: rangeDays,
            collected: paymentsByDate.get(d.date) || 0,
        }));
    }, [data, rangeDays]);

    const chartStats = useMemo(() => {
        const rows = dailyChartData;
        const totalTickets = rows.reduce((a, r) => a + toNumber(r.tickets_count), 0);
        const totalFines = rows.reduce((a, r) => a + toNumber(r.total_fines), 0);
        const totalCollected = rows.reduce((a, r) => a + toNumber(r.collected), 0);
        const peak = rows.reduce(
            (best, r) => (toNumber(r.tickets_count) > toNumber(best?.tickets_count) ? r : best),
            rows[0],
        );
        return {
            totalTickets,
            totalFines,
            totalCollected,
            avg: rows.length ? totalTickets / rows.length : 0,
            peakDate: peak?.date,
            peakCount: toNumber(peak?.tickets_count),
        };
    }, [dailyChartData]);

    const xAxisFormatter = useMemo(
        () => makeXAxisFormatter(period),
        [period],
    );

    const periodLabel =
        PERIODS.find((p) => p.key === period)?.label + ' Report' || 'Report';

    const showSkeleton = loading && !data;

    const compareValid =
        !compareEnabled ||
        (picker.compare_start &&
            picker.compare_end &&
            picker.compare_start <= picker.compare_end);

    const statCards = [
        {
            key: 'total_tickets',
            title: 'Total Tickets',
            value: summary.total_tickets || 0,
            icon: Ticket,
            color: '#16233F',
            tint: '#E9ECF2',
            textColor: '#16233F',
            animated: { integer: true },
        },
        {
            key: 'paid_tickets',
            title: 'Paid Tickets',
            value: summary.paid_tickets || 0,
            icon: CheckCircle,
            color: '#1E8449',
            tint: '#E5F2EA',
            textColor: '#1E8449',
            animated: { integer: true },
        },
        {
            key: 'issued_tickets',
            title: 'Issued / Pending',
            value: summary.issued_tickets || 0,
            icon: Clock,
            color: '#F0B429',
            tint: '#FBF1DC',
            textColor: '#92600A',
            animated: { integer: true },
        },
        {
            key: 'contested_tickets',
            title: 'Contested',
            value: summary.contested_tickets || 0,
            icon: AlertTriangleIcon,
            color: '#C2541F',
            tint: '#FBEAE2',
            textColor: '#C2541F',
            animated: { integer: true },
        },
        {
            key: 'dismissed_tickets',
            title: 'Dismissed',
            value: summary.dismissed_tickets || 0,
            icon: XCircle,
            color: '#C8202F',
            tint: '#FBE7E9',
            textColor: '#C8202F',
            animated: { integer: true },
        },
        {
            key: 'collection_rate',
            title: 'Collection Rate',
            value: summary.collection_rate || 0,
            icon: TrendingUp,
            color: '#3B5170',
            tint: '#EEF1F5',
            textColor: '#3B5170',
            animated: { integer: false, suffix: '%' },
        },
    ];

    const pendingFines = Math.max(
        0,
        toNumber(summary.total_fines) -
        toNumber(data?.payments_summary?.net_collected),
    );

    const chips = [
        includeArchived && [
            'Including archived',
            () => setIncludeArchived(false),
        ],
        compareEnabled && [
            `Compare: ${picker.compare_start || '…'} → ${picker.compare_end || '…'
            }`,
            () => setCompareEnabled(false),
        ],
    ].filter((x) => x && x[1]);

    const panel = (
        <aside className="self-start rounded-xl bg-[#FBF1DC] border-t-4 border-[#F0B429] p-5 space-y-5 lg:sticky lg:top-4">
            <div className="flex justify-between items-center">
                <h3 className="text-base font-['Oswald'] font-medium text-[#16233F]">
                    Report Options
                </h3>
                <button
                    onClick={() => setShowFilters(false)}
                    className="p-1 rounded hover:bg-[#F0B429]/25"
                >
                    <X className="w-4 h-4 text-[#92600A]" />
                </button>
            </div>

            <div>
                <FieldLabel icon={Calendar}>Primary period</FieldLabel>
                <p className="text-xs text-[#64748B] mb-2">
                    Controlled by the tabs above. Switch tabs or use the
                    pickers next to them to change.
                </p>
                <div className="text-sm font-medium text-[#16233F] p-2 rounded bg-white border border-[#E3E7EE]">
                    {data?.label || periodLabel}
                </div>
            </div>

            <div>
                <FieldLabel icon={Scale}>Compare with another range</FieldLabel>
                <label className="flex items-center gap-2 text-sm text-[#92600A] cursor-pointer mb-2">
                    <input
                        type="checkbox"
                        checked={compareEnabled}
                        onChange={(e) => setCompareEnabled(e.target.checked)}
                        className="w-4 h-4 accent-[#92600A]"
                    />
                    Enable comparison
                </label>
                {compareEnabled && (
                    <>
                        <CompareRangePicker
                            value={picker}
                            onChange={(patch) =>
                                setPicker((prev) => ({ ...prev, ...patch }))
                            }
                        />
                        {!compareValid && (
                            <p className="text-xs text-[#C8202F] mt-2">
                                Compare start date must be before or equal to
                                the end date.
                            </p>
                        )}
                    </>
                )}
            </div>

            <div>
                <FieldLabel icon={Archive}>Archived records</FieldLabel>
                <label className="flex items-center gap-2 text-sm text-[#92600A] cursor-pointer">
                    <input
                        type="checkbox"
                        checked={includeArchived}
                        onChange={(e) => setIncludeArchived(e.target.checked)}
                        className="w-4 h-4 accent-[#92600A]"
                    />
                    Include archived records in this report
                </label>
            </div>

            <div className="flex gap-2 pt-3 border-t border-[#F0B429]/30">
                <Button
                    onClick={() => setShowFilters(false)}
                    className="bg-[#1E8449] hover:bg-[#186B3B]"
                >
                    Apply Options
                </Button>
                <Button
                    onClick={() => {
                        setCompareEnabled(false);
                        setIncludeArchived(false);
                    }}
                    variant="ghost"
                    className="text-[#64748B] hover:text-[#C8202F]"
                >
                    <X className="w-4 h-4 mr-1" />
                    Reset
                </Button>
            </div>
        </aside>
    );

    return (
        <div className="pb-10 print-report space-y-6 font-['Inter']">
            <PrintStyles refNo={makeRefNo(periodLabel, reportRange)} />
            <PrintHeader
                periodLabel={periodLabel}
                dateRange={reportRange}
                compareRange={compareRange}
                generatedAt={lastUpdated || new Date()}
                includeArchived={includeArchived}
                summary={summary}
            />
            <PrintFooter />
            <PrintNarrative
                periodLabel={periodLabel}
                dateRange={reportRange}
                rangeDays={rangeDays}
                summary={summary}
                chartStats={chartStats}
                payments={data?.payments_summary}
                violations={allViolations}
                violators={allViolators}
                enforcers={allEnforcers}
                compare={compare}
                includeArchived={includeArchived}
                generatedAt={lastUpdated || new Date()}
            />

            <header className="relative overflow-hidden rounded-2xl bg-[#16233F] text-white px-6 py-7 flex flex-wrap items-center justify-between gap-4 print:hidden">
                <div
                    className="absolute inset-0 opacity-[0.07] pointer-events-none"
                    style={{
                        backgroundImage:
                            'repeating-linear-gradient(115deg, transparent 0 40px, #F0B429 40px 42px)',
                    }}
                />
                <span className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#16233F] via-[#C8202F] to-[#F0B429]" />
                <div className="relative">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-[#F0B429] mb-1.5">
                        TEMU Command Center · Official Records
                    </p>
                    <h1 className="text-4xl font-['Oswald'] font-semibold tracking-tight">
                        Reports &amp; Analytics
                    </h1>
                    <p className="text-[#C7CEDB] text-sm mt-1">
                        {lastUpdated
                            ? `Updated ${lastUpdated.toLocaleTimeString('en-PH', {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}${data?.label ? ` · ${data.label}` : ''}`
                            : 'Generate and view detailed reports'}
                    </p>
                </div>
                <div className="relative flex flex-wrap items-center gap-3">
                    <div className="hidden sm:flex gap-1.5">
                        {['#C8202F', '#F0B429', '#1E8449'].map((c) => (
                            <span
                                key={c}
                                className="w-3 h-3 rounded-full"
                                style={{ background: c }}
                            />
                        ))}
                    </div>
                    <Button
                        onClick={fetchReport}
                        variant="outline"
                        disabled={loading}
                        className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
                    >
                        <RefreshCw
                            className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''
                                }`}
                        />
                        Refresh
                    </Button>
                    <Button
                        onClick={() => window.print()}
                        variant="outline"
                        className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
                    >
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                    </Button>
                    <Button
                        onClick={handleExportCSV}
                        variant="outline"
                        disabled={exporting}
                        className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
                    >
                        {exporting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="mr-2 h-4 w-4" />
                        )}
                        {exporting ? 'Exporting…' : 'CSV'}
                    </Button>
                </div>
            </header>

            <Tabs
                value={period}
                onValueChange={(v) => {
                    setPeriod(v);
                    setData(null);
                    setFocusTile(null);
                }}
                className="space-y-6"
            >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between print:hidden">
                    <TabsList className="bg-[#E9ECF2] flex-wrap h-auto">
                        {PERIODS.map((p) => (
                            <TabsTrigger
                                key={p.key}
                                value={p.key}
                                className="data-[state=active]:bg-[#16233F] data-[state=active]:text-white"
                            >
                                {p.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <div className="flex flex-wrap items-center gap-3">
                        <PeriodPicker
                            period={period}
                            value={picker}
                            onChange={(patch) =>
                                setPicker((prev) => ({ ...prev, ...patch }))
                            }
                        />
                        <Button
                            variant="outline"
                            onClick={() => setShowFilters((v) => !v)}
                            className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
                        >
                            <Filter className="w-4 h-4 mr-2" />
                            Options
                            {(compareEnabled || includeArchived) && (
                                <span className="ml-2 bg-[#16233F] text-white text-xs rounded-full px-2 py-0.5">
                                    {(compareEnabled ? 1 : 0) +
                                        (includeArchived ? 1 : 0)}
                                </span>
                            )}
                        </Button>
                        <Button
                            onClick={fetchReport}
                            disabled={loading || !compareValid}
                            className="bg-[#16233F] text-white hover:bg-[#16233F]/90"
                        >
                            Apply
                        </Button>
                    </div>
                </div>

                {chips.length > 0 && (
                    <div className="flex flex-wrap gap-2 print:hidden">
                        {chips.map(([label, clear]) => (
                            <Chip key={label} label={label} onClear={clear} />
                        ))}
                    </div>
                )}

                <div
                    className={`grid gap-6 ${showFilters ? 'lg:grid-cols-[300px_minmax(0,1fr)]' : ''
                        }`}
                >
                    {showFilters && panel}

                    <div className="space-y-6 min-w-0">
                        {error && (
                            <ErrorState message={error} onRetry={fetchReport} />
                        )}

                        <TabsContent value={period} className="mt-0 space-y-6">
                            {showSkeleton ? (
                                <ReportSkeleton />
                            ) : data ? (
                                <>
                                    <section className="bg-white rounded-xl border border-[#E3E7EE] grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 overflow-hidden print-card">
                                        {statCards.map((s) => (
                                            <StatTile
                                                key={s.key}
                                                title={s.title}
                                                value={s.value}
                                                icon={s.icon}
                                                color={s.color}
                                                tint={s.tint}
                                                textColor={s.textColor}
                                                animated={s.animated}
                                                clickable
                                                active={focusTile === s.key}
                                                onClick={() =>
                                                    setFocusTile(
                                                        focusTile === s.key
                                                            ? null
                                                            : s.key,
                                                    )
                                                }
                                            />
                                        ))}
                                    </section>

                                    {/* FULL-WIDTH CHART */}
                                    <section className="bg-white border-t-4 border-[#16233F] rounded-b-xl p-6 shadow-sm print-card">
                                        <SectionHeader note={`Daily trend of tickets issued (bars), fines issued and amounts collected (lines) over ${rangeDays} day(s). The average is ${chartStats.avg.toFixed(1)} ticket(s) per day.${chartStats.peakCount > 0 ? ` The peak was ${formatLongDate(chartStats.peakDate)} with ${chartStats.peakCount} ticket(s).` : ''} The table below the chart gives the exact daily figures.`}
                                            icon={BarChart3}
                                            color={COLORS.navy}
                                        >
                                            Tickets, fines &amp; collections
                                            per day
                                            <span className="text-xs font-normal text-[#64748B] font-['Inter'] ml-2">
                                                (primary range)
                                            </span>
                                        </SectionHeader>
                                        {dailyChartData.length === 0 ? (
                                            <EmptyState message="No data available for this period." />
                                        ) : (
                                            <>
                                                <ChartStatsStrip stats={chartStats} />
                                                {printing ? (
                                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                        <ComposedChart width={680} height={300} data={dailyChartData}>
                                                            <CartesianGrid strokeDasharray="2 4" stroke="#DDE3EC" vertical={false} />
                                                            <XAxis dataKey="date" tickFormatter={xAxisFormatter} tick={{ fontSize: 12, fill: COLORS.slate }} axisLine={{ stroke: '#B8C1D1' }} tickLine={false} interval="preserveStartEnd" minTickGap={16} tickMargin={8} />
                                                            <YAxis yAxisId="left" allowDecimals={false} width={44} tick={{ fontSize: 12, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                                                            <YAxis yAxisId="right" orientation="right" width={58} tickFormatter={formatCompactCurrency} tick={{ fontSize: 12, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                                                            <Bar yAxisId="left" dataKey="tickets_count" name="Tickets" fill={COLORS.navy} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false} />
                                                            <Area yAxisId="right" type="monotone" dataKey="total_fines" name="Fines issued" stroke={COLORS.amber} strokeWidth={2.5} fill="url(#gradFines)" dot={false} isAnimationActive={false} />
                                                            <Line yAxisId="right" type="monotone" dataKey="collected" name="Collected" stroke={COLORS.green} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} isAnimationActive={false} />
                                                        </ComposedChart>
                                                    </div>
                                                ) : (
                                                    <ResponsiveContainer width="100%" height={400}>
                                                        <ComposedChart
                                                            data={dailyChartData}
                                                            margin={{ top: 22, right: 4, left: 0, bottom: 4 }}
                                                            barCategoryGap="24%"
                                                        >
                                                            <defs>
                                                                <linearGradient id="gradTickets" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="0%" stopColor="#2F4778" />
                                                                    <stop offset="100%" stopColor={COLORS.navy} />
                                                                </linearGradient>
                                                                <linearGradient id="gradFines" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="0%" stopColor={COLORS.amber} stopOpacity={0.4} />
                                                                    <stop offset="100%" stopColor={COLORS.amber} stopOpacity={0.02} />
                                                                </linearGradient>
                                                            </defs>
                                                            <CartesianGrid strokeDasharray="2 4" stroke="#DDE3EC" vertical={false} />
                                                            <XAxis
                                                                dataKey="date"
                                                                tickFormatter={xAxisFormatter}
                                                                tick={{ fontSize: 12, fill: COLORS.slate }}
                                                                axisLine={{ stroke: '#B8C1D1' }}
                                                                tickLine={false}
                                                                interval="preserveStartEnd"
                                                                minTickGap={16}
                                                                tickMargin={8}
                                                            />
                                                            <YAxis
                                                                yAxisId="left"
                                                                allowDecimals={false}
                                                                width={44}
                                                                tick={{ fontSize: 12, fill: COLORS.slate }}
                                                                axisLine={false}
                                                                tickLine={false}
                                                                label={{ value: 'Tickets', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: COLORS.slate, letterSpacing: 1 } }}
                                                            />
                                                            <YAxis
                                                                yAxisId="right"
                                                                orientation="right"
                                                                width={58}
                                                                tickFormatter={formatCompactCurrency}
                                                                tick={{ fontSize: 12, fill: COLORS.slate }}
                                                                axisLine={false}
                                                                tickLine={false}
                                                                label={{ value: 'Amount (₱)', angle: 90, position: 'insideRight', offset: 4, style: { fontSize: 11, fill: COLORS.slate, letterSpacing: 1 } }}
                                                            />
                                                            <Tooltip
                                                                content={<DailyTooltip />}
                                                                cursor={{ fill: COLORS.navy, fillOpacity: 0.05 }}
                                                            />
                                                            <Legend
                                                                verticalAlign="top"
                                                                align="right"
                                                                iconType="circle"
                                                                iconSize={8}
                                                                wrapperStyle={{ fontSize: 12, paddingBottom: 14 }}
                                                            />
                                                            {dailyChartData.length > 1 && chartStats.avg > 0 && (
                                                                <ReferenceLine
                                                                    yAxisId="left"
                                                                    y={chartStats.avg}
                                                                    stroke={COLORS.slate}
                                                                    strokeDasharray="5 4"
                                                                    label={{ value: `Avg ${chartStats.avg.toFixed(1)}/day`, position: 'insideTopLeft', fontSize: 10, fill: COLORS.slate }}
                                                                />
                                                            )}
                                                            <Bar
                                                                yAxisId="left"
                                                                dataKey="tickets_count"
                                                                name="Tickets"
                                                                fill={COLORS.navy}
                                                                radius={[4, 4, 0, 0]}
                                                                maxBarSize={56}
                                                                isAnimationActive={!printing}
                                                            >
                                                                {dailyChartData.map((row) => (
                                                                    <Cell
                                                                        key={row.date}
                                                                        fill={
                                                                            chartStats.peakCount > 0 && row.date === chartStats.peakDate
                                                                                ? COLORS.red
                                                                                : 'url(#gradTickets)'
                                                                        }
                                                                    />
                                                                ))}
                                                                {dailyChartData.length <= 14 && (
                                                                    <LabelList
                                                                        dataKey="tickets_count"
                                                                        position="top"
                                                                        formatter={(v) => (v > 0 ? v : '')}
                                                                        style={{ fontSize: 11, fontWeight: 600, fill: COLORS.navy }}
                                                                    />
                                                                )}
                                                            </Bar>
                                                            <Area
                                                                yAxisId="right"
                                                                type="monotone"
                                                                dataKey="total_fines"
                                                                name="Fines issued"
                                                                stroke={COLORS.amber}
                                                                strokeWidth={2.5}
                                                                fill="url(#gradFines)"
                                                                dot={false}
                                                                activeDot={{ r: 5 }}
                                                                isAnimationActive={!printing}
                                                            />
                                                            <Line
                                                                yAxisId="right"
                                                                type="monotone"
                                                                dataKey="collected"
                                                                name="Collected"
                                                                stroke={COLORS.green}
                                                                strokeWidth={2.5}
                                                                dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
                                                                activeDot={{ r: 5 }}
                                                                isAnimationActive={!printing}
                                                            />
                                                        </ComposedChart>
                                                    </ResponsiveContainer>
                                                )}
                                                <p className="mt-2 text-[11px] text-[#64748B]">
                                                    <span className="mr-1 inline-block h-2 w-2 align-middle" style={{ background: COLORS.red }} />
                                                    Highlighted bar marks the peak day. Dashed line shows the average tickets per day.
                                                </p>
                                                <DailyFiguresTable rows={dailyChartData} stats={chartStats} />
                                            </>
                                        )}
                                    </section>

                                    {/* STATUS DONUT — light card with matching header */}
                                    <section className="bg-[#F6F1E4] rounded-xl p-6 print-card">
                                        <SectionHeader note={`Breakdown of the ${weeklyStatusTotal} ticket(s) by current status: issued, paid, contested and dismissed. Percentages are computed on the total shown.`}
                                            icon={TrendingUp}
                                            color={COLORS.compare}
                                        >
                                            Status Distribution
                                        </SectionHeader>
                                        {weeklyStatusData.length === 0 ? (
                                            <EmptyState message="No data available." />
                                        ) : (
                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                                                <div className="lg:col-span-5">
                                                    {printing ? (
                                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                            <RePieChart width={320} height={210}>
                                                                <Pie
                                                                    data={weeklyStatusData}
                                                                    dataKey="value"
                                                                    isAnimationActive={false}
                                                                    nameKey="name"
                                                                    innerRadius={55}
                                                                    outerRadius={90}
                                                                    paddingAngle={2}
                                                                >
                                                                    {weeklyStatusData.map((entry) => (
                                                                        <Cell key={entry.key} fill={STATUS_META[entry.key].color} />
                                                                    ))}
                                                                </Pie>
                                                            </RePieChart>
                                                        </div>
                                                    ) : (
                                                        <ResponsiveContainer width="100%" height={260}>
                                                            <RePieChart>
                                                                <Pie
                                                                    data={weeklyStatusData}
                                                                    dataKey="value"
                                                                    isAnimationActive={!printing}
                                                                    nameKey="name"
                                                                    innerRadius={55}
                                                                    outerRadius={90}
                                                                    paddingAngle={2}
                                                                    onClick={(d) =>
                                                                        setFocusTile(
                                                                            focusTile === d.key ? null : d.key,
                                                                        )
                                                                    }
                                                                    style={{ cursor: 'pointer' }}
                                                                >
                                                                    {weeklyStatusData.map((entry) => (
                                                                        <Cell
                                                                            key={entry.key}
                                                                            fill={STATUS_META[entry.key].color}
                                                                            fillOpacity={!focusTile || focusTile === entry.key ? 1 : 0.3}
                                                                            stroke={focusTile === entry.key ? '#16233F' : 'none'}
                                                                            strokeWidth={2}
                                                                        />
                                                                    ))}
                                                                </Pie>
                                                                <Tooltip content={<ChartTooltip />} />
                                                            </RePieChart>
                                                        </ResponsiveContainer>
                                                    )}
                                                </div>
                                                <div className="lg:col-span-7">
                                                    <ul className="space-y-3">
                                                        {weeklyStatusData.map((entry) => {
                                                            const meta = STATUS_META[entry.key];
                                                            const share =
                                                                weeklyStatusTotal > 0
                                                                    ? Math.round((entry.value / weeklyStatusTotal) * 100)
                                                                    : 0;
                                                            return (
                                                                <li key={entry.key} className="flex items-center gap-3">
                                                                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                                                                    <span className="text-sm text-[#1F2937] flex-1">{meta.label}</span>
                                                                    <span className="text-sm font-semibold text-[#1F2937] tabular-nums">{entry.value}</span>
                                                                    <span className="text-xs text-[#64748B] w-12 text-right tabular-nums">{share}%</span>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                    <p className="text-xs text-[#64748B] mt-4 text-center">
                                                        Showing{' '}
                                                        <span className="font-semibold text-[#16233F] tabular-nums">{weeklyStatusData.length}</span>{' '}
                                                        {weeklyStatusData.length === 1 ? 'status' : 'statuses'} ·{' '}
                                                        <span className="font-semibold text-[#16233F] tabular-nums">
                                                            <AnimatedValue value={weeklyStatusTotal} />
                                                        </span>{' '}
                                                        total tickets
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </section>

                                    {compare && compareRange && (
                                        <section className="bg-white rounded-sm border border-[#16233F]/70 p-6 shadow-[3px_3px_0_0_rgba(22,35,63,0.08)] print-card print-avoid-break">
                                            <SectionHeader note="Side-by-side comparison of the primary and compare ranges. The change column shows the movement of each measure relative to the compare range."
                                                icon={Scale}
                                                color={COLORS.compare}
                                            >
                                                Detailed comparison
                                            </SectionHeader>
                                            <CompareTable
                                                primary={summary}
                                                compare={compare.summary}
                                                primaryRange={reportRange}
                                                compareRange={compareRange}
                                            />
                                        </section>
                                    )}

                                    {/* Top violations + Enforcer performance — navy cards */}
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                        <section className="lg:col-span-6 bg-[#16233F] text-white rounded-xl p-6 print-card">
                                            <SectionHeader note={`The most frequently recorded violations in the period, ranked by number of occurrences, with the total fines attached to each. ${allViolations.length} violation type(s) recorded.`}
                                                icon={AlertTriangleIcon}
                                                color={COLORS.amber}
                                            >
                                                Top violations
                                                <span className="text-xs font-normal text-[#C7CEDB] font-['Inter'] ml-2">
                                                    (primary range)
                                                </span>
                                            </SectionHeader>
                                            {allViolations.length ? (
                                                <>
                                                    <ul className="space-y-4">
                                                        {shownViolations.map((v, idx) => {
                                                            const rank = (violationsSafePage - 1) * ITEMS_PER_PAGE + idx + 1;
                                                            const share = ((Number(v.count) || 0) / maxTopViolation) * 100;
                                                            return (
                                                                <RankedRow
                                                                    key={v.violation_id ?? v.violation_name ?? idx}
                                                                    rank={rank}
                                                                    primary={v.violation_name}
                                                                    secondary={`${formatCurrency(v.total_fine)} in fines`}
                                                                    value={`${v.count}×`}
                                                                    share={share}
                                                                    color={COLORS.amber}
                                                                />
                                                            );
                                                        })}
                                                    </ul>
                                                    <MiniPager
                                                        page={violationsSafePage}
                                                        onPageChange={setViolationsPage}
                                                        total={allViolations.length}
                                                        label="violations"
                                                        dark
                                                    />
                                                </>
                                            ) : (
                                                <EmptyState message="No violations in this range." dark />
                                            )}
                                        </section>

                                        <section className="lg:col-span-6 bg-[#16233F] text-white rounded-xl p-6 print-card">
                                            <SectionHeader note={`Number of tickets issued by each enforcer in the period, ranked from highest to lowest. ${allEnforcers.length} enforcer(s) with recorded activity.`}
                                                icon={Users}
                                                color={COLORS.amber}
                                            >
                                                Enforcer performance
                                                <span className="text-xs font-normal text-[#C7CEDB] font-['Inter'] ml-2">
                                                    (primary range)
                                                </span>
                                            </SectionHeader>
                                            {allEnforcers.length ? (
                                                <>
                                                    <ul className="space-y-4">
                                                        {shownEnforcers.map((e, idx) => {
                                                            const share = ((Number(e.tickets_count) || 0) / maxTopEnforcer) * 100;
                                                            return (
                                                                <RankedRow
                                                                    key={e.user_id ?? e.name ?? idx}
                                                                    badge={
                                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F0B429] text-[#16233F] text-xs font-bold">
                                                                            {getInitials(e.name)}
                                                                        </div>
                                                                    }
                                                                    primary={e.name}
                                                                    value={`${e.tickets_count} tickets`}
                                                                    share={share}
                                                                    color={COLORS.amber}
                                                                />
                                                            );
                                                        })}
                                                    </ul>
                                                    <MiniPager
                                                        page={enforcersSafePage}
                                                        onPageChange={setEnforcersPage}
                                                        total={allEnforcers.length}
                                                        label="enforcers"
                                                        dark
                                                    />
                                                </>
                                            ) : (
                                                <EmptyState message="No tickets issued in this range." dark />
                                            )}
                                        </section>
                                    </div>

                                    {/* Repeat violators + Status breakdown */}
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                        <section className="lg:col-span-7 bg-[#16233F] text-white rounded-xl p-6 print-card">
                                            <SectionHeader note={`Violators with the highest number of tickets in the period, identified by name and license number. ${allViolators.length} violator(s) listed.`}
                                                icon={Users}
                                                color={COLORS.amber}
                                            >
                                                Repeat violators
                                                <span className="text-xs font-normal text-[#C7CEDB] font-['Inter'] ml-2">
                                                    (primary range)
                                                </span>
                                            </SectionHeader>
                                            {allViolators.length ? (
                                                <>
                                                    <ul className="space-y-4">
                                                        {shownViolators.map((v, idx) => {
                                                            const rank = (violatorsSafePage - 1) * ITEMS_PER_PAGE + idx + 1;
                                                            const share = ((Number(v.tickets_count) || 0) / maxTopViolator) * 100;
                                                            const name =
                                                                [v.firstname, v.lastname].filter(Boolean).join(' ') ||
                                                                'Unnamed violator';
                                                            return (
                                                                <RankedRow
                                                                    key={v.violator_id ?? v.license ?? idx}
                                                                    rank={rank}
                                                                    primary={name}
                                                                    secondary={v.license}
                                                                    value={`${v.tickets_count} tickets`}
                                                                    share={share}
                                                                    color={COLORS.amber}
                                                                />
                                                            );
                                                        })}
                                                    </ul>
                                                    <MiniPager
                                                        page={violatorsSafePage}
                                                        onPageChange={setViolatorsPage}
                                                        total={allViolators.length}
                                                        label="violators"
                                                        dark
                                                    />
                                                </>
                                            ) : (
                                                <EmptyState message="No repeat violators in this range." dark />
                                            )}
                                        </section>

                                        <section className="lg:col-span-5 bg-[#16233F] text-white rounded-xl p-6 print-card">
                                            <SectionHeader note="Count of tickets for each status in the primary range, showing how the issued tickets have progressed toward settlement."
                                                icon={TrendingUp}
                                                color={COLORS.amber}
                                            >
                                                Status breakdown
                                                <span className="text-xs font-normal text-[#C7CEDB] font-['Inter'] ml-2">
                                                    (primary range)
                                                </span>
                                            </SectionHeader>
                                            <div className="grid grid-cols-2 gap-3">
                                                {Object.keys(STATUS_META).map((key) => {
                                                    const meta = STATUS_META[key];
                                                    const count = Number(summary[`${key}_tickets`]) || 0;
                                                    const share =
                                                        weeklyStatusTotal > 0
                                                            ? Math.round((count / weeklyStatusTotal) * 100)
                                                            : 0;
                                                    const Icon = meta.Icon;
                                                    return (
                                                        <div
                                                            key={key}
                                                            className="p-4 rounded-lg bg-white/5 border border-white/10"
                                                        >
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Icon className="w-4 h-4" style={{ color: meta.color }} />
                                                                <span className="text-xs text-[#C7CEDB]">
                                                                    {meta.label}
                                                                </span>
                                                            </div>
                                                            <p className="text-2xl font-['Oswald'] font-semibold text-white tabular-nums leading-none">
                                                                <AnimatedValue value={count} />
                                                            </p>
                                                            <p className="text-[11px] text-[#8D98B3] mt-2 tabular-nums">
                                                                {share}% of total
                                                            </p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    </div>

                                    {/* Financial + Recent tickets */}
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                        <section className="lg:col-span-5 bg-[#16233F] text-white rounded-xl p-6 print-card">
                                            <SectionHeader note="Summary of the financial figures for the period, expressed in Philippine Peso (₱)."
                                                icon={PhilippinePeso}
                                                color={COLORS.amber}
                                            >
                                                Financial Summary
                                            </SectionHeader>

                                            <div className="flex justify-between text-sm mb-3">
                                                <span className="text-[#C7CEDB]">
                                                    Collection Rate
                                                </span>
                                                <span className="font-semibold text-[#F0B429] tabular-nums">
                                                    {summary.collection_rate || 0}%
                                                </span>
                                            </div>
                                            <div className="relative h-8 mb-6">
                                                <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-[#0C1427]" />
                                                <div
                                                    className="absolute left-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-[#1E8449] transition-all duration-1000"
                                                    style={{
                                                        width: `${Math.min(
                                                            toNumber(summary.collection_rate),
                                                            100,
                                                        )}%`,
                                                    }}
                                                />
                                                <div
                                                    className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 bg-[#F0B429] text-[#16233F] rounded-full p-1.5"
                                                    style={{
                                                        left: `calc(${Math.min(
                                                            toNumber(summary.collection_rate),
                                                            100,
                                                        )}% - 14px)`,
                                                    }}
                                                >
                                                    <Car className="w-4 h-4" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                                    <p className="text-xs text-[#C7CEDB] mb-1">
                                                        Collected Fines
                                                    </p>
                                                    <p className="text-2xl font-['Oswald'] font-semibold text-[#5FD28C] tabular-nums">
                                                        <AnimatedValue
                                                            value={
                                                                data?.payments_summary?.net_collected
                                                            }
                                                            prefix="₱"
                                                        />
                                                    </p>
                                                </div>
                                                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                                    <p className="text-xs text-[#C7CEDB] mb-1">
                                                        Pending Collection
                                                    </p>
                                                    <p className="text-2xl font-['Oswald'] font-semibold text-[#F0B429] tabular-nums">
                                                        <AnimatedValue
                                                            value={pendingFines}
                                                            prefix="₱"
                                                        />
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-baseline mt-6 pt-4 border-t border-white/10">
                                                <span className="text-[#C7CEDB] text-sm">
                                                    Total Fines Issued
                                                </span>
                                                <span className="text-2xl font-['Oswald'] font-semibold tabular-nums">
                                                    <AnimatedValue
                                                        value={summary.total_fines}
                                                        prefix="₱"
                                                    />
                                                </span>
                                            </div>
                                        </section>

                                        <section className="lg:col-span-7 bg-[#16233F] text-white rounded-xl p-6 print-card">
                                            <SectionHeader note="The most recent tickets in the period with their reference, violator, status, date of violation and fine amount. All entries are listed in this printed copy."
                                                icon={Ticket}
                                                color={COLORS.amber}
                                                action={
                                                    <span className="text-xs text-[#C7CEDB] tabular-nums">
                                                        {allRecentTickets.length} total
                                                    </span>
                                                }
                                            >
                                                Recent Tickets
                                            </SectionHeader>

                                            {allRecentTickets.length ? (
                                                <>
                                                    <ul className="space-y-2">
                                                        {shownRecentTickets.map((t) => {
                                                            const s = STATUS_META[t.status];
                                                            const Icon = s?.Icon;
                                                            return (
                                                                <NavyListRow key={t.ticket_id ?? t.ticket_number}>
                                                                    <div className="flex items-start justify-between gap-3 mb-2">
                                                                        <div className="min-w-0">
                                                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                                <span className="font-mono text-sm font-semibold text-white">
                                                                                    {t.ticket_number}
                                                                                </span>
                                                                                {s && (
                                                                                    <span
                                                                                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                                                                                        style={{ background: s.tint, color: s.color }}
                                                                                    >
                                                                                        <Icon className="w-3 h-3" />
                                                                                        {t.status?.toUpperCase()}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <p className="text-xs text-[#C7CEDB] truncate">
                                                                                {t.violator?.firstname}{' '}
                                                                                {t.violator?.lastname}
                                                                            </p>
                                                                        </div>
                                                                        <p className="text-base font-['Oswald'] font-semibold text-[#F0B429] tabular-nums shrink-0">
                                                                            ₱
                                                                            {getTotalFineFromTicket(t).toLocaleString()}
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex items-center gap-4 flex-wrap text-[11px] text-[#8D98B3]">
                                                                        <span className="inline-flex items-center gap-1">
                                                                            <Car className="w-3 h-3" />
                                                                            {t.vehicle?.platenumber || '—'}
                                                                        </span>
                                                                        <span className="inline-flex items-center gap-1">
                                                                            <Calendar className="w-3 h-3" />
                                                                            {t.violation_datetime
                                                                                ? new Date(t.violation_datetime).toLocaleDateString()
                                                                                : 'N/A'}
                                                                        </span>
                                                                    </div>
                                                                </NavyListRow>
                                                            );
                                                        })}
                                                    </ul>
                                                    <MiniPager
                                                        page={recentTicketsSafePage}
                                                        onPageChange={setRecentTicketsPage}
                                                        total={allRecentTickets.length}
                                                        label="tickets"
                                                        dark
                                                    />
                                                </>
                                            ) : (
                                                <EmptyState message="No tickets in this range." dark />
                                            )}
                                        </section>
                                    </div>

                                    {data.payments_summary && (
                                        <section className="bg-[#16233F] space-y-4 print-card print-avoid-break">
                                            <SectionHeader note="Detailed account of payments received in the primary range: total collected, refunds, net collected, and the number of payments and tickets covered."
                                                icon={Receipt}
                                                color={COLORS.green}
                                            >
                                                Payments collected
                                                <span className="text-xs font-normal text-[#64748B] font-['Inter'] ml-2">
                                                    (primary range)
                                                </span>
                                            </SectionHeader>
                                            <PaymentsSection
                                                paymentsSummary={data.payments_summary}
                                            />
                                        </section>
                                    )}

                                    {compare?.payments_summary && (
                                        <section className="bg-[#16233F] space-y-4 print-card print-avoid-break">
                                            <SectionHeader note="The same payment figures for the compare range, provided for reference against the primary range."
                                                icon={Scale}
                                                color={COLORS.compare}
                                            >
                                                Payments collected{' '}
                                                <span className="text-[#3B5170]">
                                                    (compare range)
                                                </span>
                                            </SectionHeader>
                                            <div className="text-xs text-[#64748B]">
                                                {formatShortDate(compareRange.start)} –{' '}
                                                {formatShortDate(compareRange.end)}
                                            </div>
                                            <PaymentsSection
                                                paymentsSummary={compare.payments_summary}
                                            />
                                        </section>
                                    )}

                                    {/* Quick stats band — navy */}
                                    <section className="bg-[#16233F] text-white rounded-xl grid grid-cols-2 md:grid-cols-4 md:divide-x divide-white/10 print-card">
                                        {[
                                            {
                                                icon: Ticket,
                                                fg: '#F0B429',
                                                value: summary.total_tickets || 0,
                                                label: 'Total Violations',
                                            },
                                            {
                                                icon: CheckCircle,
                                                fg: '#5FD28C',
                                                value: summary.paid_tickets || 0,
                                                label: 'Resolved Cases',
                                            },
                                            {
                                                icon: Clock,
                                                fg: '#F0B429',
                                                value: summary.issued_tickets || 0,
                                                label: 'Active Cases',
                                            },
                                            {
                                                icon: TrendingUp,
                                                fg: '#C7CEDB',
                                                value: summary.collection_rate || 0,
                                                suffix: '%',
                                                label: 'Efficiency Rate',
                                            },
                                        ].map((q) => (
                                            <div key={q.label} className="p-5 flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-white/10">
                                                    <q.icon className="w-5 h-5" style={{ color: q.fg }} />
                                                </div>
                                                <div>
                                                    <p className="text-2xl font-['Oswald'] font-semibold tabular-nums">
                                                        <AnimatedValue
                                                            value={q.value}
                                                            suffix={q.suffix || ''}
                                                            integer={q.suffix !== '%'}
                                                        />
                                                    </p>
                                                    <p className="text-xs text-[#C7CEDB]">{q.label}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </section>
                                </>
                            ) : (
                                !error && (
                                    <EmptyState message="No data available for this period." />
                                )
                            )}
                        </TabsContent>
                    </div>
                </div>
            </Tabs>
            <PrintNotes generatedAt={lastUpdated || new Date()} includeArchived={includeArchived} />
            <PrintSignatures />
            <PrintEndFooter refNo={makeRefNo(periodLabel, reportRange)} generatedAt={lastUpdated || new Date()} />
        </div>
    );
};

export default Reports;