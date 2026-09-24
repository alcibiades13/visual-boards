import { useEffect, useState } from 'react';
import { hrefFor } from '@/app/router';
import { getRepos } from '@/data/repos';
import { useT } from '@/i18n';
import type { Board } from '@/model';
import { LocaleSwitch } from '@/ui/LocaleSwitch';

export function Dashboard() {
  const t = useT();
  const [boards, setBoards] = useState<Board[] | null>(null);

  useEffect(() => {
    let alive = true;
    void getRepos()
      .boards.list()
      .then((list) => alive && setBoards(list));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 sm:px-8">
      <header className="flex items-center justify-between py-5">
        <span className="font-serif text-lg tracking-tight">{t('app.name')}</span>
        <nav className="flex items-center gap-4">
          <a href={hrefFor({ name: 'library' })} className="text-muted transition-colors hover:text-ink">
            {t('nav.library')}
          </a>
          <LocaleSwitch />
        </nav>
      </header>

      <main className="flex flex-1 flex-col pb-16">
        <h1 className="mt-6 font-serif text-3xl font-normal tracking-tight sm:mt-10 sm:text-4xl">
          {t('dashboard.title')}
        </h1>

        {boards && boards.length === 0 && (
          <div className="mt-16 max-w-md self-center text-center sm:mt-24">
            <p className="font-serif text-2xl italic text-ink">{t('dashboard.empty.title')}</p>
            <p className="mt-3 text-muted">{t('dashboard.empty.body')}</p>
            <p className="mt-8 font-serif text-muted italic">{t('app.tagline')}</p>
          </div>
        )}

        {boards && boards.length > 0 && (
          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <li key={board.id}>
                <a
                  href={hrefFor({ name: 'board', boardId: board.id })}
                  className="block rounded-lg border border-line bg-surface p-5 transition-shadow duration-(--vb-base) hover:shadow-soft"
                >
                  <span className="font-serif text-xl">{board.title}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
