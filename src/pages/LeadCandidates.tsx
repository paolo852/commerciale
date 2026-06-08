import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive, CalendarClock, CheckCircle2, ChevronDown, ChevronRight, Clock, FileText, FlaskConical,
  Link2, Percent, Plus, Search, Target, TrendingUp, User, UserSearch, X,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import { leadCandidatesService, leadUpdatesService, fundingCallsService, conceptsService } from '../lib/dataService';
import { useOffersData } from '../hooks/useOffersData';
import { formatDate } from '../lib/format';
import LeadCandidateFormModal from '../components/leads/LeadCandidateFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import type { Concept, LeadCandidate, LeadCandidateStatus } from '../types';

const STATUS_MAP: Record<LeadCandidateStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  attivo:    { label: 'Attivo',     cls: 'bg-sky-50 text-sky-700 border-sky-200',            Icon: Clock },
  promosso:  { label: 'Promosso',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  archiviato:{ label: 'Archiviato', cls: 'bg-slate-50 text-slate-500 border-slate-200',       Icon: Archive },
};

function StatusBadge({ value }: { value: LeadCandidateStatus }) {
  const { label, cls, Icon } = STATUS_MAP[value];
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cls}`}>
      <Icon className="w-3 h-3" />{label}
    </span>
  );
}

const NEW_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;
function isNewLead(lead: LeadCandidate): boolean {
  return Date.now() - new Date(lead.created_at).getTime() < NEW_THRESHOLD_MS;
}

type FilterTab = 'all' | 'attivo' | 'promosso' | 'archiviato';
const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'attivo', label: 'Attivi' },
  { id: 'promosso', label: 'Promossi' },
  { id: 'archiviato', label: 'Archiviati' },
];

function StatCard({
  label, value, sub, Icon, color,
}: { label: string; value: string | number; sub?: string; Icon: React.ElementType; color: string }) {
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

export default function LeadCandidates() {
  const navigate = useNavigate();
  const { fundingCalls, offers, projectManagers, reload: reloadOffers } = useOffersData();
  const pmById = useMemo(() => new Map(projectManagers.map((p) => [p.id, p])), [projectManagers]);

  const [leads, setLeads] = useState<LeadCandidate[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [lastLeadUpdate, setLastLeadUpdate] = useState<Map<string, { created_at: string; author_name: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sectionCollapsed, setSectionCollapsed] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<LeadCandidate | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignFcId, setAssignFcId] = useState('');
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [targetInput, setTargetInput] = useState('');
  const [filterPmId, setFilterPmId] = useState<string | null>(null);

  const fcById = useMemo(() => new Map(fundingCalls.map((fc) => [fc.id, fc])), [fundingCalls]);

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
    }
    catch (e) { setError((e as { message?: string })?.message ?? 'Errore caricamento'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const counts = useMemo(() => ({
    all: leads.filter((l) => l.status !== 'promosso').length,
    attivo: leads.filter((l) => l.status === 'attivo').length,
    promosso: leads.filter((l) => l.status === 'promosso').length,
    archiviato: leads.filter((l) => l.status === 'archiviato').length,
  }), [leads]);

  const promotionRate = useMemo(() => {
    const concluded = counts.promosso + counts.archiviato;
    if (concluded === 0) return null;
    return Math.round((counts.promosso / concluded) * 100);
  }, [counts]);

  const activePms = useMemo(() => {
    const ids = new Set(leads.map((l) => l.pm_id).filter(Boolean) as string[]);
    return projectManagers.filter((pm) => ids.has(pm.id));
  }, [leads, projectManagers]);

  const hasUnassigned = useMemo(() => leads.some((l) => !l.pm_id), [leads]);

  const filtered = useMemo(() => {
    let result = tab === 'all' ? leads.filter((l) => l.status !== 'promosso') : leads.filter((l) => l.status === tab);
    if (filterPmId === '__none__') {
      result = result.filter((l) => !l.pm_id);
    } else if (filterPmId) {
      result = result.filter((l) => l.pm_id === filterPmId);
    }
    if (!search.trim()) return result;
    const q = search.toLowerCase();
    return result.filter((l) =>
      l.researcher_name.toLowerCase().includes(q) ||
      (l.institution?.toLowerCase().includes(q) ?? false),
    );
  }, [leads, tab, search, filterPmId]);

  const groupsWithBando = useMemo(() => {
    const map = new Map<string, { label: string; sub: string; fcId: string; leads: LeadCandidate[] }>();
    filtered.filter((l) => l.funding_call_id).forEach((l) => {
      const fc = fcById.get(l.funding_call_id!);
      const key = l.funding_call_id!;
      const existing = map.get(key) ?? { label: fc?.name ?? key, sub: fc?.code ?? '', fcId: key, leads: [] };
      existing.leads.push(l);
      map.set(key, existing);
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'it'));
  }, [filtered, fcById]);

  const leadsWithoutBando = useMemo(
    () => filtered.filter((l) => !l.funding_call_id),
    [filtered],
  );

  async function handleDelete() {
    if (!toDelete) return;
    await leadCandidatesService.remove(toDelete.id);
    setToDelete(null);
    await reload();
  }

  async function handleArchive(leadId: string) {
    await leadCandidatesService.update(leadId, { status: 'archiviato' });
    await reload();
  }

  async function handleQuickAssign(leadId: string) {
    if (!assignFcId) return;
    const fc = fundingCalls.find((f) => f.id === assignFcId);
    await leadCandidatesService.update(leadId, {
      funding_call_id: assignFcId,
      call_type: fc ? (fc.body ?? fc.name) : undefined,
    });
    setAssigningId(null);
    setAssignFcId('');
    await reload();
  }

  async function handleSaveTarget(fcId: string) {
    const val = parseInt(targetInput, 10);
    await fundingCallsService.update(fcId, { target_offers: isNaN(val) || val <= 0 ? null : val });
    setEditingTargetId(null);
    setTargetInput('');
    await reloadOffers();
  }

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleSection(key: string) {
    setSectionCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function DeadlineChip({ isoDate, chipLabel }: { isoDate: string; chipLabel: string }) {
    const ms = new Date(isoDate).getTime() - Date.now();
    const days = Math.ceil(ms / 86400000);
    const past = days < 0;
    const urgent = days >= 0 && days <= 14;
    const soon = days > 14 && days <= 30;
    const [bg, border, text, countdownCls] = past
      ? ['bg-red-50', 'border-red-200', 'text-red-700', 'bg-red-100 text-red-700']
      : urgent
      ? ['bg-amber-50', 'border-amber-200', 'text-amber-700', 'bg-amber-100 text-amber-700']
      : soon
      ? ['bg-yellow-50', 'border-yellow-200', 'text-yellow-700', 'bg-yellow-100 text-yellow-700']
      : ['bg-slate-50', 'border-slate-200', 'text-slate-600', 'bg-slate-100 text-slate-500'];
    const countdownLabel = past ? `scaduta ${Math.abs(days)} gg fa` : days === 0 ? 'oggi!' : `tra ${days} gg`;
    return (
      <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${bg} ${border}`}>
        <CalendarClock className={`w-3.5 h-3.5 shrink-0 ${text}`} />
        <div className="flex flex-col leading-tight">
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${text} opacity-70`}>Scadenza {chipLabel}</span>
          <span className={`text-xs font-semibold ${text}`}>{isoDate}</span>
        </div>
        <span className={`ml-1 text-[11px] font-bold px-1.5 py-0.5 rounded-md tabular-nums ${countdownCls}`}>
          {countdownLabel}
        </span>
      </div>
    );
  }

  function LeadCard({ lead, showAssign }: { lead: LeadCandidate; showAssign: boolean }) {
    const isAssigning = assigningId === lead.id;
    const lastUpdate = lastLeadUpdate.get(lead.id);
    const leadIsNew = isNewLead(lead);
    return (
      <div
        onClick={() => !isAssigning && navigate(`/leads/${lead.id}`)}
        className={`rounded-xl border shadow-sm hover:shadow-md transition p-3.5 flex flex-col gap-2 ${
          leadIsNew
            ? 'bg-indigo-50/70 border-indigo-200 hover:border-indigo-400'
            : 'bg-white border-slate-200/80 hover:border-indigo-200'
        } ${isAssigning ? 'cursor-default' : 'cursor-pointer'}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 leading-tight truncate text-sm">{lead.researcher_name}</p>
            {lead.institution && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{lead.institution}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {leadIsNew && (
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-sm shadow-indigo-300">
                New
              </span>
            )}
            <StatusBadge value={lead.status} />
          </div>
        </div>

        {lead.call_type && lead.call_type !== 'Non classificato' && !lead.funding_call_id && (
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 truncate">
            {lead.call_type}
          </p>
        )}

        {showAssign && (
          <div onClick={(e) => e.stopPropagation()}>
            {isAssigning ? (
              <div className="flex gap-1.5 items-center">
                <select autoFocus value={assignFcId} onChange={(e) => setAssignFcId(e.target.value)}
                  className="flex-1 text-xs px-2 py-1.5 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                  <option value="">— Seleziona bando —</option>
                  {fundingCalls.map((fc) => (
                    <option key={fc.id} value={fc.id}>{fc.code} — {fc.name}</option>
                  ))}
                </select>
                <button onClick={() => handleQuickAssign(lead.id)} disabled={!assignFcId}
                  className="px-2 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition">✓</button>
                <button onClick={() => { setAssigningId(null); setAssignFcId(''); }}
                  className="px-2 py-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">✕</button>
              </div>
            ) : (
              <button onClick={() => { setAssigningId(lead.id); setAssignFcId(''); }}
                className="w-full flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-dashed border-indigo-200 rounded-lg px-2 py-1.5 hover:bg-indigo-100 hover:border-indigo-300 transition">
                <Link2 className="w-3 h-3 shrink-0" />
                Assegna a un bando
              </button>
            )}
          </div>
        )}

        {lead.keywords && lead.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {lead.keywords.slice(0, 4).map((kw) => (
              <span key={kw} className="inline-flex text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 font-medium">
                {kw}
              </span>
            ))}
            {lead.keywords.length > 4 && (
              <span className="inline-flex text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">
                +{lead.keywords.length - 4}
              </span>
            )}
          </div>
        )}

        {lead.potential_project && (
          <p className="text-xs text-slate-600 line-clamp-2">{lead.potential_project}</p>
        )}

        <div className="flex items-center justify-between text-xs text-slate-400 mt-auto pt-1">
          {lead.pm_id && pmById.get(lead.pm_id) ? (
            <span className="flex items-center gap-1 text-slate-500">
              <User className="w-3 h-3" />
              <span className="font-semibold text-slate-700">{pmById.get(lead.pm_id)!.name}</span>
            </span>
          ) : (
            <span>Aggiunto {formatDate(lead.created_at)}</span>
          )}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {lead.status === 'attivo' && (
              <button onClick={() => handleArchive(lead.id)}
                className="flex items-center gap-1 text-slate-400 hover:text-amber-600 transition" title="Archivia lead">
                <Archive className="w-3.5 h-3.5" />
                <span>Archivia</span>
              </button>
            )}
            <button onClick={() => setToDelete(lead)} className="text-slate-300 hover:text-red-500 transition">
              Elimina
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          </div>
        </div>
        {lastUpdate && (
          <div className="flex items-center gap-1 text-[11px] text-slate-400 border-t border-slate-100 pt-1.5 -mx-0.5">
            <Clock className="w-3 h-3 shrink-0" />
            <span>Agg. {formatDate(lastUpdate.created_at)} · <span className="font-medium text-slate-500">{lastUpdate.author_name}</span></span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lead Candidates</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Ricercatori in contatto · {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
          </p>
        </div>
        <button onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition">
          <Plus className="w-4 h-4" />
          Nuovo lead
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

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
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
          {TABS.map(({ id, label }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {label}
                <span className={`text-xs px-1.5 py-0.5 rounded-md tabular-nums ${
                  active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/70 text-slate-500'
                }`}>{counts[id]}</span>
              </button>
            );
          })}
        </div>
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
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
            {activePms.map((pm) => {
              const active = filterPmId === pm.id;
              return (
                <button key={pm.id} onClick={() => setFilterPmId(active ? null : pm.id)} title={pm.name}
                  className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                    active ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700'
                  }`}>
                  <Avatar name={pm.name} url={pm.avatar_url} size="xs" />
                  {pm.name}
                </button>
              );
            })}
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

      {/* Main content */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center text-sm text-slate-400">Caricamento…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center">
          <UserSearch className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            {leads.length === 0 ? 'Nessun lead. Clicca "+ Nuovo lead" per iniziare.'
              : search ? `Nessun risultato per "${search}".`
              : 'Nessun lead in questa vista.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Section 1: Match individuato ─────────────────────────── */}
          <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button onClick={() => toggleSection('with_bando')}
              className="w-full bg-indigo-600 px-5 py-3.5 flex items-center justify-between hover:bg-indigo-700 transition">
              <div className="flex items-center gap-3">
                <Link2 className="w-5 h-5 text-indigo-300 shrink-0" />
                <div className="text-left">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Match individuato</p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {groupsWithBando.reduce((n, g) => n + g.leads.length, 0)} lead · {groupsWithBando.length} {groupsWithBando.length === 1 ? 'bando' : 'bandi'}
                  </p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-indigo-300 transition-transform duration-200 ${sectionCollapsed.has('with_bando') ? '-rotate-90' : ''}`} />
            </button>

            {!sectionCollapsed.has('with_bando') && (
              <div className="p-4 space-y-3 bg-slate-50/60">
                {groupsWithBando.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-sm text-slate-400">Nessun lead con bando assegnato.</p>
                  </div>
                ) : groupsWithBando.map(({ label, sub, fcId, leads: groupLeads }) => {
                  const fc = fcById.get(fcId);
                  const promotedViaLead = new Set(groupLeads.map((l) => l.promoted_concept_id).filter(Boolean));
                  const directConcepts = concepts.filter(
                    (c) => c.funding_call_id === fcId && !promotedViaLead.has(c.id)
                  );
                  const conceptCount = promotedViaLead.size + directConcepts.length;
                  const offerCount = fc
                    ? offers.filter((o) =>
                        (o.funding_call && o.funding_call.includes(fc.code)) ||
                        (o.consulting_call_id === fc.id)
                      ).length
                    : 0;
                  const isCollapsed = collapsed.has(fcId);
                  const target = fc?.target_offers ?? null;
                  const isEditingTarget = editingTargetId === fcId;

                  return (
                    <div key={fcId} className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                      <div className="bg-white">
                        {/* Top row: code + main deadline + lead count + collapse */}
                        <button onClick={() => toggleGroup(fcId)}
                          className="w-full flex items-center justify-between gap-2 px-4 pt-3.5 pb-1 text-left hover:bg-slate-50/60 transition">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="text-base font-extrabold font-mono text-indigo-600 tracking-tight shrink-0">{sub}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-semibold tabular-nums shrink-0">
                              {groupLeads.length} lead
                            </span>
                            {fc?.deadline && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 shrink-0">
                                <CalendarClock className="w-3 h-3 text-slate-400" />
                                Scadenza bando: {fc.deadline}
                              </span>
                            )}
                          </div>
                          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                        </button>

                        {/* Call name */}
                        <button onClick={() => toggleGroup(fcId)} className="w-full text-left px-4 pb-2 hover:bg-slate-50/60 transition">
                          <p className="text-sm font-semibold text-slate-800 leading-snug">{label}</p>
                        </button>

                        {/* Internal deadlines */}
                        {fc && (fc.lead_deadline || fc.internal_deadline) && (
                          <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
                            {fc.lead_deadline && <DeadlineChip isoDate={fc.lead_deadline} chipLabel="Lead" />}
                            {fc.internal_deadline && <DeadlineChip isoDate={fc.internal_deadline} chipLabel="Concept" />}
                          </div>
                        )}

                        {/* Pipeline counters + target */}
                        <div className="border-t border-slate-100 px-4 py-3 space-y-2.5">
                          <div className="flex items-stretch gap-2">
                            <div className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 px-3 ${conceptCount > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}`}>
                              <div className="flex items-center gap-1">
                                <FlaskConical className={`w-3.5 h-3.5 ${conceptCount > 0 ? 'text-emerald-500' : 'text-slate-300'}`} />
                                <span className={`text-[11px] font-medium ${conceptCount > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>Concept</span>
                              </div>
                              <span className={`text-2xl font-extrabold tabular-nums leading-none ${conceptCount > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{conceptCount}</span>
                            </div>
                            <div className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 px-3 ${offerCount > 0 ? 'bg-indigo-50 border border-indigo-200' : 'bg-slate-50 border border-slate-200'}`}>
                              <div className="flex items-center gap-1">
                                <FileText className={`w-3.5 h-3.5 ${offerCount > 0 ? 'text-indigo-500' : 'text-slate-300'}`} />
                                <span className={`text-[11px] font-medium ${offerCount > 0 ? 'text-indigo-700' : 'text-slate-400'}`}>Offerte</span>
                              </div>
                              <div className="flex items-baseline gap-1">
                                <span className={`text-2xl font-extrabold tabular-nums leading-none ${offerCount > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>{offerCount}</span>
                                {target !== null && <span className="text-sm font-semibold text-slate-400">/ {target}</span>}
                              </div>
                            </div>
                            <div onClick={(e) => e.stopPropagation()} className="flex-1">
                              {isEditingTarget ? (
                                <div className="h-full flex flex-col items-center justify-center gap-1 rounded-xl py-2 px-3 bg-indigo-50 border border-indigo-300">
                                  <span className="text-[11px] font-medium text-indigo-700">Target</span>
                                  <div className="flex items-center gap-1">
                                    <input type="number" min={1} autoFocus value={targetInput}
                                      onChange={(e) => setTargetInput(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') void handleSaveTarget(fcId);
                                        if (e.key === 'Escape') { setEditingTargetId(null); setTargetInput(''); }
                                      }}
                                      placeholder="N"
                                      className="w-14 px-2 py-0.5 text-sm font-bold border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-center bg-white" />
                                    <button onClick={() => void handleSaveTarget(fcId)} className="text-xs px-1.5 py-0.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">✓</button>
                                    <button onClick={() => { setEditingTargetId(null); setTargetInput(''); }} className="text-xs px-1 py-0.5 text-slate-500 hover:text-slate-700">✕</button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setEditingTargetId(fcId); setTargetInput(target !== null ? String(target) : ''); }}
                                  title={target !== null ? 'Modifica target offerte' : 'Imposta target offerte'}
                                  className={`w-full h-full flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 px-3 border transition hover:border-indigo-300 hover:bg-indigo-50/60 ${target !== null ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-dashed border-slate-300'}`}>
                                  <div className="flex items-center gap-1">
                                    <Target className={`w-3.5 h-3.5 ${target !== null ? 'text-amber-500' : 'text-slate-300'}`} />
                                    <span className={`text-[11px] font-medium ${target !== null ? 'text-amber-700' : 'text-slate-400'}`}>Target</span>
                                  </div>
                                  <span className={`text-2xl font-extrabold tabular-nums leading-none ${target !== null ? 'text-amber-600' : 'text-slate-300'}`}>
                                    {target !== null ? target : '—'}
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>
                          {target !== null && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${offerCount >= target ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                  style={{ width: `${Math.min(100, Math.round((offerCount / target) * 100))}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-500 tabular-nums w-9 text-right">
                                {Math.round((offerCount / target) * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="px-3 pb-3 space-y-2 border-t border-slate-100 pt-2 bg-slate-50/40">
                          {[...groupLeads].sort((a, b) => +isNewLead(b) - +isNewLead(a)).map((lead) => (
                            <LeadCard key={lead.id} lead={lead} showAssign={false} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Section 2: Match da individuare ──────────────────────── */}
          <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button onClick={() => toggleSection('without_bando')}
              className="w-full bg-amber-500 px-5 py-3.5 flex items-center justify-between hover:bg-amber-600 transition">
              <div className="flex items-center gap-3">
                <Search className="w-5 h-5 text-amber-200 shrink-0" />
                <div className="text-left">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-100">Match da individuare</p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {leadsWithoutBando.length} {leadsWithoutBando.length === 1 ? 'lead' : 'lead'} senza bando
                  </p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-amber-200 transition-transform duration-200 ${sectionCollapsed.has('without_bando') ? '-rotate-90' : ''}`} />
            </button>

            {!sectionCollapsed.has('without_bando') && (
              <div className="p-4 bg-slate-50/60">
                {leadsWithoutBando.length === 0 ? (
                  <div className="py-10 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Tutti i lead hanno un bando assegnato.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {[...leadsWithoutBando].sort((a, b) => +isNewLead(b) - +isNewLead(a)).map((lead) => (
                      <LeadCard key={lead.id} lead={lead} showAssign />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

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
