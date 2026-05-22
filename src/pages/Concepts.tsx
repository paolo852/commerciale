import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, FlaskConical, Plus, Users, X, XCircle } from 'lucide-react';
import Avatar from '../components/Avatar';
import { useConceptsData } from '../hooks/useConceptsData';
import { useOffersData } from '../hooks/useOffersData';
import { conceptsService, leadCandidatesService } from '../lib/dataService';
import { formatDate } from '../lib/format';
import ConceptFormModal from '../components/concepts/ConceptFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import type { Concept, ConceptStatus, LeadCandidate } from '../types';

type ViewTab = 'all' | 'in_valutazione' | 'promosso' | 'rifiutato';

const tabs: { id: ViewTab; label: string }[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'in_valutazione', label: 'In valutazione' },
  { id: 'promosso', label: 'Promossi' },
  { id: 'rifiutato', label: 'Rifiutati' },
];

function StatCard({ label, value, cls, Icon }: {
  label: string; value: number; cls: string; Icon: typeof Clock;
}) {
  return (
    <div className={`rounded-2xl border px-3 py-3 ${cls}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-80">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ value }: { value: ConceptStatus }) {
  const map = {
    in_valutazione: { label: 'In valutazione', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
    promosso:       { label: 'Promosso',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
    rifiutato:      { label: 'Rifiutato',      cls: 'bg-slate-50 text-slate-600 border-slate-200', Icon: XCircle },
  } as const;
  const { label, cls, Icon } = map[value];
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

export default function Concepts() {
  const navigate = useNavigate();
  const { concepts, loading, error, reload } = useConceptsData();
  const { projectManagers, fundingCalls } = useOffersData();

  const [view, setView] = useState<ViewTab>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Concept | null>(null);
  const [filterPmId, setFilterPmId] = useState<string | null>(null);
  const [filterCallId, setFilterCallId] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadCandidate[]>([]);

  useEffect(() => {
    leadCandidatesService.list().then(setLeads).catch(() => {});
  }, []);

  // concept id → funding call id (via promoted leads)
  const conceptCallMap = useMemo(() => {
    const m = new Map<string, string>();
    leads.forEach((l) => {
      if (l.promoted_concept_id && l.funding_call_id) m.set(l.promoted_concept_id, l.funding_call_id);
    });
    return m;
  }, [leads]);


  const counts = useMemo(() => ({
    all: concepts.filter((c) => c.status !== 'promosso').length,
    in_valutazione: concepts.filter((c) => c.status === 'in_valutazione').length,
    promosso: concepts.filter((c) => c.status === 'promosso').length,
    rifiutato: concepts.filter((c) => c.status === 'rifiutato').length,
  }), [concepts]);

  // Carico per PM: conta concept attivi (non rifiutati) per ogni PM assegnato
  const pmWorkload = useMemo(() => {
    const map = new Map<string, { name: string; avatar_url: string | null; total: number; in_valutazione: number; promosso: number }>();
    concepts.forEach((c) => {
      (c.assignees ?? []).forEach((a) => {
        if (!a.project_manager) return;
        const key = a.project_manager.id;
        const entry = map.get(key) ?? { name: a.project_manager.name, avatar_url: a.project_manager.avatar_url ?? null, total: 0, in_valutazione: 0, promosso: 0 };
        entry.total += 1;
        if (c.status === 'in_valutazione') entry.in_valutazione += 1;
        if (c.status === 'promosso') entry.promosso += 1;
        map.set(key, entry);
      });
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [concepts]);

  const visible = useMemo(() => {
    let result = view === 'all' ? concepts.filter((c) => c.status !== 'promosso') : concepts.filter((c) => c.status === view);
    if (filterPmId) {
      result = result.filter((c) =>
        (c.assignees ?? []).some((a) => a.project_manager_id === filterPmId),
      );
    }
    if (filterCallId) {
      result = result.filter((c) => conceptCallMap.get(c.id) === filterCallId);
    }
    return result;
  }, [concepts, view, filterPmId, filterCallId, conceptCallMap]);

  // PMs that appear in at least one concept (in current tab)
  const activePms = useMemo(() => {
    const base = view === 'all' ? concepts.filter((c) => c.status !== 'promosso') : concepts.filter((c) => c.status === view);
    const ids = new Set(base.flatMap((c) => (c.assignees ?? []).map((a) => a.project_manager_id)));
    return projectManagers.filter((pm) => ids.has(pm.id));
  }, [concepts, view, projectManagers]);

  // Funding calls that appear in at least one concept (in current tab)
  const activeCalls = useMemo(() => {
    const base = view === 'all' ? concepts.filter((c) => c.status !== 'promosso') : concepts.filter((c) => c.status === view);
    const ids = new Set(base.map((c) => conceptCallMap.get(c.id)).filter(Boolean) as string[]);
    return fundingCalls.filter((fc) => ids.has(fc.id));
  }, [concepts, view, fundingCalls, conceptCallMap]);

  async function handleDelete() {
    if (!toDelete) return;
    await conceptsService.remove(toDelete.id);
    setToDelete(null);
    await reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Concept Development</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Concept in sviluppo · {concepts.length} {concepts.length === 1 ? 'concept' : 'concept'}
          </p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition"
        >
          <Plus className="w-4 h-4" />
          Nuovo concept
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Analytics: stato + carico per PM */}
      {!loading && concepts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 grid grid-cols-3 gap-2">
            <StatCard label="In valutazione" value={counts.in_valutazione} cls="bg-amber-50 text-amber-700 border-amber-200" Icon={Clock} />
            <StatCard label="Promossi" value={counts.promosso} cls="bg-emerald-50 text-emerald-700 border-emerald-200" Icon={CheckCircle2} />
            <StatCard label="Rifiutati" value={counts.rifiutato} cls="bg-slate-50 text-slate-600 border-slate-200" Icon={XCircle} />
          </div>
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-indigo-500" />
              Carico per Project Manager
            </h3>
            {pmWorkload.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nessun concept assegnato a un PM.</p>
            ) : (
              <ul className="space-y-1.5">
                {pmWorkload.map((pm) => (
                  <li key={pm.name} className="flex items-center gap-2 text-sm">
                    <Avatar name={pm.name} url={pm.avatar_url} size="md" />
                    <span className="flex-1 truncate text-slate-700">{pm.name}</span>
                    <span className="text-xs text-slate-500 tabular-nums flex items-center gap-2">
                      {pm.in_valutazione > 0 && (
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md">
                          {pm.in_valutazione} in valutazione
                        </span>
                      )}
                      {pm.promosso > 0 && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                          {pm.promosso} promossi
                        </span>
                      )}
                      <span className="text-slate-900 font-semibold">{pm.total} tot.</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
          {tabs.map(({ id, label }) => {
            const active = view === id;
            return (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
                <span className={`text-xs px-1.5 py-0.5 rounded-md tabular-nums ${
                  active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/70 text-slate-500'
                }`}>
                  {counts[id]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Call filter */}
        {activeCalls.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium shrink-0">Bando:</span>
            <div className="relative">
              <select
                value={filterCallId ?? ''}
                onChange={(e) => setFilterCallId(e.target.value || null)}
                className="pl-2.5 pr-7 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer hover:border-indigo-300 transition"
              >
                <option value="">Tutti i bandi</option>
                {activeCalls.map((fc) => (
                  <option key={fc.id} value={fc.id}>{fc.code} — {fc.name}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">▾</span>
            </div>
            {filterCallId && (
              <button onClick={() => setFilterCallId(null)} className="text-slate-400 hover:text-slate-600 transition" title="Rimuovi filtro bando">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* PM filter chips */}
        {activePms.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-400 font-medium shrink-0">PM:</span>
            {activePms.map((pm) => {
              const active = filterPmId === pm.id;
              return (
                <button
                  key={pm.id}
                  onClick={() => setFilterPmId(active ? null : pm.id)}
                  title={pm.name}
                  className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                    active
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700'
                  }`}
                >
                  <Avatar name={pm.name} url={pm.avatar_url} size="xs" />
                  {pm.name}
                </button>
              );
            })}
            {filterPmId && (
              <button onClick={() => setFilterPmId(null)} className="text-slate-400 hover:text-slate-600 transition" title="Rimuovi filtro PM">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center text-sm text-slate-400">
          Caricamento…
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center">
          <FlaskConical className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            {concepts.length === 0 ? 'Nessun concept. Clicca "+ Nuovo concept" per iniziare.' : 'Nessun concept in questa vista.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/concepts/${c.id}`)}
              className="text-left bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-indigo-200 transition p-5 flex flex-col gap-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900 leading-tight line-clamp-2">{c.name}</h3>
                <StatusBadge value={c.status} />
              </div>
              {(c.pi || c.ente) && (
                <p className="text-xs text-slate-500">
                  {c.pi && <span><strong>PI:</strong> {c.pi}</span>}
                  {c.pi && c.ente && <span> · </span>}
                  {c.ente && <span>{c.ente}</span>}
                </p>
              )}
              {c.description && (
                <p className="text-sm text-slate-600 line-clamp-3">{c.description}</p>
              )}
              {c.assignees && c.assignees.length > 0 && (() => {
                const pm = c.assignees.find((a) => a.role === 'Project Manager');
                const sorted = pm
                  ? [pm, ...c.assignees.filter((a) => a.role !== 'Project Manager')]
                  : c.assignees;
                return (
                  <div className="space-y-1.5">
                    {pm && (
                      <div className="flex items-center gap-1.5">
                        <Avatar
                          name={pm.project_manager?.name ?? ''}
                          url={pm.project_manager?.avatar_url}
                          size="sm"
                          fallbackClassName="bg-indigo-600 text-white"
                          className="ring-2 ring-indigo-200 shrink-0"
                          title={pm.project_manager?.name ?? ''}
                        />
                        <span className="text-xs font-medium text-slate-800 truncate">
                          {pm.project_manager?.name}
                        </span>
                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                          PM
                        </span>
                      </div>
                    )}
                    {sorted.filter((a) => a.role !== 'Project Manager').length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div className="flex -space-x-1.5">
                          {sorted.filter((a) => a.role !== 'Project Manager').slice(0, 4).map((a) => (
                            <Avatar
                              key={a.project_manager_id}
                              name={a.project_manager?.name ?? ''}
                              url={a.project_manager?.avatar_url}
                              size="sm"
                              className="ring-2 ring-white"
                              title={a.project_manager?.name ?? ''}
                            />
                          ))}
                          {sorted.filter((a) => a.role !== 'Project Manager').length > 4 && (
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                              +{sorted.filter((a) => a.role !== 'Project Manager').length - 4}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 truncate">
                          {sorted.filter((a) => a.role !== 'Project Manager').map((a) => a.project_manager?.name).filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                    {!pm && (
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div className="flex -space-x-1.5">
                          {sorted.slice(0, 4).map((a) => (
                            <Avatar
                              key={a.project_manager_id}
                              name={a.project_manager?.name ?? ''}
                              url={a.project_manager?.avatar_url}
                              size="sm"
                              className="ring-2 ring-white"
                              title={a.project_manager?.name ?? ''}
                            />
                          ))}
                          {sorted.length > 4 && (
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                              +{sorted.length - 4}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 truncate">
                          {sorted.map((a) => a.project_manager?.name).filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="flex items-center justify-between text-xs text-slate-400 mt-auto pt-2">
                <span>Creato {formatDate(c.created_at)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setToDelete(c); }}
                  className="text-slate-300 hover:text-red-600 transition"
                >
                  Elimina
                </button>
              </div>
            </button>
          ))}
        </div>
      )}

      <ConceptFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(created) => {
          setFormOpen(false);
          void reload();
          if (created) navigate(`/concepts/${created.id}`);
        }}
        concept={null}
        projectManagers={projectManagers}
      />

      <ConfirmDialog open={!!toDelete} title="Eliminare il concept?"
        message={toDelete ? `"${toDelete.name}" e tutti i suoi file/commenti verranno rimossi definitivamente.` : ''}
        confirmLabel="Elimina" variant="danger"
        onConfirm={handleDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
