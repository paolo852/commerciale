import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, CheckCircle2, ChevronDown, ChevronUp, Pencil, Plus, Search, Send, SlidersHorizontal, TrendingUp, Trophy, X, XCircle } from 'lucide-react';
import { useOffersData } from '../hooks/useOffersData';
import { offersService } from '../lib/dataService';
import { offerYear } from '../lib/analytics';
import YearSelector from '../components/YearSelector';
import { formatDate, formatEUR } from '../lib/format';
import {
  OutcomeBadge,
  TypeBadge,
  OUTCOME_OPTIONS,
  TYPE_OPTIONS,
} from '../components/Badges';
import OfferFormModal from '../components/offerte/OfferFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import type { Offer, OfferOutcome, OfferStatus, OfferType } from '../types';

type SortBy = 'deadline' | 'budget' | 'created_at' | 'name';
type SortDir = 'asc' | 'desc';
type ViewTab = 'in_lavorazione' | 'presentata' | 'approvata' | 'rifiutata';
const VALID_VIEWS: ViewTab[] = ['in_lavorazione', 'presentata', 'approvata', 'rifiutata'];

interface Filters {
  search: string;
  outcome: OfferOutcome | 'all';
  type: OfferType | 'all';
  projectManagerId: string | 'all';
  fundingCall: string | 'all';
  year: number | 'all';
}

const selectClass =
  'px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

function sp(params: URLSearchParams, key: string, fallback: string): string {
  return params.get(key) ?? fallback;
}

function filtersFromParams(params: URLSearchParams): Filters {
  const year = params.get('year');
  return {
    search: sp(params, 'q', ''),
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

  const rawView = sp(searchParams, 'view', 'in_lavorazione') as ViewTab;
  const view: ViewTab = VALID_VIEWS.includes(rawView) ? rawView : 'in_lavorazione';
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
      ['q', 'outcome', 'type', 'pm', 'call', 'year'].forEach((k) => n.delete(k));
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

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [toDelete, setToDelete] = useState<Offer | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OfferStatus | ''>('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const pmById = useMemo(() => new Map(projectManagers.map((p) => [p.id, p])), [projectManagers]);

  const currentYear = new Date().getFullYear();
  const statsYear = filters.year !== 'all' ? filters.year : currentYear;

  const approvedOffers = useMemo(
    () => offers.filter((o) => o.outcome === 'approvato' && offerYear(o) === statsYear),
    [offers, statsYear],
  );
  const approvedRevenue = useMemo(
    () => approvedOffers.reduce((s, o) => s + o.budget, 0),
    [approvedOffers],
  );

  function compactEUR(value: number): string {
    if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
    if (value >= 1_000) return `€${Math.round(value / 1_000)}K`;
    return formatEUR(value);
  }

  const isFiltered =
    filters.search ||
    filters.outcome !== 'all' ||
    filters.type !== 'all' ||
    filters.projectManagerId !== 'all' ||
    filters.fundingCall !== 'all';

  const yearScopedOffers = useMemo(
    () => filters.year === 'all' ? offers : offers.filter((o) => offerYear(o) === filters.year),
    [offers, filters.year],
  );

  const tabCounts = useMemo(() => ({
    in_lavorazione: yearScopedOffers.filter((o) => o.status === 'in_lavorazione' && o.outcome === 'nessuno').length,
    presentata: yearScopedOffers.filter((o) => o.status === 'presentata').length,
    approvata: yearScopedOffers.filter((o) => o.outcome === 'approvato').length,
    rifiutata: yearScopedOffers.filter((o) => o.outcome === 'rifiutato').length,
  }), [yearScopedOffers]);

  const visibleOffers = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const filtered = offers.filter((o) => {
      if (view === 'approvata') {
        if (o.outcome !== 'approvato') return false;
      } else if (view === 'rifiutata') {
        if (o.outcome !== 'rifiutato') return false;
      } else {
        if (o.status !== view) return false;
        if (view === 'in_lavorazione' && o.outcome !== 'nessuno') return false;
        if (filters.outcome !== 'all' && o.outcome !== filters.outcome) return false;
      }
      if (filters.year !== 'all' && offerYear(o) !== filters.year) return false;
      if (search && !o.name.toLowerCase().includes(search)) return false;
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

  const STATUS_OPTIONS_BULK: { value: OfferStatus; label: string }[] = [
    { value: 'in_lavorazione', label: 'In lavorazione' },
    { value: 'presentata', label: 'Presentata' },
    { value: 'ferma', label: 'Ferma' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
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

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border px-4 py-3 flex items-center gap-3 bg-emerald-50 text-emerald-700 border-emerald-100">
          <Trophy className="w-5 h-5 shrink-0 text-emerald-500" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Approvate {statsYear}</p>
            <p className="text-2xl font-extrabold tabular-nums leading-tight">{approvedOffers.length}</p>
            <p className="text-[11px] opacity-60">progetti vinti</p>
          </div>
        </div>
        <div className="rounded-2xl border px-4 py-3 flex items-center gap-3 bg-teal-50 text-teal-700 border-teal-100">
          <TrendingUp className="w-5 h-5 shrink-0 text-teal-500" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Ricavo {statsYear}</p>
            <p className="text-2xl font-extrabold tabular-nums leading-tight">{compactEUR(approvedRevenue)}</p>
            <p className="text-[11px] opacity-60">da offerte approvate</p>
          </div>
        </div>
      </div>

      {/* Status toggle buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* In lavorazione */}
        <button
          onClick={() => setView('in_lavorazione')}
          className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border-2 transition-all font-medium text-sm ${
            view === 'in_lavorazione'
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
              : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700'
          }`}
        >
          <Pencil className="w-4 h-4 shrink-0" />
          <span className="font-semibold">In lavorazione</span>
          <span className={`text-sm font-bold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center tabular-nums ${
            view === 'in_lavorazione' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {tabCounts.in_lavorazione}
          </span>
        </button>

        {/* Presentata */}
        <button
          onClick={() => setView('presentata')}
          className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border-2 transition-all font-medium text-sm ${
            view === 'presentata'
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-200'
              : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
          }`}
        >
          <Send className="w-4 h-4 shrink-0" />
          <span className="font-semibold">Presentata</span>
          <span className={`text-sm font-bold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center tabular-nums ${
            view === 'presentata' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {tabCounts.presentata}
          </span>
        </button>

        {/* Approvate */}
        <button
          onClick={() => setView('approvata')}
          className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border-2 transition-all font-medium text-sm ${
            view === 'approvata'
              ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200'
              : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-semibold">Approvate</span>
          <span className={`text-sm font-bold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center tabular-nums ${
            view === 'approvata' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {tabCounts.approvata}
          </span>
        </button>

        {/* Rifiutate */}
        <button
          onClick={() => setView('rifiutata')}
          className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border-2 transition-all font-medium text-sm ${
            view === 'rifiutata'
              ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-200'
              : 'bg-white border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-700'
          }`}
        >
          <XCircle className="w-4 h-4 shrink-0" />
          <span className="font-semibold">Rifiutate</span>
          <span className={`text-sm font-bold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center tabular-nums ${
            view === 'rifiutata' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {tabCounts.rifiutata}
          </span>
        </button>

        <div className="ml-auto">
          <YearSelector
            offers={offers}
            value={filters.year}
            onChange={(year) => setFilters({ ...filters, year })}
          />
        </div>
      </div>

      {/* Search + filter toggle */}
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
              {[filters.outcome, filters.type, filters.projectManagerId, filters.fundingCall]
                .filter((v) => v !== 'all').length}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {filtersOpen && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-indigo-900">{selected.size} selezionate</span>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as OfferStatus | '')} className="px-3 py-1.5 text-sm border border-indigo-200 rounded-lg bg-white">
            <option value="">Cambia stato in…</option>
            {STATUS_OPTIONS_BULK.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={applyBulkStatus} disabled={!bulkStatus || bulkBusy} className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60">
            {bulkBusy ? 'Aggiornamento…' : 'Applica'}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-indigo-700 ml-auto">Deseleziona tutto</button>
        </div>
      )}

      {/* Table */}
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
                <th className={thClass}>Esito</th>
                <th className={`${thClass} text-right`} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400 text-sm">Caricamento…</td></tr>
              ) : visibleOffers.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400 text-sm">
                  {offers.length === 0
                    ? 'Nessuna offerta. Clicca "+ Nuova offerta" per iniziare.'
                    : `Nessuna offerta ${
                        view === 'in_lavorazione' ? 'in lavorazione'
                        : view === 'presentata' ? 'presentata'
                        : view === 'approvata' ? 'approvata'
                        : 'rifiutata'
                      }${isFiltered ? ' corrisponde ai filtri' : ''}.`}
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
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-slate-400">{visibleOffers.length} di {tabCounts[view]} offerte {
              view === 'in_lavorazione' ? 'in lavorazione'
              : view === 'presentata' ? 'presentate'
              : view === 'approvata' ? 'approvate'
              : 'rifiutate'
            }</p>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-500">
                Totale importi: <strong className="text-slate-700 tabular-nums">{formatEUR(visibleOffers.reduce((s, o) => s + o.budget, 0))}</strong>
              </span>
              {view !== 'approvata' && (
                <span className="text-xs text-slate-500">
                  Valore atteso: <strong className="text-slate-700 tabular-nums">
                    {formatEUR(visibleOffers.reduce((s, o) => s + o.budget * (o.probability ?? 50) / 100, 0))}
                  </strong>
                </span>
              )}
            </div>
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
