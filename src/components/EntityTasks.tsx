import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, Circle, Paperclip, Plus, Trash2, X } from 'lucide-react';
import Avatar from './Avatar';
import { tasksService } from '../lib/dataService';
import { useNotifications } from '../contexts/NotificationsContext';
import { useAuth } from '../contexts/AuthContext';
import type { ProjectManager, Task } from '../types';

interface Props {
  entityId: string;
  entityType: 'lead' | 'concept' | 'offer';
  entityName?: string;
  projectManagers: ProjectManager[];
  userId: string;
}

const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition';

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EntityTasks({ entityId, entityType, entityName, projectManagers, userId }: Props) {
  const { notify } = useNotifications();
  const { user: authUser } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPmId, setNewPmId] = useState('');
  const [newDue, setNewDue] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setTasks(await tasksService.listByEntity(entityId));
  }, [entityId]);

  useEffect(() => { void load(); }, [load]);

  const activePms = projectManagers.filter((p) => p.active);
  const pmById = new Map(projectManagers.map((p) => [p.id, p]));
  const today = new Date().toISOString().slice(0, 10);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const created = await tasksService.create({
        title: newTitle.trim(),
        body: null,
        pm_id: newPmId || null,
        entity_id: entityId,
        entity_type: entityType,
        due_date: newDue || null,
      }, userId, newFile ?? undefined);
      setTasks((prev) => [created, ...prev]);
      setNewTitle(''); setNewPmId(''); setNewDue(''); setNewFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setShowForm(false);
      if (created.pm_id) {
        const assignedTo = projectManagers.find((p) => p.id === created.pm_id);
        const assignedBy = projectManagers.find((p) => p.email && p.email === authUser?.email);
        const entityTypeLabel: Record<string, string> = { lead: 'Lead', concept: 'Concept', offer: 'Offerta' };
        void notify({
          type: 'task_assigned',
          title: `Task assegnato: ${created.title}`,
          body: `È stato assegnato un nuovo task a ${assignedTo?.name ?? 'PM'}.`,
          entity_id: entityId,
          entity_type: entityType,
          toEmail: assignedTo?.email ?? undefined,
          fields: [
            { label: 'Assegnato da', value: assignedBy?.name ?? 'Sistema' },
            { label: 'Assegnato a', value: assignedTo?.name ?? '—' },
            { label: 'Progetto', value: `${entityTypeLabel[entityType] ?? entityType}${entityName ? `: ${entityName}` : ''}` },
            { label: 'Task', value: created.title },
            { label: 'Scadenza', value: created.due_date ?? 'Non definita' },
          ],
        });
      }
    } finally { setSaving(false); }
  }

  async function handleToggle(id: string, completed: boolean) {
    const updated = await tasksService.setCompleted(id, completed);
    setTasks((prev) => prev.map((t) => t.id === id ? updated : t));
  }

  async function handleDelete(id: string) {
    await tasksService.remove(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function handleCancel() {
    setShowForm(false);
    setNewTitle(''); setNewPmId(''); setNewDue(''); setNewFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">
          Task ({tasks.filter((t) => !t.completed).length} aperti)
        </h3>
        <button
          onClick={() => showForm ? handleCancel() : setShowForm(true)}
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition"
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? 'Annulla' : 'Aggiungi'}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <input
            type="text"
            placeholder="Descrivi il task *"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
            className={inputCls}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <select value={newPmId} onChange={(e) => setNewPmId(e.target.value)} className={inputCls}>
              <option value="">— Nessuno —</option>
              {activePms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} className={inputCls} />
          </div>

          {/* File attachment */}
          <div>
            {newFile ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700">
                <Paperclip className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 truncate font-medium">{newFile.name}</span>
                <span className="text-indigo-400 shrink-0">{fileSize(newFile.size)}</span>
                <button
                  type="button"
                  onClick={() => { setNewFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="shrink-0 hover:text-red-500 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 bg-white border border-dashed border-slate-300 hover:border-indigo-300 rounded-xl px-3 py-2 w-full transition"
              >
                <Paperclip className="w-3.5 h-3.5" />
                Allega un file (opzionale)
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <button
            onClick={() => void handleCreate()}
            disabled={!newTitle.trim() || saving}
            className="w-full py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {saving ? 'Salvataggio…' : 'Crea task'}
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-4">Nessun task. Aggiungine uno.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const pm = t.pm_id ? pmById.get(t.pm_id) : null;
            const isOverdue = !t.completed && t.due_date && t.due_date < today;
            return (
              <li key={t.id} className={`flex items-start gap-2 p-2.5 rounded-xl border transition ${t.completed ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200'}`}>
                <button
                  onClick={() => void handleToggle(t.id, !t.completed)}
                  className="mt-0.5 shrink-0 text-slate-300 hover:text-indigo-500 transition"
                >
                  {t.completed
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    : <Circle className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${t.completed ? 'text-slate-400 line-through' : 'text-slate-800 font-medium'}`}>
                    {t.title}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {pm && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                        <Avatar name={pm.name} url={pm.avatar_url ?? null} size="xs" fallbackClassName="bg-violet-200 text-violet-800" />
                        {pm.name}
                      </span>
                    )}
                    {t.due_date && (
                      <span className={`inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full border ${isOverdue ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        <CalendarDays className="w-2.5 h-2.5" />
                        {t.due_date}
                      </span>
                    )}
                    {t.attachment_url && (
                      <a
                        href={t.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        download={t.attachment_name ?? true}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition max-w-[160px]"
                      >
                        <Paperclip className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{t.attachment_name ?? 'Allegato'}</span>
                      </a>
                    )}
                  </div>
                </div>
                <button onClick={() => void handleDelete(t.id)} className="shrink-0 text-slate-200 hover:text-red-500 transition">
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
