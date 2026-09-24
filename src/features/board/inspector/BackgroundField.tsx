import { useT } from '@/i18n';
import { useBlobUrl } from '@/images/blobUrls';
import { setBackground, THEME_BOARD_BACKGROUND, type Board, type BoardBackground, type ImageAsset } from '@/model';
import { useBoard } from '@/store/boardStore';
import { useLibrary } from '@/store/libraryStore';
import { Segmented } from '@/ui/Segmented';
import { CheckIcon } from '@/ui/icons';
import { BACKGROUND_SWATCHES, DEFAULT_DIM, luminance, MAX_DIM } from '../wallBackground';
import { Field, Slider } from './fields';

type Mode = 'theme' | 'color' | 'image';

function modeOf(bg: BoardBackground): Mode {
  if (bg.kind === 'image') return 'image';
  return bg.kind === 'color' && bg.value === THEME_BOARD_BACKGROUND ? 'theme' : 'color';
}

function ImageChoice({ asset, selected, onPick }: { asset: ImageAsset; selected: boolean; onPick(): void }) {
  const url = useBlobUrl(asset.thumbBlobId);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={asset.fileName}
      onClick={onPick}
      className="relative aspect-square overflow-hidden rounded-md bg-surface-2 ring-offset-2 ring-offset-bg aria-checked:ring-2 aria-checked:ring-accent"
    >
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
    </button>
  );
}

/** Theme default, a color, or a library image with an optional veil. */
export function BackgroundField({ board }: { board: Board }) {
  const t = useT();
  const update = useBoard((s) => s.update);
  const assets = useLibrary((s) => s.assets);
  const bg = board.theme.background;
  const mode = modeOf(bg);
  const put = (next: BoardBackground) => update((b) => setBackground(b, next));
  const color = bg.kind === 'color' && mode === 'color' ? bg.value : BACKGROUND_SWATCHES[0]!;

  return (
    <Field label={t('inspector.background')} hint={mode === 'image' ? t('background.dimHint') : undefined}>
      <Segmented
        label={t('inspector.background')}
        value={mode}
        onChange={(m: Mode) => {
          if (m === 'theme') put({ kind: 'color', value: THEME_BOARD_BACKGROUND });
          if (m === 'color') put({ kind: 'color', value: color });
          if (m === 'image' && assets.length) {
            const newest = assets[assets.length - 1]!;
            put({ kind: 'image', assetId: newest.id, dim: DEFAULT_DIM });
          }
        }}
        options={[
          ['theme', t('background.theme')],
          ['color', t('background.color')],
          ['image', t('background.image')],
        ]}
      />

      {mode === 'color' && (
        <div role="radiogroup" aria-label={t('background.color')} className="flex flex-wrap items-center gap-2">
          {BACKGROUND_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              role="radio"
              aria-checked={color === swatch}
              aria-label={t('background.swatch', { color: swatch })}
              onClick={() => put({ kind: 'color', value: swatch })}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-line"
              style={{ background: swatch, color: (luminance(swatch) ?? 1) < 0.25 ? '#f1ede6' : '#1f1d1a' }}
            >
              {color === swatch && <CheckIcon size={14} strokeWidth={2.2} />}
            </button>
          ))}
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#f7f3ec'}
            aria-label={t('background.custom')}
            onChange={(e) => put({ kind: 'color', value: e.target.value })}
            className="h-7 w-10 cursor-pointer rounded border border-line bg-surface"
          />
        </div>
      )}

      {mode === 'image' && bg.kind === 'image' && (
        <>
          <Segmented
            label={t('background.veil')}
            value={bg.veil ?? 'light'}
            onChange={(veil) => put({ ...bg, veil })}
            options={[
              ['light', t('background.veilLight')],
              ['dark', t('background.veilDark')],
            ]}
          />
          <span className="-mb-1 text-[13px] text-muted">{t('background.dim')}</span>
          <Slider
            label={t('background.dim')}
            value={Math.round((bg.dim ?? 0) * 100)}
            min={0}
            max={MAX_DIM * 100}
            step={5}
            format={(v) => `${v}%`}
            onChange={(v) => put({ ...bg, dim: v / 100 })}
          />
          <div role="radiogroup" aria-label={t('background.pick')} className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto p-0.5">
            {[...assets].reverse().map((asset) => (
              <ImageChoice
                key={asset.id}
                asset={asset}
                selected={bg.assetId === asset.id}
                onPick={() => put({ ...bg, assetId: asset.id })}
              />
            ))}
          </div>
        </>
      )}
      {mode !== 'image' && !assets.length && <span className="text-[12px] text-faint">{t('background.noImages')}</span>}
    </Field>
  );
}
