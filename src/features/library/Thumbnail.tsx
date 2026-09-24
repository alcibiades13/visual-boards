import { memo, useRef } from 'react';
import { useT } from '@/i18n';
import { useBlobUrl } from '@/images/blobUrls';
import type { ImageAsset } from '@/model';
import type { SelectMode } from './selection';
import { CheckIcon, StarIcon } from '@/ui/icons';

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10;

interface ThumbnailProps {
  asset: ImageAsset;
  x: number;
  y: number;
  w: number;
  h: number;
  selected: boolean;
  selectionMode: boolean;
  onSelect(id: string, mode: SelectMode): void;
  onLongPress(id: string): void;
  onToggleFavorite(asset: ImageAsset): void;
}

export const Thumbnail = memo(function Thumbnail({
  asset,
  x,
  y,
  w,
  h,
  selected,
  selectionMode,
  onSelect,
  onLongPress,
  onToggleFavorite,
}: ThumbnailProps) {
  const t = useT();
  const url = useBlobUrl(asset.thumbBlobId);
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const pointerType = useRef('mouse');

  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };

  return (
    <div
      role="option"
      aria-selected={selected}
      aria-label={t('library.image', { name: asset.fileName })}
      tabIndex={0}
      data-asset-id={asset.id}
      className="group absolute top-0 left-0 cursor-default touch-manipulation select-none [-webkit-touch-callout:none]"
      style={{ width: w, height: h, transform: `translate(${x}px, ${y}px)` }}
      onPointerDown={(e) => {
        pointerType.current = e.pointerType;
        if (e.pointerType !== 'touch') return;
        const start = { x: e.clientX, y: e.clientY };
        press.current = {
          ...start,
          timer: setTimeout(() => {
            press.current = null;
            suppressClick.current = true;
            navigator.vibrate?.(10);
            onLongPress(asset.id);
          }, LONG_PRESS_MS),
        };
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOLERANCE) cancelPress();
      }}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => pointerType.current === 'touch' && e.preventDefault()}
      onClick={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        if (pointerType.current === 'touch') {
          if (selectionMode) onSelect(asset.id, 'toggle');
          return; // plain taps get their board action in M3
        }
        onSelect(asset.id, e.shiftKey ? 'range' : e.metaKey || e.ctrlKey ? 'toggle' : 'replace');
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onSelect(asset.id, e.key === ' ' || e.metaKey || e.ctrlKey ? 'toggle' : e.shiftKey ? 'range' : 'replace');
        }
      }}
    >
      <div
        className={`h-full w-full overflow-hidden rounded-[5px] bg-surface-2 transition-[box-shadow,transform] duration-(--vb-fast) ${
          selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''
        }`}
      >
        {url && <img src={url} alt="" draggable={false} decoding="async" className="h-full w-full object-cover" />}
      </div>

      {(selected || selectionMode) && (
        <span
          className={`absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full border ${
            selected ? 'border-accent bg-accent text-accent-ink' : 'border-white/80 bg-black/20'
          }`}
        >
          {selected && <CheckIcon size={13} strokeWidth={2.2} />}
        </span>
      )}

      <button
        type="button"
        aria-label={asset.favorite ? t('library.unfavorite') : t('library.favorite')}
        aria-pressed={asset.favorite}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(asset);
        }}
        className={`absolute top-1 right-1 rounded-full p-1 text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)] transition-opacity duration-(--vb-fast) ${
          asset.favorite
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:hidden'
        }`}
      >
        <StarIcon size={16} filled={asset.favorite} />
      </button>
    </div>
  );
});
