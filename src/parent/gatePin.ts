// The optional PIN for the parent gate (ADR 0008): for when one of the kids can read the number words. Kept in
// its own settings file so it syncs on its own (ADR 0024). Only a hash is stored: a parent may reuse a PIN they
// use elsewhere, and nobody should be able to read it back out of the app's data.
import type { GameStorage } from '../storage/types';

const PATH = 'gate.json';
export const PIN_LENGTH = 4;

export interface GateSettings {
  /** SHA-256 of the PIN, hex. No PIN: the gate shows number words. */
  pinHash?: string;
}

export async function loadGateSettings(shell: GameStorage): Promise<GateSettings> {
  return (await shell.getJson<GateSettings>(PATH)) ?? {};
}

export async function saveGateSettings(shell: GameStorage, settings: GateSettings): Promise<void> {
  await shell.putJson(PATH, settings);
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`crayon-box-gate:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function pinMatches(pin: string, pinHash: string): Promise<boolean> {
  return (await hashPin(pin)) === pinHash;
}
