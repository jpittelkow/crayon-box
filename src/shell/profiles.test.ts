import { describe, expect, it } from 'vitest';
import { memoryBackend } from '../storage/idb';
import { deviceInfo, randomId } from '../storage/ids';
import { appStorage } from '../storage/namespaced';
import {
  DEFAULT_PROFILES,
  KID_COLORS,
  deleteProfile,
  getPhoto,
  kidLabel,
  loadProfiles,
  loadShellSettings,
  newKidId,
  newProfile,
  normalizeProfile,
  putPhoto,
  saveProfile,
} from './profiles';

const jpg = (byte: number) => new Blob([new Uint8Array([byte])], { type: 'image/jpeg' });

describe('profiles', () => {
  it('start with three symbol-only kids', async () => {
    const shell = appStorage(memoryBackend()).shell;
    const kids = await loadProfiles(shell);
    expect(kids).toEqual(DEFAULT_PROFILES);
    expect(kids.every((k) => k.name === undefined)).toBe(true);
    // Loading again reads the same three back, in the same order.
    expect((await loadProfiles(shell)).map((k) => k.id)).toEqual(['star', 'heart', 'moon']);
  });

  it('upgrade profiles saved before symbols were separate from ids', () => {
    expect(normalizeProfile({ id: 'heart', color: 'purple', startMode: 'lines' })).toEqual({
      id: 'heart',
      symbol: 'heart',
      color: 'purple',
      startMode: 'lines',
      created: '2000-01-01T00:00:01.000Z',
    });
  });

  it('keep a trimmed name and the photo flag', async () => {
    const shell = appStorage(memoryBackend()).shell;
    await loadProfiles(shell);
    await saveProfile(shell, { ...DEFAULT_PROFILES[0], name: '  Sample  ', hasPhoto: true });
    const [kid] = await loadProfiles(shell);
    expect(kid.name).toBe('Sample');
    expect(kid.hasPhoto).toBe(true);
    expect(kidLabel(kid)).toBe('Sample');
  });

  it('fall back to the symbol name as a label', () => {
    expect(kidLabel(DEFAULT_PROFILES[1])).toBe('Heart');
  });

  it('get ids that never carry a name', () => {
    expect(newKidId(() => 0)).toBe('kid-00000000');
    expect(newKidId()).toMatch(/^kid-[0-9a-z]{8}$/);
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

describe('profiles and sync (ADR 0024)', () => {
  it('keep each kid in a file of its own, so saving one never rewrites another', async () => {
    const backend = memoryBackend();
    const shell = appStorage(backend).shell;
    await loadProfiles(shell);
    const before = await backend.meta('shell/kids/heart/profile.json');
    await saveProfile(shell, { ...DEFAULT_PROFILES[0], name: 'Sample' });
    expect(await backend.meta('shell/kids/heart/profile.json')).toEqual(before);
    expect((await backend.meta('shell/kids/star/profile.json'))?.modified).toBeGreaterThan(0);
  });

  it('mark the starting profiles as defaults that any real change beats', async () => {
    const backend = memoryBackend();
    await loadProfiles(appStorage(backend).shell);
    for (const id of ['star', 'heart', 'moon']) {
      expect(await backend.meta(`shell/kids/${id}/profile.json`)).toEqual({ modified: 0 });
    }
  });

  it('add new kids after the existing ones', async () => {
    const shell = appStorage(memoryBackend()).shell;
    const kids = await loadProfiles(shell);
    const added = newProfile(kids);
    await saveProfile(shell, added);
    expect((await loadProfiles(shell)).map((k) => k.id)).toEqual(['star', 'heart', 'moon', added.id]);
  });

  it('delete a kid with their photo, and remember the deletion', async () => {
    const backend = memoryBackend();
    const shell = appStorage(backend).shell;
    await loadProfiles(shell);
    await putPhoto(shell, 'moon', jpg(1));
    await saveProfile(shell, { ...DEFAULT_PROFILES[2], hasPhoto: true });
    await deleteProfile(shell, 'moon');
    expect((await loadProfiles(shell)).map((k) => k.id)).toEqual(['star', 'heart']);
    expect((await backend.meta('shell/kids/moon/profile.json'))?.deleted).toBe(true);
    expect((await backend.meta('shell/kids/moon/photo.jpg'))?.deleted).toBe(true);
  });

  it('move profiles and photos from the first build into per-kid folders, keeping their order', async () => {
    const shell = appStorage(memoryBackend()).shell;
    await shell.putJson('profiles.json', [
      { id: 'moon', color: 'teal', startMode: 'lines' },
      { id: 'kid-abc123', symbol: 'sun', color: 'green', startMode: 'free', name: 'Sample', hasPhoto: true },
    ]);
    await shell.putBlob('photos/kid-abc123.jpg', jpg(9));

    const kids = await loadProfiles(shell);
    expect(kids.map((k) => k.id)).toEqual(['moon', 'kid-abc123']);
    expect(kids[1]).toMatchObject({ name: 'Sample', symbol: 'sun', hasPhoto: true });
    expect(kids[0].startMode).toBe('lines');
    const photo = await getPhoto(shell, kids[1]);
    expect([...new Uint8Array(await photo!.arrayBuffer())]).toEqual([9]);
    expect(await shell.getJson('profiles.json')).toBeUndefined();
    expect(await shell.list('photos/')).toEqual([]);
    // The move happens once; the next load reads the new files.
    expect((await loadProfiles(shell)).map((k) => k.id)).toEqual(['moon', 'kid-abc123']);
  });
});

describe('ids across devices (ADR 0024)', () => {
  it('are random characters from 0-9 and a-z', () => {
    expect(randomId()).toMatch(/^[0-9a-z]{8}$/);
    expect(randomId(4)).toHaveLength(4);
    expect(new Set(Array.from({ length: 200 }, () => randomId())).size).toBe(200);
  });

  it('give each device an id of its own that is kept and never synced', async () => {
    const backend = memoryBackend();
    const shell = appStorage(backend).shell;
    const first = await deviceInfo(shell);
    expect(first.id).toMatch(/^dev-[0-9a-z]{8}$/);
    expect(await deviceInfo(shell)).toEqual(first);
    expect((await backend.changes()).map((c) => c.key)).not.toContain('shell/local/device.json');

    const other = await deviceInfo(appStorage(memoryBackend()).shell);
    expect(other.id).not.toBe(first.id);
  });
});
