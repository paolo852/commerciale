import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { entityCommentsService } from '../lib/dataService';
import { formatDate } from '../lib/format';
import type { EntityComment } from '../types';

interface Props {
  entityType: 'concept' | 'offer' | 'lead';
  entityId: string;
}

export default function EntityComments({ entityType, entityId }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<EntityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try {
      setComments(await entityCommentsService.list(entityType, entityId));
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => { void load(); }, [load]);

  async function post() {
    if (!body.trim() || !user) return;
    setPosting(true); setError(null);
    try {
      await entityCommentsService.create({
        user_id: user.id,
        entity_type: entityType,
        entity_id: entityId,
        author_name: user.email ?? 'Anonimo',
        body: body.trim(),
      });
      setBody('');
      await load();
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Errore durante l\'invio');
    } finally {
      setPosting(false);
    }
  }

  async function remove(id: string) {
    await entityCommentsService.remove(id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void post();
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-indigo-500" />
        Commenti
        {!loading && comments.length > 0 && (
          <span className="text-xs font-normal text-slate-400">({comments.length})</span>
        )}
      </h3>

      {/* Input */}
      {user && (
        <div className="mb-4">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi un commento… (Ctrl+Enter per inviare)"
            rows={3}
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          <div className="flex justify-end mt-2">
            <button
              onClick={() => void post()}
              disabled={!body.trim() || posting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition"
            >
              <Send className="w-3.5 h-3.5" />
              {posting ? 'Invio…' : 'Invia'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-xs text-slate-400 text-center py-4">Caricamento…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">Nessun commento ancora.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3 group">
              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {c.author_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-slate-800 truncate">{c.author_name}</span>
                  <span className="text-[11px] text-slate-400 shrink-0">{formatDate(c.created_at)}</span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed mt-0.5">{c.body}</p>
              </div>
              {user && (c.user_id === user.id || !c.user_id) && (
                <button
                  onClick={() => void remove(c.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition shrink-0 mt-0.5"
                  title="Elimina commento"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
