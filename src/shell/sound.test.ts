import { describe, expect, it } from 'vitest';
import { memoryBackend } from '../storage/idb';
import { appStorage } from '../storage/namespaced';
import { SOUNDS, WebAudioSound, loadSoundSettings, saveSoundSettings, soundLength } from './sound';

describe('sounds', () => {
  it('are on until a parent turns them off', async () => {
    const shell = appStorage(memoryBackend()).shell;
    expect((await loadSoundSettings(shell)).on).toBe(true);
    await saveSoundSettings(shell, { on: false });
    expect((await loadSoundSettings(shell)).on).toBe(false);
  });

  it('are all shorter than 300 ms (ADR 0016)', () => {
    for (const kind of Object.keys(SOUNDS) as (keyof typeof SOUNDS)[]) {
      expect(soundLength(kind), kind).toBeLessThan(0.3);
    }
  });

  it('play nothing, and make no audio context, while turned off', async () => {
    const shell = appStorage(memoryBackend()).shell;
    await saveSoundSettings(shell, { on: false });
    const sound = new WebAudioSound(shell);
    await sound.refresh();
    // Node has no AudioContext: playing with sound on would be caught and stay silent, but off must not even try.
    expect(() => sound.play('fill')).not.toThrow();
    expect((sound as unknown as { ctx: unknown }).ctx).toBeNull();
  });

  it('never throw where there is no audio', async () => {
    const sound = new WebAudioSound(appStorage(memoryBackend()).shell);
    await sound.refresh();
    expect(() => sound.play('tap')).not.toThrow();
  });
});
