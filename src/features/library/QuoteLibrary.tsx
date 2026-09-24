import { useMemo } from 'react';
import { useT } from '@/i18n';
import type { Quote } from '@/model';
import { countBoardsUsing, useLibrary } from '@/store/libraryStore';
import { useLibraryView } from '@/store/libraryViewStore';
import { confirmDialog } from '@/ui/confirmStore';
import { SearchIcon, StarIcon, TrashIcon } from '@/ui/icons';
import { EmptyState } from '@/ui/EmptyState';
import { Segmented } from '@/ui/Segmented';

function matches(quote: Quote, query: string): boolean {
  if (!query) return true;
  const q = query.toLocaleLowerCase();
  return quote.text.toLocaleLowerCase().includes(q) || !!quote.author?.toLocaleLowerCase().includes(q);
}

export function QuoteLibrary() {
  const t = useT();
  const quotes = useLibrary((s) => s.quotes);
  const loaded = useLibrary((s) => s.loaded);
  const filter = useLibraryView((s) => s.filter);
  const query = useLibraryView((s) => s.query);
  const set = useLibraryView((s) => s.set);

  const visible = useMemo(
    () => quotes.filter((q) => (filter === 'all' || q.favorite) && matches(q, query.trim())).reverse(),
    [quotes, filter, query],
  );

  const remove = async (quote: Quote) => {
    const usage = await countBoardsUsing({ quotes: [quote.id] });
    const ok = await confirmDialog({
      title: t('confirm.deleteQuotes.title', { count: 1 }),
      body: usage.boards ? t('confirm.used', { count: usage.boards }) : t('confirm.unused'),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (ok) await useLibrary.getState().deleteQuotes([quote.id]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
        <label className="relative flex min-w-[12rem] flex-1 items-center">
          <SearchIcon size={15} className="pointer-events-none absolute left-2.5 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder={t('library.search')}
            aria-label={t('library.search')}
            className="h-8 w-full rounded-md border border-line bg-surface pr-2 pl-8 text-[13px] placeholder:text-faint"
          />
        </label>
        <Segmented
          label={t('library.filter')}
          value={filter}
          onChange={(filter) => set({ filter })}
          options={[
            ['all', t('library.filter.all')],
            ['favorites', t('library.filter.favorites')],
          ]}
        />
      </div>
      <p className="py-1.5 pl-1 text-[13px] text-muted">{t('library.count.quotes', { count: visible.length })}</p>

      {loaded && quotes.length === 0 ? (
        <EmptyState title={t('library.empty.quotes.title')} body={t('library.empty.quotes.body')} />
      ) : loaded && visible.length === 0 ? (
        <EmptyState body={t('library.empty.filtered')} />
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pt-1 pb-6" aria-label={t('library.tab.quotes')}>
          {visible.map((quote) => (
            <li
              key={quote.id}
              className="group relative rounded-lg border border-line bg-surface px-4 py-3 pr-20"
              data-testid="quote-card"
            >
              <p className="font-serif text-[15px] leading-snug whitespace-pre-line">{quote.text}</p>
              {quote.author && <p className="mt-1.5 text-[12px] tracking-wide text-muted">— {quote.author}</p>}
              <div className="absolute top-2 right-2 flex">
                <button
                  type="button"
                  aria-label={quote.favorite ? t('library.unfavorite') : t('library.favorite')}
                  aria-pressed={quote.favorite}
                  onClick={() => void useLibrary.getState().setQuoteFavorite(quote.id, !quote.favorite)}
                  className={`rounded p-1.5 hover:text-ink ${quote.favorite ? 'text-accent' : 'text-faint'}`}
                >
                  <StarIcon size={15} filled={quote.favorite} />
                </button>
                <button
                  type="button"
                  aria-label={t('common.delete')}
                  onClick={() => void remove(quote)}
                  className="rounded p-1.5 text-faint hover:text-danger"
                >
                  <TrashIcon size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
