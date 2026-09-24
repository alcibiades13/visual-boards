import { useDraggable } from '@dnd-kit/core';
import { memo, useMemo, useRef, useState } from 'react';
import { addQuotesToBoard, pickRandomQuote } from '@/features/board/actions';
import type { DragData } from '@/features/board/EditorDnd';
import { useT } from '@/i18n';
import { boardContent, type Quote } from '@/model';
import { useBoard } from '@/store/boardStore';
import { clickSuppressed } from '@/store/dragStore';
import { countBoardsUsing, useLibrary } from '@/store/libraryStore';
import { useLibraryView } from '@/store/libraryViewStore';
import { toast } from '@/store/toastStore';
import { Button } from '@/ui/Button';
import { confirmDialog } from '@/ui/confirmStore';
import { EmptyState } from '@/ui/EmptyState';
import { EditIcon, SearchIcon, ShuffleIcon, StarIcon, TrashIcon } from '@/ui/icons';
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
  const chosenFilter = useLibraryView((s) => s.filter);
  const query = useLibraryView((s) => s.query);
  const set = useLibraryView((s) => s.set);
  const boardItems = useBoard((s) => s.board?.items);
  const onBoard = useMemo(() => (boardItems ? new Set(boardContent({ items: boardItems }).quoteIds) : undefined), [boardItems]);
  const filter = chosenFilter === 'unused' && !onBoard ? 'all' : chosenFilter;

  const visible = useMemo(
    () =>
      quotes
        .filter((q) => (filter === 'all' || (filter === 'favorites' ? q.favorite : !onBoard?.has(q.id))) && matches(q, query.trim()))
        .reverse(),
    [quotes, filter, query, onBoard],
  );

  const addToBoard = (ids: string[]) => {
    addQuotesToBoard(ids);
    toast(t('library.addedQuotes', { count: ids.length }));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
        <label className="relative flex min-w-[10rem] flex-1 items-center">
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
            ...(onBoard ? [['unused', t('library.filter.unused')] as ['unused', string]] : []),
            ['favorites', t('library.filter.favorites')],
          ]}
        />
      </div>
      <div className="flex items-center justify-between py-1.5 text-[13px] text-muted">
        <span className="pl-1">{t('library.count.quotes', { count: visible.length })}</span>
        {onBoard && (
          <Button
            variant="ghost"
            size="sm"
            disabled={!quotes.length}
            onClick={() => {
              const id = pickRandomQuote();
              if (id) addQuotesToBoard([id]);
            }}
          >
            <ShuffleIcon size={15} />
            {t('library.randomQuote')}
          </Button>
        )}
      </div>

      {loaded && quotes.length === 0 ? (
        <EmptyState title={t('library.empty.quotes.title')} body={t('library.empty.quotes.body')} />
      ) : loaded && visible.length === 0 ? (
        <EmptyState body={t('library.empty.filtered')} />
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pt-1 pb-6" aria-label={t('library.tab.quotes')}>
          {visible.map((quote) => (
            <QuoteCard key={quote.id} quote={quote} boardOpen={!!onBoard} onBoard={!!onBoard?.has(quote.id)} onAdd={() => addToBoard([quote.id])} />
          ))}
        </ul>
      )}
    </div>
  );
}

const QuoteCard = memo(function QuoteCard({
  quote,
  boardOpen,
  onBoard,
  onAdd,
}: {
  quote: Quote;
  boardOpen: boolean;
  onBoard: boolean;
  onAdd(): void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const pointerType = useRef('mouse');
  const data: DragData = { kind: 'quote', quoteId: quote.id };
  const { setNodeRef, listeners, attributes } = useDraggable({ id: `quote:${quote.id}`, data, disabled: !boardOpen || editing });

  const remove = async () => {
    const usage = await countBoardsUsing({ quotes: [quote.id] });
    const ok = await confirmDialog({
      title: t('confirm.deleteQuotes.title', { count: 1 }),
      body: usage.boards ? t('confirm.used', { count: usage.boards }) : t('confirm.unused'),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (ok) await useLibrary.getState().deleteQuotes([quote.id]);
  };

  if (editing) return <QuoteEditForm quote={quote} onDone={() => setEditing(false)} />;

  return (
    <li
      ref={setNodeRef}
      {...(boardOpen ? attributes : {})}
      {...(boardOpen ? listeners : {})}
      role="listitem"
      data-testid="quote-card"
      data-quote-id={quote.id}
      className={`group relative touch-manipulation rounded-lg border border-line bg-surface px-4 py-3 pr-24 select-none [-webkit-touch-callout:none] ${boardOpen ? 'cursor-grab' : ''}`}
      onPointerDown={(e) => (pointerType.current = e.pointerType)}
      onClick={() => {
        if (clickSuppressed() || !boardOpen) return;
        if (pointerType.current === 'touch') onAdd(); // phone: tap adds to the end
      }}
      onDoubleClick={() => boardOpen && pointerType.current !== 'touch' && onAdd()}
    >
      <p className="font-serif text-[15px] leading-snug whitespace-pre-line">{quote.text}</p>
      {quote.author && <p className="mt-1.5 text-[12px] tracking-wide text-muted">— {quote.author}</p>}
      {onBoard && (
        <span title={t('library.onBoard')} aria-label={t('library.onBoard')} className="absolute bottom-3 left-1.5 h-2 w-2 rounded-full bg-accent" />
      )}
      <div className="absolute top-2 right-2 flex" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label={quote.favorite ? t('library.unfavorite') : t('library.favorite')}
          aria-pressed={quote.favorite}
          onClick={(e) => {
            e.stopPropagation();
            void useLibrary.getState().setQuoteFavorite(quote.id, !quote.favorite);
          }}
          className={`rounded p-1.5 hover:text-ink ${quote.favorite ? 'text-accent' : 'text-faint'}`}
        >
          <StarIcon size={15} filled={quote.favorite} />
        </button>
        <button
          type="button"
          aria-label={t('library.editQuote')}
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          className="rounded p-1.5 text-faint hover:text-ink"
        >
          <EditIcon size={15} />
        </button>
        <button
          type="button"
          aria-label={t('common.delete')}
          onClick={(e) => {
            e.stopPropagation();
            void remove();
          }}
          className="rounded p-1.5 text-faint hover:text-danger"
        >
          <TrashIcon size={15} />
        </button>
      </div>
    </li>
  );
});

function QuoteEditForm({ quote, onDone }: { quote: Quote; onDone(): void }) {
  const t = useT();
  const [text, setText] = useState(quote.text);
  const [author, setAuthor] = useState(quote.author ?? '');
  const save = async () => {
    if (text.trim()) await useLibrary.getState().updateQuote(quote.id, { text: text.trim(), author });
    onDone();
  };
  return (
    <li className="rounded-lg border border-ink bg-surface p-3" data-testid="quote-edit">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        onKeyDown={(e) => e.key === 'Escape' && onDone()}
      >
        <textarea
          autoFocus
          value={text}
          rows={3}
          aria-label={t('inspector.quote')}
          onChange={(e) => setText(e.target.value)}
          className="w-full resize-y rounded-md border border-line bg-bg px-2 py-1.5 font-serif text-[15px] leading-snug [field-sizing:content]"
        />
        <input
          value={author}
          placeholder={t('inspector.author')}
          aria-label={t('inspector.author')}
          onChange={(e) => setAuthor(e.target.value)}
          className="w-full rounded-md border border-line bg-bg px-2 py-1.5 text-[13px]"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onDone}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="sm" type="submit">
            {t('library.saveQuote')}
          </Button>
        </div>
      </form>
    </li>
  );
}
