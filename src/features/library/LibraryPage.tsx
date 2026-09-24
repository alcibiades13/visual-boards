import { hrefFor } from '@/app/router';
import { useT } from '@/i18n';
import { ArrowLeftIcon } from '@/ui/icons';
import { LocaleSwitch } from '@/ui/LocaleSwitch';
import { LibraryPanel } from './LibraryPanel';

/** Full-page library. From M3 the same panel also sits beside the board. */
export function LibraryPage() {
  const t = useT();
  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col px-4 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-4">
        <a href={hrefFor({ name: 'dashboard' })} className="flex items-center gap-1.5 text-muted hover:text-ink">
          <ArrowLeftIcon size={16} />
          {t('board.back')}
        </a>
        <LocaleSwitch />
      </header>
      <h1 className="pb-4 font-serif text-3xl font-normal tracking-tight">{t('library.title')}</h1>
      <LibraryPanel />
    </div>
  );
}
