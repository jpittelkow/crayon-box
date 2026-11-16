import { describe, expect, it } from 'vitest';
import { SIDE_PADDING, WHEEL_INNER, WHEEL_OUTER, WHEEL_PX, segmentCentre, wheelFits } from './wheel';

/** The coloring screen's room at a window size, as session.ts measures it (16 px screen padding and gaps). */
function room(width: number, height: number) {
  const inner = height - 32;
  const h = inner - 100 - 20 - 10 - 8; // tray, its gap, the page's outline and ledge
  const sideWithout = 216 + 2 * SIDE_PADDING; // three 64 px swatches and two 12 px gaps
  return {
    centreWithout: width - 32 - 116 - 2 * 16 - sideWithout,
    sideWithout,
    sideWith: WHEEL_PX + 2 * SIDE_PADDING,
    pageByHeight: Math.floor((h * 4) / 3),
    pageChrome: 10,
    sideHeight: inner,
    swatchesHeight: 8 * 64 + 7 * 12,
  };
}

describe('the colour wheel (ADR 0038 part 5)', () => {
  it('shows on the family laptop at 1920 × 1080 without the page getting smaller', () => {
    expect(wheelFits(room(1920, 1080))).toBe(true);
  });

  it('is hidden where it would shrink the page or not fit the height', () => {
    expect(wheelFits(room(1280, 800))).toBe(false); // the reference screen: no spare width
    expect(wheelFits(room(1536, 864))).toBe(false); // 1920 × 1080 at 125 % display scale: not the height
    expect(wheelFits(room(1700, 1080))).toBe(false); // the page would lose width
    expect(wheelFits(room(2560, 1440))).toBe(true);
  });

  it('gives every segment a 64 px tap circle, like a swatch', () => {
    for (let i = 0; i < 12; i++) {
      const c = segmentCentre(i);
      const r = Math.round(Math.hypot(c.x, c.y) * 1000) / 1000;
      expect(r - 32).toBeGreaterThanOrEqual(WHEEL_INNER);
      expect(r + 32).toBeLessThanOrEqual(WHEEL_OUTER);
      // Distance from the centre to the segment's straight sides, 15° either way.
      expect(r * Math.sin(Math.PI / 12)).toBeGreaterThanOrEqual(32);
    }
    expect(2 * WHEEL_OUTER).toBeLessThanOrEqual(WHEEL_PX - 10);
  });
});
