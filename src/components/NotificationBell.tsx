import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, BellRing, CheckCheck, ClipboardCheck, Clock, FileText, FlaskConical, Settings, UserSearch, X,
} from 'lucide-react';
import { useNotifications } from '../contexts/NotificationsContext';
import { formatDate } from '../lib/format';
import type { AppNotification, NotificationType } from '../types';
import NotificationSettings from './NotificationSettings';

const TYPE_CONFIG: Record<NotificationType, { Icon: typeof Bell; color: string }> = {
  lead_promoted:          { Icon: FlaskConical, color: 'bg-emerald-100 text-emerald-600' },
  lead_archived:          { Icon: UserSearch,   color: 'bg-slate-100 text-slate-500' },
  offer_deadline:         { Icon: FileText,      color: 'bg-amber-100 text-amber-600' },
  concept_status_changed: { Icon: FlaskConical,  color: 'bg-indigo-100 text-indigo-600' },
  task_assigned:          { Icon: CheckCheck,    color: 'bg-violet-100 text-violet-600' },
  comment_mention:        { Icon: Clock,         color: 'bg-sky-100 text-sky-600' },
  offer_review_requested: { Icon: ClipboardCheck, color: 'bg-indigo-100 text-indigo-600' },
};

function NotifRow({ n, onRead, onClose }: { n: AppNotification; onRead: (id: string) => void; onClose: () => void }) {
  const navigate = useNavigate();
  const cfg = TYPE_CONFIG[n.type] ?? { Icon: Clock, color: 'bg-slate-100 text-slate-500' };

  function handleClick() {
    onClose();
    if (!n.read) onRead(n.id);
    if (n.entity_id && n.entity_type) {
      const path =
        n.entity_type === 'lead'    ? `/leads/${n.entity_id}` :
        n.entity_type === 'concept' ? `/concepts/${n.entity_id}` : '/offerte';
      navigate(path);
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-slate-50 transition ${!n.read ? 'bg-indigo-50/40' : ''}`}
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${cfg.color}`}>
        <cfg.Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${!n.read ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
          {n.title}
        </p>
        {n.body && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>}
        <p className="text-[11px] text-slate-400 mt-1">{formatDate(n.created_at)}</p>
      </div>
      {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-2" />}
    </button>
  );
}

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);

  return (
    <>
      {/* Click-outside overlay */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={close} />
      )}

      <div ref={panelRef} className="relative z-50">
        <button
          onClick={() => setOpen((o) => !o)}
          title="Notifiche"
          className="relative w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
        >
          {unreadCount > 0 ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-900">
                Notifiche {unreadCount > 0 && <span className="text-indigo-600">({unreadCount})</span>}
              </span>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={() => void markAllRead()}
                    className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-indigo-50 transition"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Tutte lette
                  </button>
                )}
                <button
                  onClick={() => { close(); setShowSettings(true); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  title="Impostazioni notifiche"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={close}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[28rem] overflow-y-auto divide-y divide-slate-50">
              {notifications.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Nessuna notifica</p>
                </div>
              ) : (
                notifications.slice(0, 30).map((n) => (
                  <NotifRow key={n.id} n={n} onRead={markRead} onClose={close} />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <NotificationSettings open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
