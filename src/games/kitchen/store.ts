// What Kitchen keeps (ADR 0044), in the game's own storage, one file per thing that changes on its own (ADR 0024):
//   kids/<id>/making/<recipe>.json   the thing a kid is in the middle of making
// It is saved a moment after every action, and again on the way out, so nothing is lost (ADR 0003 rule 6).
import type { GameStorage } from '../../storage/types';
import { readMade, type Made } from './make/made';
import type { Recipe } from './recipe';

const kidDir = (kidId: string) => `kids/${kidId}/`;
const makingPath = (kidId: string, recipeId: string) => `${kidDir(kidId)}making/${recipeId}.json`;

/** How long after an action the save runs: a finger rubbing sauce on makes dozens of changes a second. */
const SAVE_AFTER_MS = 400;

export class Making {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: Made | undefined;
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private readonly storage: GameStorage,
    private readonly kidId: string,
    private readonly recipe: Recipe,
  ) {}

  async load(): Promise<Made> {
    const raw = await this.storage.getJson<unknown>(makingPath(this.kidId, this.recipe.id)).catch(() => undefined);
    return readMade(raw, this.recipe);
  }

  /** The thing changed: save it soon. */
  changed(made: Made): void {
    this.pending = made;
    this.timer ??= setTimeout(() => void this.flush(), SAVE_AFTER_MS);
  }

  /** Saves now what is waiting. Resolves once it is written; saves run one after another. */
  flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    const made = this.pending;
    this.pending = undefined;
    if (made) {
      const snapshot = structuredClone(made);
      this.writing = this.writing
        .then(() => this.storage.putJson(makingPath(this.kidId, this.recipe.id), snapshot))
        .catch((err) => console.error('Could not save what is being made', err));
    }
    return this.writing;
  }
}

/** Deletes everything Kitchen kept for a kid, when a parent deletes the kid. */
export async function forgetKid(storage: GameStorage, kidId: string): Promise<void> {
  for (const path of await storage.list(kidDir(kidId))) await storage.delete(path);
}
