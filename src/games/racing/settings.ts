// What the driving game keeps (ADR 0021): per kid, the assist level; for the game, whether its sounds play.
import type { GameStorage } from '../../storage/types';
import type { Assist } from './sim/sim';

export interface KidDriving {
  /** Steers freely (the default) or follows the road. Set by a parent. */
  assist: Assist;
}

export interface DrivingSettings {
  sounds: boolean;
}

const kidDir = (kidId: string) => `kids/${kidId}/`;
const kidPath = (kidId: string) => `${kidDir(kidId)}driving.json`;
const SETTINGS = 'settings.json';

export async function loadKidDriving(storage: GameStorage, kidId: string): Promise<KidDriving> {
  const raw = await storage.getJson<Partial<KidDriving>>(kidPath(kidId));
  return { assist: raw?.assist === 'road' ? 'road' : 'free' };
}

export async function saveKidDriving(storage: GameStorage, kidId: string, value: KidDriving): Promise<void> {
  await storage.putJson(kidPath(kidId), value);
}

export async function loadDrivingSettings(storage: GameStorage): Promise<DrivingSettings> {
  const raw = await storage.getJson<Partial<DrivingSettings>>(SETTINGS);
  return { sounds: raw?.sounds !== false };
}

export async function saveDrivingSettings(storage: GameStorage, value: DrivingSettings): Promise<void> {
  await storage.putJson(SETTINGS, value);
}

/** Deletes what the game keeps for a kid, when a parent deletes the kid (ADR 0012). */
export async function forgetKid(storage: GameStorage, kidId: string): Promise<void> {
  for (const path of await storage.list(kidDir(kidId))) await storage.delete(path);
}
