import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type Mode = 'signin' | 'request' | 'forgot';

export default function Login() {
  const { signIn, requestAccess, isDemoMode } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(m: Mode) { setMode(m); setError(null); setSuccess(null); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        navigate('/');
      } else if (mode === 'request') {
        await requestAccess(email);
        setSuccess('Controlla la tua email: ti abbiamo inviato un link per accedere e impostare la password.');
        setEmail('');
      } else {
        // forgot — send password reset email
        if (!supabase) throw new Error('Supabase non configurato.');
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) throw err;
        setSuccess('Controlla la tua email: ti abbiamo inviato un link per reimpostare la password.');
        setEmail('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di autenticazione');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:flex-1 flex-col justify-between bg-indigo-600 px-12 py-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">
            Offerte commerciali
          </span>
        </div>
        <div>
          <blockquote className="text-indigo-100 text-2xl font-light leading-relaxed mb-4">
            "Tieni sotto controllo ogni offerta,<br />dalla bozza all'esito finale."
          </blockquote>
          <div className="flex gap-6 mt-8">
            {['Pipeline completa', 'Analytics avanzate', 'Multi-bando'].map((f) => (
              <div key={f} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-300" />
                <span className="text-indigo-200 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-indigo-400 text-xs">© {new Date().getFullYear()} Day One</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900">Offerte commerciali</span>
          </div>

          <h1 className="text-2xl font-semibold text-slate-900 mb-1">
            {mode === 'signin' ? 'Bentornato' : mode === 'request' ? 'Primo accesso' : 'Reimposta password'}
          </h1>
          <p className="text-sm text-slate-500 mb-8">
            {mode === 'signin'
              ? 'Inserisci le tue credenziali per accedere'
              : mode === 'request'
              ? 'Se sei in lista, riceverai un link via email per impostare la password'
              : 'Inserisci la tua email e ti invieremo un link per scegliere una nuova password'}
          </p>

          {isDemoMode && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200/70">
              <p className="text-xs font-medium text-amber-900">Modalità demo attiva</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Supabase non configurato — i dati vengono salvati nel browser.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@azienda.it"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            {mode === 'signin' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <input
                  type="password"
                  required={!isDemoMode}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isDemoMode ? 'Non richiesta in demo mode' : '••••••••'}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            )}

            {error && (
              <div className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-sm shadow-indigo-200"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : mode === 'signin' ? 'Accedi' : 'Invia link via email'}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-2 text-sm text-slate-500">
            {mode !== 'signin' && (
              <button type="button" onClick={() => switchMode('signin')}
                className="font-medium text-indigo-600 hover:text-indigo-700">
                Torna al login
              </button>
            )}
            {mode === 'signin' && (
              <>
                <span>
                  Primo accesso?{' '}
                  <button type="button" onClick={() => switchMode('request')}
                    className="font-medium text-indigo-600 hover:text-indigo-700">
                    Richiedi accesso
                  </button>
                </span>
                <button type="button" onClick={() => switchMode('forgot')}
                  className="text-slate-400 hover:text-slate-600 text-xs">
                  Password dimenticata?
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
