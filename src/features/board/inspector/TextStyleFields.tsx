import { useT } from '@/i18n';
import { THEME_TEXT_COLOR, type FontId, type TextStyle } from '@/model';
import { Segmented } from '@/ui/Segmented';
import { Field, Slider } from './fields';

/** Font, size (auto or fixed), weight, italic, alignment and color of a text face or overlay. */
export function TextStyleFields({ style, onChange, sizeRange }: { style: TextStyle; onChange(patch: Partial<TextStyle>): void; sizeRange: [number, number] }) {
  const t = useT();
  const autoColor = style.color === THEME_TEXT_COLOR;
  return (
    <div className="flex flex-col gap-4">
      <Field label={t('inspector.font')}>
        <Segmented
          label={t('inspector.font')}
          value={style.font}
          onChange={(font: FontId) => onChange({ font })}
          options={[
            ['newsreader', t('font.newsreader')],
            ['inter', t('font.inter')],
          ]}
        />
      </Field>
      <Field label={t('inspector.size')}>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={style.size === 'auto'}
            onChange={(e) => onChange({ size: e.target.checked ? 'auto' : Math.round((sizeRange[0] + sizeRange[1]) / 2) })}
            className="accent-(--vb-accent)"
          />
          {t('inspector.auto')}
        </label>
        {style.size !== 'auto' && (
          <Slider label={t('inspector.size')} value={style.size} min={sizeRange[0]} max={sizeRange[1]} onChange={(size) => onChange({ size })} />
        )}
      </Field>
      <Field label={t('inspector.weight')}>
        <Segmented
          label={t('inspector.weight')}
          value={String(style.weight)}
          onChange={(w) => onChange({ weight: Number(w) as TextStyle['weight'] })}
          options={(['400', '500', '600', '700'] as const).map((w) => [w, w])}
        />
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={style.italic} onChange={(e) => onChange({ italic: e.target.checked })} className="accent-(--vb-accent)" />
          {t('inspector.italic')}
        </label>
      </Field>
      <Field label={t('inspector.align')}>
        <Segmented
          label={t('inspector.align')}
          value={style.align}
          onChange={(align) => onChange({ align })}
          options={[
            ['left', t('align.left')],
            ['center', t('align.center')],
            ['right', t('align.right')],
          ]}
        />
      </Field>
      <Field label={t('inspector.color')}>
        <div className="flex items-center gap-3 text-[13px]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoColor}
              onChange={(e) => onChange({ color: e.target.checked ? THEME_TEXT_COLOR : '#1f1d1a' })}
              className="accent-(--vb-accent)"
            />
            {t('inspector.auto')}
          </label>
          {!autoColor && (
            <input
              type="color"
              value={style.color}
              aria-label={t('inspector.color')}
              onChange={(e) => onChange({ color: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded border border-line bg-surface"
            />
          )}
        </div>
      </Field>
    </div>
  );
}
