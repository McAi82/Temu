// web/src/components/ui/AlertProvider.jsx
import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useRef,
    useEffect,
} from "react";
import {
    AlertCircle,
    CheckCircle,
    Info,
    XCircle,
    AlertTriangle,
    X,
} from "lucide-react";
import { Button } from "./button";

const AlertContext = createContext(null);

export const useAlert = () => {
    const ctx = useContext(AlertContext);
    if (!ctx) throw new Error("useAlert must be used inside <AlertProvider>");
    return ctx;
};

const VARIANTS = {
    success: { Icon: CheckCircle, color: "#1E8449", bg: "#E5F2EA", title: "Success" },
    error: { Icon: XCircle, color: "#C8202F", bg: "#FBE7E9", title: "Error" },
    warning: { Icon: AlertTriangle, color: "#92600A", bg: "#FBF1DC", title: "Warning" },
    info: { Icon: Info, color: "#16233F", bg: "#E9ECF2", title: "Info" },
    confirm: { Icon: AlertCircle, color: "#16233F", bg: "#E9ECF2", title: "Please Confirm" },
};

export const AlertProvider = ({ children }) => {
    const [popup, setPopup] = useState(null);
    const [toasts, setToasts] = useState([]);
    const resolveRef = useRef(null);

    const showAlert = useCallback((message, options = {}) => {
        const config =
            typeof options === "string" ? { variant: options } : { variant: "info", ...options };

        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setPopup({
                kind: "alert",
                title: config.title || VARIANTS[config.variant]?.title || "Notice",
                message,
                variant: config.variant || "info",
                confirmText: config.confirmText || "OK",
                cancelText: null,
            });
        });
    }, []);

    const showConfirm = useCallback((message, options = {}) => {
        const config = typeof options === "string" ? { title: options } : options;

        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setPopup({
                kind: "confirm",
                title: config.title || "Please Confirm",
                message,
                variant: config.variant || "confirm",
                confirmText: config.confirmText || "Confirm",
                cancelText: config.cancelText || "Cancel",
                destructive: config.destructive ?? false,
            });
        });
    }, []);

    const showToast = useCallback((message, options = {}) => {
        const config =
            typeof options === "string" ? { variant: options } : { variant: "info", ...options };

        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const duration = config.duration ?? 4000;

        setToasts((prev) => [...prev, { id, message, ...config }].slice(-4));

        if (duration > 0) {
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, duration);
        }

        return id;
    }, []);

    const dismissToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const closePopup = useCallback((value) => {
        setPopup(null);
        if (resolveRef.current) {
            resolveRef.current(value);
            resolveRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!popup) return;
        const onKey = (e) => {
            if (e.key === "Escape") {
                closePopup(popup.kind === "confirm" ? false : true);
            } else if (e.key === "Enter") {
                closePopup(true);
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [popup, closePopup]);

    useEffect(() => {
        if (!popup) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [popup]);

    const api = {
        alert: showAlert,
        confirm: showConfirm,
        success: (msg, opts) => showAlert(msg, { ...opts, variant: "success" }),
        error: (msg, opts) => showAlert(msg, { ...opts, variant: "error" }),
        warning: (msg, opts) => showAlert(msg, { ...opts, variant: "warning" }),
        info: (msg, opts) => showAlert(msg, { ...opts, variant: "info" }),
        toast: showToast,
        toastSuccess: (msg, opts) => showToast(msg, { ...opts, variant: "success" }),
        toastError: (msg, opts) => showToast(msg, { ...opts, variant: "error" }),
        toastWarning: (msg, opts) => showToast(msg, { ...opts, variant: "warning" }),
        toastInfo: (msg, opts) => showToast(msg, { ...opts, variant: "info" }),
        dismissToast,
    };

    return (
        <AlertContext.Provider value={api}>
            {children}
            {popup && <AlertPopup popup={popup} onClose={closePopup} />}
            <ToastStack toasts={toasts} onDismiss={dismissToast} />
        </AlertContext.Provider>
    );
};

const AlertPopup = ({ popup, onClose }) => {
    const variant = VARIANTS[popup.variant] || VARIANTS.info;
    const Icon = variant.Icon;
    const isConfirm = popup.kind === "confirm";

    return (
        <>
            <style>{POPUP_CSS}</style>
            <div
                className="temu-popup-backdrop"
                onMouseDown={(e) => {
                    if (e.target === e.currentTarget) {
                        onClose(isConfirm ? false : true);
                    }
                }}
            >
                <div
                    className="temu-popup-card"
                    role="dialog"
                    aria-modal="true"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        className="temu-popup-close"
                        onClick={() => onClose(isConfirm ? false : true)}
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    <div
                        className="temu-popup-icon"
                        style={{ backgroundColor: variant.bg, color: variant.color }}
                    >
                        <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="temu-popup-title">{popup.title}</h3>
                    <p className="temu-popup-message">{popup.message}</p>
                    <div className="temu-popup-actions">
                        {isConfirm && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onClose(false)}
                                className="flex-1 border-[#CBD5E1] text-[#475569] hover:bg-[#F5F6F8]"
                            >
                                {popup.cancelText}
                            </Button>
                        )}
                        <Button
                            type="button"
                            autoFocus
                            onClick={() => onClose(true)}
                            className="flex-1 text-white"
                            style={{
                                backgroundColor: popup.destructive ? "#C8202F" : "#1E8449",
                            }}
                        >
                            {popup.confirmText}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
};

const ToastStack = ({ toasts, onDismiss }) => {
    if (!toasts.length) return null;

    return (
        <>
            <style>{TOAST_CSS}</style>
            <div className="temu-toast-stack">
                {toasts.map((t) => {
                    const variant = VARIANTS[t.variant] || VARIANTS.info;
                    const Icon = variant.Icon;
                    return (
                        <div
                            key={t.id}
                            className="temu-toast-card"
                            style={{ borderLeftColor: variant.color }}
                        >
                            <div
                                className="temu-toast-icon"
                                style={{ backgroundColor: variant.bg, color: variant.color }}
                            >
                                <Icon className="w-4 h-4" />
                            </div>
                            <p className="temu-toast-message">{t.message}</p>
                            <button
                                type="button"
                                className="temu-toast-close"
                                onClick={() => onDismiss(t.id)}
                                aria-label="Dismiss"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </>
    );
};

const POPUP_CSS = `
  @keyframes temu-popup-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes temu-popup-card-in {
    from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
  .temu-popup-backdrop {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(3px);
    animation: temu-popup-backdrop-in 160ms ease-out both;
  }
  .temu-popup-card {
    position: fixed; left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    width: 420px; max-width: calc(100vw - 2rem);
    background: #ffffff; border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
    padding: 28px 24px 20px; text-align: center;
    animation: temu-popup-card-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .temu-popup-close {
    position: absolute; top: 12px; right: 12px;
    width: 30px; height: 30px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 8px; color: #94A3B8; background: transparent;
    border: none; cursor: pointer;
    transition: background 120ms, color 120ms;
  }
  .temu-popup-close:hover { background: #F1F5F9; color: #1F2937; }
  .temu-popup-icon {
    width: 56px; height: 56px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 16px;
  }
  .temu-popup-title {
    font-family: 'Oswald', sans-serif;
    font-weight: 600; font-size: 18px;
    color: #16233F; margin: 0 0 6px;
  }
  .temu-popup-message {
    font-family: 'Inter', sans-serif; font-size: 14px;
    line-height: 1.5; color: #475569;
    margin: 0 0 22px;
    white-space: pre-line; word-break: break-word;
  }
  .temu-popup-actions { display: flex; gap: 10px; }
`;

const TOAST_CSS = `
  @keyframes temu-toast-in {
    from { opacity: 0; transform: translateX(40px) scale(0.95); }
    to   { opacity: 1; transform: translateX(0) scale(1); }
  }
  .temu-toast-stack {
    position: fixed; top: 16px; right: 16px; z-index: 9998;
    display: flex; flex-direction: column; gap: 8px;
    width: 360px; max-width: calc(100vw - 2rem);
    pointer-events: none;
  }
  .temu-toast-card {
    pointer-events: auto;
    display: flex; align-items: flex-start; gap: 10px;
    background: #ffffff; border-radius: 12px;
    border: 1px solid #E9ECF2; border-left-width: 4px;
    padding: 12px 12px 12px 14px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
    animation: temu-toast-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .temu-toast-icon {
    width: 30px; height: 30px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .temu-toast-message {
    flex: 1; font-family: 'Inter', sans-serif; font-size: 13px;
    line-height: 1.45; color: #1F2937;
    margin: 4px 0 0; word-break: break-word;
    white-space: pre-line;
  }
  .temu-toast-close {
    flex-shrink: 0; width: 24px; height: 24px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 6px; color: #94A3B8;
    background: transparent; border: none; cursor: pointer;
  }
  .temu-toast-close:hover { background: #F1F5F9; color: #1F2937; }
`;