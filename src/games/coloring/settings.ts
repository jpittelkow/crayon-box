// The coloring game's own settings, kept in its storage namespace (ADR 0012).
import type { GameStorage } from '../../storage/types';

export interface ColoringSettings {
  /** Page ids a parent has hidden from the library (ADR 0005). */
  hiddenPages: string[];
}

const PATH = 'settings.json';

export async function loadSettings(storage: GameStorage): Promise<ColoringSettings> {
  const saved = await storage.getJson<Partial<ColoringSettings>>(PATH);
  return { hiddenPages: saved?.hiddenPages ?? [] };
}

export async function saveSettings(storage: GameStorage, settings: ColoringSettings): Promise<void> {
  await storage.putJson(PATH, settings);
}
