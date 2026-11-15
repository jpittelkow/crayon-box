import { describe, expect, it } from 'vitest';
import type { GameStorage } from '../../storage/types';
import { RING } from './maps/ring';
import { VEHICLES, carColors, loadKidDriving, saveKidDriving } from './settings';
import { makeWorld } from './sim/sim';

/** A store kept in a map, enough for the driving game's settings. */
function fakeStorage(): GameStorage {
  const items = new Map<string, unknown>();
  return {
    getJson: async <T>(path: string) => items.get(path) as T | undefined,
    putJson: async (path, value) => void items.set(path, structuredClone(value)),
    getBlob: async () => undefined,
    putBlob: async () => {},
    list: async (prefix) => [...items.keys()].filter((k) => k.startsWith(prefix)).sort(),
    delete: async (path) => void items.delete(path),
  };
}

describe('the vehicle picker (milestone-3 B5)', () => {
  it('remembers each kid\'s vehicle, starting with the car, and ignores a vehicle it doesn\'t know', async () => {
    const storage = fakeStorage();
    expect(await loadKidDriving(storage, 'kid-a')).toEqual({ assist: 'free', vehicle: 'car', map: 'island' });
    await saveKidDriving(storage, 'kid-a', { assist: 'road', vehicle: 'bus', map: 'site' });
    expect(await loadKidDriving(storage, 'kid-a')).toEqual({ assist: 'road', vehicle: 'bus', map: 'site' });
    expect((await loadKidDriving(storage, 'kid-b')).vehicle).toBe('car');
    await storage.putJson('kids/kid-c/driving.json', { vehicle: 'spaceship' });
    expect((await loadKidDriving(storage, 'kid-c')).vehicle).toBe('car');
  });

  it('remembers the vehicle colour picked (playtest, 2026-11-15), and offers the kid\'s own first', async () => {
    const storage = fakeStorage();
    await saveKidDriving(storage, 'kid-a', { assist: 'free', vehicle: 'car', map: 'island', color: '#2b2b2b' });
    expect((await loadKidDriving(storage, 'kid-a')).color).toBe('#2b2b2b');
    await storage.putJson('kids/kid-b/driving.json', { color: 'url(x)' });
    expect((await loadKidDriving(storage, 'kid-b')).color).toBeUndefined();
    // The kid's own first; the crayon orange is too like a kid's orange to show as well.
    expect(carColors('#ff9f1c')).toEqual(['#ff9f1c', '#f23b2f', '#ffd23f', '#2fa35f', '#3a86ff', '#9b5de5', '#ff70a6', '#2b2b2b']);
    // A kid whose own colour is in the list sees it once.
    const blue = carColors('#3A86FF');
    expect(blue[0]).toBe('#3A86FF');
    expect(blue.filter((c) => c.toLowerCase() === '#3a86ff')).toHaveLength(1);
    expect(new Set(blue).size).toBe(8);
    // Every kid colour gets eight that look different.
    for (const own of ['#ff9f1c', '#ff6b9d', '#9b5de5', '#44b87b', '#3a86ff', '#12b5b0']) expect(carColors(own)).toHaveLength(8);
  });

  it('the kid drives the vehicle picked; traffic keeps the others, with the car standing in for it', () => {
    for (const kind of VEHICLES) {
      const w = makeWorld(7, 0, 'free', RING, kind);
      const traffic = w.cars.slice(1).map((c) => c.kind);
      expect(w.cars[0]!.kind).toBe(kind);
      expect(traffic).not.toContain(kind);
      expect(traffic).toHaveLength(RING.traffic.length);
    }
  });
});
