import type { BoardItem, ID, LayoutFamily, LayoutId, LayoutParams, LayoutState, Section } from '@/model';

// Shared layout interface (blueprint §5). Every layout is a pure function from
// content + its own state to rectangles; the renderer only draws rects.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  z: number;
}

export interface ComputeInput<P extends LayoutParams> {
  items: BoardItem[];
  sections: Section[];
  /** Card height at a given width (images: from the aspect ratio; text: measured once and cached). */
  measure(item: BoardItem, width: number): number;
  params: P;
  state: LayoutState<P>;
  viewportWidth: number;
  gap: number;
}

export interface SectionHeader {
  /** A board section id, or `month:YYYY-MM` for automatic month dividers. */
  sectionId: ID;
  y: number;
  h: number;
}

/** A vertical band of a flow layout: one section (or the unsectioned start). */
export interface FlowBlock {
  sectionId?: ID;
  top: number; // including the header
  bottom: number;
  itemIds: ID[];
}

export interface ComputedLayout {
  rects: Record<ID, Rect>;
  headers: SectionHeader[];
  width: number;
  height: number; // walls grow with their content
  blocks?: FlowBlock[]; // flow layouts only, for hit testing
}

export interface LayoutEngine<P extends LayoutParams = LayoutParams> {
  id: LayoutId;
  family: LayoutFamily;
  defaultParams: P;
  compute(input: ComputeInput<P>): ComputedLayout;
}
