import { useRef, useState } from 'react';
import type { ProjectManager } from '../types';

interface MentionMatch {
  query: string;
  start: number;
  end: number;
}

function parseMention(text: string, cursor: number): MentionMatch | null {
  const before = text.slice(0, cursor);
  const atIdx = before.lastIndexOf('@');
  if (atIdx === -1) return null;
  const query = before.slice(atIdx + 1);
  if (query.includes('\n')) return null;
  return { query, start: atIdx, end: cursor };
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  mentions: string[];
  onMentionsChange: (ids: string[]) => void;
  projectManagers: ProjectManager[];
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
  onEnter?: () => void;
}

export default function MentionTextarea({
  value, onChange, mentions, onMentionsChange, projectManagers,
  placeholder, rows = 3, className, disabled, onEnter,
}: Props) {
  const [match, setMatch] = useState<MentionMatch | null>(null);
  const [hilite, setHilite] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const activePms = projectManagers.filter((p) => p.active);
  const filtered = match
    ? activePms.filter((p) => p.name.toLowerCase().includes(match.query.toLowerCase()))
    : [];

  function updateMatch(text: string, cursor: number) {
    const m = parseMention(text, cursor);
    setMatch(m);
    setHilite(0);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    const cursor = e.target.selectionStart ?? text.length;
    onChange(text);
    updateMatch(text, cursor);
  }

  function insertMention(pm: ProjectManager) {
    if (!match) return;
    const before = value.slice(0, match.start);
    const after = value.slice(match.end);
    const newText = `${before}@${pm.name} ${after}`;
    onChange(newText);
    if (!mentions.includes(pm.id)) onMentionsChange([...mentions, pm.id]);
    setMatch(null);
    setTimeout(() => {
      const pos = match.start + pm.name.length + 2;
      taRef.current?.setSelectionRange(pos, pos);
      taRef.current?.focus();
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (match && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHilite((i) => (i + 1) % filtered.length); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setHilite((i) => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filtered[hilite]); return; }
      if (e.key === 'Escape')    { setMatch(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && onEnter) {
      e.preventDefault();
      onEnter();
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        value={value}
        onChange={handleChange}
        onSelect={(e) => updateMatch(value, (e.target as HTMLTextAreaElement).selectionStart)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />
      {match !== null && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden text-sm">
          {filtered.map((pm, i) => (
            <li
              key={pm.id}
              onMouseDown={(e) => { e.preventDefault(); insertMention(pm); }}
              className={`px-3 py-2 cursor-pointer flex items-center gap-2 transition ${
                i === hilite ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                {pm.name.charAt(0).toUpperCase()}
              </span>
              {pm.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
