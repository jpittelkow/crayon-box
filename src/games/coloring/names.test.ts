import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Effect, Sound } from '../../shell/types';
import { memoryBackend } from '../../storage/idb';
import { appStorage } from '../../storage/namespaced';
import { PALETTE } from '../../ui/palette';
import { ACTION_BUTTONS, MODE_BUTTONS, NAME_DELAY_MS, Narrator, SIZE_BUTTONS, TOOL_BUTTONS, buttonFiles, colorButton } from './buttons';
import { NAMED_PICKS, NameCounter, forgetKidNames, loadNamesSetting, saveNamesSetting, saysName } from './names';

const game = () => appStorage(memoryBackend()).game('coloring');

describe('when a button says its name (ADR 0038)', () => {
  it('says it for the first 3 picks by default, then never; or every time; or never', () => {
    expect(NAMED_PICKS).toBe(3);
    expect([0, 1, 2, 3, 4].map((n) => saysName('first', n))).toEqual([true, true, true, false, false]);
    expect([0, 3, 50].map((n) => saysName('always', n))).toEqual([true, true, true]);
    expect([0, 3].map((n) => saysName('never', n))).toEqual([false, false]);
  });

  it('is the first 3 picks until a parent changes it', async () => {
    const storage = game();
    expect(await loadNamesSetting(storage)).toBe('first');
    await saveNamesSetting(storage, 'never');
    expect(await loadNamesSetting(storage)).toBe('never');
    await saveNamesSetting(storage, 'always');
    expect(await loadNamesSetting(storage)).toBe('always');
  });
});

describe('the names counter', () => {
  it('counts each button on its own, up to 3, and keeps the counts', async () => {
    const storage = game();
    const counter = new NameCounter(storage, 'star');
    await counter.load();
    for (let i = 0; i < 5; i++) await counter.said('tool-bucket');
    await counter.said('color-red');
    expect(counter.heard('tool-bucket')).toBe(3);
    expect(counter.heard('color-red')).toBe(1);
    expect(counter.heard('tool-brush')).toBe(0);

    const again = new NameCounter(storage, 'star');
    await again.load();
    expect(again.heard('tool-bucket')).toBe(3);
    expect(again.heard('color-red')).toBe(1);
  });

  it('keeps each kid apart, and forgets a deleted kid', async () => {
    const storage = game();
    const star = new NameCounter(storage, 'star');
    await star.said('tool-eraser');
    const moon = new NameCounter(storage, 'moon');
    await moon.load();
    expect(moon.heard('tool-eraser')).toBe(0);

    await forgetKidNames(storage, 'star');
    const back = new NameCounter(storage, 'star');
    await back.load();
    expect(back.heard('tool-eraser')).toBe(0);
  });

  it('writes nothing once a button has been named 3 times', async () => {
    const storage = game();
    const counter = new NameCounter(storage, 'star');
    for (let i = 0; i < NAMED_PICKS; i++) await counter.said('size-big');
    const put = vi.spyOn(storage, 'putJson');
    await counter.said('size-big');
    expect(put).not.toHaveBeenCalled();
  });

  it('ignores a broken counts file', async () => {
    const storage = game();
    await storage.putJson('kids/star/names.json', { 'tool-brush': 'lots', 'tool-bucket': -2, 'color-red': 2 });
    const counter = new NameCounter(storage, 'star');
    await counter.load();
    expect(counter.heard('tool-brush')).toBe(0);
    expect(counter.heard('tool-bucket')).toBe(0);
    expect(counter.heard('color-red')).toBe(2);
  });
});

describe('the narrator', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** A fake sound and a fake Audio that record what was played and said. */
  function setup(enabled = true) {
    const effects: Effect[] = [];
    const said: string[] = [];
    const sound: Sound = { play() {}, effect: (e) => void effects.push(e), enabled };
    vi.stubGlobal(
      'Audio',
      class {
        constructor(readonly src: string) {}
        play() {
          said.push(this.src);
          return Promise.resolve();
        }
        pause() {}
      },
    );
    vi.useFakeTimers();
    return { effects, said, sound };
  }

  it('plays the sound at once and the name just after, for the first 3 picks; then only the sound', async () => {
    const { effects, said, sound } = setup();
    const counter = new NameCounter(game(), 'star');
    const narrator = new Narrator(sound, counter, () => 'first');
    for (let i = 0; i < 4; i++) {
      narrator.pick(TOOL_BUTTONS.bucket);
      expect(effects.length).toBe(i + 1);
      await vi.advanceTimersByTimeAsync(NAME_DELAY_MS + 10);
    }
    expect(effects.every((e) => e === TOOL_BUTTONS.bucket.effect)).toBe(true);
    expect(said).toEqual([TOOL_BUTTONS.bucket.clip, TOOL_BUTTONS.bucket.clip, TOOL_BUTTONS.bucket.clip]);
  });

  it('names only the last of quick picks, and counts only names said', async () => {
    const { said, sound } = setup();
    const counter = new NameCounter(game(), 'star');
    const narrator = new Narrator(sound, counter, () => 'first');
    narrator.pick(colorButton('red'));
    narrator.pick(colorButton('blue'));
    await vi.advanceTimersByTimeAsync(NAME_DELAY_MS + 10);
    expect(said).toEqual([colorButton('blue').clip]);
    expect(counter.heard('color-red')).toBe(0);
    expect(counter.heard('color-blue')).toBe(1);
  });

  it('tells when it has gone quiet: after a name waiting and said, or at once when stopped (the show-how waits)', async () => {
    const { sound } = setup();
    let playing: { onended: (() => void) | null } | undefined;
    vi.stubGlobal(
      'Audio',
      class {
        onended: (() => void) | null = null;
        constructor(readonly src: string) {}
        play() {
          playing = this;
          return Promise.resolve();
        }
        pause() {}
      },
    );
    const narrator = new Narrator(sound, new NameCounter(game(), 'star'), () => 'always');
    let quiet = false;
    await narrator.quiet();
    narrator.pick(TOOL_BUTTONS.eraser);
    void narrator.quiet().then(() => (quiet = true));
    await vi.advanceTimersByTimeAsync(NAME_DELAY_MS + 10);
    expect(playing).toBeDefined();
    expect(quiet).toBe(false);
    playing!.onended!();
    await vi.advanceTimersByTimeAsync(0);
    expect(quiet).toBe(true);

    quiet = false;
    narrator.pick(TOOL_BUTTONS.brush);
    void narrator.quiet().then(() => (quiet = true));
    narrator.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(quiet).toBe(true);
  });

  it('says nothing with names set to never, or with sounds off', async () => {
    const never = setup();
    new Narrator(never.sound, new NameCounter(game(), 'star'), () => 'never').pick(TOOL_BUTTONS.brush);
    await vi.advanceTimersByTimeAsync(NAME_DELAY_MS + 10);
    expect(never.said).toEqual([]);
    expect(never.effects.length).toBe(1);

    const off = setup(false);
    new Narrator(off.sound, new NameCounter(game(), 'star'), () => 'always').pick(TOOL_BUTTONS.brush);
    await vi.advanceTimersByTimeAsync(NAME_DELAY_MS + 10);
    expect(off.said).toEqual([]);
  });
});

/** A WAV file's length in seconds, from its header (16-bit PCM, as tools/sounds/prepare.mjs writes them). */
function wavSeconds(path: string): number {
  const b = readFileSync(path);
  const bytesPerSecond = b.readUInt32LE(28);
  for (let at = 12; at < b.length - 8; at += 8 + b.readUInt32LE(at + 4)) {
    if (b.toString('ascii', at, at + 4) === 'data') return b.readUInt32LE(at + 4) / bytesPerSecond;
  }
  throw new Error(`no data chunk in ${path}`);
}

describe('the buttons', () => {
  const all = [
    ...Object.values(TOOL_BUTTONS),
    ...Object.values(ACTION_BUTTONS),
    ...SIZE_BUTTONS,
    ...Object.values(MODE_BUTTONS),
    ...PALETTE.map((c) => colorButton(c.token)),
  ];

  it('each have a narrator clip: tools, actions, sizes, modes and all 24 colors', () => {
    expect(PALETTE.length).toBe(24);
    for (const b of all) expect(b.clip, b.key).toBeTruthy();
    expect(new Set(all.map((b) => b.key)).size).toBe(all.length);
  });

  it('each have a sound from a shipped file, under 300 ms as played (ADR 0016)', () => {
    for (const b of all) {
      const file = join(__dirname, '../../../assets/sounds', b.effect.file);
      const played = Math.min(wavSeconds(file) / (b.effect.rate ?? 1), b.effect.seconds ?? Infinity);
      expect(played, b.key).toBeLessThan(0.3);
    }
    expect(buttonFiles()).toEqual(expect.arrayContaining([...new Set(all.map((b) => b.effect.file))]));
  });

  it('sound different for each tool, size and mode', () => {
    const sig = (e: Effect) => `${e.file}@${e.rate ?? 1}`;
    const picks = [...Object.values(TOOL_BUTTONS), ...SIZE_BUTTONS, ...Object.values(MODE_BUTTONS)].map((b) => sig(b.effect));
    expect(new Set(picks).size).toBe(picks.length);
  });
});
