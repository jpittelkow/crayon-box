import { describe, expect, it } from 'vitest';
import { isEditingShortcut } from './guards';

const key = (k: string, mods: Partial<Record<'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey', boolean>> = {}) => ({
  key: k,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  shiftKey: false,
  ...mods,
});

describe('the parent area’s editing shortcuts', () => {
  it('lets paste, cut, select all and undo through in a text box', () => {
    for (const k of ['v', 'V', 'x', 'a', 'z', 'y', 'ArrowLeft', 'Backspace', 'Insert']) {
      expect(isEditingShortcut(key(k, { ctrlKey: true }), true)).toBe(true);
    }
    expect(isEditingShortcut(key('z', { ctrlKey: true, shiftKey: true }), true)).toBe(true);
  });

  it('lets copy through anywhere, but paste only in a text box', () => {
    expect(isEditingShortcut(key('c', { ctrlKey: true }), false)).toBe(true);
    expect(isEditingShortcut(key('v', { ctrlKey: true }), false)).toBe(false);
  });

  it('keeps the browser shortcuts blocked', () => {
    for (const k of ['p', 'r', 'f', 'w', 'n', 't', 's', 'l', '+']) {
      expect(isEditingShortcut(key(k, { ctrlKey: true }), true)).toBe(false);
    }
    expect(isEditingShortcut(key('v', { ctrlKey: true, altKey: true }), true)).toBe(false);
    expect(isEditingShortcut(key('ArrowLeft', { altKey: true }), true)).toBe(false);
    expect(isEditingShortcut(key('v', { metaKey: true }), true)).toBe(false);
  });
});
