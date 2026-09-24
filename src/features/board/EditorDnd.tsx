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
import { useRef, type ReactNode } from 'react';
import { sortAssets } from '@/features/library/sortAssets';
import { useBlobUrl } from '@/images/blobUrls';
import { layoutState, moveItems, type ID } from '@/model';
import { useBoard } from '@/store/boardStore';
import { hitWall, suppressNextClick, useDrag, type DragSource } from '@/store/dragStore';
import { useEditor } from '@/store/editorStore';
import { useLibrary } from '@/store/libraryStore';
import { useLibraryView } from '@/store/libraryViewStore';
import { addAssetsToBoard } from './actions';
import { Card } from './Card';
import { useLookup } from './useLookup';

// Drag & drop in the editor (blueprint §5): library → wall inserts at the drop
// position, wall → wall reorders. The wall computes the insertion point; this
// component only tracks the pointer and commits the result.

export type DragData = { kind: 'asset'; assetId: ID } | { kind: 'item'; itemId: ID };

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

export function EditorDnd({ children }: { children: ReactNode }) {
  const start = useRef<{ x: number; y: number; touch: boolean } | null>(null);
  const lastChange = useRef(0);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch: long press to pick up, so scrolling keeps working (blueprint §8).
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: TAP_TOLERANCE } }),
  );

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (!data) return;
    const point = pointOf(event.activatorEvent);
    start.current = point ? { ...point, touch: event.activatorEvent.type.startsWith('touch') } : null;
    useDrag.getState().set({ active: sourceFor(data), target: null });
  };

  const onDragMove = (event: DragMoveEvent) => {
    if (!start.current) return;
    const target = hitWall(start.current.x + event.delta.x, start.current.y + event.delta.y);
    const current = useDrag.getState().target;
    if (target?.index === current?.index && target?.sectionId === current?.sectionId) return;
    const now = performance.now();
    if (target && current && now - lastChange.current < TARGET_HOLD_MS) return;
    lastChange.current = now;
    useDrag.getState().set({ target });
  };

  const finish = (event: DragEndEvent | null) => {
    const { active } = useDrag.getState();
    let target = useDrag.getState().target;
    if (event && start.current && target) {
      // Where the pointer really is now (the live target may be on hold).
      target = hitWall(start.current.x + event.delta.x, start.current.y + event.delta.y) ?? target;
    }
    useDrag.getState().set({ active: null, target: null });
    const origin = start.current;
    start.current = null;
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
      } else {
        useEditor.getState().select(active.itemIds);
      }
      return;
    }
    if (!target) return;

    if (active.kind === 'assets') {
      addAssetsToBoard(active.assetIds, target);
      return;
    }
    useBoard.getState().update((board) => {
      const months = layoutState(board, 'masonry').params.monthDividers;
      moveItems(board, active.itemIds, target.index, months ? null : target.sectionId);
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

function ItemPreview({ itemId }: { itemId: ID }) {
  const item = useBoard((s) => s.board?.items.find((i) => i.id === itemId));
  const lookup = useLookup();
  if (!item) return null;
  return (
    <div className="h-40 w-36">
      <Card item={item} lookup={lookup} />
    </div>
  );
}

function DragPreview() {
  const active = useDrag((s) => s.active);
  if (!active) return null;
  const ids = active.kind === 'assets' ? active.assetIds : active.itemIds;
  return (
    <div className="relative rotate-2 cursor-grabbing opacity-95 shadow-lifted" data-testid="drag-preview">
      {active.kind === 'assets' ? <AssetPreview assetId={ids[0]!} /> : <ItemPreview itemId={ids[0]!} />}
      {ids.length > 1 && (
        <span className="absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-[12px] font-semibold text-accent-ink">
          {ids.length}
        </span>
      )}
    </div>
  );
}
