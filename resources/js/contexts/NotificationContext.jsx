import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";
import {
  pollNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearNotifications,
} from "../services/api";

const NotificationContext = createContext(null);

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used inside NotificationProvider");
  }
  return ctx;
};

const POLL_INTERVAL_MS = 20 * 1000; // 20 seconds
const STORAGE_KEY_PREFIX = "temu_notifications_";
const LAST_SEEN_PREFIX = "temu_notifications_last_seen_";
const MAX_CACHED = 300;

// ---------- helpers ----------
const getStorageKey = (userId) => `${STORAGE_KEY_PREFIX}${userId}`;
const getLastSeenKey = (userId) => `${LAST_SEEN_PREFIX}${userId}`;

const loadCached = (userId) => {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed to read cached notifications:", err);
    return [];
  }
};

const saveCached = (userId, list) => {
  if (!userId) return;
  try {
    const trimmed = list.slice(0, MAX_CACHED);
    localStorage.setItem(getStorageKey(userId), JSON.stringify(trimmed));
  } catch (err) {
    console.warn("Failed to save cached notifications:", err);
  }
};

// Merge new notifications into existing list, dedupe by notification_id
const mergeNotifications = (existing, incoming) => {
  const map = new Map();
  [...incoming, ...existing].forEach((n) => {
    if (!n) return;
    const id = n.notification_id;
    if (id != null && !map.has(id)) map.set(id, n);
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );
};

// ---------- provider ----------
export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.user_id;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [newToasts, setNewToasts] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("temu_notif_sound") === "true";
  });
  const [toastEnabled, setToastEnabled] = useState(() => {
    return localStorage.getItem("temu_notif_toast") !== "false";
  });

  const latestServerTimeRef = useRef(null);
  const seenIdsRef = useRef(new Set());
  const isPollingRef = useRef(false);

  // ---------- reset when user changes ----------
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      seenIdsRef.current = new Set();
      latestServerTimeRef.current = null;
      return;
    }
    const cached = loadCached(userId);
    setNotifications(cached);
    setUnreadCount(cached.filter((n) => !n.is_read).length);
    seenIdsRef.current = new Set(
      cached.map((n) => n.notification_id).filter(Boolean),
    );
    // Seed the "since" cursor from the newest cached item so we only pull new ones
    if (cached.length > 0) {
      latestServerTimeRef.current = cached[0].created_at;
    }
  }, [userId]);

  // ---------- sound & toast prefs ----------
  useEffect(() => {
    localStorage.setItem("temu_notif_sound", String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem("temu_notif_toast", String(toastEnabled));
  }, [toastEnabled]);

  // ---------- play sound ----------
  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      // Inline WebAudio chime — no asset needed
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
      setTimeout(() => ctx.close().catch(() => {}), 800);
    } catch (err) {
      console.warn("Notification chime failed:", err);
    }
  }, [soundEnabled]);

  // ---------- poll ----------
  const poll = useCallback(
    async ({ silent = false } = {}) => {
      if (!userId || isPollingRef.current) return;
      isPollingRef.current = true;
      if (!silent) setIsLoading(true);

      try {
        const since = latestServerTimeRef.current;
        const response = await pollNotifications(since);
        const incoming = response?.data?.data || [];
        const serverTime = response?.data?.server_time || new Date().toISOString();

        // Merge with cache
        setNotifications((prev) => {
          const merged = mergeNotifications(prev, incoming);
          saveCached(userId, merged);
          return merged;
        });

        // Detect truly-new ones for toasts (not on first load, only if we had a cursor)
        if (since && incoming.length > 0) {
          const trulyNew = incoming.filter(
            (n) => !seenIdsRef.current.has(n.notification_id),
          );
          if (trulyNew.length > 0) {
            // Mark as seen now
            trulyNew.forEach((n) =>
              seenIdsRef.current.add(n.notification_id),
            );

            // Update unread counter
            setUnreadCount((c) => c + trulyNew.length);

            if (toastEnabled) {
              setNewToasts((prev) => [...trulyNew, ...prev].slice(0, 3));
              trulyNew.forEach((n) => {
                setTimeout(() => {
                  setNewToasts((prev) =>
                    prev.filter((t) => t.notification_id !== n.notification_id),
                  );
                }, 6000);
              });
            }

            playChime();
          }
        } else if (!since) {
          // First load — register existing IDs so they don't toast
          incoming.forEach((n) => seenIdsRef.current.add(n.notification_id));
        }

        // Keep cursor updated
        if (serverTime) latestServerTimeRef.current = serverTime;
        setLastSyncAt(new Date());
      } catch (err) {
        console.warn("Notification poll failed:", err?.message);
      } finally {
        isPollingRef.current = false;
        if (!silent) setIsLoading(false);
      }
    },
    [userId, toastEnabled, playChime],
  );

  // ---------- initial + interval ----------
  useEffect(() => {
    if (!userId) return;

    poll({ silent: false });

    const intervalId = setInterval(() => {
      if (!document.hidden) poll({ silent: true });
    }, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (!document.hidden) poll({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, poll]);

  // ---------- actions ----------
  const markAsRead = useCallback(
    async (id) => {
      // optimistic
      setNotifications((prev) => {
        const next = prev.map((n) =>
          n.notification_id === id ? { ...n, is_read: true } : n,
        );
        saveCached(userId, next);
        return next;
      });
      setUnreadCount((c) => Math.max(0, c - 1));

      try {
        await markNotificationRead(id);
      } catch (err) {
        console.warn("markAsRead failed:", err?.message);
        // revert
        setNotifications((prev) => {
          const next = prev.map((n) =>
            n.notification_id === id ? { ...n, is_read: false } : n,
          );
          saveCached(userId, next);
          return next;
        });
        setUnreadCount((c) => c + 1);
      }
    },
    [userId],
  );

  const markAllAsRead = useCallback(async () => {
    const previous = notifications;
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, is_read: true }));
      saveCached(userId, next);
      return next;
    });
    setUnreadCount(0);

    try {
      await markAllNotificationsRead();
    } catch (err) {
      console.warn("markAllAsRead failed:", err?.message);
      setNotifications(previous);
      saveCached(userId, previous);
      setUnreadCount(previous.filter((n) => !n.is_read).length);
    }
  }, [notifications, userId]);

  const remove = useCallback(
    async (id) => {
      const previous = notifications;
      setNotifications((prev) => {
        const next = prev.filter((n) => n.notification_id !== id);
        saveCached(userId, next);
        return next;
      });
      setUnreadCount((c) =>
        Math.max(
          0,
          c - (previous.find((n) => n.notification_id === id)?.is_read ? 0 : 1),
        ),
      );

      try {
        await deleteNotification(id);
      } catch (err) {
        console.warn("deleteNotification failed:", err?.message);
        setNotifications(previous);
        saveCached(userId, previous);
      }
    },
    [notifications, userId],
  );

  const clearAll = useCallback(async () => {
    const previous = notifications;
    setNotifications([]);
    setUnreadCount(0);
    saveCached(userId, []);

    try {
      await clearNotifications();
    } catch (err) {
      console.warn("clearNotifications failed:", err?.message);
      setNotifications(previous);
      saveCached(userId, previous);
      setUnreadCount(previous.filter((n) => !n.is_read).length);
    }
  }, [notifications, userId]);

  const dismissToast = useCallback((id) => {
    setNewToasts((prev) => prev.filter((t) => t.notification_id !== id));
  }, []);

  // ---------- expose ----------
  const value = {
    notifications,
    unreadCount,
    isLoading,
    lastSyncAt,
    newToasts,
    soundEnabled,
    toastEnabled,
    setSoundEnabled,
    setToastEnabled,
    refresh: () => poll({ silent: false }),
    markAsRead,
    markAllAsRead,
    remove,
    clearAll,
    dismissToast,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;