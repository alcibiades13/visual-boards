import type { AspectRatio, BoardItem, Face, ImageAsset, Quote } from '@/model';
import { measureCaption, measureTextCard } from './cardText';

const ASPECTS: Record<Exclude<AspectRatio, 'original'>, number> = {
  '1:1': 1,
  '4:5': 5 / 4,
  '3:4': 4 / 3,
  '3:2': 2 / 3,
  '16:9': 9 / 16,
};

/** Height/width ratio of an image card; unknown images are square placeholders. */
export function imageRatio(aspect: AspectRatio, asset: ImageAsset | undefined): number {
  if (aspect !== 'original') return ASPECTS[aspect];
  return asset ? asset.height / asset.width : 1;
}

export interface Lookup {
  assets: Map<string, ImageAsset>;
  quotes: Map<string, Quote>;
}

function faceHeight(face: Face, item: BoardItem, width: number, lookup: Lookup): number {
  switch (face.kind) {
    case 'image':
      return width * imageRatio(item.style.aspect, lookup.assets.get(face.assetId));
    case 'quote': {
      const quote = lookup.quotes.get(face.quoteId);
      return measureTextCard({ variant: 'quote', text: quote?.text ?? '…', author: quote?.author }, width);
    }
    case 'text':
      return measureTextCard({ variant: 'text', text: face.text || ' ' }, width);
  }
}

/** A card's height at a given width: known in advance, so walls never jump while images load. */
export function measureItem(item: BoardItem, width: number, lookup: Lookup): number {
  let h = faceHeight(item.front, item, width, lookup);
  if (item.caption) h += measureCaption(item.caption, width);
  return h;
}

/** Accessible name of a card face. */
export function faceLabel(face: Face, lookup: Lookup): string {
  switch (face.kind) {
    case 'image':
      return lookup.assets.get(face.assetId)?.fileName ?? '';
    case 'quote': {
      const q = lookup.quotes.get(face.quoteId);
      return q ? `${q.text}${q.author ? ` — ${q.author}` : ''}` : '';
    }
    case 'text':
      return face.text;
  }
}
