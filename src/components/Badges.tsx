import type { OfferStatus, OfferOutcome, OfferType } from '../types';

// ============================================================
// Badge per status / outcome / type con color coding fisso
// ============================================================

const STATUS_LABELS: Record<OfferStatus, string> = {
  in_lavorazione: 'In lavorazione',
  presentata: 'Presentata',
  ferma: 'Ferma',
};

const STATUS_CLASSES: Record<OfferStatus, string> = {
  in_lavorazione: 'bg-sky-50 text-sky-700 border-sky-200',
  presentata: 'bg-amber-50 text-amber-800 border-amber-200',
  ferma: 'bg-slate-200 text-slate-700 border-slate-300',
};

const OUTCOME_LABELS: Record<OfferOutcome, string> = {
  nessuno: 'In attesa',
  approvato: 'Approvato',
  rifiutato: 'Rifiutato',
  riserva: 'Reserve list',
};

const OUTCOME_CLASSES: Record<OfferOutcome, string> = {
  nessuno: 'bg-slate-50 text-slate-600 border-slate-200',
  approvato: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rifiutato: 'bg-red-50 text-red-700 border-red-200',
  riserva: 'bg-amber-50 text-amber-700 border-amber-200',
};

const TYPE_LABELS: Record<OfferType, string> = {
  financed: 'Finanziata',
  consulting: 'Consulenza',
};

const TYPE_CLASSES: Record<OfferType, string> = {
  financed: 'bg-violet-50 text-violet-700 border-violet-200',
  consulting: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

const baseBadge =
  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap';

export function StatusBadge({ value }: { value: OfferStatus }) {
  return <span className={`${baseBadge} ${STATUS_CLASSES[value]}`}>{STATUS_LABELS[value]}</span>;
}

export function OutcomeBadge({ value }: { value: OfferOutcome }) {
  return <span className={`${baseBadge} ${OUTCOME_CLASSES[value]}`}>{OUTCOME_LABELS[value]}</span>;
}

export function TypeBadge({ value }: { value: OfferType }) {
  return <span className={`${baseBadge} ${TYPE_CLASSES[value]}`}>{TYPE_LABELS[value]}</span>;
}

export const STATUS_OPTIONS: { value: OfferStatus; label: string }[] = [
  { value: 'in_lavorazione', label: STATUS_LABELS.in_lavorazione },
  { value: 'presentata', label: STATUS_LABELS.presentata },
  { value: 'ferma', label: STATUS_LABELS.ferma },
];

export const OUTCOME_OPTIONS: { value: OfferOutcome; label: string }[] = [
  { value: 'nessuno', label: OUTCOME_LABELS.nessuno },
  { value: 'approvato', label: OUTCOME_LABELS.approvato },
  { value: 'riserva', label: OUTCOME_LABELS.riserva },
  { value: 'rifiutato', label: OUTCOME_LABELS.rifiutato },
];

export const TYPE_OPTIONS: { value: OfferType; label: string }[] = [
  { value: 'financed', label: TYPE_LABELS.financed },
  { value: 'consulting', label: TYPE_LABELS.consulting },
];

export { STATUS_LABELS, OUTCOME_LABELS, TYPE_LABELS };
