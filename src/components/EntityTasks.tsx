import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Circle, Plus, Trash2, X } from 'lucide-react';
import { tasksService } from '../lib/dataService';
import type { ProjectManager, Task } from '../types';

interface Props {
  entityId: string;
  entityType: 'lead' | 'concept' | 'offer';
  projectManagers: ProjectManager[];
  userId: string;
}

const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition';

export default function EntityTasks({ entityId, entityType, projectManagers, userId }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPmId, setNewPmId] = useState('');
  const [newDue, setNewDue] = useState('');
  const [saving, setSaving] = useState(false);

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
      }, userId);
      setTasks((prev) => [created, ...prev]);
      setNewTitle(''); setNewPmId(''); setNewDue('');
      setShowForm(false);
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

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">
          Task ({tasks.filter((t) => !t.completed).length} aperti)
        </h3>
        <button
          onClick={() => setShowForm((v) => !v)}
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
                  <p className={`text-sm leading-snug ${t.completed ? 'text-slate-400 line-through' : 'text-slate-800 font-medium'}`}>{t.title}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {pm && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                        {pm.name}
                      </span>
                    )}
                    {t.due_date && (
                      <span className={`inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full border ${isOverdue ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        <CalendarDays className="w-2.5 h-2.5" />
                        {t.due_date}
                      </span>
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
