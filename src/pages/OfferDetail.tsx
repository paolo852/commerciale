import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, CheckCircle2, Edit3, Euro, Percent, Trash2, User, XCircle } from 'lucide-react';
import Avatar from '../components/Avatar';
import { useAuth } from '../contexts/AuthContext';
import { useOffersData } from '../hooks/useOffersData';
import { offersService, activityLogService, conceptsService, leadCandidatesService } from '../lib/dataService';
import { formatDate, formatEUR } from '../lib/format';
import { StatusBadge, OutcomeBadge, TypeBadge } from '../components/Badges';
import OfferFormModal from '../components/offerte/OfferFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import EntityTasks from '../components/EntityTasks';
import EntityComments from '../components/EntityComments';
import ProjectPipelineCard from '../components/ProjectPipelineCard';
import type { Concept, LeadCandidate, Offer } from '../types';

export default function OfferDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projectManagers, fundingCalls, offers, reload: reloadList } = useOffersData();

  const [offer, setOffer] = useState<Offer | null>(null);
  const [pipelineConcept, setPipelineConcept] = useState<Concept | null>(null);
  const [pipelineLead, setPipelineLead] = useState<LeadCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [toDelete, setToDelete] = useState(false);
  const [toApprove, setToApprove] = useState(false);
  const [approving, setApproving] = useState(false);
  const [toReject, setToReject] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const o = await offersService.get(id);
      if (!o) { setError('Offerta non trovata.'); }
      else {
        setOffer(o);
        const concept = await conceptsService.findByPromotedOfferId(o.id);
        setPipelineConcept(concept);
        const lead = concept
          ? await leadCandidatesService.findByPromotedConceptId(concept.id)
          : await leadCandidatesService.findByPromotedOfferId(o.id);
        setPipelineLead(lead);
      }
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Errore caricamento');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  async function handleDelete() {
    if (!offer) return;
    await offersService.remove(offer.id);
    void activityLogService.add({
      user_email: user?.email ?? '',
      user_name: null,
      action: 'deleted',
      entity_type: 'offer',
      entity_id: offer.id,
      entity_name: offer.name,
    });
    navigate('/offerte');
  }

  async function handleApprove() {
    if (!offer) return;
    setApproving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const updated = await offersService.update(offer.id, {
        outcome: 'approvato',
        decided_at: today,
        ...(offer.status === 'in_lavorazione' ? { status: 'presentata', submitted_at: offer.submitted_at ?? today } : {}),
      });
      setOffer(updated);
      void reloadList();
      void activityLogService.add({
        user_email: user?.email ?? '',
        user_name: null,
        action: 'approved',
        entity_type: 'offer',
        entity_id: offer.id,
        entity_name: offer.name,
      });
    } finally {
      setApproving(false);
      setToApprove(false);
    }
  }

  async function handleReject() {
    if (!offer) return;
    setRejecting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const updated = await offersService.update(offer.id, {
        outcome: 'rifiutato',
        decided_at: today,
        ...(offer.status === 'in_lavorazione' ? { status: 'presentata', submitted_at: offer.submitted_at ?? today } : {}),
      });
      setOffer(updated);
      void reloadList();
      void activityLogService.add({
        user_email: user?.email ?? '',
        user_name: null,
        action: 'rejected',
        entity_type: 'offer',
        entity_id: offer.id,
        entity_name: offer.name,
      });
    } finally {
      setRejecting(false);
      setToReject(false);
    }
  }

  if (loading) return (
    <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center text-sm text-slate-400">
      Caricamento…
    </div>
  );
  if (error || !offer) return (
    <div className="space-y-4">
      <button onClick={() => navigate('/offerte')} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
        <ArrowLeft className="w-3.5 h-3.5" /> Torna alle offerte
      </button>
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error ?? 'Offerta non trovata.'}</div>
    </div>
  );

  const pm = offer.project_manager_id ? projectManagers.find((p) => p.id === offer.project_manager_id) : null;
  const linkedCall = offer.consulting_call_id
    ? fundingCalls.find((f) => f.id === offer.consulting_call_id)
    : null;

  const prob = offer.probability ?? 50;
  const probColor = prob >= 70 ? 'text-emerald-600' : prob >= 40 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/offerte')} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
        <ArrowLeft className="w-3.5 h-3.5" /> Torna alle offerte
      </button>

      {/* Pipeline */}
      <ProjectPipelineCard
        current="offer"
        lead={pipelineLead    ? { id: pipelineLead.id,    label: pipelineLead.researcher_name } : null}
        concept={pipelineConcept ? { id: pipelineConcept.id, label: pipelineConcept.name }      : null}
        offer={{ id: offer.id, label: offer.name }}
      />

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-semibold text-slate-900">{offer.name}</h1>
              <TypeBadge value={offer.type} />
              <StatusBadge value={offer.status} />
              <OutcomeBadge value={offer.outcome} />
            </div>
            {pm && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                <Avatar name={pm.name} url={pm.avatar_url} size="xs" fallbackClassName="bg-violet-200 text-violet-800" />
                {pm.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {offer.outcome === 'nessuno' && (
              <>
                <button
                  onClick={() => setToApprove(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 border border-emerald-600 rounded-lg hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm shadow-emerald-200"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approva
                </button>
                <button
                  onClick={() => setToReject(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 border border-rose-600 rounded-lg hover:bg-rose-700 transition flex items-center gap-1.5 shadow-sm shadow-rose-200"
                >
                  <XCircle className="w-3.5 h-3.5" /> Rifiuta
                </button>
              </>
            )}
            <button
              onClick={() => setEditOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" /> Modifica
            </button>
            <button
              onClick={() => setToDelete(true)}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Elimina
            </button>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Scadenza</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatDate(offer.deadline)}</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <Euro className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Importo</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatEUR(offer.budget)}</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <Percent className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Probabilità</p>
              <p className={`text-sm font-semibold mt-0.5 ${probColor}`}>{prob}%</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
                {offer.type === 'financed' ? 'Bando' : 'Cliente'}
              </p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate max-w-[140px]">
                {offer.type === 'financed' ? (offer.funding_call || '—') : (offer.client || '—')}
              </p>
            </div>
          </div>
        </div>

        {/* PI / Ente */}
        {(offer.pi || offer.ente) && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {offer.pi && (
              <div className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide mb-0.5">PI</p>
                <p className="text-sm text-slate-700">{offer.pi}</p>
              </div>
            )}
            {offer.ente && (
              <div className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide mb-0.5">Ente</p>
                <p className="text-sm text-slate-700">{offer.ente}</p>
              </div>
            )}
          </div>
        )}

        {/* Linked consulting call */}
        {linkedCall && (
          <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
            <p className="text-[11px] text-indigo-500 font-medium uppercase tracking-wide mb-0.5">Bando di riferimento</p>
            <p className="text-sm font-medium text-indigo-800">{linkedCall.code} — {linkedCall.name}</p>
          </div>
        )}

        {/* Notes */}
        {offer.notes && (
          <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-[11px] text-amber-600 font-medium uppercase tracking-wide mb-1">Note</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{offer.notes}</p>
          </div>
        )}

        {/* Dates */}
        {(offer.submitted_at || offer.decided_at) && (
          <div className="mt-3 flex gap-4 flex-wrap text-xs text-slate-500">
            {offer.submitted_at && <span>Presentata: <strong>{formatDate(offer.submitted_at)}</strong></span>}
            {offer.decided_at && <span>Decisa: <strong>{formatDate(offer.decided_at)}</strong></span>}
          </div>
        )}
      </div>

      {/* Tasks */}
      {user && (
        <EntityTasks
          entityId={offer.id}
          entityType="offer"
          entityName={offer.name}
          projectManagers={projectManagers}
          userId={user.id}
        />
      )}

      {/* Comments */}
      <EntityComments entityType="offer" entityId={offer.id} />

      <OfferFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={async () => { setEditOpen(false); await reload(); void reloadList(); }}
        offer={offer}
        projectManagers={projectManagers}
        fundingCalls={fundingCalls}
        offers={offers}
      />

      <ConfirmDialog
        open={toDelete}
        title="Eliminare l'offerta?"
        message={`"${offer.name}" verrà rimossa definitivamente.`}
        confirmLabel="Elimina" variant="danger"
        onConfirm={handleDelete} onCancel={() => setToDelete(false)}
      />

      <ConfirmDialog
        open={toApprove}
        title="Approvare l'offerta?"
        message={`Verrà registrata la data odierna come data di esito e l'offerta risulterà approvata.`}
        confirmLabel={approving ? 'Approvazione…' : 'Approva'}
        variant="default"
        onConfirm={() => void handleApprove()}
        onCancel={() => setToApprove(false)}
      />

      <ConfirmDialog
        open={toReject}
        title="Rifiutare l'offerta?"
        message={`Verrà registrata la data odierna come data di esito e l'offerta risulterà rifiutata.`}
        confirmLabel={rejecting ? 'Rifiuto…' : 'Rifiuta'}
        variant="danger"
        onConfirm={() => void handleReject()}
        onCancel={() => setToReject(false)}
      />
    </div>
  );
}
