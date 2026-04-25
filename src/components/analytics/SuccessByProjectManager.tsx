import { useMemo } from 'react';
import type { Offer, ProjectManager } from '../../types';
import { computeProjectManagerStats } from '../../lib/analytics';
import SuccessRateBars from './SuccessRateBars';

interface Props {
  offers: Offer[];
  projectManagers: ProjectManager[];
}

export default function SuccessByProjectManager({ offers, projectManagers }: Props) {
  const stats = useMemo(
    () => computeProjectManagerStats(offers, projectManagers),
    [offers, projectManagers],
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200">
        <h2 className="text-base font-semibold text-slate-900">
          Tasso di successo per project manager
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Aggregato su tutte le offerte assegnate
        </p>
      </div>

      {stats.length === 0 ? (
        <p className="px-5 py-12 text-sm text-slate-400 text-center">
          Nessun project manager con offerte assegnate.
        </p>
      ) : (
        <>
          <div className="px-5 pt-4">
            <SuccessRateBars
              data={stats.map((s) => ({
                label: s.name,
                rate: s.tassoSuccesso,
                totale: s.totale,
              }))}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Project Manager</th>
                  <th className="text-right px-4 py-2.5 font-medium">Totale</th>
                  <th className="text-right px-4 py-2.5 font-medium">Approvate</th>
                  <th className="text-right px-4 py-2.5 font-medium">Rifiutate</th>
                  <th className="text-right px-4 py-2.5 font-medium">Successo</th>
                  <th className="text-right px-4 py-2.5 font-medium">Tempo medio</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.project_manager_id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-medium text-slate-900">{s.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{s.totale}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{s.approvate}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-red-700">{s.rifiutate}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {s.tassoSuccesso === null ? '—' : `${Math.round(s.tassoSuccesso * 100)}%`}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                      {s.tempoMedioDecisione === null
                        ? '—'
                        : `${Math.round(s.tempoMedioDecisione)} gg`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
