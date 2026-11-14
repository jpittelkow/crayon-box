import { describe, expect, it } from 'vitest';
import type { KidProfile } from '../../shell/types';
import { memoryBackend } from '../../storage/idb';
import { appStorage } from '../../storage/namespaced';
import { findPicture, getPaint, keepPreviousVersion, listPictures, newPicture, savePicture } from './pictures';

const star: KidProfile = { id: 'star', color: 'orange', startMode: 'free' };
const heart: KidProfile = { id: 'heart', color: 'purple', startMode: 'lines' };
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
});
