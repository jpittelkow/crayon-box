import { describe, expect, it } from 'vitest';
import type { KidProfile } from '../../shell/types';
import { memoryBackend } from '../../storage/idb';
import { appStorage } from '../../storage/namespaced';
import {
  deletePicture,
  findPicture,
  forgetKid,
  getPaint,
  hasPrevious,
  keepPreviousVersion,
  listPictures,
  newPicture,
  restorePrevious,
  savePicture,
} from './pictures';

const star: KidProfile = { id: 'star', symbol: 'star', color: 'orange', startMode: 'free' };
const heart: KidProfile = { id: 'heart', symbol: 'heart', color: 'purple', startMode: 'lines' };
const png = (byte: number) => new Blob([new Uint8Array([byte])], { type: 'image/png' });

describe('pictures', () => {
  it("start in the kid's starting mode", () => {
    expect(newPicture(star, 'builtin:shapes/x').meta.mode).toBe('free');
    expect(newPicture(heart, 'builtin:shapes/x').meta.mode).toBe('lines');
  });

  it('are found again by page, per kid', async () => {
    const storage = appStorage(memoryBackend()).game('coloring');
    const pic = newPicture(star, 'builtin:under-the-sea/fish');
    await savePicture(storage, pic, png(1));
    expect((await findPicture(storage, 'star', 'builtin:under-the-sea/fish'))?.id).toBe(pic.id);
    expect(await findPicture(storage, 'heart', 'builtin:under-the-sea/fish')).toBeUndefined();
    expect(await findPicture(storage, 'star', 'builtin:race-cars/zoomy-car')).toBeUndefined();
  });

  it('keep the mode with the picture', async () => {
    const storage = appStorage(memoryBackend()).game('coloring');
    const pic = newPicture(star, 'builtin:shapes/x');
    pic.meta.mode = 'lines';
    await savePicture(storage, pic, null);
    expect((await listPictures(storage, 'star'))[0].meta.mode).toBe('lines');
  });

  it('keep the previous version when reopened', async () => {
    const storage = appStorage(memoryBackend()).game('coloring');
    const pic = newPicture(star, 'builtin:shapes/x');
    await savePicture(storage, pic, png(7));
    const paint = await keepPreviousVersion(storage, pic);
    expect(paint).toBeDefined();
    const prev = await storage.getBlob(`art/star/${pic.id}/prev.png`);
    expect([...new Uint8Array(await prev!.arrayBuffer())]).toEqual([7]);
    await savePicture(storage, pic, png(8));
    expect([...new Uint8Array(await (await getPaint(storage, pic))!.arrayBuffer())]).toEqual([8]);
    const stillPrev = await storage.getBlob(`art/star/${pic.id}/prev.png`);
    expect([...new Uint8Array(await stillPrev!.arrayBuffer())]).toEqual([7]);
  });

  it('of the same page can be many (ADR 0017)', async () => {
    const storage = appStorage(memoryBackend()).game('coloring');
    const a = newPicture(star, 'builtin:shapes/x', new Date('2026-11-14T10:00:00Z'));
    const b = newPicture(star, 'builtin:shapes/x', new Date('2026-11-14T10:00:01Z'));
    expect(a.id).not.toBe(b.id);
    await savePicture(storage, a, png(1));
    await savePicture(storage, b, png(2));
    expect(await listPictures(storage, 'star')).toHaveLength(2);
  });

  it('restore swaps the previous and current versions', async () => {
    const storage = appStorage(memoryBackend()).game('coloring');
    const pic = newPicture(star, 'builtin:shapes/x');
    await savePicture(storage, pic, png(1));
    expect(await hasPrevious(storage, pic)).toBe(false);
    expect(await restorePrevious(storage, pic)).toBe(false);
    await keepPreviousVersion(storage, pic);
    await savePicture(storage, pic, png(2));
    expect(await restorePrevious(storage, pic)).toBe(true);
    const bytes = async (b: Blob | undefined) => [...new Uint8Array(await b!.arrayBuffer())];
    expect(await bytes(await getPaint(storage, pic))).toEqual([1]);
    expect(await bytes(await storage.getBlob(`art/star/${pic.id}/prev.png`))).toEqual([2]);
  });

  it('are deleted one at a time, or all of a kid at once', async () => {
    const storage = appStorage(memoryBackend()).game('coloring');
    const a = newPicture(star, 'builtin:shapes/x', new Date(1));
    const b = newPicture(star, 'builtin:shapes/y', new Date(2));
    const c = newPicture(heart, 'builtin:shapes/x', new Date(3));
    for (const p of [a, b, c]) await savePicture(storage, p, png(1));
    await deletePicture(storage, a);
    expect((await listPictures(storage, 'star')).map((p) => p.id)).toEqual([b.id]);
    await forgetKid(storage, 'star');
    expect(await listPictures(storage, 'star')).toEqual([]);
    expect(await listPictures(storage, 'heart')).toHaveLength(1);
  });
});
