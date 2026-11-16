import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PALETTE, RAINBOW, WHEEL } from './palette';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function token(name: string): string | undefined {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return match?.[1].trim();
}

describe('palette', () => {
  it('has 23 colors plus rainbow, rainbow last (ADR 0003, 0016)', () => {
    expect(PALETTE).toHaveLength(24);
    expect(PALETTE.at(-1)?.value).toBe(RAINBOW);
    expect(PALETTE.filter((c) => c.value === RAINBOW)).toHaveLength(1);
  });

  it('matches the --crayon-* tokens', () => {
    for (const color of PALETTE) {
      if (color.value === RAINBOW) continue;
      let value = token(`crayon-${color.token}`);
      if (value === 'var(--ink)') value = token('ink');
      expect(value, color.token).toBe(color.value);
    }
  });

  it('has a 12-colour wheel of hues the rail lacks, each said with a shipped colour name (ADR 0038)', () => {
    expect(WHEEL).toHaveLength(12);
    const rail = new Set(PALETTE.map((c) => c.value));
    const tokens = new Set(PALETTE.map((c) => c.token));
    for (const color of WHEEL) {
      expect(token(`crayon-wheel-${color.token}`), color.token).toBe(color.value);
      expect(rail.has(color.value), color.token).toBe(false);
      expect(tokens.has(color.says), color.token).toBe(true);
      expect(color.says).not.toBe(RAINBOW);
    }
    expect(new Set(WHEEL.map((c) => c.value)).size).toBe(12);
    expect(new Set(WHEEL.map((c) => c.token)).size).toBe(12);
  });
});
