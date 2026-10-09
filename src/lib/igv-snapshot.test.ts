import { afterEach, expect, it, vi } from 'vitest';
import { igvSVGToPNG } from './igv-snapshot';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('rejects invalid and excessively large images before allocating a canvas', async () => {
  for (const svg of ['<html/>', '<svg width="9000" height="10"/>', '<svg width="100" height="0"/>', '<svg width="8192" height="16384"/>']) await expect(igvSVGToPNG(svg)).rejects.toThrow();
});
it('renders a white PNG and releases the temporary SVG URL', async () => {
  const revoke = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:test'), revokeObjectURL: revoke });
  vi.stubGlobal('Image', class { onload?: () => void; set src(_value: string) { queueMicrotask(() => this.onload?.()); } });
  const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const png = new Blob(['png'], { type: 'image/png' });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(png));
  expect(await igvSVGToPNG('<svg width="100" height="50" xmlns="http://www.w3.org/2000/svg"/>')).toBe(png);
  expect(context.fillStyle).toBe('#fff');
  expect(context.fillRect).toHaveBeenCalledWith(0, 0, 100, 50);
  expect(context.drawImage).toHaveBeenCalled();
  expect(revoke).toHaveBeenCalledWith('blob:test');
});
