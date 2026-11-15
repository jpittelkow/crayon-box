// Kid profiles and shell settings (ADR 0007, 0018), kept in the shell's storage namespace.
// Each kid is its own folder, `kids/<id>/` with `profile.json` and `photo.jpg`, so that when devices sync
// (ADR 0024) a change to one kid on one device never overwrites a change to another kid made elsewhere.
import { randomId } from '../storage/ids';
import type { GameStorage } from '../storage/types';
import { symbolIcon } from '../ui/icons';
import type { ColoringMode, GameEntry, KidColor, KidProfile, KidSymbol } from './types';

const SETTINGS = 'settings.json';
const kidDir = (id: string) => `kids/${id}/`;
const profilePath = (id: string) => `${kidDir(id)}profile.json`;
const photoPath = (id: string) => `${kidDir(id)}photo.jpg`;

/** Where the first web build kept all profiles and photos. Moved to per-kid folders on first load. */
const LEGACY_PROFILES = 'profiles.json';
const legacyPhotoPath = (id: string) => `photos/${id}.jpg`;

export const KID_COLORS: readonly KidColor[] = ['orange', 'pink', 'purple', 'green', 'blue', 'teal'];
export const KID_SYMBOLS: readonly KidSymbol[] = ['star', 'heart', 'moon', 'flower', 'sun', 'leaf'];
/** One kid per color, so a kid's ground tint always tells them apart (ADR 0016 rule 7). */
export const MAX_KIDS = KID_COLORS.length;
export const MAX_NAME_LENGTH = 30;

/**
 * Profiles every new install starts with. Parents rename, change or delete them in the parent area. Their ids
 * and creation times are the same on every device, so two fresh devices that sync end up with three kids, not
 * six.
 */
export const DEFAULT_PROFILES: KidProfile[] = [
  { id: 'star', symbol: 'star', color: 'orange', startMode: 'free', created: '2000-01-01T00:00:00.000Z' },
  { id: 'heart', symbol: 'heart', color: 'purple', startMode: 'free', created: '2000-01-01T00:00:01.000Z' },
  { id: 'moon', symbol: 'moon', color: 'teal', startMode: 'free', created: '2000-01-01T00:00:02.000Z' },
];

export interface ShellSettings {
  /** Show each kid's name under their badge on the kid picker (ADR 0018). */
  showNames: boolean;
  /**
   * Games a parent turned on (true) or off (false), by id (ADR 0012: a parent can hide a game). A game not listed
   * shows unless its registry entry starts hidden.
   */
  games: Record<string, boolean>;
}

const DEFAULT_SETTINGS: ShellSettings = { showNames: true, games: {} };

/** Fills in fields that older saved profiles lack. */
export function normalizeProfile(raw: Partial<KidProfile> & { id: string }): KidProfile {
  const symbol = raw.symbol ?? (KID_SYMBOLS.includes(raw.id as KidSymbol) ? (raw.id as KidSymbol) : 'star');
  const name = raw.name?.trim().slice(0, MAX_NAME_LENGTH);
  return {
    id: raw.id,
    symbol,
    color: raw.color && KID_COLORS.includes(raw.color) ? raw.color : 'orange',
    startMode: raw.startMode === 'lines' ? 'lines' : 'free',
    created: raw.created ?? DEFAULT_PROFILES.find((d) => d.id === raw.id)?.created ?? new Date().toISOString(),
    ...(name ? { name } : {}),
    ...(raw.hasPhoto ? { hasPhoto: true } : {}),
  };
}

/** Kids in the order they were added. */
function inOrder(kids: KidProfile[]): KidProfile[] {
  return kids.sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
}

async function migrateLegacy(shell: GameStorage): Promise<boolean> {
  const legacy = await shell.getJson<(Partial<KidProfile> & { id: string })[]>(LEGACY_PROFILES);
  if (!legacy) return false;
  const base = Date.now();
  for (const [i, raw] of legacy.entries()) {
    // Keep the old list's order by spacing the creation times a second apart.
    const kid = normalizeProfile({ ...raw, created: raw.created ?? new Date(base + i * 1000).toISOString() });
    const photo = await shell.getBlob(legacyPhotoPath(kid.id));
    if (photo) {
      await shell.putBlob(photoPath(kid.id), photo);
      await shell.delete(legacyPhotoPath(kid.id));
    }
    await shell.putJson(profilePath(kid.id), kid);
  }
  await shell.delete(LEGACY_PROFILES);
  return legacy.length > 0;
}

export async function loadProfiles(shell: GameStorage): Promise<KidProfile[]> {
  const read = async () => {
    const paths = (await shell.list('kids/')).filter((p) => p.endsWith('/profile.json'));
    const kids: KidProfile[] = [];
    for (const path of paths) {
      const raw = await shell.getJson<Partial<KidProfile> & { id: string }>(path);
      if (raw?.id) kids.push(normalizeProfile(raw));
    }
    return inOrder(kids);
  };

  let kids = await read();
  if (kids.length > 0) return kids;
  if (await migrateLegacy(shell)) kids = await read();
  if (kids.length > 0) return kids;

  // First run: the three starting profiles, marked as defaults so that whatever the family has already set up on
  // another device replaces them when this one first syncs (ADR 0024).
  for (const kid of DEFAULT_PROFILES) await shell.putJson(profilePath(kid.id), kid, { asDefault: true });
  return DEFAULT_PROFILES.map((p) => ({ ...p }));
}

/** Saves one kid. Other kids' files are not touched. */
export async function saveProfile(shell: GameStorage, kid: KidProfile): Promise<void> {
  await shell.putJson(profilePath(kid.id), normalizeProfile(kid));
}

/** Removes a kid's profile and photo. Their games' data is removed by each game (GameModule.forgetKid). */
export async function deleteProfile(shell: GameStorage, kidId: string): Promise<void> {
  for (const path of await shell.list(kidDir(kidId))) await shell.delete(path);
}

export async function loadShellSettings(shell: GameStorage): Promise<ShellSettings> {
  const saved = await shell.getJson<Partial<ShellSettings>>(SETTINGS);
  return { ...DEFAULT_SETTINGS, ...saved, games: { ...saved?.games } };
}

/** The games the kids can open. Never empty: with every game turned off, the first one still shows. */
export function enabledGames(games: readonly GameEntry[], settings: ShellSettings): GameEntry[] {
  const on = games.filter((g) => settings.games[g.id] ?? !g.startsHidden);
  return on.length > 0 ? on : games.slice(0, 1);
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

/** A storage id that never carries the kid's name (ADR 0018) and is unique across devices (ADR 0024). */
export function newKidId(random?: () => number): string {
  return `kid-${randomId(8, random)}`;
}

/** A new profile with a color and symbol no other kid has. */
export function newProfile(kids: KidProfile[], startMode: ColoringMode = 'free'): KidProfile {
  const color = KID_COLORS.find((c) => !kids.some((k) => k.color === c)) ?? 'orange';
  const symbol = KID_SYMBOLS.find((s) => !kids.some((k) => k.symbol === s)) ?? 'star';
  let id = newKidId();
  while (kids.some((k) => k.id === id)) id = newKidId();
  return { id, color, symbol, startMode, created: new Date().toISOString() };
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
