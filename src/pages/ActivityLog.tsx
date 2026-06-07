import { useEffect, useState } from 'react';
import { CheckCircle2, FilePlus, Pencil, Trash2, XCircle } from 'lucide-react';
import { activityLogService } from '../lib/dataService';
import type { ActivityAction, ActivityLogEntry } from '../types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'ora';
  if (m < 60) return `${m} min fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h fa`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}g fa`;
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function actionLabel(action: ActivityAction, entityType: string): string {
  const entity = entityType === 'offer' ? "l'offerta" : entityType;
  switch (action) {
    case 'created':  return `ha creato ${entity}`;
    case 'updated':  return `ha modificato ${entity}`;
    case 'approved': return `ha approvato ${entity}`;
    case 'rejected': return `ha rifiutato ${entity}`;
    case 'deleted':  return `ha eliminato ${entity}`;
  }
}

function ActionIcon({ action }: { action: ActivityAction }) {
  const base = 'w-4 h-4';
  switch (action) {
    case 'created':  return <FilePlus className={`${base} text-indigo-500`} />;
    case 'updated':  return <Pencil className={`${base} text-slate-500`} />;
    case 'approved': return <CheckCircle2 className={`${base} text-emerald-500`} />;
    case 'rejected': return <XCircle className={`${base} text-rose-500`} />;
    case 'deleted':  return <Trash2 className={`${base} text-red-500`} />;
  }
}

function actionBg(action: ActivityAction): string {
  switch (action) {
    case 'created':  return 'bg-indigo-50 border-indigo-100';
    case 'updated':  return 'bg-slate-50 border-slate-200';
    case 'approved': return 'bg-emerald-50 border-emerald-100';
    case 'rejected': return 'bg-rose-50 border-rose-100';
    case 'deleted':  return 'bg-red-50 border-red-100';
  }
}

export default function ActivityLog() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    activityLogService.list(200)
      .then((data) => { setEntries(data); })
      .catch((e: unknown) => { setError((e as { message?: string })?.message ?? 'Errore caricamento log'); })
      .finally(() => { setLoading(false); });
  }, []);

  // Group by day
  const grouped = entries.reduce<{ date: string; items: ActivityLogEntry[] }[]>((acc, entry) => {
    const day = new Date(entry.created_at).toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const last = acc[acc.length - 1];
    if (last?.date === day) { last.items.push(entry); }
    else { acc.push({ date: day, items: [entry] }); }
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Log attività</h1>
        <p className="text-sm text-slate-500 mt-0.5">Cronologia delle operazioni eseguite sul sistema</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Caricamento…</div>
      ) : error ? (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm space-y-1">
          <p className="font-semibold">Impossibile caricare il log delle attività.</p>
          <p className="text-xs">{error}</p>
          <p className="text-xs text-red-500 mt-2">
            Probabilmente la tabella <code className="bg-red-100 px-1 rounded">activity_log</code> non è ancora stata creata.
            Esegui la migrazione <strong>migrate_v30_activity_log.sql</strong> nel SQL Editor di Supabase.
          </p>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          Nessuna attività registrata.<br />
          Le prossime operazioni (crea, modifica, approva, elimina) appariranno qui.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, items }) => (
            <div key={date}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 capitalize">{date}</p>
              <div className="space-y-2">
                {items.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${actionBg(entry.action)}`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <ActionIcon action={entry.action} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800">
                        <span className="font-semibold">{entry.user_name ?? entry.user_email}</span>
                        {' '}{actionLabel(entry.action, entry.entity_type)}{' '}
                        <span className="font-semibold">"{entry.entity_name}"</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{entry.user_email}</p>
                    </div>
                    <span className="text-xs text-slate-400 tabular-nums shrink-0 mt-0.5">
                      {timeAgo(entry.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
