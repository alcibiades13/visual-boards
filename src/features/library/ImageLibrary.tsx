import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useT } from '@/i18n';
import { columnCount, packColumns } from '@/layout/columns';
import type { ImageAsset } from '@/model';
import { countBoardsUsing, useLibrary } from '@/store/libraryStore';
import { useLibraryView, type LibrarySort, type ThumbSize } from '@/store/libraryViewStore';
import { Button } from '@/ui/Button';
import { confirmDialog } from '@/ui/confirmStore';
import { ImagesIcon, StarIcon, TrashIcon } from '@/ui/icons';
import { pruneSelection, type SelectMode } from './selection';
import { sortAssets } from './sortAssets';
import { EmptyState } from '@/ui/EmptyState';
import { Segmented } from '@/ui/Segmented';
import { Thumbnail } from './Thumbnail';
import { useElementWidth, useScrollViewport } from './useElementSize';

const GAP = 8;
const MIN_COLUMN_WIDTH: Record<ThumbSize, number> = { 1: 80, 2: 110, 3: 160 };

export function ImageLibrary() {
  const t = useT();
  const assets = useLibrary((s) => s.assets);
  const loaded = useLibrary((s) => s.loaded);
  const { filter, sort, size, selection, selectionMode } = useLibraryView();
  const view = useLibraryView.getState;

  const visible = useMemo(() => sortAssets(assets, filter, sort), [assets, filter, sort]);
  const order = useMemo(() => visible.map((a) => a.id), [visible]);

  // Keep the selection in sync with what is visible (deletes, filter changes).
  useEffect(() => {
    const pruned = pruneSelection(view().selection, order);
    if (pruned !== view().selection) useLibraryView.setState({ selection: pruned });
  }, [order, view]);

  const selectedAssets = visible.filter((a) => selection.ids.has(a.id));
  const allFavorite = selectedAssets.length > 0 && selectedAssets.every((a) => a.favorite);

  const deleteSelected = useCallback(async () => {
    const ids = [...view().selection.ids];
    if (!ids.length) return;
    const usage = await countBoardsUsing({ assets: ids });
    const ok = await confirmDialog({
      title: t('confirm.deleteImages.title', { count: ids.length }),
      body: usage.boards ? t('confirm.used', { count: usage.boards }) : t('confirm.unused'),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    await useLibrary.getState().deleteAssets(ids);
    view().clearSelection();
  }, [t, view]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      view().setSelection(order);
    } else if (e.key === 'Escape') {
      view().clearSelection();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      void deleteSelected();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
        <Segmented
          label={t('library.filter')}
          value={filter}
          onChange={(filter) => view().set({ filter })}
          options={[
            ['all', t('library.filter.all')],
            ['favorites', t('library.filter.favorites')],
          ]}
        />
        <label className="flex items-center gap-1.5 text-[13px] text-muted">
          <span className="sr-only sm:not-sr-only">{t('library.sort')}</span>
          <select
            value={sort}
            onChange={(e) => view().set({ sort: e.target.value as LibrarySort })}
            className="h-8 rounded-md border border-line bg-surface px-2 text-[13px] text-ink"
          >
            <option value="newest">{t('library.sort.newest')}</option>
            <option value="oldest">{t('library.sort.oldest')}</option>
            <option value="name">{t('library.sort.name')}</option>
          </select>
        </label>
        <label className="ml-auto flex items-center gap-2 text-muted" title={t('library.size')}>
          <ImagesIcon size={14} />
          <input
            type="range"
            min={1}
            max={3}
            step={1}
            value={size}
            aria-label={t('library.size')}
            onChange={(e) => view().set({ size: Number(e.target.value) as ThumbSize })}
            className="w-20 accent-(--vb-accent)"
          />
        </label>
      </div>

      {selection.ids.size > 0 || selectionMode ? (
        <div className="flex items-center gap-1 border-y border-line py-1.5" role="toolbar">
          <span className="mr-auto pl-1 text-[13px] font-medium" data-testid="selection-count">
            {t('library.selected', { count: selection.ids.size })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!selectedAssets.length}
            onClick={() => void useLibrary.getState().setAssetsFavorite([...selection.ids], !allFavorite)}
          >
            <StarIcon size={15} filled={allFavorite} />
            <span className="hidden sm:inline">{allFavorite ? t('library.unfavorite') : t('library.favorite')}</span>
          </Button>
          <Button variant="ghost" size="sm" disabled={!selectedAssets.length} onClick={() => void deleteSelected()}>
            <TrashIcon size={15} />
            <span className="hidden sm:inline">{t('common.delete')}</span>
          </Button>
          {selection.ids.size < visible.length && (
            <Button variant="ghost" size="sm" onClick={() => view().setSelection(order)}>
              {t('library.selectAll')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => view().clearSelection()}>
            {selectionMode ? t('common.done') : t('library.clearSelection')}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between border-y border-transparent py-1.5 text-[13px] text-muted">
          <span className="pl-1">{t('library.count.images', { count: visible.length })}</span>
          <Button variant="ghost" size="sm" disabled={!visible.length} onClick={() => view().setSelection(order)}>
            {t('library.selectAll')}
          </Button>
        </div>
      )}

      {loaded && assets.length === 0 ? (
        <EmptyState title={t('library.empty.images.title')} body={t('library.empty.images.body')} />
      ) : loaded && visible.length === 0 ? (
        <EmptyState body={t('library.empty.filtered')} />
      ) : (
        <ImageGrid assets={visible} order={order} />
      )}
    </div>
  );
}

function ImageGrid({ assets, order }: { assets: ImageAsset[]; order: string[] }) {
  const t = useT();
  const scroller = useRef<HTMLDivElement>(null);
  const width = useElementWidth(scroller);
  const viewport = useScrollViewport(scroller);
  const size = useLibraryView((s) => s.size);
  const selected = useLibraryView((s) => s.selection.ids);
  const selectionMode = useLibraryView((s) => s.selectionMode);

  const byId = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const packed = useMemo(() => {
    const columns = columnCount(width, MIN_COLUMN_WIDTH[size], GAP, 2);
    return packColumns(
      assets.map((a) => ({ id: a.id, ratio: a.height / a.width })),
      { width, columns, gap: GAP },
    );
  }, [assets, width, size]);

  // Render only what intersects the viewport ± one screen (blueprint §5).
  const top = viewport.top - viewport.height;
  const bottom = viewport.top + viewport.height * 2;
  const rendered = width ? packed.rects.filter((r) => r.y + r.h >= top && r.y <= bottom) : [];

  const onSelect = useCallback(
    (id: string, mode: SelectMode) =>
      useLibraryView.getState().selectItem(order, id, mode),
    [order],
  );
  const onLongPress = useCallback(
    (id: string) => {
      const view = useLibraryView.getState();
      view.enterSelectionMode();
      if (!view.selection.ids.has(id)) view.selectItem(order, id, 'toggle');
    },
    [order],
  );
  const onToggleFavorite = useCallback(
    (asset: ImageAsset) => void useLibrary.getState().setAssetsFavorite([asset.id], !asset.favorite),
    [],
  );

  return (
    <div ref={scroller} className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto pt-2 pb-6 [scrollbar-gutter:stable]">
      <div
        role="listbox"
        aria-multiselectable="true"
        aria-label={t('library.tab.images')}
        className="relative"
        style={{ height: packed.height }}
      >
        {rendered.map((r) => {
          const asset = byId.get(r.id)!;
          return (
            <Thumbnail
              key={r.id}
              asset={asset}
              x={r.x}
              y={r.y}
              w={r.w}
              h={r.h}
              selected={selected.has(r.id)}
              selectionMode={selectionMode}
              onSelect={onSelect}
              onLongPress={onLongPress}
              onToggleFavorite={onToggleFavorite}
            />
          );
        })}
      </div>
    </div>
  );
}
