import { useMemo } from 'react';
import type { FundingCall, Offer, ProjectManager } from '../../types';
import { daysUntil, getUpcomingDeadlines } from '../../lib/analytics';
import { formatDate, formatEUR } from '../../lib/format';
import { TypeBadge } from '../Badges';

interface UpcomingDeadlinesProps {
  offers: Offer[];
  projectManagers: ProjectManager[];
  fundingCalls?: FundingCall[];
  days?: number;
}

function deadlineBadge(d: number): { label: string; cls: string } {
  if (d === 0) return { label: 'oggi', cls: 'bg-red-50 text-red-700 border-red-200' };
  if (d === 1) return { label: 'domani', cls: 'bg-red-50 text-red-700 border-red-200' };
  if (d <= 7)  return { label: `${d} gg`, cls: 'bg-red-50 text-red-700 border-red-200' };
  if (d <= 30) return { label: `${d} gg`, cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  const months = Math.round(d / 30);
  return { label: `${months} mes${months === 1 ? 'e' : 'i'}`, cls: 'bg-slate-50 text-slate-500 border-slate-200' };
}

export default function UpcomingDeadlines({
  offers,
  projectManagers,
  fundingCalls = [],
  days = 365,
}: UpcomingDeadlinesProps) {
  const upcoming = useMemo(() => getUpcomingDeadlines(offers, days), [offers, days]);
  const pmById = useMemo(
    () => new Map(projectManagers.map((p) => [p.id, p.name])),
    [projectManagers],
  );
  const fcByCode = useMemo(
    () => new Map(fundingCalls.map((fc) => [fc.code, fc])),
    [fundingCalls],
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Scadenze prossime</h2>
        <span className="text-xs text-slate-500">prossimi 12 mesi</span>
      </div>
      {upcoming.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-400 text-center">
          Nessuna scadenza nei prossimi 12 mesi.
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
                const badge = deadlineBadge(d);
                return (
                  <tr key={o.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-900 block leading-tight">{o.name}</span>
                      {o.type === 'financed' && o.funding_call && (() => {
                        const fc = fcByCode.get(o.funding_call);
                        return (
                          <span className="text-xs text-slate-400 block leading-tight mt-0.5 truncate max-w-[220px]" title={fc ? `${fc.code} — ${fc.name}` : o.funding_call}>
                            {fc ? `${fc.code} — ${fc.name}` : o.funding_call}
                          </span>
                        );
                      })()}
                      {o.type === 'consulting' && o.client && (
                        <span className="text-xs text-slate-400 block leading-tight mt-0.5">{o.client}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5"><TypeBadge value={o.type} /></td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {o.project_manager_id ? pmById.get(o.project_manager_id) ?? '—' : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700">{formatDate(o.deadline)}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${badge.cls}`}>
                          {badge.label}
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
