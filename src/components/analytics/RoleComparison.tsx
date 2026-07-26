import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Offer, PartnerRole } from '../../types';
import { formatEUR } from '../../lib/format';

interface RoleStats {
  role: PartnerRole;
  label: string;
  totale: number;
  presentate: number;
  approvate: number;
  rifiutate: number;
  budget: number;
  budgetApprovato: number;
  tassoSuccesso: number | null;
}

const ROLE_LABELS: Record<PartnerRole, string> = {
  leader: 'Leader',
  invited: 'Invitato',
};

const COLOR_BY_ROLE: Record<PartnerRole, string> = {
  leader: '#6366f1',   // indigo
  invited: '#f59e0b',  // amber
};

function compute(offers: Offer[]): RoleStats[] {
  const roles: PartnerRole[] = ['leader', 'invited'];
  return roles.map((role) => {
    const subset = offers.filter((o) => (o.partner_role ?? 'leader') === role);
    const approvate = subset.filter((o) => o.outcome === 'approvato').length;
    const rifiutate = subset.filter((o) => o.outcome === 'rifiutato').length;
    const decisi = approvate + rifiutate;
    return {
      role,
      label: ROLE_LABELS[role],
      totale: subset.length,
      presentate: subset.filter((o) => o.status === 'presentata').length,
      approvate,
      rifiutate,
      budget: subset.reduce((acc, o) => acc + o.budget, 0),
      budgetApprovato: subset.filter((o) => o.outcome === 'approvato').reduce((acc, o) => acc + o.budget, 0),
      tassoSuccesso: decisi === 0 ? null : approvate / decisi,
    };
  });
}

export default function RoleComparison({ offers }: { offers: Offer[] }) {
  const stats = useMemo(() => compute(offers), [offers]);

  const volumeData = stats.map((s) => ({
    label: s.label,
    Totale: s.totale,
    Approvate: s.approvate,
    Rifiutate: s.rifiutate,
    fill: COLOR_BY_ROLE[s.role],
  }));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200">
        <h2 className="text-base font-semibold text-slate-900">
          Confronto ruolo consorzio: Leader vs Invitato
        </h2>
      </div>

      <div className="px-5 pt-5">
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={volumeData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
              <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                }}
              />
              <Bar dataKey="Totale" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Approvate" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Rifiutate" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Ruolo</th>
              <th className="text-right px-4 py-2.5 font-medium">Totale</th>
              <th className="text-right px-4 py-2.5 font-medium">Presentate</th>
              <th className="text-right px-4 py-2.5 font-medium">Approvate</th>
              <th className="text-right px-4 py-2.5 font-medium">Rifiutate</th>
              <th className="text-right px-4 py-2.5 font-medium">Budget tot.</th>
              <th className="text-right px-4 py-2.5 font-medium">Ricavo approvate</th>
              <th className="text-right px-4 py-2.5 font-medium">Successo</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.role} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: COLOR_BY_ROLE[s.role] }}
                    />
                    {s.label}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{s.totale}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{s.presentate}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{s.approvate}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-red-700">{s.rifiutate}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatEUR(s.budget)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{formatEUR(s.budgetApprovato)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                  {s.tassoSuccesso === null ? '—' : `${Math.round(s.tassoSuccesso * 100)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
