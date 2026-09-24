import { useT } from '@/i18n';
import { useUpload } from '@/store/uploadStore';
import { Button } from '@/ui/Button';

/** "37/120" progress with cancel; the editor stays usable underneath. */
export function UploadProgress() {
  const t = useT();
  const { active, done, total, cancel } = useUpload();
  if (!active) return null;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div
      role="status"
      className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-4 z-50 flex sm:top-auto sm:bottom-[max(1rem,env(safe-area-inset-bottom))] w-[min(320px,calc(100vw-2rem))] items-center gap-3 rounded-lg border border-line bg-surface py-2 pr-2 pl-4 shadow-lifted"
    >
      <div className="min-w-0 flex-1">
        <div className="flex justify-between text-[13px]">
          <span>{t('upload.progress')}</span>
          <span className="tabular-nums text-muted" data-testid="upload-count">
            {done}/{total}
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-accent transition-[width] duration-(--vb-base)" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={cancel}>
        {t('common.cancel')}
      </Button>
    </div>
  );
}
