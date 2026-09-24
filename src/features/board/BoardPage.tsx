import { useEffect, useState } from 'react';
import { hrefFor } from '@/app/router';
import { getRepos } from '@/data/repos';
import { useT } from '@/i18n';
import type { Board } from '@/model';

type State = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; board: Board };

export function BoardPage({ boardId }: { boardId: string }) {
  const t = useT();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    void getRepos()
      .boards.get(boardId)
      .then((board) => alive && setState(board ? { status: 'ready', board } : { status: 'missing' }));
    return () => {
      alive = false;
    };
  }, [boardId]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-4 border-b border-line px-4 py-3">
        <a href={hrefFor({ name: 'dashboard' })} className="text-muted hover:text-ink">
          ← {t('board.back')}
        </a>
        {state.status === 'ready' && <h1 className="font-serif text-lg">{state.board.title}</h1>}
      </header>
      {state.status === 'missing' && <p className="p-8 text-muted">{t('board.notFound')}</p>}
    </div>
  );
}
