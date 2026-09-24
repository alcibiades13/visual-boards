import { useCallback, useEffect, useMemo, useState } from 'react';
import { hrefFor } from '@/app/router';
import { getRepos } from '@/data/repos';
import { useT } from '@/i18n';
import { duplicateBoard, type Board } from '@/model';
import { useLibrary } from '@/store/libraryStore';
import { Button } from '@/ui/Button';
import { confirmDialog } from '@/ui/confirmStore';
import { PlusIcon } from '@/ui/icons';
import { LocaleSwitch } from '@/ui/LocaleSwitch';
import { BackupControls } from './BackupControls';
import { BackupReminder } from './BackupReminder';
import { BoardCard } from './BoardCard';
import { NewBoardDialog } from './NewBoardDialog';

export function Dashboard() {
  const t = useT();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [creating, setCreating] = useState(false);
  const assets = useLibrary((s) => s.assets);
  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const reload = useCallback(async () => setBoards(await getRepos().boards.list()), []);
  useEffect(() => {
    let alive = true;
    void getRepos()
      .boards.list()
      .then((list) => alive && setBoards(list));
    return () => {
      alive = false;
    };
  }, []);

  const rename = async (board: Board, title: string) => {
    await getRepos().boards.put({ ...board, title, updatedAt: new Date().toISOString() });
    await reload();
  };
  const duplicate = async (board: Board) => {
    await getRepos().boards.put(duplicateBoard(board, t('dashboard.copyOf', { title: board.title })));
    await reload();
  };
  const remove = async (board: Board) => {
    const ok = await confirmDialog({
      title: t('dashboard.deleteTitle', { title: board.title }),
      body: t('dashboard.deleteBody'),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    await getRepos().boards.delete(board.id);
    await reload();
  };

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-5">
        <span className="font-serif text-lg tracking-tight">{t('app.name')}</span>
        <nav className="flex items-center gap-4">
          <a href={hrefFor({ name: 'library' })} className="text-muted transition-colors hover:text-ink">
            {t('nav.library')}
          </a>
          <BackupControls onImported={() => void reload()} />
          <LocaleSwitch />
        </nav>
      </header>

      <main className="flex flex-1 flex-col pb-16">
        <div className="mt-6 flex items-end justify-between gap-4 sm:mt-10">
          <h1 className="font-serif text-3xl font-normal tracking-tight sm:text-4xl">{t('dashboard.title')}</h1>
          {boards && boards.length > 0 && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <PlusIcon size={16} />
              {t('dashboard.new')}
            </Button>
          )}
        </div>

        {boards && <BackupReminder boards={boards} />}

        {boards && boards.length === 0 && (
          <div className="mt-16 max-w-md self-center text-center sm:mt-24">
            <p className="font-serif text-2xl text-ink italic">{t('dashboard.empty.title')}</p>
            <p className="mt-3 text-muted">{t('dashboard.empty.body')}</p>
            <Button variant="primary" className="mt-8" onClick={() => setCreating(true)}>
              <PlusIcon size={16} />
              {t('dashboard.new')}
            </Button>
            <p className="mt-10 font-serif text-muted italic">{t('app.tagline')}</p>
          </div>
        )}

        {boards && boards.length > 0 && (
          <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                assets={assetMap}
                onRename={(title) => void rename(board, title)}
                onDuplicate={() => void duplicate(board)}
                onDelete={() => void remove(board)}
              />
            ))}
          </div>
        )}
      </main>

      {creating && <NewBoardDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
