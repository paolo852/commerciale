import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Supabase appends #access_token=...&type=recovery (or magiclink) to the redirect URL.
  // The client SDK picks this up automatically via onAuthStateChange; we just wait for it.
  useEffect(() => {
    if (!supabase) { navigate('/login'); return; }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });

    // Also check immediately in case the session is already set.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError('Le password non coincidono.'); return; }
    if (password.length < 8) { setError('La password deve avere almeno 8 caratteri.'); return; }
    setLoading(true);
    try {
      const { error: err } = await supabase!.auth.updateUser({ password });
      if (err) throw err;
      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <div className="hidden lg:flex lg:flex-1 flex-col justify-between bg-indigo-600 px-12 py-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">Offerte commerciali</span>
        </div>
        <p className="text-indigo-400 text-xs">© {new Date().getFullYear()} Day One</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">Imposta la password</h1>
          <p className="text-sm text-slate-500 mb-8">Scegli una password per i prossimi accessi.</p>

          {!ready ? (
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifica del link in corso…
            </div>
          ) : success ? (
            <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              Password impostata correttamente. Accesso in corso…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nuova password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Almeno 8 caratteri"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Conferma password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Ripeti la password"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>

              {error && (
                <div className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition shadow-sm shadow-indigo-200"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
