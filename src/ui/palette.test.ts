import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PALETTE, RAINBOW } from './palette';

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
});
