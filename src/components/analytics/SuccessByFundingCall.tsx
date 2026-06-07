import { useMemo } from 'react';
import type { FundingCall, Offer } from '../../types';
import { computeFundingCallStats } from '../../lib/analytics';
import SuccessRateBars from './SuccessRateBars';

export default function SuccessByFundingCall({ offers, fundingCalls = [] }: { offers: Offer[]; fundingCalls?: FundingCall[] }) {
  const stats = useMemo(() => computeFundingCallStats(offers, fundingCalls), [offers, fundingCalls]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200">
        <h2 className="text-base font-semibold text-slate-900">Tasso di successo per bando</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Offerte finanziate e consulenze collegate a un bando
        </p>
      </div>

      {stats.length === 0 ? (
        <p className="px-5 py-12 text-sm text-slate-400 text-center">
          Nessuna offerta finanziata ancora registrata.
        </p>
      ) : (
        <>
          <div className="px-5 pt-4">
            <SuccessRateBars
              data={stats.map((s) => ({
                label: s.funding_call,
                rate: s.tassoSuccesso,
                totale: s.totale,
              }))}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Bando</th>
                  <th className="text-right px-4 py-2.5 font-medium">Totale</th>
                  <th className="text-right px-4 py-2.5 font-medium">Approvate</th>
                  <th className="text-right px-4 py-2.5 font-medium">Rifiutate</th>
                  <th className="text-right px-4 py-2.5 font-medium">Successo</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.funding_call} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{s.funding_call}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{s.totale}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{s.approvate}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-red-700">{s.rifiutate}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {s.tassoSuccesso === null ? '—' : `${Math.round(s.tassoSuccesso * 100)}%`}
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
