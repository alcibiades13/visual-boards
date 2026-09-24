// File-type detection from the first bytes; file.type is often empty for HEIC.

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);
const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|bmp|heic|heif|tiff?)$/i;

export function isHeicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  return ascii(4, 8) === 'ftyp' && HEIC_BRANDS.has(ascii(8, 12));
}

export function isHeicFile(file: { name: string; type: string }): boolean {
  return /image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

export function isImageFile(file: { name: string; type: string }): boolean {
  if (file.type.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.test(file.name);
}
