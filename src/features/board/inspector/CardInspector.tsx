import { useState } from 'react';
import { useT, type MessageKey } from '@/i18n';
import {
  removeBack,
  removeItems,
  removeOverlay,
  setBack,
  setCaption,
  setFaceText,
  setFocal,
  setItemStyle,
  setOverlay,
  setSpan,
  setTextStyle,
  updateOverlay,
  type AspectRatio,
  type Board,
  type BoardItem,
  type Face,
  type ID,
  type ShadowStyle,
  type TextOverlay,
} from '@/model';
import { useBoard } from '@/store/boardStore';
import { useEditor } from '@/store/editorStore';
import { useLibrary } from '@/store/libraryStore';
import { Button } from '@/ui/Button';
import { TrashIcon } from '@/ui/icons';
import { Segmented } from '@/ui/Segmented';
import { measureCaption, resolveTextStyle } from '../cardText';
import { fitOverlayText } from '../fitText';
import { sourceText } from '../measure';
import { DEFAULT_OVERLAY, EFFECTS } from '../overlayStyle';
import { useLookup } from '../useLookup';
import { Field, Group, inputClass, Slider, smallButtonClass } from './fields';
import { FocalPicker, PositionGrid } from './ImageControls';
import { QuoteEditor } from './QuoteEditor';
import { QuotePicker } from './QuotePicker';
import { TextStyleFields } from './TextStyleFields';

const ASPECTS: AspectRatio[] = ['original', '1:1', '4:5', '3:4', '3:2', '16:9'];
const SHADOWS: ShadowStyle[] = ['none', 'soft', 'lifted'];

function useUpdate() {
  return useBoard((s) => s.update);
}

/** Local text of a face, edited on every keystroke (autosave debounces the writes). */
function FaceTextEditor({ item, side }: { item: BoardItem; side: 'front' | 'back' }) {
  const t = useT();
  const update = useUpdate();
  const face = item[side];
  if (face?.kind !== 'text') return null;
  return (
    <textarea
      value={face.text}
      rows={3}
      aria-label={t('inspector.text')}
      onChange={(e) => update((b) => setFaceText(b, item.id, side, e.target.value))}
      className={`${inputClass} resize-y font-serif text-[14px] leading-snug [field-sizing:content]`}
    />
  );
}

/** Measures the card on the wall to tell whether auto-sized overlay text fits. */
function overlayOverflows(item: BoardItem, overlay: TextOverlay, lookup: ReturnType<typeof useLookup>): boolean {
  const el = document.querySelector<HTMLElement>(`[data-item-id="${item.id}"]`);
  if (!el) return false;
  const width = el.offsetWidth;
  const height = el.offsetHeight - (item.caption ? measureCaption(item.caption, width) : 0);
  const { text, author } = sourceText(overlay.source, lookup);
  return !fitOverlayText(text, author, overlay.textStyle, width, height).fits;
}

function OverlayGroup({ item }: { item: BoardItem }) {
  const t = useT();
  const update = useUpdate();
  const lookup = useLookup();
  const [picking, setPicking] = useState(false);
  if (item.front.kind !== 'image') return null;
  const asset = lookup.assets.get(item.front.assetId);
  const overlay = item.front.overlay;

  if (!overlay) {
    return (
      <Group title={t('inspector.overlay')}>
        {picking ? (
          <QuotePicker
            onCancel={() => setPicking(false)}
            onPick={(quoteId) => {
              update((b) => setOverlay(b, item.id, { source: { quoteId }, ...DEFAULT_OVERLAY }));
              setPicking(false);
            }}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={smallButtonClass} onClick={() => setPicking(true)}>
              {t('inspector.addOverlayQuote')}
            </button>
            <button
              type="button"
              className={smallButtonClass}
              onClick={() => update((b) => setOverlay(b, item.id, { source: { text: t('card.newText') }, ...DEFAULT_OVERLAY }))}
            >
              {t('inspector.addOverlayText')}
            </button>
          </div>
        )}
      </Group>
    );
  }

  const style = resolveTextStyle('overlay', overlay.textStyle);
  const tooLong = style.size === 'auto' && overlayOverflows(item, overlay, lookup);
  return (
    <Group title={t('inspector.overlay')}>
      {'quoteId' in overlay.source ? (
        <QuoteEditor quoteId={overlay.source.quoteId} />
      ) : (
        <textarea
          value={overlay.source.text}
          rows={2}
          aria-label={t('inspector.text')}
          onChange={(e) => update((b) => updateOverlay(b, item.id, { source: { text: e.target.value } }))}
          className={`${inputClass} resize-y font-serif text-[14px] [field-sizing:content]`}
        />
      )}
      {tooLong && (
        <p role="alert" className="rounded-md bg-danger/10 px-2.5 py-2 text-[12px] leading-snug text-danger">
          {t('inspector.tooLong')}
        </p>
      )}
      {asset && (
        <Field label={t('inspector.position')}>
          <PositionGrid asset={asset} value={overlay.position} onChange={(position) => update((b) => updateOverlay(b, item.id, { position }))} />
        </Field>
      )}
      <Field label={t('inspector.effect')}>
        <select
          value={overlay.effect}
          aria-label={t('inspector.effect')}
          onChange={(e) => update((b) => updateOverlay(b, item.id, { effect: e.target.value as TextOverlay['effect'] }))}
          className={inputClass}
        >
          {EFFECTS.map((effect) => (
            <option key={effect} value={effect}>
              {t(`effect.${effect}` as MessageKey)}
            </option>
          ))}
        </select>
        <Slider
          label={t('inspector.intensity')}
          value={Math.round(overlay.intensity * 100)}
          min={0}
          max={100}
          step={5}
          format={(v) => `${v}%`}
          onChange={(v) => update((b) => updateOverlay(b, item.id, { intensity: v / 100 }))}
        />
      </Field>
      <TextStyleFields
        style={style}
        sizeRange={[12, 64]}
        onChange={(patch) => update((b) => setTextStyle(b, [item.id], 'front', patch, style))}
      />
      <button type="button" className={`${smallButtonClass} self-start`} onClick={() => update((b) => removeOverlay(b, item.id))}>
        {t('inspector.removeOverlay')}
      </button>
    </Group>
  );
}

function BackGroup({ item }: { item: BoardItem }) {
  const t = useT();
  const update = useUpdate();
  const [picking, setPicking] = useState(false);
  const back = item.back;
  const put = (face: Face) => update((b) => setBack(b, item.id, face));

  return (
    <Group title={t('inspector.back')}>
      {!back &&
        (picking ? (
          <QuotePicker
            onCancel={() => setPicking(false)}
            onPick={(quoteId) => {
              put({ kind: 'quote', quoteId });
              setPicking(false);
            }}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={smallButtonClass} onClick={() => setPicking(true)}>
                {t('inspector.addBackQuote')}
              </button>
              <button type="button" className={smallButtonClass} onClick={() => put({ kind: 'text', text: t('card.newText') })}>
                {t('inspector.addBackText')}
              </button>
            </div>
            <span className="text-[12px] leading-snug text-faint">{t('inspector.backHint')}</span>
          </>
        ))}
      {back?.kind === 'quote' && <QuoteEditor quoteId={back.quoteId} />}
      {back?.kind === 'text' && <FaceTextEditor item={item} side="back" />}
      {back && (
        <button
          type="button"
          className={`${smallButtonClass} self-start`}
          onClick={() => {
            update((b) => removeBack(b, item.id));
            if (useEditor.getState().flipped.has(item.id)) useEditor.getState().flip(item.id);
          }}
        >
          {t('inspector.removeBack')}
        </button>
      )}
    </Group>
  );
}

function StyleGroup({ board, ids }: { board: Board; ids: ID[] }) {
  const t = useT();
  const update = useUpdate();
  const items = board.items.filter((i) => ids.includes(i.id));
  const first = items[0]!;
  const style = first.style;
  const images = items.every((i) => i.front.kind === 'image');
  const overrides = board.layouts.masonry?.overrides ?? {};
  const spans = new Set(ids.map((id) => overrides[id]?.span ?? 1));

  return (
    <Group title={t('inspector.style')}>
      <Field label={t('inspector.width')}>
        <Segmented
          label={t('inspector.width')}
          value={spans.size === 1 ? String([...spans][0]) : ''}
          onChange={(v) => update((b) => setSpan(b, 'masonry', ids, Number(v) as 1 | 2 | 3))}
          options={(['1', '2', '3'] as const).map((n) => [n, t('inspector.span', { count: Number(n) })])}
        />
      </Field>
      {images && (
        <Field label={t('inspector.aspect')}>
          <div role="radiogroup" aria-label={t('inspector.aspect')} className="grid grid-cols-3 gap-1">
            {ASPECTS.map((aspect) => (
              <button
                key={aspect}
                type="button"
                role="radio"
                aria-checked={style.aspect === aspect}
                onClick={() => update((b) => setItemStyle(b, ids, { aspect }))}
                className="rounded-md border border-line py-1.5 text-[12px] text-muted aria-checked:border-ink aria-checked:text-ink"
              >
                {aspect === 'original' ? t('inspector.aspect.original') : aspect}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label={t('inspector.radius')}>
        <Slider label={t('inspector.radius')} value={style.radius} min={0} max={32} onChange={(radius) => update((b) => setItemStyle(b, ids, { radius }))} />
      </Field>
      <Field label={t('inspector.shadow')}>
        <Segmented
          label={t('inspector.shadow')}
          value={style.shadow}
          onChange={(shadow) => update((b) => setItemStyle(b, ids, { shadow }))}
          options={SHADOWS.map((s) => [s, t(`shadow.${s}`)])}
        />
      </Field>
      <Field label={t('inspector.border')}>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={!!style.border}
            onChange={(e) => update((b) => setItemStyle(b, ids, { border: e.target.checked ? { width: 2, color: '#1f1d1a' } : undefined }))}
            className="accent-(--vb-accent)"
          />
          {t('inspector.border')}
        </label>
        {style.border && (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <Slider
                label={t('inspector.border')}
                value={style.border.width}
                min={1}
                max={16}
                onChange={(width) => update((b) => setItemStyle(b, ids, { border: { ...style.border!, width } }))}
              />
            </div>
            <input
              type="color"
              value={style.border.color}
              aria-label={t('inspector.borderColor')}
              onChange={(e) => update((b) => setItemStyle(b, ids, { border: { ...style.border!, color: e.target.value } }))}
              className="h-8 w-12 cursor-pointer rounded border border-line bg-surface"
            />
          </div>
        )}
      </Field>
      <Field label={t('inspector.remove')} hint={t('inspector.removeHint')}>
        <Button
          size="sm"
          onClick={() => {
            update((b) => removeItems(b, ids));
            useEditor.getState().clear();
          }}
        >
          <TrashIcon size={15} />
          {t('inspector.remove')}
        </Button>
      </Field>
    </Group>
  );
}

export function CardInspector({ board, ids }: { board: Board; ids: ID[] }) {
  const t = useT();
  const update = useUpdate();
  const lookup = useLookup();
  const item = ids.length === 1 ? board.items.find((i) => i.id === ids[0]) : undefined;
  const quotesLoaded = useLibrary((s) => s.loaded);

  if (!item) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-[13px] font-medium">{t('inspector.selected', { count: ids.length })}</p>
        <StyleGroup board={board} ids={ids} />
      </div>
    );
  }

  const front = item.front;
  const asset = front.kind === 'image' ? lookup.assets.get(front.assetId) : undefined;
  const textStyle = front.kind !== 'image' ? resolveTextStyle(front.kind, front.textStyle) : null;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[13px] font-medium">{t('inspector.selected', { count: 1 })}</p>

      {front.kind !== 'image' && (
        <Group title={t('inspector.content')}>
          {front.kind === 'quote' && quotesLoaded && <QuoteEditor quoteId={front.quoteId} />}
          {front.kind === 'text' && <FaceTextEditor item={item} side="front" />}
          {textStyle && (
            <TextStyleFields
              style={textStyle}
              sizeRange={front.kind === 'quote' ? [12, 40] : [14, 64]}
              onChange={(patch) => update((b) => setTextStyle(b, [item.id], 'front', patch, textStyle))}
            />
          )}
        </Group>
      )}

      {front.kind === 'image' && asset && (
        <Group title={t('inspector.image')}>
          <Field label={t('inspector.focal')} hint={t('inspector.focalHint')}>
            <FocalPicker asset={asset} value={front.focal} onChange={(p) => update((b) => setFocal(b, item.id, p))} />
          </Field>
        </Group>
      )}

      {front.kind === 'image' && <OverlayGroup item={item} />}
      <BackGroup item={item} />

      <Group title={t('inspector.caption')}>
        <input
          value={item.caption ?? ''}
          placeholder={t('inspector.captionPlaceholder')}
          aria-label={t('inspector.caption')}
          onChange={(e) => update((b) => setCaption(b, item.id, e.target.value))}
          className={inputClass}
        />
      </Group>

      <StyleGroup board={board} ids={ids} />
    </div>
  );
}
