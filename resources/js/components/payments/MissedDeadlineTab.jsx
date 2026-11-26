// web/src/components/payments/MissedDeadlineTab.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Mail, Loader2, CheckCircle, AlertTriangle, User as UserIcon, Car, Eye } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Pagination } from '../ui/Pagination';
import { useAlert } from '../ui/AlertProvider';
import { getOverduePayments, sendOverdueWarnings } from '../../services/api';
import { formatDay } from '../../lib/dueTime';

const PER_PAGE = 20;
const peso = (n) =>
    `₱${(parseFloat(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const isWarnedTicket = (t) => (Number(t?.warning_count) || 0) > 0;

const first = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== '');

const InfoRow = ({ label, value }) =>
    value ? (
        <div className="flex justify-between gap-4 py-1.5 text-sm">
            <span className="text-[#64748B]">{label}</span>
            <span className="text-right font-medium text-[#1F2937] break-words">{value}</span>
        </div>
    ) : null;

const ViolatorModal = ({ ticket, onClose, onWarn, warning }) => {
    const v = ticket?.violator || {};
    const veh = ticket?.vehicle || {};
    const name = `${v.firstname || ''} ${v.middlename || ''} ${v.lastname || ''}`.replace(/\s+/g, ' ').trim();
    const phone = first(v.contact_number, v.contact_no, v.phone, v.mobile, v.contact);
    const alreadyWarned = isWarnedTicket(ticket);
    const address = first(
        v.address,
        [v.street, v.barangay, v.city, v.province].filter(Boolean).join(', '),
    );

    return (
        <Dialog open={!!ticket} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
                {ticket && (
                    <>
                        <DialogHeader className="px-6 py-4 border-b border-[#E3E7EE] bg-[#16233F] text-white">
                            <DialogTitle className="flex items-center gap-2 font-['Oswald']">
                                <UserIcon className="w-5 h-5" /> Violator Information
                            </DialogTitle>
                        </DialogHeader>

                        <div className="px-6 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
                            <section>
                                <p className="text-lg font-semibold text-[#16233F]">{name || 'Unknown'}</p>
                                <div className="divide-y divide-dashed divide-[#E3E7EE] mt-1">
                                    <InfoRow label="License No." value={v.license} />
                                    <InfoRow label="Email" value={v.email || 'No email on file'} />
                                    <InfoRow label="Contact No." value={phone} />
                                    <InfoRow label="Address" value={address} />
                                    <InfoRow label="Birthdate" value={v.birthdate || v.date_of_birth} />
                                </div>
                            </section>

                            <section>
                                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                                    <Car className="w-3.5 h-3.5" /> Vehicle
                                </p>
                                <div className="divide-y divide-dashed divide-[#E3E7EE]">
                                    <InfoRow label="Plate No." value={veh.platenumber} />
                                    <InfoRow label="Owner" value={veh.owner} />
                                </div>
                            </section>

                            <section className="rounded-lg bg-[#F8F9FA] border border-[#E3E7EE] px-4 py-2">
                                <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">Ticket</p>
                                <div className="divide-y divide-dashed divide-[#E3E7EE]">
                                    <InfoRow label="Ticket No." value={ticket.ticket_number} />
                                    <InfoRow label="Balance" value={peso(ticket.balance)} />
                                    <InfoRow label="Deadline" value={formatDay(ticket.payment_due_at)} />
                                    <InfoRow
                                        label="Warnings sent"
                                        value={alreadyWarned ? `${ticket.warning_count}× (last ${formatDay(ticket.warning_sent_at)})` : 'None'}
                                    />
                                </div>
                            </section>
                        </div>

                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-dashed border-[#CBD5E1] bg-white">
                            <Button variant="outline" onClick={onClose}>Close</Button>
                            <Button
                                onClick={() => onWarn([ticket.ticket_id])}
                                disabled={!v.email || warning || alreadyWarned}
                                className={
                                    alreadyWarned
                                        ? 'bg-[#E5F2EA] text-[#1E8449] hover:bg-[#E5F2EA]'
                                        : 'bg-[#C8202F] hover:bg-[#A51A27]'
                                }
                            >
                                {alreadyWarned ? (
                                    <><CheckCircle className="w-4 h-4 mr-2" /> Warned</>
                                ) : (
                                    <><Mail className="w-4 h-4 mr-2" /> Send warning</>
                                )}
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};

const MissedDeadlineTab = () => {
    const qc = useQueryClient();
    const notify = useAlert();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(() => new Set());
    const [error, setError] = useState('');
    const [viewTicket, setViewTicket] = useState(null);

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['payments-overdue', page, search],
        queryFn: () =>
            getOverduePayments(page, PER_PAGE, {
                search: search || undefined,
            }),
        keepPreviousData: true,
        refetchInterval: 60_000,
    });

    const paged = data?.data;
    const rows = paged?.data || [];

    const refresh = () => {
        qc.invalidateQueries(['payments-overdue']);
        qc.invalidateQueries(['payments-overdue-count']);
        qc.invalidateQueries(['payments-warrant']);
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
                            {['Ticket #', 'Violator / Email', 'Balance', 'Deadline', 'Actions'].map((h) => (
                                <th key={h} className="px-3 py-3 font-semibold whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF0F4]">
                        {isLoading && (
                            <tr><td colSpan={6} className="p-8 text-center text-[#64748B]"><Loader2 className="inline w-4 h-4 animate-spin mr-2" />Loading…</td></tr>
                        )}
                        {!isLoading && rows.length === 0 && (
                            <tr><td colSpan={6} className="p-8 text-center text-[#64748B]">No tickets have missed the deadline. 🎉</td></tr>
                        )}
                        {rows.map((t) => {
                            const alreadyWarned = isWarnedTicket(t);
                            return (
                                <tr key={t.ticket_id} className="hover:bg-[#F8F9FB]">
                                    <td className="px-3 py-3">
                                        <input type="checkbox" checked={selected.has(t.ticket_id)} onChange={() => toggle(t.ticket_id)} />
                                    </td>
                                    <td className="px-3 py-3 font-mono font-medium text-[#16233F] whitespace-nowrap">{t.ticket_number}</td>
                                    <td className="px-3 py-3 min-w-[190px]">
                                        <button
                                            type="button"
                                            onClick={() => setViewTicket(t)}
                                            className="text-left text-[#16233F] font-medium hover:underline"
                                        >
                                            {t.violator?.firstname} {t.violator?.lastname}
                                        </button>
                                        {t.violator?.email
                                            ? <div className="text-xs text-[#64748B] truncate">{t.violator.email}</div>
                                            : <div className="text-xs text-[#C8202F]">No email on file</div>}
                                    </td>
                                    <td className="px-3 py-3 font-bold text-[#C2541F] tabular-nums whitespace-nowrap">{peso(t.balance)}</td>
                                    <td className="px-3 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDay(t.payment_due_at)}</td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => setViewTicket(t)}>
                                                <Eye className="w-3.5 h-3.5 mr-1" /> View
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={!t.violator?.email || warnMut.isLoading || alreadyWarned}
                                                onClick={() => sendTo([t.ticket_id])}
                                                className={alreadyWarned ? 'bg-[#E5F2EA] text-[#1E8449] border-[#1E8449]/30' : ''}
                                            >
                                                {alreadyWarned ? (
                                                    <><CheckCircle className="w-3.5 h-3.5 mr-1" /> Warned</>
                                                ) : (
                                                    <><Mail className="w-3.5 h-3.5 mr-1" /> Warn</>
                                                )}
                                            </Button>
                                        </div>
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

            <ViolatorModal
                ticket={viewTicket}
                onClose={() => setViewTicket(null)}
                onWarn={(ids) => { setViewTicket(null); sendTo(ids); }}
                warning={warnMut.isLoading}
            />
        </div>
    );
};

export default MissedDeadlineTab;