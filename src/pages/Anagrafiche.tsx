import { useState } from 'react';
import ProjectManagersTab from '../components/anagrafiche/ProjectManagersTab';
import FundingCallsTab from '../components/anagrafiche/FundingCallsTab';

type Tab = 'pm' | 'fc';

export default function Anagrafiche() {
  const [tab, setTab] = useState<Tab>('pm');

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Anagrafiche</h1>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        <button
          onClick={() => setTab('pm')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
            tab === 'pm'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Project Managers
        </button>
        <button
          onClick={() => setTab('fc')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
            tab === 'fc'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Funding Calls
        </button>
      </div>

      {tab === 'pm' ? <ProjectManagersTab /> : <FundingCallsTab />}
    </div>
  );
}
