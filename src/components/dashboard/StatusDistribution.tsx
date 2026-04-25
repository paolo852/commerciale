import { useMemo } from 'react';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { Offer } from '../../types';
import { computeStatusDistribution } from '../../lib/analytics';
import { STATUS_LABELS } from '../Badges';

const COLORS: Record<keyof ReturnType<typeof computeStatusDistribution>, string> = {
  in_lavorazione: '#0ea5e9', // sky
  presentata: '#f59e0b',     // amber
  ferma: '#64748b',          // slate
};

export default function StatusDistribution({ offers }: { offers: Offer[] }) {
  const data = useMemo(() => {
    const dist = computeStatusDistribution(offers);
    return (Object.keys(dist) as Array<keyof typeof dist>)
      .map((k) => ({
        key: k,
        name: STATUS_LABELS[k],
        value: dist[k],
        fill: COLORS[k],
      }))
      .filter((d) => d.value > 0);
  }, [offers]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h2 className="text-base font-semibold text-slate-900 mb-4">Distribuzione per stato</h2>
      {data.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12">Nessun dato disponibile.</p>
      ) : (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
              >
                {data.map((d) => (
                  <Cell key={d.key} fill={d.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
