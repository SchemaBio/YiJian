import { LocalizedError } from '@/i18n/errors';
/** Convert IGV rendered tracks to a PNG; never store executable SVG. */
export async function igvSVGToPNG(svg: string): Promise<Blob> {
  const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  if (root.localName !== 'svg') throw new LocalizedError("display.invalidSnapshotContent4551f8");
  const width = Math.ceil(Number.parseFloat(root.getAttribute('width') || '0'));
  const height = Math.ceil(Number.parseFloat(root.getAttribute('height') || '0'));
  if (width < 1 || height < 1 || !Number.isFinite(width * height) || width > 8192 || height > 16384 || width * height > 40_000_000) throw new LocalizedError("display.snapshotDimensionsExceedTheLimitc6a00e");
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new LocalizedError("display.unableToGenerateSnapshot2d5187"));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new LocalizedError("display.unableToGenerateSnapshot2d5187");
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new LocalizedError("display.unableToGenerateSnapshot2d5187")), 'image/png'));
    if (png.size > 8 * 1024 * 1024) throw new LocalizedError("display.snapshotFileExceedsTheLimit556c72");
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}
