import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, ChevronDown, ChevronUp, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useOffersData } from '../hooks/useOffersData';
import { offersService } from '../lib/dataService';
import { offerYear } from '../lib/analytics';
import YearSelector from '../components/YearSelector';
import { formatDate, formatEUR } from '../lib/format';
import {
  StatusBadge,
  OutcomeBadge,
  TypeBadge,
  STATUS_OPTIONS,
  OUTCOME_OPTIONS,
  TYPE_OPTIONS,
} from '../components/Badges';
import OfferFormModal from '../components/offerte/OfferFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import type { Offer, OfferOutcome, OfferStatus, OfferType } from '../types';

type SortBy = 'deadline' | 'budget' | 'created_at' | 'name';
type SortDir = 'asc' | 'desc';
type ViewTab = 'all' | 'in_corso' | 'approvate' | 'respinte';

interface Filters {
  search: string;
  status: OfferStatus | 'all';
  outcome: OfferOutcome | 'all';
  type: OfferType | 'all';
  projectManagerId: string | 'all';
  fundingCall: string | 'all';
  year: number | 'all';
}

function matchesView(o: Offer, view: ViewTab): boolean {
  switch (view) {
    case 'all': return true;
    case 'in_corso': return o.outcome === 'nessuno';
    case 'approvate': return o.outcome === 'approvato';
    case 'respinte': return o.outcome === 'rifiutato';
  }
}

const selectClass =
  'px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

// ── helpers to read/write URL params ────────────────────────────

function sp(params: URLSearchParams, key: string, fallback: string): string {
  return params.get(key) ?? fallback;
}

function filtersFromParams(params: URLSearchParams): Filters {
  const year = params.get('year');
  return {
    search: sp(params, 'q', ''),
    status: sp(params, 'status', 'all') as Filters['status'],
    outcome: sp(params, 'outcome', 'all') as Filters['outcome'],
    type: sp(params, 'type', 'all') as Filters['type'],
    projectManagerId: sp(params, 'pm', 'all'),
    fundingCall: sp(params, 'call', 'all'),
    year: year && year !== 'all' ? Number(year) : 'all',
  };
}

function applyFilters(params: URLSearchParams, f: Filters): URLSearchParams {
  const next = new URLSearchParams(params);
  f.search ? next.set('q', f.search) : next.delete('q');
  f.status !== 'all' ? next.set('status', f.status) : next.delete('status');
  f.outcome !== 'all' ? next.set('outcome', f.outcome) : next.delete('outcome');
  f.type !== 'all' ? next.set('type', f.type) : next.delete('type');
  f.projectManagerId !== 'all' ? next.set('pm', f.projectManagerId) : next.delete('pm');
  f.fundingCall !== 'all' ? next.set('call', f.fundingCall) : next.delete('call');
  f.year !== 'all' ? next.set('year', String(f.year)) : next.delete('year');
  return next;
}

export default function Offerte() {
  const navigate = useNavigate();
  const { offers, projectManagers, fundingCalls, loading, error, reload } = useOffersData();
  const [searchParams, setSearchParams] = useSearchParams();

  // All filter/view/sort state lives in the URL so back-navigation restores it
  const view = sp(searchParams, 'view', 'in_corso') as ViewTab;
  const sortBy = sp(searchParams, 'sort', 'deadline') as SortBy;
  const sortDir = sp(searchParams, 'dir', 'asc') as SortDir;
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);

  function setView(v: ViewTab) {
    setSearchParams((p) => { const n = new URLSearchParams(p); n.set('view', v); return n; }, { replace: true });
  }
  function setFilters(f: Filters) {
    setSearchParams(applyFilters(searchParams, f), { replace: true });
  }
  function clearFilters() {
    setSearchParams((p) => {
      const n = new URLSearchParams(p);
      ['q','status','outcome','type','pm','call','year'].forEach((k) => n.delete(k));
      return n;
    }, { replace: true });
  }
  function toggleSort(col: SortBy) {
    setSearchParams((p) => {
      const n = new URLSearchParams(p);
      if (sp(p, 'sort', 'deadline') === col) {
        n.set('dir', sp(p, 'dir', 'asc') === 'asc' ? 'desc' : 'asc');
      } else {
        n.set('sort', col);
        n.set('dir', col === 'budget' || col === 'created_at' ? 'desc' : 'asc');
      }
      return n;
    }, { replace: true });
  }

  // Ephemeral UI state (not persisted in URL)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [toDelete, setToDelete] = useState<Offer | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OfferStatus | ''>('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const pmById = useMemo(() => new Map(projectManagers.map((p) => [p.id, p])), [projectManagers]);

  const isFiltered =
    filters.search ||
    filters.status !== 'all' ||
    filters.outcome !== 'all' ||
    filters.type !== 'all' ||
    filters.projectManagerId !== 'all' ||
    filters.fundingCall !== 'all';

  const yearScopedOffers = useMemo(
    () => filters.year === 'all' ? offers : offers.filter((o) => offerYear(o) === filters.year),
    [offers, filters.year],
  );
  const tabCounts = useMemo(() => ({
    all: yearScopedOffers.length,
    in_corso: yearScopedOffers.filter((o) => matchesView(o, 'in_corso')).length,
    approvate: yearScopedOffers.filter((o) => matchesView(o, 'approvate')).length,
    respinte: yearScopedOffers.filter((o) => matchesView(o, 'respinte')).length,
  }), [yearScopedOffers]);

  const visibleOffers = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const filtered = offers.filter((o) => {
      if (!matchesView(o, view)) return false;
      if (filters.year !== 'all' && offerYear(o) !== filters.year) return false;
      if (search && !o.name.toLowerCase().includes(search)) return false;
      if (filters.status !== 'all' && o.status !== filters.status) return false;
      if (filters.outcome !== 'all' && o.outcome !== filters.outcome) return false;
      if (filters.type !== 'all' && o.type !== filters.type) return false;
      if (filters.projectManagerId !== 'all') {
        if (filters.projectManagerId === '__none__') { if (o.project_manager_id) return false; }
        else if (o.project_manager_id !== filters.projectManagerId) return false;
      }
      if (filters.fundingCall !== 'all' && o.funding_call !== filters.fundingCall) return false;
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'deadline') cmp = a.deadline.localeCompare(b.deadline);
      else if (sortBy === 'budget') cmp = a.budget - b.budget;
      else if (sortBy === 'created_at') cmp = a.created_at.localeCompare(b.created_at);
      else cmp = a.name.localeCompare(b.name, 'it');
      return cmp * dir;
    });
  }, [offers, filters, view, sortBy, sortDir]);

  function SortIcon({ col }: { col: SortBy }) {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-slate-700" />
      : <ChevronDown className="w-3 h-3 text-slate-700" />;
  }

  function openNew() { setEditing(null); setFormOpen(true); }

  async function handleDelete() {
    if (!toDelete) return;
    await offersService.remove(toDelete.id);
    setToDelete(null);
    setSelected((p) => { const n = new Set(p); n.delete(toDelete.id); return n; });
    await reload();
  }

  function toggleSelectAll(checked: boolean) {
    setSelected(checked ? new Set(visibleOffers.map((o) => o.id)) : new Set());
  }
  function toggleOne(id: string) {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function applyBulkStatus() {
    if (!bulkStatus || selected.size === 0) return;
    setBulkBusy(true);
    const today = new Date().toISOString().slice(0, 10);
    await Promise.all(Array.from(selected).map((id) => {
      const o = offers.find((x) => x.id === id);
      if (!o) return Promise.resolve();
      const patch: Partial<Offer> = { status: bulkStatus };
      if (bulkStatus === 'presentata' && !o.submitted_at) patch.submitted_at = today;
      return offersService.update(id, patch);
    }));
    setSelected(new Set()); setBulkStatus(''); setBulkBusy(false);
    await reload();
  }

  const allSelected = visibleOffers.length > 0 && visibleOffers.every((o) => selected.has(o.id));
  const thClass = 'px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Offerte</h1>
          <p className="text-sm text-slate-500 mt-0.5">{offers.length} offerte totali</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition"
        >
          <Plus className="w-4 h-4" />
          Nuova offerta
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {([
            { id: 'all', label: 'Tutte' },
            { id: 'in_corso', label: 'In corso' },
            { id: 'approvate', label: 'Approvate' },
            { id: 'respinte', label: 'Respinte' },
          ] as const).map(({ id, label }) => {
            const active = view === id;
            return (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
                <span className={`text-xs px-1.5 py-0.5 rounded-md tabular-nums ${
                  active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/70 text-slate-500'
                }`}>
                  {tabCounts[id]}
                </span>
              </button>
            );
          })}
        </div>

        <YearSelector
          offers={offers}
          value={filters.year}
          onChange={(year) => setFilters({ ...filters, year })}
        />
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Cerca per nome…"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border rounded-xl transition ${
            filtersOpen || isFiltered
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtri
          {isFiltered && (
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-medium">
              {[filters.status, filters.outcome, filters.type, filters.projectManagerId, filters.fundingCall]
                .filter((v) => v !== 'all').length}
            </span>
          )}
        </button>
      </div>

      {filtersOpen && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value as Filters['status'] })} className={selectClass}>
              <option value="all">Tutti gli stati</option>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={filters.outcome} onChange={(e) => setFilters({ ...filters, outcome: e.target.value as Filters['outcome'] })} className={selectClass}>
              <option value="all">Tutti gli esiti</option>
              {OUTCOME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value as Filters['type'] })} className={selectClass}>
              <option value="all">Tutte le tipologie</option>
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={filters.projectManagerId} onChange={(e) => setFilters({ ...filters, projectManagerId: e.target.value })} className={selectClass}>
              <option value="all">Tutti i PM</option>
              <option value="__none__">— Nessun PM</option>
              {projectManagers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={filters.fundingCall} onChange={(e) => setFilters({ ...filters, fundingCall: e.target.value })} className={selectClass}>
              <option value="all">Tutti i bandi</option>
              {fundingCalls.map((f) => <option key={f.id} value={f.code}>{f.code}</option>)}
            </select>
          </div>
          {isFiltered && (
            <button onClick={clearFilters} className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
              <X className="w-3 h-3" /> Pulisci filtri
            </button>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-indigo-900">{selected.size} selezionate</span>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as OfferStatus | '')} className="px-3 py-1.5 text-sm border border-indigo-200 rounded-lg bg-white">
            <option value="">Cambia stato in…</option>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={applyBulkStatus} disabled={!bulkStatus || bulkBusy} className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60">
            {bulkBusy ? 'Aggiornamento…' : 'Applica'}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-indigo-700 ml-auto">Deseleziona tutto</button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                </th>
                <th className={thClass}>
                  <button onClick={() => toggleSort('name')} className="inline-flex items-center gap-1.5">Nome <SortIcon col="name" /></button>
                </th>
                <th className={thClass}>Tipo</th>
                <th className={thClass}>Bando / Cliente</th>
                <th className={thClass}>PM</th>
                <th className={thClass}>
                  <button onClick={() => toggleSort('deadline')} className="inline-flex items-center gap-1.5">Scadenza <SortIcon col="deadline" /></button>
                </th>
                <th className={`${thClass} text-right`}>
                  <button onClick={() => toggleSort('budget')} className="inline-flex items-center gap-1.5 ml-auto">Importo <SortIcon col="budget" /></button>
                </th>
                <th className={`${thClass} text-right`}>Prob.</th>
                <th className={thClass}>Stato</th>
                <th className={thClass}>Esito</th>
                <th className={`${thClass} text-right`} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={11} className="text-center py-12 text-slate-400 text-sm">Caricamento…</td></tr>
              ) : visibleOffers.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-12 text-slate-400 text-sm">
                  {offers.length === 0 ? 'Nessuna offerta. Clicca "+ Nuova offerta" per iniziare.' : 'Nessuna offerta corrisponde ai filtri.'}
                </td></tr>
              ) : visibleOffers.map((o) => {
                const pm = o.project_manager_id ? pmById.get(o.project_manager_id) : undefined;
                const sel = selected.has(o.id);
                return (
                  <tr key={o.id} onClick={() => navigate(`/offerte/${o.id}`)}
                    className={`cursor-pointer transition-colors ${sel ? 'bg-indigo-50/50' : 'hover:bg-slate-50/80'}`}>
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={sel} onChange={() => toggleOne(o.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </td>
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-900 max-w-[200px] truncate">{o.name}</td>
                    <td className="px-4 py-3.5"><TypeBadge value={o.type} /></td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 max-w-[160px] truncate">
                      {o.type === 'financed' ? o.funding_call : o.client}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{pm?.name ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700 tabular-nums">{formatDate(o.deadline)}</td>
                    <td className="px-4 py-3.5 text-sm text-right tabular-nums font-medium text-slate-900">{formatEUR(o.budget)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`text-sm font-semibold tabular-nums ${
                        (o.probability ?? 50) >= 70 ? 'text-emerald-600' :
                        (o.probability ?? 50) >= 40 ? 'text-amber-600' : 'text-red-500'
                      }`}>{o.probability ?? 50}%</span>
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge value={o.status} /></td>
                    <td className="px-4 py-3.5"><OutcomeBadge value={o.outcome} /></td>
                    <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setToDelete(o)} className="text-xs text-slate-400 hover:text-red-600 transition">Elimina</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {visibleOffers.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-400">{visibleOffers.length} di {offers.length} offerte</p>
          </div>
        )}
      </div>

      <OfferFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={reload}
        offer={editing} projectManagers={projectManagers} fundingCalls={fundingCalls} offers={offers} />
      <ConfirmDialog open={!!toDelete} title="Eliminare l'offerta?"
        message={toDelete ? `"${toDelete.name}" verrà rimossa definitivamente.` : ''}
        confirmLabel="Elimina" variant="danger"
        onConfirm={handleDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
