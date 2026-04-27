import { Navigate } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-500">
        <div className="w-7 h-7 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
        {slow ? (
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-slate-600">Avvio del database in corso…</p>
            <p className="text-xs text-slate-400">Il server si risveglia dopo un periodo di inattività.<br />Attendere 10–20 secondi.</p>
          </div>
        ) : (
          <p className="text-sm">Caricamento…</p>
        )}
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
