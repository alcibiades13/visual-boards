// Data model — blueprint §4. Content (items, order, style) is shared by every
// layout; each layout only remembers its own arrangement in layouts[layoutId].

export type ID = string; // nanoid
export type ISODate = string;

// ---------- Fonts & frames ----------

export type FontId = 'newsreader' | 'inter';
export type FrameId = 'thin-black' | 'passe-partout' | 'wood' | 'gold'; // phase 2

// ---------- Library (shared between all boards) ----------

export interface ImageAsset {
  id: ID;
  fileName: string;
  width: number; // after resize
  height: number;
  fullBlobId: ID; // max 2400px long side, WebP/JPEG
  thumbBlobId: ID; // ~480px, for the library and walls
  hash: string; // duplicate detection on upload
  palette?: string[]; // phase 2: dominant colors (hex)
  favorite: boolean;
  tags: string[];
  createdAt: ISODate;
  ownerId?: ID; // empty in v1, filled in phase 3
}

export interface Quote {
  id: ID;
  text: string;
  author?: string;
  favorite: boolean;
  tags: string[];
  createdAt: ISODate;
  ownerId?: ID;
}

// ---------- Board ----------

export type BoardPreset = 'blank' | 'wall' | 'vision' | 'moodboard' | 'gallery';

export interface Board {
  id: ID;
  schemaVersion: number;
  title: string;
  preset: BoardPreset; // only the initial settings
  items: BoardItem[]; // order = order in flow layouts
  sections: Section[];
  activeLayout: LayoutId;
  layouts: LayoutStates;
  theme: BoardTheme;
  coverItemId?: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
  ownerId?: ID;
}

export interface Section {
  id: ID;
  title: string;
}

// ---------- Card: one component for everything ----------

export interface BoardItem {
  id: ID;
  sectionId?: ID;
  front: Face;
  back?: Face; // present => flip card
  caption?: string; // under the image (polaroid style)
  link?: string; // phase 2
  style: ItemStyle;
  addedAt: ISODate; // for "living board" month dividers
}

export interface FocalPoint {
  x: number; // 0..1
  y: number; // 0..1
}

export interface ImageFace {
  kind: 'image';
  assetId: ID;
  focal?: FocalPoint;
  overlay?: TextOverlay;
}

export interface QuoteFace {
  kind: 'quote';
  quoteId: ID;
  textStyle?: TextStyle;
}

export interface TextFace {
  kind: 'text'; // local text, not in the library
  text: string;
  textStyle?: TextStyle;
}

export type Face = ImageFace | QuoteFace | TextFace;
export type FaceKind = Face['kind'];

export type OverlayPosition = 'tl' | 'tc' | 'tr' | 'cl' | 'c' | 'cr' | 'bl' | 'bc' | 'br';
export type OverlayEffect =
  | 'shadow'
  | 'dark-gradient'
  | 'light-gradient'
  | 'panel'
  | 'blur'
  | 'outline'
  | 'none';

export type TextSource = { quoteId: ID } | { text: string };

export interface TextOverlay {
  source: TextSource;
  position: OverlayPosition;
  effect: OverlayEffect;
  intensity: number; // 0..1
  textStyle?: TextStyle;
}

export type FontWeight = 400 | 500 | 600 | 700;

export interface TextStyle {
  font: FontId;
  size: 'auto' | number; // 'auto' = fit the card
  weight: FontWeight;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  color: string;
  background?: string;
}

export type AspectRatio = 'original' | '1:1' | '4:5' | '3:4' | '3:2' | '16:9';
export type ShadowStyle = 'none' | 'soft' | 'lifted';

export interface ItemStyle {
  aspect: AspectRatio;
  radius: number;
  shadow: ShadowStyle;
  border?: { width: number; color: string };
  frame?: FrameId; // phase 2
}

// ---------- Layout state (per layout) ----------

export type LayoutId = 'masonry' | 'freeform' | 'gallery-wall' | 'polaroid' | 'photobook';
export type LayoutFamily = 'flow' | 'canvas';

export interface MasonryParams {
  columns: number | 'auto';
  minColumnWidth: number; // used when columns === 'auto'
  padding: number;
  monthDividers: boolean; // "living board": automatic sections per month of addedAt
}

export type FreeformSize = 'auto' | 'landscape' | 'a4' | 'phone' | 'square';

export interface FreeformParams {
  size: FreeformSize;
  width: number; // logical units
  height: number; // logical units; grows when size === 'auto'
}

// Phase 2 generators. Kept minimal until their milestone.
export interface GalleryWallParams {
  preset: 'grid-3x3' | 'two-large-four-small' | 'central-hero' | 'salon' | 'horizontal' | 'vertical';
  seed: number;
}
export interface PolaroidParams {
  seed: number;
  maxRotation: number; // degrees
}
export interface PhotobookParams {
  pageFormat: 'a4' | 'square' | 'letter';
  margin: number;
}

export interface LayoutParamsMap {
  masonry: MasonryParams;
  freeform: FreeformParams;
  'gallery-wall': GalleryWallParams;
  polaroid: PolaroidParams;
  photobook: PhotobookParams;
}

export type LayoutParams = LayoutParamsMap[LayoutId];

export interface Placement {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  z: number;
  locked?: boolean;
}

export interface FlowOverride {
  span?: 1 | 2 | 3; // card spans several columns
}

export interface LayoutState<P extends LayoutParams = LayoutParams> {
  params: P;
  placements: Record<ID, Placement>; // canvas layouts
  overrides: Record<ID, FlowOverride>; // flow layouts
}

// Blueprint: Partial<Record<LayoutId, LayoutState>>, narrowed so each layout's
// params are typed by its id.
export type LayoutStates = { [K in LayoutId]?: LayoutState<LayoutParamsMap[K]> };

export type BoardBackground =
  | { kind: 'color'; value: string }
  | { kind: 'gradient'; value: string }
  | { kind: 'image'; assetId: ID };

export interface BoardTheme {
  background: BoardBackground;
  gap: number;
  defaultFont: FontId;
}
