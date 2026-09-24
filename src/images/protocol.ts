import type { ProcessedImage } from './process';

export interface WorkerRequest {
  id: number;
  blob: Blob;
}

export type WorkerResponse =
  | { id: number; ok: true; result: ProcessedImage }
  | { id: number; ok: false; code: 'decode' | 'other'; message: string };
