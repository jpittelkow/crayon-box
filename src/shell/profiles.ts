// Kid profiles and shell settings (ADR 0007, 0018), kept in the shell's storage namespace.
import type { GameStorage } from '../storage/types';
import { symbolIcon } from '../ui/icons';
import type { ColoringMode, KidColor, KidProfile, KidSymbol } from './types';

const PROFILES = 'profiles.json';
const SETTINGS = 'settings.json';
const photoPath = (id: string) => `photos/${id}.jpg`;

export const KID_COLORS: readonly KidColor[] = ['orange', 'pink', 'purple', 'green', 'blue', 'teal'];
export const KID_SYMBOLS: readonly KidSymbol[] = ['star', 'heart', 'moon', 'flower', 'sun', 'leaf'];
/** One kid per color, so a kid's ground tint always tells them apart (ADR 0016 rule 7). */
export const MAX_KIDS = KID_COLORS.length;
export const MAX_NAME_LENGTH = 30;

/** Profiles every new install starts with. Parents rename, change or delete them in the parent area. */
export const DEFAULT_PROFILES: KidProfile[] = [
  { id: 'star', symbol: 'star', color: 'orange', startMode: 'free' },
  { id: 'heart', symbol: 'heart', color: 'purple', startMode: 'free' },
  { id: 'moon', symbol: 'moon', color: 'teal', startMode: 'free' },
];

export interface ShellSettings {
  /** Show each kid's name under their badge on the kid picker (ADR 0018). */
  showNames: boolean;
}

const DEFAULT_SETTINGS: ShellSettings = { showNames: true };

/** Fills in fields that older saved profiles lack. */
export function normalizeProfile(raw: Partial<KidProfile> & { id: string }): KidProfile {
  const symbol = raw.symbol ?? (KID_SYMBOLS.includes(raw.id as KidSymbol) ? (raw.id as KidSymbol) : 'star');
  const name = raw.name?.trim().slice(0, MAX_NAME_LENGTH);
  return {
    id: raw.id,
    symbol,
    color: raw.color && KID_COLORS.includes(raw.color) ? raw.color : 'orange',
    startMode: raw.startMode === 'lines' ? 'lines' : 'free',
    ...(name ? { name } : {}),
    ...(raw.hasPhoto ? { hasPhoto: true } : {}),
  };
}

export async function loadProfiles(shell: GameStorage): Promise<KidProfile[]> {
  const saved = await shell.getJson<(Partial<KidProfile> & { id: string })[]>(PROFILES);
  if (saved && saved.length > 0) return saved.map(normalizeProfile);
  await shell.putJson(PROFILES, DEFAULT_PROFILES);
  return DEFAULT_PROFILES.map((p) => ({ ...p }));
}

export async function saveProfiles(shell: GameStorage, kids: KidProfile[]): Promise<void> {
  await shell.putJson(PROFILES, kids.map(normalizeProfile));
}

export async function loadShellSettings(shell: GameStorage): Promise<ShellSettings> {
  return { ...DEFAULT_SETTINGS, ...(await shell.getJson<Partial<ShellSettings>>(SETTINGS)) };
}

export async function saveShellSettings(shell: GameStorage, settings: ShellSettings): Promise<void> {
  await shell.putJson(SETTINGS, settings);
}

export function getPhoto(shell: GameStorage, kid: KidProfile): Promise<Blob | undefined> {
  return kid.hasPhoto ? shell.getBlob(photoPath(kid.id)) : Promise.resolve(undefined);
}

export async function putPhoto(shell: GameStorage, kidId: string, photo: Blob | null): Promise<void> {
  if (photo) await shell.putBlob(photoPath(kidId), photo);
  else await shell.delete(photoPath(kidId));
}

/** A storage id that never carries the kid's name (ADR 0018). */
export function newKidId(random: () => number = Math.random): string {
  return `kid-${Math.floor(random() * 36 ** 6)
    .toString(36)
    .padStart(6, '0')}`;
}

/** A new profile with a color and symbol no other kid has. */
export function newProfile(kids: KidProfile[], startMode: ColoringMode = 'free'): KidProfile {
  const color = KID_COLORS.find((c) => !kids.some((k) => k.color === c)) ?? 'orange';
  const symbol = KID_SYMBOLS.find((s) => !kids.some((k) => k.symbol === s)) ?? 'star';
  let id = newKidId();
  while (kids.some((k) => k.id === id)) id = newKidId();
  return { id, color, symbol, startMode };
}

export function kidLabel(kid: KidProfile): string {
  return kid.name || kid.symbol[0].toUpperCase() + kid.symbol.slice(1);
}

export function kidColorVar(kid: KidProfile): string {
  return `var(--kid-${kid.color})`;
}

export function kidTintVar(kid: KidProfile): string {
  return `var(--kid-${kid.color}-tint)`;
}

/** Fills a round element with the kid's photo, ringed in their color, or their symbol on their color. */
export function drawAvatar(target: HTMLElement, kid: KidProfile, photoUrl: string | undefined, iconSize: number): void {
  target.style.background = kidColorVar(kid);
  if (photoUrl) {
    const img = document.createElement('img');
    img.src = photoUrl;
    img.alt = '';
    img.className = 'avatar-photo';
    target.replaceChildren(img);
  } else {
    target.innerHTML = symbolIcon(kid.symbol, iconSize);
  }
}
