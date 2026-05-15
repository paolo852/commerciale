import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Clock, Edit3, FileText,
  MessageSquare, Send, Trash2, Upload, UserPlus, Users, XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOffersData } from '../hooks/useOffersData';
import {
  conceptsService, conceptAssigneesService, conceptVersionsService,
  conceptCommentsService, conceptDeadlinesService, conceptFilesService,
} from '../lib/dataService';
import EntityTasks from '../components/EntityTasks';
import { formatDate } from '../lib/format';
import ConceptFormModal from '../components/concepts/ConceptFormModal';
import ConceptTemplatePanel from '../components/concepts/ConceptTemplatePanel';
import OfferFormModal from '../components/offerte/OfferFormModal';
import MentionInput, { CommentBody } from '../components/concepts/MentionInput';
import ConfirmDialog from '../components/ConfirmDialog';
import type {
  Concept, ConceptAssignee, ConceptStatus, ConceptVersion,
  ConceptVersionComment, ConceptRevisionDeadline, ConceptFile, Offer, ProjectManager,
} from '../types';

const STATUS_MAP: Record<ConceptStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  in_valutazione: { label: 'In valutazione', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
  promosso:       { label: 'Promosso',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  rifiutato:      { label: 'Rifiutato',      cls: 'bg-slate-50 text-slate-600 border-slate-200', Icon: XCircle },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ConceptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projectManagers, fundingCalls, offers, reload: reloadOffers } = useOffersData();

  const [concept, setConcept] = useState<Concept | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [assignees, setAssignees] = useState<ConceptAssignee[]>([]);
  const [versions, setVersions] = useState<ConceptVersion[]>([]);
  const [deadlines, setDeadlines] = useState<ConceptRevisionDeadline[]>([]);
  const [conceptFiles, setConceptFiles] = useState<ConceptFile[]>([]);
  const [fileUploading, setFileUploading] = useState(false);
  const conceptFileInputRef = useRef<HTMLInputElement>(null);

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [toDelete, setToDelete] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const [c, a, v, d, cf] = await Promise.all([
        conceptsService.get(id),
        conceptAssigneesService.list(id),
        conceptVersionsService.list(id),
        conceptDeadlinesService.list(id),
        conceptFilesService.list(id),
      ]);
      if (!c) {
        setError('Concept non trovato.');
      } else {
        setConcept(c);
      }
      setAssignees(a);
      setVersions(v);
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
    await conceptsService.remove(concept.id);
    navigate('/concepts');
  }

  async function handleOfferSaved(offer?: Offer) {
    if (concept && offer) {
      await conceptsService.update(concept.id, { status: 'promosso', promoted_offer_id: offer.id });
    }
    setPromoteOpen(false);
    await Promise.all([reload(), reloadOffers()]);
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AssigneesSection conceptId={concept.id} assignees={assignees} projectManagers={projectManagers} onChange={reload} />
        <DeadlinesSection conceptId={concept.id} deadlines={deadlines} onChange={reload} />
      </div>

      <VersionsSection
        conceptId={concept.id}
        versions={versions}
        projectManagers={projectManagers}
        currentUserId={user?.id ?? null}
        onChange={reload}
      />

      {/* Task panel */}
      {user && (
        <EntityTasks
          entityId={concept.id}
          entityType="concept"
          projectManagers={projectManagers}
          userId={user.id}
        />
      )}

      {/* Product Concept Template */}
      <ConceptTemplatePanel
        data={concept.concept_data ?? null}
        onSave={async (templateData) => {
          await conceptsService.update(concept.id, { concept_data: templateData });
          await reload();
        }}
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
        onSaved={() => { setEditOpen(false); void reload(); }}
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

  const assignedIds = new Set(assignees.map((a) => a.project_manager_id));
  const available = projectManagers.filter((p) => p.active && !assignedIds.has(p.id));

  async function add() {
    if (!selectedPm) return;
    await conceptAssigneesService.add(conceptId, selectedPm);
    setSelectedPm(''); setAdding(false);
    await onChange();
  }

  async function remove(pmId: string) {
    await conceptAssigneesService.remove(conceptId, pmId);
    await onChange();
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" />
          Chi ci sta lavorando ({assignees.length})
        </h3>
        {!adding && available.length > 0 && (
          <button onClick={() => setAdding(true)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            <UserPlus className="w-3.5 h-3.5" /> Aggiungi
          </button>
        )}
      </div>

      {adding && (
        <div className="flex gap-2 mb-3">
          <select value={selectedPm} onChange={(e) => setSelectedPm(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Seleziona PM…</option>
            {available.map((pm) => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
          </select>
          <button onClick={add} disabled={!selectedPm}
            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            Aggiungi
          </button>
          <button onClick={() => { setAdding(false); setSelectedPm(''); }}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900">
            Annulla
          </button>
        </div>
      )}

      {assignees.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3">Nessun assegnatario.</p>
      ) : (
        <ul className="space-y-1.5">
          {assignees.map((a) => (
            <li key={a.project_manager_id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50">
              <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                {a.project_manager?.name[0]?.toUpperCase() ?? '?'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{a.project_manager?.name ?? '—'}</p>
                {a.project_manager?.email && (
                  <p className="text-xs text-slate-400 truncate">{a.project_manager.email}</p>
                )}
              </div>
              <button onClick={() => remove(a.project_manager_id)}
                className="text-slate-300 hover:text-red-500 transition">
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

// ============================================================
// Versions + Comments
// ============================================================

function VersionsSection({
  conceptId, versions, projectManagers, currentUserId, onChange,
}: {
  conceptId: string;
  versions: ConceptVersion[];
  projectManagers: ProjectManager[];
  currentUserId: string | null;
  onChange: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Trova il PM corrispondente all'user loggato (per il tracking di upload/author)
  const currentPm = projectManagers.find((p) => p.user_id === currentUserId) ?? null;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(null);
    try {
      await conceptVersionsService.upload(conceptId, file, currentPm?.id ?? null, uploadNote.trim() || null);
      setUploadNote('');
      await onChange();
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Errore upload');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleOpen(v: ConceptVersion) {
    const url = await conceptVersionsService.signedUrl(v.storage_path);
    if (url) window.open(url, '_blank');
  }

  async function handleRemove(v: ConceptVersion) {
    await conceptVersionsService.remove(v);
    await onChange();
  }

  function toggleExpanded(versionId: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(versionId)) n.delete(versionId); else n.add(versionId);
      return n;
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-500" />
          Versioni del concept ({versions.length})
        </h3>
        <div className="flex items-center gap-2">
          <input type="text" placeholder="Nota versione (opzionale)" value={uploadNote}
            onChange={(e) => setUploadNote(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48" />
          <input ref={inputRef} type="file" onChange={handleUpload} className="hidden" />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'Caricamento…' : 'Carica versione'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">{error}</p>
      )}

      {versions.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">Nessuna versione caricata. Carica il primo file per iniziare.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {versions.map((v) => {
            const open = expanded.has(v.id);
            return (
              <li key={v.id} className="py-3">
                <div className="flex items-start gap-3">
                  <button onClick={() => toggleExpanded(v.id)}
                    className="mt-0.5 text-slate-400 hover:text-slate-700 shrink-0">
                    {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                    v{v.version_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => handleOpen(v)}
                      className="text-sm font-medium text-slate-900 hover:text-indigo-600 transition truncate">
                      {v.filename}
                    </button>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatBytes(v.size)} · {formatDate(v.uploaded_at)}
                      {v.uploader && ` · ${v.uploader.name}`}
                    </p>
                    {v.note && (
                      <p className="text-xs text-slate-600 mt-1 italic">"{v.note}"</p>
                    )}
                  </div>
                  <button onClick={() => handleRemove(v)}
                    className="text-slate-300 hover:text-red-500 transition shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {open && (
                  <VersionComments
                    versionId={v.id}
                    projectManagers={projectManagers}
                    currentPm={currentPm}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// Comments per version
// ============================================================

function VersionComments({
  versionId, projectManagers, currentPm,
}: {
  versionId: string;
  projectManagers: ProjectManager[];
  currentPm: ProjectManager | null;
}) {
  const [comments, setComments] = useState<ConceptVersionComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setComments(await conceptCommentsService.list(versionId));
    } finally {
      setLoading(false);
    }
  }, [versionId]);

  useEffect(() => { void reload(); }, [reload]);

  async function postComment() {
    if (!body.trim()) return;
    setPosting(true); setError(null);
    try {
      await conceptCommentsService.create({
        version_id: versionId,
        author_id: currentPm?.id ?? null,
        author_name: currentPm?.name ?? 'Anonimo',
        body: body.trim(),
        mentions,
      });
      setBody(''); setMentions([]);
      await reload();
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Errore invio commento');
    } finally {
      setPosting(false);
    }
  }

  async function remove(c: ConceptVersionComment) {
    await conceptCommentsService.remove(c.id);
    await reload();
  }

  return (
    <div className="mt-3 ml-11 pl-3 border-l-2 border-slate-100 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <MessageSquare className="w-3.5 h-3.5" />
        Commenti ({comments.length})
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Caricamento…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Nessun commento. Sii il primo a commentare.</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="bg-slate-50 rounded-lg px-3 py-2">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center">
                    {c.author_name[0]?.toUpperCase()}
                  </span>
                  <span className="text-xs font-medium text-slate-700">{c.author_name}</span>
                  <span className="text-[10px] text-slate-400">{formatDate(c.created_at)}</span>
                </div>
                <button onClick={() => remove(c)} className="text-slate-300 hover:text-red-500 transition">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="text-sm text-slate-700">
                <CommentBody body={c.body} projectManagers={projectManagers} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">{error}</p>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <MentionInput
            value={body}
            onChange={(t, ids) => { setBody(t); setMentions(ids); }}
            projectManagers={projectManagers}
            placeholder="Scrivi un commento… usa @ per menzionare un PM"
            rows={2}
            disabled={posting}
          />
        </div>
        <button onClick={postComment} disabled={!body.trim() || posting}
          className="px-3 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 shrink-0">
          <Send className="w-3.5 h-3.5" />
          {posting ? 'Invio…' : 'Invia'}
        </button>
      </div>
    </div>
  );
}
