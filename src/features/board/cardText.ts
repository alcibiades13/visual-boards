import { DEFAULT_TEXT_STYLE, type FontId, type TextStyle } from '@/model';

// Text card typography, shared by the renderer and the measurer so a card's
// measured height is exactly its rendered height (no layout jumps).

export const QUOTE_TEXT_CLASS = 'leading-[1.45] whitespace-pre-line break-words';
export const QUOTE_AUTHOR_CLASS = 'mt-3 font-sans text-[12px] not-italic font-normal tracking-wide';
export const TEXT_CARD_CLASS = 'leading-[1.3] whitespace-pre-line break-words';
export const CARD_PADDING_CLASS = 'px-5 py-6';
export const CAPTION_CLASS = 'px-1 pt-2 text-[13px] leading-snug text-muted';
export const FIT_TEXT_CLASS = 'leading-[1.3] whitespace-pre-line break-words';

export const FONT_STACKS: Record<FontId, string> = {
  newsreader: 'var(--vb-font-serif)',
  inter: 'var(--vb-font-sans)',
};

export type TextVariant = 'quote' | 'text' | 'overlay';

const DEFAULT_SIZE: Record<TextVariant, number> = { quote: 18, text: 22, overlay: 22 };

/** The effective style of a text face: defaults per variant, then the card's own choices. */
export function resolveTextStyle(variant: TextVariant, style: TextStyle | undefined): TextStyle {
  const base: TextStyle = { ...DEFAULT_TEXT_STYLE, align: variant === 'text' ? 'left' : 'center' };
  return { ...base, ...style };
}

export interface TextCss {
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  fontStyle: 'italic' | 'normal';
  textAlign: 'left' | 'center' | 'right';
}

/** Inline CSS for a text face. `size` overrides the style's size (auto-fit). */
export function textCss(variant: TextVariant, style: TextStyle, size?: number): TextCss {
  const px = size ?? (style.size === 'auto' ? DEFAULT_SIZE[variant] : style.size);
  return {
    fontFamily: FONT_STACKS[style.font],
    fontSize: `${px}px`,
    fontWeight: style.weight,
    fontStyle: style.italic ? 'italic' : 'normal',
    textAlign: style.align,
  };
}

export interface TextBlock {
  text: string;
  author?: string;
  variant: 'quote' | 'text';
  style?: TextStyle;
}

let host: HTMLDivElement | null = null;
const cache = new Map<string, number>();

function measureHost(): HTMLDivElement {
  if (!host) {
    host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none;';
    document.body.appendChild(host);
  }
  return host;
}

function remember(key: string, compute: () => number): number {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const value = compute();
  if (cache.size > 20_000) cache.clear();
  cache.set(key, value);
  return value;
}

/** Height of a quote or text card at a given width. Cached per content, style and width. */
export function measureTextCard(block: TextBlock, width: number): number {
  const w = Math.round(width);
  const style = resolveTextStyle(block.variant, block.style);
  const key = `${block.variant}\u0000${w}\u0000${block.text}\u0000${block.author ?? ''}\u0000${JSON.stringify(style)}`;
  return remember(key, () => {
    const el = measureHost();
    el.style.width = `${w}px`;
    el.innerHTML = '';
    const box = document.createElement('div');
    box.className = CARD_PADDING_CLASS;
    const text = document.createElement('p');
    text.className = block.variant === 'quote' ? QUOTE_TEXT_CLASS : TEXT_CARD_CLASS;
    Object.assign(text.style, textCss(block.variant, style));
    text.textContent = block.text;
    box.appendChild(text);
    if (block.author) {
      const author = document.createElement('p');
      author.className = QUOTE_AUTHOR_CLASS;
      author.textContent = `— ${block.author}`;
      box.appendChild(author);
    }
    el.appendChild(box);
    return Math.ceil(box.getBoundingClientRect().height);
  });
}

export function measureCaption(caption: string, width: number): number {
  const w = Math.round(width);
  return remember(`caption\u0000${w}\u0000${caption}`, () => {
    const el = measureHost();
    el.style.width = `${w}px`;
    el.innerHTML = '';
    const p = document.createElement('p');
    p.className = CAPTION_CLASS;
    p.textContent = caption;
    el.appendChild(p);
    return Math.ceil(p.getBoundingClientRect().height);
  });
}

/** Height of free text (overlay or card back) at a font size, for auto-fit. */
export function measureFitText(text: string, author: string | undefined, width: number, css: TextCss): number {
  const w = Math.round(width);
  return remember(`fit\u0000${w}\u0000${text}\u0000${author ?? ''}\u0000${JSON.stringify(css)}`, () => {
    const el = measureHost();
    el.style.width = `${w}px`;
    el.innerHTML = '';
    const box = document.createElement('div');
    const p = document.createElement('p');
    p.className = FIT_TEXT_CLASS;
    Object.assign(p.style, css);
    p.textContent = text;
    box.appendChild(p);
    if (author) {
      const a = document.createElement('p');
      a.className = 'mt-2 font-sans text-[12px] tracking-wide';
      a.textContent = `— ${author}`;
      box.appendChild(a);
    }
    el.appendChild(box);
    return Math.ceil(box.getBoundingClientRect().height);
  });
}
