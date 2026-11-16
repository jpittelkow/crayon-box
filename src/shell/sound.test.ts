import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { memoryBackend } from '../storage/idb';
import { appStorage } from '../storage/namespaced';
import { SOUNDS, TOUCH_SOUNDS, WebAudioSound, loadSoundSettings, saveSoundSettings } from './sound';
import { PRAISE, letterClip, praiseClip, soundClip, soundUrl } from './soundFiles';

const ASSETS = join(__dirname, '../../assets/sounds');

/** A WAV file's length in seconds, from its header (16-bit PCM, as tools/sounds/prepare.mjs writes them). */
function wavSeconds(path: string): number {
  const b = readFileSync(path);
  const rate = b.readUInt32LE(24), bytesPerSecond = b.readUInt32LE(28);
  let at = 12;
  while (at < b.length - 8) {
    const id = b.toString('ascii', at, at + 4), size = b.readUInt32LE(at + 4);
    if (id === 'data') return size / bytesPerSecond;
    at += 8 + size;
  }
  throw new Error(`no data chunk in ${path} (${rate} Hz)`);
}

describe('sound files (ADR 0032)', () => {
  it('exist for every kind of sound', () => {
    for (const [kind, spec] of Object.entries(SOUNDS)) expect(soundUrl(spec.file), kind).toBeTruthy();
  });

  it('keep touch sounds under 300 ms (ADR 0016)', () => {
    for (const kind of TOUCH_SOUNDS) expect(wavSeconds(join(ASSETS, SOUNDS[kind].file)), kind).toBeLessThan(0.3);
  });

  it('have the narrator say every letter, digit and praise word', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') expect(letterClip(ch), ch).toBeTruthy();
    expect(letterClip('a')).toBe(letterClip('A'));
    for (const word of PRAISE) expect(praiseClip(word), word).toBeTruthy();
    expect(PRAISE).toHaveLength(8);
  });

  it("have the narrator say every letter's sound, small letters sharing their capital's (ADR 0037)", () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz') expect(soundClip(ch), ch).toBeTruthy();
    expect(soundClip('b')).toBe(soundClip('B'));
    expect(soundClip('b')).not.toBe(letterClip('b'));
    for (const ch of '0123456789') expect(soundClip(ch), ch).toBeUndefined();
  });

  it('are each listed with a source and license (ADR 0011)', () => {
    const manifest = JSON.parse(readFileSync(join(ASSETS, 'sounds.json'), 'utf8')) as { sounds: { file: string; license: string; url: string }[] };
    const listed = new Set(manifest.sounds.map((s) => s.file));
    for (const s of manifest.sounds) {
      expect(s.license, s.file).toBeTruthy();
      expect(s.url, s.file).toMatch(/^https:\/\//);
    }
    for (const dir of ['ui', 'voice']) for (const f of readdirSync(join(ASSETS, dir))) expect(listed.has(`${dir}/${f}`), f).toBe(true);
  });
});

describe('sounds', () => {
  it('are on until a parent turns them off', async () => {
    const shell = appStorage(memoryBackend()).shell;
    expect((await loadSoundSettings(shell)).on).toBe(true);
    await saveSoundSettings(shell, { on: false });
    expect((await loadSoundSettings(shell)).on).toBe(false);
  });

  it('play nothing, and make no audio context, while turned off', async () => {
    const shell = appStorage(memoryBackend()).shell;
    await saveSoundSettings(shell, { on: false });
    const sound = new WebAudioSound(shell);
    await sound.refresh();
    // Node has no AudioContext: playing with sound on would be caught and stay silent, but off must not even try.
    expect(() => sound.play('fill')).not.toThrow();
    expect(() => sound.scratch(0.8)).not.toThrow();
    expect(() => sound.scratch(0)).not.toThrow();
    expect((sound as unknown as { ctx: unknown }).ctx).toBeNull();
  });

  it('never throw where there is no audio', async () => {
    const sound = new WebAudioSound(appStorage(memoryBackend()).shell);
    await sound.refresh();
    expect(() => sound.play('tap')).not.toThrow();
  });
});
