import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, CheckCircle2, ChevronRight, Clock, Plus, UserSearch } from 'lucide-react';
import { leadCandidatesService } from '../lib/dataService';
import { useOffersData } from '../hooks/useOffersData';
import { formatDate } from '../lib/format';
import LeadCandidateFormModal from '../components/leads/LeadCandidateFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import type { LeadCandidate, LeadCandidateStatus } from '../types';

const STATUS_MAP: Record<LeadCandidateStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  attivo:    { label: 'Attivo',           cls: 'bg-sky-50 text-sky-700 border-sky-200',       Icon: Clock },
  promosso:  { label: 'Promosso',         cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  archiviato:{ label: 'Archiviato',       cls: 'bg-slate-50 text-slate-500 border-slate-200', Icon: Archive },
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

export default function LeadCandidates() {
  const navigate = useNavigate();
  const { fundingCalls } = useOffersData();

  const [leads, setLeads] = useState<LeadCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>('all');
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

  const visible = useMemo(
    () => tab === 'all' ? leads : leads.filter((l) => l.status === tab),
    [leads, tab],
  );

  const counts = useMemo(() => ({
    all: leads.length,
    attivo: leads.filter((l) => l.status === 'attivo').length,
    promosso: leads.filter((l) => l.status === 'promosso').length,
    archiviato: leads.filter((l) => l.status === 'archiviato').length,
  }), [leads]);

  // Raggruppa per call_type
  const groups = useMemo(() => {
    const map = new Map<string, LeadCandidate[]>();
    visible.forEach((l) => {
      const grp = map.get(l.call_type) ?? [];
      grp.push(l);
      map.set(l.call_type, grp);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'it'));
  }, [visible]);

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

      {/* Tab filter */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
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

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center text-sm text-slate-400">Caricamento…</div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center">
          <UserSearch className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            {leads.length === 0 ? 'Nessun lead. Clicca "+ Nuovo lead" per iniziare.' : 'Nessun lead in questa vista.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([callType, groupLeads]) => (
            <div key={callType}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-slate-700">{callType}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 tabular-nums">
                  {groupLeads.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {groupLeads.map((lead) => {
                  const fc = lead.funding_call_id ? fcById.get(lead.funding_call_id) : null;
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

                      {fc && (
                        <p className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 truncate">
                          {fc.code} — {fc.name}
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
              </div>
            </div>
          ))}
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
