import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/concepts', label: 'Concept Development', icon: FlaskConical },
  { to: '/offerte', label: 'Offerte', icon: FileText },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/anagrafiche', label: 'Anagrafiche', icon: BookOpen },
];

function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, signOut, isDemoMode } = useAuth();

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/80">
      {/* Brand */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200/80 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-900 tracking-tight">
            Offerte
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 lg:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 shrink-0">
        {isDemoMode && (
          <div className="mb-3 mx-1 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200/70">
            <p className="text-xs font-medium text-amber-800">Modalità demo</p>
            <p className="text-xs text-amber-700 mt-0.5">Dati salvati nel browser</p>
          </div>
        )}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 group">
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-indigo-700 uppercase">
              {user?.email?.[0] ?? '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-900 truncate">{user?.email}</p>
          </div>
          <button
            onClick={signOut}
            title="Esci"
            className="text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0">
        <Sidebar />
      </aside>

      {/* Sidebar mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-60 flex flex-col">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 lg:pl-60 flex flex-col min-h-screen">
        {/* Mobile topbar */}
        <header className="lg:hidden h-14 bg-white border-b border-slate-200/80 flex items-center px-4 gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-slate-500 hover:text-slate-700"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-slate-900">Offerte commerciali</span>
        </header>

        <main className="flex-1 px-6 py-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
