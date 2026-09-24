import { useDraggable } from '@dnd-kit/core';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fetchRemoteImage, filesFromDataTransfer, isImageDrag, remoteImageUrl } from '@/features/library/dataTransfer';
import { useElementWidth, useScrollViewport } from '@/features/library/useElementSize';
import { useLocale, useT } from '@/i18n';
import { flowInsertionPoint, type InsertionPoint } from '@/layout/hitTest';
import { EMPTY_SECTION_HEIGHT, HEADER_HEIGHT, MONTH_PREFIX, effectivePadding } from '@/layout/masonry';
import { getEngine } from '@/layout/registry';
import type { ComputedLayout, Rect } from '@/layout/types';
import {
  createItem,
  createLayoutState,
  removeItems,
  renameSection,
  type BoardItem,
  type ID,
  type MasonryParams,
} from '@/model';
import { useBoard } from '@/store/boardStore';
import { clickSuppressed, setWallHitTest, useDrag } from '@/store/dragStore';
import { useEditor } from '@/store/editorStore';
import { toast } from '@/store/toastStore';
import { PlusIcon } from '@/ui/icons';
import { uploadToBoard } from './actions';
import { Card } from './Card';
import type { DragData } from './EditorDnd';
import { faceLabel, measureItem, type Lookup } from './measure';
import { useLookup } from './useLookup';

// The board renderer (blueprint §5): it does not know which layout is active,
// it draws ComputedLayout.rects with CSS transforms. Only cards near the
// viewport are mounted, so walls with 1000+ cards scroll smoothly.

const ADD_ZONE_HEIGHT = 96;
const NATIVE_GHOST = '__drop__';

function useFontsReady(): boolean {
  const [ready, setReady] = useState(() => typeof document === 'undefined' || document.fonts.status === 'loaded');
  useEffect(() => {
    if (ready) return;
    let alive = true;
    void document.fonts.ready.then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [ready]);
  return ready;
}

function insertAt(list: BoardItem[], point: InsertionPoint, added: BoardItem[], keepSections: boolean): BoardItem[] {
  const placed = keepSections ? added : added.map((i) => ({ ...i, sectionId: point.sectionId }));
  const next = [...list];
  next.splice(Math.max(0, Math.min(point.index, next.length)), 0, ...placed);
  return next;
}

export function Wall({ onUploadRequest }: { onUploadRequest(): void }) {
  const t = useT();
  const board = useBoard((s) => s.board)!;
  const lookup = useLookup();
  const scroller = useRef<HTMLDivElement>(null);
  const width = useElementWidth(scroller);
  const viewport = useScrollViewport(scroller);
  const fontsReady = useFontsReady();
  const active = useDrag((s) => s.active);
  const target = useDrag((s) => s.target);
  const native = useDrag((s) => s.native);
  const selected = useEditor((s) => s.selected);

  const engine = getEngine(board.activeLayout);
  const state = useMemo(() => board.layouts.masonry ?? createLayoutState('masonry'), [board.layouts.masonry]);
  const params = state.params as MasonryParams;
  const gap = board.theme.gap;

  const compute = useCallback(
    (items: BoardItem[]): ComputedLayout =>
      engine.compute({
        items,
        sections: board.sections,
        measure: (item, w) => measureItem(item, w, lookup),
        params,
        state,
        viewportWidth: width,
        gap,
      }),
    [engine, board.sections, lookup, params, state, width, gap],
  );
  const ready = fontsReady && width > 0;

  const dragged = useMemo(() => new Set(active?.kind === 'items' ? active.itemIds : []), [active]);
  const baseItems = useMemo(() => (dragged.size ? board.items.filter((i) => !dragged.has(i.id)) : board.items), [board.items, dragged]);

  // What is shown: the wall with placeholders at the insertion point while dragging.
  const point = target ?? native;
  const { display, ghosts } = useMemo(() => {
    const months = params.monthDividers;
    if (point && active?.kind === 'items') {
      const moved = board.items.filter((i) => dragged.has(i.id));
      return { display: insertAt(baseItems, point, moved, months), ghosts: dragged };
    }
    if (point && active?.kind === 'assets') {
      const added = active.assetIds.map((assetId, i) => ({ ...createItem({ kind: 'image', assetId }), id: `ghost:${i}` }));
      return { display: insertAt(board.items, point, added, months), ghosts: new Set(added.map((g) => g.id)) };
    }
    if (point && native) {
      const ghost = { ...createItem({ kind: 'image', assetId: NATIVE_GHOST }), id: NATIVE_GHOST };
      return { display: insertAt(board.items, point, [ghost], months), ghosts: new Set([NATIVE_GHOST]) };
    }
    return { display: board.items, ghosts: dragged };
  }, [point, active, native, board.items, baseItems, dragged, params.monthDividers]);
  const layout = useMemo(() => (ready ? compute(display) : null), [ready, compute, display]);

  // Hit testing uses what the user sees. Over a placeholder nothing changes,
  // so the target cannot flicker while the other cards make room.
  const hitRef = useRef({ layout, display, ghosts, point });
  useLayoutEffect(() => {
    hitRef.current = { layout, display, ghosts, point };
  });
  const hitTest = useCallback((clientX: number, clientY: number): InsertionPoint | null => {
    const el = scroller.current;
    const current = hitRef.current;
    if (!el || !current.layout) return null;
    const r = el.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
    const x = clientX - r.left + el.scrollLeft;
    const y = clientY - r.top + el.scrollTop;
    if (current.point && current.ghosts.size) {
      for (const id of current.ghosts) {
        const g = current.layout.rects[id];
        if (g && x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h) return current.point;
      }
    }
    return flowInsertionPoint(current.layout, current.display, x, y, current.ghosts);
  }, []);
  useEffect(() => {
    setWallHitTest(hitTest);
    return () => setWallHitTest(null);
  }, [hitTest]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    const editor = useEditor.getState();
    if ((e.key === 'Delete' || e.key === 'Backspace') && editor.selected.size) {
      e.preventDefault();
      const ids = [...editor.selected];
      useBoard.getState().update((b) => removeItems(b, ids));
      editor.clear();
    } else if (e.key === 'Escape') {
      editor.clear();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      editor.select(board.items.map((i) => i.id));
    }
  };

  // Files or web images dropped straight onto the wall go to the library and here.
  const onNativeOver = (e: React.DragEvent) => {
    if (!isImageDrag(e.dataTransfer) || useDrag.getState().active) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    const next = hitTest(e.clientX, e.clientY);
    const current = useDrag.getState().native;
    if (next?.index !== current?.index || next?.sectionId !== current?.sectionId) useDrag.getState().set({ native: next });
  };
  const onNativeLeave = (e: React.DragEvent) => {
    if (!scroller.current?.contains(e.relatedTarget as Node | null)) useDrag.getState().set({ native: null });
  };
  const onNativeDrop = async (e: React.DragEvent) => {
    if (!isImageDrag(e.dataTransfer) || useDrag.getState().active) return;
    e.preventDefault();
    e.stopPropagation();
    const at = useDrag.getState().native ?? hitTest(e.clientX, e.clientY) ?? undefined;
    useDrag.getState().set({ native: null });
    const dt = e.dataTransfer;
    const url = dt.files.length ? null : remoteImageUrl(dt);
    const files = await filesFromDataTransfer(dt);
    if (files.length) return uploadToBoard(files, at);
    if (!url) return;
    try {
      uploadToBoard([await fetchRemoteImage(url)], at);
    } catch {
      toast(t('drop.remoteFailed'), 'error');
    }
  };

  const background = board.theme.background;
  const wallStyle =
    background.kind === 'color' ? { background: background.value } : background.kind === 'gradient' ? { background: background.value } : undefined;

  const padding = effectivePadding(params.padding, width);
  const top = viewport.top - viewport.height;
  const bottom = viewport.top + viewport.height * 2;
  const byId = useMemo(() => new Map(display.map((i) => [i.id, i])), [display]);
  const visible = layout
    ? display.filter((item) => {
        const r = layout.rects[item.id];
        return r && ((r.y + r.h >= top && r.y <= bottom) || ghosts.has(item.id));
      })
    : [];
  const empty = board.items.length === 0 && board.sections.length === 0 && !point;

  return (
    <div
      ref={scroller}
      className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto outline-none"
      style={wallStyle}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onDragOver={onNativeOver}
      onDragLeave={onNativeLeave}
      onDrop={(e) => void onNativeDrop(e)}
      data-testid="wall"
    >
      {layout && (
        <div
          role="listbox"
          aria-label={t('wall.label')}
          aria-multiselectable="true"
          className="relative"
          style={{ height: layout.height + ADD_ZONE_HEIGHT + padding }}
          onClick={(e) => e.target === e.currentTarget && useEditor.getState().clear()}
        >
          {layout.headers.map((h) => (
            <SectionHeaderView key={h.sectionId} sectionId={h.sectionId} y={h.y} x={padding} width={width - padding * 2} />
          ))}
          {layout.blocks
            ?.filter((b) => b.sectionId && !b.itemIds.length)
            .map((b) => (
              <div
                key={`empty-${b.sectionId}`}
                className="absolute flex items-center justify-center rounded-lg border border-dashed border-line text-[13px] text-faint"
                style={{ left: padding, width: width - padding * 2, top: b.top + HEADER_HEIGHT, height: EMPTY_SECTION_HEIGHT - 8 }}
              >
                {t('wall.emptySection')}
              </div>
            ))}
          {visible.map((item) => (
            <WallCard
              key={item.id}
              item={byId.get(item.id)!}
              rect={layout.rects[item.id]!}
              lookup={lookup}
              selected={selected.has(item.id)}
              placeholder={ghosts.has(item.id)}
            />
          ))}
          {!empty && (
            <button
              type="button"
              onClick={onUploadRequest}
              className="absolute flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-muted transition-colors duration-(--vb-fast) hover:border-faint hover:text-ink"
              style={{ left: padding, width: width - padding * 2, top: layout.height, height: ADD_ZONE_HEIGHT - 16 }}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <PlusIcon size={16} />
                {t('wall.addMore')}
              </span>
              <span className="text-[12px] text-faint">{t('wall.addMoreHint')}</span>
            </button>
          )}
        </div>
      )}
      {empty && <EmptyWall onUploadRequest={onUploadRequest} />}
    </div>
  );
}

function EmptyWall({ onUploadRequest }: { onUploadRequest(): void }) {
  const t = useT();
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      <p className="font-serif text-2xl italic">{t('board.empty.title')}</p>
      <p className="mt-2 max-w-sm text-muted">{t('board.empty.body')}</p>
      <div className="pointer-events-auto mt-6 flex gap-2">
        <button
          type="button"
          onClick={onUploadRequest}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink px-3.5 text-sm font-medium text-bg hover:opacity-90"
        >
          <PlusIcon size={16} />
          {t('wall.addMore')}
        </button>
        <button
          type="button"
          onClick={() => useEditor.getState().set({ libraryOpen: true })}
          className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-3.5 text-sm font-medium hover:border-faint min-[1200px]:hidden"
        >
          {t('board.openLibrary')}
        </button>
      </div>
    </div>
  );
}

const monthFormatters = new Map<string, Intl.DateTimeFormat>();
function monthLabel(locale: string, key: string): string {
  let f = monthFormatters.get(locale);
  if (!f) monthFormatters.set(locale, (f = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })));
  const label = f.format(new Date(`${key.slice(MONTH_PREFIX.length)}-01T00:00:00Z`));
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
}

function SectionHeaderView({ sectionId, x, y, width }: { sectionId: ID; x: number; y: number; width: number }) {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const section = useBoard((s) => s.board?.sections.find((sec) => sec.id === sectionId));
  const style = { transform: `translate(${x}px, ${y}px)`, width, height: HEADER_HEIGHT };
  const className = 'absolute top-0 left-0 flex items-end border-b border-line pb-2 transition-transform duration-200 ease-calm';

  if (sectionId.startsWith(MONTH_PREFIX)) {
    return (
      <div className={className} style={style} role="heading" aria-level={2}>
        <span className="font-serif text-2xl">{monthLabel(locale, sectionId)}</span>
      </div>
    );
  }
  return (
    <div className={className} style={style}>
      <input
        value={section?.title ?? ''}
        placeholder={t('wall.untitledSection')}
        aria-label={t('wall.sectionTitle')}
        onChange={(e) => useBoard.getState().update((b) => renameSection(b, sectionId, e.target.value))}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="w-full min-w-0 rounded border border-transparent bg-transparent px-1 font-serif text-2xl placeholder:text-faint hover:border-line focus:border-line"
      />
    </div>
  );
}

interface WallCardProps {
  item: BoardItem;
  rect: Rect;
  lookup: Lookup;
  selected: boolean;
  placeholder: boolean;
}

const WallCard = memo(function WallCard({ item, rect, lookup, selected, placeholder }: WallCardProps) {
  const ghost = item.id.startsWith('ghost:') || item.id === NATIVE_GHOST;
  const data: DragData = { kind: 'item', itemId: item.id };
  const { setNodeRef, listeners, attributes } = useDraggable({ id: `item:${item.id}`, data, disabled: ghost });

  const onClick = (e: React.MouseEvent) => {
    if (clickSuppressed()) return;
    const editor = useEditor.getState();
    if (e.shiftKey || e.metaKey || e.ctrlKey) editor.toggle(item.id);
    else editor.select([item.id], item.id);
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="option"
      aria-selected={selected}
      aria-label={faceLabel(item.front, lookup)}
      data-item-id={ghost ? undefined : item.id}
      data-placeholder={placeholder || undefined}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick(e as unknown as React.MouseEvent);
      }}
      className="absolute top-0 left-0 touch-manipulation select-none [-webkit-touch-callout:none] transition-[transform,width,height] duration-200 ease-calm focus-visible:outline-offset-4"
      style={{ width: rect.w, height: rect.h, transform: `translate(${rect.x}px, ${rect.y}px)` }}
    >
      <div className={`h-full w-full ${placeholder ? 'opacity-35' : ''}`}>
        <Card item={item} lookup={lookup} />
      </div>
      {placeholder && <div className="pointer-events-none absolute inset-0 rounded-lg border-2 border-dashed border-accent" />}
      {selected && !placeholder && (
        <div className="pointer-events-none absolute -inset-1 rounded-[10px] ring-2 ring-accent" />
      )}
    </div>
  );
});
