import { useT, type MessageKey } from '@/i18n';
import { useBlobUrl } from '@/images/blobUrls';
import type { FocalPoint, ImageAsset, OverlayPosition } from '@/model';
import { POSITIONS } from '../overlayStyle';

const MAX_THUMB_HEIGHT = 220;

function Thumb({ asset, children, onClick }: { asset: ImageAsset; children?: React.ReactNode; onClick?(e: React.MouseEvent<HTMLDivElement>): void }) {
  const url = useBlobUrl(asset.thumbBlobId);
  return (
    <div
      // Exactly the image's shape (capped at 220px tall), so clicks map to image coordinates.
      className="relative mx-auto w-full overflow-hidden rounded-md bg-surface-2"
      style={{ aspectRatio: `${asset.width} / ${asset.height}`, maxWidth: (MAX_THUMB_HEIGHT * asset.width) / asset.height }}
      onClick={onClick}
    >
      {url && <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />}
      {children}
    </div>
  );
}

/** Nine dots over a small copy of the image (blueprint §6), not a dropdown. */
export function PositionGrid({ asset, value, onChange }: { asset: ImageAsset; value: OverlayPosition; onChange(p: OverlayPosition): void }) {
  const t = useT();
  return (
    <Thumb asset={asset}>
      <div role="radiogroup" aria-label={t('inspector.position')} className="absolute inset-0 grid grid-cols-3 grid-rows-3">
        {POSITIONS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={value === p}
            aria-label={t(`position.${p}` as MessageKey)}
            onClick={() => onChange(p)}
            className="group flex items-center justify-center"
          >
            <span className="h-3.5 w-3.5 rounded-full border-2 border-white bg-black/30 shadow-soft transition-transform group-hover:scale-125 group-aria-checked:scale-125 group-aria-checked:bg-accent" />
          </button>
        ))}
      </div>
    </Thumb>
  );
}

/** Click (or arrow keys) to set the point that stays in view when the image is cropped. */
export function FocalPicker({ asset, value, onChange }: { asset: ImageAsset; value: FocalPoint | undefined; onChange(p: FocalPoint): void }) {
  const t = useT();
  const focal = value ?? { x: 0.5, y: 0.5 };
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 100) / 100;
  return (
    <Thumb
      asset={asset}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onChange({ x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) });
      }}
    >
      <button
        type="button"
        aria-label={`${t('inspector.focal')}: ${Math.round(focal.x * 100)}%, ${Math.round(focal.y * 100)}%`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.1 : 0.05;
          const moves: Record<string, FocalPoint> = {
            ArrowLeft: { x: focal.x - step, y: focal.y },
            ArrowRight: { x: focal.x + step, y: focal.y },
            ArrowUp: { x: focal.x, y: focal.y - step },
            ArrowDown: { x: focal.x, y: focal.y + step },
          };
          const next = moves[e.key];
          if (next) {
            e.preventDefault();
            onChange({ x: clamp(next.x), y: clamp(next.y) });
          }
        }}
        className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent/70 shadow-lifted"
        style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
      />
    </Thumb>
  );
}
