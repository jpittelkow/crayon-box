// Turning a file into a page (ADR 0005, milestone 2 phase F): a PNG, JPG, SVG or the first page of a PDF is drawn
// to pixels, run through the clean-up step (black lines on white, specks gone, small gaps closed, fitted to the
// page) and the page check, and saved as page.png. Runs in the parent area and on the Windows app's Pages folder.
import { cleanUpLineArt, PAGE_H, PAGE_W } from './engine/cleanup';
import { checkPage, type PageCheckResult } from './engine/pageCheck';

/** Files the import takes. */
export const IMPORT_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf'] as const;
export const IMPORT_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.pdf'] as const;
export const IMPORT_ACCEPT = [...IMPORT_TYPES, ...IMPORT_EXTENSIONS].join(',');

/** The longest side a source is drawn at before clean-up: enough detail for a 2048-wide page, not more. */
const MAX_SIDE = 3000;

export interface Raster {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface CleanedPage {
  png: Blob;
  check: PageCheckResult;
  /** For a preview canvas. */
  rgba: Uint8ClampedArray<ArrayBuffer>;
}

export class ImportProblem extends Error {}

/** What kind of file this is, from its type or its name. */
export function kindOf(name: string, type: string): 'raster' | 'svg' | 'pdf' | null {
  const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
  if (type === 'application/pdf' || ext === '.pdf') return 'pdf';
  if (type === 'image/svg+xml' || ext === '.svg') return 'svg';
  if (type === 'image/png' || type === 'image/jpeg' || ['.png', '.jpg', '.jpeg'].includes(ext)) return 'raster';
  return null;
}

/** The page's title from a file name: `my-dragon_scan.png` → `My dragon scan`. */
export function titleFromName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base ? base[0].toUpperCase() + base.slice(1) : 'Our page';
}

function fit(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function canvasOf(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  // White paper under anything transparent.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

function read(ctx: CanvasRenderingContext2D, width: number, height: number): Raster {
  return { rgba: ctx.getImageData(0, 0, width, height).data, width, height };
}

async function rasterImage(blob: Blob): Promise<Raster> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new ImportProblem('That picture couldn’t be opened. Try a PNG or JPG.');
  }
  const size = fit(bitmap.width, bitmap.height);
  const { ctx } = canvasOf(size.width, size.height);
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  return read(ctx, size.width, size.height);
}

async function rasterSvg(blob: Blob): Promise<Raster> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new ImportProblem('That SVG couldn’t be opened.');
    }
    // Vector art: drawn at whatever scale fills the page. One without a size of its own gets the page's size.
    const nw = img.naturalWidth || PAGE_W;
    const nh = img.naturalHeight || PAGE_H;
    const scale = Math.min(PAGE_W / nw, PAGE_H / nh);
    const w = Math.max(1, Math.round(nw * scale));
    const h = Math.max(1, Math.round(nh * scale));
    const { ctx } = canvasOf(w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return read(ctx, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function rasterPdf(blob: Blob): Promise<Raster> {
  // pdf.js loads only for PDFs, in the parent area.
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
  } catch {
    throw new ImportProblem('That PDF couldn’t be opened.');
  }
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(4, MAX_SIDE / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const w = Math.round(viewport.width);
    const h = Math.round(viewport.height);
    const { ctx } = canvasOf(w, h);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return read(ctx, w, h);
  } finally {
    void doc.destroy();
  }
}

/** Draws any accepted file to pixels. */
export async function rasterize(name: string, blob: Blob): Promise<Raster> {
  const kind = kindOf(name, blob.type);
  if (kind === 'pdf') return rasterPdf(blob);
  if (kind === 'svg') return rasterSvg(blob);
  if (kind === 'raster') return rasterImage(blob);
  throw new ImportProblem('Pages can be made from PNG, JPG, SVG or PDF files.');
}

/** The clean-up step and the page check, and the result as page.png. */
export async function cleanUp(raster: Raster): Promise<CleanedPage> {
  const result = cleanUpLineArt(raster.rgba, raster.width, raster.height);
  const check = checkPage(result.ink, result.width, result.height);
  if (!result.ink.some((v) => v === 1)) throw new ImportProblem('No lines were found. Pages need dark lines on a light background.');
  const { canvas, ctx } = canvasOf(result.width, result.height);
  ctx.putImageData(new ImageData(result.rgba, result.width, result.height), 0, 0);
  const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!png) throw new ImportProblem('The page couldn’t be saved.');
  return { png, check, rgba: result.rgba };
}

/** A file in, a cleaned page out. */
export async function importFile(name: string, blob: Blob): Promise<CleanedPage> {
  return cleanUp(await rasterize(name, blob));
}
