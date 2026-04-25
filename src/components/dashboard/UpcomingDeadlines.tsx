import { useMemo } from 'react';
import type { Offer, ProjectManager } from '../../types';
import { daysUntil, getUpcomingDeadlines } from '../../lib/analytics';
import { formatDate, formatEUR } from '../../lib/format';
import { TypeBadge } from '../Badges';

interface UpcomingDeadlinesProps {
  offers: Offer[];
  projectManagers: ProjectManager[];
  days?: number;
}

export default function UpcomingDeadlines({
  offers,
  projectManagers,
  days = 30,
}: UpcomingDeadlinesProps) {
  const upcoming = useMemo(() => getUpcomingDeadlines(offers, days), [offers, days]);
  const pmById = useMemo(
    () => new Map(projectManagers.map((p) => [p.id, p.name])),
    [projectManagers],
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Scadenze prossime</h2>
        <span className="text-xs text-slate-500">prossimi {days} giorni</span>
      </div>
      {upcoming.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-400 text-center">
          Nessuna scadenza nei prossimi {days} giorni.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Nome</th>
                <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                <th className="text-left px-4 py-2.5 font-medium">PM</th>
                <th className="text-left px-4 py-2.5 font-medium">Scadenza</th>
                <th className="text-right px-4 py-2.5 font-medium">Importo</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((o) => {
                const d = daysUntil(o.deadline);
                const urgent = d <= 7;
                return (
                  <tr key={o.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-medium text-slate-900">{o.name}</td>
                    <td className="px-4 py-2.5"><TypeBadge value={o.type} /></td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {o.project_manager_id ? pmById.get(o.project_manager_id) ?? '—' : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700">{formatDate(o.deadline)}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full border ${
                            urgent
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {d === 0 ? 'oggi' : d === 1 ? 'domani' : `${d} gg`}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-900">
                      {formatEUR(o.budget)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
