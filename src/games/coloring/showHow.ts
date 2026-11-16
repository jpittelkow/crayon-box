// When the coloring screen shows a kid what a tool does (ADR 0038 parts 3 and 4): a short demo on the page the first
// time a kid opens a page, and the first time they pick each tool; never more than one a minute. A parent can ask for
// every demo in turn, slowly, the next time that kid opens a page ("Show the buttons"). What is kept, per kid, in the
// game's storage (two files, because the kid's screen and the parent area change them on their own, ADR 0024):
//   kids/<id>/show-how.json      which demos this kid has seen, and when the last one started
//   kids/<id>/show-buttons.json  when a parent last asked for "Show the buttons"
import type { GameStorage } from '../../storage/types';
import type { Tool } from './engine/engine';

/** The tools with a demo, in the order "Show the buttons" plays them (the rail's order). */
export const DEMO_TOOLS: readonly Tool[] = ['bucket', 'brush', 'eraser'];

/** Never more than one demo a minute (plan, part 3). A parent's "Show the buttons" doesn't wait. */
export const DEMO_GAP_MS = 60_000;

/** A demo stopped by a touch this soon after it started didn't get seen, and is due again next time. */
export const DEMO_SEEN_AFTER_MS = 1000;

/** What one kid has seen. `last` is when the last demo started (ms since 1970; 0 for never). */
export interface ShowHowRecord {
  /** The first-page demo has been seen. */
  page: boolean;
  /** Tools whose demo has been seen. */
  seen: Tool[];
  last: number;
  /** The parent's ask (its `asked` time) that the last "Show the buttons" answered; 0 for none. */
  answered: number;
}

/** A demo that is due: one tool's, or every tool's in turn for a parent's "Show the buttons". */
export type Demo = { kind: 'tool'; tool: Tool; firstPage: boolean } | { kind: 'tour'; asked: number };

export const emptyRecord = (): ShowHowRecord => ({ page: false, seen: [], last: 0, answered: 0 });

const isTool = (t: unknown): t is Tool => DEMO_TOOLS.includes(t as Tool);
const time = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);

/** Reads a stored record, keeping only what makes sense. */
export function readRecord(raw: unknown): ShowHowRecord {
  const r = (raw ?? {}) as Partial<Record<keyof ShowHowRecord, unknown>>;
  return {
    page: r.page === true,
    seen: Array.isArray(r.seen) ? [...new Set(r.seen.filter(isTool))] : [],
    last: time(r.last),
    answered: time(r.answered),
  };
}

const rested = (rec: ShowHowRecord, now: number) => rec.last === 0 || now - rec.last >= DEMO_GAP_MS || now < rec.last;

/**
 * The demo due as a page opens with `tool` picked: the parent's "Show the buttons" when it is waiting, else the
 * current tool's demo the first time this kid opens a page, unless a demo played in the last minute.
 */
export function demoOnOpen(rec: ShowHowRecord, asked: number, tool: Tool, now: number): Demo | null {
  if (asked > rec.answered) return { kind: 'tour', asked };
  if (!rec.page && rested(rec, now)) return { kind: 'tool', tool, firstPage: true };
  return null;
}

/** The demo due when a kid picks `tool`: its own, the first time, unless a demo played in the last minute. */
export function demoOnPick(rec: ShowHowRecord, tool: Tool, now: number): Demo | null {
  if (rec.seen.includes(tool) || !rested(rec, now)) return null;
  return { kind: 'tool', tool, firstPage: false };
}

/** A demo has started: it counts toward the one-a-minute limit whether or not it is seen. */
export function started(rec: ShowHowRecord, now: number): ShowHowRecord {
  return { ...rec, last: now };
}

/**
 * The record once `demo` was seen (it ran DEMO_SEEN_AFTER_MS without a touch). "Show the buttons" counts as seeing
 * every tool and the first page.
 */
export function seen(rec: ShowHowRecord, demo: Demo): ShowHowRecord {
  if (demo.kind === 'tour') return { ...rec, page: true, seen: [...DEMO_TOOLS], answered: Math.max(rec.answered, demo.asked) };
  return {
    ...rec,
    page: rec.page || demo.firstPage,
    seen: rec.seen.includes(demo.tool) ? rec.seen : [...rec.seen, demo.tool],
  };
}

// ---- Storage ----

const recordPath = (kidId: string) => `kids/${kidId}/show-how.json`;
const askPath = (kidId: string) => `kids/${kidId}/show-buttons.json`;

export async function loadRecord(storage: GameStorage, kidId: string): Promise<ShowHowRecord> {
  return readRecord(await storage.getJson(recordPath(kidId)));
}

export async function saveRecord(storage: GameStorage, kidId: string, rec: ShowHowRecord): Promise<void> {
  await storage.putJson(recordPath(kidId), rec);
}

/** When a parent last asked for "Show the buttons" for this kid (0 for never). */
export async function loadAsk(storage: GameStorage, kidId: string): Promise<number> {
  return time((await storage.getJson<{ asked?: unknown }>(askPath(kidId)))?.asked);
}

/** A parent asks for "Show the buttons": it plays the next time this kid opens a page. */
export async function askShowButtons(storage: GameStorage, kidId: string, now = Date.now()): Promise<void> {
  await storage.putJson(askPath(kidId), { asked: now });
}

/** Whether a parent's "Show the buttons" is still waiting for this kid to open a page. */
export async function showButtonsWaiting(storage: GameStorage, kidId: string): Promise<boolean> {
  const [asked, rec] = await Promise.all([loadAsk(storage, kidId), loadRecord(storage, kidId)]);
  return asked > rec.answered;
}
