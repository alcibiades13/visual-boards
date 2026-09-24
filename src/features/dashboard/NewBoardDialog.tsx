import { useState } from 'react';
import { navigate } from '@/app/router';
import { getRepos } from '@/data/repos';
import { useT, type MessageKey } from '@/i18n';
import { createBoard, PRESETS, type BoardPreset } from '@/model';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';

type StartPreset = Extract<BoardPreset, 'wall' | 'vision' | 'moodboard' | 'blank'>;
const STARTS: StartPreset[] = ['wall', 'vision', 'moodboard', 'blank'];

/** Tiny sketch of each starting arrangement, drawn with the theme colors. */
function PresetSketch({ preset }: { preset: StartPreset }) {
  const block = 'rounded-[2px] bg-faint/45';
  switch (preset) {
    case 'wall':
      return (
        <div className="grid h-full grid-cols-3 gap-1">
          {[['h-7', 'h-4', 'h-6'], ['h-4', 'h-8', 'h-5'], ['h-6', 'h-5', 'h-4']].map((col, i) => (
            <div key={i} className="flex flex-col gap-1">
              {col.map((h, j) => (
                <div key={j} className={`${block} ${h}`} />
              ))}
            </div>
          ))}
        </div>
      );
    case 'vision':
      return (
        <div className="grid h-full grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="h-1 w-3/4 rounded-full bg-muted/60" />
              <div className={`${block} h-5`} />
              <div className={`${block} h-4`} />
            </div>
          ))}
        </div>
      );
    case 'moodboard':
      return (
        <div className="relative h-full">
          <div className={`${block} absolute top-1 left-1 h-9 w-10 -rotate-3`} />
          <div className={`${block} absolute top-3 left-10 h-8 w-12 rotate-2`} />
          <div className={`${block} absolute top-10 left-4 h-5 w-9 rotate-1`} />
          <div className={`${block} absolute top-9 right-2 h-6 w-7 -rotate-2`} />
        </div>
      );
    case 'blank':
      return <div className="h-full rounded-[3px] border border-dashed border-faint/70" />;
  }
}

export function NewBoardDialog({ onClose }: { onClose(): void }) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [preset, setPreset] = useState<StartPreset>('wall');
  const sectionKeys = PRESETS.vision.sections;
  const [sections, setSections] = useState<string[]>(sectionKeys);

  const create = async () => {
    const board = createBoard({
      title: title.trim() || t('dashboard.untitled'),
      preset,
      sectionTitles: preset === 'vision' ? sections.map((key) => t(`section.${key}` as MessageKey)) : [],
    });
    await getRepos().boards.put(board);
    onClose();
    navigate({ name: 'board', boardId: board.id });
  };

  return (
    <Modal
      title={t('newBoard.title')}
      onClose={onClose}
      size="medium"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" type="submit" form="new-board">
            {t('newBoard.create')}
          </Button>
        </>
      }
    >
      <form
        id="new-board"
        className="mx-auto flex max-w-3xl flex-col gap-6 p-0.5 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted">{t('newBoard.name')}</span>
          <input
            data-autofocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('newBoard.namePlaceholder')}
            className="h-12 rounded-lg border border-line bg-bg px-3 font-serif text-2xl placeholder:text-faint"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="pb-1.5 text-[13px] text-muted">{t('newBoard.start')}</legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {STARTS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={preset === p}
                onClick={() => setPreset(p)}
                onDoubleClick={() => void create()}
                className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3 text-left transition-[border-color,box-shadow] duration-(--vb-fast) hover:border-faint aria-checked:border-ink aria-checked:shadow-soft"
              >
                <div className="h-20 overflow-hidden rounded-md bg-bg p-2">
                  <PresetSketch preset={p} />
                </div>
                <span className="font-medium">{t(`preset.${p}`)}</span>
                <span className="text-[12px] leading-snug text-muted">{t(`preset.${p}.body`)}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {preset === 'vision' && (
          <fieldset>
            <legend className="pb-2 text-[13px] text-muted">{t('newBoard.sections')}</legend>
            <div className="flex flex-wrap gap-2">
              {sectionKeys.map((key) => {
                const on = sections.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSections(on ? sections.filter((s) => s !== key) : sectionKeys.filter((s) => s === key || sections.includes(s)))}
                    className="rounded-full border border-line px-3 py-1 text-[13px] text-muted transition-colors duration-(--vb-fast) aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
                  >
                    {t(`section.${key}` as MessageKey)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
