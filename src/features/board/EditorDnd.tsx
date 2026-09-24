import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import type { ReactNode } from 'react';
import { sortAssets } from '@/features/library/sortAssets';
import { useBlobUrl } from '@/images/blobUrls';
import { layoutState, moveItems, type ID } from '@/model';
import { useBoard } from '@/store/boardStore';
import { hitWall, suppressNextClick, useDrag, type DragSource, type WallHit } from '@/store/dragStore';
import { useEditor } from '@/store/editorStore';
import { useLibrary } from '@/store/libraryStore';
import { useLibraryView } from '@/store/libraryViewStore';
import { addAssetsToBoard, addQuotesToBoard } from './actions';
import { Card } from './Card';
import { measureItem } from './measure';
import { useLookup } from './useLookup';

// Drag & drop in the editor (blueprint §5, §6): library → wall inserts at the
// drop position, wall → wall reorders, and a quote dropped onto an image asks
// whether it goes over the image or on its back. The wall computes targets;
// this component tracks the pointer and commits the result.

export type DragData = { kind: 'asset'; assetId: ID } | { kind: 'quote'; quoteId: ID } | { kind: 'item'; itemId: ID };

const TAP_TOLERANCE = 8;
/** After the target changes, hold it briefly so reflowing cards cannot make it oscillate. */
const TARGET_HOLD_MS = 120;

function pointOf(event: Event | null): { x: number; y: number } | null {
  if (!event) return null;
  if ('touches' in event) {
    const touch = (event as TouchEvent).touches[0] ?? (event as TouchEvent).changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  if ('clientX' in event) return { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
  return null;
}

function sourceFor(data: DragData): DragSource {
  if (data.kind === 'quote') return { kind: 'quotes', quoteIds: [data.quoteId] };
  if (data.kind === 'asset') {
    const view = useLibraryView.getState();
    if (view.selection.ids.has(data.assetId) && view.selection.ids.size > 1) {
      // The whole selection, in the order the library shows it.
      const ordered = sortAssets(useLibrary.getState().assets, 'all', view.sort)
        .map((a) => a.id)
        .filter((id) => view.selection.ids.has(id));
      return { kind: 'assets', assetIds: ordered };
    }
    return { kind: 'assets', assetIds: [data.assetId] };
  }
  const selected = useEditor.getState().selected;
  if (selected.has(data.itemId) && selected.size > 1) {
    const items = useBoard.getState().board?.items ?? [];
    return { kind: 'items', itemIds: items.filter((i) => selected.has(i.id)).map((i) => i.id) };
  }
  return { kind: 'items', itemIds: [data.itemId] };
}

function sameHit(hit: WallHit | null, state: { target: { index: number; sectionId?: string } | null; onto: ID | null }): boolean {
  if (!hit) return !state.target && !state.onto;
  if (hit.kind === 'onto') return state.onto === hit.itemId;
  if (state.onto) return false;
  return !state.onto && state.target?.index === hit.point.index && state.target?.sectionId === hit.point.sectionId;
}

function apply(hit: WallHit | null) {
  // Onto an image: keep the current placeholder where it is. Removing it would
  // reflow the wall, move the image away from the pointer and make the target flicker.
  useDrag.getState().set(
    hit?.kind === 'onto' ? { onto: hit.itemId } : { onto: null, target: hit?.kind === 'insert' ? hit.point : null },
  );
}

// Pointer tracking for the one active drag (module state: handlers only, never render).
const drag = {
  start: null as { x: number; y: number; touch: boolean } | null,
  delta: { x: 0, y: 0 },
  lastChange: 0,
  recheck: undefined as ReturnType<typeof setTimeout> | undefined,
};

function hitAt(delta: { x: number; y: number }): WallHit | null {
  if (!drag.start) return null;
  const quote = useDrag.getState().active?.kind === 'quotes';
  return hitWall(drag.start.x + delta.x, drag.start.y + delta.y, quote);
}

function track(): void {
  clearTimeout(drag.recheck);
  if (!useDrag.getState().active) return;
  const hit = hitAt(drag.delta);
  const state = useDrag.getState();
  if (sameHit(hit, state)) return;
  const held = performance.now() - drag.lastChange;
  if (hit && (state.target || state.onto) && held < TARGET_HOLD_MS) {
    // Look again once the hold is over, even if the pointer stops moving.
    drag.recheck = setTimeout(track, TARGET_HOLD_MS - held + 10);
    return;
  }
  drag.lastChange = performance.now();
  apply(hit);
}

export function EditorDnd({ children }: { children: ReactNode }) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch: long press to pick up, so scrolling keeps working (blueprint §8).
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: TAP_TOLERANCE } }),
  );

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (!data) return;
    const point = pointOf(event.activatorEvent);
    drag.start = point ? { ...point, touch: event.activatorEvent.type.startsWith('touch') } : null;
    drag.delta = { x: 0, y: 0 };
    useDrag.getState().set({ active: sourceFor(data), target: null, onto: null });
  };

  const onDragMove = (event: DragMoveEvent) => {
    drag.delta = event.delta;
    track();
  };

  const finish = (event: DragEndEvent | null) => {
    clearTimeout(drag.recheck);
    const { active, target, onto } = useDrag.getState();
    const held: WallHit | null = onto ? { kind: 'onto', itemId: onto } : target ? { kind: 'insert', point: target } : null;
    // Where the pointer really is now (the live target may be on hold).
    const final = event ? (hitAt(event.delta) ?? held) : null;
    useDrag.getState().set({ active: null, target: null, onto: null });
    const origin = drag.start;
    drag.start = null;
    if (!active || !event) return;

    const moved = Math.hypot(event.delta.x, event.delta.y) > TAP_TOLERANCE;
    suppressNextClick(); // the browser may fire a click where the drag ended
    if (!moved && origin?.touch) {
      // A long press without movement: select instead (library) or just select the card (wall).
      if (active.kind === 'assets') {
        const view = useLibraryView.getState();
        view.enterSelectionMode();
        const id = active.assetIds[0]!;
        if (!view.selection.ids.has(id)) view.selectItem([], id, 'toggle');
      } else if (active.kind === 'items') {
        useEditor.getState().select(active.itemIds);
      }
      return;
    }
    if (!final) return;

    if (final.kind === 'onto') {
      if (active.kind === 'quotes') useEditor.getState().setQuoteDrop({ itemId: final.itemId, quoteId: active.quoteIds[0]! });
      return;
    }
    const at = final.point;
    if (active.kind === 'assets') return addAssetsToBoard(active.assetIds, at);
    if (active.kind === 'quotes') return addQuotesToBoard(active.quoteIds, at);
    useBoard.getState().update((board) => {
      const months = layoutState(board, 'masonry').params.monthDividers;
      moveItems(board, active.itemIds, at.index, months ? null : at.sectionId);
    });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={finish}
      onDragCancel={() => finish(null)}
      autoScroll={{ threshold: { x: 0, y: 0.15 }, acceleration: 12 }}
    >
      {children}
      <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
        <DragPreview />
      </DragOverlay>
    </DndContext>
  );
}

function AssetPreview({ assetId }: { assetId: ID }) {
  const asset = useLibrary((s) => s.assets.find((a) => a.id === assetId));
  const url = useBlobUrl(asset?.thumbBlobId);
  const ratio = asset ? asset.height / asset.width : 1;
  return (
    <div className="w-36 overflow-hidden rounded-md bg-surface-2" style={{ height: 144 * ratio }}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
    </div>
  );
}

function QuotePreview({ quoteId }: { quoteId: ID }) {
  const quote = useLibrary((s) => s.quotes.find((q) => q.id === quoteId));
  return (
    <div className="w-56 rounded-md bg-surface p-4 font-serif text-[15px] leading-snug">
      <p className="line-clamp-4">{quote?.text}</p>
      {quote?.author && <p className="mt-2 font-sans text-[11px] text-muted">— {quote.author}</p>}
    </div>
  );
}

function ItemPreview({ itemId }: { itemId: ID }) {
  const item = useBoard((s) => s.board?.items.find((i) => i.id === itemId));
  const lookup = useLookup();
  if (!item) return null;
  const height = Math.min(220, measureItem(item, 144, lookup));
  return (
    <div className="w-36" style={{ height }}>
      <Card item={item} lookup={lookup} width={144} height={height} />
    </div>
  );
}

function DragPreview() {
  const active = useDrag((s) => s.active);
  if (!active) return null;
  const ids = active.kind === 'assets' ? active.assetIds : active.kind === 'quotes' ? active.quoteIds : active.itemIds;
  return (
    <div className="relative rotate-2 cursor-grabbing opacity-95 shadow-lifted" data-testid="drag-preview">
      {active.kind === 'assets' ? (
        <AssetPreview assetId={ids[0]!} />
      ) : active.kind === 'quotes' ? (
        <QuotePreview quoteId={ids[0]!} />
      ) : (
        <ItemPreview itemId={ids[0]!} />
      )}
      {ids.length > 1 && (
        <span className="absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-[12px] font-semibold text-accent-ink">
          {ids.length}
        </span>
      )}
    </div>
  );
}
