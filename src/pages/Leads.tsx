import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, FlaskConical, Plus, XCircle } from 'lucide-react';
import { useLeadsData } from '../hooks/useLeadsData';
import { useOffersData } from '../hooks/useOffersData';
import { leadsService } from '../lib/dataService';
import { formatDate } from '../lib/format';
import LeadFormModal from '../components/leads/LeadFormModal';
import OfferFormModal from '../components/offerte/OfferFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import type { Lead, LeadStatus, Offer } from '../types';

type ViewTab = 'all' | 'in_valutazione' | 'promosso' | 'rifiutato';

const tabs: { id: ViewTab; label: string }[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'in_valutazione', label: 'In valutazione' },
  { id: 'promosso', label: 'Promossi' },
  { id: 'rifiutato', label: 'Rifiutati' },
];

function StatusBadge({ value }: { value: LeadStatus }) {
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

export default function Leads() {
  const { leads, loading, error, reload } = useLeadsData();
  const { projectManagers, fundingCalls, reload: reloadOffers } = useOffersData();

  const [view, setView] = useState<ViewTab>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [toDelete, setToDelete] = useState<Lead | null>(null);

  // Promote-to-offer flow
  const [promoteFromLead, setPromoteFromLead] = useState<Lead | null>(null);
  const [offerFormOpen, setOfferFormOpen] = useState(false);

  const counts = useMemo(() => ({
    all: leads.length,
    in_valutazione: leads.filter((l) => l.status === 'in_valutazione').length,
    promosso: leads.filter((l) => l.status === 'promosso').length,
    rifiutato: leads.filter((l) => l.status === 'rifiutato').length,
  }), [leads]);

  const visible = useMemo(
    () => view === 'all' ? leads : leads.filter((l) => l.status === view),
    [leads, view],
  );

  function openNew() { setEditing(null); setFormOpen(true); }
  function openEdit(l: Lead) { setEditing(l); setFormOpen(true); }

  async function handleDelete() {
    if (!toDelete) return;
    await leadsService.remove(toDelete.id);
    setToDelete(null);
    await reload();
  }

  function startPromote(lead: Lead) {
    setFormOpen(false);
    setPromoteFromLead(lead);
    setOfferFormOpen(true);
  }

  async function handleOfferSaved(offer?: Offer) {
    if (promoteFromLead && offer) {
      await leadsService.update(promoteFromLead.id, {
        status: 'promosso',
        promoted_offer_id: offer.id,
      });
    }
    setPromoteFromLead(null);
    setOfferFormOpen(false);
    await Promise.all([reload(), reloadOffers()]);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lead</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Tecnologie in valutazione · {leads.length} {leads.length === 1 ? 'lead' : 'lead'}
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition"
        >
          <Plus className="w-4 h-4" />
          Nuovo lead
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
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

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center text-sm text-slate-400">
          Caricamento…
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center">
          <FlaskConical className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            {leads.length === 0 ? 'Nessun lead. Clicca "+ Nuovo lead" per iniziare.' : 'Nessun lead in questa vista.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((l) => (
            <button
              key={l.id}
              onClick={() => openEdit(l)}
              className="text-left bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-indigo-200 transition p-5 flex flex-col gap-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900 leading-tight line-clamp-2">{l.name}</h3>
                <StatusBadge value={l.status} />
              </div>
              {(l.pi || l.ente) && (
                <p className="text-xs text-slate-500">
                  {l.pi && <span><strong>PI:</strong> {l.pi}</span>}
                  {l.pi && l.ente && <span> · </span>}
                  {l.ente && <span>{l.ente}</span>}
                </p>
              )}
              {l.description && (
                <p className="text-sm text-slate-600 line-clamp-3">{l.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-slate-400 mt-auto pt-2">
                <span>Creato {formatDate(l.created_at)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setToDelete(l); }}
                  className="text-slate-300 hover:text-red-600 transition"
                >
                  Elimina
                </button>
              </div>
            </button>
          ))}
        </div>
      )}

      <LeadFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={reload}
        onPromote={startPromote}
        lead={editing}
        fundingCalls={fundingCalls}
      />

      <OfferFormModal
        open={offerFormOpen}
        onClose={() => { setOfferFormOpen(false); setPromoteFromLead(null); }}
        onSaved={handleOfferSaved}
        offer={null}
        initial={promoteFromLead ? {
          name: promoteFromLead.name,
          pi: promoteFromLead.pi ?? '',
          ente: promoteFromLead.ente ?? '',
          notes: promoteFromLead.description ?? '',
        } : undefined}
        projectManagers={projectManagers}
        fundingCalls={fundingCalls}
      />

      <ConfirmDialog open={!!toDelete} title="Eliminare il lead?"
        message={toDelete ? `"${toDelete.name}" e i suoi file verranno rimossi definitivamente.` : ''}
        confirmLabel="Elimina" variant="danger"
        onConfirm={handleDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
