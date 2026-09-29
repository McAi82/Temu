// resources/js/pages/Reports.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
    Download,
    TrendingUp,
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
} from 'lucide-react';
import { getTodayReport, getWeeklyReport, exportReport } from '../services/api';
import {
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    PieChart as RePieChart,
    Pie,
    Cell,
} from 'recharts';
import temuLogo from '../assets/temu-logo.png';

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
};

const STATUS_META = {
    issued: { label: 'Issued', color: COLORS.amberDark, bg: '#FBF1DC', Icon: Clock },
    paid: { label: 'Paid', color: COLORS.green, bg: '#E5F2EA', Icon: CheckCircle },
    contested: { label: 'Contested', color: COLORS.orange, bg: '#FBEAE2', Icon: AlertCircle },
    dismissed: { label: 'Dismissed', color: COLORS.red, bg: '#FBE7E9', Icon: XCircle },
};

const PAYMENT_METHOD_META = {
    cash: { label: 'Cash', color: COLORS.green, bg: '#E5F2EA', Icon: Banknote },
    gcash: { label: 'GCash', color: '#1E40AF', bg: '#EEF1F5', Icon: Wallet },
    maya: { label: 'Maya', color: '#92600A', bg: '#FBF1DC', Icon: Wallet },
    online_banking: { label: 'Online Banking', color: COLORS.navy, bg: '#E9ECF2', Icon: CreditCard },
    over_the_counter: { label: 'Over the Counter', color: COLORS.orange, bg: '#FBEAE2', Icon: Receipt },
};

const DATE_PRESETS = [
    { label: 'Last 7 days', days: 6 },
    { label: 'Last 14 days', days: 13 },
    { label: 'Last 30 days', days: 29 },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const toISODate = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const daysAgo = (n) => {
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
    if (Math.abs(num) >= 1_000_000) return `₱${(num / 1_000_000).toFixed(1)}M`;
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

const getTotalFineFromTicket = (ticket) => {
    if (!ticket) return 0;
    if (Array.isArray(ticket.violations) && ticket.violations.length > 0) {
        return ticket.violations.reduce((sum, v) => sum + toNumber(v?.fine_amount), 0);
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

/* ------------------------------------------------------------------ */
/* Print styles — injected once                                        */
/* ------------------------------------------------------------------ */

const PrintStyles = () => (
    <style>{`
    @media print {
      @page {
        size: A4 portrait;
        margin: 14mm 12mm 18mm 12mm;
      }

      html, body {
        background: #ffffff !important;
        color: #000000 !important;
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
        font-size: 11px !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .no-print,
      nav, aside, header[role="banner"],
      .print\\:hidden { display: none !important; }

      .print-only { display: block !important; }

      .print-report,
      .print-report * {
        box-shadow: none !important;
        text-shadow: none !important;
        border-radius: 0 !important;
        background-image: none !important;
      }

      .print-report .print-card {
        border: 1px solid #d1d5db !important;
        background: #ffffff !important;
        page-break-inside: avoid;
        break-inside: avoid;
        margin-bottom: 10px !important;
      }

      .print-report h1,
      .print-report h2,
      .print-report h3 { page-break-after: avoid; break-after: avoid; }

      .print-report table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: 10px !important;
      }
      .print-report table thead { display: table-header-group; }
      .print-report table th,
      .print-report table td {
        border: 1px solid #cbd5e1 !important;
        padding: 5px 8px !important;
        color: #000 !important;
      }
      .print-report table th {
        background: #f1f5f9 !important;
        font-weight: 600 !important;
        text-align: left !important;
      }
      .print-report table tr:nth-child(even) td {
        background: #fafafa !important;
      }

      .print-report,
      .print-report p,
      .print-report span,
      .print-report div,
      .print-report li,
      .print-report h1,
      .print-report h2,
      .print-report h3,
      .print-report h4,
      .print-report strong { color: #000 !important; }

      .print-report .text-muted-print { color: #444 !important; }

      .print-report .print-pill {
        border: 1px solid #999 !important;
        background: #f5f5f5 !important;
        color: #000 !important;
      }

      .print-report .print-bar {
        display: none !important;
      }

      .print-report .print-stat {
        border: 1px solid #cbd5e1 !important;
        padding: 8px 10px !important;
        background: #ffffff !important;
      }
      .print-report .print-stat-icon { display: none !important; }
      .print-report .print-stat-value {
        font-size: 16px !important;
        color: #000 !important;
      }

      .print-report .recharts-surface { overflow: visible !important; }
      .print-report .recharts-text { fill: #000 !important; }
      .print-report .recharts-cartesian-axis-line,
      .print-report .recharts-cartesian-grid line {
        stroke: #cbd5e1 !important;
      }

      .print-break-before { page-break-before: always; break-before: page; }
      .print-break-after { page-break-after: always; break-after: page; }
      .print-avoid-break { page-break-inside: avoid; break-inside: avoid; }
    }

    @media screen {
      .print-only { display: none !important; }
    }
  `}</style>
);

/* ------------------------------------------------------------------ */
/* Print-only header                                                   */
/* ------------------------------------------------------------------ */

const PrintHeader = ({ activeTab, dateRange, generatedAt }) => {
    const title =
        activeTab === 'today'
            ? 'Daily Traffic Violation Report'
            : 'Traffic Violation Report';

    const rangeLine =
        activeTab === 'today'
            ? `Report Date: ${formatLongDate(dateRange.end_date)}`
            : `Reporting Period: ${formatLongDate(dateRange.start_date)} — ${formatLongDate(
                  dateRange.end_date,
              )}`;

    return (
        <div className="print-only" style={{ marginBottom: '14px' }}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    borderBottom: '2px solid #16233F',
                    paddingBottom: '10px',
                    marginBottom: '10px',
                }}
            >
                <img
                    src={temuLogo}
                    alt="TEMU"
                    style={{ width: '54px', height: '54px', objectFit: 'contain' }}
                />
                <div style={{ flex: 1 }}>
                    <div
                        style={{
                            fontSize: '9px',
                            letterSpacing: '2.5px',
                            textTransform: 'uppercase',
                            color: '#16233F',
                            marginBottom: '2px',
                        }}
                    >
                        City of El Salvador
                    </div>
                    <div
                        style={{
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: '#16233F',
                            lineHeight: 1.15,
                        }}
                    >
                        Traffic Enforcement and Management Unit
                    </div>
                    <div style={{ fontSize: '10px', color: '#444', marginTop: '2px' }}>
                        Official Reports &amp; Analytics
                    </div>
                </div>
            </div>

            <table
                style={{
                    width: '100%',
                    fontSize: '10px',
                    color: '#000',
                    borderCollapse: 'collapse',
                    marginBottom: '10px',
                }}
            >
                <tbody>
                    <tr>
                        <td style={{ padding: '2px 0' }}>
                            <strong>Document:</strong> {title}
                        </td>
                        <td style={{ padding: '2px 0', textAlign: 'right' }}>
                            <strong>Generated:</strong>{' '}
                            {generatedAt.toLocaleString('en-PH', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                            })}
                        </td>
                    </tr>
                    <tr>
                        <td style={{ padding: '2px 0' }} colSpan={2}>
                            <strong>Period:</strong>{' '}
                            {rangeLine.replace(/^Reporting Period: |^Report Date: /, '')}
                        </td>
                    </tr>
                </tbody>
            </table>

            <div
                style={{
                    fontSize: '9px',
                    color: '#444',
                    borderTop: '1px solid #cbd5e1',
                    paddingTop: '4px',
                    marginBottom: '12px',
                }}
            >
                Confidential — for official use only. Prepared by the TEMU Command Center.
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* Print-only footer                                                   */
/* ------------------------------------------------------------------ */

const PrintFooter = () => (
    <div
        className="print-only"
        style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: '1px solid #cbd5e1',
            paddingTop: '4px',
            paddingBottom: '2px',
            fontSize: '8px',
            color: '#444',
            display: 'flex',
            justifyContent: 'space-between',
        }}
    >
        <span>TEMU · El Salvador City · Traffic Enforcement and Management Unit</span>
        <span>
            Page <span className="page-number" /> of <span className="page-total" />
        </span>
    </div>
);

/* ------------------------------------------------------------------ */
/* Presentational pieces                                               */
/* ------------------------------------------------------------------ */

const StatCard = ({ label, value, sublabel, icon: Icon, color, tint }) => (
    <Card className="print-card print-stat transition-shadow hover:shadow-md">
        <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm text-[#64748B]">{label}</p>
                    <p
                        className="print-stat-value mt-1 text-3xl font-bold leading-tight truncate"
                        style={{ color }}
                        title={typeof value === 'string' ? value : undefined}
                    >
                        {value}
                    </p>
                    {sublabel && <p className="mt-1 text-xs text-[#94A3B8]">{sublabel}</p>}
                </div>
                <div
                    className="print-stat-icon shrink-0 rounded-lg p-2.5"
                    style={{ backgroundColor: tint }}
                    aria-hidden="true"
                >
                    <Icon className="h-6 w-6" style={{ color }} />
                </div>
            </div>
        </CardContent>
    </Card>
);

const SectionCard = ({ title, action, children, breakBefore }) => (
    <Card
        className={`print-card print-avoid-break ${breakBefore ? 'print-break-before' : ''}`}
    >
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg font-['Oswald'] font-medium text-[#16233F]">
                {title}
            </CardTitle>
            {action && <div className="print:hidden">{action}</div>}
        </CardHeader>
        <CardContent>{children}</CardContent>
    </Card>
);

const EmptyState = ({ message, hint }) => (
    <div className="flex flex-col items-center justify-center py-10 text-center">
        <Inbox className="mb-3 h-8 w-8 text-[#CBD5E1]" aria-hidden="true" />
        <p className="text-sm text-[#64748B]">{message}</p>
        {hint && <p className="mt-1 text-xs text-[#94A3B8]">{hint}</p>}
    </div>
);

const ErrorState = ({ message, onRetry }) => (
    <Card className="border-[#C8202F]/30 bg-[#FBE7E9]/40">
        <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#C8202F]" aria-hidden="true" />
                <div>
                    <p className="font-medium text-[#C8202F]">Report didn’t load</p>
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
                <Card key={i}>
                    <CardContent className="p-6">
                        <SkeletonBlock className="h-4 w-24" />
                        <SkeletonBlock className="mt-3 h-8 w-32" />
                    </CardContent>
                </Card>
            ))}
        </div>
        <Card>
            <CardContent className="p-6">
                <SkeletonBlock className="h-5 w-40" />
                <SkeletonBlock className="mt-4 h-64 w-full" />
            </CardContent>
        </Card>
    </div>
);

const RankedRow = ({ rank, primary, secondary, value, share, color }) => (
    <li className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
                {rank != null && (
                    <span className="w-5 shrink-0 text-sm font-bold text-[#94A3B8]">{rank}</span>
                )}
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#1F2937]">{primary}</p>
                    {secondary && <p className="truncate text-xs text-[#64748B]">{secondary}</p>}
                </div>
            </div>
            <span className="shrink-0 text-sm font-semibold" style={{ color }}>
                {value}
            </span>
        </div>
        <div className="print-bar h-1.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
            <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(share, 2)}%`, backgroundColor: color }}
            />
        </div>
    </li>
);

const StatusTile = ({ statusKey, count, total }) => {
    const meta = STATUS_META[statusKey];
    const share = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div
            className="print-stat rounded-lg p-4 text-center"
            style={{ backgroundColor: meta.bg }}
        >
            <meta.Icon
                className="print-stat-icon mx-auto mb-2 h-8 w-8"
                style={{ color: meta.color }}
                aria-hidden="true"
            />
            <p className="text-2xl font-bold" style={{ color: meta.color }}>
                {count}
            </p>
            <p className="text-xs text-[#64748B]">
                {meta.label} · {share}%
            </p>
        </div>
    );
};

const PaymentMethodRow = ({ method, count, total, maxTotal }) => {
    const meta = PAYMENT_METHOD_META[method] || {
        label: method,
        color: COLORS.slate,
        bg: '#F1F5F9',
        Icon: CreditCard,
    };
    const share = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
    const Icon = meta.Icon;

    return (
        <li className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: meta.bg }}
                    >
                        <Icon className="h-4 w-4" style={{ color: meta.color }} />
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#1F2937]">
                            {meta.label}
                        </p>
                        <p className="truncate text-xs text-[#64748B]">
                            {count} {count === 1 ? 'payment' : 'payments'}
                        </p>
                    </div>
                </div>
                <span className="shrink-0 text-sm font-semibold" style={{ color: meta.color }}>
                    {formatCurrency(total)}
                </span>
            </div>
            <div className="print-bar h-1.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${Math.max(share, 2)}%`, backgroundColor: meta.color }}
                />
            </div>
        </li>
    );
};

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
                        {entry.dataKey === 'total_fines' || entry.dataKey === 'collected'
                            ? formatCurrency(entry.value)
                            : entry.value}
                    </span>
                </p>
            ))}
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* Payments section (reused by Today & Range tabs)                     */
/* ------------------------------------------------------------------ */

const PaymentsSection = ({ paymentsSummary }) => {
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

    return (
        <div className="space-y-6">
            {/* Stat row */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Net Collected"
                    value={formatCurrency(net_collected)}
                    sublabel={
                        refunded_total > 0
                            ? `Gross ${formatCurrency(total_collected)} − refunds ${formatCurrency(
                                  refunded_total,
                              )}`
                            : undefined
                    }
                    icon={PhilippinePeso}
                    color={COLORS.green}
                    tint="#E5F2EA"
                />
                <StatCard
                    label="Payments Received"
                    value={payments_count}
                    sublabel={`${unique_tickets} unique ${
                        unique_tickets === 1 ? 'ticket' : 'tickets'
                    }`}
                    icon={Receipt}
                    color={COLORS.navy}
                    tint="#E9ECF2"
                />
                <StatCard
                    label="Average Payment"
                    value={formatCurrency(average_payment)}
                    icon={Wallet}
                    color={COLORS.amberDark}
                    tint="#FBF1DC"
                />
                <StatCard
                    label="Refunded / Voided"
                    value={formatCurrency(refunded_total)}
                    icon={AlertCircle}
                    color={COLORS.red}
                    tint="#FBE7E9"
                />
            </div>

            {/* Method breakdown + recent payments */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <SectionCard title="Collections by payment method">
                    {by_method.length > 0 ? (
                        <ul className="space-y-4">
                            {by_method.map((m) => (
                                <PaymentMethodRow
                                    key={m.method}
                                    method={m.method}
                                    count={m.count}
                                    total={m.total}
                                    maxTotal={maxMethodTotal}
                                />
                            ))}
                        </ul>
                    ) : (
                        <EmptyState
                            message="No payments collected in this period."
                            hint="Recorded receipts will appear here as staff complete them."
                        />
                    )}
                </SectionCard>

                <SectionCard
                    title="Recent payments"
                    action={
                        recent_payments.length > 0 ? (
                            <span className="text-xs text-[#64748B]">
                                {recent_payments.length} shown
                            </span>
                        ) : null
                    }
                >
                    {recent_payments.length > 0 ? (
                        <div className="-mx-2 overflow-x-auto px-2">
                            <table className="w-full min-w-[520px]">
                                <thead className="border-b border-[#E9ECF2]">
                                    <tr>
                                        {[
                                            'Receipt #',
                                            'Ticket #',
                                            'Violator',
                                            'Method',
                                            'Amount',
                                            'Date',
                                        ].map((h) => (
                                            <th
                                                key={h}
                                                scope="col"
                                                className={`py-3 font-['Inter'] text-xs font-semibold text-[#16233F] ${
                                                    h === 'Amount' ? 'text-right' : 'text-left'
                                                }`}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {recent_payments.map((p) => {
                                        const meta = PAYMENT_METHOD_META[p.payment_method] || {};
                                        return (
                                            <tr
                                                key={p.payment_id}
                                                className="border-b border-[#F3F4F6] transition-colors hover:bg-[#F8F9FA]"
                                            >
                                                <td className="py-2.5 font-mono text-xs text-[#16233F]">
                                                    {p.receipt_number || '—'}
                                                </td>
                                                <td className="py-2.5 font-mono text-xs text-[#64748B]">
                                                    {p.ticket_number || '—'}
                                                </td>
                                                <td className="py-2.5 text-sm text-[#1F2937]">
                                                    {p.violator_name || '—'}
                                                </td>
                                                <td className="py-2.5 text-xs capitalize text-[#64748B]">
                                                    {meta.label || p.payment_method}
                                                </td>
                                                <td className="py-2.5 text-right text-sm font-semibold text-[#1E8449]">
                                                    {formatCurrency(p.amount_paid)}
                                                </td>
                                                <td className="py-2.5 text-xs text-[#64748B]">
                                                    {p.payment_date
                                                        ? new Date(p.payment_date).toLocaleString(
                                                              'en-PH',
                                                              {
                                                                  month: 'short',
                                                                  day: 'numeric',
                                                                  hour: '2-digit',
                                                                  minute: '2-digit',
                                                              },
                                                          )
                                                        : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState message="No recent payments to show." />
                    )}
                </SectionCard>
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const Reports = () => {
    const [todayReport, setTodayReport] = useState(null);
    const [weeklyReport, setWeeklyReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [activeTab, setActiveTab] = useState('today');
    const [dateRange, setDateRange] = useState({
        start_date: daysAgo(6),
        end_date: daysAgo(0),
    });

    const today = daysAgo(0);
    const invalidRange = dateRange.start_date > dateRange.end_date;

    const fetchTodayReport = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getTodayReport();
            setTodayReport(response.data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Error fetching today report:', err);
            setError(readApiError(err));
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchWeeklyReport = useCallback(async () => {
        if (dateRange.start_date > dateRange.end_date) return;
        setLoading(true);
        setError(null);
        try {
            const response = await getWeeklyReport({
                start_date: dateRange.start_date,
                end_date: dateRange.end_date,
            });
            setWeeklyReport(response.data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Error fetching weekly report:', err);
            setError(readApiError(err));
        } finally {
            setLoading(false);
        }
    }, [dateRange.start_date, dateRange.end_date]);

    useEffect(() => {
        if (activeTab === 'today' && !todayReport) fetchTodayReport();
        if (activeTab === 'weekly' && !weeklyReport) fetchWeeklyReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    /* ---------------- Print: page counter ---------------- */
    useEffect(() => {
        const style = document.createElement('style');
        style.id = 'reports-print-counters';
        style.textContent = `
      @media print {
        body { counter-reset: page; }
        .page-number::before { content: counter(page); }
      }
    `;
        document.head.appendChild(style);
        return () => {
            const el = document.getElementById('reports-print-counters');
            if (el) el.remove();
        };
    }, []);

    const refreshActive = () =>
        activeTab === 'today' ? fetchTodayReport() : fetchWeeklyReport();

    const applyPreset = (days) => {
        setDateRange({ start_date: daysAgo(days), end_date: today });
    };

    const handleExportCSV = async () => {
        const range =
            activeTab === 'today' ? { start_date: today, end_date: today } : dateRange;

        setExporting(true);
        let url;
        try {
            const response = await exportReport(range);
            const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
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

    /* --------------------------- Derived data --------------------------- */

    const todayFines = useMemo(() => {
        const fromSummary = toNumber(todayReport?.summary?.total_fines);
        if (fromSummary > 0) return fromSummary;
        return (todayReport?.recent_tickets || []).reduce(
            (sum, t) => sum + getTotalFineFromTicket(t),
            0,
        );
    }, [todayReport]);

    const weeklyStatusData = useMemo(() => {
        const s = weeklyReport?.summary;
        if (!s) return [];
        return Object.keys(STATUS_META)
            .map((key) => ({
                key,
                name: STATUS_META[key].label,
                value: Number(s[`${key}_tickets`]) || 0,
            }))
            .filter((d) => d.value > 0);
    }, [weeklyReport]);

    const weeklyStatusTotal = weeklyStatusData.reduce((sum, d) => sum + d.value, 0);

    const maxTodayViolation = Math.max(
        1,
        ...(todayReport?.top_violations || []).map((v) => Number(v.count) || 0),
    );
    const maxTodayEnforcer = Math.max(
        1,
        ...(todayReport?.enforcer_performance || []).map(
            (e) => Number(e.tickets_count) || 0,
        ),
    );
    const maxWeeklyViolator = Math.max(
        1,
        ...(weeklyReport?.top_violators || []).map((v) => Number(v.tickets_count) || 0),
    );
    const maxWeeklyViolation = Math.max(
        1,
        ...(weeklyReport?.top_violations || []).map((v) => Number(v.count) || 0),
    );

    const busiestDay = useMemo(() => {
        const days = weeklyReport?.daily_breakdown || [];
        if (!days.length) return null;
        return days.reduce((best, d) =>
            (Number(d.tickets_count) || 0) > (Number(best.tickets_count) || 0) ? d : best,
        );
    }, [weeklyReport]);

    // Merge per-day payments into the daily breakdown so the chart can
    // overlay a "Collected" line.
    const dailyChartData = useMemo(() => {
        const base = weeklyReport?.daily_breakdown || [];
        const paymentsByDate = new Map(
            (weeklyReport?.payments_summary?.daily || []).map((d) => [
                d.date,
                Number(d.total) || 0,
            ]),
        );
        return base.map((d) => ({
            ...d,
            collected: paymentsByDate.get(d.date) || 0,
        }));
    }, [weeklyReport]);

    /* ------------------------------ Render ------------------------------ */

    const showSkeleton =
        loading && (activeTab === 'today' ? !todayReport : !weeklyReport);

    const reportRange =
        activeTab === 'today' ? { start_date: today, end_date: today } : dateRange;

    return (
        <div className="pb-10 print-report">
            <PrintStyles />
            <PrintHeader
                activeTab={activeTab}
                dateRange={reportRange}
                generatedAt={lastUpdated || new Date()}
            />
            <PrintFooter />

            {/* Screen-only header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
                <div>
                    <h1 className="font-['Oswald'] text-2xl font-semibold text-[#16233F]">
                        Reports &amp; Analytics
                    </h1>
                    <p className="mt-1 font-['Inter'] text-sm text-[#64748B]">
                        {lastUpdated
                            ? `Updated ${lastUpdated.toLocaleTimeString('en-PH', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                              })}`
                            : 'Generate and view detailed reports'}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        onClick={refreshActive}
                        variant="outline"
                        disabled={loading}
                        className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button
                        onClick={() => window.print()}
                        variant="outline"
                        className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
                    >
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                    </Button>
                    <Button
                        onClick={handleExportCSV}
                        variant="outline"
                        disabled={exporting || (activeTab === 'weekly' && invalidRange)}
                        className="border-[#1E8449]/30 text-[#1E8449] hover:bg-[#E5F2EA]"
                    >
                        {exporting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="mr-2 h-4 w-4" />
                        )}
                        {exporting ? 'Exporting…' : 'Export CSV'}
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                {/* Tab bar + range controls */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between print:hidden">
                    <TabsList className="bg-[#E9ECF2]">
                        <TabsTrigger
                            value="today"
                            className="data-[state=active]:bg-[#16233F] data-[state=active]:text-white"
                        >
                            Today
                        </TabsTrigger>
                        <TabsTrigger
                            value="weekly"
                            className="data-[state=active]:bg-[#16233F] data-[state=active]:text-white"
                        >
                            Date range
                        </TabsTrigger>
                    </TabsList>

                    {activeTab === 'weekly' && (
                        <div className="flex flex-wrap items-center gap-2">
                            {DATE_PRESETS.map((preset) => {
                                const isActive =
                                    dateRange.start_date === daysAgo(preset.days) &&
                                    dateRange.end_date === today;
                                return (
                                    <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => applyPreset(preset.days)}
                                        className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F0B429] ${
                                            isActive
                                                ? 'bg-[#16233F] text-white'
                                                : 'bg-[#E9ECF2] text-[#16233F] hover:bg-[#DCE1EA]'
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}

                            <Input
                                type="date"
                                aria-label="Start date"
                                max={dateRange.end_date}
                                value={dateRange.start_date}
                                onChange={(e) =>
                                    setDateRange((r) => ({ ...r, start_date: e.target.value }))
                                }
                                className="w-40 focus-visible:ring-[#F0B429]"
                            />
                            <span className="text-[#64748B]">to</span>
                            <Input
                                type="date"
                                aria-label="End date"
                                min={dateRange.start_date}
                                max={today}
                                value={dateRange.end_date}
                                onChange={(e) =>
                                    setDateRange((r) => ({ ...r, end_date: e.target.value }))
                                }
                                className="w-40 focus-visible:ring-[#F0B429]"
                            />
                            <Button
                                onClick={fetchWeeklyReport}
                                disabled={loading || invalidRange}
                                className="bg-[#16233F] text-white hover:bg-[#16233F]/90"
                            >
                                Apply
                            </Button>
                        </div>
                    )}
                </div>

                {activeTab === 'weekly' && invalidRange && (
                    <p className="text-sm text-[#C8202F] print:hidden">
                        Start date must come before the end date.
                    </p>
                )}

                {error && <ErrorState message={error} onRetry={refreshActive} />}

                {/* ------------------------- TODAY ------------------------- */}
                <TabsContent value="today" className="mt-0">
                    {showSkeleton ? (
                        <ReportSkeleton />
                    ) : todayReport ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <StatCard
                                    label="Tickets issued"
                                    value={todayReport.summary?.total_tickets || 0}
                                    icon={Ticket}
                                    color={COLORS.navy}
                                    tint="#E9ECF2"
                                />
                                <StatCard
                                    label="Total fines"
                                    value={formatCurrency(todayFines)}
                                    icon={PhilippinePeso}
                                    color={COLORS.red}
                                    tint="#FBE7E9"
                                />
                                <StatCard
                                    label="Paid tickets"
                                    value={todayReport.summary?.paid_tickets || 0}
                                    sublabel={`of ${
                                        todayReport.summary?.total_tickets || 0
                                    } issued`}
                                    icon={CheckCircle}
                                    color={COLORS.green}
                                    tint="#E5F2EA"
                                />
                                <StatCard
                                    label="Collection rate"
                                    value={`${todayReport.summary?.collection_rate || 0}%`}
                                    icon={TrendingUp}
                                    color={COLORS.amberDark}
                                    tint="#FBF1DC"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                <SectionCard title="Top violations today">
                                    {todayReport.top_violations?.length ? (
                                        <ul className="space-y-4">
                                            {todayReport.top_violations.map((violation, idx) => (
                                                <RankedRow
                                                    key={
                                                        violation.violation_id ??
                                                        violation.violation_name ??
                                                        idx
                                                    }
                                                    rank={idx + 1}
                                                    primary={violation.violation_name}
                                                    value={`${violation.count}×`}
                                                    share={
                                                        ((Number(violation.count) || 0) /
                                                            maxTodayViolation) *
                                                        100
                                                    }
                                                    color={COLORS.navy}
                                                />
                                            ))}
                                        </ul>
                                    ) : (
                                        <EmptyState message="No violations recorded today." />
                                    )}
                                </SectionCard>

                                <SectionCard title="Enforcer performance">
                                    {todayReport.enforcer_performance?.length ? (
                                        <ul className="space-y-4">
                                            {todayReport.enforcer_performance.map(
                                                (enforcer, idx) => (
                                                    <li
                                                        key={
                                                            enforcer.user_id ??
                                                            enforcer.name ??
                                                            idx
                                                        }
                                                        className="space-y-1.5"
                                                    >
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="flex min-w-0 items-center gap-3">
                                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E9ECF2] text-xs font-bold text-[#16233F]">
                                                                    {getInitials(enforcer.name)}
                                                                </div>
                                                                <span className="truncate text-sm text-[#1F2937]">
                                                                    {enforcer.name}
                                                                </span>
                                                            </div>
                                                            <span className="shrink-0 text-sm font-semibold text-[#16233F]">
                                                                {enforcer.tickets_count} tickets
                                                            </span>
                                                        </div>
                                                        <div className="print-bar ml-11 h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
                                                            <div
                                                                className="h-full rounded-full bg-[#F0B429] transition-[width] duration-500"
                                                                style={{
                                                                    width: `${Math.max(
                                                                        ((Number(
                                                                            enforcer.tickets_count,
                                                                        ) || 0) /
                                                                            maxTodayEnforcer) *
                                                                            100,
                                                                        2,
                                                                    )}%`,
                                                                }}
                                                            />
                                                        </div>
                                                    </li>
                                                ),
                                            )}
                                        </ul>
                                    ) : (
                                        <EmptyState message="No tickets issued today." />
                                    )}
                                </SectionCard>
                            </div>

                            <SectionCard
                                title="Recent tickets today"
                                action={
                                    <span className="text-xs text-[#64748B]">
                                        {todayReport.recent_tickets?.length || 0} shown
                                    </span>
                                }
                            >
                                {todayReport.recent_tickets?.length ? (
                                    <div className="-mx-2 overflow-x-auto px-2">
                                        <table className="w-full min-w-[640px]">
                                            <thead className="border-b border-[#E9ECF2]">
                                                <tr>
                                                    {[
                                                        'Ticket #',
                                                        'Violator',
                                                        'Plate',
                                                        'Fine',
                                                        'Status',
                                                        'Time',
                                                    ].map((heading) => (
                                                        <th
                                                            key={heading}
                                                            scope="col"
                                                            className={`py-3 font-['Inter'] text-sm font-semibold text-[#16233F] ${
                                                                heading === 'Fine'
                                                                    ? 'text-right'
                                                                    : 'text-left'
                                                            }`}
                                                        >
                                                            {heading}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {todayReport.recent_tickets.map((ticket) => {
                                                    const meta =
                                                        STATUS_META[ticket.status] || {};
                                                    const StatusIcon = meta.Icon;
                                                    return (
                                                        <tr
                                                            key={
                                                                ticket.ticket_id ??
                                                                ticket.ticket_number
                                                            }
                                                            className="border-b border-[#F3F4F6] transition-colors hover:bg-[#F8F9FA]"
                                                        >
                                                            <td className="py-3 font-mono text-sm text-[#16233F]">
                                                                {ticket.ticket_number}
                                                            </td>
                                                            <td className="py-3 text-[#1F2937]">
                                                                {[
                                                                    ticket.violator?.firstname,
                                                                    ticket.violator?.lastname,
                                                                ]
                                                                    .filter(Boolean)
                                                                    .join(' ') || '—'}
                                                            </td>
                                                            <td className="py-3 font-mono text-[#1F2937]">
                                                                {ticket.vehicle?.platenumber || '—'}
                                                            </td>
                                                            <td className="py-3 text-right font-semibold text-[#C8202F]">
                                                                {formatCurrency(
                                                                    getTotalFineFromTicket(ticket),
                                                                )}
                                                            </td>
                                                            <td className="py-3">
                                                                <span
                                                                    className="print-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                                                                    style={{
                                                                        backgroundColor:
                                                                            meta.bg || '#F1F5F9',
                                                                        color:
                                                                            meta.color ||
                                                                            COLORS.slate,
                                                                    }}
                                                                >
                                                                    {StatusIcon && (
                                                                        <StatusIcon className="h-3.5 w-3.5" />
                                                                    )}
                                                                    {meta.label ||
                                                                        ticket.status ||
                                                                        'Unknown'}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 text-sm text-[#64748B]">
                                                                {ticket.created_at
                                                                    ? new Date(
                                                                          ticket.created_at,
                                                                      ).toLocaleTimeString(
                                                                          'en-PH',
                                                                          {
                                                                              hour: '2-digit',
                                                                              minute: '2-digit',
                                                                          },
                                                                      )
                                                                    : '—'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <EmptyState
                                        message="No tickets issued today."
                                        hint="Tickets appear here as enforcers submit them from the mobile app."
                                    />
                                )}
                            </SectionCard>

                            {/* Payments block — Today */}
                            {todayReport.payments_summary && (
                                <SectionCard title="Payments collected today" breakBefore>
                                    <PaymentsSection
                                        paymentsSummary={todayReport.payments_summary}
                                    />
                                </SectionCard>
                            )}
                        </div>
                    ) : (
                        !error && <EmptyState message="No data available for today." />
                    )}
                </TabsContent>

                {/* ------------------------- RANGE ------------------------- */}
                <TabsContent value="weekly" className="mt-0">
                    {showSkeleton ? (
                        <ReportSkeleton />
                    ) : weeklyReport ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <StatCard
                                    label="Tickets issued"
                                    value={weeklyReport.summary?.total_tickets || 0}
                                    sublabel={`${dateRange.start_date} to ${dateRange.end_date}`}
                                    icon={Ticket}
                                    color={COLORS.navy}
                                    tint="#E9ECF2"
                                />
                                <StatCard
                                    label="Total fines"
                                    value={formatCurrency(weeklyReport.summary?.total_fines)}
                                    icon={PhilippinePeso}
                                    color={COLORS.red}
                                    tint="#FBE7E9"
                                />
                                <StatCard
                                    label="Avg daily tickets"
                                    value={Math.round(
                                        weeklyReport.summary?.average_daily_tickets || 0,
                                    )}
                                    sublabel={
                                        busiestDay ? `Busiest: ${busiestDay.day_name}` : undefined
                                    }
                                    icon={BarChart3}
                                    color={COLORS.amberDark}
                                    tint="#FBF1DC"
                                />
                                <StatCard
                                    label="Collection rate"
                                    value={`${weeklyReport.summary?.collection_rate || 0}%`}
                                    icon={TrendingUp}
                                    color={COLORS.green}
                                    tint="#E5F2EA"
                                />
                            </div>

                            {dailyChartData.length > 0 && (
                                <SectionCard title="Tickets, fines, and collections per day">
                                    <ResponsiveContainer width="100%" height={320}>
                                        <ComposedChart
                                            data={dailyChartData}
                                            margin={{
                                                top: 8,
                                                right: 8,
                                                left: 0,
                                                bottom: 0,
                                            }}
                                        >
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                stroke={COLORS.line}
                                                vertical={false}
                                            />
                                            <XAxis
                                                dataKey="day_name"
                                                tick={{ fontSize: 12, fill: COLORS.slate }}
                                                axisLine={{ stroke: COLORS.line }}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                yAxisId="left"
                                                allowDecimals={false}
                                                tick={{ fontSize: 12, fill: COLORS.slate }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                yAxisId="right"
                                                orientation="right"
                                                tickFormatter={formatCompactCurrency}
                                                tick={{ fontSize: 12, fill: COLORS.slate }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip
                                                content={<ChartTooltip />}
                                                cursor={{ fill: '#F8F9FA' }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: 12 }} />
                                            <Bar
                                                yAxisId="left"
                                                dataKey="tickets_count"
                                                name="Tickets"
                                                fill={COLORS.navy}
                                                radius={[4, 4, 0, 0]}
                                                maxBarSize={48}
                                            />
                                            <Line
                                                yAxisId="right"
                                                type="monotone"
                                                dataKey="total_fines"
                                                name="Fines issued"
                                                stroke={COLORS.amber}
                                                strokeWidth={2}
                                                dot={{ r: 3 }}
                                            />
                                            <Line
                                                yAxisId="right"
                                                type="monotone"
                                                dataKey="collected"
                                                name="Collected"
                                                stroke={COLORS.green}
                                                strokeWidth={2}
                                                strokeDasharray="4 3"
                                                dot={{ r: 3 }}
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </SectionCard>
                            )}

                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                <SectionCard title="Repeat violators">
                                    {weeklyReport.top_violators?.length ? (
                                        <ul className="space-y-4">
                                            {weeklyReport.top_violators.map((violator, idx) => (
                                                <RankedRow
                                                    key={
                                                        violator.violator_id ??
                                                        violator.license ??
                                                        idx
                                                    }
                                                    rank={idx + 1}
                                                    primary={
                                                        [
                                                            violator.firstname,
                                                            violator.lastname,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' ') ||
                                                        'Unnamed violator'
                                                    }
                                                    secondary={violator.license}
                                                    value={`${violator.tickets_count} tickets`}
                                                    share={
                                                        ((Number(violator.tickets_count) || 0) /
                                                            maxWeeklyViolator) *
                                                        100
                                                    }
                                                    color={COLORS.red}
                                                />
                                            ))}
                                        </ul>
                                    ) : (
                                        <EmptyState message="No repeat violators in this range." />
                                    )}
                                </SectionCard>

                                <SectionCard title="Most common violations">
                                    {weeklyReport.top_violations?.length ? (
                                        <ul className="space-y-4">
                                            {weeklyReport.top_violations.map(
                                                (violation, idx) => (
                                                    <RankedRow
                                                        key={
                                                            violation.violation_id ??
                                                            violation.violation_name ??
                                                            idx
                                                        }
                                                        rank={idx + 1}
                                                        primary={violation.violation_name}
                                                        secondary={`${formatCurrency(
                                                            violation.total_fine,
                                                        )} in fines`}
                                                        value={`${violation.count}×`}
                                                        share={
                                                            ((Number(violation.count) || 0) /
                                                                maxWeeklyViolation) *
                                                            100
                                                        }
                                                        color={COLORS.navy}
                                                    />
                                                ),
                                            )}
                                        </ul>
                                    ) : (
                                        <EmptyState message="No violations in this range." />
                                    )}
                                </SectionCard>
                            </div>

                            <SectionCard title="Ticket status breakdown" breakBefore>
                                <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2">
                                    <div className="grid grid-cols-2 gap-4">
                                        {Object.keys(STATUS_META).map((key) => (
                                            <StatusTile
                                                key={key}
                                                statusKey={key}
                                                count={
                                                    Number(
                                                        weeklyReport.summary?.[
                                                            `${key}_tickets`
                                                        ],
                                                    ) || 0
                                                }
                                                total={weeklyStatusTotal}
                                            />
                                        ))}
                                    </div>

                                    {weeklyStatusData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={240}>
                                            <RePieChart>
                                                <Pie
                                                    data={weeklyStatusData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    innerRadius={55}
                                                    outerRadius={90}
                                                    paddingAngle={2}
                                                >
                                                    {weeklyStatusData.map((entry) => (
                                                        <Cell
                                                            key={entry.key}
                                                            fill={STATUS_META[entry.key].color}
                                                        />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<ChartTooltip />} />
                                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                            </RePieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <EmptyState message="No tickets to break down yet." />
                                    )}
                                </div>
                            </SectionCard>

                            {/* Payments block — Range */}
                            {weeklyReport.payments_summary && (
                                <SectionCard
                                    title="Payments collected in this range"
                                    breakBefore
                                >
                                    <PaymentsSection
                                        paymentsSummary={weeklyReport.payments_summary}
                                    />
                                </SectionCard>
                            )}
                        </div>
                    ) : (
                        !error && (
                            <EmptyState
                                message="Pick a date range to build a report."
                                hint="Choose a preset above, or set your own dates and press Apply."
                            />
                        )
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default Reports;