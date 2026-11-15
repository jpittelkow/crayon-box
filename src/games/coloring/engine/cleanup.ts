// The clean-up step (ADR 0005): turns any picture of line art (a scan, a photo of a drawing, an AI image) into a
// page the bucket can fill: black lines on white, no specks, small gaps closed, at the page size. Used for
// AI-made built-in pages (ADR 0022), and later by import and the AI page maker (ADR 0005, 0006, 0023).
// Pure functions on pixel arrays, so they run in a worker, in a dev tool and in unit tests.
import { closeGaps, GAP_PX } from './pageCheck';
import { INK_RGB, labelRegions } from './regions';

export const PAGE_W = 2048;
export const PAGE_H = 1536;
/** Paper kept around the picture when it is fitted to the page. */
export const MARGIN_PX = 40;

export interface CleanupOptions {
  width?: number;
  height?: number;
  margin?: number;
  /** Close gaps up to this wide (ADR 0005: 6 px). */
  gap?: number;
  /** Ink blobs and paper holes smaller than this many pixels are noise. */
  speck?: number;
  /** Force a threshold (0..255) instead of picking one from the picture. */
  threshold?: number;
}

export interface CleanupResult {
  width: number;
  height: number;
  /** 1 for ink, 0 for paper. */
  ink: Uint8Array;
  /** RGBA, ink-colored lines on white, ready to save as page.png. */
  rgba: Uint8ClampedArray<ArrayBuffer>;
  threshold: number;
}

/** Luminance 0..255 with transparency treated as white paper. */
export function toGray(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i++) {
    const o = i * 4;
    const a = rgba[o + 3] / 255;
    const lum = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
    out[i] = Math.round(lum * a + 255 * (1 - a));
  }
  return out;
}

/**
 * Fits a grayscale picture inside `width` x `height` with `margin` of paper, keeping its shape, by bilinear
 * sampling. What is outside the picture is white.
 */
export function fitToPage(
  gray: Uint8Array,
  srcW: number,
  srcH: number,
  width = PAGE_W,
  height = PAGE_H,
  margin = MARGIN_PX,
): Uint8Array {
  const out = new Uint8Array(width * height).fill(255);
  const scale = Math.min((width - 2 * margin) / srcW, (height - 2 * margin) / srcH);
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const ox = Math.floor((width - w) / 2);
  const oy = Math.floor((height - h) / 2);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(srcH - 1, Math.max(0, (y + 0.5) / scale - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(srcH - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < w; x++) {
      const sx = Math.min(srcW - 1, Math.max(0, (x + 0.5) / scale - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const fx = sx - x0;
      const top = gray[y0 * srcW + x0] * (1 - fx) + gray[y0 * srcW + x1] * fx;
      const bottom = gray[y1 * srcW + x0] * (1 - fx) + gray[y1 * srcW + x1] * fx;
      out[(oy + y) * width + ox + x] = Math.round(top * (1 - fy) + bottom * fy);
    }
  }
  return out;
}

/** Otsu's method: the threshold that best splits the picture into two groups (ink and paper). */
export function otsuThreshold(gray: Uint8Array): number {
  const hist = new Float64Array(256);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let sumBack = 0;
  let weightBack = 0;
  let best = 0;
  let bestT = 128;
  for (let t = 0; t < 256; t++) {
    weightBack += hist[t];
    if (weightBack === 0) continue;
    const weightFore = total - weightBack;
    if (weightFore === 0) break;
    sumBack += t * hist[t];
    const meanBack = sumBack / weightBack;
    const meanFore = (sumAll - sumBack) / weightFore;
    const between = weightBack * weightFore * (meanBack - meanFore) ** 2;
    if (between > best) {
      best = between;
      bestT = t;
    }
  }
  // A blank or nearly blank picture has no real split; keep the middle so paper stays paper.
  return best === 0 ? 128 : bestT;
}

/** Removes ink blobs smaller than `speck` pixels, and fills paper holes smaller than that inside ink. */
export function removeSpecks(ink: Uint8Array, width: number, height: number, speck: number): Uint8Array {
  const out = ink.slice();
  // Ink blobs are the "regions" of the inverted mask.
  const paper = new Uint8Array(ink.length);
  for (let i = 0; i < ink.length; i++) paper[i] = ink[i] ? 0 : 1;
  const blobs = labelRegions(paper, width, height);
  for (let i = 0; i < out.length; i++) {
    const id = blobs.labels[i];
    if (id && blobs.areas[id] < speck) out[i] = 0;
  }
  // Paper holes: regions of the cleaned ink mask. The big outside is never small, so it is never filled.
  const holes = labelRegions(out, width, height);
  for (let i = 0; i < out.length; i++) {
    const id = holes.labels[i];
    if (id && holes.areas[id] < speck) out[i] = 1;
  }
  return out;
}

export function cleanUpLineArt(
  rgba: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  opts: CleanupOptions = {},
): CleanupResult {
  const width = opts.width ?? PAGE_W;
  const height = opts.height ?? PAGE_H;
  const source = toGray(rgba, srcW, srcH);
  // Picked from the picture itself: the white margin added when fitting would pull the split toward paper.
  const threshold = opts.threshold ?? otsuThreshold(source);
  const gray = fitToPage(source, srcW, srcH, width, height, opts.margin ?? MARGIN_PX);
  let ink: Uint8Array = new Uint8Array(width * height);
  for (let i = 0; i < ink.length; i++) ink[i] = gray[i] <= threshold ? 1 : 0;
  // Specks default to about 0.002% of the page: 63 px on a full page, so dots for eyes survive.
  ink = removeSpecks(ink, width, height, opts.speck ?? Math.max(4, Math.round(width * height * 0.00002)));
  ink = closeGaps(ink, width, height, opts.gap ?? GAP_PX);

  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < ink.length; i++) {
    const o = i * 4;
    if (ink[i]) {
      out[o] = INK_RGB[0];
      out[o + 1] = INK_RGB[1];
      out[o + 2] = INK_RGB[2];
    } else {
      out[o] = out[o + 1] = out[o + 2] = 255;
    }
    out[o + 3] = 255;
  }
  return { width, height, ink, rgba: out, threshold };
}
