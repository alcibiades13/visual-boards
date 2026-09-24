import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  /** 'dialog' is a small centered box; 'wide' fills most of the screen. Both become a sheet on phones. */
  size?: 'dialog' | 'wide';
}

export function Modal({ title, onClose, children, footer, size = 'dialog' }: ModalProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, button');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, []);

  const box =
    size === 'wide'
      ? 'h-[92dvh] w-full sm:h-[min(820px,90dvh)] sm:w-[min(1100px,94vw)]'
      : 'max-h-[85dvh] w-full sm:w-[440px]';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex flex-col overflow-hidden rounded-t-xl border border-line bg-surface shadow-lifted sm:rounded-xl ${box}`}
      >
        <h2 id={titleId} className="px-5 pt-5 pb-2 font-serif text-xl">
          {title}
        </h2>
        <div className="min-h-0 flex-1 overflow-auto px-5 pb-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
