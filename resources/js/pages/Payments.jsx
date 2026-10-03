// web/src/pages/Payments.jsx
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
} from '../services/api';
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
    FileText,  
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
    partial_paid: {
        label: 'Partial Paid',
        color: '#3B5170',
        chip: 'bg-[#EEF1F5] text-[#3B5170]',
    },
    paid: {
        label: 'Paid',
        color: '#1E8449',
        chip: 'bg-[#E5F2EA] text-[#1E8449]',
    },
    contested: {
        label: 'Contested',
        color: '#C2541F',
        chip: 'bg-[#FBEAE2] text-[#C2541F]',
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

const daysAgoISO = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toISODate(d);
};

/* Shared grids */
const PENDING_ROW =
    'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ' +
    'md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_minmax(0,.9fr)_minmax(0,1.4fr)_minmax(0,.9fr)_minmax(0,.9fr)_minmax(0,.9fr)_minmax(0,.9fr)_minmax(0,14rem)] md:gap-4';

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
    <aside className="self-start rounded-xl bg-[#FBF1DC] border-t-4 border-[#F0B429] p-5 space-y-5 lg:sticky lg:top-4">
        <div className="flex justify-between items-center">
            <h3 className="text-base font-['Oswald'] font-medium text-[#16233F]">
                {title}
            </h3>
            <button
                onClick={onClose}
                className="p-1 rounded hover:bg-[#F0B429]/25"
            >
                <X className="w-4 h-4 text-[#92600A]" />
            </button>
        </div>
        {children}
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
    </aside>
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

const Payments = () => {
    const queryClient = useQueryClient();
    const notify = useAlert();
    const [tab, setTab] = useState('pending');

    /* ---------- Pending tab ---------- */
    const [pendingView, setPendingView] = useState('list');
    const [pendingPage, setPendingPage] = useState(1);
    const [pendingSearch, setPendingSearch] = useState('');
    const [pendingShowFilters, setPendingShowFilters] = useState(false);
    const [pendingFilters, setPendingFilters] = useState({
        min_balance: '',
        max_balance: '',
        only_partial: false,
    });

    /* ---------- History tab ---------- */
    const [historyView, setHistoryView] = useState('list');
    const [historyPage, setHistoryPage] = useState(1);
    const [historySearch, setHistorySearch] = useState('');
    const [historyShowFilters, setHistoryShowFilters] = useState(false);
    const [historyFilters, setHistoryFilters] = useState({
        status: [],
        method: '',
        date_from: '',
        date_to: '',
        min_amount: '',
        max_amount: '',
    });

    /* ---------- Dialog state ---------- */
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [formData, setFormData] = useState({
        receipt_number: '',
        amount_paid: '',
        payment_method: 'cash',
        payment_date: new Date().toISOString().slice(0, 16),
        transaction_id: '',
        paid_by: '',
        notes: '',
    });
    const [formError, setFormError] = useState('');

    const [historyTicketId, setHistoryTicketId] = useState(null);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

    /* ---------- Queries ---------- */
    const {
        data: pendingResponse,
        isLoading: pendingLoading,
        refetch: refetchPending,
        error: pendingError,
    } = useQuery({
        queryKey: ['payments-pending', pendingPage, pendingSearch],
        queryFn: () =>
            getPendingPayments(pendingPage, ITEMS_PER_PAGE, {
                search: pendingSearch || undefined,
            }),
        keepPreviousData: true,
        staleTime: 1000 * 30,
    });

    const {
        data: historyResponse,
        isLoading: historyLoading,
        refetch: refetchHistory,
        error: historyError,
    } = useQuery({
        queryKey: ['payments-history', historyPage, historySearch, historyFilters],
        queryFn: () =>
            getPayments(historyPage, ITEMS_PER_PAGE, {
                ticket_number: historySearch || undefined,
                status: historyFilters.status.length
                    ? historyFilters.status.join(',')
                    : undefined,
                date_from: historyFilters.date_from || undefined,
                date_to: historyFilters.date_to || undefined,
            }),
        keepPreviousData: true,
        staleTime: 1000 * 60,
        enabled: tab === 'history',
    });

    const { data: ticketHistoryResponse, isLoading: ticketHistoryLoading } =
        useQuery({
            queryKey: ['payments-by-ticket', historyTicketId],
            queryFn: () => getPaymentsByTicket(historyTicketId),
            enabled: !!historyTicketId && isHistoryDialogOpen,
        });

    /* ---------- Derived ---------- */
    const pendingTickets = useMemo(() => {
        let list = getDataArray(pendingResponse);

        if (pendingFilters.only_partial) {
            list = list.filter((t) => (parseFloat(t.total_paid) || 0) > 0);
        }
        if (pendingFilters.min_balance !== '') {
            list = list.filter(
                (t) =>
                    (parseFloat(t.balance) || 0) >=
                    parseFloat(pendingFilters.min_balance),
            );
        }
        if (pendingFilters.max_balance !== '') {
            list = list.filter(
                (t) =>
                    (parseFloat(t.balance) || 0) <=
                    parseFloat(pendingFilters.max_balance),
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
    }, [pendingResponse, pendingFilters]);

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
    const pendingFilterCount = useMemo(() => {
        let c = 0;
        if (pendingSearch) c++;
        if (pendingFilters.min_balance || pendingFilters.max_balance) c++;
        if (pendingFilters.only_partial) c++;
        return c;
    }, [pendingSearch, pendingFilters]);

    const historyFilterCount = useMemo(() => {
        let c = 0;
        if (historySearch) c++;
        if (historyFilters.status.length) c++;
        if (historyFilters.method) c++;
        if (historyFilters.date_from || historyFilters.date_to) c++;
        if (historyFilters.min_amount || historyFilters.max_amount) c++;
        return c;
    }, [historySearch, historyFilters]);

    /* ---------- Mutations ---------- */
    const createMutation = useMutation({
        mutationFn: createPayment,
        onSuccess: (response) => {
            queryClient.invalidateQueries(['payments-pending']);
            queryClient.invalidateQueries(['payments-history']);
            queryClient.invalidateQueries(['tickets']);

            const data = response?.data || {};
            setIsDialogOpen(false);
            resetForm();

            if (data.ticket_status === 'paid') {
                notify.success(
                    `Payment recorded. Ticket is now fully paid. (Balance: ${formatPeso(
                        data.balance,
                    )})`,
                    { title: 'Payment Recorded' },
                );
            } else {
                notify.success(
                    `Partial payment recorded.\n\nPaid this time: ${formatPeso(
                        data.amount_paid,
                    )}\nTotal paid so far: ${formatPeso(
                        data.total_paid,
                    )}\nRemaining balance: ${formatPeso(data.balance)}`,
                    { title: 'Partial Payment Recorded' },
                );
            }
        },
        onError: (error) => {
            const payload = error.response?.data || {};
            let msg = payload.message || 'Failed to record payment.';
            if (payload.errors) {
                const flat = Object.values(payload.errors).flat().join('\n');
                if (flat) msg = flat;
            }
            setFormError(msg);
            notify.error(msg);
        },
    });

    /* ---------- Handlers ---------- */
    const openPaymentDialog = (ticket) => {
        setSelectedTicket(ticket);

        const totalFine = getTotalFine(ticket);
        const alreadyPaid = parseFloat(ticket.total_paid) || 0;
        const outstanding =
            ticket.balance != null
                ? parseFloat(ticket.balance)
                : Math.max(0, totalFine - alreadyPaid);

        setFormData({
            receipt_number: '',
            amount_paid:
                outstanding > 0
                    ? outstanding.toFixed(2)
                    : totalFine.toFixed(2),
            payment_method: 'cash',
            payment_date: new Date().toISOString().slice(0, 16),
            transaction_id: '',
            paid_by: ticket.violator
                ? `${ticket.violator.firstname} ${ticket.violator.lastname}`
                : '',
            notes: '',
        });
        setFormError('');
        setIsDialogOpen(true);
    };

    const resetForm = () => {
        setSelectedTicket(null);
        setFormData({
            receipt_number: '',
            amount_paid: '',
            payment_method: 'cash',
            payment_date: new Date().toISOString().slice(0, 16),
            transaction_id: '',
            paid_by: '',
            notes: '',
        });
        setFormError('');
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setFormError('');

        if (!selectedTicket) return;

        const payload = {
            ticket_id: selectedTicket.ticket_id,
            receipt_number: formData.receipt_number.trim(),
            amount_paid: parseFloat(formData.amount_paid),
            payment_method: formData.payment_method,
            payment_date: formData.payment_date
                ? new Date(formData.payment_date).toISOString()
                : undefined,
            transaction_id: formData.transaction_id || undefined,
            paid_by: formData.paid_by || undefined,
            notes: formData.notes || undefined,
        };

        if (!payload.receipt_number) {
            setFormError('Receipt number is required.');
            return;
        }
        if (!payload.amount_paid || payload.amount_paid <= 0) {
            setFormError('Amount must be greater than zero.');
            return;
        }

        createMutation.mutate(payload);
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

    const clearPendingFilters = () =>
        setPendingFilters({
            min_balance: '',
            max_balance: '',
            only_partial: false,
        });

    const clearHistoryFilters = () =>
        setHistoryFilters({
            status: [],
            method: '',
            date_from: '',
            date_to: '',
            min_amount: '',
            max_amount: '',
        });

    const totalPendingCount = pendingMeta.total || 0;

    const ticketHistory = ticketHistoryResponse?.data?.ticket;
    const ticketHistorySummary = ticketHistoryResponse?.data?.summary;
    const ticketPayments = ticketHistory?.payments || [];

    /* ---------- Panels ---------- */
    const pendingPanel = (
        <FilterShell
            title="Filter Unpaid Tickets"
            onClose={() => setPendingShowFilters(false)}
            onReset={clearPendingFilters}
        >
            <div>
                <L>Balance range (₱)</L>
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        type="number"
                        placeholder="Min"
                        value={pendingFilters.min_balance}
                        onChange={(e) =>
                            setPendingFilters({
                                ...pendingFilters,
                                min_balance: e.target.value,
                            })
                        }
                        className="w-24 focus-visible:ring-[#F0B429]"
                    />
                    <span className="text-[#64748B] text-sm">to</span>
                    <Input
                        type="number"
                        placeholder="Max"
                        value={pendingFilters.max_balance}
                        onChange={(e) =>
                            setPendingFilters({
                                ...pendingFilters,
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
                        checked={pendingFilters.only_partial}
                        onChange={(e) =>
                            setPendingFilters({
                                ...pendingFilters,
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
                <L>Status</L>
                <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((opt) => {
                        const active = historyFilters.status.includes(
                            opt.value,
                        );
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
                    <span className="text-xs text-[#92600A]/70 mr-1">
                        Quick:
                    </span>
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

    /* ---------- Chips ---------- */
    const pendingChips = [
        pendingSearch && [
            `Search: ${pendingSearch}`,
            () => setPendingSearch(''),
        ],
        (pendingFilters.min_balance || pendingFilters.max_balance) && [
            `Balance: ₱${pendingFilters.min_balance || '0'} → ₱${pendingFilters.max_balance || '∞'
            }`,
            () =>
                setPendingFilters({
                    ...pendingFilters,
                    min_balance: '',
                    max_balance: '',
                }),
        ],
        pendingFilters.only_partial && [
            'Partially paid only',
            () =>
                setPendingFilters({
                    ...pendingFilters,
                    only_partial: false,
                }),
        ],
    ].filter(Boolean);

    const historyChips = [
        historySearch && [
            `Search: ${historySearch}`,
            () => setHistorySearch(''),
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
            `Date: ${historyFilters.date_from || '…'} → ${historyFilters.date_to || '…'
            }`,
            () =>
                setHistoryFilters({
                    ...historyFilters,
                    date_from: '',
                    date_to: '',
                }),
        ],
        (historyFilters.min_amount || historyFilters.max_amount) && [
            `Amount: ₱${historyFilters.min_amount || '0'} → ₱${historyFilters.max_amount || '∞'
            }`,
            () =>
                setHistoryFilters({
                    ...historyFilters,
                    min_amount: '',
                    max_amount: '',
                }),
        ],
    ].filter(Boolean);

    /* ---------- Actions ---------- */
    const pendingRowActions = (ticket) => {
        const isPartial = ticket.status === 'partial_paid';
        return (
            <div className="flex flex-wrap gap-2">
                {isPartial && (
                    <ActionButton
                        icon={History}
                        variant="info"
                        onClick={() => openTicketHistory(ticket.ticket_id)}
                    >
                        History
                    </ActionButton>
                )}
                <ActionButton
                    icon={PhilippinePeso}
                    variant="primary"
                    onClick={() => openPaymentDialog(ticket)}
                >
                    {isPartial ? 'Add Payment' : 'Record Payment'}
                </ActionButton>
            </div>
        );
    };

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
                <Button
                    onClick={() => {
                        refetchPending();
                        if (tab === 'history') refetchHistory();
                    }}
                    variant="outline"
                    className="relative bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
                >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                </Button>
            </header>

            <Tabs value={tab} onValueChange={setTab} className="space-y-6">
                <TabsList className="bg-[#E9ECF2]">
                    <TabsTrigger
                        value="pending"
                        className="data-[state=active]:bg-[#16233F] data-[state=active]:text-white flex items-center gap-2"
                    >
                        <Wallet className="w-4 h-4" />
                        Unpaid Tickets
                        <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                            {totalPendingCount}
                        </span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="history"
                        className="data-[state=active]:bg-[#16233F] data-[state=active]:text-white flex items-center gap-2"
                    >
                        <Receipt className="w-4 h-4" />
                        Payment History
                    </TabsTrigger>
                </TabsList>

                {/* ==================== PENDING TAB ==================== */}
                <TabsContent value="pending" className="mt-0">
                    <div
                        className={`grid gap-6 ${pendingShowFilters
                            ? 'lg:grid-cols-[300px_minmax(0,1fr)]'
                            : ''
                            }`}
                    >
                        {pendingShowFilters && pendingPanel}

                        <div className="space-y-4 min-w-0">
                            {/* Toolbar */}
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        setPendingShowFilters((v) => !v)
                                    }
                                    className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
                                >
                                    <Filter className="w-4 h-4 mr-2" />
                                    Filters
                                    {pendingFilterCount > 0 && (
                                        <span className="ml-2 bg-[#16233F] text-white text-xs rounded-full px-2 py-0.5">
                                            {pendingFilterCount}
                                        </span>
                                    )}
                                </Button>

                                <div className="relative flex-1 min-w-[240px] max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                                    <Input
                                        placeholder="Search ticket #, violator, plate..."
                                        value={pendingSearch}
                                        onChange={(e) => {
                                            setPendingSearch(e.target.value);
                                            setPendingPage(1);
                                        }}
                                        className="pl-10 pr-10 rounded-full focus-visible:ring-[#F0B429]"
                                    />
                                    {pendingSearch && (
                                        <button
                                            onClick={() =>
                                                setPendingSearch('')
                                            }
                                            title="Clear"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1F2937]"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                <ViewToggle
                                    view={pendingView}
                                    setView={setPendingView}
                                />
                            </div>

                            {/* Chips */}
                            {pendingChips.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {pendingChips.map(([label, clear]) => (
                                        <Chip
                                            key={label}
                                            label={label}
                                            onClear={clear}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Section title */}
                            <h2 className="font-['Oswald'] font-medium text-lg text-[#16233F] flex items-center gap-2 border-b-2 border-dashed border-[#CBD5E1] pb-2">
                                <Wallet className="w-5 h-5 text-[#F0B429]" />
                                Tickets Awaiting Payment
                                <span className="text-xs font-normal text-[#64748B] font-['Inter']">
                                    (alphabetical by violator)
                                </span>
                            </h2>

                            {/* Body */}
                            {pendingLoading && !pendingResponse ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
                                </div>
                            ) : pendingError ? (
                                <div className="text-center py-10 text-[#C8202F]">
                                    Error loading pending tickets.
                                </div>
                            ) : pendingTickets.length === 0 ? (
                                <div className="text-center py-14">
                                    <CheckCircle className="w-12 h-12 text-[#1E8449] mx-auto mb-3" />
                                    <p className="text-[#64748B]">
                                        {pendingFilterCount > 0
                                            ? 'No tickets match the current filters.'
                                            : 'No tickets awaiting payment. All settled! 🎉'}
                                    </p>
                                </div>
                            ) : pendingView === 'cards' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {pendingTickets.map((ticket) => {
                                        const totalFine =
                                            getTotalFine(ticket);
                                        const paid =
                                            parseFloat(ticket.total_paid) || 0;
                                        const balance =
                                            ticket.balance != null
                                                ? parseFloat(ticket.balance)
                                                : Math.max(
                                                    0,
                                                    totalFine - paid,
                                                );
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
                                                    style={{
                                                        background:
                                                            statusMeta.color,
                                                    }}
                                                />
                                                <div className="p-4">
                                                    <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                                                        <span className="font-mono text-sm font-semibold text-[#16233F]">
                                                            {
                                                                ticket.ticket_number
                                                            }
                                                        </span>
                                                        {ticketStatusBadge(
                                                            ticket.status,
                                                        )}
                                                    </div>
                                                    <p className="font-['Oswald'] text-lg leading-tight text-[#1F2937]">
                                                        {ticket.violator
                                                            ?.firstname}{' '}
                                                        {ticket.violator
                                                            ?.lastname}
                                                    </p>
                                                    <p className="text-xs text-[#64748B] font-mono">
                                                        {
                                                            ticket.violator
                                                                ?.license
                                                        }
                                                    </p>
                                                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3">
                                                        <Spec label="Plate" mono>
                                                            {ticket.vehicle
                                                                ?.platenumber ||
                                                                '—'}
                                                        </Spec>
                                                        <Spec
                                                            label="Total fine"
                                                            danger
                                                        >
                                                            {formatPeso(
                                                                totalFine,
                                                            )}
                                                        </Spec>
                                                        <Spec
                                                            label="Paid"
                                                            mono
                                                        >
                                                            {paid > 0
                                                                ? formatPeso(
                                                                    paid,
                                                                )
                                                                : '—'}
                                                        </Spec>
                                                        <Spec
                                                            label="Balance"
                                                            danger
                                                        >
                                                            {formatPeso(
                                                                balance,
                                                            )}
                                                        </Spec>
                                                    </dl>
                                                    <div className="mt-3 text-xs text-[#64748B] line-clamp-2">
                                                        {ticket.violations
                                                            ?.slice(0, 2)
                                                            .map(
                                                                (v) =>
                                                                    v
                                                                        .violation_type
                                                                        ?.violation_name ||
                                                                    v.violation_name,
                                                            )
                                                            .filter(Boolean)
                                                            .join(' · ')}
                                                        {ticket.violations
                                                            ?.length > 2 &&
                                                            ` +${ticket
                                                                .violations
                                                                .length - 2
                                                            } more`}
                                                    </div>
                                                    <div className="mt-4 pt-4 border-t border-dashed border-[#CBD5E1] flex flex-wrap justify-end">
                                                        {pendingRowActions(
                                                            ticket,
                                                        )}
                                                    </div>
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
                                            'Paid',
                                            'Balance',
                                            'Status',
                                            'Action',
                                        ].map((c) => (
                                            <span key={c}>{c}</span>
                                        ))}
                                    </div>
                                    <ul className="divide-y divide-[#EEF0F4]">
                                        {pendingTickets.map((ticket) => {
                                            const totalFine =
                                                getTotalFine(ticket);
                                            const paid =
                                                parseFloat(
                                                    ticket.total_paid,
                                                ) || 0;
                                            const balance =
                                                ticket.balance != null
                                                    ? parseFloat(
                                                        ticket.balance,
                                                    )
                                                    : Math.max(
                                                        0,
                                                        totalFine - paid,
                                                    );
                                            const statusMeta =
                                                TICKET_STATUS_META[
                                                ticket.status
                                                ] ||
                                                TICKET_STATUS_META.issued;
                                            return (
                                                <li
                                                    key={ticket.ticket_id}
                                                    className={`${PENDING_ROW} hover:bg-[#F8F9FB] transition-colors border-l-4 min-w-0`}
                                                    style={{
                                                        borderLeftColor:
                                                            statusMeta.color,
                                                    }}
                                                >
                                                    <span className="font-mono text-sm font-medium text-[#16233F] min-w-0 truncate">
                                                        <Mini>Ticket</Mini>
                                                        {
                                                            ticket.ticket_number
                                                        }
                                                    </span>

                                                    <div className="min-w-0">
                                                        <div className="text-sm text-[#1F2937] truncate">
                                                            {
                                                                ticket.violator
                                                                    ?.firstname
                                                            }{' '}
                                                            {
                                                                ticket.violator
                                                                    ?.lastname
                                                            }
                                                        </div>
                                                        <div className="text-xs text-[#64748B] font-mono truncate">
                                                            {
                                                                ticket.violator
                                                                    ?.license
                                                            }
                                                        </div>
                                                    </div>

                                                    <span className="font-mono text-sm text-[#1F2937] min-w-0 truncate">
                                                        <Mini>Plate</Mini>
                                                        {ticket.vehicle
                                                            ?.platenumber ||
                                                            '—'}
                                                    </span>

                                                    <div className="space-y-0.5 min-w-0">
                                                        {ticket.violations
                                                            ?.slice(0, 2)
                                                            .map((v, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="text-xs text-[#1F2937] truncate"
                                                                >
                                                                    {v
                                                                        .violation_type
                                                                        ?.violation_name ||
                                                                        v.violation_name}
                                                                </div>
                                                            ))}
                                                        {ticket.violations
                                                            ?.length > 2 && (
                                                                <div className="text-xs text-[#94A3B8]">
                                                                    +
                                                                    {ticket
                                                                        .violations
                                                                        .length -
                                                                        2}{' '}
                                                                    more
                                                                </div>
                                                            )}
                                                    </div>

                                                    <span className="font-bold text-[#C8202F] tabular-nums whitespace-nowrap">
                                                        <Mini>Fine</Mini>
                                                        {formatPeso(totalFine)}
                                                    </span>

                                                    <span className="font-semibold text-[#1E8449] tabular-nums whitespace-nowrap">
                                                        <Mini>Paid</Mini>
                                                        {paid > 0
                                                            ? formatPeso(paid)
                                                            : '—'}
                                                    </span>

                                                    <span className="font-bold text-[#C2541F] tabular-nums whitespace-nowrap">
                                                        <Mini>Balance</Mini>
                                                        {formatPeso(balance)}
                                                    </span>

                                                    <span className="justify-self-start">
                                                        {ticketStatusBadge(
                                                            ticket.status,
                                                        )}
                                                    </span>

                                                    <div className="justify-self-end md:justify-self-start">
                                                        {pendingRowActions(
                                                            ticket,
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}

                            {!pendingLoading && pendingTickets.length > 0 && (
                                <Pagination
                                    currentPage={pendingMeta.current_page}
                                    totalPages={pendingMeta.last_page}
                                    onPageChange={setPendingPage}
                                    totalItems={pendingMeta.total}
                                    itemsPerPage={ITEMS_PER_PAGE}
                                />
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* ==================== HISTORY TAB ==================== */}
                <TabsContent value="history" className="mt-0">
                    <div
                        className={`grid gap-6 ${historyShowFilters
                            ? 'lg:grid-cols-[300px_minmax(0,1fr)]'
                            : ''
                            }`}
                    >
                        {historyShowFilters && historyPanel}

                        <div className="space-y-4 min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        setHistoryShowFilters((v) => !v)
                                    }
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
                                            onClick={() =>
                                                setHistorySearch('')
                                            }
                                            title="Clear"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1F2937]"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                <ViewToggle
                                    view={historyView}
                                    setView={setHistoryView}
                                />
                            </div>

                            {historyChips.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {historyChips.map(([label, clear]) => (
                                        <Chip
                                            key={label}
                                            label={label}
                                            onClear={clear}
                                        />
                                    ))}
                                </div>
                            )}

                            <h2 className="font-['Oswald'] font-medium text-lg text-[#16233F] flex items-center gap-2 border-b-2 border-dashed border-[#CBD5E1] pb-2">
                                <Receipt className="w-5 h-5 text-[#F0B429]" />
                                Recorded Payments
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
                                                    style={{
                                                        background:
                                                            statusMeta.color,
                                                    }}
                                                />
                                                <div className="p-4">
                                                    <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                                                        <span className="font-mono text-sm font-semibold text-[#16233F]">
                                                            {p.receipt_number ||
                                                                '—'}
                                                        </span>
                                                        {paymentStatusBadge(
                                                            p.payment_status,
                                                        )}
                                                    </div>
                                                    <p className="text-xs font-mono text-[#64748B] mb-3">
                                                        Ref:{' '}
                                                        {p.payment_reference}
                                                    </p>
                                                    <p className="font-['Oswald'] text-lg leading-tight text-[#1F2937]">
                                                        {p.ticket?.violator
                                                            ? `${p.ticket.violator.firstname} ${p.ticket.violator.lastname}`
                                                            : '—'}
                                                    </p>
                                                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3">
                                                        <Spec
                                                            label="Ticket"
                                                            mono
                                                        >
                                                            {p.ticket
                                                                ?.ticket_number ||
                                                                '—'}
                                                        </Spec>
                                                        <Spec
                                                            label="Amount"
                                                            danger
                                                        >
                                                            {formatPeso(
                                                                p.amount_paid,
                                                            )}
                                                        </Spec>
                                                        <Spec label="Method">
                                                            {p.payment_method?.replace(
                                                                '_',
                                                                ' ',
                                                            ) || '—'}
                                                        </Spec>
                                                        <Spec label="Date">
                                                            {formatDate(
                                                                p.payment_date,
                                                            )}
                                                        </Spec>
                                                    </dl>
                                                    {p.ticket?.ticket_id && (
                                                        <div className="mt-4 pt-4 border-t border-dashed border-[#CBD5E1]">
                                                            <ActionButton
                                                                icon={Eye}
                                                                variant="info"
                                                                onClick={() =>
                                                                    openTicketHistory(
                                                                        p.ticket
                                                                            .ticket_id,
                                                                    )
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
                                                STATUS_META[
                                                p.payment_status
                                                ] || STATUS_META.pending;
                                            return (
                                                <li
                                                    key={p.payment_id}
                                                    className={`${HISTORY_ROW} hover:bg-[#F8F9FB] transition-colors border-l-4 min-w-0`}
                                                    style={{
                                                        borderLeftColor:
                                                            statusMeta.color,
                                                    }}
                                                >
                                                    <span className="font-mono text-xs text-[#64748B] min-w-0 truncate">
                                                        <Mini>Ref</Mini>
                                                        {p.payment_reference}
                                                    </span>

                                                    <span className="font-mono text-sm font-medium text-[#16233F] min-w-0 truncate">
                                                        <Mini>Receipt</Mini>
                                                        {p.receipt_number ||
                                                            '—'}
                                                    </span>

                                                    <span className="font-mono text-sm text-[#1F2937] min-w-0 truncate">
                                                        <Mini>Ticket</Mini>
                                                        {p.ticket
                                                            ?.ticket_number ||
                                                            '—'}
                                                    </span>

                                                    <span className="text-sm text-[#1F2937] min-w-0 truncate">
                                                        <Mini>Violator</Mini>
                                                        {p.ticket?.violator
                                                            ? `${p.ticket.violator.firstname} ${p.ticket.violator.lastname}`
                                                            : '—'}
                                                    </span>

                                                    <span className="font-bold text-[#1E8449] tabular-nums whitespace-nowrap">
                                                        <Mini>Amount</Mini>
                                                        {formatPeso(
                                                            p.amount_paid,
                                                        )}
                                                    </span>

                                                    <span className="text-sm text-[#1F2937] capitalize whitespace-nowrap">
                                                        <Mini>Method</Mini>
                                                        {p.payment_method?.replace(
                                                            '_',
                                                            ' ',
                                                        ) || '—'}
                                                    </span>

                                                    <span className="text-sm text-[#1F2937] whitespace-nowrap">
                                                        <Mini>Date</Mini>
                                                        {formatDateTime(
                                                            p.payment_date,
                                                        )}
                                                    </span>

                                                    <span className="justify-self-start">
                                                        {paymentStatusBadge(
                                                            p.payment_status,
                                                        )}
                                                    </span>

                                                    <div className="justify-self-end md:justify-self-start">
                                                        {p.ticket?.ticket_id && (
                                                            <ActionButton
                                                                icon={Eye}
                                                                variant="info"
                                                                onClick={() =>
                                                                    openTicketHistory(
                                                                        p.ticket
                                                                            .ticket_id,
                                                                    )
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
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* ---------------- Payment dialog ---------------- */}
            <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) resetForm();
                }}
            >
                <DialogContent className="w-[70vw] max-w-[1100px] max-h-[90vh] overflow-hidden p-0 gap-0">
                    {/* -------- Header -------- */}
                    <DialogHeader className="px-7 pt-6 pb-5 border-b border-dashed border-[#CBD5E1] bg-white">
                        <DialogTitle className="font-['Oswald'] text-2xl text-[#16233F] flex items-center gap-3">
                            <span className="w-10 h-10 rounded-lg bg-[#E5F2EA] flex items-center justify-center flex-shrink-0">
                                <Receipt className="w-5 h-5 text-[#1E8449]" />
                            </span>
                            <div>
                                <div className="leading-tight">
                                    {selectedTicket?.status === 'partial_paid'
                                        ? 'Add Payment'
                                        : 'Record Payment'}
                                </div>
                                <div className="text-xs font-normal text-[#64748B] font-['Inter'] mt-0.5">
                                    {selectedTicket
                                        ? `Ticket ${selectedTicket.ticket_number} · ${selectedTicket.violator?.firstname || ''} ${selectedTicket.violator?.lastname || ''}`.trim()
                                        : 'Enter payment details'}
                                </div>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    <form
                        onSubmit={handleSubmit}
                        className="flex flex-col max-h-[calc(90vh-100px)]"
                    >
                        <div className="flex-1 overflow-y-auto">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                                {/* ============ LEFT: FORM FIELDS ============ */}
                                <div className="lg:col-span-2 p-7 space-y-7 border-r border-dashed border-[#CBD5E1]">
                                    {formError && (
                                        <div className="bg-[#FBE7E9] text-[#C8202F] p-3.5 rounded-md flex items-start gap-2.5 text-sm border-l-4 border-[#C8202F]">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                            <span className="whitespace-pre-line">
                                                {formError}
                                            </span>
                                        </div>
                                    )}

                                    {/* ──── RECEIPT ──── */}
                                    <section>
                                        <div className="flex items-center gap-2 mb-4">
                                            <Receipt className="w-4 h-4 text-[#F0B429]" />
                                            <h3 className="font-['Oswald'] text-lg text-[#16233F]">
                                                Receipt
                                            </h3>
                                            <span className="h-px flex-1 bg-[#E3E7EE]" />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-semibold text-[#16233F] mb-1.5 flex items-center gap-1.5">
                                                    Receipt Number
                                                    <span className="text-[#C8202F]">*</span>
                                                </label>
                                                <Input
                                                    placeholder="e.g., RCP-2024-000123"
                                                    value={formData.receipt_number}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            receipt_number: e.target.value,
                                                        })
                                                    }
                                                    required
                                                    autoFocus
                                                    className="focus-visible:ring-[#F0B429] font-mono h-11"
                                                />
                                                <p className="text-[11px] text-[#94A3B8] mt-1.5">
                                                    Must be unique. Duplicate receipt numbers are rejected.
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-[#16233F] mb-1.5 block">
                                                    Transaction ID
                                                </label>
                                                <Input
                                                    placeholder="Optional"
                                                    value={formData.transaction_id}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            transaction_id: e.target.value,
                                                        })
                                                    }
                                                    className="focus-visible:ring-[#F0B429] font-mono text-xs h-11"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    {/* ──── AMOUNT ──── */}
                                    <section>
                                        <div className="flex items-center gap-2 mb-4">
                                            <PhilippinePeso className="w-4 h-4 text-[#F0B429]" />
                                            <h3 className="font-['Oswald'] text-lg text-[#16233F]">
                                                Amount
                                            </h3>
                                            <span className="h-px flex-1 bg-[#E3E7EE]" />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-semibold text-[#16233F] mb-1.5 flex items-center gap-1.5">
                                                    Amount Paid
                                                    <span className="text-[#C8202F]">*</span>
                                                </label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] font-medium pointer-events-none">
                                                        ₱
                                                    </span>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0.01"
                                                        value={formData.amount_paid}
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                amount_paid: e.target.value,
                                                            })
                                                        }
                                                        required
                                                        className="pl-8 focus-visible:ring-[#F0B429] font-mono h-11 tabular-nums"
                                                    />
                                                </div>
                                                {selectedTicket &&
                                                    parseFloat(formData.amount_paid) >
                                                    (parseFloat(selectedTicket.balance) || 0) + 0.01 && (
                                                        <p className="text-xs text-[#C8202F] mt-1.5 flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3" />
                                                            Amount exceeds outstanding balance.
                                                        </p>
                                                    )}
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-[#16233F] mb-1.5 flex items-center gap-1.5">
                                                    Payment Method
                                                    <span className="text-[#C8202F]">*</span>
                                                </label>
                                                <select
                                                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                                                    value={formData.payment_method}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            payment_method: e.target.value,
                                                        })
                                                    }
                                                    required
                                                >
                                                    <option value="cash">Cash</option>
                                                </select>
                                            </div>
                                        </div>
                                    </section>

                                    {/* ──── PAYMENT INFO ──── */}
                                    <section>
                                        <div className="flex items-center gap-2 mb-4">
                                            <Calendar className="w-4 h-4 text-[#F0B429]" />
                                            <h3 className="font-['Oswald'] text-lg text-[#16233F]">
                                                Payment Info
                                            </h3>
                                            <span className="h-px flex-1 bg-[#E3E7EE]" />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-semibold text-[#16233F] mb-1.5 block">
                                                    Payment Date &amp; Time
                                                </label>
                                                <Input
                                                    type="datetime-local"
                                                    value={formData.payment_date}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            payment_date: e.target.value,
                                                        })
                                                    }
                                                    className="focus-visible:ring-[#F0B429] h-11"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-[#16233F] mb-1.5 block">
                                                    Paid By
                                                </label>
                                                <Input
                                                    placeholder="Name of payer"
                                                    value={formData.paid_by}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            paid_by: e.target.value,
                                                        })
                                                    }
                                                    className="focus-visible:ring-[#F0B429] h-11"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    {/* ──── NOTES ──── */}
                                    <section>
                                        <div className="flex items-center gap-2 mb-4">
                                            <FileText className="w-4 h-4 text-[#F0B429]" />
                                            <h3 className="font-['Oswald'] text-lg text-[#16233F]">
                                                Notes
                                            </h3>
                                            <span className="h-px flex-1 bg-[#E3E7EE]" />
                                        </div>

                                        <textarea
                                            className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                                            placeholder="Optional notes about this payment..."
                                            value={formData.notes}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    notes: e.target.value,
                                                })
                                            }
                                        />
                                    </section>
                                </div>

                                {/* ============ RIGHT: SUMMARY ============ */}
                                <div className="p-7 space-y-6 bg-[#F8F9FA]">
                                    {/* Ticket summary */}
                                    {selectedTicket && (
                                        <section>
                                            <div className="flex items-center gap-2 mb-3">
                                                <TicketIcon className="w-4 h-4 text-[#16233F]" />
                                                <h3 className="font-['Oswald'] text-lg text-[#16233F]">
                                                    Ticket
                                                </h3>
                                            </div>
                                            <div className="rounded-xl bg-white border border-[#E3E7EE] overflow-hidden">
                                                <div
                                                    className="h-1.5"
                                                    style={{
                                                        background:
                                                            TICKET_STATUS_META[selectedTicket.status]?.color ||
                                                            '#16233F',
                                                    }}
                                                />
                                                <div className="p-4 space-y-3">
                                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                                        <span className="font-mono text-sm font-semibold text-[#16233F]">
                                                            {selectedTicket.ticket_number}
                                                        </span>
                                                        {ticketStatusBadge(selectedTicket.status)}
                                                    </div>
                                                    <div>
                                                        <p className="font-['Oswald'] text-base leading-tight text-[#1F2937] truncate">
                                                            {selectedTicket.violator?.firstname}{' '}
                                                            {selectedTicket.violator?.lastname}
                                                        </p>
                                                        <p className="text-xs text-[#64748B] font-mono truncate">
                                                            {selectedTicket.violator?.license}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-[#64748B]">
                                                        <span className="font-mono">
                                                            {selectedTicket.vehicle?.platenumber || '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </section>
                                    )}

                                    {/* Financial breakdown */}
                                    {selectedTicket && (
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
                                                        {formatPeso(getTotalFine(selectedTicket))}
                                                    </span>
                                                </div>

                                                {(selectedTicket.total_paid ?? 0) > 0 && (
                                                    <>
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="text-[#64748B]">
                                                                Already Paid
                                                            </span>
                                                            <span className="font-semibold text-[#1E8449] tabular-nums">
                                                                − {formatPeso(selectedTicket.total_paid || 0)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-sm pt-3 border-t border-dashed border-[#CBD5E1]">
                                                            <span className="text-[#64748B] font-medium">
                                                                Outstanding
                                                            </span>
                                                            <span className="font-bold text-[#C2541F] tabular-nums">
                                                                {formatPeso(
                                                                    selectedTicket.balance ??
                                                                    getTotalFine(selectedTicket),
                                                                )}
                                                            </span>
                                                        </div>
                                                    </>
                                                )}

                                                {/* Live preview of what happens after this payment */}
                                                {parseFloat(formData.amount_paid) > 0 && (
                                                    <>
                                                        <div className="pt-3 border-t border-dashed border-[#CBD5E1]">
                                                            <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] mb-2">
                                                                After this payment
                                                            </p>
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between text-sm">
                                                                    <span className="text-[#64748B]">
                                                                        Paying now
                                                                    </span>
                                                                    <span className="font-semibold text-[#1E8449] tabular-nums">
                                                                        + {formatPeso(formData.amount_paid)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between text-sm">
                                                                    <span className="text-[#64748B]">
                                                                        New balance
                                                                    </span>
                                                                    <span className="font-bold text-[#16233F] tabular-nums">
                                                                        {formatPeso(
                                                                            Math.max(
                                                                                0,
                                                                                (parseFloat(
                                                                                    selectedTicket.balance ??
                                                                                    getTotalFine(selectedTicket),
                                                                                ) || 0) -
                                                                                (parseFloat(formData.amount_paid) || 0),
                                                                            ),
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Fully paid banner */}
                                                        {Math.max(
                                                            0,
                                                            (parseFloat(
                                                                selectedTicket.balance ??
                                                                getTotalFine(selectedTicket),
                                                            ) || 0) -
                                                            (parseFloat(formData.amount_paid) || 0),
                                                        ) <= 0.01 && (
                                                                <div className="pt-3 border-t border-dashed border-[#CBD5E1]">
                                                                    <div className="flex items-center gap-2 bg-[#E5F2EA] border border-[#1E8449]/30 rounded-lg p-2.5 text-xs text-[#1E8449]">
                                                                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                                                        <span className="font-medium">
                                                                            This payment will fully settle the ticket.
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                    </>
                                                )}
                                            </div>
                                        </section>
                                    )}

                                    {/* Tips */}
                                    <section className="rounded-xl border border-[#F0B429]/30 bg-[#FBF1DC] p-4">
                                        <div className="flex items-start gap-2.5">
                                            <AlertCircle className="w-4 h-4 text-[#92600A] mt-0.5 flex-shrink-0" />
                                            <div className="text-xs text-[#92600A] leading-relaxed">
                                                <p className="font-semibold mb-1">Reminders</p>
                                                <ul className="space-y-1 list-disc list-inside">
                                                    <li>
                                                        Confirm the receipt number matches the physical
                                                        receipt before saving.
                                                    </li>
                                                    <li>
                                                        Partial payments are allowed; the ticket stays
                                                        open until the balance is zero.
                                                    </li>
                                                    <li>
                                                        Voiding a payment is possible later from the
                                                        Payment History tab.
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>

                        {/* ============ STICKY FOOTER ============ */}
                        <div className="flex items-center justify-between gap-3 px-7 py-4 border-t border-dashed border-[#CBD5E1] bg-white">
                            <div className="text-xs text-[#64748B] flex items-center gap-2">
                                <AlertCircle className="w-3.5 h-3.5 text-[#94A3B8]" />
                                {!formData.receipt_number ? (
                                    <span>Enter the receipt number to continue.</span>
                                ) : !formData.amount_paid ||
                                    parseFloat(formData.amount_paid) <= 0 ? (
                                    <span>Enter an amount greater than zero.</span>
                                ) : (
                                    <span>
                                        Ready to record{' '}
                                        <strong className="text-[#16233F]">
                                            {formatPeso(formData.amount_paid)}
                                        </strong>{' '}
                                        against{' '}
                                        <strong className="text-[#16233F] font-mono">
                                            {selectedTicket?.ticket_number}
                                        </strong>
                                        .
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                    className="min-w-[100px]"
                                    disabled={createMutation.isPending}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    className="bg-[#1E8449] hover:bg-[#186B3B] min-w-[200px]"
                                    disabled={createMutation.isPending}
                                >
                                    {createMutation.isPending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Recording…
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                            Confirm Payment
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ---------------- History dialog ---------------- */}
            <Dialog
                open={isHistoryDialogOpen}
                onOpenChange={(open) => {
                    setIsHistoryDialogOpen(open);
                    if (!open) setHistoryTicketId(null);
                }}
            >
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-['Oswald'] text-[#16233F] flex items-center gap-2">
                            <History className="w-5 h-5" />
                            Payment History
                        </DialogTitle>
                    </DialogHeader>

                    {ticketHistoryLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
                        </div>
                    ) : !ticketHistory ? (
                        <div className="text-center py-8 text-[#64748B]">
                            No data available.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-[#F8F9FA] rounded-lg p-4 border border-[#E9ECF2]">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <p className="text-[#64748B] text-xs">
                                            Ticket #
                                        </p>
                                        <p className="font-mono font-semibold text-[#16233F]">
                                            {ticketHistory.ticket_number}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[#64748B] text-xs">
                                            Status
                                        </p>
                                        <div>
                                            {ticketStatusBadge(
                                                ticketHistory.status,
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[#64748B] text-xs">
                                            Violator
                                        </p>
                                        <p className="text-[#1F2937]">
                                            {ticketHistory.violator?.firstname}{' '}
                                            {ticketHistory.violator?.lastname}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[#64748B] text-xs">
                                            Plate
                                        </p>
                                        <p className="font-mono text-[#1F2937]">
                                            {
                                                ticketHistory.vehicle
                                                    ?.platenumber
                                            }
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#E9ECF2] text-center">
                                    <div>
                                        <p className="text-xs text-[#64748B]">
                                            Total Fine
                                        </p>
                                        <p className="text-lg font-bold text-[#C8202F]">
                                            {formatPeso(
                                                ticketHistorySummary?.total_fine,
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-[#64748B]">
                                            Total Paid
                                        </p>
                                        <p className="text-lg font-bold text-[#1E8449]">
                                            {formatPeso(
                                                ticketHistorySummary?.total_paid,
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-[#64748B]">
                                            Balance
                                        </p>
                                        <p className="text-lg font-bold text-[#C2541F]">
                                            {formatPeso(
                                                ticketHistorySummary?.balance,
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {ticketPayments.length === 0 ? (
                                <div className="text-center py-6 text-[#64748B] text-sm">
                                    No payments recorded for this ticket yet.
                                </div>
                            ) : (
                                <div className="border border-[#E9ECF2] rounded-lg overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-[#E9ECF2]">
                                            <tr>
                                                <th className="px-4 py-2 text-left font-semibold text-[#16233F] text-xs">
                                                    Receipt #
                                                </th>
                                                <th className="px-4 py-2 text-left font-semibold text-[#16233F] text-xs">
                                                    Amount
                                                </th>
                                                <th className="px-4 py-2 text-left font-semibold text-[#16233F] text-xs">
                                                    Method
                                                </th>
                                                <th className="px-4 py-2 text-left font-semibold text-[#16233F] text-xs">
                                                    Date
                                                </th>
                                                <th className="px-4 py-2 text-left font-semibold text-[#16233F] text-xs">
                                                    Status
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ticketPayments.map((p) => (
                                                <tr
                                                    key={p.payment_id}
                                                    className="border-t border-[#F3F4F6] hover:bg-[#F8F9FA]"
                                                >
                                                    <td className="px-4 py-2 font-mono text-xs text-[#16233F]">
                                                        {p.receipt_number ||
                                                            '—'}
                                                    </td>
                                                    <td className="px-4 py-2 font-semibold text-[#1E8449]">
                                                        {formatPeso(
                                                            p.amount_paid,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-xs capitalize text-[#1F2937]">
                                                        {p.payment_method?.replace(
                                                            '_',
                                                            ' ',
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-xs text-[#1F2937]">
                                                        {formatDate(
                                                            p.payment_date,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        {paymentStatusBadge(
                                                            p.payment_status,
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Payments;