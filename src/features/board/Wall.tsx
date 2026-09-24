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
  setBack,
  setOverlay,
  type BoardBackground,
  type BoardItem,
  type ID,
  type MasonryParams,
} from '@/model';
import { useBoard } from '@/store/boardStore';
import { clickSuppressed, setWallHitTest, useDrag, type WallHit } from '@/store/dragStore';
import { useEditor, type EditorMode } from '@/store/editorStore';
import { toast } from '@/store/toastStore';
import { FlipIcon, PlusIcon } from '@/ui/icons';
import { addQuotesToBoard, uploadToBoard } from './actions';
import { Card } from './Card';
import type { DragData } from './EditorDnd';
import { faceLabel, measureItem, type Lookup } from './measure';
import { DEFAULT_OVERLAY } from './overlayStyle';
import { useLookup } from './useLookup';
import { wallInkVars } from './wallBackground';
import { useBlobUrl } from '@/images/blobUrls';
import { useLibrary } from '@/store/libraryStore';

// The board renderer (blueprint §5): it does not know which layout is active,
// it draws ComputedLayout.rects with CSS transforms. Only cards near the
// viewport are mounted, so walls with 1000+ cards scroll smoothly.

const ADD_ZONE_HEIGHT = 96;
const NATIVE_GHOST = '__drop__';
/** While dragging a quote, a pointer this close to a card counts as "between cards": nothing changes. */
const GAP_HOLD = 24;

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
  const onto = useDrag((s) => s.onto);
  const native = useDrag((s) => s.native);
  const selected = useEditor((s) => s.selected);
  const flipped = useEditor((s) => s.flipped);
  const mode = useEditor((s) => s.mode);

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
    if (point && active?.kind === 'quotes') {
      const added = active.quoteIds.map((quoteId, i) => ({ ...createItem({ kind: 'quote', quoteId }), id: `ghost:${i}` }));
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
  const hitRef = useRef({ layout, display, ghosts, point, onto });
  useLayoutEffect(() => {
    hitRef.current = { layout, display, ghosts, point, onto };
  });
  const toWall = useCallback((clientX: number, clientY: number) => {
    const el = scroller.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
    return { x: clientX - r.left + el.scrollLeft, y: clientY - r.top + el.scrollTop };
  }, []);
  const hitTest = useCallback(
    (clientX: number, clientY: number, allowOnto: boolean): WallHit | null => {
      const current = hitRef.current;
      const p = toWall(clientX, clientY);
      if (!p || !current.layout) return null;
      const inside = (r: Rect, share = 1) => {
        const mx = (r.w * (1 - share)) / 2;
        const my = (r.h * (1 - share)) / 2;
        return p.x >= r.x + mx && p.x <= r.x + r.w - mx && p.y >= r.y + my && p.y <= r.y + r.h - my;
      };
      if (allowOnto) {
        // Quotes: anywhere on an image means onto it. In the gaps between cards
        // nothing changes, so the wall does not reshuffle under the pointer.
        let nearest = Infinity;
        let overCard = false;
        for (const item of current.display) {
          const r = current.layout.rects[item.id];
          if (!r || current.ghosts.has(item.id)) continue;
          if (inside(r)) {
            if (item.front.kind === 'image') return { kind: 'onto', itemId: item.id };
            overCard = true;
          }
          const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
          const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
          nearest = Math.min(nearest, Math.hypot(dx, dy));
        }
        if (!overCard && nearest <= GAP_HOLD) {
          if (current.onto) return { kind: 'onto', itemId: current.onto };
          if (current.point) return { kind: 'insert', point: current.point };
        }
      }
      if (current.point) {
        for (const id of current.ghosts) {
          const g = current.layout.rects[id];
          if (g && inside(g)) return { kind: 'insert', point: current.point };
        }
      }
      return { kind: 'insert', point: flowInsertionPoint(current.layout, current.display, p.x, p.y, current.ghosts) };
    },
    [toWall],
  );
  useEffect(() => {
    setWallHitTest(hitTest);
    return () => setWallHitTest(null);
  }, [hitTest]);
  const insertionAt = (clientX: number, clientY: number): InsertionPoint | null => {
    const hit = hitTest(clientX, clientY, false);
    return hit?.kind === 'insert' ? hit.point : null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || mode === 'view') return;
    const editor = useEditor.getState();
    if ((e.key === 'Delete' || e.key === 'Backspace') && editor.selected.size) {
      e.preventDefault();
      const ids = [...editor.selected];
      useBoard.getState().update((b) => removeItems(b, ids));
      editor.clear();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      editor.select(board.items.map((i) => i.id));
    } else if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && editor.selected.size) {
      for (const item of board.items) if (editor.selected.has(item.id) && item.back) editor.flip(item.id);
    }
  };

  // Files or web images dropped straight onto the wall go to the library and here.
  const onNativeOver = (e: React.DragEvent) => {
    if (!isImageDrag(e.dataTransfer) || useDrag.getState().active || mode === 'view') return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    const next = insertionAt(e.clientX, e.clientY);
    const current = useDrag.getState().native;
    if (next?.index !== current?.index || next?.sectionId !== current?.sectionId) useDrag.getState().set({ native: next });
  };
  const onNativeLeave = (e: React.DragEvent) => {
    if (!scroller.current?.contains(e.relatedTarget as Node | null)) useDrag.getState().set({ native: null });
  };
  const onNativeDrop = async (e: React.DragEvent) => {
    if (!isImageDrag(e.dataTransfer) || useDrag.getState().active || mode === 'view') return;
    e.preventDefault();
    e.stopPropagation();
    const at = useDrag.getState().native ?? insertionAt(e.clientX, e.clientY) ?? undefined;
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
  const editing = mode === 'edit';
  const empty = board.items.length === 0 && board.sections.length === 0 && !point;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" style={wallInkVars(background)}>
      <WallBackground background={background} />
      <div
        ref={scroller}
        className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto outline-none"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onDragOver={onNativeOver}
        onDragLeave={onNativeLeave}
        onDrop={(e) => void onNativeDrop(e)}
        data-testid="wall"
        data-mode={mode}
        data-drop-onto={onto ?? undefined}
        data-drop-index={point?.index}
      >
        {layout && (
          <div
            className="relative"
            style={{ height: layout.height + (editing ? ADD_ZONE_HEIGHT : 0) + padding }}
            onClick={(e) => e.target === e.currentTarget && useEditor.getState().clear()}
          >
            {/* Only cards live in the listbox; headers, drop areas and buttons are its siblings. */}
            <div
              role={editing ? 'listbox' : 'list'}
              aria-label={t('wall.label')}
              aria-multiselectable={editing || undefined}
              className="absolute inset-0"
              onClick={(e) => e.target === e.currentTarget && useEditor.getState().clear()}
            >
              {visible.map((item) => (
                <WallCard
                  key={item.id}
                  item={byId.get(item.id)!}
                  rect={layout.rects[item.id]!}
                  lookup={lookup}
                  mode={mode}
                  selected={selected.has(item.id)}
                  flipped={flipped.has(item.id)}
                  placeholder={ghosts.has(item.id)}
                  dropOnto={onto === item.id}
                />
              ))}
            </div>
            {layout.headers.map((h) => (
              <SectionHeaderView
                key={h.sectionId}
                sectionId={h.sectionId}
                y={h.y}
                x={padding}
                width={width - padding * 2}
                editable={editing}
              />
            ))}
            {editing &&
              layout.blocks
                ?.filter((b) => b.sectionId && !b.itemIds.length)
                .map((b) => (
                  <div
                    key={`empty-${b.sectionId}`}
                    className="pointer-events-none absolute flex items-center justify-center rounded-lg border border-dashed border-wall-line text-[13px] text-wall-muted"
                    style={{ left: padding, width: width - padding * 2, top: b.top + HEADER_HEIGHT, height: EMPTY_SECTION_HEIGHT - 8 }}
                  >
                    {t('wall.emptySection')}
                  </div>
                ))}
            <QuoteDropChooser layout={layout} />
            {editing && !empty && (
              <button
                type="button"
                onClick={onUploadRequest}
                className="absolute flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-wall-line text-wall-muted transition-colors duration-(--vb-fast) hover:border-wall-muted hover:text-wall-ink"
                style={{ left: padding, width: width - padding * 2, top: layout.height, height: ADD_ZONE_HEIGHT - 16 }}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <PlusIcon size={16} />
                  {t('wall.addMore')}
                </span>
                <span className="text-[12px] opacity-75">{t('wall.addMoreHint')}</span>
              </button>
            )}
          </div>
        )}
        {empty && editing && <EmptyWall onUploadRequest={onUploadRequest} />}
      </div>
    </div>
  );
}

/**
 * The board background, fixed behind the scrolling wall: a long wall scrolls
 * over it instead of stretching one image across thousands of pixels.
 */
function WallBackground({ background }: { background: BoardBackground }) {
  const asset = useLibrary((s) => (background.kind === 'image' ? s.assets.find((a) => a.id === background.assetId) : undefined));
  const url = useBlobUrl(asset?.fullBlobId);
  if (background.kind !== 'image') {
    return <div className="pointer-events-none absolute inset-0" style={{ background: background.value }} data-testid="wall-background" />;
  }
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-board" data-testid="wall-background">
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-bg" style={{ opacity: background.dim ?? 0 }} />
    </div>
  );
}

function EmptyWall({ onUploadRequest }: { onUploadRequest(): void }) {
  const t = useT();
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      <p className="font-serif text-2xl text-wall-ink italic">{t('board.empty.title')}</p>
      <p className="mt-2 max-w-sm text-wall-muted">{t('board.empty.body')}</p>
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

/**
 * Activates on pointer up as well as on keyboard clicks: right after a drop,
 * dnd-kit swallows the next click for a moment, which could eat a quick choice.
 */
function choose(action: () => void) {
  return {
    onPointerUp: (e: React.PointerEvent) => e.button === 0 && action(),
    onClick: (e: React.MouseEvent) => e.detail === 0 && action(), // keyboard (Enter/Space)
  };
}

/** "Over the image" or "On the back" after a quote was dropped onto an image (blueprint §6). */
function QuoteDropChooser({ layout }: { layout: ComputedLayout }) {
  const t = useT();
  const choice = useEditor((s) => s.quoteDrop);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!choice) return;
    panel.current?.querySelector('button')?.focus();
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !panel.current?.contains(e.target as Node)) {
        useEditor.getState().setQuoteDrop(null);
      }
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [choice]);
  if (!choice) return null;
  const rect = layout.rects[choice.itemId];
  if (!rect) return null;

  const place = (where: 'over' | 'back' | 'card') => {
    const { itemId, quoteId } = choice;
    if (where === 'card') {
      const index = useBoard.getState().board?.items.findIndex((i) => i.id === itemId) ?? -1;
      const sectionId = useBoard.getState().board?.items[index]?.sectionId;
      addQuotesToBoard([quoteId], { index: index + 1, sectionId });
      useEditor.getState().setQuoteDrop(null);
      return;
    }
    useBoard.getState().update((b) => {
      if (where === 'over') setOverlay(b, itemId, { source: { quoteId }, ...DEFAULT_OVERLAY });
      else setBack(b, itemId, { kind: 'quote', quoteId });
    });
    useEditor.getState().setQuoteDrop(null);
    useEditor.getState().select([itemId], itemId);
  };

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label={t('quoteDrop.title')}
      className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-1 rounded-lg border border-line bg-surface p-1.5 shadow-lifted"
      style={{ left: rect.x + rect.w / 2, top: rect.y + Math.min(rect.h / 2, 160) }}
    >
      <button type="button" {...choose(() => place('over'))} className="rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2 focus:bg-surface-2 focus:outline-none">
        {t('quoteDrop.over')}
      </button>
      <button type="button" {...choose(() => place('back'))} className="rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2 focus:bg-surface-2 focus:outline-none">
        {t('quoteDrop.back')}
      </button>
      <button type="button" {...choose(() => place('card'))} className="rounded-md px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-ink focus:bg-surface-2 focus:outline-none">
        {t('quoteDrop.card')}
      </button>
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

function SectionHeaderView({ sectionId, x, y, width, editable }: { sectionId: ID; x: number; y: number; width: number; editable: boolean }) {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const section = useBoard((s) => s.board?.sections.find((sec) => sec.id === sectionId));
  const style = { transform: `translate(${x}px, ${y}px)`, width, height: HEADER_HEIGHT };
  const className = 'absolute top-0 left-0 flex items-end border-b border-wall-line pb-2 text-wall-ink transition-transform duration-200 ease-calm';

  if (sectionId.startsWith(MONTH_PREFIX) || !editable) {
    const title = sectionId.startsWith(MONTH_PREFIX) ? monthLabel(locale, sectionId) : section?.title || t('wall.untitledSection');
    return (
      <div className={className} style={style} role="heading" aria-level={2}>
        <span className="px-1 font-serif text-2xl">{title}</span>
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
        className="w-full min-w-0 rounded border border-transparent bg-transparent px-1 font-serif text-2xl text-wall-ink placeholder:text-wall-muted hover:border-wall-line focus:border-wall-line"
      />
    </div>
  );
}

interface WallCardProps {
  item: BoardItem;
  rect: Rect;
  lookup: Lookup;
  mode: EditorMode;
  selected: boolean;
  flipped: boolean;
  placeholder: boolean;
  dropOnto: boolean;
}

const WallCard = memo(function WallCard({ item, rect, lookup, mode, selected, flipped, placeholder, dropOnto }: WallCardProps) {
  const t = useT();
  const ghost = item.id.startsWith('ghost:') || item.id === NATIVE_GHOST;
  const editing = mode === 'edit';
  const data: DragData = { kind: 'item', itemId: item.id };
  const { setNodeRef, listeners, attributes } = useDraggable({ id: `item:${item.id}`, data, disabled: ghost || !editing });
  const canFlip = !!item.back;
  const flip = () => useEditor.getState().flip(item.id);

  const onClick = (e: React.MouseEvent) => {
    if (clickSuppressed()) return;
    if (!editing) {
      if (canFlip) flip();
      return;
    }
    const editor = useEditor.getState();
    if (e.shiftKey || e.metaKey || e.ctrlKey) editor.toggle(item.id);
    else editor.select([item.id], item.id);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === ' ' && canFlip) {
      e.preventDefault();
      flip();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (editing) useEditor.getState().select([item.id], item.id);
      else if (canFlip) flip();
    }
  };

  const front = faceLabel(item.front, lookup);
  const label = canFlip ? `${front}. ${t('card.backSide')}: ${faceLabel(item.back!, lookup)}` : front;

  return (
    <div
      ref={setNodeRef}
      {...(editing ? attributes : {})}
      {...(editing ? listeners : {})}
      role={editing ? 'option' : canFlip ? 'button' : 'listitem'}
      aria-selected={editing ? selected : undefined}
      aria-pressed={!editing && canFlip ? flipped : undefined}
      aria-label={label}
      data-item-id={ghost ? undefined : item.id}
      data-placeholder={placeholder || undefined}
      data-flipped={(canFlip && flipped) || undefined}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`group absolute top-0 left-0 touch-manipulation select-none [-webkit-touch-callout:none] transition-[transform,width,height] duration-200 ease-calm focus-visible:outline-offset-4 ${
        !editing && canFlip ? 'cursor-pointer' : ''
      }`}
      style={{ width: rect.w, height: rect.h, transform: `translate(${rect.x}px, ${rect.y}px)` }}
    >
      <div className={`h-full w-full ${placeholder ? 'opacity-35' : ''}`}>
        <Card item={item} lookup={lookup} width={rect.w} height={rect.h} flipped={flipped} />
      </div>
      {placeholder && <div className="pointer-events-none absolute inset-0 rounded-lg border-2 border-dashed border-accent" />}
      {dropOnto && (
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center rounded-lg bg-accent/15 pt-3 ring-2 ring-accent">
          <span className="rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-accent-ink">{t('wall.dropOnImage')}</span>
        </div>
      )}
      {selected && !placeholder && editing && <div className="pointer-events-none absolute -inset-1 rounded-[10px] ring-2 ring-accent" />}
      {editing && canFlip && !placeholder && (
        <button
          type="button"
          aria-label={t('card.flip')}
          aria-pressed={flipped}
          onClick={(e) => {
            e.stopPropagation();
            flip();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-surface/85 text-ink shadow-soft backdrop-blur transition-opacity duration-(--vb-fast) hover:bg-surface"
        >
          <FlipIcon size={16} />
        </button>
      )}
    </div>
  );
});
