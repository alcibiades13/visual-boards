import { memo, type CSSProperties } from 'react';
import { useT } from '@/i18n';
import { useBlobUrl } from '@/images/blobUrls';
import { THEME_TEXT_COLOR, type BoardItem, type Face, type ImageAsset, type TextOverlay } from '@/model';
import { ImagesIcon } from '@/ui/icons';
import {
  CAPTION_CLASS,
  CARD_PADDING_CLASS,
  FIT_TEXT_CLASS,
  measureCaption,
  QUOTE_AUTHOR_CLASS,
  QUOTE_TEXT_CLASS,
  resolveTextStyle,
  TEXT_CARD_CLASS,
  textCss,
} from './cardText';
import { fitBackText, fitOverlayText, OVERLAY_INSET, OVERLAY_PAD, overlayBoxWidth } from './fitText';
import { sourceText, type Lookup } from './measure';
import { overlayPresentation, positionCss } from './overlayStyle';

// One component draws every card (blueprint §6): image, quote, text, text over
// an image, flip card with any two faces, and caption. No per-kind components.

const SHADOWS = { none: '', soft: 'shadow-soft', lifted: 'shadow-lifted' } as const;

function colorOf(color: string, fallback: string): string {
  return color && color !== THEME_TEXT_COLOR ? color : fallback;
}

function ImageLayer({ asset, focal, full }: { asset: ImageAsset | undefined; focal?: { x: number; y: number }; full?: boolean }) {
  const t = useT();
  const url = useBlobUrl(full ? asset?.fullBlobId : asset?.thumbBlobId);
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

function OverlayLayer({ overlay, lookup, width, height }: { overlay: TextOverlay; lookup: Lookup; width: number; height: number }) {
  const { text, author } = sourceText(overlay.source, lookup);
  const fit = fitOverlayText(text, author, overlay.textStyle, width, height);
  const look = overlayPresentation(overlay.effect, overlay.position, overlay.intensity);
  const color = colorOf(fit.style.color, look.color);
  const inset = width * OVERLAY_INSET;
  return (
    <>
      {look.layer && <div className="pointer-events-none absolute inset-0" style={look.layer} />}
      <div className="pointer-events-none absolute inset-0 flex flex-col" style={{ ...positionCss(overlay.position), padding: inset }}>
        <div style={{ ...look.box, maxWidth: overlayBoxWidth(width), padding: OVERLAY_PAD, color }}>
          <p className={FIT_TEXT_CLASS} style={{ ...textCss('overlay', fit.style, fit.size), ...look.text }}>
            {text}
          </p>
          {author && (
            <p className="mt-2 font-sans text-[12px] tracking-wide opacity-85" style={{ textAlign: fit.style.align, ...look.text }}>
              — {author}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

interface FaceProps {
  face: Face;
  lookup: Lookup;
  width: number;
  height: number;
  /** Backs fit their text into the card (the card's size comes from the front). */
  fit: boolean;
  full?: boolean;
}

function FaceView({ face, lookup, width, height, fit, full }: FaceProps) {
  switch (face.kind) {
    case 'image':
      return (
        <>
          <ImageLayer asset={lookup.assets.get(face.assetId)} focal={face.focal} full={full} />
          {face.overlay && <OverlayLayer overlay={face.overlay} lookup={lookup} width={width} height={height} />}
        </>
      );
    case 'quote':
    case 'text': {
      const variant = face.kind;
      const content = face.kind === 'quote' ? sourceText({ quoteId: face.quoteId }, lookup) : { text: face.text };
      const sized = fit ? fitBackText(variant, content.text, content.author, face.textStyle, width, height) : null;
      const style = sized?.style ?? resolveTextStyle(variant, face.textStyle);
      const css = textCss(variant, style, sized?.size);
      const color = colorOf(style.color, 'var(--vb-ink)');
      const background: CSSProperties = { background: style.background ?? 'var(--vb-surface)', color };
      const justify = fit ? 'justify-center' : variant === 'quote' ? 'justify-center' : 'justify-start';
      return (
        <div className={`flex h-full flex-col ${justify} ${fit ? 'p-5' : CARD_PADDING_CLASS}`} style={background}>
          <p className={fit ? FIT_TEXT_CLASS : variant === 'quote' ? QUOTE_TEXT_CLASS : TEXT_CARD_CLASS} style={css}>
            {content.text}
          </p>
          {content.author && (
            <p className={`${QUOTE_AUTHOR_CLASS} opacity-70`} style={{ textAlign: style.align }}>
              — {content.author}
            </p>
          )}
        </div>
      );
    }
  }
}

interface CardProps {
  item: BoardItem;
  lookup: Lookup;
  width: number;
  height: number;
  flipped?: boolean;
  /** Use full-resolution images (zoom, fullscreen, export). */
  full?: boolean;
}

/** The visual card, drawn at the given size. */
export const Card = memo(function Card({ item, lookup, width, height, flipped = false, full }: CardProps) {
  const { style } = item;
  const captionHeight = item.caption ? measureCaption(item.caption, width) : 0;
  const faceHeight = Math.max(1, height - captionHeight);
  const frame: CSSProperties = { borderRadius: style.radius };
  const border = style.border ? { boxShadow: `inset 0 0 0 ${style.border.width}px ${style.border.color}`, borderRadius: style.radius } : null;
  const faceClass = `vb-face absolute inset-0 overflow-hidden ${SHADOWS[style.shadow]}`;

  // Only flip cards get the 3D structure: every 3D context is its own compositing
  // layer, which is costly on long walls and weak devices.
  if (!item.back) {
    return (
      <div className="flex h-full w-full flex-col">
        <div className={`relative overflow-hidden ${SHADOWS[style.shadow]}`} style={{ ...frame, height: faceHeight }}>
          <FaceView face={item.front} lookup={lookup} width={width} height={faceHeight} fit={false} full={full} />
          {border && <div className="pointer-events-none absolute inset-0" style={border} />}
        </div>
        {item.caption && <p className={CAPTION_CLASS}>{item.caption}</p>}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative [perspective:1400px]" style={{ height: faceHeight }}>
        <div className="vb-flipper relative h-full w-full" data-flipped={flipped || undefined}>
          <div className={`${faceClass} vb-face-front`} style={frame}>
            <FaceView face={item.front} lookup={lookup} width={width} height={faceHeight} fit={false} full={full} />
            {border && <div className="pointer-events-none absolute inset-0" style={border} />}
          </div>
          <div className={`${faceClass} vb-face-back`} style={frame} aria-hidden={!flipped}>
            <FaceView face={item.back} lookup={lookup} width={width} height={faceHeight} fit full={full} />
            {border && <div className="pointer-events-none absolute inset-0" style={border} />}
          </div>
        </div>
      </div>
      {item.caption && <p className={CAPTION_CLASS}>{item.caption}</p>}
    </div>
  );
});
