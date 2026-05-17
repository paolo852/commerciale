import { useEffect, useRef, useState } from 'react';
import type { ProjectManager } from '../../types';
import Avatar from '../Avatar';

interface Props {
  value: string;
  onChange: (text: string, mentionIds: string[]) => void;
  projectManagers: ProjectManager[];
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

// Estrae gli ID dei PM menzionati nel testo (dato il testo e la lista di PM).
// I mention sono memorizzati come "@nome" e poi convertiti in ID al momento del salvataggio.
function extractMentionIds(text: string, pms: ProjectManager[]): string[] {
  const ids = new Set<string>();
  const re = /@([\w\s'À-ÿ]+?)(?=[,.;!?\s]|$)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].trim().toLowerCase();
    const pm = pms.find((p) => p.name.toLowerCase() === name);
    if (pm) ids.add(pm.id);
  }
  return [...ids];
}

export default function MentionInput({
  value, onChange, projectManagers, placeholder, rows = 3, disabled,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursorAt, setCursorAt] = useState(0);

  useEffect(() => {
    if (!suggestOpen) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [suggestOpen]);

  function update(text: string) {
    const ids = extractMentionIds(text, projectManagers);
    onChange(text, ids);
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    const pos = e.target.selectionStart;
    update(text);

    // Rileva se l'utente sta digitando dopo @ (autocomplete)
    const before = text.slice(0, pos);
    const atIdx = before.lastIndexOf('@');
    if (atIdx >= 0) {
      const fragment = before.slice(atIdx + 1);
      // Stop se c'è un newline o uno spazio multiplo (utente ha completato il mention)
      if (!fragment.includes('\n') && fragment.length <= 30) {
        setQuery(fragment.toLowerCase());
        setCursorAt(atIdx);
        setSuggestOpen(true);
        return;
      }
    }
    setSuggestOpen(false);
  }

  function applyMention(pm: ProjectManager) {
    if (!ref.current) return;
    const before = value.slice(0, cursorAt);
    const after = value.slice(ref.current.selectionStart);
    const next = `${before}@${pm.name} ${after}`;
    update(next);
    setSuggestOpen(false);
    // Riposiziona il cursore
    requestAnimationFrame(() => {
      if (ref.current) {
        const newPos = cursorAt + pm.name.length + 2;
        ref.current.selectionStart = ref.current.selectionEnd = newPos;
        ref.current.focus();
      }
    });
  }

  const suggestions = projectManagers
    .filter((p) => p.active && p.name.toLowerCase().includes(query))
    .slice(0, 6);

  return (
    <div className="relative">
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        onChange={handleInput}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none disabled:opacity-50"
      />
      {suggestOpen && suggestions.length > 0 && (
        <div className="absolute z-20 bottom-full left-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden min-w-[200px]">
          {suggestions.map((pm) => (
            <button
              key={pm.id}
              type="button"
              onClick={() => applyMention(pm)}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-indigo-50 transition flex items-center gap-2"
            >
              <Avatar name={pm.name} url={pm.avatar_url} size="xs" />
              <span>{pm.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Rendering del corpo commento con highlight dei mention.
export function CommentBody({ body, projectManagers }: { body: string; projectManagers: ProjectManager[] }) {
  const pmNames = new Set(projectManagers.map((p) => p.name.toLowerCase()));
  // Split su @nome e renderizza
  const parts: React.ReactNode[] = [];
  const re = /@([\w\s'À-ÿ]+?)(?=[,.;!?\s]|$)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) parts.push(<span key={i++}>{body.slice(last, m.index)}</span>);
    const name = m[1].trim();
    if (pmNames.has(name.toLowerCase())) {
      parts.push(
        <span key={i++} className="bg-indigo-50 text-indigo-700 px-1 rounded font-medium">
          @{name}
        </span>,
      );
    } else {
      parts.push(<span key={i++}>{m[0]}</span>);
    }
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push(<span key={i++}>{body.slice(last)}</span>);
  return <span className="whitespace-pre-wrap break-words">{parts}</span>;
}
