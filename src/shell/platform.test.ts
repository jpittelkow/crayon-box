import { describe, expect, it } from 'vitest';
import { inTauri } from './platform';

describe('inTauri', () => {
  it('is false in a plain browser window', () => {
    expect(inTauri({})).toBe(false);
  });

  it('is true when Tauri has put its bridge on the page', () => {
    expect(inTauri({ __TAURI_INTERNALS__: {} })).toBe(true);
    expect(inTauri({ isTauri: true })).toBe(true);
  });

  it('is false under node, where the unit tests run', () => {
    expect(inTauri()).toBe(false);
  });
});
