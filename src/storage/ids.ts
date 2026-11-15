// Ids that stay unique across the family's devices (ADR 0024). Two devices that have never met must not pick
// the same id for a new kid or a new picture, so ids carry random characters, not only a time or a counter.
import type { GameStorage } from './types';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** `length` random characters from 0-9 and a-z. Eight of them give about 2.8 trillion possibilities. */
export function randomId(length = 8, random?: () => number): string {
  let out = '';
  if (random) {
    for (let i = 0; i < length; i++) out += ALPHABET[Math.floor(random() * 36) % 36];
    return out;
  }
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  // 252 is the largest multiple of 36 under 256; skipping the rest keeps every character equally likely.
  for (let i = 0; out.length < length; i = (i + 1) % length) {
    if (bytes[i] < 252) out += ALPHABET[bytes[i] % 36];
    else crypto.getRandomValues(bytes);
  }
  return out;
}

const DEVICE = 'local/device.json';

export interface DeviceInfo {
  id: string;
  created: string;
}

/**
 * This device's own id, made on first use and kept under `local/`, so it never syncs (ADR 0024). The sync client
 * uses it to say which device a change came from.
 */
export async function deviceInfo(shell: GameStorage, now: () => Date = () => new Date()): Promise<DeviceInfo> {
  const saved = await shell.getJson<DeviceInfo>(DEVICE);
  if (saved?.id) return saved;
  const info: DeviceInfo = { id: `dev-${randomId()}`, created: now().toISOString() };
  await shell.putJson(DEVICE, info);
  return info;
}
