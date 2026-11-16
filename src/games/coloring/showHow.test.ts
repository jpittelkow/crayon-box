import { describe, expect, it } from 'vitest';
import { memoryBackend } from '../../storage/idb';
import { appStorage } from '../../storage/namespaced';
import { narratorClip } from '../../shell/soundFiles';
import { forgetKidNames } from './names';
import {
  DEMO_GAP_MS,
  DEMO_TOOLS,
  askShowButtons,
  demoOnOpen,
  demoOnPick,
  emptyRecord,
  loadAsk,
  loadRecord,
  readRecord,
  saveRecord,
  seen,
  showButtonsWaiting,
  started,
  type ShowHowRecord,
} from './showHow';

const game = () => appStorage(memoryBackend()).game('coloring');
const NOW = 1_800_000_000_000;

describe('when a demo is due (ADR 0038 part 3)', () => {
  it('plays the current tool on the first page a kid ever opens, then not again', () => {
    const fresh = emptyRecord();
    const demo = demoOnOpen(fresh, 0, 'brush', NOW);
    expect(demo).toEqual({ kind: 'tool', tool: 'brush', firstPage: true });
    const after = seen(started(fresh, NOW), demo!);
    expect(after.page).toBe(true);
    expect(after.seen).toEqual(['brush']);
    expect(demoOnOpen(after, 0, 'brush', NOW + 10 * DEMO_GAP_MS)).toBeNull();
  });

  it("plays a tool's demo the first time a kid picks it, then never for that tool", () => {
    let rec: ShowHowRecord = { ...emptyRecord(), page: true };
    for (const tool of DEMO_TOOLS) {
      const demo = demoOnPick(rec, tool, NOW);
      expect(demo).toEqual({ kind: 'tool', tool, firstPage: false });
      rec = seen(rec, demo!);
      expect(demoOnPick(rec, tool, NOW + 10 * DEMO_GAP_MS)).toBeNull();
    }
    expect(rec.seen).toEqual(['bucket', 'brush', 'eraser']);
  });

  it('a pick demo of the tool shown on the first page is not due again', () => {
    const first = demoOnOpen(emptyRecord(), 0, 'brush', NOW)!;
    const rec = seen(started(emptyRecord(), NOW), first);
    expect(demoOnPick(rec, 'brush', NOW + 2 * DEMO_GAP_MS)).toBeNull();
    expect(demoOnPick(rec, 'bucket', NOW + 2 * DEMO_GAP_MS)?.kind).toBe('tool');
  });

  it('never plays more than one a minute; a demo held back is still due later', () => {
    const rec = started({ ...emptyRecord(), page: true }, NOW);
    expect(demoOnPick(rec, 'bucket', NOW + 1000)).toBeNull();
    expect(demoOnPick(rec, 'bucket', NOW + DEMO_GAP_MS - 1)).toBeNull();
    expect(demoOnPick(rec, 'bucket', NOW + DEMO_GAP_MS)?.kind).toBe('tool');
    // A first page whose demo was stopped at once waits out the minute too.
    expect(demoOnOpen(started(emptyRecord(), NOW), 0, 'brush', NOW + 1000)).toBeNull();
    expect(demoOnOpen(started(emptyRecord(), NOW), 0, 'brush', NOW + DEMO_GAP_MS)?.kind).toBe('tool');
  });

  it('a demo stopped before it was seen is due again: only `seen` marks it', () => {
    const rec = started(emptyRecord(), NOW);
    expect(rec.page).toBe(false);
    expect(rec.seen).toEqual([]);
    expect(demoOnPick({ ...rec, page: true }, 'brush', NOW + DEMO_GAP_MS)?.kind).toBe('tool');
  });

  it('a clock set back does not hold demos back forever', () => {
    const rec = started({ ...emptyRecord(), page: true }, NOW);
    expect(demoOnPick(rec, 'eraser', NOW - 5 * DEMO_GAP_MS)?.kind).toBe('tool');
  });

  it('every tool has a "what it does" line', () => {
    for (const tool of DEMO_TOOLS) expect(narratorClip(`do-${tool}`), tool).toBeTruthy();
    for (const action of ['undo', 'start-over']) expect(narratorClip(`do-${action}`), action).toBeTruthy();
  });
});

describe('"Show the buttons" (ADR 0038 part 4)', () => {
  it('plays every tool the next time the kid opens a page, without waiting out the minute, once', () => {
    const asked = NOW - 5000;
    const rec = started({ ...emptyRecord(), page: true, seen: ['brush'] }, NOW - 1000);
    const demo = demoOnOpen(rec, asked, 'brush', NOW);
    expect(demo).toEqual({ kind: 'tour', asked });
    const after = seen(started(rec, NOW), demo!);
    expect(after).toMatchObject({ page: true, seen: ['bucket', 'brush', 'eraser'], answered: asked });
    expect(demoOnOpen(after, asked, 'brush', NOW + 10 * DEMO_GAP_MS)).toBeNull();
    // Asked again later: it plays again.
    expect(demoOnOpen(after, asked + 1, 'brush', NOW + 10 * DEMO_GAP_MS)?.kind).toBe('tour');
  });

  it('comes before the first-page demo for a new kid', () => {
    expect(demoOnOpen(emptyRecord(), NOW - 1, 'bucket', NOW)?.kind).toBe('tour');
  });
});

describe('what is kept', () => {
  it("keeps each kid's record and a parent's ask in their own files", async () => {
    const storage = game();
    expect(await loadRecord(storage, 'star')).toEqual(emptyRecord());
    expect(await showButtonsWaiting(storage, 'star')).toBe(false);

    const rec = seen(started(emptyRecord(), NOW), { kind: 'tool', tool: 'bucket', firstPage: true });
    await saveRecord(storage, 'star', rec);
    expect(await loadRecord(storage, 'star')).toEqual(rec);
    expect(await loadRecord(storage, 'moon')).toEqual(emptyRecord());

    await askShowButtons(storage, 'star', NOW + 5);
    expect(await loadAsk(storage, 'star')).toBe(NOW + 5);
    expect(await showButtonsWaiting(storage, 'star')).toBe(true);
    expect(await showButtonsWaiting(storage, 'moon')).toBe(false);
    expect((await storage.list('kids/star/')).sort()).toEqual(['kids/star/show-buttons.json', 'kids/star/show-how.json']);

    await saveRecord(storage, 'star', seen(rec, { kind: 'tour', asked: NOW + 5 }));
    expect(await showButtonsWaiting(storage, 'star')).toBe(false);
  });

  it('ignores a broken record', () => {
    expect(readRecord({ page: 'yes', seen: ['brush', 'crayon', 'brush', 4], last: -3, answered: 'soon' })).toEqual({
      page: false,
      seen: ['brush'],
      last: 0,
      answered: 0,
    });
    expect(readRecord(null)).toEqual(emptyRecord());
  });

  it('is deleted with the kid', async () => {
    const storage = game();
    await saveRecord(storage, 'star', { ...emptyRecord(), page: true });
    await askShowButtons(storage, 'star');
    await forgetKidNames(storage, 'star');
    expect(await storage.list('kids/star/')).toEqual([]);
  });
});
