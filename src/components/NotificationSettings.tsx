import { useEffect, useState } from 'react';
import { Mail, Smartphone } from 'lucide-react';
import Modal from './Modal';
import { useNotifications } from '../contexts/NotificationsContext';
import type { NotificationPreferences } from '../types';

interface EventRow {
  key: 'lead_promoted' | 'lead_archived' | 'offer_deadline' | 'concept_status';
  label: string;
}

const EVENTS: EventRow[] = [
  { key: 'lead_promoted',    label: 'Lead promosso a concept' },
  { key: 'lead_archived',    label: 'Lead archiviato' },
  { key: 'offer_deadline',   label: 'Scadenza offerta imminente' },
  { key: 'concept_status',   label: 'Cambio stato concept' },
];

export default function NotificationSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { prefs, updatePrefs } = useNotifications();
  const [local, setLocal] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && prefs) setLocal({ ...prefs });
  }, [open, prefs]);

  if (!local) return null;

  function toggle(field: keyof NotificationPreferences) {
    setLocal((p) => p ? { ...p, [field]: !p[field] } : p);
  }

  async function handleSave() {
    if (!local) return;
    setSaving(true);
    try { await updatePrefs(local); onClose(); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Preferenze notifiche" size="md">
      <div className="space-y-5">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs font-medium text-slate-500 pb-3">Evento</th>
              <th className="text-center text-xs font-medium text-slate-500 pb-3 px-4">
                <div className="flex items-center justify-center gap-1.5">
                  <Smartphone className="w-3 h-3" /> In app
                </div>
              </th>
              <th className="text-center text-xs font-medium text-slate-500 pb-3 px-4">
                <div className="flex items-center justify-center gap-1.5">
                  <Mail className="w-3 h-3" /> Email
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {EVENTS.map(({ key, label }) => {
              const inAppKey = `in_app_${key}` as keyof NotificationPreferences;
              const emailKey = `email_${key}` as keyof NotificationPreferences;
              return (
                <tr key={key}>
                  <td className="py-3 text-slate-700 pr-4">{label}</td>
                  <td className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={local[inAppKey] as boolean}
                      onChange={() => toggle(inAppKey)}
                      className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                    />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={local[emailKey] as boolean}
                      onChange={() => toggle(emailKey)}
                      className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
          <label className="text-sm text-slate-700 flex-1">Avvisa scadenze entro</label>
          <select
            value={local.deadline_days_before}
            onChange={(e) => setLocal((p) => p ? { ...p, deadline_days_before: Number(e.target.value) } : p)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {[3, 7, 14, 30].map((d) => (
              <option key={d} value={d}>{d} giorni</option>
            ))}
          </select>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
          <span className="font-semibold">Notifiche email</span> richiedono la configurazione
          dell'Edge Function Supabase con Resend. Vedi{' '}
          <code className="font-mono bg-amber-100 px-1 rounded">supabase/functions/send-notification-email/</code>.
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">
            Annulla
          </button>
          <button onClick={() => void handleSave()} disabled={saving}
            className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition">
            {saving ? 'Salvataggio…' : 'Salva preferenze'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
