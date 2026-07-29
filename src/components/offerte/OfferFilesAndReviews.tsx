import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2, ClipboardCheck, Clock, FileText, Loader2, MessageSquare, Paperclip,
  Send, Trash2, Upload, UserPlus, X,
} from 'lucide-react';
import Avatar from '../Avatar';
import Modal from '../Modal';
import { offerFilesService, offerReviewsService, notificationsService } from '../../lib/dataService';
import { isDemoMode, supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import type { OfferFile, OfferReview, ProjectManager } from '../../types';

interface Props {
  offerId: string;
  offerName: string;
  projectManagers: ProjectManager[];
}

export default function OfferFilesAndReviews({ offerId, offerName, projectManagers }: Props) {
  const { user } = useAuth();
  const [files, setFiles] = useState<OfferFile[]>([]);
  const [reviews, setReviews] = useState<OfferReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeNote, setCompleteNote] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const currentUserName =
    projectManagers.find((p) => p.email && p.email === user?.email)?.name ?? user?.email ?? 'Utente';

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [fs, rs] = await Promise.all([
        offerFilesService.list(offerId),
        offerReviewsService.list(offerId),
      ]);
      setFiles(fs);
      setReviews(rs);
    } finally { setLoading(false); }
  }, [offerId]);

  useEffect(() => { void reload(); }, [reload]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const created = await offerFilesService.upload(offerId, file, user.id);
      setFiles((prev) => [created, ...prev]);
    } catch (err) {
      alert((err as { message?: string })?.message ?? 'Errore upload');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleOpen(f: OfferFile) {
    setOpeningId(f.id);
    try {
      const url = await offerFilesService.signedUrl(f.file_path);
      if (!url) { alert('Impossibile aprire il file.'); return; }
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally { setOpeningId(null); }
  }

  async function handleRemoveFile(f: OfferFile) {
    if (!confirm(`Eliminare "${f.filename}"?`)) return;
    await offerFilesService.remove(f.id, f.file_path);
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
  }

  async function submitReviewRequest(pmIds: string[], note: string) {
    if (!user || pmIds.length === 0) return;
    const created = await offerReviewsService.create({
      offer_id: offerId,
      reviewer_pm_ids: pmIds,
      requester_email: user.email ?? '',
      requester_name: currentUserName,
      note: note.trim() || null,
    });
    setReviews((prev) => [...created, ...prev]);

    // Fire in-app notifications for each reviewer that has a linked auth user_id
    for (const pmId of pmIds) {
      const pm = projectManagers.find((p) => p.id === pmId);
      if (!pm?.user_id) continue;
      try {
        await notificationsService.create({
          user_id: pm.user_id,
          type: 'offer_review_requested',
          title: `${currentUserName} ti ha chiesto una revisione`,
          body: `Offerta: ${offerName}${note.trim() ? ` — ${note.trim()}` : ''}`,
          entity_id: offerId,
          entity_type: 'offer',
          read: false,
        });
      } catch { /* best effort */ }
    }

    // Optional email via edge function (best effort)
    if (!isDemoMode && supabase) {
      const targets = pmIds
        .map((id) => projectManagers.find((p) => p.id === id))
        .filter((p): p is ProjectManager => !!p?.email);
      await Promise.all(targets.map((pm) =>
        supabase!.functions.invoke('send-notification-email', {
          body: {
            to: pm.email!,
            subject: `${currentUserName} ti ha chiesto una revisione`,
            body: `È stata richiesta la tua revisione sull'offerta "${offerName}".`,
            url: `${window.location.origin}/offerte/${offerId}`,
            fields: note.trim() ? [{ label: 'Nota', value: note.trim() }] : [],
          },
        }).catch(() => {}),
      ));
    }
  }

  async function handleComplete(reviewId: string) {
    const updated = await offerReviewsService.complete(reviewId, completeNote.trim() || null);
    setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...updated, reviewer: r.reviewer } : r)));
    setCompletingId(null);
    setCompleteNote('');
  }

  const pendingReviews = reviews.filter((r) => r.status === 'pending');
  const completedReviews = reviews.filter((r) => r.status === 'completed');
  const currentPmId = projectManagers.find((p) => p.email && p.email === user?.email)?.id;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-slate-400" />
          Documenti e revisioni
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Upload…' : 'Carica file'}
          </button>
          <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
          <button
            type="button"
            onClick={() => setReviewModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-700 transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Richiedi revisione
          </button>
        </div>
      </div>

      {/* ── Files list ── */}
      {loading ? (
        <p className="text-xs text-slate-400 italic text-center py-4">Caricamento…</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-4">
          Nessun documento caricato. Carica il documento di offerta, allegati, budget.
        </p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
              <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
              <button
                type="button"
                onClick={() => void handleOpen(f)}
                disabled={openingId === f.id}
                className="flex-1 text-left text-sm text-indigo-600 hover:underline truncate min-w-0 disabled:opacity-60"
              >
                {openingId === f.id ? 'Apertura…' : f.filename}
              </button>
              <span className="text-[11px] text-slate-400 shrink-0">{formatDate(f.created_at)}</span>
              <button
                onClick={() => void handleRemoveFile(f)}
                className="text-slate-300 hover:text-red-500 transition shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ── Reviews ── */}
      {(pendingReviews.length > 0 || completedReviews.length > 0) && (
        <div className="mt-6 pt-5 border-t border-slate-100 space-y-4">
          {pendingReviews.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> In attesa · {pendingReviews.length}
              </h4>
              <ul className="space-y-2">
                {pendingReviews.map((r) => (
                  <ReviewRow
                    key={r.id}
                    review={r}
                    canComplete={currentPmId === r.reviewer_pm_id}
                    isCompleting={completingId === r.id}
                    completeNote={completeNote}
                    onStartComplete={() => { setCompletingId(r.id); setCompleteNote(''); }}
                    onCancelComplete={() => { setCompletingId(null); setCompleteNote(''); }}
                    onChangeNote={setCompleteNote}
                    onConfirmComplete={() => void handleComplete(r.id)}
                  />
                ))}
              </ul>
            </div>
          )}

          {completedReviews.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Completate · {completedReviews.length}
              </h4>
              <ul className="space-y-2">
                {completedReviews.map((r) => (
                  <ReviewRow key={r.id} review={r} canComplete={false} isCompleting={false}
                    completeNote="" onStartComplete={() => {}} onCancelComplete={() => {}}
                    onChangeNote={() => {}} onConfirmComplete={() => {}}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Request modal ── */}
      <RequestReviewModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        projectManagers={projectManagers}
        onSubmit={async (pmIds, note) => {
          await submitReviewRequest(pmIds, note);
          setReviewModalOpen(false);
        }}
      />
    </div>
  );
}

// ── Review row ────────────────────────────────────────────────────────────────
interface ReviewRowProps {
  review: OfferReview;
  canComplete: boolean;
  isCompleting: boolean;
  completeNote: string;
  onStartComplete: () => void;
  onCancelComplete: () => void;
  onChangeNote: (v: string) => void;
  onConfirmComplete: () => void;
}

function ReviewRow({
  review, canComplete, isCompleting, completeNote,
  onStartComplete, onCancelComplete, onChangeNote, onConfirmComplete,
}: ReviewRowProps) {
  const pm = review.reviewer;
  const isDone = review.status === 'completed';

  return (
    <li className={`rounded-xl border p-3 ${isDone ? 'bg-emerald-50/40 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex items-start gap-3">
        {pm ? <Avatar name={pm.name} url={pm.avatar_url} size="sm" />
             : <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">{pm?.name ?? 'PM sconosciuto'}</span>
            {isDone ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="w-2.5 h-2.5" /> Rivisto
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700">
                <Clock className="w-2.5 h-2.5" /> In attesa
              </span>
            )}
            <span className="text-[11px] text-slate-400 ml-auto">
              {isDone && review.completed_at
                ? `Rivisto il ${formatDate(review.completed_at)}`
                : `Richiesto il ${formatDate(review.created_at)}`}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Richiesta da <strong>{review.requester_name ?? review.requester_email}</strong>
          </p>
          {review.note && (
            <p className="mt-1.5 text-xs text-slate-600 whitespace-pre-wrap bg-white/60 border border-slate-100 rounded-lg px-2.5 py-1.5">
              <MessageSquare className="w-3 h-3 inline mr-1 text-slate-400" />
              {review.note}
            </p>
          )}
          {isDone && review.completed_note && (
            <p className="mt-1.5 text-xs text-emerald-800 whitespace-pre-wrap bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
              <ClipboardCheck className="w-3 h-3 inline mr-1 text-emerald-500" />
              {review.completed_note}
            </p>
          )}
        </div>
      </div>

      {canComplete && !isCompleting && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onStartComplete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Segna come rivista
          </button>
        </div>
      )}

      {canComplete && isCompleting && (
        <div className="mt-3 space-y-2">
          <textarea
            autoFocus
            rows={2}
            value={completeNote}
            onChange={(e) => onChangeNote(e.target.value)}
            placeholder="Nota di revisione (opzionale)…"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancelComplete}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">
              Annulla
            </button>
            <button type="button" onClick={onConfirmComplete}
              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition">
              Conferma
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// ── Request review modal ─────────────────────────────────────────────────────
interface RequestReviewModalProps {
  open: boolean;
  onClose: () => void;
  projectManagers: ProjectManager[];
  onSubmit: (pmIds: string[], note: string) => Promise<void>;
}

function RequestReviewModal({ open, onClose, projectManagers, onSubmit }: RequestReviewModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) { setSelected(new Set()); setNote(''); setSubmitting(false); }
  }, [open]);

  function toggle(pmId: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(pmId) ? n.delete(pmId) : n.add(pmId);
      return n;
    });
  }

  async function submit() {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      await onSubmit(Array.from(selected), note);
    } finally { setSubmitting(false); }
  }

  const activePms = projectManagers.filter((p) => p.active);

  return (
    <Modal open={open} onClose={onClose} title="Richiedi revisione" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Seleziona uno o più revisori
          </label>
          {activePms.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Nessun Project Manager attivo.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activePms.map((pm) => {
                const isSel = selected.has(pm.id);
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => toggle(pm.id)}
                    className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                      isSel
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700'
                    }`}
                  >
                    <Avatar name={pm.name} url={pm.avatar_url} size="xs" />
                    {pm.name}
                    {isSel && <X className="w-3 h-3 opacity-70" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Nota (opzionale)</label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Es. Rivedere il budget e la sezione tecnica entro venerdì…"
            className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">
            Annulla
          </button>
          <button type="button" onClick={() => void submit()}
            disabled={selected.size === 0 || submitting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition">
            <Send className="w-3.5 h-3.5" />
            {submitting ? 'Invio…' : `Invia richiesta${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
