import { useRef, useState } from 'react';
import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { Menu } from '@/ui/Menu';
import { Modal } from '@/ui/Modal';
import { needsImportChoice, runExport, runImport } from './backupActions';

export function BackupControls({ onImported }: { onImported(): void }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [choice, setChoice] = useState<File | null>(null);

  const start = async (file: File) => {
    if (await needsImportChoice()) setChoice(file);
    else if (await runImport(file, 'replace')) onImported();
  };
  const finish = async (mode: 'merge' | 'replace') => {
    const file = choice;
    setChoice(null);
    if (file && (await runImport(file, mode))) onImported();
  };

  return (
    <>
      <Menu
        items={[
          { label: t('backup.export'), onSelect: () => void runExport() },
          { label: t('backup.import'), onSelect: () => input.current?.click() },
        ]}
        trigger={(props) => (
          <button type="button" className="text-muted transition-colors hover:text-ink" {...props}>
            {t('backup.menu')}
          </button>
        )}
      />
      <input
        ref={input}
        type="file"
        accept=".zip,application/zip"
        hidden
        data-testid="backup-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void start(file);
        }}
      />
      {choice && (
        <Modal
          title={t('backup.importTitle')}
          onClose={() => setChoice(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setChoice(null)}>
                {t('common.cancel')}
              </Button>
              <Button variant="danger" onClick={() => void finish('replace')}>
                {t('backup.replace')}
              </Button>
              <Button variant="primary" onClick={() => void finish('merge')} data-autofocus>
                {t('backup.merge')}
              </Button>
            </>
          }
        >
          <p className="text-muted">{t('backup.importBody')}</p>
        </Modal>
      )}
    </>
  );
}
