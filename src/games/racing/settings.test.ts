import { describe, expect, it } from 'vitest';
import type { GameStorage } from '../../storage/types';
import { RING } from './maps/ring';
import { VEHICLES, loadKidDriving, saveKidDriving } from './settings';
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
    expect(await loadKidDriving(storage, 'kid-a')).toEqual({ assist: 'free', vehicle: 'car' });
    await saveKidDriving(storage, 'kid-a', { assist: 'road', vehicle: 'bus' });
    expect(await loadKidDriving(storage, 'kid-a')).toEqual({ assist: 'road', vehicle: 'bus' });
    expect((await loadKidDriving(storage, 'kid-b')).vehicle).toBe('car');
    await storage.putJson('kids/kid-c/driving.json', { vehicle: 'spaceship' });
    expect((await loadKidDriving(storage, 'kid-c')).vehicle).toBe('car');
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
