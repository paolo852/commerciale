import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Archive, ArrowLeft, CheckCircle2, Clock, Edit3, FlaskConical, Paperclip, Plus, Send, Trash2, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';
import { useNotifications } from '../contexts/NotificationsContext';
import { useOffersData } from '../hooks/useOffersData';
import { leadCandidatesService, leadUpdatesService, conceptsService } from '../lib/dataService';
import { formatDate } from '../lib/format';
import LeadCandidateFormModal from '../components/leads/LeadCandidateFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import EntityTasks from '../components/EntityTasks';
import MentionTextarea from '../components/MentionTextarea';
import { sendMentionNotifications } from '../lib/mentionNotify';
import type { LeadCandidate, LeadCandidateStatus, LeadUpdate, ProjectManager } from '../types';

const STATUS_MAP: Record<LeadCandidateStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  attivo:    { label: 'Attivo',    cls: 'bg-sky-50 text-sky-700 border-sky-200',           Icon: Clock },
  promosso:  { label: 'Promosso', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  archiviato:{ label: 'Archiviato', cls: 'bg-slate-50 text-slate-500 border-slate-200',    Icon: Archive },
};

export default function LeadCandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notify } = useNotifications();
  const { fundingCalls, projectManagers } = useOffersData();

  const [lead, setLead] = useState<LeadCandidate | null>(null);
  const [updates, setUpdates] = useState<LeadUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [toDelete, setToDelete] = useState(false);
  const [promoting, setPromoting] = useState(false);

  // New update form
  const [newBody, setNewBody] = useState('');
  const [newMentions, setNewMentions] = useState<string[]>([]);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const currentPm: ProjectManager | null = projectManagers.find((p) => p.email && p.email === user?.email) ?? null;
  const pmByName = new Map(projectManagers.map((p) => [p.name, p]));

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const [l, u] = await Promise.all([
        leadCandidatesService.get(id),
        leadUpdatesService.list(id),
      ]);
      if (!l) { setError('Lead non trovato.'); }
      else { setLead(l); }
      setUpdates(u);
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Errore caricamento');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  async function handleDelete() {
    if (!lead) return;
    await leadCandidatesService.remove(lead.id);
    navigate('/leads');
  }

  async function postUpdate() {
    if (!lead || !newBody.trim()) return;
    setPosting(true); setPostError(null);
    try {
      await leadUpdatesService.create(
        {
          lead_id: lead.id,
          body: newBody.trim(),
          author_id: currentPm?.id ?? null,
          author_name: user?.email ?? currentPm?.name ?? 'Anonimo',
        },
        attachFile ?? undefined,
        user?.id,
      );
      const authorName = currentPm?.name ?? user?.email ?? 'Anonimo';
      const pmById = new Map(projectManagers.map((p) => [p.id, p]));
      void sendMentionNotifications(newMentions, pmById, authorName, newBody.trim(), window.location.href);
      setNewBody('');
      setNewMentions([]);
      setAttachFile(null);
      await reload();
    } catch (e) {
      setPostError((e as { message?: string })?.message ?? 'Errore invio');
    } finally { setPosting(false); }
  }

  async function removeUpdate(u: LeadUpdate) {
    await leadUpdatesService.remove(u.id);
    await reload();
  }

  async function handleArchive() {
    if (!lead) return;
    await leadCandidatesService.update(lead.id, { status: 'archiviato' });
    await reload();
  }

  async function promoteToConc() {
    if (!lead || !user) return;
    setPromoting(true);
    try {
      const concept = await conceptsService.create({
        name: lead.researcher_name,
        pi: lead.researcher_name,
        ente: lead.institution ?? null,
        description: lead.potential_project ?? null,
        status: 'in_valutazione',
        notes: null,
      }, user.id);
      await leadCandidatesService.update(lead.id, {
        status: 'promosso',
        promoted_concept_id: concept.id,
      });
      void notify({
        type: 'lead_promoted',
        title: `Lead promosso: ${lead.researcher_name}`,
        body: `Promosso a concept development`,
        entity_id: lead.id,
        entity_type: 'lead',
      });
      navigate(`/concepts/${concept.id}`);
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Errore promozione');
    } finally { setPromoting(false); }
  }

  if (loading) return (
    <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center text-sm text-slate-400">
      Caricamento…
    </div>
  );
  if (error || !lead) return (
    <div className="space-y-4">
      <button onClick={() => navigate('/leads')} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
        <ArrowLeft className="w-3.5 h-3.5" /> Torna ai lead
      </button>
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error ?? 'Lead non trovato.'}</div>
    </div>
  );

  const { label: statusLabel, cls: statusCls, Icon: StatusIcon } = STATUS_MAP[lead.status];
  const fc = lead.funding_call_id ? fundingCalls.find((f) => f.id === lead.funding_call_id) : null;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/leads')} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
        <ArrowLeft className="w-3.5 h-3.5" /> Torna ai lead
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-slate-900">{lead.researcher_name}</h1>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${statusCls}`}>
                <StatusIcon className="w-3 h-3" />{statusLabel}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap mt-1 text-sm text-slate-500">
              {lead.institution && <span>{lead.institution}</span>}
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{lead.call_type}</span>
              {fc && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {fc.code} — {fc.name}
                </span>
              )}
              {lead.pm_id && (() => {
                const pm = projectManagers.find((p) => p.id === lead.pm_id);
                return pm ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 flex items-center gap-1">
                    <Avatar name={pm.name} url={pm.avatar_url} size="xs" fallbackClassName="bg-violet-200 text-violet-800" />
                    {pm.name}
                  </span>
                ) : null;
              })()}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {lead.status === 'attivo' && (
              <>
                <button
                  onClick={promoteToConc}
                  disabled={promoting}
                  className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  {promoting ? 'Promozione…' : 'Promuovi a concept'}
                </button>
                <button
                  onClick={handleArchive}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Archivia
                </button>
              </>
            )}
            {lead.status === 'promosso' && lead.promoted_concept_id && (
              <button
                onClick={() => navigate(`/concepts/${lead.promoted_concept_id}`)}
                className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition flex items-center gap-1.5"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Vai al concept
              </button>
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

        {lead.potential_project && (
          <div className="mt-2 bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-xs font-medium text-slate-500 mb-1">Progetto potenziale</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{lead.potential_project}</p>
          </div>
        )}

        {lead.keywords && lead.keywords.length > 0 && (
          <div className="mt-2 bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-xs font-medium text-slate-500 mb-2">Keywords</p>
            <div className="flex flex-wrap gap-1.5">
              {lead.keywords.map((kw) => (
                <span key={kw} className="inline-flex text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {user && (
        <EntityTasks
          entityId={lead.id}
          entityType="lead"
          entityName={lead.researcher_name}
          projectManagers={projectManagers}
          userId={user.id}
        />
      )}

      {/* Updates / storico interazioni */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-500" />
          Storico interazioni ({updates.length})
        </h3>

        {updates.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">
            Nessun aggiornamento ancora. Aggiungi il primo contatto qui sotto.
          </p>
        ) : (
          <ol className="relative border-l-2 border-slate-100 space-y-0 ml-2 mb-6">
            {updates.map((u) => (
              <li key={u.id} className="pl-5 pb-5 relative">
                <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-400 ring-2 ring-white" />
                <div className="bg-slate-50 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={u.author_name}
                        url={pmByName.get(u.author_name)?.avatar_url ?? null}
                        size="sm"
                        fallbackClassName="bg-indigo-100 text-indigo-700"
                      />
                      <span className="text-xs font-semibold text-slate-700">{u.author_name}</span>
                      <span className="text-[11px] text-slate-400">{formatDate(u.created_at)}</span>
                    </div>
                    <button onClick={() => removeUpdate(u)} className="text-slate-300 hover:text-red-500 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{u.body}</p>
                  {u.attachment_url && (
                    <a
                      href={u.attachment_url}
                      download={u.attachment_name ?? true}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5 hover:bg-indigo-100 transition"
                    >
                      <Paperclip className="w-3 h-3" />
                      {u.attachment_name ?? 'Allegato'}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        {/* New update form */}
        <div className="border-t border-slate-100 pt-4">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Nuovo aggiornamento
          </label>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-2">
              <MentionTextarea
                rows={3}
                value={newBody}
                onChange={setNewBody}
                mentions={newMentions}
                onMentionsChange={setNewMentions}
                projectManagers={projectManagers}
                placeholder="Descrivi l'interazione avuta, le note del colloquio, i prossimi passi… (usa @ per menzionare)"
                disabled={posting}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none disabled:opacity-50"
              />
              {/* File attachment */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={posting}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition disabled:opacity-50"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  {attachFile ? attachFile.name : 'Allega file'}
                </button>
                {attachFile && (
                  <button
                    type="button"
                    onClick={() => { setAttachFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-slate-300 hover:text-red-500 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setAttachFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <button
              onClick={postUpdate}
              disabled={!newBody.trim() || posting}
              className="px-3 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 shrink-0 transition self-start mt-0"
            >
              <Send className="w-4 h-4" />
              {posting ? 'Invio…' : 'Aggiungi'}
            </button>
          </div>
          {postError && (
            <p className="mt-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{postError}</p>
          )}
        </div>
      </div>

      <LeadCandidateFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); void reload(); }}
        lead={lead}
        fundingCalls={fundingCalls}
        projectManagers={projectManagers}
      />

      <ConfirmDialog
        open={toDelete}
        title="Eliminare il lead?"
        message={`"${lead.researcher_name}" e tutto lo storico delle interazioni verranno rimossi definitivamente.`}
        confirmLabel="Elimina" variant="danger"
        onConfirm={handleDelete} onCancel={() => setToDelete(false)}
      />
    </div>
  );
}
