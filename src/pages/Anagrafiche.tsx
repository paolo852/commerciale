import { useState } from 'react';
import { BookOpen, Download, ShieldCheck, Users } from 'lucide-react';
import ProjectManagersTab from '../components/anagrafiche/ProjectManagersTab';
import FundingCallsTab from '../components/anagrafiche/FundingCallsTab';
import AllowedUsersTab from '../components/anagrafiche/AllowedUsersTab';
import ExportTab from '../components/anagrafiche/ExportTab';

type Tab = 'pm' | 'fc' | 'users' | 'export';

const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'pm', label: 'Project Managers', icon: Users },
  { id: 'fc', label: 'Funding Calls', icon: BookOpen },
  { id: 'users', label: 'Utenti autorizzati', icon: ShieldCheck },
  { id: 'export', label: 'Esporta / Backup', icon: Download },
];

export default function Anagrafiche() {
  const [tab, setTab] = useState<Tab>('pm');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Anagrafiche</h1>
        <p className="text-sm text-slate-500 mt-0.5">Gestione project manager, bandi, utenti ed esportazione</p>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'pm' && <ProjectManagersTab />}
      {tab === 'fc' && <FundingCallsTab />}
      {tab === 'users' && <AllowedUsersTab />}
      {tab === 'export' && <ExportTab />}
    </div>
  );
}
