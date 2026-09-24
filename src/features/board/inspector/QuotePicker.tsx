import { useMemo, useState } from 'react';
import { useT } from '@/i18n';
import type { ID } from '@/model';
import { useLibrary } from '@/store/libraryStore';
import { inputClass } from './fields';

/** Searchable list of library quotes; picking one calls onPick. */
export function QuotePicker({ onPick, onCancel }: { onPick(quoteId: ID): void; onCancel(): void }) {
  const t = useT();
  const quotes = useLibrary((s) => s.quotes);
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const list = [...quotes].reverse();
    return q ? list.filter((x) => x.text.toLocaleLowerCase().includes(q) || x.author?.toLocaleLowerCase().includes(q)) : list;
  }, [quotes, query]);

  if (!quotes.length) return <p className="text-[12px] text-faint">{t('inspector.noQuotes')}</p>;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-2" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <input
        autoFocus
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('inspector.searchQuotes')}
        aria-label={t('inspector.searchQuotes')}
        className={inputClass}
      />
      <ul className="max-h-60 overflow-y-auto" aria-label={t('inspector.pickQuote')}>
        {visible.map((quote) => (
          <li key={quote.id}>
            <button
              type="button"
              onClick={() => onPick(quote.id)}
              className="w-full rounded-md px-2 py-1.5 text-left font-serif text-[13px] leading-snug hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
            >
              <span className="line-clamp-2">{quote.text}</span>
              {quote.author && <span className="block font-sans text-[11px] text-muted">— {quote.author}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
