import { describe, expect, it } from 'vitest';
import { memoryBackend } from '../storage/idb';
import { appStorage } from '../storage/namespaced';
import {
  DEFAULT_PROFILES,
  KID_COLORS,
  kidLabel,
  loadProfiles,
  loadShellSettings,
  newKidId,
  newProfile,
  normalizeProfile,
  saveProfiles,
} from './profiles';

describe('profiles', () => {
  it('start with three symbol-only kids', async () => {
    const shell = appStorage(memoryBackend()).shell;
    const kids = await loadProfiles(shell);
    expect(kids).toEqual(DEFAULT_PROFILES);
    expect(kids.every((k) => k.name === undefined)).toBe(true);
  });

  it('upgrade profiles saved before symbols were separate from ids', () => {
    expect(normalizeProfile({ id: 'heart', color: 'purple', startMode: 'lines' })).toEqual({
      id: 'heart',
      symbol: 'heart',
      color: 'purple',
      startMode: 'lines',
    });
  });

  it('keep a trimmed name and the photo flag', async () => {
    const shell = appStorage(memoryBackend()).shell;
    await saveProfiles(shell, [{ ...DEFAULT_PROFILES[0], name: '  Sample  ', hasPhoto: true }]);
    const [kid] = await loadProfiles(shell);
    expect(kid.name).toBe('Sample');
    expect(kid.hasPhoto).toBe(true);
    expect(kidLabel(kid)).toBe('Sample');
  });

  it('fall back to the symbol name as a label', () => {
    expect(kidLabel(DEFAULT_PROFILES[1])).toBe('Heart');
  });

  it('get ids that never carry a name', () => {
    expect(newKidId(() => 0)).toBe('kid-000000');
    expect(newKidId()).toMatch(/^kid-[0-9a-z]{6}$/);
  });

  it('pick a color and symbol nobody else has', () => {
    const kid = newProfile(DEFAULT_PROFILES);
    expect(DEFAULT_PROFILES.map((k) => k.color)).not.toContain(kid.color);
    expect(DEFAULT_PROFILES.map((k) => k.symbol)).not.toContain(kid.symbol);
    expect(KID_COLORS).toContain(kid.color);
  });

  it('show names on the kid picker by default', async () => {
    expect((await loadShellSettings(appStorage(memoryBackend()).shell)).showNames).toBe(true);
  });
});
