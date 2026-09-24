import { create } from 'zustand';

interface ConfirmRequest {
  title: string;
  body?: string;
  confirmLabel: string;
  danger?: boolean;
  resolve(ok: boolean): void;
}

export const useConfirmStore = create<{ request: ConfirmRequest | null }>(() => ({ request: null }));

/** Promise-based confirmation dialog rendered by <ConfirmHost />. */
export function confirmDialog(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.setState({ request: { ...opts, resolve } }));
}
