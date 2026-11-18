// web/src/components/payments/MissedDeadlineTab.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Mail, Loader2, Home, CheckCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Pagination } from '../ui/Pagination';
import { useAlert } from '../ui/AlertProvider';
import { getOverduePayments, sendOverdueWarnings, updateWarrantStatus } from '../../services/api';
import { useNow } from './DueStatus';
import { formatOverdue, formatDay } from '../../lib/dueTime';

const PER_PAGE = 20;
const peso = (n) =>
    `₱${(parseFloat(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const OverdueFor = ({ ticket }) => {
    const now = useNow(60_000);
    const ms = now - new Date(ticket.payment_due_at).getTime();
    return <span className="font-semibold text-[#C8202F] tabular-nums">{formatOverdue(Math.max(0, ms))}</span>;
};

const WarrantCell = ({ t }) => {
    if (t.warrant_status === 'visited') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[#EEF1F5] text-[#3B5170]">
                <CheckCircle className="w-3 h-3" /> Visited
            </span>
        );
    }
    if (t.warrant_status === 'for_visit') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[#FBE7E9] text-[#C8202F]">
                <Home className="w-3 h-3" /> Warrant Visit
            </span>
        );
    }
    return <span className="text-xs text-[#64748B]">Visit eligible {formatDay(t.warrant_eligible_at)}</span>;
};

const MissedDeadlineTab = () => {
    const qc = useQueryClient();
    const notify = useAlert();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [warrant, setWarrant] = useState('');
    const [selected, setSelected] = useState(() => new Set());
    const [error, setError] = useState('');

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['payments-overdue', page, search, warrant],
        queryFn: () =>
            getOverduePayments(page, PER_PAGE, {
                search: search || undefined,
                warrant: warrant || undefined,
            }),
        keepPreviousData: true,
        refetchInterval: 60_000,
    });

    const paged = data?.data;
    const rows = paged?.data || [];

    const refresh = () => {
        qc.invalidateQueries(['payments-overdue']);
        qc.invalidateQueries(['payments-overdue-count']);
    };

    const warnMut = useMutation({
        mutationFn: (ids) => sendOverdueWarnings(ids),
        onSuccess: (res) => {
            const { sent = [], skipped = [] } = res.data || {};
            setError(
                skipped.length
                    ? `Skipped ${skipped.length}: ` +
                          skipped.map((s) => `${s.ticket_number} (${s.reason})`).join('; ')
                    : '',
            );
            if (sent.length) notify.success(`Warning email sent to ${sent.length} violator(s).`);
            setSelected(new Set());
            refresh();
        },
        onError: (e) => setError(e.response?.data?.message || 'Failed to send warnings.'),
    });

    const warrantMut = useMutation({
        mutationFn: ({ id, status }) => updateWarrantStatus(id, status),
        onSuccess: refresh,
        onError: (e) => setError(e.response?.data?.message || 'Failed to update warrant status.'),
    });

    const sendTo = (ids) => {
        if (!ids.length) return;
        if (!window.confirm(`Send a warning email to ${ids.length} violator(s)?`)) return;
        setError('');
        warnMut.mutate(ids);
    };

    const toggle = (id) =>
        setSelected((prev) => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.ticket_id));
    const toggleAll = () =>
        setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.ticket_id)));

    return (
        <div className="space-y-4 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                    <Input
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search ticket, violator, license, plate…"
                        className="pl-9"
                    />
                </div>
                <select
                    value={warrant}
                    onChange={(e) => { setWarrant(e.target.value); setPage(1); }}
                    className="h-10 rounded-md border border-[#E3E7EE] bg-white px-3 text-sm"
                >
                    <option value="">All overdue</option>
                    <option value="none">Under 2 months</option>
                    <option value="for_visit">Warrant visit</option>
                    <option value="visited">Visited</option>
                </select>
                <Button
                    onClick={() => sendTo([...selected])}
                    disabled={!selected.size || warnMut.isLoading}
                    className="bg-[#C8202F] hover:bg-[#A51A27]"
                >
                    {warnMut.isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                    Send warning{selected.size ? ` (${selected.size})` : ''}
                </Button>
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-lg border border-[#C8202F]/30 bg-[#FBE7E9] p-3 text-xs text-[#C8202F]">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" /> <span>{error}</span>
                </div>
            )}

            <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-[#16233F] text-white text-xs">
                        <tr className="text-left">
                            <th className="px-3 py-3 w-8">
                                <input type="checkbox" checked={allOnPage} onChange={toggleAll} />
                            </th>
                            {['Ticket #', 'Violator / Email', 'Balance', 'Deadline', 'Overdue For', 'Warnings', 'Warrant Visit', 'Actions'].map((h) => (
                                <th key={h} className="px-3 py-3 font-semibold whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF0F4]">
                        {isLoading && (
                            <tr><td colSpan={9} className="p-8 text-center text-[#64748B]"><Loader2 className="inline w-4 h-4 animate-spin mr-2" />Loading…</td></tr>
                        )}
                        {!isLoading && rows.length === 0 && (
                            <tr><td colSpan={9} className="p-8 text-center text-[#64748B]">No tickets have missed the deadline. 🎉</td></tr>
                        )}
                        {rows.map((t) => (
                            <tr key={t.ticket_id} className="hover:bg-[#F8F9FB]">
                                <td className="px-3 py-3">
                                    <input type="checkbox" checked={selected.has(t.ticket_id)} onChange={() => toggle(t.ticket_id)} />
                                </td>
                                <td className="px-3 py-3 font-mono font-medium text-[#16233F] whitespace-nowrap">{t.ticket_number}</td>
                                <td className="px-3 py-3 min-w-[190px]">
                                    <div className="text-[#1F2937]">{t.violator?.firstname} {t.violator?.lastname}</div>
                                    {t.violator?.email
                                        ? <div className="text-xs text-[#64748B] truncate">{t.violator.email}</div>
                                        : <div className="text-xs text-[#C8202F]">No email on file</div>}
                                </td>
                                <td className="px-3 py-3 font-bold text-[#C2541F] tabular-nums whitespace-nowrap">{peso(t.balance)}</td>
                                <td className="px-3 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDay(t.payment_due_at)}</td>
                                <td className="px-3 py-3 whitespace-nowrap"><OverdueFor ticket={t} /></td>
                                <td className="px-3 py-3 text-xs whitespace-nowrap">
                                    {t.warning_count > 0
                                        ? <>{t.warning_count}× <span className="text-[#64748B]">· last {formatDay(t.warning_sent_at)}</span></>
                                        : <span className="text-[#94A3B8]">None sent</span>}
                                </td>
                                <td className="px-3 py-3"><WarrantCell t={t} /></td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" disabled={!t.violator?.email || warnMut.isLoading} onClick={() => sendTo([t.ticket_id])}>
                                            <Mail className="w-3.5 h-3.5 mr-1" /> Warn
                                        </Button>
                                        {t.warrant_status === 'for_visit' && (
                                            <Button size="sm" variant="outline" onClick={() => warrantMut.mutate({ id: t.ticket_id, status: 'visited' })}>
                                                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Mark visited
                                            </Button>
                                        )}
                                        {t.warrant_status === 'visited' && (
                                            <Button size="sm" variant="outline" onClick={() => warrantMut.mutate({ id: t.ticket_id, status: 'for_visit' })}>
                                                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reopen
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {rows.length > 0 && (
                <Pagination
                    currentPage={paged.current_page}
                    totalPages={paged.last_page}
                    onPageChange={setPage}
                    totalItems={paged.total}
                    itemsPerPage={PER_PAGE}
                />
            )}
            {isFetching && !isLoading && <p className="text-xs text-[#94A3B8]">Updating…</p>}
        </div>
    );
};

export default MissedDeadlineTab;