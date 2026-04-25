import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: 'indigo' | 'amber' | 'emerald' | 'sky';
}

const accentClasses: Record<NonNullable<KpiCardProps['accent']>, string> = {
  indigo: 'text-indigo-700',
  amber: 'text-amber-700',
  emerald: 'text-emerald-700',
  sky: 'text-sky-700',
};

export default function KpiCard({ label, value, hint, accent = 'indigo' }: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${accentClasses[accent]}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
