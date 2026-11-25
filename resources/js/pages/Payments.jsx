// web/src/pages/Payments.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '../components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Pagination } from '../components/ui/Pagination';
import ActionButton from '../components/ui/ActionButton';
import { byFields } from '../lib/sortBy';
import {
    getPayments,
    getPendingPayments,
    createPayment,
    getPaymentsByTicket,
    searchVehicleByPlate,
    getOverduePayments,
} from '../services/api';
import MissedDeadlineTab from '../components/payments/MissedDeadlineTab';
import { DueBadge, DUE_META } from '../components/payments/DueStatus';
import { getDueState } from '../lib/dueTime';
import {
    Search,
    RefreshCw,
    Loader2,
    Receipt,
    PhilippinePeso,
    CheckCircle,
    Clock,
    XCircle,
    AlertCircle,
    Wallet,
    Eye,
    History,
    Filter,
    X,
    Calendar,
    LayoutGrid,
    List as ListIcon,
    Ticket as TicketIcon,
    User as UserIcon,
    Car,
    Banknote,
    Info,
    Copy,
    Check,
    CalendarDays,
    AlertTriangle,
    Tag,
    ShieldCheck,
} from 'lucide-react';
import { useAlert } from '../components/ui/AlertProvider';

const ITEMS_PER_PAGE = 20;

const STATUS_META = {
    pending: {
        label: 'Pending',
        color: '#F0B429',
        chip: 'bg-[#FBF1DC] text-[#92600A]',
        Icon: Clock,
    },
    completed: {
        label: 'Completed',
        color: '#1E8449',
        chip: 'bg-[#E5F2EA] text-[#1E8449]',
        Icon: CheckCircle,
    },
    failed: {
        label: 'Failed',
        color: '#C8202F',
        chip: 'bg-[#FBE7E9] text-[#C8202F]',
        Icon: XCircle,
    },
    refunded: {
        label: 'Refunded',
        color: '#3B5170',
        chip: 'bg-[#EEF1F5] text-[#3B5170]',
        Icon: AlertCircle,
    },
};

const TICKET_STATUS_META = {
    issued: {
        label: 'Issued',
        color: '#F0B429',
        chip: 'bg-[#FBF1DC] text-[#92600A]',
    },
    paid: {
        label: 'Paid',
        color: '#1E8449',
        chip: 'bg-[#E5F2EA] text-[#1E8449]',
    },
    dismissed: {
        label: 'Dismissed',
        color: '#C8202F',
        chip: 'bg-[#FBE7E9] text-[#C8202F]',
    },
};

const STATUS_OPTIONS = Object.keys(STATUS_META).map((key) => ({
    value: key,
    label: STATUS_META[key].label,
}));

const METHOD_OPTIONS = [{ value: 'cash', label: 'Cash' }];

const PRESETS = [
    { label: 'Today', days: 0 },
    { label: 'Last 7d', days: 6 },
    { label: 'Last 30d', days: 29 },
    { label: 'Last 90d', days: 89 },
];

const toISODate = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const toISOMonth = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

const daysAgoISO = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toISODate(d);
};

const formatMonthLabel = (iso) => {
    if (!iso) return '';
    const [y, m] = iso.split('-');
    if (!y || !m) return iso;
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
};

const PENDING_ROW =
    'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ' +
    'md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_minmax(0,.9fr)_minmax(0,1.4fr)_minmax(0,.9fr)_minmax(0,.9fr)_minmax(0,.9fr)_minmax(0,1.2fr)_minmax(0,1fr)] md:gap-4';

const HISTORY_ROW =
    'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ' +
    'md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,.9fr)_minmax(0,.9fr)_minmax(0,1.2fr)_minmax(0,.9fr)_minmax(0,8rem)] md:gap-4';

const getDataArray = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (response.data && Array.isArray(response.data)) return response.data;
    if (response.data?.data && Array.isArray(response.data.data)) {
        return response.data.data;
    }
    return [];
};

const getMeta = (response) => {
    if (!response) return { current_page: 1, last_page: 1, total: 0 };
    if (response.current_page !== undefined) {
        return {
            current_page: response.current_page,
            last_page: response.last_page,
            total: response.total,
        };
    }
    if (response.data && response.data.current_page !== undefined) {
        return {
            current_page: response.data.current_page,
            last_page: response.data.last_page,
            total: response.data.total,
        };
    }
    if (response.meta) return response.meta;
    return { current_page: 1, last_page: 1, total: 0 };
};

const getTotalFine = (ticket) => {
    if (!ticket) return 0;
    if (Array.isArray(ticket.violations) && ticket.violations.length > 0) {
        return ticket.violations.reduce(
            (sum, v) => sum + (parseFloat(v.fine_amount) || 0),
            0,
        );
    }
    return parseFloat(ticket.total_fine) || 0;
};

const getTicketBalance = (ticket) => {
    const totalFine = getTotalFine(ticket);
    const paid = parseFloat(ticket?.total_paid) || 0;
    return ticket?.balance != null
        ? parseFloat(ticket.balance)
        : Math.max(0, totalFine - paid);
};

const formatPeso = (n) =>
    `₱${(parseFloat(n) || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const formatDateTime = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString();
    } catch {
        return '—';
    }
};

const formatDate = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString();
    } catch {
        return '—';
    }
};

const copyText = async (text) => {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        /* fall through to legacy */
    }
    try {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(el);
        return ok;
    } catch {
        return false;
    }
};

/**
 * Ticket is overdue when due date is in the past and it is not already paid.
 */
const isOverdueTicket = (ticket) => {
    if (!ticket) return false;
    if (ticket.status === 'paid') return false;
    return getDueState(ticket).state === 'overdue';
};

/**
 * Ticket is unpaid and NOT overdue.
 */
const isUnpaidNotOverdueTicket = (ticket) => {
    if (!ticket) return false;
    if (ticket.status === 'paid' || ticket.status === 'dismissed') return false;
    if (getTicketBalance(ticket) <= 0) return false;
    return !isOverdueTicket(ticket);
};

const TimeLeftClamped = ({ ticket }) => {
    const due = getDueState(ticket);
    const state = due?.state;

    if (state === 'overdue') {
        return (
            <span className="text-xs font-medium text-[#C8202F] whitespace-nowrap">
                <Mini>Time Left</Mini>0d 0h
            </span>
        );
    }

    const dueAt = ticket?.payment_due_at ? new Date(ticket.payment_due_at).getTime() : NaN;
    if (Number.isNaN(dueAt)) {
        return (
            <span className="text-xs text-[#64748B] whitespace-nowrap">
                <Mini>Time Left</Mini>—
            </span>
        );
    }

    const msLeft = Math.max(0, dueAt - Date.now());
    const totalHours = Math.floor(msLeft / 3_600_000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    const cls =
        state === 'due-soon'
            ? 'text-[#92600A] font-medium'
            : 'text-[#1F2937]';

    return (
        <span className={`text-xs whitespace-nowrap ${cls}`}>
            <Mini>Time Left</Mini>
            {days}d {hours}h
        </span>
    );
};

const Chip = ({ label, onClear }) => (
    <span className="inline-flex items-center gap-1 bg-[#E9ECF2] text-[#16233F] px-2.5 py-1 rounded-md text-xs">
        {label}
        <button onClick={onClear} className="hover:text-[#C8202F]">
            <X className="w-3 h-3" />
        </button>
    </span>
);

const L = ({ icon: I, children }) => (
    <label className="text-xs font-semibold text-[#16233F] mb-1.5 flex items-center gap-1.5">
        {I && <I className="w-3.5 h-3.5 text-[#92600A]" />}
        {children}
    </label>
);

const Mini = ({ children }) => (
    <i className="md:hidden not-italic text-[10px] text-[#94A3B8] mr-1">
        {children}
    </i>
);

const PreviewRow = ({ icon: Icon, label, value, mono, danger, accent }) => (
    <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-md bg-[#F5F6F8] flex items-center justify-center flex-shrink-0">
            <Icon className="w-3.5 h-3.5 text-[#64748B]" />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider">
                {label}
            </p>
            <p
                className={`text-sm truncate ${mono ? 'font-mono text-[#16233F]' : 'text-[#1F2937]'
                    } ${danger ? 'text-[#C8202F] font-medium' : ''}`}
                style={accent ? { color: accent } : undefined}
            >
                {value}
            </p>
        </div>
    </div>
);

const ViewToggle = ({ view, setView }) => (
    <div
        className="ml-auto flex bg-[#E9ECF2] rounded-full p-1 text-xs"
        role="group"
        aria-label="Choose layout"
    >
        {[['list', 'List', ListIcon], ['cards', 'Cards', LayoutGrid]].map(
            ([v, label, I]) => (
                <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${view === v
                        ? 'bg-[#16233F] text-white'
                        : 'text-[#64748B] hover:text-[#16233F]'
                        }`}
                >
                    <I className="w-3.5 h-3.5" />
                    {label}
                </button>
            ),
        )}
    </div>
);

const FilterShell = ({ title, onClose, onReset, children }) => (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="w-[92vw] max-w-lg max-h-[90vh] overflow-y-auto bg-[#FBF1DC] border-t-4 border-[#F0B429]">
            <DialogHeader>
                <DialogTitle className="text-base font-['Oswald'] font-medium text-[#16233F]">
                    {title}
                </DialogTitle>
            </DialogHeader>
            <div className="space-y-5">{children}</div>
            <div className="flex gap-2 pt-3 border-t border-[#F0B429]/30">
                <Button onClick={onClose} className="bg-[#1E8449] hover:bg-[#186B3B]">
                    Apply Filters
                </Button>
                <Button
                    onClick={onReset}
                    variant="ghost"
                    className="text-[#64748B] hover:text-[#C8202F]"
                >
                    <X className="w-4 h-4 mr-1" />
                    Reset
                </Button>
            </div>
        </DialogContent>
    </Dialog>
);

const Spec = ({ label, children, mono, danger }) => (
    <div className="min-w-0">
        <dt className="text-[10px] text-[#94A3B8]">{label}</dt>
        <dd
            className={`text-sm truncate ${mono ? 'font-mono text-[#16233F]' : 'text-[#1F2937]'
                } ${danger ? 'text-[#C8202F] font-medium' : ''}`}
        >
            {children}
        </dd>
    </div>
);

const paymentStatusBadge = (status) => {
    const meta = STATUS_META[status] || STATUS_META.pending;
    const Icon = meta.Icon;
    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${meta.chip}`}
        >
            <Icon className="w-3 h-3" />
            {meta.label.toUpperCase()}
        </span>
    );
};

const ticketStatusBadge = (status) => {
    const meta = TICKET_STATUS_META[status] || TICKET_STATUS_META.issued;
    return (
        <span
            className={`inline-block px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${meta.chip}`}
        >
            {meta.label.toUpperCase()}
        </span>
    );
};

const MonthPicker = ({ value, onChange, min, max }) => (
    <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-[#16233F]" />
        <Input
            type="month"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            min={min}
            max={max}
            className="w-48 focus-visible:ring-[#F0B429]"
        />
        {value && (
            <button
                type="button"
                onClick={() => onChange('')}
                className="text-xs text-[#64748B] hover:text-[#C8202F]"
                title="Clear month filter"
            >
                Clear
            </button>
        )}
    </div>
);

/* ============================================================
 * Confirmation dialog for recording payment
 * ============================================================ */
const RecordPaymentConfirmDialog = ({
    open,
    onClose,
    onConfirm,
    vehicle,
    tickets,
    totalAmount,
    receiptNumber,
    paidBy,
    notes,
    submitting,
}) => {
    if (!open) return null;

    return (
        <Dialog open={open} onOpenChange={(v) => !v && !submitting && onClose()}>
            <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-dashed border-[#CBD5E1] bg-white">
                    <DialogTitle className="font-['Oswald'] text-xl text-[#16233F] flex items-center gap-3">
                        <span className="w-10 h-10 rounded-lg bg-[#FBF1DC] flex items-center justify-center flex-shrink-0">
                            <ShieldCheck className="w-5 h-5 text-[#92600A]" />
                        </span>
                        <div>
                            <div className="leading-tight">Confirm Payment</div>
                            <div className="text-xs font-normal text-[#64748B] font-['Inter'] mt-0.5">
                                Please review the details before recording.
                            </div>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-hidden">
                        <div className="flex items-center gap-3 p-4">
                            <div className="w-12 h-12 rounded-full bg-[#E5F2EA] flex items-center justify-center flex-shrink-0">
                                <Car className="w-5 h-5 text-[#1E8449]" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="rounded-md border-2 border-[#16233F] bg-[#FFF6D6] px-2 py-1 inline-block">
                                    <span className="font-mono text-base font-bold tracking-widest text-[#16233F]">
                                        {vehicle?.platenumber}
                                    </span>
                                </div>
                                <p className="text-xs text-[#64748B] mt-1 truncate">
                                    {vehicle?.owner || '—'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">
                                Base Receipt
                            </p>
                            <p className="font-mono text-sm font-semibold text-[#16233F] truncate">
                                {receiptNumber}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">
                                Paid By
                            </p>
                            <p className="text-sm text-[#1F2937] truncate">
                                {paidBy || '—'}
                            </p>
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-2">
                            Tickets to be paid ({tickets.length})
                        </p>
                        <ul className="space-y-1.5">
                            {tickets.map((t) => {
                                const balance = getTicketBalance(t);
                                return (
                                    <li
                                        key={t.ticket_id}
                                        className="flex items-center justify-between gap-2 bg-[#F8F9FA] border border-[#E3E7EE] rounded-md px-3 py-2"
                                    >
                                        <span className="font-mono text-xs font-semibold text-[#16233F] truncate">
                                            {t.ticket_number}
                                        </span>
                                        <span className="font-semibold text-[#C8202F] tabular-nums text-sm whitespace-nowrap">
                                            {formatPeso(balance)}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {notes && (
                        <div>
                            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">
                                Notes
                            </p>
                            <p className="text-xs text-[#64748B] line-clamp-3">
                                {notes}
                            </p>
                        </div>
                    )}

                    <div className="rounded-xl bg-[#16233F] text-white p-4">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-[#C7CEDB] uppercase tracking-wider">
                                Total to Record
                            </span>
                            <span className="text-2xl font-['Oswald'] font-semibold tabular-nums">
                                {formatPeso(totalAmount)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/10 text-xs">
                            <span className="text-[#C7CEDB]">Payment method</span>
                            <span className="flex items-center gap-1 font-medium text-[#5FD28C]">
                                <Banknote className="w-3.5 h-3.5" />
                                Cash
                            </span>
                        </div>
                    </div>

                    <div className="flex items-start gap-2 bg-[#FBF1DC] border border-[#F0B429]/40 rounded-lg p-3 text-xs text-[#92600A]">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p>
                            This action cannot be undone from here. Make sure the cash has
                            been received before confirming.
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 px-6 py-4 border-t border-dashed border-[#CBD5E1] bg-white">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={submitting}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={onConfirm}
                        disabled={submitting}
                        className="flex-1 bg-[#1E8449] hover:bg-[#186B3B]"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Recording…
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Yes, Record Payment
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

/* ============================================================
 * Plate search payment modal
 * ============================================================ */
const PlateSearchPaymentModal = ({ open, onClose, onSuccess }) => {
    const notify = useAlert();
    const queryClient = useQueryClient();

    const [plateSearch, setPlateSearch] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [matchedVehicle, setMatchedVehicle] = useState(null);
    const [pendingTickets, setPendingTickets] = useState([]);

    const [receiptNumber, setReceiptNumber] = useState('');
    const [paidBy, setPaidBy] = useState('');
    const [notes, setNotes] = useState('');
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    useEffect(() => {
        if (!open) {
            setPlateSearch('');
            setSearchError('');
            setMatchedVehicle(null);
            setPendingTickets([]);
            setReceiptNumber('');
            setPaidBy('');
            setNotes('');
            setFormError('');
            setConfirmOpen(false);
        }
    }, [open]);

    const handleSearch = async (e) => {
        e?.preventDefault();
        const plate = plateSearch.trim().toUpperCase();
        if (!plate) {
            setSearchError('Enter a plate number to search.');
            return;
        }

        setSearching(true);
        setSearchError('');
        setMatchedVehicle(null);
        setPendingTickets([]);

        try {
            const vehicleRes = await searchVehicleByPlate(plate);
            const vehicles = vehicleRes.data || [];

            if (!vehicles.length) {
                setSearchError(`No vehicle found with plate "${plate}".`);
                setSearching(false);
                return;
            }

            const vehicle = vehicles[0];
            setMatchedVehicle(vehicle);

            const pendingRes = await getPendingPayments(1, 200, {
                search: vehicle.platenumber,
            });
            const tickets = getDataArray(pendingRes);

            const vehicleTickets = tickets.filter(
                (t) =>
                    (String(t.vehicle_id) === String(vehicle.vehicle_id) ||
                        String(t.vehicle?.vehicle_id) === String(vehicle.vehicle_id)) &&
                    t.status !== 'paid',
            );

            if (!vehicleTickets.length) {
                setSearchError(
                    `No unpaid tickets found for plate "${vehicle.platenumber}".`,
                );
            } else {
                setPendingTickets(vehicleTickets);
                setPaidBy(vehicle.owner || '');
            }
        } catch (err) {
            console.error('Plate search error:', err);
            setSearchError(
                err.response?.data?.message ||
                'Failed to search for vehicle. Please try again.',
            );
        } finally {
            setSearching(false);
        }
    };

    const totalOutstanding = pendingTickets.reduce(
        (sum, t) => sum + getTicketBalance(t),
        0,
    );

    const handleSubmitClick = (e) => {
        e?.preventDefault();
        setFormError('');

        if (!pendingTickets.length) {
            setFormError('No unpaid tickets to pay.');
            return;
        }
        if (!receiptNumber.trim()) {
            setFormError('Receipt number is required.');
            return;
        }

        setConfirmOpen(true);
    };

    const handleConfirmedPayment = async () => {
        setFormError('');
        setSubmitting(true);

        let successCount = 0;
        let failedCount = 0;
        const errors = [];

        for (const ticket of pendingTickets) {
            const outstanding = getTicketBalance(ticket);
            if (outstanding <= 0) continue;

            try {
                await createPayment({
                    ticket_id: ticket.ticket_id,
                    receipt_number: `${receiptNumber.trim()}-${ticket.ticket_number}`,
                    amount_paid: outstanding,
                    payment_method: 'cash',
                    payment_date: new Date().toISOString(),
                    paid_by: paidBy || undefined,
                    notes: notes || undefined,
                });
                successCount++;
            } catch (err) {
                failedCount++;
                const msg =
                    err.response?.data?.errors?.receipt_number?.[0] ||
                    err.response?.data?.message ||
                    `Failed for ${ticket.ticket_number}`;
                errors.push(msg);
            }
        }

        setSubmitting(false);
        setConfirmOpen(false);

        if (successCount > 0) {
            queryClient.invalidateQueries(['payments-pending']);
            queryClient.invalidateQueries(['payments-history']);
            queryClient.invalidateQueries(['payments-overdue-count']);
            queryClient.invalidateQueries(['tickets']);

            notify.success(
                `${successCount} ticket${successCount > 1 ? 's' : ''} paid successfully.`,
            );
            onSuccess?.();
            onClose();
        }

        if (failedCount > 0) {
            setFormError(
                `${failedCount} payment${failedCount > 1 ? 's' : ''} failed:\n${errors.join('\n')}`,
            );
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
                <DialogContent className="w-[80vw] max-w-[1200px] max-h-[92vh] overflow-hidden p-0 gap-0">
                    <DialogHeader className="px-7 pt-6 pb-5 border-b border-dashed border-[#CBD5E1] bg-white">
                        <DialogTitle className="font-['Oswald'] text-2xl text-[#16233F] flex items-center gap-3">
                            <span className="w-10 h-10 rounded-lg bg-[#E5F2EA] flex items-center justify-center flex-shrink-0">
                                <Receipt className="w-5 h-5 text-[#1E8449]" />
                            </span>
                            <div>
                                <div className="leading-tight">Record Payment</div>
                                <div className="text-xs font-normal text-[#64748B] font-['Inter'] mt-0.5">
                                    Search by plate number and settle unpaid tickets
                                </div>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    <form
                        onSubmit={handleSubmitClick}
                        className="flex flex-col max-h-[calc(92vh-100px)]"
                    >
                        <div className="flex-1 overflow-y-auto">
                            <div className="px-7 py-6 border-b border-dashed border-[#CBD5E1] bg-[#F8F9FA]">
                                <div className="max-w-2xl">
                                    <label className="text-xs font-semibold text-[#16233F] mb-2 flex items-center gap-1.5">
                                        <Car className="w-3.5 h-3.5 text-[#92600A]" />
                                        Search by Plate Number{' '}
                                        <span className="text-[#C8202F]">*</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                                            <Input
                                                placeholder="e.g., ABC-1234"
                                                value={plateSearch}
                                                onChange={(e) =>
                                                    setPlateSearch(
                                                        e.target.value.toUpperCase(),
                                                    )
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleSearch();
                                                    }
                                                }}
                                                className="pl-10 h-11 font-mono tracking-widest text-base font-bold focus-visible:ring-[#F0B429]"
                                                autoFocus
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={handleSearch}
                                            disabled={searching}
                                            className="h-11 bg-[#16233F] hover:bg-[#0F1A2E] min-w-[120px]"
                                        >
                                            {searching ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <Search className="w-4 h-4 mr-2" />
                                            )}
                                            Search
                                        </Button>
                                    </div>
                                    {searchError && (
                                        <div className="mt-3 flex items-start gap-2 bg-[#FBE7E9] text-[#C8202F] p-3 rounded-lg text-sm border border-[#C8202F]/20">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                            <span>{searchError}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {matchedVehicle && (
                                <div className="p-7 space-y-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                                        <div className="lg:col-span-1 p-7 space-y-6 border-r border-dashed border-[#CBD5E1] bg-[#F8F9FA]">
                                            <section>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Car className="w-4 h-4 text-[#1E8449]" />
                                                    <h3 className="font-['Oswald'] text-lg text-[#16233F]">
                                                        Vehicle
                                                    </h3>
                                                </div>
                                                <div className="rounded-xl bg-white border border-[#E3E7EE] overflow-hidden">
                                                    <div
                                                        className="h-1.5"
                                                        style={{ background: '#1E8449' }}
                                                    />
                                                    <div className="p-4">
                                                        <div className="rounded-md border-2 border-[#16233F] bg-[#FFF6D6] py-2 text-center font-mono text-xl font-bold tracking-[0.25em] text-[#16233F]">
                                                            {matchedVehicle.platenumber}
                                                        </div>
                                                        <dl className="grid grid-cols-1 gap-y-3 mt-4">
                                                            <PreviewRow
                                                                icon={UserIcon}
                                                                label="Owner"
                                                                value={matchedVehicle.owner || '—'}
                                                            />
                                                            <PreviewRow
                                                                icon={Car}
                                                                label="Make / Model"
                                                                value={
                                                                    [
                                                                        matchedVehicle.make,
                                                                        matchedVehicle.model,
                                                                    ]
                                                                        .filter(Boolean)
                                                                        .join(' ') || '—'
                                                                }
                                                            />
                                                            <PreviewRow
                                                                icon={Tag}
                                                                label="Color"
                                                                value={matchedVehicle.color || '—'}
                                                            />
                                                        </dl>
                                                    </div>
                                                </div>
                                            </section>

                                            <section className="rounded-xl bg-[#16233F] text-white p-4">
                                                <p className="text-[10px] text-[#C7CEDB] uppercase tracking-wider mb-1">
                                                    Total to Pay
                                                </p>
                                                <p className="text-3xl font-['Oswald'] font-semibold tabular-nums">
                                                    {formatPeso(totalOutstanding)}
                                                </p>
                                                <p className="text-xs text-[#C7CEDB] mt-1">
                                                    {pendingTickets.length}{' '}
                                                    {pendingTickets.length === 1
                                                        ? 'ticket'
                                                        : 'tickets'}{' '}
                                                    to be paid in full
                                                </p>
                                            </section>

                                            <section className="rounded-xl border border-[#F0B429]/30 bg-[#FBF1DC] p-4">
                                                <div className="flex items-start gap-2.5">
                                                    <Info className="w-4 h-4 text-[#92600A] mt-0.5 flex-shrink-0" />
                                                    <div className="text-xs text-[#92600A] leading-relaxed">
                                                        <p className="font-semibold mb-1">
                                                            Full settlement required
                                                        </p>
                                                        <p>
                                                            All unpaid tickets of this vehicle
                                                            are paid together. Each ticket is
                                                            paid in full with its own receipt
                                                            number.
                                                        </p>
                                                    </div>
                                                </div>
                                            </section>
                                        </div>

                                        <div className="lg:col-span-2 p-7 space-y-6">
                                            <section>
                                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                                    <TicketIcon className="w-4 h-4 text-[#F0B429]" />
                                                    <h3 className="font-['Oswald'] text-lg text-[#16233F]">
                                                        Unpaid Tickets
                                                    </h3>
                                                    <span className="h-px flex-1 bg-[#E3E7EE]" />
                                                    <span className="text-xs font-medium text-[#64748B]">
                                                        All {pendingTickets.length} must be paid
                                                        together
                                                    </span>
                                                </div>

                                                <ul className="space-y-3">
                                                    {pendingTickets.map((t) => {
                                                        const balance = getTicketBalance(t);
                                                        return (
                                                            <li
                                                                key={t.ticket_id}
                                                                className="rounded-xl border-2 border-[#E3E7EE] bg-white overflow-hidden"
                                                            >
                                                                <div className="flex items-center justify-between gap-2 px-4 py-2 text-xs bg-[#16233F] text-white">
                                                                    <span className="font-mono font-semibold truncate">
                                                                        {t.ticket_number}
                                                                    </span>
                                                                    {ticketStatusBadge(t.status)}
                                                                </div>
                                                                <div className="p-4 space-y-3">
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <Spec label="Violator">
                                                                            {t.violator?.firstname || ''}{' '}
                                                                            {t.violator?.lastname || ''}
                                                                        </Spec>
                                                                        <Spec label="License" mono>
                                                                            {t.violator?.license || '—'}
                                                                        </Spec>
                                                                        <Spec label="Date">
                                                                            {t.violation_datetime
                                                                                ? new Date(
                                                                                    t.violation_datetime,
                                                                                ).toLocaleDateString()
                                                                                : '—'}
                                                                        </Spec>
                                                                        <Spec label="Location">
                                                                            {t.location || '—'}
                                                                        </Spec>
                                                                    </div>

                                                                    <div className="pt-3 border-t border-dashed border-[#CBD5E1]">
                                                                        <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-2">
                                                                            Violations
                                                                        </p>
                                                                        <ul className="space-y-1">
                                                                            {(t.violations || []).map(
                                                                                (v, i) => (
                                                                                    <li
                                                                                        key={i}
                                                                                        className="flex items-start justify-between gap-2 text-sm"
                                                                                    >
                                                                                        <span className="text-[#1F2937] flex-1 min-w-0">
                                                                                            <span className="inline-flex items-start gap-1.5">
                                                                                                <AlertTriangle className="w-3.5 h-3.5 text-[#C2541F] mt-0.5 flex-shrink-0" />
                                                                                                <span>
                                                                                                    {v
                                                                                                        .violation_type
                                                                                                        ?.violation_name ||
                                                                                                        v.violation_name ||
                                                                                                        'Violation'}
                                                                                                </span>
                                                                                            </span>
                                                                                        </span>
                                                                                        <span className="font-semibold text-[#C8202F] tabular-nums whitespace-nowrap">
                                                                                            {formatPeso(
                                                                                                v.fine_amount,
                                                                                            )}
                                                                                        </span>
                                                                                    </li>
                                                                                ),
                                                                            )}
                                                                        </ul>
                                                                    </div>

                                                                    <div className="pt-3 border-t border-dashed border-[#CBD5E1] flex items-center justify-between">
                                                                        <span className="text-sm text-[#64748B]">
                                                                            Balance
                                                                        </span>
                                                                        <span className="text-xl font-['Oswald'] font-semibold text-[#C8202F] tabular-nums">
                                                                            {formatPeso(balance)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </section>

                                            <section>
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Receipt className="w-4 h-4 text-[#F0B429]" />
                                                    <h3 className="font-['Oswald'] text-lg text-[#16233F]">
                                                        Receipt
                                                    </h3>
                                                    <span className="h-px flex-1 bg-[#E3E7EE]" />
                                                </div>

                                                {formError && (
                                                    <div className="mb-4 bg-[#FBE7E9] text-[#C8202F] p-3.5 rounded-md flex items-start gap-2.5 text-sm border-l-4 border-[#C8202F]">
                                                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                                        <span className="whitespace-pre-line">
                                                            {formError}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-xs font-semibold text-[#16233F] mb-1.5 flex items-center gap-1.5">
                                                            Base Receipt Number{' '}
                                                            <span className="text-[#C8202F]">
                                                                *
                                                            </span>
                                                        </label>
                                                        <Input
                                                            placeholder="e.g., RCP-2026-000123"
                                                            value={receiptNumber}
                                                            onChange={(e) =>
                                                                setReceiptNumber(e.target.value)
                                                            }
                                                            required
                                                            className="focus-visible:ring-[#F0B429] font-mono h-11"
                                                        />
                                                        <p className="text-[11px] text-[#94A3B8] mt-1.5">
                                                            Each ticket gets a unique receipt:{' '}
                                                            <span className="font-mono">
                                                                {receiptNumber || 'BASE'}
                                                                -TKT-XXXX
                                                            </span>
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-semibold text-[#16233F] mb-1.5 block">
                                                            Paid By
                                                        </label>
                                                        <Input
                                                            placeholder="Name of payer"
                                                            value={paidBy}
                                                            onChange={(e) =>
                                                                setPaidBy(e.target.value)
                                                            }
                                                            className="focus-visible:ring-[#F0B429] h-11"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="mt-4">
                                                    <label className="text-xs font-semibold text-[#16233F] mb-1.5 block">
                                                        Payment Method
                                                    </label>
                                                    <div className="flex items-center gap-2 h-11 px-3 rounded-md border border-input bg-[#F5F6F8]">
                                                        <Banknote className="w-4 h-4 text-[#1E8449]" />
                                                        <span className="text-sm font-medium text-[#1F2937]">
                                                            Cash
                                                        </span>
                                                        <span className="ml-auto text-[10px] text-[#94A3B8] uppercase tracking-wider">
                                                            Fixed
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-4">
                                                    <label className="text-xs font-semibold text-[#16233F] mb-1.5 block">
                                                        Notes
                                                    </label>
                                                    <textarea
                                                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                                                        placeholder="Optional notes about this payment..."
                                                        value={notes}
                                                        onChange={(e) => setNotes(e.target.value)}
                                                    />
                                                </div>
                                            </section>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-3 px-7 py-4 border-t border-dashed border-[#CBD5E1] bg-white">
                            <div className="text-xs text-[#64748B] flex items-center gap-2">
                                <AlertCircle className="w-3.5 h-3.5 text-[#94A3B8]" />
                                {!matchedVehicle ? (
                                    <span>Search for a plate number to get started.</span>
                                ) : !pendingTickets.length ? (
                                    <span>No unpaid tickets for this vehicle.</span>
                                ) : !receiptNumber.trim() ? (
                                    <span>Enter the receipt number to continue.</span>
                                ) : (
                                    <span>
                                        Ready to record{' '}
                                        <strong className="text-[#16233F]">
                                            {formatPeso(totalOutstanding)}
                                        </strong>{' '}
                                        for{' '}
                                        <strong className="text-[#16233F]">
                                            {pendingTickets.length}
                                        </strong>{' '}
                                        ticket{pendingTickets.length === 1 ? '' : 's'}.
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onClose}
                                    disabled={submitting}
                                    className="min-w-[100px]"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    className="bg-[#1E8449] hover:bg-[#186B3B] min-w-[200px]"
                                    disabled={
                                        submitting ||
                                        !matchedVehicle ||
                                        !pendingTickets.length ||
                                        !receiptNumber.trim()
                                    }
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Recording…
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                            Record{' '}
                                            {pendingTickets.length > 0
                                                ? `${pendingTickets.length} `
                                                : ''}
                                            Payment{pendingTickets.length > 1 ? 's' : ''}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <RecordPaymentConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleConfirmedPayment}
                vehicle={matchedVehicle}
                tickets={pendingTickets}
                totalAmount={totalOutstanding}
                receiptNumber={receiptNumber}
                paidBy={paidBy}
                notes={notes}
                submitting={submitting}
            />
        </>
    );
};

const Payments = () => {
    const queryClient = useQueryClient();
    const [tab, setTab] = useState('unpaid');

    // Filter mode inside the Unpaid Tickets view: 'unpaid' | 'history'
    const [recordMode, setRecordMode] = useState('unpaid');

    const [refreshing, setRefreshing] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    /* ---------- Unpaid tickets state ---------- */
    const [unpaidView, setUnpaidView] = useState('list');
    const [unpaidPage, setUnpaidPage] = useState(1);
    const [unpaidSearch, setUnpaidSearch] = useState('');
    const [unpaidMonth, setUnpaidMonth] = useState('');
    const [unpaidShowFilters, setUnpaidShowFilters] = useState(false);
    const [unpaidFilters, setUnpaidFilters] = useState({
        min_balance: '',
        max_balance: '',
        only_partial: false,
    });

    /* ---------- Payment History (as a filter) state ---------- */
    const [historyView, setHistoryView] = useState('list');
    const [historyPage, setHistoryPage] = useState(1);
    const [historySearch, setHistorySearch] = useState('');
    const [historyMonth, setHistoryMonth] = useState('');
    const [historyShowFilters, setHistoryShowFilters] = useState(false);
    const [historyFilters, setHistoryFilters] = useState({
        status: [],
        method: '',
        date_from: '',
        date_to: '',
        min_amount: '',
        max_amount: '',
    });

    /* ---------- Ticket payment history dialog ---------- */
    const [historyTicketId, setHistoryTicketId] = useState(null);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
    const [copiedField, setCopiedField] = useState(null);

    /* ---------- Queries ---------- */
    const {
        data: pendingResponse,
        isLoading: pendingLoading,
        refetch: refetchPending,
        error: pendingError,
    } = useQuery({
        queryKey: ['payments-pending', unpaidPage, unpaidSearch, unpaidMonth],
        queryFn: () =>
            getPendingPayments(unpaidPage, ITEMS_PER_PAGE, {
                search: unpaidSearch || undefined,
                month: unpaidMonth || undefined,
            }),
        keepPreviousData: true,
        staleTime: 1000 * 30,
    });

    const isPaymentHistoryFiltered = tab === 'unpaid' && recordMode === 'history';

    const {
        data: historyResponse,
        isLoading: historyLoading,
        refetch: refetchHistory,
        error: historyError,
    } = useQuery({
        queryKey: [
            'payments-history',
            historyPage,
            historySearch,
            historyFilters,
            historyMonth,
        ],
        queryFn: () =>
            getPayments(historyPage, ITEMS_PER_PAGE, {
                ticket_number: historySearch || undefined,
                month: historyMonth || undefined,
                status: historyFilters.status.length
                    ? historyFilters.status.join(',')
                    : undefined,
                date_from: historyFilters.date_from || undefined,
                date_to: historyFilters.date_to || undefined,
            }),
        keepPreviousData: true,
        staleTime: 1000 * 60,
        enabled: isPaymentHistoryFiltered,
    });

    const { data: overdueCountResponse } = useQuery({
        queryKey: ['payments-overdue-count'],
        queryFn: () => getOverduePayments(1, 1),
        staleTime: 1000 * 60,
        refetchInterval: 1000 * 60,
    });
    const overdueCount = overdueCountResponse?.data?.total || 0;

    const { data: ticketHistoryResponse, isLoading: ticketHistoryLoading } =
        useQuery({
            queryKey: ['payments-by-ticket', historyTicketId],
            queryFn: () => getPaymentsByTicket(historyTicketId),
            enabled: !!historyTicketId && isHistoryDialogOpen,
        });

    /* ---------- Derived: Unpaid (not paid & not overdue) ---------- */
    const unpaidTickets = useMemo(() => {
        let list = getDataArray(pendingResponse);

        // Strictly exclude paid tickets and overdue tickets
        list = list.filter((t) => isUnpaidNotOverdueTicket(t));

        if (unpaidFilters.only_partial) {
            list = list.filter((t) => (parseFloat(t.total_paid) || 0) > 0);
        }
        if (unpaidFilters.min_balance !== '') {
            list = list.filter(
                (t) =>
                    getTicketBalance(t) >= parseFloat(unpaidFilters.min_balance),
            );
        }
        if (unpaidFilters.max_balance !== '') {
            list = list.filter(
                (t) =>
                    getTicketBalance(t) <= parseFloat(unpaidFilters.max_balance),
            );
        }

        return [...list].sort((a, b) => {
            const cmp = byFields('lastname', 'firstname')(
                a.violator || {},
                b.violator || {},
            );
            if (cmp !== 0) return cmp;
            return (a.ticket_number || '').localeCompare(b.ticket_number || '');
        });
    }, [pendingResponse, unpaidFilters]);

    const pendingMeta = getMeta(pendingResponse);

    const payments = useMemo(() => {
        let list = getDataArray(historyResponse);

        if (historyFilters.min_amount !== '') {
            list = list.filter(
                (p) =>
                    (parseFloat(p.amount_paid) || 0) >=
                    parseFloat(historyFilters.min_amount),
            );
        }
        if (historyFilters.max_amount !== '') {
            list = list.filter(
                (p) =>
                    (parseFloat(p.amount_paid) || 0) <=
                    parseFloat(historyFilters.max_amount),
            );
        }
        if (historyFilters.method) {
            list = list.filter(
                (p) => p.payment_method === historyFilters.method,
            );
        }

        return [...list].sort((a, b) => {
            const cmp = byFields('lastname', 'firstname')(
                a.ticket?.violator || {},
                b.ticket?.violator || {},
            );
            if (cmp !== 0) return cmp;
            return (a.receipt_number || '').localeCompare(
                b.receipt_number || '',
            );
        });
    }, [historyResponse, historyFilters]);

    const historyMeta = getMeta(historyResponse);

    /* ---------- Filter counts ---------- */
    const unpaidFilterCount = useMemo(() => {
        let c = 0;
        if (unpaidSearch) c++;
        if (unpaidMonth) c++;
        if (unpaidFilters.min_balance || unpaidFilters.max_balance) c++;
        if (unpaidFilters.only_partial) c++;
        return c;
    }, [unpaidSearch, unpaidMonth, unpaidFilters]);

    const historyFilterCount = useMemo(() => {
        let c = 0;
        if (historySearch) c++;
        if (historyMonth) c++;
        if (historyFilters.status.length) c++;
        if (historyFilters.method) c++;
        if (historyFilters.date_from || historyFilters.date_to) c++;
        if (historyFilters.min_amount || historyFilters.max_amount) c++;
        return c;
    }, [historySearch, historyMonth, historyFilters]);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);

        try {
            const jobs = [
                refetchPending({ cancelRefetch: true }),
                queryClient.invalidateQueries(['payments-overdue-count']),
            ];
            if (isPaymentHistoryFiltered) {
                jobs.push(refetchHistory({ cancelRefetch: true }));
            }
            await Promise.all(jobs);
        } catch (e) {
            console.warn('Refresh failed:', e);
        } finally {
            setTimeout(() => setRefreshing(false), 600);
        }
    };

    const openTicketHistory = (ticketId) => {
        setHistoryTicketId(ticketId);
        setIsHistoryDialogOpen(true);
    };

    const toggleHistoryStatus = (value) => {
        setHistoryFilters((prev) => ({
            ...prev,
            status: prev.status.includes(value)
                ? prev.status.filter((s) => s !== value)
                : [...prev.status, value],
        }));
    };

    const applyHistoryPreset = (days) =>
        setHistoryFilters((prev) => ({
            ...prev,
            date_from: daysAgoISO(days),
            date_to: daysAgoISO(0),
        }));

    const clearUnpaidFilters = () => {
        setUnpaidMonth('');
        setUnpaidFilters({
            min_balance: '',
            max_balance: '',
            only_partial: false,
        });
    };

    const clearHistoryFilters = () => {
        setHistoryMonth('');
        setHistoryFilters({
            status: [],
            method: '',
            date_from: '',
            date_to: '',
            min_amount: '',
            max_amount: '',
        });
    };

    const handleCopy = async (label, value) => {
        const ok = await copyText(value);
        if (ok) {
            setCopiedField(label);
            setTimeout(() => setCopiedField(null), 2000);
        }
    };

    const totalUnpaidCount = unpaidTickets.length;

    const ticketHistory = ticketHistoryResponse?.data?.ticket;
    const ticketHistorySummary = ticketHistoryResponse?.data?.summary;
    const ticketPayments = ticketHistory?.payments || [];

    const currentMonth = toISOMonth(new Date());

    /* ---------- Filter Modals ---------- */
    const unpaidPanel = (
        <FilterShell
            title="Filter Unpaid Tickets"
            onClose={() => setUnpaidShowFilters(false)}
            onReset={clearUnpaidFilters}
        >
            <div>
                <L icon={CalendarDays}>Month</L>
                <MonthPicker
                    value={unpaidMonth}
                    onChange={(v) => setUnpaidMonth(v)}
                    max={currentMonth}
                />
                <p className="text-[11px] text-[#94A3B8] mt-1.5">
                    Filters by the month of the violation date.
                </p>
            </div>

            <div>
                <L>Balance range (₱)</L>
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        type="number"
                        placeholder="Min"
                        value={unpaidFilters.min_balance}
                        onChange={(e) =>
                            setUnpaidFilters({
                                ...unpaidFilters,
                                min_balance: e.target.value,
                            })
                        }
                        className="w-24 focus-visible:ring-[#F0B429]"
                    />
                    <span className="text-[#64748B] text-sm">to</span>
                    <Input
                        type="number"
                        placeholder="Max"
                        value={unpaidFilters.max_balance}
                        onChange={(e) =>
                            setUnpaidFilters({
                                ...unpaidFilters,
                                max_balance: e.target.value,
                            })
                        }
                        className="w-24 focus-visible:ring-[#F0B429]"
                    />
                </div>
            </div>
            <div>
                <L>Extra</L>
                <label className="flex items-center gap-2 text-sm text-[#92600A] cursor-pointer">
                    <input
                        type="checkbox"
                        checked={unpaidFilters.only_partial}
                        onChange={(e) =>
                            setUnpaidFilters({
                                ...unpaidFilters,
                                only_partial: e.target.checked,
                            })
                        }
                        className="w-4 h-4 accent-[#92600A]"
                    />
                    Partially paid only
                </label>
            </div>
        </FilterShell>
    );

    const historyPanel = (
        <FilterShell
            title="Filter Payment History"
            onClose={() => setHistoryShowFilters(false)}
            onReset={clearHistoryFilters}
        >
            <div>
                <L icon={CalendarDays}>Month</L>
                <MonthPicker
                    value={historyMonth}
                    onChange={(v) => setHistoryMonth(v)}
                    max={currentMonth}
                />
                <p className="text-[11px] text-[#94A3B8] mt-1.5">
                    Filters by the month of the payment date.
                </p>
            </div>

            <div>
                <L>Status</L>
                <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((opt) => {
                        const active = historyFilters.status.includes(opt.value);
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => toggleHistoryStatus(opt.value)}
                                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${active
                                    ? 'bg-[#16233F] text-white border-[#16233F]'
                                    : 'bg-white text-[#64748B] border-[#E9ECF2] hover:bg-[#F5F6F8]'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div>
                <L>Payment method</L>
                <select
                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-[#1F2937] focus-visible:ring-[#F0B429]"
                    value={historyFilters.method}
                    onChange={(e) =>
                        setHistoryFilters({
                            ...historyFilters,
                            method: e.target.value,
                        })
                    }
                >
                    <option value="">All Methods</option>
                    {METHOD_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>
                            {m.label}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <L icon={Calendar}>Date range</L>
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        type="date"
                        value={historyFilters.date_from}
                        onChange={(e) =>
                            setHistoryFilters({
                                ...historyFilters,
                                date_from: e.target.value,
                            })
                        }
                        className="w-36 focus-visible:ring-[#F0B429]"
                    />
                    <span className="text-[#64748B] text-sm">to</span>
                    <Input
                        type="date"
                        value={historyFilters.date_to}
                        onChange={(e) =>
                            setHistoryFilters({
                                ...historyFilters,
                                date_to: e.target.value,
                            })
                        }
                        className="w-36 focus-visible:ring-[#F0B429]"
                    />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <span className="text-xs text-[#92600A]/70 mr-1">Quick:</span>
                    {PRESETS.map((p) => (
                        <button
                            key={p.label}
                            type="button"
                            onClick={() => applyHistoryPreset(p.days)}
                            className="text-xs px-2.5 py-1 rounded-full bg-white text-[#16233F] hover:bg-[#16233F] hover:text-white transition-colors font-medium"
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <L>Amount paid (₱)</L>
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        type="number"
                        placeholder="Min"
                        value={historyFilters.min_amount}
                        onChange={(e) =>
                            setHistoryFilters({
                                ...historyFilters,
                                min_amount: e.target.value,
                            })
                        }
                        className="w-24 focus-visible:ring-[#F0B429]"
                    />
                    <span className="text-[#64748B] text-sm">to</span>
                    <Input
                        type="number"
                        placeholder="Max"
                        value={historyFilters.max_amount}
                        onChange={(e) =>
                            setHistoryFilters({
                                ...historyFilters,
                                max_amount: e.target.value,
                            })
                        }
                        className="w-24 focus-visible:ring-[#F0B429]"
                    />
                </div>
            </div>
        </FilterShell>
    );

    const unpaidChips = [
        unpaidSearch && [`Search: ${unpaidSearch}`, () => setUnpaidSearch('')],
        unpaidMonth && [
            `Month: ${formatMonthLabel(unpaidMonth)}`,
            () => setUnpaidMonth(''),
        ],
        (unpaidFilters.min_balance || unpaidFilters.max_balance) && [
            `Balance: ₱${unpaidFilters.min_balance || '0'} → ₱${unpaidFilters.max_balance || '∞'}`,
            () =>
                setUnpaidFilters({
                    ...unpaidFilters,
                    min_balance: '',
                    max_balance: '',
                }),
        ],
        unpaidFilters.only_partial && [
            'Partially paid only',
            () => setUnpaidFilters({ ...unpaidFilters, only_partial: false }),
        ],
    ].filter(Boolean);

    const historyChips = [
        historySearch && [`Search: ${historySearch}`, () => setHistorySearch('')],
        historyMonth && [
            `Month: ${formatMonthLabel(historyMonth)}`,
            () => setHistoryMonth(''),
        ],
        historyFilters.status.length > 0 && [
            `Status: ${historyFilters.status.join(', ')}`,
            () => setHistoryFilters({ ...historyFilters, status: [] }),
        ],
        historyFilters.method && [
            `Method: ${historyFilters.method}`,
            () => setHistoryFilters({ ...historyFilters, method: '' }),
        ],
        (historyFilters.date_from || historyFilters.date_to) && [
            `Date: ${historyFilters.date_from || '…'} → ${historyFilters.date_to || '…'}`,
            () =>
                setHistoryFilters({
                    ...historyFilters,
                    date_from: '',
                    date_to: '',
                }),
        ],
        (historyFilters.min_amount || historyFilters.max_amount) && [
            `Amount: ₱${historyFilters.min_amount || '0'} → ₱${historyFilters.max_amount || '∞'}`,
            () =>
                setHistoryFilters({
                    ...historyFilters,
                    min_amount: '',
                    max_amount: '',
                }),
        ],
    ].filter(Boolean);

    return (
        <div className="space-y-6 font-['Inter']">
            {/* Navy banner */}
            <header className="relative overflow-hidden rounded-2xl bg-[#16233F] text-white px-6 py-7 flex flex-wrap items-center justify-between gap-4">
                <div
                    className="absolute inset-0 opacity-[0.07] pointer-events-none"
                    style={{
                        backgroundImage:
                            'repeating-linear-gradient(115deg, transparent 0 40px, #F0B429 40px 42px)',
                    }}
                />
                <div className="relative">
                    <h1 className="text-4xl font-['Oswald'] font-semibold tracking-tight">
                        Payments
                    </h1>
                    <p className="text-[#C7CEDB] text-sm mt-1">
                        Record receipt numbers and settle traffic fines.
                    </p>
                </div>
                <div className="relative flex gap-2">
                    <Button
                        onClick={handleRefresh}
                        variant="outline"
                        disabled={refreshing}
                        className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white disabled:opacity-70"
                    >
                        <RefreshCw
                            className={`w-4 h-4 mr-2 transition-transform ${refreshing ? 'animate-spin' : ''}`}
                        />
                        {refreshing ? 'Refreshing…' : 'Refresh'}
                    </Button>
                    <Button
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="bg-[#1E8449] hover:bg-[#186B3B] text-white"
                    >
                        <Receipt className="w-4 h-4 mr-2" />
                        Record Payment
                    </Button>
                </div>
            </header>

            <Tabs value={tab} onValueChange={setTab} className="space-y-6">
                <TabsList className="bg-[#E9ECF2]">
                    <TabsTrigger
                        value="unpaid"
                        className="data-[state=active]:bg-[#16233F] data-[state=active]:text-white flex items-center gap-2"
                    >
                        <Wallet className="w-4 h-4" />
                        Unpaid Tickets
                        <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                            {totalUnpaidCount}
                        </span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="overdue"
                        className="data-[state=active]:bg-[#C8202F] data-[state=active]:text-white flex items-center gap-2"
                    >
                        <AlertTriangle className="w-4 h-4" />
                        Overdue
                        <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                            {overdueCount}
                        </span>
                    </TabsTrigger>
                </TabsList>

                {/* ==================== UNPAID TICKETS TAB (with Payment History filter) ==================== */}
                <TabsContent value="unpaid" className="mt-0">
                    <div className="space-y-4 min-w-0">
                        {/* Payment History filter toggle */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-[#64748B] flex items-center gap-1.5 mr-1">
                                <Filter className="w-3.5 h-3.5 text-[#16233F]" />
                                View Filter:
                            </span>
                            <button
                                type="button"
                                onClick={() => setRecordMode('unpaid')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${recordMode === 'unpaid'
                                    ? 'bg-[#16233F] text-white border-[#16233F]'
                                    : 'bg-white text-[#64748B] border-[#E3E7EE] hover:text-[#16233F]'
                                    }`}
                            >
                                <Wallet className="w-3.5 h-3.5" />
                                Unpaid (Not Overdue)
                            </button>
                            <button
                                type="button"
                                onClick={() => setRecordMode('history')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${recordMode === 'history'
                                    ? 'bg-[#16233F] text-white border-[#16233F]'
                                    : 'bg-white text-[#64748B] border-[#E3E7EE] hover:text-[#16233F]'
                                    }`}
                            >
                                <Receipt className="w-3.5 h-3.5" />
                                Payment History
                            </button>
                        </div>

                        {recordMode === 'unpaid' ? (
                            <>
                                {unpaidShowFilters && unpaidPanel}

                                <div className="flex flex-wrap items-center gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => setUnpaidShowFilters((v) => !v)}
                                        className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
                                    >
                                        <Filter className="w-4 h-4 mr-2" />
                                        Filters
                                        {unpaidFilterCount > 0 && (
                                            <span className="ml-2 bg-[#16233F] text-white text-xs rounded-full px-2 py-0.5">
                                                {unpaidFilterCount}
                                            </span>
                                        )}
                                    </Button>

                                    <MonthPicker
                                        value={unpaidMonth}
                                        onChange={setUnpaidMonth}
                                        max={currentMonth}
                                    />

                                    <div className="relative flex-1 min-w-[240px] max-w-md">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                                        <Input
                                            placeholder="Search ticket #, violator, plate..."
                                            value={unpaidSearch}
                                            onChange={(e) => {
                                                setUnpaidSearch(e.target.value);
                                                setUnpaidPage(1);
                                            }}
                                            className="pl-10 pr-10 rounded-full focus-visible:ring-[#F0B429]"
                                        />
                                        {unpaidSearch && (
                                            <button
                                                onClick={() => setUnpaidSearch('')}
                                                title="Clear"
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1F2937]"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    <ViewToggle view={unpaidView} setView={setUnpaidView} />
                                </div>

                                {unpaidChips.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {unpaidChips.map(([label, clear]) => (
                                            <Chip key={label} label={label} onClear={clear} />
                                        ))}
                                    </div>
                                )}

                                <h2 className="font-['Oswald'] font-medium text-lg text-[#16233F] flex items-center gap-2 border-b-2 border-dashed border-[#CBD5E1] pb-2">
                                    <Wallet className="w-5 h-5 text-[#F0B429]" />
                                    Unpaid Tickets (Not Overdue)
                                    <span className="text-xs font-normal text-[#64748B] font-['Inter']">
                                        {unpaidMonth
                                            ? `(${formatMonthLabel(unpaidMonth)})`
                                            : '(alphabetical by violator)'}
                                    </span>
                                </h2>

                                {pendingLoading && !pendingResponse ? (
                                    <div className="flex justify-center py-10">
                                        <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
                                    </div>
                                ) : pendingError ? (
                                    <div className="text-center py-10 text-[#C8202F]">
                                        Error loading unpaid tickets.
                                    </div>
                                ) : unpaidTickets.length === 0 ? (
                                    <div className="text-center py-14">
                                        <CheckCircle className="w-12 h-12 text-[#1E8449] mx-auto mb-3" />
                                        <p className="text-[#64748B]">
                                            {unpaidFilterCount > 0
                                                ? 'No unpaid non-overdue tickets match the current filters.'
                                                : 'No unpaid non-overdue tickets.'}
                                        </p>
                                    </div>
                                ) : unpaidView === 'cards' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {unpaidTickets.map((ticket) => {
                                            const totalFine = getTotalFine(ticket);
                                            const paid = parseFloat(ticket.total_paid) || 0;
                                            const balance = getTicketBalance(ticket);
                                            const statusMeta =
                                                TICKET_STATUS_META[ticket.status] ||
                                                TICKET_STATUS_META.issued;
                                            return (
                                                <article
                                                    key={ticket.ticket_id}
                                                    className="rounded-xl bg-white border border-[#E3E7EE] overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                                                >
                                                    <div
                                                        className="h-2"
                                                        style={{ background: statusMeta.color }}
                                                    />
                                                    <div className="p-4">
                                                        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                                                            <span className="font-mono text-sm font-semibold text-[#16233F]">
                                                                {ticket.ticket_number}
                                                            </span>
                                                            {ticketStatusBadge(ticket.status)}
                                                        </div>
                                                        <p className="font-['Oswald'] text-lg leading-tight text-[#1F2937]">
                                                            {ticket.violator?.firstname}{' '}
                                                            {ticket.violator?.lastname}
                                                        </p>
                                                        <p className="text-xs text-[#64748B] font-mono">
                                                            {ticket.violator?.license}
                                                        </p>
                                                        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3">
                                                            <Spec label="Plate" mono>
                                                                {ticket.vehicle?.platenumber || '—'}
                                                            </Spec>
                                                            <Spec label="Total fine" danger>
                                                                {formatPeso(totalFine)}
                                                            </Spec>
                                                            <Spec label="Paid" mono>
                                                                {paid > 0 ? formatPeso(paid) : '—'}
                                                            </Spec>
                                                            <Spec label="Balance" danger>
                                                                {formatPeso(balance)}
                                                            </Spec>
                                                        </dl>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-hidden">
                                        <div
                                            className={`hidden ${PENDING_ROW} bg-[#16233F] text-white text-xs font-semibold`}
                                        >
                                            {[
                                                'Ticket #',
                                                'Violator',
                                                'Plate',
                                                'Violations',
                                                'Total Fine',
                                                'Balance',
                                                'Due',
                                                'Time Left',
                                                'Status',
                                            ].map((c) => (
                                                <span key={c}>{c}</span>
                                            ))}
                                        </div>
                                        <ul className="divide-y divide-[#EEF0F4]">
                                            {unpaidTickets.map((ticket) => {
                                                const totalFine = getTotalFine(ticket);
                                                const balance = getTicketBalance(ticket);
                                                const statusMeta =
                                                    TICKET_STATUS_META[ticket.status] ||
                                                    TICKET_STATUS_META.issued;
                                                return (
                                                    <li
                                                        key={ticket.ticket_id}
                                                        className={`${PENDING_ROW} hover:bg-[#F8F9FB] transition-colors border-l-4 min-w-0`}
                                                        style={{
                                                            borderLeftColor: (
                                                                DUE_META[getDueState(ticket).state] ||
                                                                statusMeta
                                                            ).color,
                                                        }}
                                                    >
                                                        <span className="font-mono text-sm font-medium text-[#16233F] min-w-0 truncate">
                                                            <Mini>Ticket</Mini>
                                                            {ticket.ticket_number}
                                                        </span>

                                                        <div className="min-w-0">
                                                            <div className="text-sm text-[#1F2937] truncate">
                                                                {ticket.violator?.firstname}{' '}
                                                                {ticket.violator?.lastname}
                                                            </div>
                                                            <div className="text-xs text-[#64748B] font-mono truncate">
                                                                {ticket.violator?.license}
                                                            </div>
                                                        </div>

                                                        <span className="font-mono text-sm text-[#1F2937] min-w-0 truncate">
                                                            <Mini>Plate</Mini>
                                                            {ticket.vehicle?.platenumber || '—'}
                                                        </span>

                                                        <div className="space-y-0.5 min-w-0">
                                                            {ticket.violations?.slice(0, 2).map((v, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="text-xs text-[#1F2937] truncate"
                                                                >
                                                                    {v.violation_type?.violation_name ||
                                                                        v.violation_name}
                                                                </div>
                                                            ))}
                                                            {ticket.violations?.length > 2 && (
                                                                <div className="text-xs text-[#94A3B8]">
                                                                    +{ticket.violations.length - 2} more
                                                                </div>
                                                            )}
                                                        </div>

                                                        <span className="font-bold text-[#C8202F] tabular-nums whitespace-nowrap">
                                                            <Mini>Fine</Mini>
                                                            {formatPeso(totalFine)}
                                                        </span>

                                                        <span className="font-bold text-[#C2541F] tabular-nums whitespace-nowrap">
                                                            <Mini>Balance</Mini>
                                                            {formatPeso(balance)}
                                                        </span>

                                                        <DueBadge ticket={ticket} />

                                                        <TimeLeftClamped ticket={ticket} />

                                                        <span className="justify-self-start">
                                                            {ticketStatusBadge(ticket.status)}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}

                                {!pendingLoading && unpaidTickets.length > 0 && (
                                    <Pagination
                                        currentPage={pendingMeta.current_page}
                                        totalPages={pendingMeta.last_page}
                                        onPageChange={setUnpaidPage}
                                        totalItems={pendingMeta.total}
                                        itemsPerPage={ITEMS_PER_PAGE}
                                    />
                                )}
                            </>
                        ) : (
                            <>
                                {historyShowFilters && historyPanel}

                                <div className="flex flex-wrap items-center gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => setHistoryShowFilters((v) => !v)}
                                        className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
                                    >
                                        <Filter className="w-4 h-4 mr-2" />
                                        Filters
                                        {historyFilterCount > 0 && (
                                            <span className="ml-2 bg-[#16233F] text-white text-xs rounded-full px-2 py-0.5">
                                                {historyFilterCount}
                                            </span>
                                        )}
                                    </Button>

                                    <MonthPicker
                                        value={historyMonth}
                                        onChange={setHistoryMonth}
                                        max={currentMonth}
                                    />

                                    <div className="relative flex-1 min-w-[240px] max-w-md">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                                        <Input
                                            placeholder="Search by ticket number..."
                                            value={historySearch}
                                            onChange={(e) => {
                                                setHistorySearch(e.target.value);
                                                setHistoryPage(1);
                                            }}
                                            className="pl-10 pr-10 rounded-full focus-visible:ring-[#F0B429]"
                                        />
                                        {historySearch && (
                                            <button
                                                onClick={() => setHistorySearch('')}
                                                title="Clear"
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1F2937]"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    <ViewToggle view={historyView} setView={setHistoryView} />
                                </div>

                                {historyChips.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {historyChips.map(([label, clear]) => (
                                            <Chip key={label} label={label} onClear={clear} />
                                        ))}
                                    </div>
                                )}

                                <h2 className="font-['Oswald'] font-medium text-lg text-[#16233F] flex items-center gap-2 border-b-2 border-dashed border-[#CBD5E1] pb-2">
                                    <Receipt className="w-5 h-5 text-[#F0B429]" />
                                    Payment History
                                    {historyMonth && (
                                        <span className="text-xs font-normal text-[#64748B] font-['Inter']">
                                            ({formatMonthLabel(historyMonth)})
                                        </span>
                                    )}
                                </h2>

                                {historyLoading && !historyResponse ? (
                                    <div className="flex justify-center py-10">
                                        <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
                                    </div>
                                ) : historyError ? (
                                    <div className="text-center py-10 text-[#C8202F]">
                                        Error loading payment history.
                                    </div>
                                ) : payments.length === 0 ? (
                                    <div className="text-center py-14">
                                        <Receipt className="w-12 h-12 text-[#CBD5E1] mx-auto mb-3" />
                                        <p className="text-[#64748B]">
                                            {historyFilterCount > 0
                                                ? 'No payments match the current filters.'
                                                : 'No payments recorded yet.'}
                                        </p>
                                    </div>
                                ) : historyView === 'cards' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {payments.map((p) => {
                                            const statusMeta =
                                                STATUS_META[p.payment_status] ||
                                                STATUS_META.pending;
                                            return (
                                                <article
                                                    key={p.payment_id}
                                                    className="rounded-xl bg-white border border-[#E3E7EE] overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                                                >
                                                    <div
                                                        className="h-2"
                                                        style={{ background: statusMeta.color }}
                                                    />
                                                    <div className="p-4">
                                                        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                                                            <span className="font-mono text-sm font-semibold text-[#16233F]">
                                                                {p.receipt_number || '—'}
                                                            </span>
                                                            {paymentStatusBadge(p.payment_status)}
                                                        </div>
                                                        <p className="text-xs font-mono text-[#64748B] mb-3">
                                                            Ref: {p.payment_reference}
                                                        </p>
                                                        <p className="font-['Oswald'] text-lg leading-tight text-[#1F2937]">
                                                            {p.ticket?.violator
                                                                ? `${p.ticket.violator.firstname} ${p.ticket.violator.lastname}`
                                                                : '—'}
                                                        </p>
                                                        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3">
                                                            <Spec label="Ticket" mono>
                                                                {p.ticket?.ticket_number || '—'}
                                                            </Spec>
                                                            <Spec label="Amount" danger>
                                                                {formatPeso(p.amount_paid)}
                                                            </Spec>
                                                            <Spec label="Method">
                                                                {p.payment_method?.replace('_', ' ') || '—'}
                                                            </Spec>
                                                            <Spec label="Date">
                                                                {formatDate(p.payment_date)}
                                                            </Spec>
                                                        </dl>
                                                        {p.ticket?.ticket_id && (
                                                            <div className="mt-4 pt-4 border-t border-dashed border-[#CBD5E1]">
                                                                <ActionButton
                                                                    icon={Eye}
                                                                    variant="info"
                                                                    onClick={() =>
                                                                        openTicketHistory(p.ticket.ticket_id)
                                                                    }
                                                                >
                                                                    View
                                                                </ActionButton>
                                                            </div>
                                                        )}
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-hidden">
                                        <div
                                            className={`hidden ${HISTORY_ROW} bg-[#16233F] text-white text-xs font-semibold`}
                                        >
                                            {[
                                                'Reference',
                                                'Receipt #',
                                                'Ticket #',
                                                'Violator',
                                                'Amount',
                                                'Method',
                                                'Date',
                                                'Status',
                                                'Action',
                                            ].map((c) => (
                                                <span key={c}>{c}</span>
                                            ))}
                                        </div>
                                        <ul className="divide-y divide-[#EEF0F4]">
                                            {payments.map((p) => {
                                                const statusMeta =
                                                    STATUS_META[p.payment_status] ||
                                                    STATUS_META.pending;
                                                return (
                                                    <li
                                                        key={p.payment_id}
                                                        className={`${HISTORY_ROW} hover:bg-[#F8F9FB] transition-colors border-l-4 min-w-0`}
                                                        style={{ borderLeftColor: statusMeta.color }}
                                                    >
                                                        <span className="font-mono text-xs text-[#64748B] min-w-0 truncate">
                                                            <Mini>Ref</Mini>
                                                            {p.payment_reference}
                                                        </span>

                                                        <span className="font-mono text-sm font-medium text-[#16233F] min-w-0 truncate">
                                                            <Mini>Receipt</Mini>
                                                            {p.receipt_number || '—'}
                                                        </span>

                                                        <span className="font-mono text-sm text-[#1F2937] min-w-0 truncate">
                                                            <Mini>Ticket</Mini>
                                                            {p.ticket?.ticket_number || '—'}
                                                        </span>

                                                        <span className="text-sm text-[#1F2937] min-w-0 truncate">
                                                            <Mini>Violator</Mini>
                                                            {p.ticket?.violator
                                                                ? `${p.ticket.violator.firstname} ${p.ticket.violator.lastname}`
                                                                : '—'}
                                                        </span>

                                                        <span className="font-bold text-[#1E8449] tabular-nums whitespace-nowrap">
                                                            <Mini>Amount</Mini>
                                                            {formatPeso(p.amount_paid)}
                                                        </span>

                                                        <span className="text-sm text-[#1F2937] capitalize whitespace-nowrap">
                                                            <Mini>Method</Mini>
                                                            {p.payment_method?.replace('_', ' ') || '—'}
                                                        </span>

                                                        <span className="text-sm text-[#1F2937] whitespace-nowrap">
                                                            <Mini>Date</Mini>
                                                            {formatDateTime(p.payment_date)}
                                                        </span>

                                                        <span className="justify-self-start">
                                                            {paymentStatusBadge(p.payment_status)}
                                                        </span>

                                                        <div className="justify-self-end md:justify-self-start">
                                                            {p.ticket?.ticket_id && (
                                                                <ActionButton
                                                                    icon={Eye}
                                                                    variant="info"
                                                                    onClick={() =>
                                                                        openTicketHistory(p.ticket.ticket_id)
                                                                    }
                                                                >
                                                                    View
                                                                </ActionButton>
                                                            )}
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}

                                {!historyLoading && payments.length > 0 && (
                                    <Pagination
                                        currentPage={historyMeta.current_page}
                                        totalPages={historyMeta.last_page}
                                        onPageChange={setHistoryPage}
                                        totalItems={historyMeta.total}
                                        itemsPerPage={ITEMS_PER_PAGE}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </TabsContent>

                {/* ==================== OVERDUE TAB ==================== */}
                <TabsContent value="overdue" className="mt-0">
                    {tab === 'overdue' && <MissedDeadlineTab />}
                </TabsContent>
            </Tabs>

            {/* Plate-search payment modal */}
            <PlateSearchPaymentModal
                open={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onSuccess={() => {
                    refetchPending();
                    if (isPaymentHistoryFiltered) refetchHistory();
                }}
            />

            {/* Ticket payment history dialog */}
            <Dialog
                open={isHistoryDialogOpen}
                onOpenChange={(open) => {
                    setIsHistoryDialogOpen(open);
                    if (!open) setHistoryTicketId(null);
                }}
            >
                <DialogContent className="w-[70vw] max-w-[1100px] max-h-[90vh] overflow-hidden p-0 gap-0">
                    <DialogHeader className="px-7 pt-6 pb-5 border-b border-dashed border-[#CBD5E1] bg-white">
                        <DialogTitle className="font-['Oswald'] text-2xl text-[#16233F] flex items-center gap-3">
                            <span className="w-10 h-10 rounded-lg bg-[#E9ECF2] flex items-center justify-center flex-shrink-0">
                                <History className="w-5 h-5 text-[#16233F]" />
                            </span>
                            <div>
                                <div className="leading-tight">Payment History</div>
                                <div className="text-xs font-normal text-[#64748B] font-['Inter'] mt-0.5">
                                    {ticketHistory
                                        ? `Ticket ${ticketHistory.ticket_number} · ${ticketHistory.violator?.firstname || ''
                                        } ${ticketHistory.violator?.lastname || ''}`.trim()
                                        : 'Loading payment records…'}
                                </div>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    {ticketHistoryLoading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-[#16233F]" />
                            <p className="text-sm text-[#64748B]">Loading payment records…</p>
                        </div>
                    ) : !ticketHistory ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <AlertCircle className="w-10 h-10 text-[#94A3B8]" />
                            <p className="text-sm text-[#64748B]">
                                No data available for this ticket.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col max-h-[calc(90vh-100px)]">
                            <div className="flex-1 overflow-y-auto">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                                    <div className="lg:col-span-2 p-7 space-y-7 border-r border-dashed border-[#CBD5E1]">
                                        <section>
                                            <div className="flex items-center gap-2 mb-4">
                                                <TicketIcon className="w-4 h-4 text-[#F0B429]" />
                                                <h3 className="font-['Oswald'] text-lg text-[#16233F]">
                                                    Ticket
                                                </h3>
                                                <span className="h-px flex-1 bg-[#E3E7EE]" />
                                                {ticketStatusBadge(ticketHistory.status)}
                                            </div>

                                            <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-hidden">
                                                <div
                                                    className="h-1.5"
                                                    style={{
                                                        background:
                                                            TICKET_STATUS_META[ticketHistory.status]?.color ||
                                                            '#16233F',
                                                    }}
                                                />
                                                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div className="md:col-span-2 min-w-0">
                                                        <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">
                                                            Ticket Number
                                                        </p>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-base font-semibold text-[#16233F] truncate">
                                                                {ticketHistory.ticket_number}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handleCopy(
                                                                        'ticket',
                                                                        ticketHistory.ticket_number,
                                                                    )
                                                                }
                                                                className="p-1 rounded text-[#94A3B8] hover:text-[#16233F] hover:bg-[#F1F5F9]"
                                                                title="Copy ticket number"
                                                            >
                                                                {copiedField === 'ticket' ? (
                                                                    <Check className="w-3.5 h-3.5 text-[#1E8449]" />
                                                                ) : (
                                                                    <Copy className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">
                                                            Plate
                                                        </p>
                                                        <p className="font-mono text-sm font-semibold text-[#16233F] truncate">
                                                            {ticketHistory.vehicle?.platenumber || '—'}
                                                        </p>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">
                                                            Violation Date
                                                        </p>
                                                        <p className="text-sm text-[#1F2937] truncate">
                                                            {ticketHistory.violation_datetime
                                                                ? new Date(
                                                                    ticketHistory.violation_datetime,
                                                                ).toLocaleDateString()
                                                                : '—'}
                                                        </p>
                                                    </div>
                                                    <div className="md:col-span-2 min-w-0">
                                                        <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">
                                                            Violator
                                                        </p>
                                                        <p className="text-sm text-[#1F2937] truncate">
                                                            {ticketHistory.violator?.firstname}{' '}
                                                            {ticketHistory.violator?.lastname}
                                                        </p>
                                                    </div>
                                                    <div className="md:col-span-2 min-w-0">
                                                        <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">
                                                            License
                                                        </p>
                                                        <p className="font-mono text-sm text-[#1F2937] truncate">
                                                            {ticketHistory.violator?.license || '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </section>

                                        <section>
                                            <div className="flex items-center gap-2 mb-4">
                                                <Receipt className="w-4 h-4 text-[#F0B429]" />
                                                <h3 className="font-['Oswald'] text-lg text-[#16233F]">
                                                    Payments
                                                </h3>
                                                <span className="h-px flex-1 bg-[#E3E7EE]" />
                                                <span className="text-xs text-[#64748B] tabular-nums">
                                                    {ticketPayments.length}{' '}
                                                    {ticketPayments.length === 1 ? 'record' : 'records'}
                                                </span>
                                            </div>

                                            {ticketPayments.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8F9FA]">
                                                    <Receipt className="w-10 h-10 text-[#CBD5E1] mb-3" />
                                                    <p className="text-sm text-[#64748B]">
                                                        No payments recorded for this ticket yet.
                                                    </p>
                                                </div>
                                            ) : (
                                                <ol className="relative ml-2 border-l-2 border-dashed border-[#CBD5E1] space-y-4">
                                                    {ticketPayments.map((p) => {
                                                        const meta =
                                                            STATUS_META[p.payment_status] ||
                                                            STATUS_META.pending;
                                                        return (
                                                            <li
                                                                key={p.payment_id}
                                                                className="relative pl-6 group"
                                                            >
                                                                <span
                                                                    className="absolute -left-[9px] top-4 w-4 h-4 rounded-full border-[3px] border-white ring-2 transition-transform group-hover:scale-125"
                                                                    style={{
                                                                        background: meta.color,
                                                                        '--tw-ring-color': meta.color,
                                                                    }}
                                                                />
                                                                <div className="rounded-lg border border-[#E3E7EE] bg-white p-4 hover:shadow-md transition-shadow">
                                                                    <div className="flex items-start justify-between gap-3 mb-3">
                                                                        <div className="min-w-0">
                                                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                                <span className="font-mono text-sm font-semibold text-[#16233F]">
                                                                                    {p.receipt_number || '—'}
                                                                                </span>
                                                                                {paymentStatusBadge(
                                                                                    p.payment_status,
                                                                                )}
                                                                            </div>
                                                                            <p className="text-[11px] text-[#64748B] font-mono truncate">
                                                                                Ref: {p.payment_reference}
                                                                            </p>
                                                                        </div>
                                                                        <p className="text-xl font-['Oswald'] font-semibold text-[#1E8449] tabular-nums shrink-0">
                                                                            {formatPeso(p.amount_paid)}
                                                                        </p>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-dashed border-[#CBD5E1]">
                                                                        <PreviewRow
                                                                            icon={Banknote}
                                                                            label="Method"
                                                                            value={
                                                                                p.payment_method?.replace('_', ' ') ||
                                                                                '—'
                                                                            }
                                                                        />
                                                                        <PreviewRow
                                                                            icon={Calendar}
                                                                            label="Date"
                                                                            value={formatDateTime(p.payment_date)}
                                                                        />
                                                                        {p.paid_by && (
                                                                            <PreviewRow
                                                                                icon={UserIcon}
                                                                                label="Paid By"
                                                                                value={p.paid_by}
                                                                            />
                                                                        )}
                                                                    </div>
                                                                    {p.notes && (
                                                                        <div className="mt-3 pt-3 border-t border-dashed border-[#CBD5E1]">
                                                                            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">
                                                                                Notes
                                                                            </p>
                                                                            <p className="text-xs text-[#64748B] line-clamp-2">
                                                                                {p.notes}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </li>
                                                        );
                                                    })}
                                                </ol>
                                            )}
                                        </section>
                                    </div>

                                    <div className="p-7 space-y-6 bg-[#F8F9FA]">
                                        <section>
                                            <div className="flex items-center gap-2 mb-3">
                                                <PhilippinePeso className="w-4 h-4 text-[#1E8449]" />
                                                <h3 className="font-['Oswald'] text-lg text-[#16233F]">
                                                    Breakdown
                                                </h3>
                                            </div>
                                            <div className="rounded-xl bg-white border border-[#E3E7EE] p-4 space-y-3">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-[#64748B]">Total Fine</span>
                                                    <span className="font-semibold text-[#C8202F] tabular-nums">
                                                        {formatPeso(ticketHistorySummary?.total_fine)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-[#64748B]">Total Paid</span>
                                                    <span className="font-semibold text-[#1E8449] tabular-nums">
                                                        − {formatPeso(ticketHistorySummary?.total_paid)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between pt-3 border-t border-dashed border-[#CBD5E1]">
                                                    <span className="text-[#64748B] font-medium">
                                                        Balance
                                                    </span>
                                                    <span
                                                        className={`font-bold tabular-nums ${parseFloat(ticketHistorySummary?.balance) > 0
                                                            ? 'text-[#C2541F]'
                                                            : 'text-[#1E8449]'
                                                            }`}
                                                    >
                                                        {formatPeso(ticketHistorySummary?.balance)}
                                                    </span>
                                                </div>
                                            </div>
                                        </section>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-3 px-7 py-4 border-t border-dashed border-[#CBD5E1] bg-white">
                                <div className="text-xs text-[#64748B] flex items-center gap-2">
                                    <Info className="w-3.5 h-3.5 text-[#94A3B8]" />
                                    <span>
                                        Showing{' '}
                                        <strong className="text-[#16233F] tabular-nums">
                                            {ticketPayments.length}
                                        </strong>{' '}
                                        {ticketPayments.length === 1 ? 'payment' : 'payments'} for{' '}
                                        <strong className="text-[#16233F] font-mono">
                                            {ticketHistory?.ticket_number}
                                        </strong>
                                        .
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            handleCopy(
                                                'summary',
                                                `Ticket: ${ticketHistory?.ticket_number}\nViolator: ${ticketHistory?.violator?.firstname} ${ticketHistory?.violator?.lastname}\nTotal Fine: ${formatPeso(ticketHistorySummary?.total_fine)}\nTotal Paid: ${formatPeso(ticketHistorySummary?.total_paid)}\nBalance: ${formatPeso(ticketHistorySummary?.balance)}`,
                                            )
                                        }
                                        className="min-w-[100px]"
                                    >
                                        {copiedField === 'summary' ? (
                                            <>
                                                <Check className="w-4 h-4 mr-2 text-[#1E8449]" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copy Summary
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => setIsHistoryDialogOpen(false)}
                                        className="bg-[#16233F] hover:bg-[#0F1A2E] min-w-[120px]"
                                    >
                                        Close
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Payments;