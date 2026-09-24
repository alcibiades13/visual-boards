import type { ReactNode } from 'react';
import { useT } from '@/i18n';
import { MAX_COLUMNS } from '@/layout/masonry';
import {
  DEFAULT_MASONRY_PARAMS,
  addSection,
  layoutState,
  moveSection,
  removeItems,
  removeSection,
  renameSection,
  setSpan,
  type Board,
  type MasonryParams,
} from '@/model';
import { useBoard } from '@/store/boardStore';
import { useEditor } from '@/store/editorStore';
import { Button } from '@/ui/Button';
import { ArrowLeftIcon, TrashIcon } from '@/ui/icons';
import { Segmented } from '@/ui/Segmented';

// Contextual inspector (blueprint §8): board settings without a selection,
// card settings with one. M6 extends it; the structure stays.

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-medium tracking-wide text-muted uppercase">{label}</span>
      {children}
      {hint && <span className="text-[12px] leading-snug text-faint">{hint}</span>}
    </div>
  );
}

function masonryParams(board: Board): MasonryParams {
  return board.layouts.masonry?.params ?? DEFAULT_MASONRY_PARAMS;
}

function BoardSettings({ board }: { board: Board }) {
  const t = useT();
  const update = useBoard((s) => s.update);
  const params = masonryParams(board);
  const setParams = (patch: Partial<MasonryParams>) =>
    update((b) => Object.assign(layoutState(b, 'masonry').params, patch));

  return (
    <div className="flex flex-col gap-6">
      <Field label={t('inspector.columns')}>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[13px]">
            <input
              type="checkbox"
              checked={params.columns === 'auto'}
              onChange={(e) => setParams({ columns: e.target.checked ? 'auto' : 4 })}
              className="accent-(--vb-accent)"
            />
            {t('inspector.auto')}
          </label>
          <input
            type="range"
            min={1}
            max={MAX_COLUMNS}
            value={params.columns === 'auto' ? 4 : params.columns}
            disabled={params.columns === 'auto'}
            aria-label={t('inspector.columns')}
            onChange={(e) => setParams({ columns: Number(e.target.value) })}
            className="min-w-0 flex-1 accent-(--vb-accent) disabled:opacity-40"
          />
          <span className="w-4 text-right text-[13px] tabular-nums">{params.columns === 'auto' ? '–' : params.columns}</span>
        </div>
      </Field>

      <Field label={t('inspector.gap')}>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={48}
            step={2}
            value={board.theme.gap}
            aria-label={t('inspector.gap')}
            onChange={(e) => update((b) => void (b.theme.gap = Number(e.target.value)))}
            className="min-w-0 flex-1 accent-(--vb-accent)"
          />
          <span className="w-6 text-right text-[13px] tabular-nums">{board.theme.gap}</span>
        </div>
      </Field>

      <Field label={t('inspector.monthDividers')} hint={t('inspector.monthDividersHint')}>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={params.monthDividers}
            onChange={(e) => setParams({ monthDividers: e.target.checked })}
            className="accent-(--vb-accent)"
          />
          {t('inspector.monthDividers')}
        </label>
      </Field>

      <Field label={t('inspector.sections')}>
        <ul className="flex flex-col gap-1.5">
          {board.sections.map((section, i) => (
            <li key={section.id} className="flex items-center gap-1">
              <input
                value={section.title}
                placeholder={t('wall.untitledSection')}
                aria-label={t('wall.sectionTitle')}
                onChange={(e) => update((b) => renameSection(b, section.id, e.target.value))}
                className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-[13px]"
              />
              <button
                type="button"
                aria-label={t('inspector.moveUp')}
                disabled={i === 0}
                onClick={() => update((b) => moveSection(b, section.id, -1))}
                className="rounded p-1 text-muted hover:text-ink disabled:opacity-30"
              >
                <ArrowLeftIcon size={14} className="rotate-90" />
              </button>
              <button
                type="button"
                aria-label={t('inspector.moveDown')}
                disabled={i === board.sections.length - 1}
                onClick={() => update((b) => moveSection(b, section.id, 1))}
                className="rounded p-1 text-muted hover:text-ink disabled:opacity-30"
              >
                <ArrowLeftIcon size={14} className="-rotate-90" />
              </button>
              <button
                type="button"
                aria-label={t('inspector.deleteSection')}
                onClick={() => update((b) => removeSection(b, section.id))}
                className="rounded p-1 text-muted hover:text-danger"
              >
                <TrashIcon size={14} />
              </button>
            </li>
          ))}
        </ul>
        <Button size="sm" onClick={() => update((b) => void addSection(b, t('inspector.newSection')))}>
          {t('inspector.addSection')}
        </Button>
      </Field>
    </div>
  );
}

function CardSettings({ board, ids }: { board: Board; ids: string[] }) {
  const t = useT();
  const update = useBoard((s) => s.update);
  const overrides = board.layouts.masonry?.overrides ?? {};
  const spans = new Set(ids.map((id) => overrides[id]?.span ?? 1));
  const span = spans.size === 1 ? String([...spans][0]) : '';

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[13px] font-medium">{t('inspector.selected', { count: ids.length })}</p>
      <Field label={t('inspector.width')}>
        <Segmented
          label={t('inspector.width')}
          value={span}
          onChange={(v) => update((b) => setSpan(b, 'masonry', ids, Number(v) as 1 | 2 | 3))}
          options={(['1', '2', '3'] as const).map((n) => [n, t('inspector.span', { count: Number(n) })])}
        />
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
    </div>
  );
}

export function Inspector() {
  const t = useT();
  const board = useBoard((s) => s.board);
  const selected = useEditor((s) => s.selected);
  if (!board) return null;
  const ids = board.items.filter((i) => selected.has(i.id)).map((i) => i.id);
  return (
    <section aria-label={ids.length ? t('inspector.selected', { count: ids.length }) : t('inspector.board')} className="p-4">
      {ids.length ? <CardSettings board={board} ids={ids} /> : <BoardSettings board={board} />}
    </section>
  );
}
