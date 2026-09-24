import { useEffect, useRef } from 'react';
import { hrefFor } from '@/app/router';
import { LibraryPanel } from '@/features/library/LibraryPanel';
import { useT } from '@/i18n';
import { useBoard } from '@/store/boardStore';
import { LIBRARY_MAX_WIDTH, LIBRARY_MIN_WIDTH, useEditor } from '@/store/editorStore';
import { useIntake } from '@/store/intakeStore';
import { ArrowLeftIcon, CloseIcon, SidebarIcon, SlidersIcon } from '@/ui/icons';
import { DESKTOP, useMediaQuery } from '@/ui/useMediaQuery';
import { uploadToBoard } from './actions';
import { EditorDnd } from './EditorDnd';
import { Inspector } from './Inspector';
import { Wall } from './Wall';

function BoardTitle() {
  const t = useT();
  const title = useBoard((s) => s.board?.title ?? '');
  const update = useBoard((s) => s.update);
  return (
    <input
      value={title}
      aria-label={t('dashboard.titleLabel')}
      onChange={(e) => update((b) => void (b.title = e.target.value))}
      onBlur={(e) => !e.target.value.trim() && update((b) => void (b.title = t('dashboard.untitled')))}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className="field-sizing-content max-w-full min-w-24 truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-serif text-lg hover:border-line focus:border-line"
    />
  );
}

/** Vertical handle that resizes the library sidebar by dragging. */
function ResizeHandle() {
  const t = useT();
  const width = useEditor((s) => s.libraryWidth);
  const start = useRef<{ x: number; width: number } | null>(null);
  const set = (w: number) => useEditor.getState().set({ libraryWidth: Math.max(LIBRARY_MIN_WIDTH, Math.min(LIBRARY_MAX_WIDTH, w)) });
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t('editor.resizeLibrary')}
      aria-valuenow={width}
      aria-valuemin={LIBRARY_MIN_WIDTH}
      aria-valuemax={LIBRARY_MAX_WIDTH}
      tabIndex={0}
      className="group relative w-1.5 shrink-0 cursor-col-resize"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, width };
      }}
      onPointerMove={(e) => start.current && set(start.current.width + e.clientX - start.current.x)}
      onPointerUp={() => (start.current = null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') set(width - 20);
        if (e.key === 'ArrowRight') set(width + 20);
      }}
    >
      <div className="absolute inset-y-0 left-0.5 w-px bg-line transition-colors group-hover:bg-faint" />
    </div>
  );
}

function Editor() {
  const t = useT();
  const desktop = useMediaQuery(DESKTOP);
  const libraryOpen = useEditor((s) => s.libraryOpen);
  const libraryWidth = useEditor((s) => s.libraryWidth);
  const settingsOpen = useEditor((s) => s.settingsOpen);
  const fileInput = useRef<HTMLInputElement>(null);
  const setEditor = useEditor((s) => s.set);

  // Pasted images go onto this board too (blueprint §7).
  useEffect(() => {
    useIntake.getState().setTarget((files) => uploadToBoard(files));
    return () => useIntake.getState().setTarget(null);
  }, []);

  // Esc clears the card selection anywhere in the editor, except inside fields and dialogs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [role="dialog"], [role="menu"]')) return;
      useEditor.getState().clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Drawers start closed on smaller screens.
  useEffect(() => {
    if (!desktop) setEditor({ libraryOpen: false, settingsOpen: false });
    else setEditor({ libraryOpen: true });
  }, [desktop, setEditor]);

  return (
    <EditorDnd>
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-2 border-b border-line bg-bg px-2 py-2 sm:px-3">
          <a
            href={hrefFor({ name: 'dashboard' })}
            className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-muted hover:text-ink"
            aria-label={t('board.back')}
          >
            <ArrowLeftIcon size={16} />
            <span className="hidden sm:inline">{t('board.back')}</span>
          </a>
          <div className="min-w-0 flex-1">
            <BoardTitle />
          </div>
          <button
            type="button"
            aria-pressed={libraryOpen}
            aria-label={t('editor.library')}
            onClick={() => setEditor({ libraryOpen: !libraryOpen, settingsOpen: false })}
            className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-muted hover:bg-surface-2 hover:text-ink aria-pressed:text-ink"
            title={desktop && libraryOpen ? t('editor.hideLibrary') : t('editor.library')}
          >
            <SidebarIcon size={17} />
            <span className="hidden sm:inline">{t('editor.library')}</span>
          </button>
          {!desktop && (
            <button
              type="button"
              aria-pressed={settingsOpen}
              aria-label={t('editor.settings')}
              onClick={() => setEditor({ settingsOpen: !settingsOpen, libraryOpen: false })}
              className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-muted hover:bg-surface-2 hover:text-ink aria-pressed:text-ink"
            >
              <SlidersIcon size={17} />
              <span className="hidden sm:inline">{t('editor.settings')}</span>
            </button>
          )}
        </header>

        <div className="relative flex min-h-0 flex-1">
          {libraryOpen &&
            (desktop ? (
              <>
                <aside className="flex min-h-0 shrink-0 flex-col bg-bg px-3 pt-2" style={{ width: libraryWidth }}>
                  <LibraryPanel />
                </aside>
                <ResizeHandle />
              </>
            ) : (
              <aside
                className="absolute inset-y-0 left-0 z-20 flex w-full max-w-[380px] flex-col border-r border-line bg-bg px-3 pt-2 shadow-lifted"
                aria-label={t('editor.library')}
              >
                <div className="flex items-center justify-between pb-1">
                  <span className="font-serif text-lg">{t('editor.library')}</span>
                  <button
                    type="button"
                    aria-label={t('common.close')}
                    onClick={() => setEditor({ libraryOpen: false })}
                    className="rounded-md p-1.5 text-muted hover:text-ink"
                  >
                    <CloseIcon />
                  </button>
                </div>
                <LibraryPanel />
              </aside>
            ))}

          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Wall onUploadRequest={() => fileInput.current?.click()} />
          </main>

          {desktop ? (
            <aside className="w-[280px] shrink-0 overflow-y-auto border-l border-line bg-bg" aria-label={t('editor.settings')}>
              <Inspector />
            </aside>
          ) : (
            settingsOpen && (
              <aside
                className="absolute inset-x-0 bottom-0 z-20 max-h-[75%] overflow-y-auto rounded-t-xl border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] shadow-lifted sm:inset-x-auto sm:top-0 sm:right-0 sm:bottom-0 sm:max-h-none sm:w-[320px] sm:rounded-none sm:border-t-0 sm:border-l"
                aria-label={t('editor.settings')}
              >
                <div className="flex items-center justify-between px-4 pt-3">
                  <span className="font-serif text-lg">{t('editor.settings')}</span>
                  <button
                    type="button"
                    aria-label={t('common.close')}
                    onClick={() => setEditor({ settingsOpen: false })}
                    className="rounded-md p-1.5 text-muted hover:text-ink"
                  >
                    <CloseIcon />
                  </button>
                </div>
                <Inspector />
              </aside>
            )
          )}
        </div>

        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/*,.heic,.heif"
          hidden
          data-testid="board-upload-input"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            uploadToBoard(files);
          }}
        />
      </div>
    </EditorDnd>
  );
}

export function BoardPage({ boardId }: { boardId: string }) {
  const t = useT();
  const status = useBoard((s) => s.status);

  useEffect(() => {
    void useBoard.getState().open(boardId);
    useEditor.getState().clear();
    return () => void useBoard.getState().close();
  }, [boardId]);

  if (status === 'missing') {
    return (
      <div className="flex h-full flex-col">
        <header className="border-b border-line px-3 py-2">
          <a href={hrefFor({ name: 'dashboard' })} className="flex items-center gap-1.5 px-1.5 py-1 text-muted hover:text-ink">
            <ArrowLeftIcon size={16} />
            {t('board.back')}
          </a>
        </header>
        <p className="p-8 text-muted">{t('board.notFound')}</p>
      </div>
    );
  }
  return status === 'ready' ? <Editor /> : null;
}
