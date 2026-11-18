// web/src/lib/dueTime.js
// Business-time helpers. Saturday & Sunday don't count toward the 72h deadline.
// Weekends are evaluated in Philippine time (UTC+8) so the result matches the
// server (set APP_TIMEZONE=Asia/Manila) regardless of the browser's timezone.

const DAY = 86_400_000;
const PH_OFFSET = 8 * 3_600_000;

export const DUE_SOON_SECONDS = 24 * 3600; // "nearly due" = 24 business hours or less

export function isWeekendNow(nowMs = Date.now()) {
    const dow = new Date(nowMs + PH_OFFSET).getUTCDay();
    return dow === 0 || dow === 6;
}

/** Seconds between two instants, skipping Saturdays and Sundays. */
export function businessSecondsBetween(fromMs, toMs) {
    if (toMs <= fromMs) return 0;
    let cur = fromMs + PH_OFFSET;
    const end = toMs + PH_OFFSET;
    let total = 0;
    while (cur < end) {
        const nextDay = (Math.floor(cur / DAY) + 1) * DAY;
        const dow = new Date(cur).getUTCDay();
        if (dow === 0 || dow === 6) {
            cur = nextDay;
            continue;
        }
        const seg = Math.min(nextDay, end);
        total += seg - cur;
        cur = seg;
    }
    return Math.floor(total / 1000);
}

/** → { state: 'on_track' | 'due_soon' | 'overdue' | 'none', secondsLeft, overdueMs } */
export function getDueState(ticket, nowMs = Date.now()) {
    if (!ticket?.payment_due_at) return { state: 'none', secondsLeft: null, overdueMs: 0 };
    const due = new Date(ticket.payment_due_at).getTime();
    if (nowMs >= due) return { state: 'overdue', secondsLeft: 0, overdueMs: nowMs - due };
    const secondsLeft = businessSecondsBetween(nowMs, due);
    return {
        state: secondsLeft <= DUE_SOON_SECONDS ? 'due_soon' : 'on_track',
        secondsLeft,
        overdueMs: 0,
    };
}

const pad = (n) => String(n).padStart(2, '0');

/** 1d 04h 12m  (>= 24h)   |   05:12:09  (< 24h) */
export function formatTimeLeft(sec) {
    if (sec == null) return '—';
    if (sec < 86400) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${d}d ${pad(h)}h ${pad(m)}m`;
}

/** Calendar time elapsed since the deadline. */
export function formatOverdue(ms) {
    const totalMin = Math.floor(ms / 60000);
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

export const formatDueDate = (iso) =>
    iso
        ? new Date(iso).toLocaleString('en-PH', {
              timeZone: 'Asia/Manila',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
          })
        : '—';

export const formatDay = (iso) =>
    iso
        ? new Date(iso).toLocaleDateString('en-PH', {
              timeZone: 'Asia/Manila',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
          })
        : '—';