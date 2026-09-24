// Image processing shared by the worker and the main-thread fallback (blueprint §7):
// EXIF orientation via createImageBitmap, resize, WebP (JPEG fallback), thumbnail.

export const FULL_MAX = 2400;
export const THUMB_MAX = 640;
const FULL_QUALITY = 0.85;
const THUMB_QUALITY = 0.8;

export interface ProcessedImage {
  width: number;
  height: number;
  full: Blob;
  thumb: Blob;
}

export class DecodeError extends Error {}

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type AnyContext = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function makeCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function toBlob(canvas: AnyCanvas, type: string, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed'))), type, quality),
  );
}

/** Encodes as WebP; browsers without a WebP encoder return PNG, so fall back to JPEG. */
async function encode(canvas: AnyCanvas, quality: number): Promise<Blob> {
  const webp = await toBlob(canvas, 'image/webp', quality);
  if (webp.type === 'image/webp') return webp;
  return toBlob(canvas, 'image/jpeg', quality);
}

export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function draw(source: CanvasImageSource, width: number, height: number): AnyCanvas {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d') as AnyContext | null;
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

export async function processImage(blob: Blob): Promise<ProcessedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch (error) {
    throw new DecodeError(error instanceof Error ? error.message : 'Cannot decode image');
  }
  try {
    const size = fitWithin(bitmap.width, bitmap.height, FULL_MAX);
    const fullCanvas = draw(bitmap, size.width, size.height);
    const thumbSize = fitWithin(size.width, size.height, THUMB_MAX);
    // Downscale from the already-resized canvas: sharper and cheaper than from the original.
    const thumbCanvas = draw(fullCanvas, thumbSize.width, thumbSize.height);
    const [full, thumb] = await Promise.all([encode(fullCanvas, FULL_QUALITY), encode(thumbCanvas, THUMB_QUALITY)]);
    return { width: size.width, height: size.height, full, thumb };
  } finally {
    bitmap.close();
  }
}
