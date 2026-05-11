import { useEffect, useState } from 'react';
import { Sparkles, Target } from 'lucide-react';
import { conceptMatchesService } from '../../lib/dataService';
import { formatDate } from '../../lib/format';
import type { Concept, ConceptMatch, FundingCall } from '../../types';

interface Props {
  concept: Concept;
  fundingCalls: FundingCall[];
}

function scoreColor(s: number): string {
  if (s >= 75) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (s >= 55) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

export default function ConceptMatchesPanel({ concept, fundingCalls }: Props) {
  const [matches, setMatches] = useState<ConceptMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  const fcById = new Map(fundingCalls.map((fc) => [fc.id, fc]));

  useEffect(() => {
    setLoading(true);
    conceptMatchesService.list(concept.id)
      .then(setMatches)
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [concept.id]);

  async function runAnalysis() {
    setAnalyzing(true); setError(null);
    try {
      const { matches: result, model: m } = await conceptMatchesService.analyze(concept, fundingCalls);
      setMatches(result);
      if (m) setModel(m);
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Errore matching');
    } finally {
      setAnalyzing(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const activeCount = fundingCalls.filter((fc) => !fc.deadline || fc.deadline >= today).length;
  const lastAnalyzed = matches[0]?.analyzed_at;

  return (
    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl border border-violet-200 px-4 py-3.5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <h4 className="text-sm font-semibold text-slate-900">Match con bandi (AI)</h4>
          {lastAnalyzed && (
            <span className="text-xs text-slate-500">· analizzato il {formatDate(lastAnalyzed)}</span>
          )}
        </div>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={analyzing || activeCount === 0 || !concept.description}
          className="px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {analyzing ? 'Analisi in corso…' : matches.length > 0 ? 'Rianalizza' : 'Analizza con AI'}
        </button>
      </div>

      {!concept.description && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
          Inserisci una descrizione del concept per poter eseguire il match.
        </p>
      )}

      {activeCount === 0 ? (
        <p className="text-xs text-slate-500 py-2">
          Nessun bando attivo da analizzare. Aggiungi bandi non scaduti dalle Anagrafiche.
        </p>
      ) : (
        <p className="text-xs text-slate-500 mb-2">
          {activeCount} band{activeCount === 1 ? 'o' : 'i'} non scadut{activeCount === 1 ? 'o' : 'i'} disponibil{activeCount === 1 ? 'e' : 'i'} per l'analisi.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-slate-400 text-center py-3">Caricamento…</p>
      ) : matches.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-4 italic">
          Nessun match calcolato. Clicca "Analizza con AI" per iniziare.
        </p>
      ) : (
        <ul className="space-y-2">
          {matches.map((m) => {
            const fc = fcById.get(m.funding_call_id);
            return (
              <li key={m.id} className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
                <div className="flex items-start gap-2 mb-1">
                  <Target className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">
                        {fc ? `${fc.code} — ${fc.name}` : '(bando rimosso)'}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border tabular-nums ${scoreColor(m.score)}`}>
                        {m.score}/100
                      </span>
                    </div>
                    {fc?.deadline && (
                      <p className="text-[11px] text-slate-400 mt-0.5">Scadenza: {formatDate(fc.deadline)}</p>
                    )}
                  </div>
                </div>
                {m.rationale && (
                  <p className="text-xs text-slate-600 leading-relaxed mt-1.5 ml-5">{m.rationale}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {model && (
        <p className="text-[10px] text-slate-400 text-right mt-2">Modello: {model}</p>
      )}
    </div>
  );
}
