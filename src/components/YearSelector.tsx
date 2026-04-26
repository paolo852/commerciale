import type { Offer } from '../types';
import { getAvailableYears } from '../lib/analytics';

interface YearSelectorProps {
  offers: Offer[];
  value: number | 'all';
  onChange: (value: number | 'all') => void;
  className?: string;
}

export default function YearSelector({ offers, value, onChange, className = '' }: YearSelectorProps) {
  const years = getAvailableYears(offers);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
      className={`px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${className}`}
    >
      <option value="all">Tutti gli anni</option>
      {years.map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
  );
}
