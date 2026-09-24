// Text card typography, shared by the renderer and the measurer so a card's
// measured height is exactly its rendered height (no layout jumps).

export const QUOTE_TEXT_CLASS = 'font-serif text-[18px] leading-[1.45] whitespace-pre-line break-words';
export const QUOTE_AUTHOR_CLASS = 'mt-3 font-sans text-[12px] tracking-wide';
export const TEXT_CARD_CLASS = 'font-serif text-[22px] leading-[1.3] whitespace-pre-line break-words';
export const CARD_PADDING_CLASS = 'px-5 py-6';
export const CAPTION_CLASS = 'px-1 pt-2 text-[13px] leading-snug text-muted';

export interface TextBlock {
  text: string;
  author?: string;
  variant: 'quote' | 'text';
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

/** Height of a text card at a given width. Cached per text, author and width. */
export function measureTextCard(block: TextBlock, width: number): number {
  const w = Math.round(width);
  const key = `${block.variant}\u0000${w}\u0000${block.text}\u0000${block.author ?? ''}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const el = measureHost();
  el.style.width = `${w}px`;
  el.innerHTML = '';
  const box = document.createElement('div');
  box.className = CARD_PADDING_CLASS;
  const text = document.createElement('p');
  text.className = block.variant === 'quote' ? QUOTE_TEXT_CLASS : TEXT_CARD_CLASS;
  text.textContent = block.text;
  box.appendChild(text);
  if (block.author) {
    const author = document.createElement('p');
    author.className = QUOTE_AUTHOR_CLASS;
    author.textContent = `— ${block.author}`;
    box.appendChild(author);
  }
  el.appendChild(box);
  const height = Math.ceil(box.getBoundingClientRect().height);
  cache.set(key, height);
  return height;
}

export function measureCaption(caption: string, width: number): number {
  const w = Math.round(width);
  const key = `caption\u0000${w}\u0000${caption}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const el = measureHost();
  el.style.width = `${w}px`;
  el.innerHTML = '';
  const p = document.createElement('p');
  p.className = CAPTION_CLASS;
  p.textContent = caption;
  el.appendChild(p);
  const height = Math.ceil(p.getBoundingClientRect().height);
  cache.set(key, height);
  return height;
}
