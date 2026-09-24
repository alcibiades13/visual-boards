import { useEffect } from 'react';
import { hrefFor } from '@/app/router';
import { useT } from '@/i18n';
import { useBoard } from '@/store/boardStore';
import { ArrowLeftIcon } from '@/ui/icons';

function BoardTitle() {
  const t = useT();
  const title = useBoard((s) => s.board?.title ?? '');
  const update = useBoard((s) => s.update);
  return (
    <input
      value={title}
      aria-label={t('dashboard.titleLabel')}
      onChange={(e) => update((b) => void (b.title = e.target.value))}
      onBlur={(e) => !e.target.value.trim() && update((b) => void (b.title = t('dashboard.untitled')))}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className="field-sizing-content min-w-24 max-w-full truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-serif text-lg hover:border-line focus:border-line"
    />
  );
}

export function BoardPage({ boardId }: { boardId: string }) {
  const t = useT();
  const status = useBoard((s) => s.status);

  useEffect(() => {
    void useBoard.getState().open(boardId);
    return () => void useBoard.getState().close();
  }, [boardId]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-3 py-2 sm:px-4">
        <a
          href={hrefFor({ name: 'dashboard' })}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-muted hover:text-ink"
          aria-label={t('board.back')}
        >
          <ArrowLeftIcon size={16} />
          <span className="hidden sm:inline">{t('board.back')}</span>
        </a>
        {status === 'ready' && <BoardTitle />}
      </header>

      {status === 'missing' && <p className="p-8 text-muted">{t('board.notFound')}</p>}
      {status === 'ready' && (
        <main className="flex flex-1 flex-col items-center justify-center bg-board px-6 text-center">
          <p className="font-serif text-2xl italic">{t('board.empty.title')}</p>
          <p className="mt-2 max-w-sm text-muted">{t('board.empty.body')}</p>
          <a
            href={hrefFor({ name: 'library' })}
            className="mt-6 inline-flex h-9 items-center rounded-md border border-line bg-surface px-3.5 text-sm font-medium hover:border-faint"
          >
            {t('board.openLibrary')}
          </a>
        </main>
      )}
    </div>
  );
}
