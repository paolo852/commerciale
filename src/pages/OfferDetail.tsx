import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, CalendarClock, CheckCircle2, CheckSquare, Clock, Edit3, Euro, FolderCheck, LayoutGrid, Percent, Trash2, User, XCircle } from 'lucide-react';
import Avatar from '../components/Avatar';
import { useAuth } from '../contexts/AuthContext';
import { useOffersData } from '../hooks/useOffersData';
import { offersService, activityLogService, leadCandidatesService } from '../lib/dataService';
import { formatDate, formatEUR } from '../lib/format';
import { StatusBadge, OutcomeBadge, TypeBadge } from '../components/Badges';
import OfferFormModal from '../components/offerte/OfferFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import EntityTasks from '../components/EntityTasks';
import EntityComments from '../components/EntityComments';
import OfferFilesAndReviews from '../components/offerte/OfferFilesAndReviews';
import OfferTeamPanel from '../components/offerte/OfferTeamPanel';
import OfferLinksPanel from '../components/offerte/OfferLinksPanel';
import OfferBudgetTracker from '../components/offerte/OfferBudgetTracker';
import OfferTimeline from '../components/offerte/OfferTimeline';
import OfferContactsPanel from '../components/offerte/OfferContactsPanel';
import { RichTextView } from '../components/RichText';
import type { LeadCandidate, Offer } from '../types';

type TabId = 'progetto' | 'planning' | 'docs' | 'activity';

const TAB_META: Record<TabId, { label: string; Icon: typeof LayoutGrid }> = {
  progetto: { label: 'Progetto',           Icon: LayoutGrid },
  planning: { label: 'Pianificazione',     Icon: CalendarClock },
  docs:     { label: 'Documenti',          Icon: FolderCheck },
  activity: { label: 'Checklist & commenti', Icon: CheckSquare },
};

// Mini-card KPI usata nello strip metrico dell'header
function KpiCell({ Icon, label, value, valueClass }: {
  Icon: typeof LayoutGrid; label: string; value: string; valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 flex-1 min-w-[140px] border-r border-slate-200/70 last:border-r-0">
      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-semibold mt-0.5 truncate ${valueClass ?? 'text-slate-900'}`} title={value}>{value}</p>
      </div>
    </div>
  );
}

// Elemento inline label:valore per meta-info sotto le metriche
function MetaItem({ label, value, valueCls }: { label: string; value: string; valueCls?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`text-slate-700 ${valueCls ?? ''}`}>{value}</span>
    </span>
  );
}

export default function OfferDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projectManagers, fundingCalls, offers, reload: reloadList } = useOffersData();

  const [offer, setOffer] = useState<Offer | null>(null);
  const [pipelineLead, setPipelineLead] = useState<LeadCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [toDelete, setToDelete] = useState(false);
  const [toApprove, setToApprove] = useState(false);
  const [approving, setApproving] = useState(false);
  const [toReject, setToReject] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [toReserve, setToReserve] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [tab, setTab] = useState<TabId>('progetto');

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const o = await offersService.get(id);
      if (!o) { setError('Offerta non trovata.'); }
      else {
        setOffer(o);
        const lead = await leadCandidatesService.findByPromotedOfferId(o.id);
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

  async function handleReserve() {
    if (!offer) return;
    setReserving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const updated = await offersService.update(offer.id, {
        outcome: 'riserva',
        decided_at: today,
        ...(offer.status === 'in_lavorazione' ? { status: 'presentata', submitted_at: offer.submitted_at ?? today } : {}),
      });
      setOffer(updated);
      void reloadList();
      void activityLogService.add({
        user_email: user?.email ?? '',
        user_name: null,
        action: 'updated',
        entity_type: 'offer',
        entity_id: offer.id,
        entity_name: offer.name,
      });
    } finally {
      setReserving(false);
      setToReserve(false);
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

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div className="flex-1 min-w-0">
            {/* Breadcrumb lead */}
            {pipelineLead && (
              <button
                onClick={() => navigate(`/leads/${pipelineLead.id}`)}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-600 transition mb-1"
              >
                ← Dal lead · {pipelineLead.researcher_name}
              </button>
            )}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
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
                  onClick={() => setToReserve(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-500 border border-amber-500 rounded-lg hover:bg-amber-600 transition flex items-center gap-1.5 shadow-sm shadow-amber-200"
                >
                  <Clock className="w-3.5 h-3.5" /> Reserve list
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

        {/* Key metrics strip (più leggera, divisori verticali) */}
        <div className="flex items-stretch gap-0 flex-wrap bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
          <KpiCell Icon={Calendar} label="Scadenza" value={formatDate(offer.deadline)} />
          <KpiCell Icon={Euro}     label="Importo"  value={formatEUR(offer.budget)} />
          <KpiCell Icon={Percent}  label="Probabilità" value={`${prob}%`} valueClass={probColor} />
          <KpiCell
            Icon={User}
            label={offer.type === 'financed' ? 'Bando' : 'Cliente'}
            value={offer.type === 'financed' ? (offer.funding_call || '—') : (offer.client || '—')}
          />
        </div>

        {/* PI / Ente / Bando rif. / Note / Date — raccolti in una riga di meta-info */}
        {(offer.pi || offer.ente || linkedCall || offer.notes || offer.submitted_at || offer.decided_at) && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-start gap-x-6 gap-y-2 text-xs">
            {offer.pi && (
              <MetaItem label="PI" value={offer.pi} />
            )}
            {offer.ente && (
              <MetaItem label="Ente" value={offer.ente} />
            )}
            {linkedCall && (
              <MetaItem label="Bando rif." value={`${linkedCall.code} — ${linkedCall.name}`} valueCls="text-indigo-700 font-medium" />
            )}
            {offer.submitted_at && (
              <MetaItem label="Presentata" value={formatDate(offer.submitted_at)} />
            )}
            {offer.decided_at && (
              <MetaItem label="Decisa" value={formatDate(offer.decided_at)} />
            )}
          </div>
        )}
        {offer.notes && (
          <div className="mt-3 bg-amber-50/50 border border-amber-100 rounded-xl px-3.5 py-2.5">
            <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide mb-0.5">Note offerta</p>
            <RichTextView content={offer.notes} />
          </div>
        )}
      </div>

      {/* ── Tab navigation ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-1.5 inline-flex flex-wrap gap-1 w-fit max-w-full">
        {(['progetto', 'planning', 'docs', 'activity'] as const).map((t) => {
          const meta = TAB_META[t];
          const isActive = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <meta.Icon className="w-3.5 h-3.5" />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ────────────────────────────────────────── */}
      {tab === 'progetto' && (
        <div className="space-y-5">
          <OfferTeamPanel
            offerId={offer.id}
            projectManagers={projectManagers}
          />

          <OfferLinksPanel
            offer={offer}
            onUpdate={(patch) => setOffer((o) => (o ? { ...o, ...patch } : o))}
          />

          <OfferContactsPanel offerId={offer.id} />
        </div>
      )}

      {tab === 'planning' && (
        <div className="space-y-5">
          <OfferTimeline offerId={offer.id} />
          <OfferBudgetTracker offerId={offer.id} offerBudget={offer.budget} />
        </div>
      )}

      {tab === 'docs' && (
        <div className="space-y-5">
          <OfferFilesAndReviews
            offerId={offer.id}
            offerName={offer.name}
            projectManagers={projectManagers}
          />
        </div>
      )}

      {tab === 'activity' && (
        <div className="space-y-5">
          {user && (
            <EntityTasks
              entityId={offer.id}
              entityType="offer"
              entityName={offer.name}
              projectManagers={projectManagers}
              userId={user.id}
            />
          )}
          <EntityComments entityType="offer" entityId={offer.id} projectManagers={projectManagers} />
        </div>
      )}

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

      <ConfirmDialog
        open={toReserve}
        title="Mettere l'offerta in reserve list?"
        message={`Verrà registrata la data odierna come data di esito e l'offerta risulterà in reserve list (valutata ma in attesa che si liberino fondi).`}
        confirmLabel={reserving ? 'Aggiornamento…' : 'Reserve list'}
        variant="default"
        onConfirm={() => void handleReserve()}
        onCancel={() => setToReserve(false)}
      />
    </div>
  );
}
