// What the driving game keeps (ADR 0021): per kid, the assist level and the last vehicle picked (milestone-3 B5);
// for the game, whether its sounds play.
import type { GameStorage } from '../../storage/types';
import type { Assist, VehicleKind } from './sim/sim';

/** The vehicles a kid can pick, in the picker's order. */
export const VEHICLES: readonly VehicleKind[] = [
  'car', 'police', 'monster', 'bus', 'fire', 'ambulance', 'tow', 'digger', 'dump', 'mixer', 'tractor', 'garbage', 'icecream', 'race',
];

export interface KidDriving {
  /** Steers freely (the default) or follows the road. Set by a parent. */
  assist: Assist;
  /** The vehicle picked last time; the picker shows it picked. */
  vehicle: VehicleKind;
  /** The map picked last time, by id (ADR 0035). */
  map: string;
  /**
   * The vehicle's colour, picked on the picker (playtest, 2026-11-15), as #rrggbb; absent for the kid's own colour.
   * Paint where the vehicle is painted, the flag where it flies one (ADR 0035).
   */
  color?: string;
}

/** The colours on the picker after the kid's own (playtest, 2026-11-15): the crayon box's brightest, and black. */
export const CAR_COLORS: readonly string[] = ['#f23b2f', '#ff8a1f', '#ffd23f', '#2fa35f', '#3a86ff', '#9b5de5', '#ff70a6', '#2b2b2b'];

/** The picker's colours: the kid's own first, then the others that don't look like it, eight at most. */
export function carColors(own: string): string[] {
  const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const near = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]!)) < 60;
  return [own, ...CAR_COLORS.filter((c) => !near(c, own))].slice(0, 8);
}

export interface DrivingSettings {
  sounds: boolean;
  /** Vehicles a parent has switched off for the whole family (ADR 0035): not in the picker, the garage or traffic. */
  hidden: VehicleKind[];
}

const kidDir = (kidId: string) => `kids/${kidId}/`;
const kidPath = (kidId: string) => `${kidDir(kidId)}driving.json`;
const SETTINGS = 'settings.json';

export async function loadKidDriving(storage: GameStorage, kidId: string): Promise<KidDriving> {
  const raw = await storage.getJson<Partial<KidDriving>>(kidPath(kidId));
  return {
    assist: raw?.assist === 'road' ? 'road' : 'free',
    vehicle: VEHICLES.includes(raw?.vehicle as VehicleKind) ? (raw!.vehicle as VehicleKind) : 'car',
    map: typeof raw?.map === 'string' ? raw.map : 'island',
    ...(typeof raw?.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color) ? { color: raw.color } : {}),
  };
}

export async function saveKidDriving(storage: GameStorage, kidId: string, value: KidDriving): Promise<void> {
  await storage.putJson(kidPath(kidId), value);
}

export async function loadDrivingSettings(storage: GameStorage): Promise<DrivingSettings> {
  const raw = await storage.getJson<Partial<DrivingSettings>>(SETTINGS);
  const hidden = Array.isArray(raw?.hidden) ? raw.hidden.filter((k): k is VehicleKind => VEHICLES.includes(k)) : [];
  return { sounds: raw?.sounds !== false, hidden };
}

export async function saveDrivingSettings(storage: GameStorage, value: DrivingSettings): Promise<void> {
  await storage.putJson(SETTINGS, value);
}

/** The vehicles a parent has on, in the picker's order. The car is always on, so there is one to drive. */
export function shownVehicles(settings: DrivingSettings): VehicleKind[] {
  return VEHICLES.filter((k) => k === 'car' || !settings.hidden.includes(k));
}

/** Deletes what the game keeps for a kid, when a parent deletes the kid (ADR 0012). */
export async function forgetKid(storage: GameStorage, kidId: string): Promise<void> {
  for (const path of await storage.list(kidDir(kidId))) await storage.delete(path);
}
