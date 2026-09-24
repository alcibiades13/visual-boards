import { memo } from 'react';
import { useT } from '@/i18n';
import { useBlobUrl } from '@/images/blobUrls';
import type { BoardItem, Face, ImageAsset, Quote } from '@/model';
import { ImagesIcon } from '@/ui/icons';
import { CAPTION_CLASS, CARD_PADDING_CLASS, QUOTE_AUTHOR_CLASS, QUOTE_TEXT_CLASS, TEXT_CARD_CLASS } from './cardText';
import type { Lookup } from './measure';

// One component draws every card (blueprint §6). Flip, overlay and full text
// styling are added in M4 on top of this structure.

const SHADOWS = { none: '', soft: 'shadow-soft', lifted: 'shadow-lifted' } as const;

function ImageFaceView({ asset, focal }: { asset: ImageAsset | undefined; focal?: { x: number; y: number } }) {
  const t = useT();
  const url = useBlobUrl(asset?.thumbBlobId);
  if (!asset) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-2 text-faint" title={t('card.missing')}>
        <ImagesIcon size={22} />
      </div>
    );
  }
  return (
    <div className="h-full w-full bg-surface-2">
      {url && (
        <img
          src={url}
          alt=""
          draggable={false}
          decoding="async"
          className="h-full w-full object-cover"
          style={focal ? { objectPosition: `${focal.x * 100}% ${focal.y * 100}%` } : undefined}
        />
      )}
    </div>
  );
}

function QuoteFaceView({ quote }: { quote: Quote | undefined }) {
  return (
    <blockquote className={`flex h-full flex-col justify-center bg-surface text-ink ${CARD_PADDING_CLASS}`}>
      <p className={QUOTE_TEXT_CLASS}>{quote?.text ?? '…'}</p>
      {quote?.author && <p className={`${QUOTE_AUTHOR_CLASS} text-muted`}>— {quote.author}</p>}
    </blockquote>
  );
}

function FaceView({ face, lookup }: { face: Face; lookup: Lookup }) {
  switch (face.kind) {
    case 'image':
      return <ImageFaceView asset={lookup.assets.get(face.assetId)} focal={face.focal} />;
    case 'quote':
      return <QuoteFaceView quote={lookup.quotes.get(face.quoteId)} />;
    case 'text':
      return (
        <div className={`flex h-full items-center bg-surface text-ink ${CARD_PADDING_CLASS}`}>
          <p className={TEXT_CARD_CLASS}>{face.text}</p>
        </div>
      );
  }
}

interface CardProps {
  item: BoardItem;
  lookup: Lookup;
}

/** The visual card, sized by its parent. */
export const Card = memo(function Card({ item, lookup }: CardProps) {
  const { style } = item;
  const border = style.border ? { boxShadow: `inset 0 0 0 ${style.border.width}px ${style.border.color}` } : undefined;
  return (
    <div className="flex h-full w-full flex-col">
      <div
        className={`relative min-h-0 flex-1 overflow-hidden ${SHADOWS[style.shadow]}`}
        style={{ borderRadius: style.radius }}
      >
        <FaceView face={item.front} lookup={lookup} />
        {border && <div className="pointer-events-none absolute inset-0" style={{ ...border, borderRadius: style.radius }} />}
      </div>
      {item.caption && <p className={CAPTION_CLASS}>{item.caption}</p>}
    </div>
  );
});
