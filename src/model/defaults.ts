import { nanoid } from 'nanoid';
import type {
  Board,
  BoardItem,
  BoardPreset,
  BoardTheme,
  Face,
  FreeformParams,
  ID,
  ImageAsset,
  ItemStyle,
  LayoutId,
  LayoutParamsMap,
  LayoutState,
  MasonryParams,
  Quote,
  Section,
  TextStyle,
} from './types';

export const SCHEMA_VERSION = 1;

export const newId = (): ID => nanoid();
export const nowIso = (): string => new Date().toISOString();

// Theme-aware defaults are CSS variables so boards follow light/dark mode
// until the user picks an explicit color.
export const THEME_BOARD_BACKGROUND = 'var(--vb-board)';
export const THEME_TEXT_COLOR = 'var(--vb-ink)';

export const DEFAULT_MASONRY_PARAMS: MasonryParams = {
  columns: 'auto',
  minColumnWidth: 240,
  padding: 24,
  monthDividers: false,
};

export const FREEFORM_SIZES = {
  landscape: { width: 1920, height: 1080 },
  a4: { width: 1240, height: 1754 },
  phone: { width: 1080, height: 2340 },
  square: { width: 1600, height: 1600 },
  auto: { width: 1920, height: 1080 },
} as const;

export const DEFAULT_FREEFORM_PARAMS: FreeformParams = {
  size: 'auto',
  ...FREEFORM_SIZES.auto,
};

export const DEFAULT_LAYOUT_PARAMS: LayoutParamsMap = {
  masonry: DEFAULT_MASONRY_PARAMS,
  freeform: DEFAULT_FREEFORM_PARAMS,
  'gallery-wall': { preset: 'grid-3x3', seed: 1 },
  polaroid: { seed: 1, maxRotation: 6 },
  photobook: { pageFormat: 'a4', margin: 48 },
};

export function createLayoutState<K extends LayoutId>(id: K): LayoutState<LayoutParamsMap[K]> {
  return { params: structuredClone(DEFAULT_LAYOUT_PARAMS[id]), placements: {}, overrides: {} };
}

export const DEFAULT_ITEM_STYLE: ItemStyle = {
  aspect: 'original',
  radius: 6,
  shadow: 'soft',
};

export const DEFAULT_TEXT_STYLE: TextStyle = {
  font: 'newsreader',
  size: 'auto',
  weight: 400,
  italic: false,
  align: 'center',
  color: THEME_TEXT_COLOR,
};

export const DEFAULT_THEME: BoardTheme = {
  background: { kind: 'color', value: THEME_BOARD_BACKGROUND },
  gap: 16,
  defaultFont: 'newsreader',
};

interface PresetConfig {
  layout: LayoutId;
  sections: string[]; // i18n keys resolved by the caller
}

export const PRESETS: Record<BoardPreset, PresetConfig> = {
  blank: { layout: 'masonry', sections: [] },
  wall: { layout: 'masonry', sections: [] },
  vision: { layout: 'masonry', sections: ['health', 'travel', 'work', 'relationships', 'creativity', 'home'] },
  moodboard: { layout: 'freeform', sections: [] },
  gallery: { layout: 'freeform', sections: [] },
};

export function createBoard(opts: { title: string; preset?: BoardPreset; sectionTitles?: string[] }): Board {
  const preset = opts.preset ?? 'blank';
  const now = nowIso();
  const layout = PRESETS[preset].layout;
  const sections: Section[] = (opts.sectionTitles ?? []).map((title) => ({ id: newId(), title }));
  return {
    id: newId(),
    schemaVersion: SCHEMA_VERSION,
    title: opts.title,
    preset,
    items: [],
    sections,
    activeLayout: layout,
    layouts: { [layout]: createLayoutState(layout) },
    theme: structuredClone(DEFAULT_THEME),
    createdAt: now,
    updatedAt: now,
  };
}

export function createItem(front: Face, extra: Partial<Omit<BoardItem, 'id' | 'front'>> = {}): BoardItem {
  return {
    id: newId(),
    front,
    style: structuredClone(DEFAULT_ITEM_STYLE),
    addedAt: nowIso(),
    ...extra,
  };
}

export function createQuote(text: string, author?: string): Quote {
  const quote: Quote = { id: newId(), text, favorite: false, tags: [], createdAt: nowIso() };
  if (author) quote.author = author;
  return quote;
}

export function createImageAsset(
  data: Pick<ImageAsset, 'fileName' | 'width' | 'height' | 'hash'>,
): ImageAsset {
  return {
    id: newId(),
    ...data,
    fullBlobId: newId(),
    thumbBlobId: newId(),
    favorite: false,
    tags: [],
    createdAt: nowIso(),
  };
}
