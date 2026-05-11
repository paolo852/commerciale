import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { notificationsService, notificationPrefsService } from '../lib/dataService';
import { isDemoMode, supabase } from '../lib/supabase';
import type { AppNotification, NotificationPreferences, NotificationType } from '../types';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string;
  entity_id?: string;
  entity_type?: 'lead' | 'concept' | 'offer';
}

// Maps each notification type to its preference keys
const PREF_KEY: Record<NotificationType, {
  in_app: keyof NotificationPreferences;
  email: keyof NotificationPreferences;
}> = {
  lead_promoted:          { in_app: 'in_app_lead_promoted',  email: 'email_lead_promoted' },
  lead_archived:          { in_app: 'in_app_lead_archived',  email: 'email_lead_archived' },
  offer_deadline:         { in_app: 'in_app_offer_deadline', email: 'email_offer_deadline' },
  concept_status_changed: { in_app: 'in_app_concept_status', email: 'email_concept_status' },
};

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  prefs: NotificationPreferences | null;
  notify: (input: NotifyInput) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  updatePrefs: (patch: Partial<NotificationPreferences>) => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [notifs, p] = await Promise.all([
        notificationsService.list(user.id),
        notificationPrefsService.get(user.id),
      ]);
      setNotifications(notifs);
      setPrefs(p);
    } catch { /* silent */ }
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Poll every 60 s + Supabase Realtime in production
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => void refresh(), 60_000);
    const sb = !isDemoMode ? supabase : null;
    if (sb) {
      const channel = sb
        .channel(`notif:${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          setNotifications((prev) => [payload.new as AppNotification, ...prev]);
        })
        .subscribe();
      return () => {
        clearInterval(timer);
        void sb.removeChannel(channel);
      };
    }
    return () => clearInterval(timer);
  }, [user, refresh]);

  const notify = useCallback(async (input: NotifyInput) => {
    if (!user || !prefs) return;
    const keys = PREF_KEY[input.type];
    if (!prefs[keys.in_app]) return;

    const notif = await notificationsService.create({
      user_id: user.id,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entity_id: input.entity_id ?? null,
      entity_type: input.entity_type ?? null,
      read: false,
    });
    setNotifications((prev) => [notif, ...prev]);

    if (prefs[keys.email] && !isDemoMode && supabase) {
      void supabase.functions.invoke('send-notification-email', {
        body: { to: user.email, subject: input.title, body: input.body ?? input.title },
      }).catch(() => { /* non-critical */ });
    }
  }, [user, prefs]);

  const markRead = useCallback(async (id: string) => {
    await notificationsService.markRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await notificationsService.markAllRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [user]);

  const updatePrefs = useCallback(async (patch: Partial<NotificationPreferences>) => {
    if (!user) return;
    const updated = await notificationPrefsService.update(user.id, patch);
    setPrefs(updated);
  }, [user]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo<NotificationsContextValue>(() => ({
    notifications, unreadCount, prefs, notify, markRead, markAllRead, updatePrefs, refresh,
  }), [notifications, unreadCount, prefs, notify, markRead, markAllRead, updatePrefs, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
