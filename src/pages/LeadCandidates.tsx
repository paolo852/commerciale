import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive, CheckCircle2, ChevronDown, ChevronRight, Clock,
  FlaskConical, Link2, Percent, Plus, Search, TrendingUp, User, UserSearch, X,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import { leadCandidatesService, leadUpdatesService, conceptsService } from '../lib/dataService';
import { useOffersData } from '../hooks/useOffersData';
import { formatDate } from '../lib/format';
import LeadCandidateFormModal from '../components/leads/LeadCandidateFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import type { Concept, FundingCall, LeadCandidate, LeadCandidateStatus, ProjectManager } from '../types';

const STATUS_MAP: Record<LeadCandidateStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  attivo:    { label: 'Attivo',     cls: 'bg-sky-50 text-sky-700 border-sky-200',             Icon: Clock },
  promosso:  { label: 'Promosso',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  archiviato:{ label: 'Archiviato', cls: 'bg-slate-50 text-slate-500 border-slate-200',       Icon: Archive },
};

const NEW_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;
function isNewLead(l: LeadCandidate) {
  return Date.now() - new Date(l.created_at).getTime() < NEW_THRESHOLD_MS;
}

type FilterTab = 'attivo' | 'all' | 'archiviato';

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, Icon, color }: {
  label: string; value: string | number; sub?: string; Icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

// ── Deadline pill ─────────────────────────────────────────────────────────────
function DeadlinePill({ isoDate }: { isoDate: string }) {
  const days = Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86_400_000);
  const past = days < 0;
  const urgent = !past && days <= 14;
  const soon = !past && !urgent && days <= 30;
  const [text, chip] = past
    ? ['text-red-600', 'bg-red-50 text-red-700']
    : urgent
    ? ['text-amber-600', 'bg-amber-50 text-amber-700']
    : soon
    ? ['text-yellow-700', 'bg-yellow-50 text-yellow-700']
    : ['text-slate-600', 'bg-slate-100 text-slate-500'];
  const label = past ? `${Math.abs(days)}g fa` : days === 0 ? 'oggi!' : `tra ${days}g`;
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-semibold tabular-nums ${text}`}>{isoDate}</span>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums ${chip}`}>{label}</span>
    </div>
  );
}

// ── Lead stats pills (attivo/promosso/archiviato count) ───────────────────────
function LeadStatsPills({ attivo, promosso, archiviato }: { attivo: number; promosso: number; archiviato: number }) {
  return (
    <div className="flex items-center justify-center gap-1 flex-wrap">
      {attivo > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-sky-700 bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded-md tabular-nums">
          <Clock className="w-2.5 h-2.5" />{attivo}
        </span>
      )}
      {promosso > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md tabular-nums">
          <CheckCircle2 className="w-2.5 h-2.5" />{promosso}
        </span>
      )}
      {archiviato > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md tabular-nums">
          <Archive className="w-2.5 h-2.5" />{archiviato}
        </span>
      )}
      {attivo === 0 && promosso === 0 && archiviato === 0 && (
        <span className="text-slate-300 text-xs">—</span>
      )}
    </div>
  );
}

// ── Lead row (inside expanded bando or no-bando section) ─────────────────────
interface LeadRowProps {
  lead: LeadCandidate;
  pm: ProjectManager | undefined;
  lastUpdate: { created_at: string; author_name: string } | undefined;
  onNavigate: () => void;
  showAssign?: boolean;
  isAssigning: boolean;
  fundingCalls: FundingCall[];
  assignFcId: string;
  onStartAssign: () => void;
  onChangeAssignFc: (id: string) => void;
  onConfirmAssign: () => void;
  onCancelAssign: () => void;
}

function LeadRow({
  lead, pm, lastUpdate, onNavigate, showAssign,
  isAssigning, fundingCalls, assignFcId, onStartAssign, onChangeAssignFc, onConfirmAssign, onCancelAssign,
}: LeadRowProps) {
  const leadIsNew = isNewLead(lead);
  const { label, cls, Icon: StatusIcon } = STATUS_MAP[lead.status];

  if (isAssigning) {
    return (
      <div className="flex items-center gap-2 px-5 py-2.5 border-t border-slate-100 bg-indigo-50/40">
        <div className="w-6 shrink-0" />
        <select
          autoFocus value={assignFcId} onChange={e => onChangeAssignFc(e.target.value)}
          className="flex-1 text-xs px-2 py-1.5 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        >
          <option value="">— Seleziona bando —</option>
          {fundingCalls.map(fc => <option key={fc.id} value={fc.id}>{fc.code} — {fc.name}</option>)}
        </select>
        <button onClick={onConfirmAssign} disabled={!assignFcId}
          className="px-2.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition">✓</button>
        <button onClick={onCancelAssign}
          className="px-2.5 py-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">✕</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-slate-100 hover:bg-indigo-50/20 transition group">
      <div className="w-5 shrink-0 flex items-center justify-center opacity-40">
        <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
      </div>

      <button className="flex-1 flex items-center gap-3 min-w-0 text-left" onClick={onNavigate}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-800 truncate">{lead.researcher_name}</span>
            {leadIsNew && (
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-600 text-white shrink-0">New</span>
            )}
          </div>
          {lead.institution && <span className="text-xs text-slate-400 truncate block">{lead.institution}</span>}
        </div>

        <span className={`hidden sm:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border shrink-0 ${cls}`}>
          <StatusIcon className="w-3 h-3" />{label}
        </span>

        {pm ? (
          <div className="hidden md:flex items-center gap-1.5 w-28 shrink-0">
            <Avatar name={pm.name} url={pm.avatar_url} size="xs" />
            <span className="text-xs text-slate-600 truncate">{pm.name}</span>
          </div>
        ) : <div className="hidden md:block w-28 shrink-0" />}

        {lastUpdate ? (
          <div className="hidden lg:flex items-center gap-1 w-24 shrink-0">
            <Clock className="w-3 h-3 text-slate-300 shrink-0" />
            <span className="text-xs text-slate-400">{formatDate(lastUpdate.created_at)}</span>
          </div>
        ) : <div className="hidden lg:block w-24 shrink-0" />}

        {lead.keywords && lead.keywords.length > 0 && (
          <div className="hidden xl:flex items-center gap-1 max-w-36 shrink-0">
            {lead.keywords.slice(0, 2).map(kw => (
              <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 truncate max-w-16">{kw}</span>
            ))}
            {lead.keywords.length > 2 && <span className="text-[10px] text-slate-400">+{lead.keywords.length - 2}</span>}
          </div>
        )}

        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition shrink-0" />
      </button>

      {showAssign && (
        <button
          onClick={e => { e.stopPropagation(); onStartAssign(); }}
          className="hidden sm:flex items-center gap-1 text-xs font-medium text-indigo-500 border border-dashed border-indigo-200 px-2 py-1 rounded-lg hover:border-indigo-400 hover:text-indigo-700 transition shrink-0"
        >
          <Link2 className="w-3 h-3" />
          Assegna
        </button>
      )}
    </div>
  );
}

// ── Table column header ───────────────────────────────────────────────────────
function TableHeader() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
      <div className="w-5 shrink-0" />
      <div className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Bando</div>
      <div className="w-36 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">Fase lead</div>
      <div className="w-14 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 shrink-0 hidden lg:block">Concept</div>
      <div className="w-16 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 shrink-0 hidden lg:block">Offerte</div>
      <div className="w-36 text-[11px] font-semibold uppercase tracking-wider text-slate-400 shrink-0 hidden lg:block">Scadenza bando</div>
      <div className="w-14 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 shrink-0 hidden lg:block">Tasso</div>
      <div className="w-5 shrink-0" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LeadCandidates() {
  const navigate = useNavigate();
  const { fundingCalls, offers, projectManagers } = useOffersData();
  const pmById = useMemo(() => new Map(projectManagers.map(p => [p.id, p])), [projectManagers]);
  const fcById = useMemo(() => new Map(fundingCalls.map(fc => [fc.id, fc])), [fundingCalls]);

  const [leads, setLeads] = useState<LeadCandidate[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [lastLeadUpdate, setLastLeadUpdate] = useState<Map<string, { created_at: string; author_name: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>('attivo');
  const [search, setSearch] = useState('');
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  const [expandedNoBando, setExpandedNoBando] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<LeadCandidate | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignFcId, setAssignFcId] = useState('');
  const [filterPmId, setFilterPmId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [ls, cs, llu] = await Promise.all([
        leadCandidatesService.list(),
        conceptsService.list(),
        leadUpdatesService.latestPerLead(),
      ]);
      setLeads(ls);
      setConcepts(cs);
      setLastLeadUpdate(llu);
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Errore caricamento');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const counts = useMemo(() => ({
    attivo:    leads.filter(l => l.status === 'attivo').length,
    promosso:  leads.filter(l => l.status === 'promosso').length,
    archiviato:leads.filter(l => l.status === 'archiviato').length,
  }), [leads]);

  const promotionRate = useMemo(() => {
    const c = counts.promosso + counts.archiviato;
    return c > 0 ? Math.round(counts.promosso / c * 100) : null;
  }, [counts]);

  // Per-call stats from ALL leads (independent of tab/search/PM filter)
  const callStats = useMemo(() => {
    const map = new Map<string, { attivo: number; promosso: number; archiviato: number; allLeads: LeadCandidate[] }>();
    for (const l of leads) {
      if (!l.funding_call_id) continue;
      const s = map.get(l.funding_call_id) ?? { attivo: 0, promosso: 0, archiviato: 0, allLeads: [] };
      if (l.status === 'attivo') s.attivo++;
      else if (l.status === 'promosso') s.promosso++;
      else s.archiviato++;
      s.allLeads.push(l);
      map.set(l.funding_call_id, s);
    }
    return map;
  }, [leads]);

  // Leads visible in sub-rows (tab + search + PM filter)
  const filteredLeads = useMemo(() => {
    let result = tab === 'attivo'    ? leads.filter(l => l.status === 'attivo')
                : tab === 'archiviato' ? leads.filter(l => l.status === 'archiviato')
                : leads;
    if (filterPmId === '__none__') result = result.filter(l => !l.pm_id);
    else if (filterPmId) result = result.filter(l => l.pm_id === filterPmId);
    if (!search.trim()) return result;
    const q = search.toLowerCase();
    return result.filter(l =>
      l.researcher_name.toLowerCase().includes(q) ||
      (l.institution?.toLowerCase().includes(q) ?? false),
    );
  }, [leads, tab, search, filterPmId]);

  // Bando groups based on filtered leads (sub-rows), but stats from callStats
  const bandoGroups = useMemo(() => {
    const map = new Map<string, { fcId: string; fc: FundingCall | undefined; subLeads: LeadCandidate[] }>();
    for (const l of filteredLeads) {
      if (!l.funding_call_id) continue;
      const fcId = l.funding_call_id;
      const g = map.get(fcId) ?? { fcId, fc: fcById.get(fcId), subLeads: [] };
      g.subLeads.push(l);
      map.set(fcId, g);
    }
    return [...map.values()].sort((a, b) => {
      const da = a.fc?.deadline ?? '9999-12-31';
      const db = b.fc?.deadline ?? '9999-12-31';
      if (da !== db) return da.localeCompare(db);
      return (a.fc?.name ?? '').localeCompare(b.fc?.name ?? '', 'it');
    });
  }, [filteredLeads, fcById]);

  const leadsWithoutBando = useMemo(() => filteredLeads.filter(l => !l.funding_call_id), [filteredLeads]);

  const activePms = useMemo(() => {
    const ids = new Set(leads.map(l => l.pm_id).filter(Boolean) as string[]);
    return projectManagers.filter(pm => ids.has(pm.id));
  }, [leads, projectManagers]);

  const hasUnassigned = useMemo(() => leads.some(l => !l.pm_id), [leads]);

  async function handleDelete() {
    if (!toDelete) return;
    await leadCandidatesService.remove(toDelete.id);
    setToDelete(null);
    await reload();
  }

  async function handleQuickAssign(leadId: string) {
    if (!assignFcId) return;
    const fc = fundingCalls.find(f => f.id === assignFcId);
    await leadCandidatesService.update(leadId, {
      funding_call_id: assignFcId,
      call_type: fc ? (fc.body ?? fc.name) : undefined,
    });
    setAssigningId(null); setAssignFcId('');
    await reload();
  }

  function toggleCall(fcId: string) {
    setExpandedCalls(prev => {
      const next = new Set(prev);
      next.has(fcId) ? next.delete(fcId) : next.add(fcId);
      return next;
    });
  }

  const noBandoStats = useMemo(() => {
    const all = leads.filter(l => !l.funding_call_id);
    return {
      attivo:    all.filter(l => l.status === 'attivo').length,
      promosso:  all.filter(l => l.status === 'promosso').length,
      archiviato:all.filter(l => l.status === 'archiviato').length,
    };
  }, [leads]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lead Candidates</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {leads.length} lead · {new Set(leads.filter(l => l.funding_call_id).map(l => l.funding_call_id)).size} bandi
          </p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition"
        >
          <Plus className="w-4 h-4" />
          Nuovo lead
        </button>
      </div>

      {error && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      {/* Stats */}
      {leads.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Attivi" value={counts.attivo} sub={`${leads.length} totali`} Icon={Clock} color="bg-sky-50 text-sky-600" />
          <StatCard label="Promossi a concept" value={counts.promosso} Icon={FlaskConical} color="bg-emerald-50 text-emerald-600" />
          <StatCard label="Archiviati" value={counts.archiviato} Icon={Archive} color="bg-slate-100 text-slate-500" />
          <StatCard
            label="Tasso di promozione"
            value={promotionRate !== null ? `${promotionRate}%` : '—'}
            sub={promotionRate !== null ? 'su lead conclusi' : 'nessun lead concluso'}
            Icon={promotionRate !== null && promotionRate >= 50 ? TrendingUp : Percent}
            color={promotionRate !== null && promotionRate >= 50 ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {([
            { id: 'attivo'    as FilterTab, label: 'Attivi',     count: counts.attivo },
            { id: 'all'       as FilterTab, label: 'Tutti',      count: leads.length },
            { id: 'archiviato'as FilterTab, label: 'Archiviati', count: counts.archiviato },
          ]).map(({ id, label, count }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all ${
                tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-md tabular-nums ${
                tab === id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/70 text-slate-500'
              }`}>{count}</span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cerca ricercatore o istituto…"
            className="w-full pl-8 pr-8 py-1.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {(activePms.length > 0 || hasUnassigned) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-400 font-medium shrink-0">PM:</span>
            {activePms.map(pm => (
              <button key={pm.id} onClick={() => setFilterPmId(filterPmId === pm.id ? null : pm.id)} title={pm.name}
                className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                  filterPmId === pm.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700'
                }`}>
                <Avatar name={pm.name} url={pm.avatar_url} size="xs" />
                {pm.name}
              </button>
            ))}
            {hasUnassigned && (
              <button onClick={() => setFilterPmId(filterPmId === '__none__' ? null : '__none__')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                  filterPmId === '__none__' ? 'bg-slate-600 border-slate-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                }`}>
                <User className="w-3 h-3" />
                Non assegnati
              </button>
            )}
            {filterPmId && (
              <button onClick={() => setFilterPmId(null)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center text-sm text-slate-400">Caricamento…</div>
      ) : bandoGroups.length === 0 && leadsWithoutBando.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center">
          <UserSearch className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            {leads.length === 0
              ? 'Nessun lead. Clicca "+ Nuovo lead" per iniziare.'
              : search
              ? `Nessun risultato per "${search}".`
              : 'Nessun lead in questa vista.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <TableHeader />

          {/* ── Bando rows ── */}
          {bandoGroups.map(({ fcId, fc, subLeads }) => {
            const stats = callStats.get(fcId) ?? { attivo: 0, promosso: 0, archiviato: 0, allLeads: [] };
            const concluded = stats.promosso + stats.archiviato;
            const successRate = concluded > 0 ? Math.round(stats.promosso / concluded * 100) : null;
            const isExpanded = expandedCalls.has(fcId);

            const promotedConceptIds = new Set(stats.allLeads.map(l => l.promoted_concept_id).filter(Boolean));
            const directConcepts = concepts.filter(c => c.funding_call_id === fcId && !promotedConceptIds.has(c.id));
            const conceptCount = promotedConceptIds.size + directConcepts.length;

            const offerCount = fc ? offers.filter(o =>
              (o.funding_call && fc.code && o.funding_call.includes(fc.code)) ||
              o.consulting_call_id === fc.id
            ).length : 0;
            const target = fc?.target_offers ?? null;

            return (
              <div key={fcId} className="border-b border-slate-100 last:border-b-0">
                {/* Bando row */}
                <button
                  onClick={() => toggleCall(fcId)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/80 transition text-left"
                >
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-extrabold font-mono text-indigo-600 shrink-0">{fc?.code ?? '—'}</span>
                      <span className="text-sm font-medium text-slate-700 truncate">{fc?.name ?? 'Bando non trovato'}</span>
                    </div>
                    {fc?.body && <p className="text-xs text-slate-400 mt-0.5 truncate">{fc.body}</p>}
                  </div>

                  <div className="w-36 shrink-0">
                    <LeadStatsPills attivo={stats.attivo} promosso={stats.promosso} archiviato={stats.archiviato} />
                  </div>

                  <div className="w-14 text-center shrink-0 hidden lg:block">
                    <span className={`text-sm font-bold tabular-nums ${conceptCount > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                      {conceptCount > 0 ? conceptCount : '—'}
                    </span>
                  </div>

                  <div className="w-16 text-center shrink-0 hidden lg:block">
                    <span className={`text-sm font-bold tabular-nums ${offerCount > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>
                      {offerCount > 0 ? offerCount : '—'}
                    </span>
                    {target != null && <span className="text-xs text-slate-400"> /{target}</span>}
                  </div>

                  <div className="w-36 shrink-0 hidden lg:block">
                    {fc?.deadline ? <DeadlinePill isoDate={fc.deadline} /> : <span className="text-slate-300 text-xs">—</span>}
                  </div>

                  <div className="w-14 text-center shrink-0 hidden lg:block">
                    {successRate !== null
                      ? <span className={`text-sm font-bold tabular-nums ${successRate >= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>{successRate}%</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </div>

                  <div className="w-5 shrink-0" />
                </button>

                {/* Expanded lead sub-rows */}
                {isExpanded && (
                  <div className="bg-slate-50/30">
                    {subLeads.length === 0 ? (
                      <p className="pl-12 pr-4 py-3 text-xs text-slate-400 italic border-t border-slate-100">
                        Nessun lead visibile con il filtro attuale.
                      </p>
                    ) : (
                      [...subLeads].sort((a, b) => +isNewLead(b) - +isNewLead(a)).map(lead => (
                        <LeadRow
                          key={lead.id}
                          lead={lead}
                          pm={lead.pm_id ? pmById.get(lead.pm_id) : undefined}
                          lastUpdate={lastLeadUpdate.get(lead.id)}
                          onNavigate={() => navigate(`/leads/${lead.id}`)}
                          isAssigning={false}
                          fundingCalls={fundingCalls}
                          assignFcId=""
                          onStartAssign={() => {}}
                          onChangeAssignFc={() => {}}
                          onConfirmAssign={() => {}}
                          onCancelAssign={() => {}}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── No-bando section ── */}
          {leadsWithoutBando.length > 0 && (
            <div className={bandoGroups.length > 0 ? 'border-t-2 border-dashed border-slate-200' : ''}>
              <button
                onClick={() => setExpandedNoBando(p => !p)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-amber-50/30 transition text-left"
              >
                <ChevronDown className={`w-4 h-4 text-amber-400 shrink-0 transition-transform duration-200 ${expandedNoBando ? '' : '-rotate-90'}`} />
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">Senza bando assegnato</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{leadsWithoutBando.length}</span>
                </div>
                <div className="w-36 shrink-0">
                  <LeadStatsPills attivo={noBandoStats.attivo} promosso={noBandoStats.promosso} archiviato={noBandoStats.archiviato} />
                </div>
                <div className="w-14 hidden lg:block shrink-0" />
                <div className="w-16 hidden lg:block shrink-0" />
                <div className="w-36 hidden lg:block shrink-0" />
                <div className="w-14 hidden lg:block shrink-0" />
                <div className="w-5 shrink-0" />
              </button>

              {expandedNoBando && (
                <div className="bg-amber-50/10">
                  {[...leadsWithoutBando].sort((a, b) => +isNewLead(b) - +isNewLead(a)).map(lead => (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      pm={lead.pm_id ? pmById.get(lead.pm_id) : undefined}
                      lastUpdate={lastLeadUpdate.get(lead.id)}
                      onNavigate={() => navigate(`/leads/${lead.id}`)}
                      showAssign
                      isAssigning={assigningId === lead.id}
                      fundingCalls={fundingCalls}
                      assignFcId={assignFcId}
                      onStartAssign={() => { setAssigningId(lead.id); setAssignFcId(''); }}
                      onChangeAssignFc={setAssignFcId}
                      onConfirmAssign={() => void handleQuickAssign(lead.id)}
                      onCancelAssign={() => { setAssigningId(null); setAssignFcId(''); }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <LeadCandidateFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(created) => { setFormOpen(false); void reload(); navigate(`/leads/${created.id}`); }}
        lead={null}
        fundingCalls={fundingCalls}
        projectManagers={projectManagers}
      />

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminare il lead?"
        message={toDelete ? `"${toDelete.researcher_name}" e tutto lo storico verranno rimossi definitivamente.` : ''}
        confirmLabel="Elimina" variant="danger"
        onConfirm={handleDelete} onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
