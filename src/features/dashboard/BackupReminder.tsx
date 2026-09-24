import { useEffect, useState } from 'react';
import { BACKUP_SNOOZE_KEY, LAST_BACKUP_KEY, shouldRemindBackup } from '@/data/backup';
import { getRepos } from '@/data/repos';
import { useFormatRelative, useT } from '@/i18n';
import type { Board } from '@/model';
import { useLibrary } from '@/store/libraryStore';
import { Button } from '@/ui/Button';
import { runExport } from './backupActions';

const SNOOZE_DAYS = 7;

function extremes(dates: string[]): { first?: string; last?: string } {
  if (!dates.length) return {};
  const sorted = [...dates].sort();
  return { first: sorted[0], last: sorted[sorted.length - 1] };
}

export function BackupReminder({ boards }: { boards: Board[] }) {
  const t = useT();
  const relative = useFormatRelative();
  const assets = useLibrary((s) => s.assets);
  const quotes = useLibrary((s) => s.quotes);
  const [state, setState] = useState<{ lastBackupAt?: string; snoozedUntil?: string } | null>(null);

  useEffect(() => {
    const meta = getRepos().meta;
    void Promise.all([meta.get<string>(LAST_BACKUP_KEY), meta.get<string>(BACKUP_SNOOZE_KEY)]).then(
      ([lastBackupAt, snoozedUntil]) => setState({ lastBackupAt, snoozedUntil }),
    );
  }, []);

  if (!state) return null;
  const { first, last } = extremes([
    ...boards.flatMap((b) => [b.createdAt, b.updatedAt]),
    ...assets.map((a) => a.createdAt),
    ...quotes.map((q) => q.createdAt),
  ]);
  const show = shouldRemindBackup({ now: new Date(), ...state, firstContentAt: first, lastChangeAt: last });
  if (!show) return null;

  const snooze = () => {
    const until = new Date(Date.now() + SNOOZE_DAYS * 86_400_000).toISOString();
    setState({ ...state, snoozedUntil: until });
    void getRepos().meta.set(BACKUP_SNOOZE_KEY, until);
  };

  return (
    <div role="note" className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
      <p className="min-w-0 flex-1 text-[13px] text-muted">
        {state.lastBackupAt ? t('backup.reminder', { when: relative(state.lastBackupAt) }) : t('backup.reminderNever')}
      </p>
      <Button variant="ghost" size="sm" onClick={snooze}>
        {t('backup.reminderLater')}
      </Button>
      <Button
        size="sm"
        onClick={() =>
          void runExport().then(() => setState({ ...state, lastBackupAt: new Date().toISOString() }))
        }
      >
        {t('backup.reminderAction')}
      </Button>
    </div>
  );
}
