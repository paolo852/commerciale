import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Offer } from '../../types';
import { computeMonthlyStats, monthLabel } from '../../lib/analytics';

export default function MonthlyChart({ offers }: { offers: Offer[] }) {
  const data = useMemo(() => {
    return computeMonthlyStats(offers, 12).map((m) => ({
      ...m,
      label: monthLabel(m.month),
    }));
  }, [offers]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h2 className="text-base font-semibold text-slate-900 mb-4">
        Andamento mensile (ultimi 12 mesi)
      </h2>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="presentate" name="Presentate" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="approvate" name="Approvate" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="rifiutate" name="Rifiutate" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
