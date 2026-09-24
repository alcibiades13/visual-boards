// Backup reminder (blueprint §9): shown on the dashboard when there are changes
// that are not in a backup and the last backup (or the first content, if there
// was never one) is more than 30 days old.

export const REMIND_AFTER_DAYS = 30;
const DAY = 86_400_000;

export interface ReminderInput {
  now: Date;
  lastBackupAt?: string;
  snoozedUntil?: string;
  firstContentAt?: string;
  lastChangeAt?: string;
}

export function shouldRemindBackup({ now, lastBackupAt, snoozedUntil, firstContentAt, lastChangeAt }: ReminderInput): boolean {
  if (!lastChangeAt) return false; // nothing stored yet
  if (snoozedUntil && Date.parse(snoozedUntil) > now.getTime()) return false;
  if (lastBackupAt && Date.parse(lastChangeAt) <= Date.parse(lastBackupAt)) return false;
  const since = lastBackupAt ?? firstContentAt ?? lastChangeAt;
  return now.getTime() - Date.parse(since) > REMIND_AFTER_DAYS * DAY;
}
