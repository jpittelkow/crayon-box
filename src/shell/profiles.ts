import type { GameStorage } from '../storage/types';
import type { KidProfile } from './types';

const PATH = 'profiles.json';

/**
 * Profiles every new install starts with, until the parent area can edit them (ADR 0008). Symbols and colors
 * only, never names (ADR 0007).
 */
export const DEFAULT_PROFILES: KidProfile[] = [
  { id: 'star', color: 'orange', startMode: 'free' },
  { id: 'heart', color: 'purple', startMode: 'free' },
  { id: 'moon', color: 'teal', startMode: 'free' },
];

export async function loadProfiles(shell: GameStorage): Promise<KidProfile[]> {
  const saved = await shell.getJson<KidProfile[]>(PATH);
  if (saved && saved.length > 0) return saved;
  await shell.putJson(PATH, DEFAULT_PROFILES);
  return DEFAULT_PROFILES;
}

export function kidColorVar(kid: KidProfile): string {
  return `var(--kid-${kid.color})`;
}

export function kidTintVar(kid: KidProfile): string {
  return `var(--kid-${kid.color}-tint)`;
}
