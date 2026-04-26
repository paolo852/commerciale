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

export function computeKPIs(offers: Offer[]): DashboardKPIs {
  let totalInOfferta = 0;
  let inLavorazione = 0;
  let inAttesaEsito = 0;
  let approvati = 0;
  let rifiutati = 0;

  for (const o of offers) {
    if (o.status === 'presentata' && o.outcome !== 'rifiutato') {
      totalInOfferta += o.budget;
    }
    if (o.status === 'in_lavorazione') inLavorazione++;
    if (o.status === 'presentata' && o.outcome === 'nessuno') inAttesaEsito++;
    if (o.outcome === 'approvato') approvati++;
    if (o.outcome === 'rifiutato') rifiutati++;
  }

  const decisi = approvati + rifiutati;
  const tassoSuccesso = decisi === 0 ? null : approvati / decisi;

  return { totalInOfferta, inLavorazione, inAttesaEsito, tassoSuccesso };
}

// ----------------------------------------------------------------
// Previsione probabilistica del fatturato (P10 / P50 / P90)
// ----------------------------------------------------------------

export interface ProbabilisticRevenue {
  confermato: number;    // offerte già approvate
  p10: number;           // scenario pessimistico (10° percentile)
  p50: number;           // scenario atteso (valore medio)
  p90: number;           // scenario ottimistico (90° percentile)
  pipelineCount: number; // numero offerte attive incluse nel calcolo
}

/**
 * Calcola la distribuzione del fatturato atteso usando l'approssimazione
 * normale (Teorema del Limite Centrale).
 *
 * Vengono incluse le offerte con outcome = 'nessuno' e status != 'ferma'.
 * μ = Σ(p_i × b_i)
 * σ² = Σ(p_i × (1−p_i) × b_i²)
 * P10 = μ − 1.282σ  /  P50 = μ  /  P90 = μ + 1.282σ
 *
 * Al risultato viene sommato il fatturato già confermato (outcome='approvato').
 */
export function computeProbabilisticRevenue(offers: Offer[]): ProbabilisticRevenue {
  const confermato = offers
    .filter((o) => o.outcome === 'approvato')
    .reduce((s, o) => s + o.budget, 0);

  const pipeline = offers.filter(
    (o) => o.outcome === 'nessuno' && o.status !== 'ferma',
  );

  let mu = 0;
  let variance = 0;
  for (const o of pipeline) {
    const p = (o.probability ?? 50) / 100;
    mu += p * o.budget;
    variance += p * (1 - p) * o.budget * o.budget;
  }
  const sigma = Math.sqrt(variance);

  const Z_P10 = 1.282;
  return {
    confermato,
    p10: Math.max(0, confermato + mu - Z_P10 * sigma),
    p50: confermato + mu,
    p90: confermato + mu + Z_P10 * sigma,
    pipelineCount: pipeline.length,
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

export function getUpcomingDeadlines(offers: Offer[], days = 30): Offer[] {
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

/**
 * Aggregazione mensile basata su submitted_at:
 * un'offerta presentata in marzo conta come "presentata" a marzo,
 * e in più "approvata" o "rifiutata" se l'esito esiste.
 */
export function computeMonthlyStats(offers: Offer[], months = 12): MonthlyStats[] {
  const buckets = new Map<string, MonthlyStats>();
  for (const m of lastNMonths(months)) {
    buckets.set(m, {
      month: m,
      presentate: 0,
      approvate: 0,
      rifiutate: 0,
      budgetPresentato: 0,
    });
  }

  for (const o of offers) {
    if (!o.submitted_at) continue;
    const key = o.submitted_at.slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue; // fuori dal range
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
