// resources/js/pages/Payments.jsx
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from "../components/ui/card";
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from "../components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Pagination } from "../components/ui/Pagination";
import ActionButton from "../components/ui/ActionButton";
import {
    getPayments,
    getPendingPayments,
    createPayment,
    getPaymentsByTicket,
} from "../services/api";
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
} from "lucide-react";
import { useAlert } from "../components/ui/AlertProvider";

const ITEMS_PER_PAGE = 20;

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
    `₱${(parseFloat(n) || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const formatDateTime = (value) => {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleString();
    } catch {
        return "—";
    }
};

const formatDate = (value) => {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleDateString();
    } catch {
        return "—";
    }
};

const paymentStatusBadge = (status) => {
    const map = {
        pending: { cls: "bg-[#FBF1DC] text-[#92600A]", Icon: Clock, label: "PENDING" },
        completed: { cls: "bg-[#E5F2EA] text-[#1E8449]", Icon: CheckCircle, label: "COMPLETED" },
        failed: { cls: "bg-[#FBE7E9] text-[#C8202F]", Icon: XCircle, label: "FAILED" },
        refunded: { cls: "bg-[#EEF1F5] text-[#3B5170]", Icon: AlertCircle, label: "REFUNDED" },
    };
    const { cls, Icon, label } = map[status] || map.pending;
    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cls}`}
        >
            <Icon className="w-3 h-3" />
            {label}
        </span>
    );
};

const ticketStatusBadge = (status) => {
    const map = {
        issued: { cls: "bg-[#FBF1DC] text-[#92600A]" },
        partial_paid: { cls: "bg-[#EEF1F5] text-[#3B5170]" },
        paid: { cls: "bg-[#E5F2EA] text-[#1E8449]" },
        contested: { cls: "bg-[#FBEAE2] text-[#C2541F]" },
        dismissed: { cls: "bg-[#FBE7E9] text-[#C8202F]" },
    };
    const cls = map[status]?.cls || "bg-gray-100 text-gray-700";
    return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>
            {status?.toUpperCase().replace("_", " ") || "—"}
        </span>
    );
};

const Payments = () => {
    const queryClient = useQueryClient();
    const notify = useAlert();
    const [tab, setTab] = useState("pending");

    const [pendingPage, setPendingPage] = useState(1);
    const [pendingSearch, setPendingSearch] = useState("");

    const [historyPage, setHistoryPage] = useState(1);
    const [historySearch, setHistorySearch] = useState("");
    const [historyStatus, setHistoryStatus] = useState("");

    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [formData, setFormData] = useState({
        receipt_number: "",
        amount_paid: "",
        payment_method: "cash",
        payment_date: new Date().toISOString().slice(0, 16),
        transaction_id: "",
        paid_by: "",
        notes: "",
    });
    const [formError, setFormError] = useState("");

    const [historyTicketId, setHistoryTicketId] = useState(null);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

    const {
        data: pendingResponse,
        isLoading: pendingLoading,
        refetch: refetchPending,
        error: pendingError,
    } = useQuery({
        queryKey: ["payments-pending", pendingPage, pendingSearch],
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
        queryKey: ["payments-history", historyPage, historySearch, historyStatus],
        queryFn: () =>
            getPayments(historyPage, ITEMS_PER_PAGE, {
                ticket_number: historySearch || undefined,
                status: historyStatus || undefined,
            }),
        keepPreviousData: true,
        staleTime: 1000 * 60,
        enabled: tab === "history",
    });

    const { data: ticketHistoryResponse, isLoading: ticketHistoryLoading } =
        useQuery({
            queryKey: ["payments-by-ticket", historyTicketId],
            queryFn: () => getPaymentsByTicket(historyTicketId),
            enabled: !!historyTicketId && isHistoryDialogOpen,
        });

    const pendingTickets = getDataArray(pendingResponse);
    const pendingMeta = getMeta(pendingResponse);

    const payments = getDataArray(historyResponse);
    const historyMeta = getMeta(historyResponse);

    const createMutation = useMutation({
        mutationFn: createPayment,
        onSuccess: (response) => {
            queryClient.invalidateQueries(["payments-pending"]);
            queryClient.invalidateQueries(["payments-history"]);
            queryClient.invalidateQueries(["tickets"]);

            const data = response?.data || {};
            setIsDialogOpen(false);
            resetForm();

            if (data.ticket_status === "paid") {
                notify.success(
                    `Payment recorded. Ticket is now fully paid. (Balance: ${formatPeso(data.balance)})`,
                    { title: "Payment Recorded" },
                );
            } else {
                notify.success(
                    `Partial payment recorded.\n\nPaid this time: ${formatPeso(data.amount_paid)}\nTotal paid so far: ${formatPeso(data.total_paid)}\nRemaining balance: ${formatPeso(data.balance)}`,
                    { title: "Partial Payment Recorded" },
                );
            }
        },
        onError: (error) => {
            const payload = error.response?.data || {};
            let msg = payload.message || "Failed to record payment.";

            if (payload.errors) {
                const flat = Object.values(payload.errors).flat().join("\n");
                if (flat) msg = flat;
            }
            setFormError(msg);
            notify.error(msg);
        },
    });

    const openPaymentDialog = (ticket) => {
        setSelectedTicket(ticket);

        const totalFine = getTotalFine(ticket);
        const alreadyPaid = parseFloat(ticket.total_paid) || 0;
        const outstanding =
            ticket.balance != null
                ? parseFloat(ticket.balance)
                : Math.max(0, totalFine - alreadyPaid);

        setFormData({
            receipt_number: "",
            amount_paid: outstanding > 0 ? outstanding.toFixed(2) : totalFine.toFixed(2),
            payment_method: "cash",
            payment_date: new Date().toISOString().slice(0, 16),
            transaction_id: "",
            paid_by: ticket.violator
                ? `${ticket.violator.firstname} ${ticket.violator.lastname}`
                : "",
            notes: "",
        });
        setFormError("");
        setIsDialogOpen(true);
    };

    const resetForm = () => {
        setSelectedTicket(null);
        setFormData({
            receipt_number: "",
            amount_paid: "",
            payment_method: "cash",
            payment_date: new Date().toISOString().slice(0, 16),
            transaction_id: "",
            paid_by: "",
            notes: "",
        });
        setFormError("");
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setFormError("");

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
            setFormError("Receipt number is required.");
            return;
        }
        if (!payload.amount_paid || payload.amount_paid <= 0) {
            setFormError("Amount must be greater than zero.");
            return;
        }

        createMutation.mutate(payload);
    };

    const openTicketHistory = (ticketId) => {
        setHistoryTicketId(ticketId);
        setIsHistoryDialogOpen(true);
    };

    const totalPendingCount = pendingMeta.total || 0;

    const ticketHistory = ticketHistoryResponse?.data?.ticket;
    const ticketHistorySummary = ticketHistoryResponse?.data?.summary;
    const ticketPayments = ticketHistory?.payments || [];

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-['Oswald'] font-semibold text-[#16233F]">
                        Payments
                    </h1>
                    <p className="text-[#64748B] font-['Inter'] text-sm mt-1">
                        Record receipt numbers and settle traffic fines.
                    </p>
                </div>
                <Button
                    onClick={() => {
                        refetchPending();
                        if (tab === "history") refetchHistory();
                    }}
                    variant="outline"
                    className="border-[#1E8449]/30 text-[#1E8449] hover:bg-[#E5F2EA]"
                >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                </Button>
            </div>

            <Tabs value={tab} onValueChange={setTab} className="space-y-4">
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

                <TabsContent value="pending">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle className="font-['Oswald'] font-medium text-[#16233F]">
                                    Tickets Awaiting Payment
                                </CardTitle>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                                    <Input
                                        placeholder="Search ticket #, violator, plate..."
                                        value={pendingSearch}
                                        onChange={(e) => {
                                            setPendingSearch(e.target.value);
                                            setPendingPage(1);
                                        }}
                                        className="pl-10 w-80 focus-visible:ring-[#F0B429]"
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {pendingLoading && !pendingResponse ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
                                </div>
                            ) : pendingError ? (
                                <div className="text-center py-8 text-[#C8202F]">
                                    Error loading pending tickets.
                                </div>
                            ) : pendingTickets.length === 0 ? (
                                <div className="text-center py-12">
                                    <CheckCircle className="w-12 h-12 text-[#1E8449] mx-auto mb-3" />
                                    <p className="text-[#64748B]">
                                        No tickets awaiting payment. All settled! 🎉
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-[#E9ECF2] hover:bg-[#E9ECF2]">
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                                                    Ticket #
                                                </TableHead>
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                                                    Violator
                                                </TableHead>
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                                                    Plate
                                                </TableHead>
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                                                    Violations
                                                </TableHead>
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                                                    Total Fine
                                                </TableHead>
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                                                    Paid
                                                </TableHead>
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                                                    Balance
                                                </TableHead>
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                                                    Status
                                                </TableHead>
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F] text-right">
                                                    Action
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pendingTickets.map((ticket) => {
                                                const totalFine = getTotalFine(ticket);
                                                const paid = parseFloat(ticket.total_paid) || 0;
                                                const balance =
                                                    ticket.balance != null
                                                        ? parseFloat(ticket.balance)
                                                        : Math.max(0, totalFine - paid);
                                                const isPartial = ticket.status === "partial_paid";

                                                return (
                                                    <TableRow
                                                        key={ticket.ticket_id}
                                                        className="hover:bg-[#F8F9FA]"
                                                    >
                                                        <TableCell className="font-mono text-sm font-medium text-[#16233F]">
                                                            {ticket.ticket_number}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="text-sm text-[#1F2937]">
                                                                {ticket.violator?.firstname}{" "}
                                                                {ticket.violator?.lastname}
                                                            </div>
                                                            <div className="text-xs text-[#64748B]">
                                                                {ticket.violator?.license}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-mono text-sm text-[#1F2937]">
                                                            {ticket.vehicle?.platenumber}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="space-y-0.5">
                                                                {ticket.violations?.slice(0, 2).map((v, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="text-xs text-[#1F2937]"
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
                                                        </TableCell>
                                                        <TableCell className="font-bold text-[#C8202F]">
                                                            {formatPeso(totalFine)}
                                                        </TableCell>
                                                        <TableCell className="font-semibold text-[#1E8449]">
                                                            {paid > 0 ? formatPeso(paid) : "—"}
                                                        </TableCell>
                                                        <TableCell className="font-bold text-[#C2541F]">
                                                            {formatPeso(balance)}
                                                        </TableCell>
                                                        <TableCell>{ticketStatusBadge(ticket.status)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-2 flex-wrap">
                                                                {isPartial && (
                                                                    <ActionButton
                                                                        icon={History}
                                                                        variant="info"
                                                                        onClick={() =>
                                                                            openTicketHistory(ticket.ticket_id)
                                                                        }
                                                                    >
                                                                        History
                                                                    </ActionButton>
                                                                )}
                                                                <ActionButton
                                                                    icon={PhilippinePeso}
                                                                    variant="primary"
                                                                    onClick={() => openPaymentDialog(ticket)}
                                                                >
                                                                    {isPartial ? "Add Payment" : "Record Payment"}
                                                                </ActionButton>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                    <div className="px-4 py-2 border-t">
                                        <Pagination
                                            currentPage={pendingMeta.current_page}
                                            totalPages={pendingMeta.last_page}
                                            onPageChange={setPendingPage}
                                            totalItems={pendingMeta.total}
                                        />
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <div className="flex gap-4 flex-wrap">
                                <div className="relative flex-1 min-w-[240px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                                    <Input
                                        placeholder="Search by ticket number..."
                                        value={historySearch}
                                        onChange={(e) => {
                                            setHistorySearch(e.target.value);
                                            setHistoryPage(1);
                                        }}
                                        className="pl-10 focus-visible:ring-[#F0B429]"
                                    />
                                </div>
                                <select
                                    className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                                    value={historyStatus}
                                    onChange={(e) => {
                                        setHistoryStatus(e.target.value);
                                        setHistoryPage(1);
                                    }}
                                >
                                    <option value="">All Statuses</option>
                                    <option value="completed">Completed</option>
                                    <option value="pending">Pending</option>
                                    <option value="failed">Failed</option>
                                    <option value="refunded">Refunded</option>
                                </select>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {historyLoading && !historyResponse ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
                                </div>
                            ) : historyError ? (
                                <div className="text-center py-8 text-[#C8202F]">
                                    Error loading payment history.
                                </div>
                            ) : payments.length === 0 ? (
                                <div className="text-center py-12">
                                    <Receipt className="w-12 h-12 text-[#CBD5E1] mx-auto mb-3" />
                                    <p className="text-[#64748B]">
                                        No payments recorded yet.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-[#E9ECF2] hover:bg-[#E9ECF2]">
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                                                    Reference
                                                </TableHead>
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                                                    Receipt #
                                                </TableHead>
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                                                    Ticket #
                                                </TableHead>
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                                                    Violator
                                                </TableHead>
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                                                    Amount
                                                </TableHead>
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                                                    Method
                                                </TableHead>
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                                                    Date
                                                </TableHead>
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                                                    Status
                                                </TableHead>
                                                <TableHead className="font-['Inter'] font-semibold text-[#16233F] text-right">
                                                    Action
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {payments.map((p) => (
                                                <TableRow
                                                    key={p.payment_id}
                                                    className="hover:bg-[#F8F9FA]"
                                                >
                                                    <TableCell className="font-mono text-xs text-[#64748B]">
                                                        {p.payment_reference}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm font-medium text-[#16233F]">
                                                        {p.receipt_number || "—"}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm text-[#1F2937]">
                                                        {p.ticket?.ticket_number || "—"}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-[#1F2937]">
                                                        {p.ticket?.violator
                                                            ? `${p.ticket.violator.firstname} ${p.ticket.violator.lastname}`
                                                            : "—"}
                                                    </TableCell>
                                                    <TableCell className="font-bold text-[#1E8449]">
                                                        {formatPeso(p.amount_paid)}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-[#1F2937] capitalize">
                                                        {p.payment_method?.replace("_", " ") || "—"}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-[#1F2937]">
                                                        {formatDateTime(p.payment_date)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {paymentStatusBadge(p.payment_status)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
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
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <div className="px-4 py-2 border-t">
                                        <Pagination
                                            currentPage={historyMeta.current_page}
                                            totalPages={historyMeta.last_page}
                                            onPageChange={setHistoryPage}
                                            totalItems={historyMeta.total}
                                        />
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) resetForm();
                }}
            >
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-['Oswald'] text-[#16233F] flex items-center gap-2">
                            <Receipt className="w-5 h-5" />
                            {selectedTicket?.status === "partial_paid"
                                ? "Add Payment"
                                : "Record Payment"}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedTicket && (
                        <div className="bg-[#F8F9FA] rounded-lg p-3 mb-2 border border-[#E9ECF2]">
                            <div className="flex justify-between text-sm">
                                <span className="text-[#64748B]">Ticket</span>
                                <span className="font-mono font-semibold text-[#16233F]">
                                    {selectedTicket.ticket_number}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-[#64748B]">Violator</span>
                                <span className="text-[#1F2937]">
                                    {selectedTicket.violator?.firstname}{" "}
                                    {selectedTicket.violator?.lastname}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-[#64748B]">Plate</span>
                                <span className="font-mono text-[#1F2937]">
                                    {selectedTicket.vehicle?.platenumber}
                                </span>
                            </div>

                            <div className="flex justify-between text-base mt-2 pt-2 border-t border-[#E9ECF2]">
                                <span className="font-semibold text-[#16233F]">
                                    Total Fine
                                </span>
                                <span className="font-bold text-[#C8202F]">
                                    {formatPeso(getTotalFine(selectedTicket))}
                                </span>
                            </div>

                            {(selectedTicket.is_partial ||
                                (selectedTicket.total_paid ?? 0) > 0) && (
                                    <>
                                        <div className="flex justify-between text-sm mt-1">
                                            <span className="text-[#64748B]">Already Paid</span>
                                            <span className="font-semibold text-[#1E8449]">
                                                {formatPeso(selectedTicket.total_paid || 0)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm mt-1">
                                            <span className="text-[#64748B]">
                                                Outstanding Balance
                                            </span>
                                            <span className="font-bold text-[#C2541F]">
                                                {formatPeso(
                                                    selectedTicket.balance ??
                                                    getTotalFine(selectedTicket),
                                                )}
                                            </span>
                                        </div>
                                    </>
                                )}
                        </div>
                    )}

                    {formError && (
                        <div className="bg-[#FBE7E9] text-[#C8202F] p-3 rounded-md flex items-start gap-2 text-sm border border-[#F3C6CA]">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span className="whitespace-pre-line">{formError}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block text-[#1F2937]">
                                Receipt Number *
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
                                className="focus-visible:ring-[#F0B429] font-mono"
                            />
                            <p className="text-xs text-[#94A3B8] mt-1">
                                Must be unique. Duplicates will be rejected.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block text-[#1F2937]">
                                    Amount Paid *
                                </label>
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
                                    className="focus-visible:ring-[#F0B429]"
                                />
                                {selectedTicket &&
                                    parseFloat(formData.amount_paid) >
                                    (parseFloat(selectedTicket.balance) || 0) +
                                    0.01 && (
                                        <p className="text-xs text-[#C8202F] mt-1">
                                            Amount exceeds outstanding balance.
                                        </p>
                                    )}
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block text-[#1F2937]">
                                    Payment Method *
                                </label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
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
                                    <option value="gcash">GCash</option>
                                    <option value="maya">Maya</option>
                                    <option value="online_banking">Online Banking</option>
                                    <option value="over_the_counter">
                                        Over the Counter
                                    </option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1 block text-[#1F2937]">
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
                                className="focus-visible:ring-[#F0B429]"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block text-[#1F2937]">
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
                                    className="focus-visible:ring-[#F0B429] font-mono text-xs"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block text-[#1F2937]">
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
                                    className="focus-visible:ring-[#F0B429]"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1 block text-[#1F2937]">
                                Notes
                            </label>
                            <textarea
                                className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                                placeholder="Optional notes..."
                                value={formData.notes}
                                onChange={(e) =>
                                    setFormData({ ...formData, notes: e.target.value })
                                }
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsDialogOpen(false)}
                                className="flex-1"
                                disabled={createMutation.isPending}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1 bg-[#1E8449] hover:bg-[#186B3B]"
                                disabled={createMutation.isPending}
                            >
                                {createMutation.isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Recording...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Confirm Payment
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

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
                                        <p className="text-[#64748B] text-xs">Ticket #</p>
                                        <p className="font-mono font-semibold text-[#16233F]">
                                            {ticketHistory.ticket_number}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[#64748B] text-xs">Status</p>
                                        <div>{ticketStatusBadge(ticketHistory.status)}</div>
                                    </div>
                                    <div>
                                        <p className="text-[#64748B] text-xs">Violator</p>
                                        <p className="text-[#1F2937]">
                                            {ticketHistory.violator?.firstname}{" "}
                                            {ticketHistory.violator?.lastname}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[#64748B] text-xs">Plate</p>
                                        <p className="font-mono text-[#1F2937]">
                                            {ticketHistory.vehicle?.platenumber}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#E9ECF2] text-center">
                                    <div>
                                        <p className="text-xs text-[#64748B]">Total Fine</p>
                                        <p className="text-lg font-bold text-[#C8202F]">
                                            {formatPeso(ticketHistorySummary?.total_fine)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-[#64748B]">Total Paid</p>
                                        <p className="text-lg font-bold text-[#1E8449]">
                                            {formatPeso(ticketHistorySummary?.total_paid)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-[#64748B]">Balance</p>
                                        <p className="text-lg font-bold text-[#C2541F]">
                                            {formatPeso(ticketHistorySummary?.balance)}
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
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-[#E9ECF2] hover:bg-[#E9ECF2]">
                                                <TableHead className="font-semibold text-[#16233F] text-xs">
                                                    Receipt #
                                                </TableHead>
                                                <TableHead className="font-semibold text-[#16233F] text-xs">
                                                    Amount
                                                </TableHead>
                                                <TableHead className="font-semibold text-[#16233F] text-xs">
                                                    Method
                                                </TableHead>
                                                <TableHead className="font-semibold text-[#16233F] text-xs">
                                                    Date
                                                </TableHead>
                                                <TableHead className="font-semibold text-[#16233F] text-xs">
                                                    Status
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {ticketPayments.map((p) => (
                                                <TableRow
                                                    key={p.payment_id}
                                                    className="hover:bg-[#F8F9FA]"
                                                >
                                                    <TableCell className="font-mono text-xs text-[#16233F]">
                                                        {p.receipt_number || "—"}
                                                    </TableCell>
                                                    <TableCell className="font-semibold text-[#1E8449]">
                                                        {formatPeso(p.amount_paid)}
                                                    </TableCell>
                                                    <TableCell className="text-xs capitalize text-[#1F2937]">
                                                        {p.payment_method?.replace("_", " ")}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-[#1F2937]">
                                                        {formatDate(p.payment_date)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {paymentStatusBadge(p.payment_status)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
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