import { useRef, useState, useEffect, useCallback } from 'react';
import { Bold, Eye, Italic, Link as LinkIcon, List, ListOrdered, Pencil, Strikethrough } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface RichTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

/**
 * Textarea con toolbar minimale per formattazione Markdown (bold, italic, lists,
 * link, heading). Il contenuto resta plain text con sintassi Markdown. Usa
 * <RichTextView> per il rendering formattato.
 */
export function RichTextArea({
  value, onChange, placeholder, rows = 5, className = '', autoFocus, onBlur, onKeyDown,
}: RichTextAreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);

  // Wrappa la selezione con un prefisso/suffisso (es. **testo**)
  const wrapSelection = useCallback((prefix: string, suffix: string = prefix) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const before = value.slice(0, start);
    const after = value.slice(end);
    const content = selected || 'testo';
    const next = `${before}${prefix}${content}${suffix}${after}`;
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + prefix.length;
      ta.setSelectionRange(cursor, cursor + content.length);
    });
  }, [value, onChange]);

  // Prefissa le righe selezionate (es. "- " per bullet list)
  const prefixLines = useCallback((prefix: string | ((i: number) => string)) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const selected = value.slice(start, end) || 'voce';
    const after = value.slice(end);
    const lines = selected.split('\n');
    const prefixed = lines.map((l, i) => {
      const p = typeof prefix === 'function' ? prefix(i) : prefix;
      return `${p}${l}`;
    }).join('\n');
    onChange(`${before}${prefixed}${after}`);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, start + prefixed.length);
    });
  }, [value, onChange]);

  function insertLink() {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || 'testo del link';
    const url = window.prompt('URL del link:', 'https://');
    if (!url) return;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const next = `${before}[${selected}](${url})${after}`;
    onChange(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); wrapSelection('**'); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); wrapSelection('*'); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); insertLink(); return; }
    onKeyDown?.(e);
  }

  return (
    <div className={`border border-slate-200 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-slate-100 bg-slate-50/60 flex-wrap">
        <ToolbarBtn onClick={() => wrapSelection('**')} title="Grassetto (Ctrl+B)">
          <Bold className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => wrapSelection('*')} title="Corsivo (Ctrl+I)">
          <Italic className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => wrapSelection('~~')} title="Barrato">
          <Strikethrough className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <div className="w-px h-4 bg-slate-200 mx-0.5" />
        <ToolbarBtn onClick={() => prefixLines('- ')} title="Elenco puntato">
          <List className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => prefixLines((i) => `${i + 1}. `)} title="Elenco numerato">
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <div className="w-px h-4 bg-slate-200 mx-0.5" />
        <ToolbarBtn onClick={() => prefixLines('## ')} title="Titolo">
          <span className="font-bold text-xs">H</span>
        </ToolbarBtn>
        <ToolbarBtn onClick={insertLink} title="Link (Ctrl+K)">
          <LinkIcon className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded transition ${
            preview ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'
          }`}
          title={preview ? 'Modifica' : 'Anteprima'}
        >
          {preview ? <Pencil className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {preview ? 'Modifica' : 'Anteprima'}
        </button>
      </div>

      {/* Editor / Preview */}
      {preview ? (
        <div className="px-3 py-2 min-h-[6rem]">
          {value.trim() ? (
            <RichTextView content={value} />
          ) : (
            <p className="text-sm text-slate-400 italic">Nessun contenuto da mostrare.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onBlur}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm bg-transparent border-0 focus:outline-none resize-y leading-relaxed"
        />
      )}
    </div>
  );
}

function ToolbarBtn({ onClick, title, children }: {
  onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-white hover:text-indigo-700 transition"
    >
      {children}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────

interface RichTextViewProps {
  content: string;
  className?: string;
}

/**
 * Renderer Markdown per il contenuto scritto con RichTextArea. Supporta grassetto,
 * corsivo, liste, link, titoli, blockquote, codice inline, strikethrough.
 */
export function RichTextView({ content, className = '' }: RichTextViewProps) {
  return (
    <div className={`prose-sm text-sm text-slate-700 leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-1 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:my-0.5 [&_a]:text-indigo-600 [&_a]:underline hover:[&_a]:text-indigo-800 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_em]:italic [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-slate-900 [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-800 [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-200 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500 [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_code]:text-rose-700 [&_del]:line-through [&_del]:text-slate-400 whitespace-pre-wrap ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
