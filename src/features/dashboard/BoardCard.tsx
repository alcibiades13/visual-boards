import { useState } from 'react';
import { hrefFor } from '@/app/router';
import { useFormatRelative, useT } from '@/i18n';
import { boardContent, type Board, type ImageAsset } from '@/model';
import { Menu } from '@/ui/Menu';
import { MoreIcon } from '@/ui/icons';
import { BoardCover } from './BoardCover';

interface BoardCardProps {
  board: Board;
  assets: Map<string, ImageAsset>;
  onRename(title: string): void;
  onDuplicate(): void;
  onDelete(): void;
}

export function BoardCard({ board, assets, onRename, onDuplicate, onDelete }: BoardCardProps) {
  const t = useT();
  const relative = useFormatRelative();
  const [renaming, setRenaming] = useState(false);
  const { assetIds, quoteIds } = boardContent(board);
  const meta = [
    assetIds.length ? t('library.count.images', { count: assetIds.length }) : null,
    quoteIds.length ? t('library.count.quotes', { count: quoteIds.length }) : null,
    t('dashboard.edited', { time: relative(board.updatedAt) }),
  ].filter(Boolean);

  return (
    <article className="group relative" data-testid="board-card">
      <a
        href={hrefFor({ name: 'board', boardId: board.id })}
        className="block aspect-[4/3] overflow-hidden rounded-lg border border-line transition-shadow duration-(--vb-base) group-hover:shadow-lifted"
        tabIndex={-1}
        aria-hidden="true"
      >
        <BoardCover board={board} assets={assets} />
      </a>
      <div className="flex items-start gap-2 pt-3">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              autoFocus
              defaultValue={board.title}
              aria-label={t('dashboard.titleLabel')}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={(e) => {
                setRenaming(false);
                const title = e.currentTarget.value.trim();
                if (title && title !== board.title) onRename(title);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                  e.currentTarget.value = board.title;
                  e.currentTarget.blur();
                }
              }}
              className="w-full rounded border border-line bg-surface px-1.5 font-serif text-xl"
            />
          ) : (
            <h2 className="truncate font-serif text-xl">
              <a href={hrefFor({ name: 'board', boardId: board.id })}>
                {board.title}
              </a>
            </h2>
          )}
          <p className="mt-0.5 truncate text-[13px] text-muted">{meta.join(' · ')}</p>
        </div>
        <Menu
          items={[
            { label: t('dashboard.rename'), onSelect: () => setRenaming(true) },
            { label: t('dashboard.duplicate'), onSelect: onDuplicate },
            { label: t('common.delete'), onSelect: onDelete, danger: true },
          ]}
          trigger={(props) => (
            <button
              type="button"
              aria-label={t('dashboard.menu')}
              className="relative z-10 -mr-1.5 rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
              {...props}
            >
              <MoreIcon />
            </button>
          )}
        />
      </div>
    </article>
  );
}
