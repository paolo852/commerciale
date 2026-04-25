import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: LucideIcon;
  accent?: 'indigo' | 'amber' | 'emerald' | 'sky';
}

const styles: Record<NonNullable<KpiCardProps['accent']>, { bar: string; icon: string; iconBg: string; value: string }> = {
  indigo: {
    bar: 'bg-indigo-500',
    iconBg: 'bg-indigo-50',
    icon: 'text-indigo-600',
    value: 'text-indigo-700',
  },
  amber: {
    bar: 'bg-amber-500',
    iconBg: 'bg-amber-50',
    icon: 'text-amber-600',
    value: 'text-amber-700',
  },
  emerald: {
    bar: 'bg-emerald-500',
    iconBg: 'bg-emerald-50',
    icon: 'text-emerald-600',
    value: 'text-emerald-700',
  },
  sky: {
    bar: 'bg-sky-500',
    iconBg: 'bg-sky-50',
    icon: 'text-sky-600',
    value: 'text-sky-700',
  },
};

export default function KpiCard({ label, value, hint, icon: Icon, accent = 'indigo' }: KpiCardProps) {
  const s = styles[accent];
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className={`h-1 ${s.bar}`} />
      <div className="px-5 py-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400">{label}</p>
            <p className={`mt-2 text-3xl font-bold tabular-nums ${s.value}`}>{value}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-5 h-5 ${s.icon}`} />
          </div>
        </div>
        {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}
