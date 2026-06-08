import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Bell, CalendarClock, CheckCircle2, Clock, Edit3, FileText, Link2, X,
  Trash2, Upload, UserPlus, Users, XCircle,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import { useAuth } from '../contexts/AuthContext';
import { useOffersData } from '../hooks/useOffersData';
import {
  conceptsService, conceptAssigneesService,
  conceptDeadlinesService, conceptFilesService,
  leadCandidatesService, offersService, activityLogService,
} from '../lib/dataService';
import { isDemoMode, supabase } from '../lib/supabase';
import EntityTasks from '../components/EntityTasks';
import EntityComments from '../components/EntityComments';
import ProjectPipelineCard from '../components/ProjectPipelineCard';
import { formatDate } from '../lib/format';
import ConceptFormModal from '../components/concepts/ConceptFormModal';
import ConceptTemplatePanel from '../components/concepts/ConceptTemplatePanel';
import OfferFormModal from '../components/offerte/OfferFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import type {
  Concept, ConceptAssignee, ConceptStatus,
  ConceptRevisionDeadline, ConceptFile, Offer, ProjectManager, LeadCandidate,
} from '../types';

const STATUS_MAP: Record<ConceptStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  in_valutazione: { label: 'In valutazione', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
  promosso:       { label: 'Promosso',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  rifiutato:      { label: 'Rifiutato',      cls: 'bg-slate-50 text-slate-600 border-slate-200', Icon: XCircle },
};


export default function ConceptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projectManagers, fundingCalls, offers, reload: reloadOffers } = useOffersData();

  const [concept, setConcept] = useState<Concept | null>(null);
  const [pipelineLead, setPipelineLead] = useState<LeadCandidate | null>(null);
  const [pipelineOffer, setPipelineOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [assignees, setAssignees] = useState<ConceptAssignee[]>([]);
  const [deadlines, setDeadlines] = useState<ConceptRevisionDeadline[]>([]);
  const [conceptFiles, setConceptFiles] = useState<ConceptFile[]>([]);
  const [fileUploading, setFileUploading] = useState(false);
  const conceptFileInputRef = useRef<HTMLInputElement>(null);

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [toDelete, setToDelete] = useState(false);
  const [editingCall, setEditingCall] = useState(false);
  const [callSaving, setCallSaving] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState('');

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const [c, a, d, cf] = await Promise.all([
        conceptsService.get(id),
        conceptAssigneesService.list(id),
        conceptDeadlinesService.list(id),
        conceptFilesService.list(id),
      ]);
      if (!c) {
        setError('Concept non trovato.');
      } else {
        setConcept(c);
        const [pl, po] = await Promise.all([
          leadCandidatesService.findByPromotedConceptId(c.id),
          c.promoted_offer_id ? offersService.get(c.promoted_offer_id) : Promise.resolve(null),
        ]);
        setPipelineLead(pl);
        setPipelineOffer(po);
      }
      setAssignees(a);
      setDeadlines(d);
      setConceptFiles(cf);
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Errore caricamento');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!concept || !user) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setFileUploading(true);
    try {
      const created = await conceptFilesService.upload(concept.id, file, user.id);
      setConceptFiles((prev) => [created, ...prev]);
    } finally {
      setFileUploading(false);
      if (conceptFileInputRef.current) conceptFileInputRef.current.value = '';
    }
  }

  async function handleFileRemove(id: string, filePath: string) {
    await conceptFilesService.remove(id, filePath);
    setConceptFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleDelete() {
    if (!concept) return;
    void activityLogService.add({ user_email: user?.email ?? '', user_name: null, action: 'deleted', entity_type: 'concept', entity_id: concept.id, entity_name: concept.name });
    await conceptsService.remove(concept.id);
    navigate('/concepts');
  }

  async function handleOfferSaved(offer?: Offer) {
    if (concept && offer) {
      void activityLogService.add({ user_email: user?.email ?? '', user_name: null, action: 'approved', entity_type: 'concept', entity_id: concept.id, entity_name: concept.name });
      await conceptsService.update(concept.id, { status: 'promosso', promoted_offer_id: offer.id });
    }
    setPromoteOpen(false);
    await Promise.all([reload(), reloadOffers()]);
    if (offer) navigate(`/offerte/${offer.id}`);
  }

  if (loading) {
    return <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center text-sm text-slate-400">Caricamento…</div>;
  }
  if (error || !concept) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/concepts')} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Torna ai concept
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error ?? 'Concept non trovato.'}</div>
      </div>
    );
  }

  const { label: statusLabel, cls: statusCls, Icon: StatusIcon } = STATUS_MAP[concept.status];

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/concepts')} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
        <ArrowLeft className="w-3.5 h-3.5" /> Torna ai concept
      </button>

      {/* Pipeline */}
      <ProjectPipelineCard
        current="concept"
        lead={pipelineLead    ? { id: pipelineLead.id,  label: pipelineLead.researcher_name } : null}
        concept={{ id: concept.id, label: concept.name }}
        offer={pipelineOffer  ? { id: pipelineOffer.id, label: pipelineOffer.name }           : null}
        onCreateOffer={concept.status !== 'promosso' ? () => setPromoteOpen(true) : undefined}
      />

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-slate-900 leading-tight">{concept.name}</h1>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${statusCls}`}>
                <StatusIcon className="w-3 h-3" />
                {statusLabel}
              </span>
            </div>
            {(concept.pi || concept.ente) && (
              <p className="text-sm text-slate-500 mt-1">
                {concept.pi && <span><strong>PI:</strong> {concept.pi}</span>}
                {concept.pi && concept.ente && <span> · </span>}
                {concept.ente && <span>{concept.ente}</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {concept.status !== 'promosso' && (
              <button onClick={() => setPromoteOpen(true)}
                className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition">
                ✓ Promuovi a offerta
              </button>
            )}
            <button onClick={() => setEditOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" /> Modifica
            </button>
            <button onClick={() => setToDelete(true)}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Elimina
            </button>
          </div>
        </div>
        {concept.description && (
          <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{concept.description}</p>
        )}
        {concept.notes && (
          <div className="mt-3 bg-slate-50 rounded-lg px-3 py-2">
            <p className="text-xs font-medium text-slate-500 mb-1">Note</p>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{concept.notes}</p>
          </div>
        )}
      </div>

      {/* Bando associato */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5" /> Bando associato
        </p>
        {editingCall ? (
          <div className="flex items-center gap-2">
            <select
              autoFocus
              defaultValue={concept.funding_call_id ?? ''}
              disabled={callSaving}
              onChange={async (e) => {
                setCallSaving(true);
                await conceptsService.update(concept.id, { funding_call_id: e.target.value || null });
                await reload();
                setEditingCall(false);
                setCallSaving(false);
              }}
              className="flex-1 text-sm px-3 py-2 border border-indigo-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            >
              <option value="">— Nessun bando —</option>
              {fundingCalls.map((fc) => (
                <option key={fc.id} value={fc.id}>{fc.code} — {fc.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => setEditingCall(false)} className="p-2 text-slate-400 hover:text-slate-600 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : concept.funding_call_id ? (() => {
          const fc = fundingCalls.find((f) => f.id === concept.funding_call_id);
          return (
            <div className="flex items-center justify-between gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="w-4 h-4 text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-indigo-700 font-mono truncate">{fc?.code}</p>
                  <p className="text-xs text-indigo-600 truncate">{fc?.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCall(true)}
                className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition"
              >
                Cambia
              </button>
            </div>
          );
        })() : (
          <button
            type="button"
            onClick={() => setEditingCall(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-indigo-200 transition"
          >
            <Link2 className="w-4 h-4" />
            Assegna bando
          </button>
        )}
      </div>

      {/* Scadenza concept */}
      {(() => {
        const todayMs = Date.now();
        const dl = concept.deadline;
        let chip: React.ReactNode = null;
        if (dl) {
          const days = Math.ceil((new Date(dl).getTime() - todayMs) / 86400000);
          const past = days < 0;
          const urgent = !past && days <= 14;
          const soon = !past && !urgent && days <= 30;
          const [bg, border, text, badge] = past
            ? ['bg-red-50', 'border-red-200', 'text-red-700', 'bg-red-100 text-red-700']
            : urgent
            ? ['bg-amber-50', 'border-amber-200', 'text-amber-700', 'bg-amber-100 text-amber-700']
            : soon
            ? ['bg-yellow-50', 'border-yellow-200', 'text-yellow-700', 'bg-yellow-100 text-yellow-700']
            : ['bg-emerald-50', 'border-emerald-200', 'text-emerald-700', 'bg-emerald-100 text-emerald-700'];
          const label = past ? `scaduta ${Math.abs(days)} gg fa` : days === 0 ? 'oggi!' : `tra ${days} gg`;
          chip = (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${bg} ${border}`}>
              <CalendarClock className={`w-5 h-5 shrink-0 ${text}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${text} opacity-70`}>Scadenza concept</p>
                <p className={`text-sm font-bold ${text}`}>{dl}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg tabular-nums shrink-0 ${badge}`}>{label}</span>
              <button type="button" onClick={() => { setEditingDeadline(true); setDeadlineInput(dl); }}
                className={`shrink-0 text-xs font-medium ${text} hover:opacity-80 transition`}>Modifica</button>
            </div>
          );
        }
        return (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5" /> Scadenza concept
            </p>
            {editingDeadline ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  autoFocus
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  className="flex-1 text-sm px-3 py-2 border border-indigo-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                />
                <button
                  type="button"
                  onClick={async () => {
                    await conceptsService.update(concept.id, { deadline: deadlineInput || null });
                    await reload();
                    setEditingDeadline(false);
                  }}
                  className="px-3 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"
                >✓</button>
                {dl && (
                  <button
                    type="button"
                    onClick={async () => {
                      await conceptsService.update(concept.id, { deadline: null });
                      await reload();
                      setEditingDeadline(false);
                    }}
                    className="px-3 py-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition"
                  >Rimuovi</button>
                )}
                <button type="button" onClick={() => setEditingDeadline(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : chip ? chip : (
              <button
                type="button"
                onClick={() => { setEditingDeadline(true); setDeadlineInput(''); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 hover:border-slate-400 text-slate-500 hover:text-slate-700 text-sm font-medium rounded-xl transition"
              >
                <CalendarClock className="w-4 h-4" />
                Imposta scadenza
              </button>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AssigneesSection conceptId={concept.id} assignees={assignees} projectManagers={projectManagers} onChange={reload} />
        <DeadlinesSection conceptId={concept.id} deadlines={deadlines} onChange={reload} />
      </div>

      <PanelSection
        conceptId={concept.id}
        conceptName={concept.name}
        assignees={assignees}
        projectManagers={projectManagers}
        onChange={reload}
      />

      {/* Task panel */}
      {user && (
        <EntityTasks
          entityId={concept.id}
          entityType="concept"
          entityName={concept.name}
          projectManagers={projectManagers}
          userId={user.id}
        />
      )}

      {/* Comments */}
      <EntityComments entityType="concept" entityId={concept.id} projectManagers={projectManagers} />

      {/* Product Concept Template */}
      <ConceptTemplatePanel
        conceptId={concept.id}
        data={concept.concept_data ?? null}
        onSave={async (templateData) => {
          await conceptsService.update(concept.id, { concept_data: templateData });
          await reload();
        }}
        projectManagers={projectManagers}
        currentUserName={projectManagers.find((p) => p.email && p.email === user?.email)?.name ?? user?.email}
      />

      {/* Documenti tecnologia */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-indigo-500" />
            Documenti tecnologia
          </h3>
          <button
            type="button"
            disabled={fileUploading}
            onClick={() => conceptFileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            {fileUploading ? 'Upload…' : 'Carica file'}
          </button>
          <input ref={conceptFileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
        </div>
        {conceptFiles.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">Nessun documento. Carica schede tecniche, brevetti o descrizioni.</p>
        ) : (
          <ul className="space-y-2">
            {conceptFiles.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                <a href={f.file_url} target="_blank" rel="noreferrer"
                  className="flex-1 text-sm text-indigo-600 hover:underline truncate min-w-0">
                  {f.filename}
                </a>
                <span className="text-[11px] text-slate-400 shrink-0">{formatDate(f.created_at)}</span>
                <button onClick={() => void handleFileRemove(f.id, f.file_path)}
                  className="text-slate-300 hover:text-red-500 transition shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConceptFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          void activityLogService.add({ user_email: user?.email ?? '', user_name: null, action: 'updated', entity_type: 'concept', entity_id: concept.id, entity_name: concept.name });
          setEditOpen(false);
          void reload();
        }}
        concept={concept}
        projectManagers={projectManagers}
      />

      <OfferFormModal
        open={promoteOpen}
        onClose={() => setPromoteOpen(false)}
        onSaved={handleOfferSaved}
        offer={null}
        initial={{
          name: concept.name,
          pi: concept.pi ?? '',
          ente: concept.ente ?? '',
          notes: concept.description ?? '',
        }}
        projectManagers={projectManagers}
        fundingCalls={fundingCalls}
        offers={offers}
      />

      <ConfirmDialog open={toDelete} title="Eliminare il concept?"
        message={`"${concept.name}" verrà rimosso definitivamente insieme a versioni, commenti e scadenze.`}
        confirmLabel="Elimina" variant="danger"
        onConfirm={handleDelete} onCancel={() => setToDelete(false)} />
    </div>
  );
}

// ============================================================
// Assignees
// ============================================================

function AssigneesSection({
  conceptId, assignees, projectManagers, onChange,
}: {
  conceptId: string;
  assignees: ConceptAssignee[];
  projectManagers: ProjectManager[];
  onChange: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [selectedPm, setSelectedPm] = useState('');
  const [asPm, setAsPm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  const teamAssignees = assignees.filter((a) => a.role !== 'Panelist');
  const assignedIds = new Set(assignees.map((a) => a.project_manager_id));
  const available = projectManagers.filter((p) => p.active && !assignedIds.has(p.id));
  const currentPmId = teamAssignees.find((a) => a.role === 'Project Manager')?.project_manager_id ?? null;

  async function add() {
    if (!selectedPm) return;
    setSaving(true); setSectionError(null);
    try {
      if (asPm && currentPmId && currentPmId !== selectedPm) {
        await conceptAssigneesService.setRole(conceptId, currentPmId, null);
      }
      await conceptAssigneesService.add(conceptId, selectedPm, asPm ? 'Project Manager' : null);
      setSelectedPm(''); setAsPm(false); setAdding(false);
      await onChange();
    } catch (e) {
      setSectionError(e instanceof Error ? e.message : 'Errore durante il salvataggio.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePm(pmId: string) {
    setSaving(true); setSectionError(null);
    try {
      const isPm = currentPmId === pmId;
      if (!isPm && currentPmId) {
        await conceptAssigneesService.setRole(conceptId, currentPmId, null);
      }
      await conceptAssigneesService.setRole(conceptId, pmId, isPm ? null : 'Project Manager');
      await onChange();
    } catch (e) {
      setSectionError(e instanceof Error ? e.message : 'Errore durante il salvataggio.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(pmId: string) {
    setSaving(true); setSectionError(null);
    try {
      await conceptAssigneesService.remove(conceptId, pmId);
      await onChange();
    } catch (e) {
      setSectionError(e instanceof Error ? e.message : 'Errore durante la rimozione.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" />
          Chi ci sta lavorando ({teamAssignees.length})
        </h3>
        {!adding && available.length > 0 && (
          <button type="button" onClick={() => setAdding(true)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            <UserPlus className="w-3.5 h-3.5" /> Aggiungi
          </button>
        )}
      </div>

      {sectionError && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          {sectionError}
        </div>
      )}

      {adding && (
        <div className="space-y-2 mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <select value={selectedPm} onChange={(e) => setSelectedPm(e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Seleziona persona…</option>
            {available.map((pm) => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
          </select>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={asPm} onChange={(e) => setAsPm(e.target.checked)}
              className="rounded accent-indigo-600" />
            <span className="text-sm text-slate-700">Designa come Project Manager</span>
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => void add()} disabled={!selectedPm || saving}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Salvataggio…' : 'Aggiungi'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setSelectedPm(''); setAsPm(false); }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900">
              Annulla
            </button>
          </div>
        </div>
      )}

      {teamAssignees.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3">Nessun assegnatario.</p>
      ) : (
        <ul className="space-y-1.5">
          {teamAssignees.map((a) => {
            const isPm = a.role === 'Project Manager';
            return (
              <li key={a.project_manager_id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50">
                <Avatar
                  name={a.project_manager?.name ?? ''}
                  url={a.project_manager?.avatar_url}
                  size="md"
                  fallbackClassName={isPm ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700'}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{a.project_manager?.name ?? '—'}</p>
                  {a.project_manager?.email && (
                    <p className="text-xs text-slate-400 truncate">{a.project_manager.email}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void handleTogglePm(a.project_manager_id)}
                  disabled={saving}
                  title={isPm ? 'Rimuovi ruolo PM' : 'Nomina Project Manager'}
                  className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition shrink-0 disabled:opacity-50 ${
                    isPm
                      ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                      : 'bg-white text-slate-400 border-dashed border-slate-300 hover:border-indigo-400 hover:text-indigo-600'
                  }`}
                >
                  PM
                </button>
                <button type="button" onClick={() => void remove(a.project_manager_id)} disabled={saving}
                  className="text-slate-300 hover:text-red-500 transition disabled:opacity-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// Panel di revisione
// ============================================================

function PanelSection({
  conceptId,
  conceptName,
  assignees,
  projectManagers,
  onChange,
}: {
  conceptId: string;
  conceptName: string;
  assignees: ConceptAssignee[];
  projectManagers: ProjectManager[];
  onChange: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [selectedPm, setSelectedPm] = useState('');
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifyDone, setNotifyDone] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  const panelists = assignees.filter((a) => a.role === 'Panelist');
  const assignedIds = new Set(assignees.map((a) => a.project_manager_id));
  const available = projectManagers.filter((p) => p.active && !assignedIds.has(p.id));

  async function addPanelist() {
    if (!selectedPm) return;
    setSaving(true); setSectionError(null);
    try {
      await conceptAssigneesService.add(conceptId, selectedPm, 'Panelist');
      setSelectedPm(''); setAdding(false);
      await onChange();
    } catch (e) {
      setSectionError(e instanceof Error ? e.message : 'Errore durante il salvataggio.');
    } finally {
      setSaving(false);
    }
  }

  async function removePanelist(pmId: string) {
    setSaving(true); setSectionError(null);
    try {
      await conceptAssigneesService.remove(conceptId, pmId);
      await onChange();
    } catch (e) {
      setSectionError(e instanceof Error ? e.message : 'Errore durante la rimozione.');
    } finally {
      setSaving(false);
    }
  }

  async function notifyPanel() {
    if (isDemoMode || !supabase || panelists.length === 0) return;
    setNotifying(true);
    const conceptUrl = `${window.location.origin}/concepts/${conceptId}`;
    await Promise.all(
      panelists.map((a) => {
        const email = a.project_manager?.email;
        if (!email) return Promise.resolve();
        return supabase!.functions.invoke('send-notification-email', {
          body: {
            to: email,
            subject: `Concept pronto per revisione: ${conceptName}`,
            body: `Il concept "${conceptName}" è pronto per la tua revisione.`,
            url: conceptUrl,
            fields: [
              { label: 'Concept', value: conceptName },
              { label: 'Revisore', value: a.project_manager?.name ?? email },
            ],
          },
        }).catch(() => {});
      })
    );
    setNotifying(false);
    setNotifyDone(true);
    setTimeout(() => setNotifyDone(false), 3000);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Users className="w-4 h-4 text-violet-500" />
          Panel di revisione ({panelists.length})
        </h3>
        <div className="flex items-center gap-2">
          {panelists.length > 0 && (
            <button
              type="button"
              onClick={() => void notifyPanel()}
              disabled={notifying}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition ${
                notifyDone
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
              } disabled:opacity-50`}
            >
              <Bell className="w-3.5 h-3.5" />
              {notifyDone ? 'Notifiche inviate!' : notifying ? 'Invio…' : 'Notifica panel'}
            </button>
          )}
          {!adding && available.length > 0 && (
            <button type="button" onClick={() => setAdding(true)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              <UserPlus className="w-3.5 h-3.5" /> Aggiungi
            </button>
          )}
        </div>
      </div>

      {sectionError && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          {sectionError}
        </div>
      )}

      {adding && (
        <div className="space-y-2 mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <select value={selectedPm} onChange={(e) => setSelectedPm(e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Seleziona revisore…</option>
            {available.map((pm) => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="button" onClick={() => void addPanelist()} disabled={!selectedPm || saving}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Salvataggio…' : 'Aggiungi'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setSelectedPm(''); }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900">
              Annulla
            </button>
          </div>
        </div>
      )}

      {panelists.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3">Nessun revisore nel panel.</p>
      ) : (
        <ul className="space-y-1.5">
          {panelists.map((a) => (
            <li key={a.project_manager_id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50">
              <Avatar
                name={a.project_manager?.name ?? ''}
                url={a.project_manager?.avatar_url}
                size="md"
                fallbackClassName="bg-violet-100 text-violet-700"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{a.project_manager?.name ?? '—'}</p>
                {a.project_manager?.email && (
                  <p className="text-xs text-slate-400 truncate">{a.project_manager.email}</p>
                )}
              </div>
              <button type="button" onClick={() => void removePanelist(a.project_manager_id)} disabled={saving}
                className="text-slate-300 hover:text-red-500 transition disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// Deadlines
// ============================================================

function DeadlinesSection({
  conceptId, deadlines, onChange,
}: {
  conceptId: string;
  deadlines: ConceptRevisionDeadline[];
  onChange: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');

  async function add() {
    if (!label.trim() || !date) return;
    await conceptDeadlinesService.create({
      concept_id: conceptId,
      label: label.trim(),
      due_date: date,
      completed: false,
      notes: null,
    });
    setLabel(''); setDate(''); setAdding(false);
    await onChange();
  }

  async function toggleCompleted(d: ConceptRevisionDeadline) {
    await conceptDeadlinesService.update(d.id, { completed: !d.completed });
    await onChange();
  }

  async function remove(d: ConceptRevisionDeadline) {
    await conceptDeadlinesService.remove(d.id);
    await onChange();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-500" />
          Scadenze revisioni ({deadlines.length})
        </h3>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
            + Aggiungi
          </button>
        )}
      </div>

      {adding && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <input type="text" placeholder="Etichetta (es. Rev. v1)" value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <div className="flex gap-2 sm:col-span-2">
            <button onClick={add} disabled={!label.trim() || !date}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              Aggiungi
            </button>
            <button onClick={() => { setAdding(false); setLabel(''); setDate(''); }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900">
              Annulla
            </button>
          </div>
        </div>
      )}

      {deadlines.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3">Nessuna scadenza definita.</p>
      ) : (
        <ul className="space-y-1.5">
          {deadlines.map((d) => {
            const overdue = !d.completed && d.due_date < today;
            return (
              <li key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50">
                <input type="checkbox" checked={d.completed} onChange={() => toggleCompleted(d)} className="rounded" />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${d.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    {d.label}
                  </p>
                  <p className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                    {formatDate(d.due_date)}{overdue && ' (in ritardo)'}
                  </p>
                </div>
                <button onClick={() => remove(d)}
                  className="text-slate-300 hover:text-red-500 transition">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
