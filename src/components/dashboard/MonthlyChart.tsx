import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Offer } from '../../types';

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

function shortLabel(yyyymm: string): string {
  return MONTH_LABELS[Number(yyyymm.slice(5, 7)) - 1] ?? '?';
}

interface MonthData {
  month: string;
  label: string;
  in_preparazione: number;
  sottomesse: number;
  approvate: number;
  rifiutate: number;
  isCurrent: boolean;
}

function computeData(offers: Offer[], year: number): MonthData[] {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const keys = monthsOfYear(year);
  const buckets = new Map<string, MonthData>(
    keys.map((k) => [k, {
      month: k, label: shortLabel(k),
      in_preparazione: 0, sottomesse: 0, approvate: 0, rifiutate: 0,
      isCurrent: k === currentMonth,
    }]),
  );

  for (const o of offers) {
    // Sottomesse: by submitted_at
    if (o.submitted_at) {
      const b = buckets.get(o.submitted_at.slice(0, 7));
      if (b) {
        b.sottomesse++;
        if (o.outcome === 'approvato') b.approvate++;
        if (o.outcome === 'rifiutato') b.rifiutate++;
      }
    }
    // In preparazione: by deadline, only status in_lavorazione
    if (o.status === 'in_lavorazione' && o.deadline) {
      const b = buckets.get(o.deadline.slice(0, 7));
      if (b) b.in_preparazione++;
    }
  }

  return Array.from(buckets.values());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const prep = (payload.find((p: { dataKey: string }) => p.dataKey === 'in_preparazione')?.value ?? 0) as number;
  const sott = (payload.find((p: { dataKey: string }) => p.dataKey === 'sottomesse')?.value ?? 0) as number;
  const appr = (payload[0]?.payload?.approvate ?? 0) as number;
  const rif  = (payload[0]?.payload?.rifiutate ?? 0) as number;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs space-y-1.5 min-w-[160px]">
      <p className="font-semibold text-slate-700 border-b border-slate-100 pb-1.5 mb-1.5">{label}</p>
      {prep > 0 && (
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-sky-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 inline-block" />
            In preparazione
          </span>
          <span className="font-semibold tabular-nums text-slate-800">{prep}</span>
        </div>
      )}
      {sott > 0 && (
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-amber-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
            Sottomesse
          </span>
          <span className="font-semibold tabular-nums text-slate-800">{sott}</span>
        </div>
      )}
      {appr > 0 && (
        <div className="flex items-center justify-between gap-4 text-emerald-600 pl-4">
          <span>di cui approvate</span>
          <span className="font-semibold tabular-nums">{appr}</span>
        </div>
      )}
      {rif > 0 && (
        <div className="flex items-center justify-between gap-4 text-red-500 pl-4">
          <span>di cui rifiutate</span>
          <span className="font-semibold tabular-nums">{rif}</span>
        </div>
      )}
      {prep === 0 && sott === 0 && (
        <p className="text-slate-400 italic">Nessuna offerta</p>
      )}
    </div>
  );
}

export default function MonthlyChart({ offers }: { offers: Offer[] }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const data = useMemo(() => computeData(offers, year), [offers, year]);

  const totSottomesse   = data.reduce((s, d) => s + d.sottomesse, 0);
  const totPreparazione = data.reduce((s, d) => s + d.in_preparazione, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Offerte per mese</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {totSottomesse > 0 && <><span className="text-amber-500 font-medium">{totSottomesse}</span> sottomesse</>}
            {totSottomesse > 0 && totPreparazione > 0 && ' · '}
            {totPreparazione > 0 && <><span className="text-sky-500 font-medium">{totPreparazione}</span> in preparazione</>}
            {totSottomesse === 0 && totPreparazione === 0 && 'Nessuna offerta registrata'}
          </p>
        </div>

        {/* Year navigator */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 shrink-0">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:shadow-sm transition"
            aria-label="Anno precedente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2.5 text-sm font-bold text-slate-800 tabular-nums select-none">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:shadow-sm transition"
            aria-label="Anno successivo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
            <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(v) =>
                v === 'in_preparazione' ? 'In preparazione (deadline nel mese)' :
                v === 'sottomesse' ? 'Sottomesse' : v}
            />
            <Bar dataKey="in_preparazione" name="in_preparazione" radius={[4, 4, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.month} fill={d.isCurrent ? '#0ea5e9' : '#7dd3fc'} />
              ))}
            </Bar>
            <Bar dataKey="sottomesse" name="sottomesse" radius={[4, 4, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.month} fill={d.isCurrent ? '#f59e0b' : '#fcd34d'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-slate-400 mt-3">
        "In preparazione" = offerte in lavorazione con deadline nel mese · Mese corrente evidenziato
      </p>
    </div>
  );
}
