// resources/js/components/notifications/NotificationBell.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../contexts/NotificationContext";
import {
    Bell,
    BellRing,
    Check,
    CheckCheck,
    Trash2,
    Ticket,
    AlertCircle,
    Info,
    Wallet,
    Megaphone,
    RefreshCw,
    Volume2,
    VolumeX,
    Settings,
    X,
    XCircle,
    Clock,
    FileText,
    Calendar,
    MapPin,
    Wifi,
    WifiOff,
    Users,
    UserX,
    UserCheck,
    Key,
    ScanFace,
    Car,
    ShieldAlert,
    Download,
    Database,
    AlertTriangle,
} from "lucide-react";
import { useAlert } from "../ui/AlertProvider";

// ---------- helpers ----------
const ICONS = {
    ticket_created: Ticket,
    ticket_paid: Check,
    ticket_contested: AlertCircle,
    ticket_dismissed: XCircle,
    ticket_partial_paid: Wallet,
    ticket_overdue: Clock,
    ticket_deleted: Trash2,
    repeat_offender: AlertCircle,
    appeal_filed: FileText,
    appeal_decided: Check,
    payment_received: Wallet,
    payment_failed: XCircle,
    payment_refunded: Wallet,
    payment_large: Wallet,
    daily_summary: FileText,
    attendance_late: Clock,
    attendance_missing_timeout: Clock,
    attendance_absent: XCircle,
    attendance_overtime: Clock,
    attendance_flag: AlertCircle,
    reminder: AlertCircle,
    schedule_assigned: Calendar,
    schedule_updated: Calendar,
    schedule_cancelled: XCircle,
    schedule_starting: Clock,
    schedule_missed: XCircle,
    schedule_conflict: AlertCircle,
    duty_location_added: MapPin,
    duty_location_updated: MapPin,
    duty_location_removed: MapPin,
    duty_zone_breach: AlertCircle,
    duty_enforcer_offline: WifiOff,
    user_created: Users,
    user_deactivated: UserX,
    user_activated: UserCheck,
    password_reset: Key,
    face_registered: ScanFace,
    face_registration_failed: XCircle,
    license_expired: AlertCircle,
    license_expiring: Clock,
    violator_created: Users,
    vehicle_created: Car,
    violator_updated: Users,
    enforcer_online: Wifi,
    enforcer_offline: WifiOff,
    location_lost: MapPin,
    location_unauthorized: ShieldAlert,
    report_daily: FileText,
    report_weekly: FileText,
    report_monthly: FileText,
    report_exported: Download,
    announcement: Megaphone,
    settings_changed: Settings,
    system_backup: Database,
    system_alert: AlertTriangle,
    security_alert: ShieldAlert,
    default: Info,
};

const TINTS = {
    ticket_created: { bg: "#E9ECF2", fg: "#16233F" },
    ticket_paid: { bg: "#E5F2EA", fg: "#1E8449" },
    ticket_contested: { bg: "#FBEAE2", fg: "#C2541F" },
    ticket_dismissed: { bg: "#FBE7E9", fg: "#C8202F" },
    ticket_partial_paid: { bg: "#EEF1F5", fg: "#3B5170" },
    ticket_overdue: { bg: "#FBE7E9", fg: "#C8202F" },
    ticket_deleted: { bg: "#F5F6F8", fg: "#64748B" },
    repeat_offender: { bg: "#FBEAE2", fg: "#C2541F" },
    appeal_filed: { bg: "#FBF1DC", fg: "#92600A" },
    appeal_decided: { bg: "#E5F2EA", fg: "#1E8449" },
    payment_received: { bg: "#E5F2EA", fg: "#1E8449" },
    payment_failed: { bg: "#FBE7E9", fg: "#C8202F" },
    payment_refunded: { bg: "#EEF1F5", fg: "#3B5170" },
    payment_large: { bg: "#E5F2EA", fg: "#1E8449" },
    daily_summary: { bg: "#E9ECF2", fg: "#16233F" },
    attendance_late: { bg: "#FBF1DC", fg: "#92600A" },
    attendance_missing_timeout: { bg: "#FBF1DC", fg: "#92600A" },
    attendance_absent: { bg: "#FBE7E9", fg: "#C8202F" },
    attendance_overtime: { bg: "#E5F2EA", fg: "#1E8449" },
    attendance_flag: { bg: "#FBEAE2", fg: "#C2541F" },
    reminder: { bg: "#FBF1DC", fg: "#92600A" },
    schedule_assigned: { bg: "#E9ECF2", fg: "#16233F" },
    schedule_updated: { bg: "#E9ECF2", fg: "#16233F" },
    schedule_cancelled: { bg: "#FBE7E9", fg: "#C8202F" },
    schedule_starting: { bg: "#FBF1DC", fg: "#92600A" },
    schedule_missed: { bg: "#FBE7E9", fg: "#C8202F" },
    schedule_conflict: { bg: "#FBEAE2", fg: "#C2541F" },
    duty_location_added: { bg: "#FBF1DC", fg: "#92600A" },
    duty_location_updated: { bg: "#FBF1DC", fg: "#92600A" },
    duty_location_removed: { bg: "#FBE7E9", fg: "#C8202F" },
    duty_zone_breach: { bg: "#FBEAE2", fg: "#C2541F" },
    duty_enforcer_offline: { bg: "#FBE7E9", fg: "#C8202F" },
    user_created: { bg: "#E5F2EA", fg: "#1E8449" },
    user_deactivated: { bg: "#FBE7E9", fg: "#C8202F" },
    user_activated: { bg: "#E5F2EA", fg: "#1E8449" },
    password_reset: { bg: "#FBF1DC", fg: "#92600A" },
    face_registered: { bg: "#E5F2EA", fg: "#1E8449" },
    face_registration_failed: { bg: "#FBE7E9", fg: "#C8202F" },
    license_expired: { bg: "#FBE7E9", fg: "#C8202F" },
    license_expiring: { bg: "#FBF1DC", fg: "#92600A" },
    violator_created: { bg: "#E9ECF2", fg: "#16233F" },
    vehicle_created: { bg: "#E9ECF2", fg: "#16233F" },
    violator_updated: { bg: "#E9ECF2", fg: "#16233F" },
    enforcer_online: { bg: "#E5F2EA", fg: "#1E8449" },
    enforcer_offline: { bg: "#F5F6F8", fg: "#64748B" },
    location_lost: { bg: "#FBE7E9", fg: "#C8202F" },
    location_unauthorized: { bg: "#FBE7E9", fg: "#C8202F" },
    report_daily: { bg: "#E9ECF2", fg: "#16233F" },
    report_weekly: { bg: "#E9ECF2", fg: "#16233F" },
    report_monthly: { bg: "#E9ECF2", fg: "#16233F" },
    report_exported: { bg: "#E5F2EA", fg: "#1E8449" },
    announcement: { bg: "#FBEAE2", fg: "#C2541F" },
    settings_changed: { bg: "#FBF1DC", fg: "#92600A" },
    system_backup: { bg: "#E9ECF2", fg: "#16233F" },
    system_alert: { bg: "#FBE7E9", fg: "#C8202F" },
    security_alert: { bg: "#FBE7E9", fg: "#C8202F" },
    default: { bg: "#F5F6F8", fg: "#64748B" },
};

const getIcon = (type) => ICONS[type] || ICONS.default;
const getTint = (type) => TINTS[type] || TINTS.default;

const formatRelative = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
};

const dayKey = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
    ).padStart(2, "0")}`;
};

const dayLabel = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yest = new Date();
    yest.setDate(today.getDate() - 1);

    const isSame = (a, b) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    if (isSame(d, today)) return "Today";
    if (isSame(d, yest)) return "Yesterday";
    return d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
    });
};

const MODAL_EXIT_MS = 180;

// ---------- component ----------
const NotificationBell = ({ variant = "light" }) => {
    const navigate = useNavigate();
    const notify = useAlert();
    const {
        notifications,
        unreadCount,
        isLoading,
        lastSyncAt,
        refresh,
        markAsRead,
        markAllAsRead,
        remove,
        clearAll,
        soundEnabled,
        toastEnabled,
        setSoundEnabled,
        setToastEnabled,
    } = useNotifications();

    const [open, setOpen] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [filter, setFilter] = useState("all");
    const panelRef = useRef(null);
    const buttonRef = useRef(null);
    const closeTimerRef = useRef(null);

    const isDark = variant === "dark";

    const openModal = useCallback(() => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
        setShouldRender(true);
        requestAnimationFrame(() => setOpen(true));
    }, []);

    const closeModal = useCallback(() => {
        setOpen(false);
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => {
            setShouldRender(false);
            setShowSettings(false);
        }, MODAL_EXIT_MS);
    }, []);

    const toggleModal = () => (open ? closeModal() : openModal());

    useEffect(() => {
        return () => {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e) => {
            if (
                panelRef.current &&
                !panelRef.current.contains(e.target) &&
                buttonRef.current &&
                !buttonRef.current.contains(e.target)
            ) {
                closeModal();
            }
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open, closeModal]);

    useEffect(() => {
        if (!open) return;

        const onKey = (e) => {
            if (e.key === "Escape") closeModal();
        };
        document.addEventListener("keydown", onKey);

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, closeModal]);

    const grouped = useMemo(() => {
        const list =
            filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications;
        const map = new Map();
        list.forEach((n) => {
            const key = dayKey(n.created_at);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(n);
        });
        return Array.from(map.entries()).map(([key, items]) => ({
            key,
            label: dayLabel(items[0].created_at),
            items,
        }));
    }, [notifications, filter]);

    const handleNotificationClick = async (n) => {
        if (!n.is_read) {
            markAsRead(n.notification_id);
        }

        const type = n.related_entity_type;
        const id = n.related_entity_id;
        if (type === "ticket" && id) navigate(`/tickets?id=${id}`);
        else if (type === "user") navigate(`/users?id=${id}`);
        else if (n.type === "announcement") navigate(`/`);

        closeModal();
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) closeModal();
    };

    const handleClearAll = async () => {
        const ok = await notify.confirm("Clear all notifications?", {
            destructive: true,
            confirmText: "Clear All",
        });
        if (ok) clearAll();
    };

    const animState = open ? "enter" : "exit";

    return (
        <div className="relative">
            <style>{`
        @keyframes temu-bell-shake {
          0%, 100% { transform: rotate(0); }
          10%, 30%, 50%, 70%, 90% { transform: rotate(-10deg); }
          20%, 40%, 60%, 80% { transform: rotate(10deg); }
        }
        .temu-bell-shake { animation: temu-bell-shake 1.2s ease-in-out; }

        @keyframes temu-modal-in {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes temu-modal-out {
          from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          to   { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
        }

        @keyframes temu-backdrop-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes temu-backdrop-out {
          from { opacity: 1; }
          to   { opacity: 0; }
        }

        .temu-backdrop-enter { animation: temu-backdrop-in 220ms ease-out both; }
        .temu-backdrop-exit { animation: temu-backdrop-out 180ms ease-in both; }

        .temu-modal-enter {
          animation: temu-modal-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: opacity, transform;
        }
        .temu-modal-exit {
          animation: temu-modal-out 180ms cubic-bezier(0.4, 0, 1, 1) both;
          will-change: opacity, transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .temu-backdrop-enter,
          .temu-backdrop-exit,
          .temu-modal-enter,
          .temu-modal-exit {
            animation-duration: 0.001ms !important;
          }
        }
      `}</style>

            <button
                ref={buttonRef}
                type="button"
                onClick={toggleModal}
                className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${isDark
                        ? open
                            ? "bg-white/10 text-white"
                            : "text-[#B7C0D8] hover:bg-white/5 hover:text-white"
                        : open
                            ? "bg-[#E9ECF2] text-[#16233F]"
                            : "text-[#64748B] hover:bg-[#F5F6F8] hover:text-[#16233F]"
                    }`}
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                aria-expanded={open}
            >
                {unreadCount > 0 ? (
                    <BellRing className="w-5 h-5 temu-bell-shake" key={unreadCount} />
                ) : (
                    <Bell className="w-5 h-5" />
                )}

                {unreadCount > 0 && (
                    <span
                        className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C8202F] text-white text-[10px] font-bold flex items-center justify-center border-2 shadow ${isDark ? "border-[#16233F]" : "border-white"
                            }`}
                    >
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {shouldRender && (
                <>
                    <div
                        onClick={handleBackdropClick}
                        className={`fixed inset-0 z-[1999] bg-black/40 backdrop-blur-[2px] ${animState === "enter"
                                ? "temu-backdrop-enter"
                                : "temu-backdrop-exit"
                            }`}
                        aria-hidden="true"
                    />

                    <div
                        ref={panelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Notifications"
                        className={`fixed left-1/2 top-1/2 z-[2000] w-[440px] max-w-[calc(100vw-2rem)] max-h-[min(85vh,720px)] bg-white rounded-2xl shadow-2xl border border-[#E9ECF2] overflow-hidden flex flex-col ${animState === "enter"
                                ? "temu-modal-enter"
                                : "temu-modal-exit"
                            }`}
                    >
                        <div className="px-5 py-4 border-b border-[#E9ECF2] bg-[#F8F9FA] flex-shrink-0">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-[#16233F] flex items-center justify-center">
                                        <Bell className="w-4 h-4 text-[#F0B429]" />
                                    </div>
                                    <div>
                                        <h3 className="font-['Oswald'] font-semibold text-[#16233F] text-base leading-tight">
                                            Notifications
                                        </h3>
                                        {unreadCount > 0 && (
                                            <p className="text-[11px] text-[#64748B]">
                                                {unreadCount} unread · {notifications.length}{" "}
                                                total
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setShowSettings((v) => !v)}
                                        className={`p-2 rounded-md transition-colors ${showSettings
                                                ? "bg-[#E9ECF2] text-[#16233F]"
                                                : "text-[#94A3B8] hover:text-[#16233F] hover:bg-[#E9ECF2]"
                                            }`}
                                        title="Notification settings"
                                    >
                                        <Settings className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={refresh}
                                        disabled={isLoading}
                                        className="p-2 rounded-md text-[#94A3B8] hover:text-[#16233F] hover:bg-[#E9ECF2] transition-colors"
                                        title="Refresh"
                                    >
                                        <RefreshCw
                                            className={`w-4 h-4 ${isLoading ? "animate-spin" : ""
                                                }`}
                                        />
                                    </button>
                                    <button
                                        onClick={closeModal}
                                        className="p-2 rounded-md text-[#94A3B8] hover:text-[#1F2937] hover:bg-[#E9ECF2] transition-colors"
                                        title="Close"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {showSettings ? (
                                <div className="pt-3 border-t border-[#E9ECF2] space-y-2.5">
                                    <label className="flex items-center justify-between text-sm text-[#1F2937] cursor-pointer">
                                        <span className="flex items-center gap-2">
                                            {soundEnabled ? (
                                                <Volume2 className="w-4 h-4 text-[#1E8449]" />
                                            ) : (
                                                <VolumeX className="w-4 h-4 text-[#94A3B8]" />
                                            )}
                                            Play sound on new notification
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={soundEnabled}
                                            onChange={(e) => setSoundEnabled(e.target.checked)}
                                            className="accent-[#1E8449] w-4 h-4"
                                        />
                                    </label>
                                    <label className="flex items-center justify-between text-sm text-[#1F2937] cursor-pointer">
                                        <span className="flex items-center gap-2">
                                            <Bell className="w-4 h-4 text-[#16233F]" />
                                            Show popup toast
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={toastEnabled}
                                            onChange={(e) => setToastEnabled(e.target.checked)}
                                            className="accent-[#1E8449] w-4 h-4"
                                        />
                                    </label>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setFilter("all")}
                                        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${filter === "all"
                                                ? "bg-[#16233F] text-white"
                                                : "bg-white text-[#64748B] border border-[#E9ECF2] hover:bg-[#F5F6F8]"
                                            }`}
                                    >
                                        All ({notifications.length})
                                    </button>
                                    <button
                                        onClick={() => setFilter("unread")}
                                        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${filter === "unread"
                                                ? "bg-[#16233F] text-white"
                                                : "bg-white text-[#64748B] border border-[#E9ECF2] hover:bg-[#F5F6F8]"
                                            }`}
                                    >
                                        Unread ({unreadCount})
                                    </button>
                                    <div className="flex-1" />
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={markAllAsRead}
                                            className="text-xs text-[#1E8449] hover:text-[#186B3B] font-medium flex items-center gap-1"
                                        >
                                            <CheckCheck className="w-3.5 h-3.5" />
                                            Mark all read
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {grouped.length === 0 ? (
                                <div className="py-16 text-center">
                                    <Bell className="w-12 h-12 text-[#CBD5E1] mx-auto mb-3" />
                                    <p className="text-sm text-[#64748B] font-medium">
                                        {filter === "unread"
                                            ? "No unread notifications"
                                            : "No notifications yet"}
                                    </p>
                                    <p className="text-xs text-[#94A3B8] mt-1">
                                        You'll see updates here as they arrive
                                    </p>
                                </div>
                            ) : (
                                grouped.map((group) => (
                                    <div key={group.key}>
                                        <div className="sticky top-0 z-10 bg-[#F8F9FA] border-y border-[#E9ECF2] px-5 py-2">
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                                                {group.label}
                                            </span>
                                        </div>
                                        {group.items.map((n) => {
                                            const Icon = getIcon(n.type);
                                            const tint = getTint(n.type);
                                            return (
                                                <div
                                                    key={n.notification_id}
                                                    className={`group relative px-5 py-3.5 border-b border-[#F3F4F6] last:border-b-0 cursor-pointer transition-colors ${n.is_read
                                                            ? "bg-white"
                                                            : "bg-[#EFF6FF]"
                                                        } hover:bg-[#F8F9FA]`}
                                                    onClick={() =>
                                                        handleNotificationClick(n)
                                                    }
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div
                                                            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                                                            style={{
                                                                backgroundColor: tint.bg,
                                                            }}
                                                        >
                                                            <Icon
                                                                className="w-4.5 h-4.5"
                                                                style={{ color: tint.fg }}
                                                            />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start gap-2">
                                                                <p
                                                                    className={`text-sm leading-tight flex-1 ${n.is_read
                                                                            ? "text-[#475569] font-normal"
                                                                            : "text-[#1F2937] font-semibold"
                                                                        }`}
                                                                >
                                                                    {n.title}
                                                                </p>
                                                                {!n.is_read && (
                                                                    <span className="w-2 h-2 rounded-full bg-[#2563EB] flex-shrink-0 mt-1" />
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-[#64748B] mt-1 line-clamp-2">
                                                                {n.message}
                                                            </p>
                                                            <p className="text-[10px] text-[#94A3B8] mt-1.5">
                                                                {formatRelative(n.created_at)}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {!n.is_read && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        markAsRead(
                                                                            n.notification_id,
                                                                        );
                                                                    }}
                                                                    className="p-1.5 rounded-md hover:bg-[#E5F2EA]"
                                                                    title="Mark as read"
                                                                >
                                                                    <Check className="w-3.5 h-3.5 text-[#1E8449]" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    remove(n.notification_id);
                                                                }}
                                                                className="p-1.5 rounded-md hover:bg-[#FBE7E9]"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5 text-[#C8202F]" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="px-5 py-3 border-t border-[#E9ECF2] bg-[#F8F9FA] flex items-center justify-between text-xs flex-shrink-0">
                            <span className="text-[#94A3B8] flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#1E8449] animate-pulse" />
                                Auto-refresh every 20s
                                {lastSyncAt && (
                                    <span className="text-[#CBD5E1]">
                                        · synced {formatRelative(lastSyncAt.toISOString())}
                                    </span>
                                )}
                            </span>
                            {notifications.length > 0 && (
                                <button
                                    onClick={handleClearAll}
                                    className="text-[#C8202F] hover:text-[#A01622] font-medium"
                                >
                                    Clear all
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationBell;