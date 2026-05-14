import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, CalendarDays, CheckCircle2, ChevronDown, Circle,
  FileText, FlaskConical, Plus, Trash2, UserSearch, Users, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOffersData } from '../hooks/useOffersData';
import { leadCandidatesService, conceptsService, tasksService } from '../lib/dataService';
import type { Concept, LeadCandidate, ProjectManager, Task } from '../types';

type Tab = 'workload' | 'tasks';

// ─── Workload tab ───────────────────────────────────────────────

function WorkloadCard({
  pm, leads, concepts, offers,
}: {
  pm: ProjectManager;
  leads: LeadCandidate[];
  concepts: Concept[];
  offers: { id: string; name: string }[];
}) {
  const nav = useNavigate();
  const [open, setOpen] = useState<'leads' | 'concepts' | 'offers' | null>(null);
  const total = leads.length + concepts.length + offers.length;

  const sections = [
    {
      key: 'leads' as const,
      label: 'Lead',
      count: leads.length,
      icon: UserSearch,
      color: 'text-sky-600 bg-sky-50',
      items: leads.map((l) => ({ id: l.id, name: l.researcher_name, sub: l.institution ?? null, path: `/leads/${l.id}` })),
    },
    {
      key: 'concepts' as const,
      label: 'Concept',
      count: concepts.length,
      icon: FlaskConical,
      color: 'text-indigo-600 bg-indigo-50',
      items: concepts.map((c) => ({ id: c.id, name: c.name, sub: c.ente ?? null, path: `/concepts/${c.id}` })),
    },
    {
      key: 'offers' as const,
      label: 'Offerte',
      count: offers.length,
      icon: FileText,
      color: 'text-amber-600 bg-amber-50',
      items: offers.map((o) => ({ id: o.id, name: o.name, sub: null, path: `/offerte/${o.id}` })),
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* PM header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-indigo-700 uppercase">{pm.name[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{pm.name}</p>
          {pm.email && <p className="text-xs text-slate-400 truncate">{pm.email}</p>}
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${total > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
          {total} elementi
        </span>
      </div>

      {/* Stats + expandable lists */}
      <div className="divide-y divide-slate-50">
        {sections.map(({ key, label, count, icon: Icon, color, items }) => (
          <div key={key}>
            <button
              onClick={() => setOpen(open === key ? null : key)}
              disabled={count === 0}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition disabled:cursor-default"
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="flex-1 text-sm text-slate-700 text-left">{label}</span>
              <span className={`text-xs font-semibold tabular-nums ${count > 0 ? 'text-slate-700' : 'text-slate-300'}`}>{count}</span>
              {count > 0 && (
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${open === key ? 'rotate-180' : ''}`} />
              )}
            </button>
            {open === key && (
              <ul className="px-5 pb-3 space-y-1">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => nav(item.path)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 transition text-sm font-medium text-slate-700 truncate"
                    >
                      {item.name}
                      {item.sub && <span className="ml-2 text-xs text-slate-400 font-normal">{item.sub}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Task tab ───────────────────────────────────────────────────

function TaskRow({
  task, pms, entityNames, onToggle, onDelete,
}: {
  task: Task;
  pms: Map<string, ProjectManager>;
  entityNames: Map<string, { name: string; path: string }>;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const nav = useNavigate();
  const pm = task.pm_id ? pms.get(task.pm_id) : null;
  const entity = task.entity_id ? entityNames.get(task.entity_id) : null;
  const isOverdue = !task.completed && task.due_date && task.due_date < new Date().toISOString().slice(0, 10);

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition ${task.completed ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200/80 shadow-sm'}`}>
      <button
        onClick={() => onToggle(task.id, !task.completed)}
        className="mt-0.5 shrink-0 text-slate-300 hover:text-indigo-500 transition"
      >
        {task.completed
          ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          : <Circle className="w-5 h-5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
          {task.title}
        </p>
        {task.body && (
          <p className={`text-xs mt-0.5 line-clamp-2 ${task.completed ? 'text-slate-300' : 'text-slate-500'}`}>{task.body}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap mt-1.5">
          {pm && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
              <span className="w-3.5 h-3.5 rounded-full bg-violet-200 text-violet-800 flex items-center justify-center text-[9px] font-bold uppercase shrink-0">{pm.name[0]}</span>
              {pm.name}
            </span>
          )}
          {entity && (
            <button
              onClick={() => nav(entity.path)}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 transition truncate max-w-[140px]"
            >
              {task.entity_type === 'lead' ? <UserSearch className="w-3 h-3 shrink-0" /> : task.entity_type === 'concept' ? <FlaskConical className="w-3 h-3 shrink-0" /> : <FileText className="w-3 h-3 shrink-0" />}
              <span className="truncate">{entity.name}</span>
            </button>
          )}
          {task.due_date && (
            <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
              isOverdue ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}>
              <CalendarDays className="w-3 h-3" />
              {task.due_date}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onDelete(task.id)}
        className="shrink-0 text-slate-200 hover:text-red-500 transition mt-0.5"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────

export default function Team() {
  const { user } = useAuth();
  const { offers, projectManagers } = useOffersData();
  const [tab, setTab] = useState<Tab>('workload');

  const [leads, setLeads] = useState<LeadCandidate[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Task form state
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newPmId, setNewPmId] = useState('');
  const [newDue, setNewDue] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter state
  const [filterPm, setFilterPm] = useState('');
  const [hideCompleted, setHideCompleted] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [l, c, t] = await Promise.all([
        leadCandidatesService.list(),
        conceptsService.list(),
        tasksService.list(),
      ]);
      setLeads(l);
      setConcepts(c);
      setTasks(t);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  // ── Workload data ──
  const activePms = useMemo(() => projectManagers.filter((p) => p.active), [projectManagers]);
  const pmById = useMemo(() => new Map(projectManagers.map((p) => [p.id, p])), [projectManagers]);

  const entityNames = useMemo(() => {
    const map = new Map<string, { name: string; path: string }>();
    leads.forEach((l) => map.set(l.id, { name: l.researcher_name, path: `/leads/${l.id}` }));
    concepts.forEach((c) => map.set(c.id, { name: c.name, path: `/concepts/${c.id}` }));
    offers.forEach((o) => map.set(o.id, { name: o.name, path: `/offerte/${o.id}` }));
    return map;
  }, [leads, concepts, offers]);

  const workload = useMemo(() => activePms.map((pm) => ({
    pm,
    leads: leads.filter((l) => l.pm_id === pm.id),
    concepts: concepts.filter((c) => c.assignees?.some((a) => a.project_manager_id === pm.id)),
    offers: offers.filter((o) => o.project_manager_id === pm.id).map((o) => ({ id: o.id, name: o.name })),
  })), [activePms, leads, concepts, offers]);

  // ── Task data ──
  const filteredTasks = useMemo(() => tasks.filter((t) => {
    if (hideCompleted && t.completed) return false;
    if (filterPm && t.pm_id !== filterPm) return false;
    return true;
  }), [tasks, filterPm, hideCompleted]);

  async function handleCreateTask() {
    if (!user || !newTitle.trim()) return;
    setSaving(true);
    try {
      const created = await tasksService.create({
        title: newTitle.trim(),
        body: newBody.trim() || null,
        pm_id: newPmId || null,
        entity_id: null,
        entity_type: null,
        due_date: newDue || null,
      }, user.id);
      setTasks((prev) => [created, ...prev]);
      setNewTitle(''); setNewBody(''); setNewPmId(''); setNewDue('');
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string, completed: boolean) {
    const updated = await tasksService.setCompleted(id, completed);
    setTasks((prev) => prev.map((t) => t.id === id ? updated : t));
  }

  async function handleDelete(id: string) {
    await tasksService.remove(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500 mt-0.5">Workload e task per persona</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([['workload', 'Workload', Users], ['tasks', 'Task', BookOpen]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${
              tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 py-10 text-center">Caricamento…</p>
      ) : tab === 'workload' ? (
        /* ── Workload ── */
        <div>
          {workload.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center text-sm text-slate-400">
              Nessun PM attivo. Aggiungine uno nelle Anagrafiche.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {workload.map(({ pm, leads: l, concepts: c, offers: o }) => (
                <WorkloadCard key={pm.id} pm={pm} leads={l} concepts={c} offers={o} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Tasks ── */
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={filterPm}
              onChange={(e) => setFilterPm(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Tutte le persone</option>
              {activePms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={(e) => setHideCompleted(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-600"
              />
              Nascondi completati
            </label>
            <div className="flex-1" />
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition"
            >
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Annulla' : 'Nuovo task'}
            </button>
          </div>

          {/* New task form */}
          {showForm && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <p className="text-sm font-semibold text-slate-700">Nuovo task</p>
              <input
                type="text"
                placeholder="Titolo *"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className={inputCls}
                autoFocus
              />
              <textarea
                rows={2}
                placeholder="Descrizione (opzionale)"
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                className={`${inputCls} resize-none`}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Assegnato a</label>
                  <select value={newPmId} onChange={(e) => setNewPmId(e.target.value)} className={inputCls}>
                    <option value="">— Nessuno —</option>
                    {activePms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Scadenza</label>
                  <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">
                  Annulla
                </button>
                <button
                  onClick={() => void handleCreateTask()}
                  disabled={!newTitle.trim() || saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {saving ? 'Salvataggio…' : 'Crea task'}
                </button>
              </div>
            </div>
          )}

          {/* Task list */}
          {filteredTasks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center text-sm text-slate-400">
              {tasks.length === 0 ? 'Nessun task ancora. Creane uno con il pulsante sopra.' : 'Nessun task corrisponde ai filtri.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((t) => (
                <TaskRow key={t.id} task={t} pms={pmById} entityNames={entityNames} onToggle={handleToggle} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
