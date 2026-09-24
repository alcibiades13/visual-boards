import { DecodeError, processImage, type ProcessedImage } from './process';
import type { WorkerRequest, WorkerResponse } from './protocol';

const IDLE_TIMEOUT = 15_000;

interface Job {
  id: number;
  blob: Blob;
  resolve(result: ProcessedImage): void;
  reject(error: Error): void;
}

interface Slot {
  worker: Worker;
  job?: Job;
}

function workersSupported(): boolean {
  return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
}

/**
 * A small pool of image workers (at most 4 in parallel, blueprint §7).
 * Workers start lazily and are terminated after a period of inactivity.
 */
export class ImagePool {
  private slots: Slot[] = [];
  private queue: Job[] = [];
  private nextId = 1;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly size: number;

  constructor(size = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 4) - 1))) {
    this.size = size;
  }

  process(blob: Blob): Promise<ProcessedImage> {
    if (!workersSupported()) return processImage(blob); // old browsers: main thread
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, blob, resolve, reject });
      this.pump();
    });
  }

  private pump() {
    clearTimeout(this.idleTimer);
    while (this.queue.length) {
      let slot = this.slots.find((s) => !s.job);
      if (!slot && this.slots.length < this.size) slot = this.spawn();
      if (!slot) return;
      const job = this.queue.shift()!;
      slot.job = job;
      const request: WorkerRequest = { id: job.id, blob: job.blob };
      slot.worker.postMessage(request);
    }
    if (this.slots.every((s) => !s.job)) {
      this.idleTimer = setTimeout(() => this.terminate(), IDLE_TIMEOUT);
    }
  }

  private spawn(): Slot {
    const worker = new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module' });
    const slot: Slot = { worker };
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const job = slot.job;
      slot.job = undefined;
      if (job) {
        const data = event.data;
        if (data.ok) job.resolve(data.result);
        else job.reject(data.code === 'decode' ? new DecodeError(data.message) : new Error(data.message));
      }
      this.pump();
    };
    worker.onerror = (event) => {
      event.preventDefault();
      const job = slot.job;
      this.slots = this.slots.filter((s) => s !== slot);
      worker.terminate();
      job?.reject(new Error(event.message || 'Image worker crashed'));
      this.pump();
    };
    this.slots.push(slot);
    return slot;
  }

  terminate() {
    for (const slot of this.slots) slot.worker.terminate();
    this.slots = [];
  }
}

let shared: ImagePool | undefined;
export function getImagePool(): ImagePool {
  shared ??= new ImagePool();
  return shared;
}
