import { useEffect, useRef, useState } from 'react';
import { useT } from '@/i18n';
import { toast } from '@/store/toastStore';
import { useIntake } from '@/store/intakeStore';
import { useUpload } from '@/store/uploadStore';
import { UploadIcon } from '@/ui/icons';
import { fetchRemoteImage, filesFromDataTransfer, isImageDrag, remoteImageUrl } from './dataTransfer';

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}

/**
 * App-wide intake (blueprint §7): drop files or folders anywhere in the window,
 * drag an image from another tab, or paste an image with Ctrl/Cmd+V.
 * Drops handled by a more specific target (e.g. the board) call preventDefault
 * and stopPropagation, so they never reach this handler.
 */
export function GlobalDrop() {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    const start = useUpload.getState().start;

    const onDragEnter = (e: DragEvent) => {
      if (!isImageDrag(e.dataTransfer)) return;
      e.preventDefault();
      depth.current += 1;
      // In the editor the board shows where a drop will land; no full-window overlay.
      setVisible(!useIntake.getState().target);
    };
    const onDragOver = (e: DragEvent) => {
      if (!isImageDrag(e.dataTransfer)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setVisible(false);
    };
    const onDrop = async (e: DragEvent) => {
      depth.current = 0;
      setVisible(false);
      const dt = e.dataTransfer;
      if (!dt || !isImageDrag(dt)) return;
      e.preventDefault();
      const url = dt.files.length ? null : remoteImageUrl(dt);
      const files = await filesFromDataTransfer(dt);
      if (files.length) return start(files);
      if (!url) return;
      try {
        start([await fetchRemoteImage(url)]);
      } catch {
        toast(t('drop.remoteFailed'), 'error');
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      // Text fields keep normal text paste, but a pasted image still goes to the library.
      if (isEditable(e.target) && e.clipboardData?.types.includes('text/plain')) return;
      e.preventDefault();
      const named = files.map((f, i) =>
        f.name && f.name !== 'image.png' ? f : new File([f], `pasted-${Date.now()}-${i}.png`, { type: f.type }),
      );
      const target = useIntake.getState().target;
      if (target) target(named);
      else start(named);
    };

    // Drops handled by the board never bubble here; reset the overlay anyway.
    const onAnyDrop = () => {
      depth.current = 0;
      setVisible(false);
    };
    window.addEventListener('drop', onAnyDrop, true);
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('drop', onAnyDrop, true);
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
    };
  }, [t]);

  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-bg/80 p-6 backdrop-blur-sm">
      <div className="flex w-full max-w-lg flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent px-8 py-14 text-center">
        <UploadIcon size={28} className="text-accent" />
        <p className="font-serif text-2xl">{t('drop.title')}</p>
        <p className="text-muted">{t('drop.body')}</p>
      </div>
    </div>
  );
}
