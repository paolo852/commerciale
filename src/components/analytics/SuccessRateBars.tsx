import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface SuccessRateBarsProps {
  data: Array<{ label: string; rate: number | null; totale: number }>;
  height?: number;
}

/**
 * Barre orizzontali con tasso di successo (0–1) per categoria.
 * Le entry senza dati decisi (rate = null) vengono escluse.
 */
export default function SuccessRateBars({ data, height = 280 }: SuccessRateBarsProps) {
  const filtered = data
    .filter((d) => d.rate !== null)
    .map((d) => ({
      label: d.label,
      rate: Math.round((d.rate as number) * 100),
      totale: d.totale,
    }));

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-12">
        Nessun esito ancora registrato.
      </p>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart
          data={filtered}
          layout="vertical"
          margin={{ top: 4, right: 32, bottom: 0, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            stroke="#64748b"
            fontSize={12}
          />
          <YAxis
            type="category"
            dataKey="label"
            stroke="#64748b"
            fontSize={12}
            width={140}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, 'Tasso di successo']}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          />
          <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
            {filtered.map((d) => (
              <Cell
                key={d.label}
                fill={d.rate >= 50 ? '#10b981' : d.rate >= 25 ? '#f59e0b' : '#ef4444'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
