import { describe, expect, it } from 'vitest';
import { memoryBackend } from '../storage/idb';
import { appStorage } from '../storage/namespaced';
import { hashPin, isValidPin, loadGateSettings, pinMatches, saveGateSettings } from './gatePin';

describe('gate PIN', () => {
  it('is off until a parent sets one', async () => {
    expect(await loadGateSettings(appStorage(memoryBackend()).shell)).toEqual({});
  });

  it('is four digits', () => {
    expect(isValidPin('0427')).toBe(true);
    expect(isValidPin('427')).toBe(false);
    expect(isValidPin('04a7')).toBe(false);
    expect(isValidPin('04271')).toBe(false);
  });

  it('is stored only as a hash, which the right PIN matches', async () => {
    const shell = appStorage(memoryBackend()).shell;
    const pinHash = await hashPin('5831');
    await saveGateSettings(shell, { pinHash });
    const saved = await loadGateSettings(shell);
    expect(JSON.stringify(saved)).not.toContain('5831');
    expect(saved.pinHash).toMatch(/^[0-9a-f]{64}$/);
    expect(await pinMatches('5831', saved.pinHash!)).toBe(true);
    expect(await pinMatches('5832', saved.pinHash!)).toBe(false);
  });
});
