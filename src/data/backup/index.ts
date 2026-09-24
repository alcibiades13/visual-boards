import { getRepos } from '../repos';
import { planMerge } from './merge';
import { readBackupZip, writeBackupZip } from './zip';

export { BackupFormatError } from './format';
export { shouldRemindBackup } from './reminder';

export const LAST_BACKUP_KEY = 'lastBackupAt';
export const BACKUP_SNOOZE_KEY = 'backupSnoozedUntil';

export async function exportBackup(): Promise<{ blob: Blob; fileName: string }> {
  const repos = getRepos();
  const now = new Date();
  const blob = await writeBackupZip(await repos.backup.snapshot(), now.toISOString());
  await repos.meta.set(LAST_BACKUP_KEY, now.toISOString());
  return { blob, fileName: `visual-boards-backup-${now.toISOString().slice(0, 10)}.zip` };
}

export type ImportMode = 'merge' | 'replace';

export interface ImportSummary {
  boards: number;
  images: number;
  quotes: number;
}

export async function importBackup(file: Blob, mode: ImportMode): Promise<ImportSummary> {
  const repos = getRepos();
  const incoming = await readBackupZip(file);
  if (mode === 'replace') {
    await repos.backup.replaceAll(incoming);
    return { boards: incoming.boards.length, images: incoming.assets.length, quotes: incoming.quotes.length };
  }
  const existing = await repos.backup.snapshot();
  const plan = planMerge(existing, incoming);
  await repos.backup.applyMerge(plan, incoming.blobs);
  return { boards: plan.boards.length, images: plan.assets.length, quotes: plan.quotes.length };
}
