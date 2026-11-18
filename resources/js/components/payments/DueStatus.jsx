// web/src/components/payments/DueStatus.jsx
import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, PauseCircle } from 'lucide-react';
import {
    getDueState,
    formatTimeLeft,
    formatOverdue,
    formatDueDate,
    isWeekendNow,
} from '../../lib/dueTime';

export const DUE_META = {
    on_track: { label: 'On track', color: '#1E8449', chip: 'bg-[#E5F2EA] text-[#1E8449]', Icon: CheckCircle },
    due_soon: { label: 'Due soon', color: '#E67E22', chip: 'bg-[#FDEBD3] text-[#B45309] animate-pulse', Icon: AlertTriangle },
    overdue: { label: 'Overdue', color: '#C8202F', chip: 'bg-[#FBE7E9] text-[#C8202F]', Icon: AlertTriangle },
    none: { label: 'No deadline', color: '#94A3B8', chip: 'bg-[#EEF1F5] text-[#64748B]', Icon: Clock },
};

export const useNow = (intervalMs = 1000) => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
};

/** Indicator sign: green / orange (nearly due) / red (overdue) + deadline date. */
export const DueBadge = ({ ticket, compact = false }) => {
    const now = useNow(30_000);
    const { state } = getDueState(ticket, now);
    const meta = DUE_META[state];
    const Icon = meta.Icon;
    return (
        <div className="min-w-0">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}>
                <Icon className="w-3 h-3" />
                {meta.label}
            </span>
            {!compact && (
                <div className="mt-0.5 text-[11px] text-[#64748B] truncate">
                    {formatDueDate(ticket.payment_due_at)}
                </div>
            )}
        </div>
    );
};

/** Live "time left" countdown (business time; pauses on weekends). */
export const TimeLeft = ({ ticket }) => {
    const now = useNow(1000);
    const { state, secondsLeft, overdueMs } = getDueState(ticket, now);
    const meta = DUE_META[state];

    if (state === 'none') return <span className="text-sm text-[#94A3B8]">—</span>;
    if (state === 'overdue') {
        return (
            <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: meta.color }}>
                −{formatOverdue(overdueMs)}
            </span>
        );
    }
    return (
        <div className="min-w-0">
            <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: meta.color }}>
                {formatTimeLeft(secondsLeft)}
            </span>
            {isWeekendNow(now) && (
                <div className="flex items-center gap-1 text-[10px] text-[#64748B]">
                    <PauseCircle className="w-3 h-3" /> paused (weekend)
                </div>
            )}
        </div>
    );
};