import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive, CheckCircle2, ChevronDown, ChevronRight, Clock, FileText, FlaskConical,
  Percent, Plus, Search, TrendingUp, UserSearch, X,
} from 'lucide-react';
import { leadCandidatesService } from '../lib/dataService';
import { useOffersData } from '../hooks/useOffersData';
import { formatDate } from '../lib/format';
import LeadCandidateFormModal from '../components/leads/LeadCandidateFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import type { LeadCandidate, LeadCandidateStatus } from '../types';

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
  const { fundingCalls, offers } = useOffersData();

  const [leads, setLeads] = useState<LeadCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<LeadCandidate | null>(null);

  const fcById = useMemo(() => new Map(fundingCalls.map((fc) => [fc.id, fc])), [fundingCalls]);

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { setLeads(await leadCandidatesService.list()); }
    catch (e) { setError((e as { message?: string })?.message ?? 'Errore caricamento'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const counts = useMemo(() => ({
    all: leads.length,
    attivo: leads.filter((l) => l.status === 'attivo').length,
    promosso: leads.filter((l) => l.status === 'promosso').length,
    archiviato: leads.filter((l) => l.status === 'archiviato').length,
  }), [leads]);

  const promotionRate = useMemo(() => {
    const concluded = counts.promosso + counts.archiviato;
    if (concluded === 0) return null;
    return Math.round((counts.promosso / concluded) * 100);
  }, [counts]);

  const filtered = useMemo(() => {
    const byTab = tab === 'all' ? leads : leads.filter((l) => l.status === tab);
    if (!search.trim()) return byTab;
    const q = search.toLowerCase();
    return byTab.filter((l) =>
      l.researcher_name.toLowerCase().includes(q) ||
      (l.institution?.toLowerCase().includes(q) ?? false),
    );
  }, [leads, tab, search]);

  // Raggruppa solo per funding_call_id; lead senza bando → unica sezione in fondo
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; sub?: string; fcId?: string; leads: LeadCandidate[] }>();
    filtered.forEach((l) => {
      let key: string;
      let label: string;
      let sub: string | undefined;
      let fcId: string | undefined;
      const fc = l.funding_call_id ? fcById.get(l.funding_call_id) : undefined;
      if (fc) {
        key = l.funding_call_id!;
        label = fc.name;
        sub = fc.code;
        fcId = l.funding_call_id!;
      } else {
        key = '__no_call__';
        label = 'Senza bando specifico';
      }
      const grp = map.get(key) ?? { label, sub, fcId, leads: [] };
      grp.leads.push(l);
      map.set(key, grp);
    });
    // Bandi specifici ordinati alfabeticamente, "Senza bando" sempre in fondo
    const all = [...map.values()];
    return [
      ...all.filter((g) => g.fcId).sort((a, b) => a.label.localeCompare(b.label, 'it')),
      ...all.filter((g) => !g.fcId),
    ];
  }, [filtered, fcById]);

  async function handleDelete() {
    if (!toDelete) return;
    await leadCandidatesService.remove(toDelete.id);
    setToDelete(null);
    await reload();
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
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition"
        >
          <Plus className="w-4 h-4" />
          Nuovo lead
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Analytics */}
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
                }`}
              >
                {label}
                <span className={`text-xs px-1.5 py-0.5 rounded-md tabular-nums ${
                  active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/70 text-slate-500'
                }`}>{counts[id]}</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca ricercatore o istituto…"
            className="w-full pl-8 pr-8 py-1.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center text-sm text-slate-400">Caricamento…</div>
      ) : filtered.length === 0 ? (
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
        <div className="space-y-6">
          {groups.map(({ label, sub, fcId, leads: groupLeads }) => {
            const fc = fcId ? fcById.get(fcId) : null;
            const conceptCount = groupLeads.filter((l) => l.status === 'promosso' && l.promoted_concept_id).length;
            const offerCount = fc
              ? offers.filter((o) => o.funding_call && o.funding_call.includes(fc.code)).length
              : 0;
            const groupKey = fcId ?? '__no_call__';
            const isCollapsed = collapsed.has(groupKey);
            const toggle = () => setCollapsed((prev) => {
              const next = new Set(prev);
              next.has(groupKey) ? next.delete(groupKey) : next.add(groupKey);
              return next;
            });

            return (
              <div key={`${label}-${sub ?? ''}`}>
                <button
                  onClick={toggle}
                  className="w-full flex items-start justify-between gap-3 mb-3 text-left group"
                >
                  <div className="min-w-0 flex-1">
                    {sub && (
                      <p className="text-sm font-semibold text-indigo-600 tracking-wide font-mono mb-0.5">{sub}</p>
                    )}
                    <h2 className="text-lg font-bold text-slate-900 leading-tight">{label}</h2>
                    {(conceptCount > 0 || offerCount > 0) && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                        <span className="font-medium text-slate-600">Stato attuale:</span>
                        {offerCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-indigo-600">
                            <FileText className="w-3 h-3" />
                            {offerCount} {offerCount === 1 ? 'offerta' : 'offerte'}
                          </span>
                        )}
                        {offerCount > 0 && conceptCount > 0 && <span className="text-slate-300">·</span>}
                        {conceptCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <FlaskConical className="w-3 h-3" />
                            {conceptCount} {conceptCount === 1 ? 'concept' : 'concept'}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 tabular-nums">
                      {groupLeads.length}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                  </div>
                </button>

                {!isCollapsed && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {groupLeads.map((lead) => {
                    const leadFc = lead.funding_call_id ? fcById.get(lead.funding_call_id) : null;
                    return (
                      <button
                        key={lead.id}
                        onClick={() => navigate(`/leads/${lead.id}`)}
                        className="text-left bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-indigo-200 transition p-4 flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 leading-tight truncate">{lead.researcher_name}</p>
                            {lead.institution && (
                              <p className="text-xs text-slate-500 truncate mt-0.5">{lead.institution}</p>
                            )}
                          </div>
                          <StatusBadge value={lead.status} />
                        </div>

                        {leadFc && (
                          <p className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 truncate">
                            {leadFc.code} — {leadFc.name}
                          </p>
                        )}

                        {lead.potential_project && (
                          <p className="text-xs text-slate-600 line-clamp-2">{lead.potential_project}</p>
                        )}

                        <div className="flex items-center justify-between text-xs text-slate-400 mt-auto pt-1">
                          <span>Aggiunto {formatDate(lead.created_at)}</span>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); setToDelete(lead); }}
                              className="text-slate-300 hover:text-red-500 transition"
                            >
                              Elimina
                            </button>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>}
              </div>
            );
          })}
        </div>
      )}

      <LeadCandidateFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(created) => { setFormOpen(false); void reload(); navigate(`/leads/${created.id}`); }}
        lead={null}
        fundingCalls={fundingCalls}
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
