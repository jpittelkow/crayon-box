import { expect, test, type Page } from '@playwright/test';
import { glyph, type Pt } from '../../src/games/letters/glyphs';
import { openParentArea } from './helpers';

// Writing words (ADR 0039): the Words tile a parent turns on per kid, the word tiles, writing a word one letter at a
// time into a row of boxes, the slow word and the check, and the kid's own name with and without a recording.

/** Puts a value straight into the app's storage, under its full key (read when Letters opens). */
async function seed(page: Page, key: string, value: { json: unknown } | { wav: true }): Promise<void> {
  await page.evaluate(
    async ({ key, value }) => {
      let stored: unknown;
      if ('json' in value) stored = { kind: 'json', json: JSON.stringify(value.json) };
      else {
        // A third of a second of silence as a WAV: a stand-in for a parent's recording of a name.
        const n = 8000 / 3;
        const buf = new ArrayBuffer(44 + n * 2);
        const v = new DataView(buf);
        const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
        text(0, 'RIFF');
        v.setUint32(4, 36 + n * 2, true);
        text(8, 'WAVEfmt ');
        v.setUint32(16, 16, true);
        v.setUint16(20, 1, true);
        v.setUint16(22, 1, true);
        v.setUint32(24, 8000, true);
        v.setUint32(28, 16000, true);
        v.setUint16(32, 2, true);
        v.setUint16(34, 16, true);
        text(36, 'data');
        v.setUint32(40, n * 2, true);
        stored = { kind: 'bytes', type: 'audio/wav', bytes: buf };
      }
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open('crayon-box');
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').put(stored, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { key, value },
  );
}

/**
 * Letters on, the Star kid has seen the first-time how-to (as in the other letters tests), and optionally: Words on
 * for Star, a name for Star (a symbol word), small letters, a recording of the name.
 */
async function setUp(page: Page, opts: { words?: boolean; name?: string; small?: boolean; recording?: boolean } = {}): Promise<void> {
  await page.goto('/');
  // Written only once the kid picker shows (the app has made its database by then).
  await expect(page.getByRole('button', { name: 'Star kid' })).toBeVisible();
  await seed(page, 'games/letters/kids/star/progress.json', { json: { demoSeen: true } });
  if (opts.recording) await seed(page, 'games/letters/voice/name-star.wav', { wav: true });
  await openParentArea(page);
  await page.getByText('Show Letters').click();
  if (opts.name) {
    await page.getByRole('button', { name: 'Edit Star' }).click();
    await page.getByLabel('Name (optional)').fill(opts.name);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('button', { name: `Edit ${opts.name}` })).toBeVisible();
  }
  if (opts.words || opts.small) {
    await page.getByRole('button', { name: 'Letters', exact: true }).click();
    const label = opts.name ?? 'Star';
    if (opts.words) {
      const words = page.getByRole('group', { name: `Words for ${label}` }).getByRole('button', { name: 'Words' });
      await words.click();
      await expect(words).toHaveAttribute('aria-pressed', 'true');
    }
    if (opts.small) await page.getByRole('group', { name: `Letter sets for ${label}` }).getByRole('button', { name: 'a b c', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Back to the kids' }).click();
}

async function openWords(page: Page, kid = 'Star kid'): Promise<void> {
  await page.getByRole('button', { name: kid }).tap();
  await page.getByRole('button', { name: 'Letters', exact: true }).tap();
  await page.getByRole('button', { name: 'Words', exact: true }).tap();
  await expect(page.locator('[data-screen="letters-words"]')).toBeVisible();
}

/** Records every clip played through an audio element: the narrator by name (`word-sun`), a recording as `blob`. */
async function logClips(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __clips: string[] };
    w.__clips = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      w.__clips.push(this.currentSrc || this.src);
      return play.call(this);
    };
  });
}

async function clipsSaid(page: Page): Promise<string[]> {
  const all = await page.evaluate(() => (window as unknown as { __clips: string[] }).__clips);
  return all.map((c) => (c.startsWith('blob:') ? 'blob' : (/\/voice\/([A-Za-z0-9-]+)\.mp3/.exec(c)?.[1] ?? c)));
}

const traceScreen = (page: Page) => page.locator('[data-screen="letters-trace"]');
const slow = { timeout: 30_000 };

/**
 * Writes the word on screen, letter by letter, from `from` on: for each letter it waits for that letter's turn (the
 * opening over), then traces every stroke with synthetic pointer events. All in one `page.evaluate`, so no test step
 * runs between the letters. Returns the letters traced, as the screen showed them.
 */
async function writeWord(page: Page, letters: string[], from = 0): Promise<string[]> {
  const strokes = letters.map((ch) => glyph(ch).strokes.map((s) => s.filter((_, i) => i % 4 === 0 || i === s.length - 1)));
  return page.evaluate(
    async ({ strokes, from }) => {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const screen = () => document.querySelector<HTMLElement>('[data-screen="letters-trace"]');
      const until = async (ok: () => boolean, what: string) => {
        const t0 = performance.now();
        while (!ok()) {
          if (performance.now() - t0 > 20_000) throw new Error(`waited too long for ${what}`);
          await wait(40);
        }
      };
      const seen: string[] = [];
      for (let i = from; i < strokes.length; i++) {
        await until(() => {
          const s = screen();
          return !!s && s.dataset.wordAt === String(i) && s.dataset.done === 'false' && s.dataset.intro !== 'playing';
        }, `letter ${i}`);
        seen.push(screen()!.dataset.letter!);
        const svg = document.querySelector<SVGSVGElement>('.letters-svg')!;
        const m = svg.getScreenCTM()!;
        for (const stroke of strokes[i]) {
          const pts = stroke.map((p: Pt) => new DOMPoint(p.x, p.y).matrixTransform(m));
          const fire = (type: string, p: DOMPoint) =>
            svg.dispatchEvent(
              new PointerEvent(type, { bubbles: true, pointerType: 'touch', pointerId: 31, width: 10, height: 10, clientX: p.x, clientY: p.y }),
            );
          fire('pointerdown', pts[0]);
          for (const p of pts.slice(1)) fire('pointermove', p);
          fire('pointerup', pts[pts.length - 1]);
        }
      }
      return seen;
    },
    { strokes, from },
  );
}

// The pulsing and moving parts never hold still, so Playwright could not tap them; motion is off here.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('Words is off for every kid until a parent turns it on for one', async ({ page }) => {
  await setUp(page);
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await page.getByRole('button', { name: 'Letters', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Practice' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Words', exact: true })).toHaveCount(0);

  await page.goto('/');
  await openParentArea(page);
  await page.getByRole('button', { name: 'Letters', exact: true }).click();
  const star = page.getByRole('group', { name: 'Words for Star' }).getByRole('button', { name: 'Words' });
  await expect(star).toHaveAttribute('aria-pressed', 'false');
  await star.click();
  await expect(page.getByRole('group', { name: 'Words for Heart' }).getByRole('button', { name: 'Words' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'Back to the kids' }).click();
  await openWords(page);
  // A kid with no name has no name tile: the 24 words, in the easy order, with their letters drawn.
  const tiles = page.locator('.words-tile');
  await expect(tiles).toHaveCount(24);
  expect(await tiles.evaluateAll((all) => all.slice(0, 7).map((t) => (t as HTMLElement).dataset.word))).toEqual([
    'sun', 'sat', 'map', 'mud', 'run', 'red', 'fox',
  ]);
  await expect(page.getByRole('button', { name: 'Word sun', exact: true }).locator('svg')).toHaveCount(3);
  // Other kids still have no Words tile.
  await page.goto('/');
  await page.getByRole('button', { name: 'Heart kid' }).tap();
  await page.getByRole('button', { name: 'Letters', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Practice' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Words', exact: true })).toHaveCount(0);
});

test('a kid writes a three-letter word: each letter into its box, the slow word, the check and a star', async ({ page }) => {
  test.setTimeout(120_000);
  await logClips(page);
  await setUp(page, { words: true });
  await openWords(page);
  await page.getByRole('button', { name: 'Word sun', exact: true }).tap();
  // The opening: the word big in the middle and said, then the boxes along the top, the first pulsing.
  await expect(traceScreen(page)).toHaveAttribute('data-word', 'sun');
  await expect(traceScreen(page)).toHaveAttribute('data-letter', 'S');
  await expect(page.locator('.words-box')).toHaveCount(3);
  await expect.poll(() => clipsSaid(page)).toContain('word-sun');
  await expect(traceScreen(page)).toHaveAttribute('data-intro', 'done', slow);
  await expect(page.locator('.words-picture')).toHaveClass(/is-corner/);
  await expect(page.locator('.words-box').first()).toHaveClass(/is-now/);

  expect(await writeWord(page, ['S', 'U', 'N'])).toEqual(['S', 'U', 'N']);
  // Every box holds the kid's own line, not a font letter.
  await expect(page.locator('.words-box.is-filled')).toHaveCount(3);
  for (let i = 0; i < 3; i++) expect(await page.locator('.words-box').nth(i).locator('polyline').count()).toBeGreaterThan(0);
  // The slow word with the boxes lighting, the word, then the one check for the word.
  await expect(traceScreen(page)).toHaveAttribute('data-done', 'ready', slow);
  await expect(page.locator('.words-boxes')).toHaveClass(/is-big/);
  // (A letter's own name can be cut short here: these synthetic letters are traced in no time at all.)
  const said = await clipsSaid(page);
  expect(said.indexOf('word-next-letter')).toBeGreaterThan(said.indexOf('word-sun'));
  expect(said.indexOf('slow-sun')).toBeGreaterThan(said.indexOf('word-next-letter'));
  expect(said.lastIndexOf('word-sun')).toBeGreaterThan(said.indexOf('slow-sun'));
  expect(said).not.toContain('slow-sun-alt');
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Done', exact: true }).tap();
  await expect(traceScreen(page)).toHaveAttribute('data-done', 'true');
  await expect.poll(async () => (await clipsSaid(page)).at(-1)).toBe('praise-a-word');
  await expect(page.locator('.words-picture')).toHaveClass(/is-big/);
  await expect(page.locator('.words-picture .letters-done-star')).toHaveCount(1);
  // The letters count too, like letters traced on their own.
  await page.getByRole('button', { name: 'Next word' }).tap();
  await expect(traceScreen(page)).toHaveAttribute('data-word', 'sat');
  await page.getByRole('button', { name: 'Back' }).tap();
  await expect(page.getByRole('button', { name: 'Word sun, has a star' })).toBeVisible();

  // A parent's reset of the kid's stars clears the word's star too.
  await page.goto('/');
  await openParentArea(page);
  await page.getByRole('button', { name: 'Letters', exact: true }).click();
  await page.locator('[data-kid="star"]').getByRole('button', { name: 'Reset stars and game' }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Back to the kids' }).click();
  await openWords(page);
  await expect(page.getByRole('button', { name: 'Word sun', exact: true })).toBeVisible();
});

test('wipe restarts only the letter being traced; a filled box is tapped to hear its letter', async ({ page }) => {
  test.setTimeout(90_000);
  await logClips(page);
  await setUp(page, { words: true });
  await openWords(page);
  await page.getByRole('button', { name: 'Word cat', exact: true }).tap();
  await writeWord(page, ['C']);
  await expect(traceScreen(page)).toHaveAttribute('data-word-at', '1', slow);
  await expect(traceScreen(page)).toHaveAttribute('data-letter', 'A');
  // Half of A, then wipe: the A starts again, the C stays in its box.
  const a = glyph('A').strokes[0];
  await page.evaluate((pts) => {
    const svg = document.querySelector<SVGSVGElement>('.letters-svg')!;
    const m = svg.getScreenCTM()!;
    const at = pts.map((p) => new DOMPoint(p.x, p.y).matrixTransform(m));
    const fire = (type: string, p: DOMPoint) =>
      svg.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', pointerId: 32, width: 10, height: 10, clientX: p.x, clientY: p.y }));
    fire('pointerdown', at[0]);
    for (const p of at.slice(1)) fire('pointermove', p);
    fire('pointerup', at[at.length - 1]);
  }, a.filter((_, i) => i % 4 === 0));
  await expect(page.locator('.letters-ink polyline')).toHaveCount(1);
  await page.getByRole('button', { name: 'Wipe' }).tap();
  await expect(page.locator('.letters-ink polyline')).toHaveCount(0);
  await expect(traceScreen(page)).toHaveAttribute('data-letter', 'A');
  await expect(page.locator('.words-box.is-filled')).toHaveCount(1);
  // Tapping the filled box says its letter.
  await page.evaluate(() => ((window as unknown as { __clips: string[] }).__clips = []));
  await page.getByRole('button', { name: 'Letter C, written' }).tap();
  await expect.poll(() => clipsSaid(page)).toEqual(['letter-C']);
  // The rest of the word still finishes it.
  await writeWord(page, ['C', 'A', 'T'], 1);
  await expect(traceScreen(page)).toHaveAttribute('data-done', 'ready', slow);
});

test("the kid's own name comes first and is written like a word; without a recording, \"You wrote your name!\"", async ({ page }) => {
  test.setTimeout(120_000);
  await logClips(page);
  await setUp(page, { words: true, name: 'Star' });
  await openWords(page);
  // My name first, with the kid's badge.
  const first = page.locator('.words-tile').first();
  await expect(first).toHaveAttribute('data-word', 'name');
  await expect(first).toHaveAccessibleName('My name');
  await expect(first.locator('.words-avatar')).toHaveCount(1);
  await expect(page.locator('.words-tile')).toHaveCount(25);
  await first.tap();
  await expect(traceScreen(page)).toHaveAttribute('data-word', 'name');
  await expect(page.locator('.words-box')).toHaveCount(4);
  await expect.poll(() => clipsSaid(page)).toContain('word-your-name');
  expect(await writeWord(page, ['S', 'T', 'A', 'R'])).toEqual(['S', 'T', 'A', 'R']);
  await expect(traceScreen(page)).toHaveAttribute('data-done', 'ready', slow);
  await page.getByRole('button', { name: 'Done', exact: true }).tap();
  await expect.poll(async () => (await clipsSaid(page)).at(-1)).toBe('praise-your-name');
  const said = await clipsSaid(page);
  expect(said).not.toContain('blob');
  expect(said.filter((c) => c.startsWith('slow-'))).toEqual([]);
  await page.getByRole('button', { name: 'Back' }).tap();
  await expect(page.getByRole('button', { name: 'My name, has a star' })).toBeVisible();
});

test("with a parent's recording, the name is said in it: at the start, slowly with the boxes, and after the check", async ({ page }) => {
  test.setTimeout(120_000);
  await logClips(page);
  await setUp(page, { words: true, name: 'Star', recording: true });
  await openWords(page);
  await page.getByRole('button', { name: 'My name', exact: true }).tap();
  await expect.poll(async () => (await clipsSaid(page)).slice(0, 2)).toEqual(['word-your-name', 'blob']);
  await writeWord(page, ['S', 'T', 'A', 'R']);
  await expect(traceScreen(page)).toHaveAttribute('data-done', 'ready', slow);
  await page.getByRole('button', { name: 'Done', exact: true }).tap();
  await expect(traceScreen(page)).toHaveAttribute('data-done', 'true');
  await expect.poll(async () => (await clipsSaid(page)).filter((c) => c === 'blob').length).toBe(3);
  expect(await clipsSaid(page)).not.toContain('praise-your-name');
});

test('with small letters on, words are small letters and the name a capital then small letters', async ({ page }) => {
  await setUp(page, { words: true, name: 'Sun-Moon', small: true });
  await openWords(page, 'Sun-Moon kid');
  await page.getByRole('button', { name: 'Word sun', exact: true }).tap();
  await expect(traceScreen(page)).toHaveAttribute('data-letter', 's');
  await page.getByRole('button', { name: 'Back' }).tap();
  await page.getByRole('button', { name: 'My name', exact: true }).tap();
  await expect(traceScreen(page)).toHaveAttribute('data-letter', 'S');
  // A hyphen is a gap, not a box; each part starts with a capital.
  await expect(page.locator('.words-box')).toHaveCount(7);
  await expect(page.locator('.words-gap')).toHaveCount(1);
  expect(await page.locator('.words-box').evaluateAll((all) => all.map((b) => (b as HTMLElement).dataset.letter).join(''))).toBe(
    'SunMoon',
  );
});
