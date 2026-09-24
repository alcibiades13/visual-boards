import { useToasts } from '@/store/toastStore';
import { useT } from '@/i18n';
import { CloseIcon } from './icons';

export function Toasts() {
  const t = useT();
  const { toasts, dismiss } = useToasts();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] sm:top-auto sm:bottom-[max(1rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-lg bg-ink py-2 pr-2 pl-4 text-sm text-bg shadow-lifted ${toast.tone === 'error' ? 'ring-2 ring-danger' : ''}`}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={() => dismiss(toast.id)}
            className="rounded p-1 opacity-60 hover:opacity-100"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
