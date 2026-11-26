// web/src/components/payments/WarrantVisitTab.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Loader2, Home, CheckCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Pagination } from '../ui/Pagination';
import { getOverduePayments, updateWarrantStatus } from '../../services/api';
import { formatDay } from '../../lib/dueTime';

const PER_PAGE = 20;
const peso = (n) =>
    `₱${(parseFloat(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const first = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== '');

const StatusChip = ({ status }) =>
    status === 'visited' ? (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[#EEF1F5] text-[#3B5170]">
            <CheckCircle className="w-3 h-3" /> Visited
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[#FBE7E9] text-[#C8202F]">
            <Home className="w-3 h-3" /> For visit
        </span>
    );

/**
 * Overdue tickets that reached the 2-month mark (warrant_status = 'for_visit'),
 * plus the ones already visited. Uses the same backend filter as the Overdue tab.
 */
const WarrantVisitTab = () => {
    const qc = useQueryClient();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('for_visit');
    const [error, setError] = useState('');

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['payments-warrant', 'list', page, search, status],
        queryFn: () =>
            getOverduePayments(page, PER_PAGE, {
                search: search || undefined,
                warrant: status,
            }),
        keepPreviousData: true,
        refetchInterval: 60_000,
    });

    const paged = data?.data;
    const rows = paged?.data || [];

    const refresh = () => {
        qc.invalidateQueries(['payments-warrant']);
        qc.invalidateQueries(['payments-overdue']);
        qc.invalidateQueries(['payments-overdue-count']);
    };

    const warrantMut = useMutation({
        mutationFn: ({ id, status: s }) => updateWarrantStatus(id, s),
        onSuccess: () => {
            setError('');
            refresh();
        },
        onError: (e) => setError(e.response?.data?.message || 'Failed to update warrant status.'),
    });

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
                    value={status}
                    onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                    className="h-10 rounded-md border border-[#E3E7EE] bg-white px-3 text-sm"
                >
                    <option value="for_visit">For visit</option>
                    <option value="visited">Visited</option>
                </select>
            </div>

            <p className="text-xs text-[#64748B]">
                Overdue tickets unpaid for 2 months or more are listed here for a warrant visit.
            </p>

            {error && (
                <div className="flex items-start gap-2 rounded-lg border border-[#C8202F]/30 bg-[#FBE7E9] p-3 text-xs text-[#C8202F]">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" /> <span>{error}</span>
                </div>
            )}

            <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-[#16233F] text-white text-xs">
                        <tr className="text-left">
                            {['Ticket #', 'Violator / Address', 'Plate', 'Balance', 'Deadline', 'Eligible Since', 'Status', 'Actions'].map((h) => (
                                <th key={h} className="px-3 py-3 font-semibold whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF0F4]">
                        {isLoading && (
                            <tr><td colSpan={8} className="p-8 text-center text-[#64748B]"><Loader2 className="inline w-4 h-4 animate-spin mr-2" />Loading…</td></tr>
                        )}
                        {!isLoading && rows.length === 0 && (
                            <tr><td colSpan={8} className="p-8 text-center text-[#64748B]">
                                {search
                                    ? 'No tickets match your search.'
                                    : status === 'visited'
                                        ? 'No visited tickets yet.'
                                        : 'No tickets are due for a warrant visit.'}
                            </td></tr>
                        )}
                        {rows.map((t) => {
                            const v = t.violator || {};
                            const address = first(
                                v.address,
                                [v.street, v.barangay, v.city, v.province].filter(Boolean).join(', '),
                            );
                            const phone = first(v.contact_number, v.contact_no, v.phone, v.mobile, v.contact);
                            return (
                                <tr key={t.ticket_id} className="hover:bg-[#F8F9FB]">
                                    <td className="px-3 py-3 font-mono font-medium text-[#16233F] whitespace-nowrap">{t.ticket_number}</td>
                                    <td className="px-3 py-3 min-w-[220px]">
                                        <div className="font-medium text-[#16233F]">{v.firstname} {v.lastname}</div>
                                        {address && <div className="text-xs text-[#64748B]">{address}</div>}
                                        {phone && <div className="text-xs text-[#64748B]">{phone}</div>}
                                    </td>
                                    <td className="px-3 py-3 font-mono whitespace-nowrap">{t.vehicle?.platenumber || '—'}</td>
                                    <td className="px-3 py-3 font-bold text-[#C2541F] tabular-nums whitespace-nowrap">{peso(t.balance)}</td>
                                    <td className="px-3 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDay(t.payment_due_at)}</td>
                                    <td className="px-3 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDay(t.warrant_eligible_at)}</td>
                                    <td className="px-3 py-3"><StatusChip status={t.warrant_status} /></td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                        {t.warrant_status === 'visited' ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={warrantMut.isLoading}
                                                onClick={() => warrantMut.mutate({ id: t.ticket_id, status: 'for_visit' })}
                                            >
                                                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reopen
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={warrantMut.isLoading}
                                                onClick={() => warrantMut.mutate({ id: t.ticket_id, status: 'visited' })}
                                            >
                                                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Mark visited
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
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

export default WarrantVisitTab;