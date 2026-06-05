import type {
  Offer,
  DashboardKPIs,
  MonthlyStats,
  FundingCallStats,
  ProjectManagerStats,
  ProjectManager,
} from '../types';

// ============================================================
// Analytics: tutte le aggregazioni partono dall'array di offerte
// in memoria (caricato da useOffersData). Niente query dedicate.
// ============================================================

// ----------------------------------------------------------------
// Helper: anno di riferimento di un'offerta = anno della deadline
// ----------------------------------------------------------------

export function offerYear(o: Offer): number | null {
  const y = o.deadline?.slice(0, 4);
  const n = Number(y);
  return Number.isFinite(n) ? n : null;
}

export function getAvailableYears(offers: Offer[]): number[] {
  const set = new Set<number>();
  for (const o of offers) {
    const y = offerYear(o);
    if (y !== null) set.add(y);
  }
  return Array.from(set).sort((a, b) => b - a);
}

export function filterByYear(offers: Offer[], year: number | 'all'): Offer[] {
  if (year === 'all') return offers;
  return offers.filter((o) => offerYear(o) === year);
}

export function computeKPIs(offers: Offer[]): DashboardKPIs {
  let totalInOfferta = 0;
  let inLavorazione = 0;
  let inAttesaEsito = 0;
  let approvati = 0;
  let rifiutati = 0;
  let ricavoApprovato = 0;

  for (const o of offers) {
    if (o.status === 'presentata' && o.outcome !== 'rifiutato') {
      totalInOfferta += o.budget;
    }
    if (o.status === 'in_lavorazione') inLavorazione++;
    if (o.status === 'presentata' && o.outcome === 'nessuno') inAttesaEsito++;
    if (o.outcome === 'approvato') { approvati++; ricavoApprovato += o.budget; }
    if (o.outcome === 'rifiutato') rifiutati++;
  }

  const decisi = approvati + rifiutati;
  const tassoSuccesso = decisi === 0 ? null : approvati / decisi;

  return { totalInOfferta, inLavorazione, inAttesaEsito, tassoSuccesso, approvati, ricavoApprovato };
}

// ----------------------------------------------------------------
// Previsione probabilistica del fatturato (P10 / P50 / P90)
// ----------------------------------------------------------------

export interface ProbabilisticRevenue {
  confermato: number;    // offerte già approvate
  expected: number;      // valore atteso E[X] = Σ(p_i × budget_i)
  p10: number;           // 10° percentile della distribuzione esatta
  p50: number;           // mediana
  p90: number;           // 90° percentile
  maxPossible: number;   // somma di TUTTI i budget della pipeline (limite superiore)
  pipelineCount: number; // numero offerte attive
  method: 'exact' | 'monte-carlo';
}

const EXACT_LIMIT = 20;       // sopra ~1M combinazioni passiamo a Monte Carlo
const MC_SAMPLES = 50_000;

/**
 * Calcola la distribuzione del fatturato come convoluzione di n distribuzioni
 * Bernoulli (una per offerta): ogni offerta ha probabilità p di contribuire
 * con budget e probabilità (1-p) di contribuire con 0.
 *
 * Per pipeline ≤ 20 offerte usa la distribuzione esatta (2^n combinazioni).
 * Sopra usa Monte Carlo con 50k simulazioni.
 *
 * Il fatturato confermato (outcome='approvato') è additivo a tutti i percentili.
 *
 * Pipeline = offerte con outcome='nessuno' AND status≠'ferma'.
 */
export function computeProbabilisticRevenue(offers: Offer[]): ProbabilisticRevenue {
  const confermato = offers
    .filter((o) => o.outcome === 'approvato')
    .reduce((s, o) => s + o.budget, 0);

  const pipeline = offers.filter(
    (o) => o.outcome === 'nessuno' && o.status !== 'ferma',
  );

  const maxPossible = confermato + pipeline.reduce((s, o) => s + o.budget, 0);
  const expected = confermato + pipeline.reduce(
    (s, o) => s + ((o.probability ?? 50) / 100) * o.budget,
    0,
  );

  if (pipeline.length === 0) {
    return {
      confermato,
      expected: confermato,
      p10: confermato, p50: confermato, p90: confermato,
      maxPossible: confermato,
      pipelineCount: 0,
      method: 'exact',
    };
  }

  const useExact = pipeline.length <= EXACT_LIMIT;
  const { p10, p50, p90 } = useExact
    ? exactPercentiles(pipeline)
    : monteCarloPercentiles(pipeline);

  return {
    confermato,
    expected,
    p10: confermato + p10,
    p50: confermato + p50,
    p90: confermato + p90,
    maxPossible,
    pipelineCount: pipeline.length,
    method: useExact ? 'exact' : 'monte-carlo',
  };
}

/**
 * Convoluzione esatta delle distribuzioni Bernoulli.
 * Parte da {0: 1.0} e per ogni offerta espande la mappa value→prob.
 */
function exactPercentiles(pipeline: Offer[]): { p10: number; p50: number; p90: number } {
  let dist = new Map<number, number>([[0, 1]]);
  for (const o of pipeline) {
    const p = Math.max(0, Math.min(1, (o.probability ?? 50) / 100));
    const next = new Map<number, number>();
    for (const [value, prob] of dist) {
      if (1 - p > 0) {
        next.set(value, (next.get(value) ?? 0) + prob * (1 - p));
      }
      if (p > 0) {
        const newVal = value + o.budget;
        next.set(newVal, (next.get(newVal) ?? 0) + prob * p);
      }
    }
    dist = next;
  }
  return percentilesFromDistribution(dist);
}

function percentilesFromDistribution(
  dist: Map<number, number>,
): { p10: number; p50: number; p90: number } {
  const sorted = Array.from(dist.entries()).sort((a, b) => a[0] - b[0]);
  let cum = 0;
  let p10: number | null = null;
  let p50: number | null = null;
  let p90: number | null = null;
  for (const [value, prob] of sorted) {
    cum += prob;
    if (p10 === null && cum >= 0.10) p10 = value;
    if (p50 === null && cum >= 0.50) p50 = value;
    if (p90 === null && cum >= 0.90) p90 = value;
  }
  // Fallback ai valori estremi se mai null (non dovrebbe succedere)
  const last = sorted[sorted.length - 1]?.[0] ?? 0;
  return {
    p10: p10 ?? sorted[0]?.[0] ?? 0,
    p50: p50 ?? last,
    p90: p90 ?? last,
  };
}

/** Simulazione Monte Carlo per portafogli con > EXACT_LIMIT offerte. */
function monteCarloPercentiles(
  pipeline: Offer[],
): { p10: number; p50: number; p90: number } {
  const samples = new Float64Array(MC_SAMPLES);
  for (let i = 0; i < MC_SAMPLES; i++) {
    let total = 0;
    for (const o of pipeline) {
      const p = (o.probability ?? 50) / 100;
      if (Math.random() < p) total += o.budget;
    }
    samples[i] = total;
  }
  const sorted = Array.from(samples).sort((a, b) => a - b);
  return {
    p10: sorted[Math.floor(0.10 * MC_SAMPLES)],
    p50: sorted[Math.floor(0.50 * MC_SAMPLES)],
    p90: sorted[Math.floor(0.90 * MC_SAMPLES)],
  };
}

// ----------------------------------------------------------------
// Scadenze imminenti
// ----------------------------------------------------------------

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getUpcomingDeadlines(offers: Offer[], days = 365): Offer[] {
  const today = todayISO();
  const limit = addDaysISO(days);
  return offers
    .filter(
      (o) => o.status === 'in_lavorazione' && o.deadline >= today && o.deadline <= limit,
    )
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
}

export function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${iso}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

// ----------------------------------------------------------------
// Statistiche mensili
// ----------------------------------------------------------------

const MONTH_LABELS = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
];

export function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-');
  const idx = Number(m) - 1;
  return `${MONTH_LABELS[idx] ?? '?'} ${y.slice(2)}`;
}

/** Restituisce gli ultimi N mesi (compreso quello corrente) come "YYYY-MM". */
function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const ref = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const yyyy = ref.getFullYear();
    const mm = String(ref.getMonth() + 1).padStart(2, '0');
    out.push(`${yyyy}-${mm}`);
  }
  return out;
}

/** Restituisce i 12 mesi dell'anno specificato come "YYYY-MM". */
function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, '0')}`,
  );
}

/**
 * Aggregazione mensile basata su submitted_at.
 * Se year è specificato, mostra i 12 mesi dell'anno; altrimenti gli ultimi N mesi.
 */
export function computeMonthlyStats(
  offers: Offer[],
  optionsOrMonths: number | { months?: number; year?: number } = 12,
): MonthlyStats[] {
  const months = typeof optionsOrMonths === 'number' ? optionsOrMonths : (optionsOrMonths.months ?? 12);
  const year = typeof optionsOrMonths === 'number' ? undefined : optionsOrMonths.year;
  const keys = year !== undefined ? monthsOfYear(year) : lastNMonths(months);
  return computeMonthlyStatsForKeys(offers, keys);
}

function computeMonthlyStatsForKeys(offers: Offer[], keys: string[]): MonthlyStats[] {
  const buckets = new Map<string, MonthlyStats>();
  for (const m of keys) {
    buckets.set(m, { month: m, presentate: 0, approvate: 0, rifiutate: 0, budgetPresentato: 0 });
  }
  for (const o of offers) {
    if (!o.submitted_at) continue;
    const key = o.submitted_at.slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.presentate++;
    bucket.budgetPresentato += o.budget;
    if (o.outcome === 'approvato') bucket.approvate++;
    if (o.outcome === 'rifiutato') bucket.rifiutate++;
  }
  return Array.from(buckets.values());
}

// ----------------------------------------------------------------
// Distribuzione per stato
// ----------------------------------------------------------------

export interface StatusDistribution {
  in_lavorazione: number;
  presentata: number;
  ferma: number;
}

export function computeStatusDistribution(offers: Offer[]): StatusDistribution {
  const out: StatusDistribution = { in_lavorazione: 0, presentata: 0, ferma: 0 };
  for (const o of offers) out[o.status]++;
  return out;
}

// ----------------------------------------------------------------
// Statistiche per funding call e project manager
// ----------------------------------------------------------------

export function computeFundingCallStats(offers: Offer[]): FundingCallStats[] {
  const map = new Map<string, FundingCallStats>();
  for (const o of offers) {
    if (o.type !== 'financed' || !o.funding_call) continue;
    const key = o.funding_call;
    const cur = map.get(key) ?? {
      funding_call: key,
      totale: 0,
      approvate: 0,
      rifiutate: 0,
      tassoSuccesso: null,
    };
    cur.totale++;
    if (o.outcome === 'approvato') cur.approvate++;
    if (o.outcome === 'rifiutato') cur.rifiutate++;
    map.set(key, cur);
  }
  for (const v of map.values()) {
    const decisi = v.approvate + v.rifiutate;
    v.tassoSuccesso = decisi === 0 ? null : v.approvate / decisi;
  }
  return Array.from(map.values()).sort((a, b) => b.totale - a.totale);
}

export function computeProjectManagerStats(
  offers: Offer[],
  projectManagers: ProjectManager[],
): ProjectManagerStats[] {
  const nameById = new Map(projectManagers.map((p) => [p.id, p.name]));
  const map = new Map<string, ProjectManagerStats & { decidedDays: number[] }>();
  for (const o of offers) {
    if (!o.project_manager_id) continue;
    const id = o.project_manager_id;
    const cur = map.get(id) ?? {
      project_manager_id: id,
      name: nameById.get(id) ?? '—',
      totale: 0,
      approvate: 0,
      rifiutate: 0,
      tassoSuccesso: null,
      tempoMedioDecisione: null,
      decidedDays: [],
    };
    cur.totale++;
    if (o.outcome === 'approvato') cur.approvate++;
    if (o.outcome === 'rifiutato') cur.rifiutate++;
    if (o.submitted_at && o.decided_at) {
      const days =
        (new Date(`${o.decided_at}T00:00:00`).getTime() -
          new Date(`${o.submitted_at}T00:00:00`).getTime()) /
        86_400_000;
      if (days >= 0) cur.decidedDays.push(days);
    }
    map.set(id, cur);
  }

  return Array.from(map.values())
    .map((v) => {
      const decisi = v.approvate + v.rifiutate;
      const tassoSuccesso = decisi === 0 ? null : v.approvate / decisi;
      const tempoMedioDecisione =
        v.decidedDays.length === 0
          ? null
          : v.decidedDays.reduce((a, b) => a + b, 0) / v.decidedDays.length;
      const { decidedDays: _drop, ...rest } = v;
      void _drop;
      return { ...rest, tassoSuccesso, tempoMedioDecisione };
    })
    .sort((a, b) => b.totale - a.totale);
}

/** Tempo medio di decisione globale (giorni). */
export function computeAvgDecisionTime(offers: Offer[]): number | null {
  const days: number[] = [];
  for (const o of offers) {
    if (!o.submitted_at || !o.decided_at) continue;
    const d =
      (new Date(`${o.decided_at}T00:00:00`).getTime() -
        new Date(`${o.submitted_at}T00:00:00`).getTime()) /
      86_400_000;
    if (d >= 0) days.push(d);
  }
  if (days.length === 0) return null;
  return days.reduce((a, b) => a + b, 0) / days.length;
}
