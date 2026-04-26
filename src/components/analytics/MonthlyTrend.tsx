import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Offer } from '../../types';
import { computeMonthlyStats, monthLabel } from '../../lib/analytics';
import { formatEUR } from '../../lib/format';

interface Props { offers: Offer[]; year?: number; }

export default function MonthlyTrend({ offers, year }: Props) {
  const data = useMemo(
    () =>
      computeMonthlyStats(offers, year !== undefined ? { year } : { months: 12 }).map((m) => ({
        ...m,
        label: monthLabel(m.month),
      })),
    [offers, year],
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h2 className="text-base font-semibold text-slate-900 mb-1">
        Trend temporale{year !== undefined ? ` ${year}` : ''}
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        Numero di offerte presentate e budget totale per mese
      </p>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
            <YAxis
              yAxisId="left"
              allowDecimals={false}
              stroke="#6366f1"
              fontSize={12}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#0ea5e9"
              fontSize={12}
              tickFormatter={(v) => {
                if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                return String(v);
              }}
            />
            <Tooltip
              formatter={(value, name) =>
                name === 'Budget' && typeof value === 'number'
                  ? [formatEUR(value), name]
                  : [value as number | string, name]
              }
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              yAxisId="left"
              dataKey="presentate"
              name="Offerte presentate"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="budgetPresentato"
              name="Budget"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
