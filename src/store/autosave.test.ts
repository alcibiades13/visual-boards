import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSaver } from './autosave';

describe('createSaver', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('coalesces rapid changes into one write after the delay', async () => {
    const save = vi.fn(async (_v: number) => {});
    const saver = createSaver(save, 500);
    saver.schedule(1);
    await vi.advanceTimersByTimeAsync(300);
    saver.schedule(2);
    saver.schedule(3);
    await vi.advanceTimersByTimeAsync(499);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save.mock.calls).toEqual([[3]]);
    saver.dispose();
  });

  it('flush writes immediately and only once', async () => {
    const save = vi.fn(async (_v: string) => {});
    const saver = createSaver(save, 500);
    saver.schedule('a');
    await saver.flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save.mock.calls).toEqual([['a']]);
    saver.dispose();
  });

  it('keeps writes in order even when a save is slow', async () => {
    const order: number[] = [];
    const saver = createSaver(async (v: number) => {
      await new Promise((r) => setTimeout(r, v === 1 ? 100 : 1));
      order.push(v);
    }, 10);
    saver.schedule(1);
    void saver.flush();
    saver.schedule(2);
    await vi.advanceTimersByTimeAsync(500);
    expect(order).toEqual([1, 2]);
    saver.dispose();
  });
});
