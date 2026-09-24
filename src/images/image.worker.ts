/// <reference lib="webworker" />
import { DecodeError, processImage } from './process';
import type { WorkerRequest, WorkerResponse } from './protocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, blob } = event.data;
  let response: WorkerResponse;
  try {
    response = { id, ok: true, result: await processImage(blob) };
  } catch (error) {
    response = {
      id,
      ok: false,
      code: error instanceof DecodeError ? 'decode' : 'other',
      message: error instanceof Error ? error.message : String(error),
    };
  }
  scope.postMessage(response);
};
