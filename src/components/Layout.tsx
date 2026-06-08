import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  Camera,
  ChevronRight,
  Clock,
  Download,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MonitorCheck,
  UserSearch,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { projectManagersService, navCountsService } from '../lib/dataService';
import { exportAllData } from '../lib/exportData';
import Avatar from './Avatar';
import NotificationBell from './NotificationBell';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/scrivania', label: 'Scrivania', icon: MonitorCheck },
  { to: '/leads', label: 'Lead Candidates', icon: UserSearch },
  { to: '/concepts', label: 'Concept Development', icon: FlaskConical },
  { to: '/offerte', label: 'Offerte', icon: FileText },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/anagrafiche', label: 'Anagrafiche', icon: BookOpen },
  { to: '/attivita', label: 'Attività', icon: Clock },
];

function UserAvatarUpload() {
  const { currentPm, refreshCurrentPm, user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentPm) return;
    setUploading(true);
    try {
      await projectManagersService.uploadAvatar(currentPm, file);
      await refreshCurrentPm();
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  }

  const name = currentPm?.name ?? user?.email ?? '';
  const title = currentPm ? 'Clicca per cambiare foto profilo' : 'Nessun profilo PM collegato';

  return (
    <div
      className={`relative shrink-0 ${currentPm ? 'cursor-pointer group' : ''}`}
      onClick={() => currentPm && !uploading && fileRef.current?.click()}
      title={title}
    >
      <Avatar name={name} url={currentPm?.avatar_url} size="md" />
      {currentPm && (
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
          {uploading
            ? <Loader2 className="w-3 h-3 text-white animate-spin" />
            : <Camera className="w-3 h-3 text-white" />}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleFile(e)} />
    </div>
  );
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, currentPm, signOut, isDemoMode } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [counts, setCounts] = useState<{ leads: number; concepts: number; offers: number } | null>(null);

  useEffect(() => {
    navCountsService.get().then(setCounts).catch(() => {});
  }, []);

  async function handleExport() {
    setExporting(true);
    try { await exportAllData(); }
    finally { setExporting(false); }
  }

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
        {navItems.map(({ to, label, icon: Icon, end }) => {
          const count =
            to === '/leads'    ? counts?.leads    :
            to === '/concepts' ? counts?.concepts :
            to === '/offerte'  ? counts?.offers   :
            undefined;
          return (
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
                  {count != null && (
                    <span className={`text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center ${
                      isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  )}
                  {isActive && count == null && <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 shrink-0">
        {isDemoMode && (
          <div className="mb-3 mx-1 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200/70">
            <p className="text-xs font-medium text-amber-800">Modalità demo</p>
            <p className="text-xs text-amber-700 mt-0.5">Dati salvati nel browser</p>
          </div>
        )}
        <button
          onClick={() => void handleExport()}
          disabled={exporting}
          title="Esporta backup dati (JSON)"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 mb-0.5"
        >
          {exporting
            ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
            : <Download className="w-4 h-4 shrink-0" />}
          <span>{exporting ? 'Esportazione…' : 'Esporta dati'}</span>
        </button>

        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 group">
          <UserAvatarUpload />
          <div className="flex-1 min-w-0">
            {currentPm?.name && (
              <p className="text-xs font-semibold text-slate-900 truncate">{currentPm.name}</p>
            )}
            <p className={`truncate ${currentPm?.name ? 'text-[11px] text-slate-400' : 'text-xs font-medium text-slate-900'}`}>
              {user?.email}
            </p>
          </div>
          <button onClick={signOut} title="Esci"
            className="opacity-0 group-hover:opacity-100 transition text-slate-300 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
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
        {/* Topbar — always visible on all screen sizes */}
        <header className="h-14 bg-white border-b border-slate-200/80 flex items-center px-4 gap-3 sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-slate-500 hover:text-slate-700"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-slate-900 lg:hidden flex-1">Offerte commerciali</span>
          <div className="hidden lg:flex flex-1" />
          <NotificationBell />
        </header>

        <main className="flex-1 px-6 py-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
