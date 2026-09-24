import { create } from 'zustand';
import { translate, useLocale } from '@/i18n';
import { isImageFile } from '@/images/sniff';
import { uploadImages, type UploadContext } from '@/images/upload';
import { useLibrary } from './libraryStore';
import { toast } from './toastStore';

// Tracks one upload "session": overlapping drops join the running session and
// share its counter ("37/120") and its cancel button.

interface UploadState {
  active: boolean;
  total: number;
  done: number;
  added: number;
  duplicates: number;
  failed: number;
  start(files: File[]): void;
  cancel(): void;
}

let session: { ctx: UploadContext; controller: AbortController } | null = null;
let running = 0;

function t(key: Parameters<typeof translate>[1], vars?: Record<string, number>) {
  return translate(useLocale.getState().locale, key, vars);
}

export const useUpload = create<UploadState>((set, get) => ({
  active: false,
  total: 0,
  done: 0,
  added: 0,
  duplicates: 0,
  failed: 0,

  start: (input) => {
    const files = input.filter(isImageFile);
    const skipped = input.length - files.length;
    if (skipped > 0) toast(t('upload.notImages', { count: skipped }));
    if (!files.length) return;

    if (!session) {
      const controller = new AbortController();
      session = { controller, ctx: { signal: controller.signal, seen: new Set() } };
      set({ active: true, total: 0, done: 0, added: 0, duplicates: 0, failed: 0 });
    }
    const { ctx } = session;
    set({ total: get().total + files.length });
    running += 1;

    void uploadImages(files, ctx, (outcome) => {
      const s = get();
      set({
        done: s.done + 1,
        added: s.added + (outcome.kind === 'added' ? 1 : 0),
        duplicates: s.duplicates + (outcome.kind === 'duplicate' ? 1 : 0),
        failed: s.failed + (outcome.kind === 'failed' ? 1 : 0),
      });
      if (outcome.kind === 'added') useLibrary.getState().assetAdded(outcome.asset);
      if (outcome.kind === 'failed') console.warn('Upload failed', outcome.fileName, outcome.reason);
    }).finally(() => {
      running -= 1;
      if (running > 0) return;
      const s = get();
      const cancelled = ctx.signal.aborted;
      session = null;
      set({ active: false });
      const parts = [t('upload.summary.added', { count: s.added })];
      if (s.duplicates) parts.push(t('upload.summary.duplicates', { count: s.duplicates }));
      if (s.failed) parts.push(t('upload.summary.failed', { count: s.failed }));
      if (cancelled) parts.push(t('upload.summary.cancelled'));
      toast(parts.join(' · '), s.failed ? 'error' : 'info');
    });
  },

  cancel: () => {
    session?.controller.abort();
  },
}));
