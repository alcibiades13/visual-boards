// Debounced persistence (blueprint §10): coalesce rapid changes into one write
// ~500ms later, and write immediately when the page is hidden or unloaded so
// closing the tab right after an edit does not lose it.

export interface Saver<T> {
  schedule(value: T): void;
  flush(): Promise<void>;
  dispose(): void;
}

export function createSaver<T>(save: (value: T) => Promise<void>, delay = 500): Saver<T> {
  let pending: { value: T } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inflight: Promise<void> = Promise.resolve();

  const flush = (): Promise<void> => {
    clearTimeout(timer);
    timer = undefined;
    if (pending) {
      const { value } = pending;
      pending = null;
      // Writes are chained so an older state never lands after a newer one.
      inflight = inflight.then(() => save(value)).catch((error: unknown) => console.error('Autosave failed', error));
    }
    return inflight;
  };

  const onHide = () => {
    if (document.visibilityState === 'hidden') void flush();
  };
  const onPageHide = () => void flush();
  if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
  }

  return {
    schedule(value) {
      pending = { value };
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), delay);
    },
    flush,
    dispose() {
      if (typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', onHide);
        window.removeEventListener('pagehide', onPageHide);
      }
      void flush();
    },
  };
}
