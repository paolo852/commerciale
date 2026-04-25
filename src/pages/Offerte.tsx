import { useMemo, useState } from 'react';
import { useOffersData } from '../hooks/useOffersData';
import { offersService } from '../lib/dataService';
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
import type {
  Offer,
  OfferOutcome,
  OfferStatus,
  OfferType,
} from '../types';

type SortBy = 'deadline' | 'budget' | 'created_at' | 'name';
type SortDir = 'asc' | 'desc';

interface Filters {
  search: string;
  status: OfferStatus | 'all';
  outcome: OfferOutcome | 'all';
  type: OfferType | 'all';
  projectManagerId: string | 'all';
  fundingCall: string | 'all';
}

const defaultFilters: Filters = {
  search: '',
  status: 'all',
  outcome: 'all',
  type: 'all',
  projectManagerId: 'all',
  fundingCall: 'all',
};

export default function Offerte() {
  const { offers, projectManagers, fundingCalls, loading, error, reload } = useOffersData();

  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sortBy, setSortBy] = useState<SortBy>('deadline');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);

  const [toDelete, setToDelete] = useState<Offer | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OfferStatus | ''>('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const pmById = useMemo(
    () => new Map(projectManagers.map((p) => [p.id, p])),
    [projectManagers],
  );

  const visibleOffers = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    const filtered = offers.filter((o) => {
      if (search && !o.name.toLowerCase().includes(search)) return false;
      if (filters.status !== 'all' && o.status !== filters.status) return false;
      if (filters.outcome !== 'all' && o.outcome !== filters.outcome) return false;
      if (filters.type !== 'all' && o.type !== filters.type) return false;
      if (filters.projectManagerId !== 'all') {
        if (filters.projectManagerId === '__none__') {
          if (o.project_manager_id) return false;
        } else if (o.project_manager_id !== filters.projectManagerId) return false;
      }
      if (filters.fundingCall !== 'all' && o.funding_call !== filters.fundingCall) return false;
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'deadline':
          cmp = a.deadline.localeCompare(b.deadline);
          break;
        case 'budget':
          cmp = a.budget - b.budget;
          break;
        case 'created_at':
          cmp = a.created_at.localeCompare(b.created_at);
          break;
        case 'name':
          cmp = a.name.localeCompare(b.name, 'it');
          break;
      }
      return cmp * dir;
    });
  }, [offers, filters, sortBy, sortDir]);

  function toggleSort(column: SortBy) {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir(column === 'budget' || column === 'created_at' ? 'desc' : 'asc');
    }
  }

  function sortIcon(column: SortBy) {
    if (sortBy !== column) return <span className="text-slate-300">↕</span>;
    return <span className="text-slate-700">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(offer: Offer) {
    setEditing(offer);
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!toDelete) return;
    try {
      await offersService.remove(toDelete.id);
      setToDelete(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(toDelete.id);
        return next;
      });
      await reload();
    } catch (e) {
      console.error(e);
    }
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(visibleOffers.map((o) => o.id)));
    } else {
      setSelected(new Set());
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyBulkStatus() {
    if (!bulkStatus || selected.size === 0) return;
    setBulkBusy(true);
    try {
      // Per coerenza con i CHECK, se passiamo a "presentata" senza submitted_at,
      // impostiamo la data odierna.
      const today = new Date().toISOString().slice(0, 10);
      await Promise.all(
        Array.from(selected).map((id) => {
          const offer = offers.find((o) => o.id === id);
          if (!offer) return Promise.resolve();
          const patch: Partial<Offer> = { status: bulkStatus };
          if (bulkStatus === 'presentata' && !offer.submitted_at) {
            patch.submitted_at = today;
          }
          return offersService.update(id, patch);
        }),
      );
      setSelected(new Set());
      setBulkStatus('');
      await reload();
    } catch (e) {
      console.error(e);
    } finally {
      setBulkBusy(false);
    }
  }

  const allVisibleSelected =
    visibleOffers.length > 0 && visibleOffers.every((o) => selected.has(o.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Offerte</h1>
        <button
          onClick={openNew}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          + Nuova offerta
        </button>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <input
              type="search"
              placeholder="Cerca per nome…"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as Filters['status'] })}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tutti gli stati</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={filters.outcome}
            onChange={(e) => setFilters({ ...filters, outcome: e.target.value as Filters['outcome'] })}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tutti gli esiti</option>
            {OUTCOME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value as Filters['type'] })}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tutte le tipologie</option>
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={filters.projectManagerId}
            onChange={(e) => setFilters({ ...filters, projectManagerId: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tutti i PM</option>
            <option value="__none__">— Nessun PM</option>
            {projectManagers.map((pm) => (
              <option key={pm.id} value={pm.id}>{pm.name}</option>
            ))}
          </select>
          <select
            value={filters.fundingCall}
            onChange={(e) => setFilters({ ...filters, fundingCall: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 lg:col-span-2"
          >
            <option value="all">Tutti i bandi</option>
            {fundingCalls.map((fc) => (
              <option key={fc.id} value={fc.code}>{fc.code} — {fc.name}</option>
            ))}
          </select>
        </div>

        {(filters.search ||
          filters.status !== 'all' ||
          filters.outcome !== 'all' ||
          filters.type !== 'all' ||
          filters.projectManagerId !== 'all' ||
          filters.fundingCall !== 'all') && (
          <button
            onClick={() => setFilters(defaultFilters)}
            className="mt-3 text-sm text-indigo-600 hover:text-indigo-700"
          >
            Pulisci filtri
          </button>
        )}
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-indigo-900">
            {selected.size} selezionate
          </span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as OfferStatus | '')}
            className="px-3 py-1.5 text-sm border border-indigo-300 rounded-lg bg-white"
          >
            <option value="">Cambia stato in…</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={applyBulkStatus}
            disabled={!bulkStatus || bulkBusy}
            className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {bulkBusy ? 'Aggiornamento…' : 'Applica'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-indigo-700 hover:text-indigo-900 ml-auto"
          >
            Deseleziona tutto
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Tabella */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="text-left px-3 py-3 font-medium">
                  <button onClick={() => toggleSort('name')} className="inline-flex items-center gap-1">
                    Nome {sortIcon('name')}
                  </button>
                </th>
                <th className="text-left px-3 py-3 font-medium">Tipo</th>
                <th className="text-left px-3 py-3 font-medium">Bando / Cliente</th>
                <th className="text-left px-3 py-3 font-medium">PM</th>
                <th className="text-left px-3 py-3 font-medium">
                  <button onClick={() => toggleSort('deadline')} className="inline-flex items-center gap-1">
                    Scadenza {sortIcon('deadline')}
                  </button>
                </th>
                <th className="text-right px-3 py-3 font-medium">
                  <button onClick={() => toggleSort('budget')} className="inline-flex items-center gap-1 ml-auto">
                    Importo {sortIcon('budget')}
                  </button>
                </th>
                <th className="text-left px-3 py-3 font-medium">Stato</th>
                <th className="text-left px-3 py-3 font-medium">Esito</th>
                <th className="text-right px-3 py-3 font-medium">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-400">Caricamento…</td>
                </tr>
              ) : visibleOffers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-400">
                    {offers.length === 0
                      ? 'Nessuna offerta. Inseriscine una per iniziare.'
                      : 'Nessuna offerta corrisponde ai filtri selezionati.'}
                  </td>
                </tr>
              ) : (
                visibleOffers.map((o) => {
                  const pm = o.project_manager_id ? pmById.get(o.project_manager_id) : undefined;
                  const isSelected = selected.has(o.id);
                  return (
                    <tr
                      key={o.id}
                      className={`border-t border-slate-100 cursor-pointer ${
                        isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => openEdit(o)}
                    >
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(o.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-900">{o.name}</td>
                      <td className="px-3 py-3"><TypeBadge value={o.type} /></td>
                      <td className="px-3 py-3 text-slate-700">
                        {o.type === 'financed' ? o.funding_call : o.client}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{pm?.name ?? '—'}</td>
                      <td className="px-3 py-3 text-slate-700">{formatDate(o.deadline)}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium text-slate-900">
                        {formatEUR(o.budget)}
                      </td>
                      <td className="px-3 py-3"><StatusBadge value={o.status} /></td>
                      <td className="px-3 py-3"><OutcomeBadge value={o.outcome} /></td>
                      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setToDelete(o)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-3">
        {visibleOffers.length} di {offers.length} offerte
      </p>

      <OfferFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={reload}
        offer={editing}
        projectManagers={projectManagers}
        fundingCalls={fundingCalls}
      />

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminare l'offerta?"
        message={toDelete ? `"${toDelete.name}" verrà rimossa definitivamente.` : ''}
        confirmLabel="Elimina"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
