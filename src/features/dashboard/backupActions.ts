import { BackupFormatError, exportBackup, importBackup, type ImportMode } from '@/data/backup';
import { getRepos } from '@/data/repos';
import { translate, useLocale, type MessageKey } from '@/i18n';
import { flushBoard } from '@/store/boardStore';
import { useLibrary } from '@/store/libraryStore';
import { toast } from '@/store/toastStore';
import { downloadBlob } from '@/ui/download';

const t = (key: MessageKey, vars?: Record<string, number | string>) => translate(useLocale.getState().locale, key, vars);

export async function runExport(): Promise<void> {
  toast(t('backup.exporting'));
  await flushBoard();
  const { blob, fileName } = await exportBackup();
  downloadBlob(blob, fileName);
  toast(t('backup.exported'));
}

/** Imports a backup file. Returns false when the user has to pick merge or replace first. */
export async function needsImportChoice(): Promise<boolean> {
  return !(await getRepos().backup.isEmpty());
}

export async function runImport(file: File, mode: ImportMode): Promise<boolean> {
  try {
    await flushBoard();
    const summary = await importBackup(file, mode);
    await useLibrary.getState().load();
    toast(t('backup.imported', { ...summary }));
    return true;
  } catch (error) {
    console.error(error);
    toast(t(error instanceof BackupFormatError ? 'backup.invalid' : 'backup.failed'), 'error');
    return false;
  }
}
