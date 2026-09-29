import React from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../contexts/NotificationContext";
import { X, Bell, Ticket, Check, AlertCircle, Info, Wallet, Megaphone } from "lucide-react";

const ICONS = {
  ticket_created: Ticket,
  ticket_paid: Check,
  payment_received: Wallet,
  reminder: AlertCircle,
  announcement: Megaphone,
  default: Bell,
};

const TINTS = {
  ticket_created: { bg: "#E9ECF2", fg: "#16233F" },
  ticket_paid: { bg: "#E5F2EA", fg: "#1E8449" },
  payment_received: { bg: "#E5F2EA", fg: "#1E8449" },
  reminder: { bg: "#FBF1DC", fg: "#92600A" },
  announcement: { bg: "#FBEAE2", fg: "#C2541F" },
  default: { bg: "#F5F6F8", fg: "#64748B" },
};

const NotificationToasts = () => {
  const navigate = useNavigate();
  const { newToasts, dismissToast, markAsRead } = useNotifications();

  if (!newToasts || newToasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[3000] flex flex-col gap-2 max-w-[380px] w-[calc(100vw-2rem)] pointer-events-none">
      <style>{`
        @keyframes temu-toast-in {
          from { opacity: 0; transform: translateX(40px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        .temu-toast { animation: temu-toast-in 0.3s ease-out; }
      `}</style>

      {newToasts.map((toast) => {
        const Icon = ICONS[toast.type] || ICONS.default;
        const tint = TINTS[toast.type] || TINTS.default;

        return (
          <div
            key={toast.notification_id}
            className="temu-toast pointer-events-auto bg-white rounded-xl shadow-2xl border border-[#E9ECF2] overflow-hidden"
          >
            <div className="flex items-start gap-3 p-3.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: tint.bg }}
              >
                <Icon className="w-4.5 h-4.5" style={{ color: tint.fg }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1F2937] leading-tight">
                  {toast.title}
                </p>
                <p className="text-xs text-[#64748B] mt-0.5 line-clamp-2">
                  {toast.message}
                </p>
                <button
                  onClick={() => {
                    markAsRead(toast.notification_id);
                    const id = toast.related_entity_id;
                    if (toast.related_entity_type === "ticket" && id)
                      navigate(`/tickets?id=${id}`);
                    dismissToast(toast.notification_id);
                  }}
                  className="text-[11px] font-medium text-[#2563EB] hover:text-[#1D4ED8] mt-1.5"
                >
                  View details →
                </button>
              </div>
              <button
                onClick={() => dismissToast(toast.notification_id)}
                className="p-1 rounded-md text-[#94A3B8] hover:text-[#1F2937] hover:bg-[#F5F6F8] flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="h-0.5 bg-gradient-to-r from-[#F0B429] via-[#1E8449] to-[#16233F]" />
          </div>
        );
      })}
    </div>
  );
};

export default NotificationToasts;