// Sounds (ADR 0016): one short, soft, wordless sound per kind of touch, under 300 ms. Made with the browser's
// audio engine from plain tones, so there are no sound files to license (ADR 0011). A parent can turn them off
// (ADR 0016: sounds are a parent setting); the setting is its own file so it syncs on its own (ADR 0024).
import type { GameStorage } from '../storage/types';
import type { Sound, SoundKind } from './types';

const PATH = 'sounds.json';

export interface SoundSettings {
  on: boolean;
}

export async function loadSoundSettings(shell: GameStorage): Promise<SoundSettings> {
  return { on: true, ...(await shell.getJson<Partial<SoundSettings>>(PATH)) };
}

export async function saveSoundSettings(shell: GameStorage, settings: SoundSettings): Promise<void> {
  await shell.putJson(PATH, settings);
}

/** A sound that does nothing: for tests, and before the setting has loaded. */
export const silentSound: Sound = {
  play() {},
  enabled: false,
};

interface Note {
  /** Frequency in Hz. */
  f: number;
  /** Start, seconds after the touch. */
  at: number;
  /** Length in seconds. */
  len: number;
  /** Peak loudness, 0..1. */
  gain: number;
  wave?: OscillatorType;
}

/** The notes for each kind of touch. Gentle sine tones; nothing buzzes or scolds (ADR 0016: no failure buzz). */
export const SOUNDS: Record<SoundKind, Note[]> = {
  // A light tick for picking something.
  tap: [{ f: 880, at: 0, len: 0.07, gain: 0.12 }],
  // Two rising notes for a fill: the most rewarding touch.
  fill: [
    { f: 523, at: 0, len: 0.1, gain: 0.14 },
    { f: 784, at: 0.08, len: 0.16, gain: 0.14 },
  ],
  // Two falling notes for undo: taking a step back.
  undo: [
    { f: 784, at: 0, len: 0.09, gain: 0.12 },
    { f: 587, at: 0.07, len: 0.12, gain: 0.12 },
  ],
  // A soft low note when a touch had nothing to do. Quiet on purpose.
  nothing: [{ f: 262, at: 0, len: 0.12, gain: 0.08, wave: 'triangle' }],
  // Three rising notes when a letter is done (ADR 0026).
  cheer: [
    { f: 523, at: 0, len: 0.1, gain: 0.14 },
    { f: 659, at: 0.08, len: 0.1, gain: 0.14 },
    { f: 784, at: 0.16, len: 0.13, gain: 0.15 },
  ],
};

/** The longest sound, in seconds. ADR 0016 keeps every sound under 300 ms. */
export function soundLength(kind: SoundKind): number {
  return Math.max(...SOUNDS[kind].map((n) => n.at + n.len));
}

/**
 * Sounds through the Web Audio API. The audio context is made on the first play, which always comes from a touch,
 * as browsers require. `refresh` reloads the parent's on/off setting.
 */
export class WebAudioSound implements Sound {
  private ctx: AudioContext | null = null;
  private on = true;

  constructor(private readonly shell: GameStorage) {}

  get enabled(): boolean {
    return this.on;
  }

  async refresh(): Promise<void> {
    this.on = (await loadSoundSettings(this.shell)).on;
  }

  play(kind: SoundKind): void {
    if (!this.on) return;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      const now = this.ctx.currentTime;
      for (const note of SOUNDS[kind]) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = note.wave ?? 'sine';
        osc.frequency.value = note.f;
        // A quick rise and a smooth fall, so no note clicks.
        const start = now + note.at;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(note.gain, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + note.len);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + note.len + 0.02);
      }
    } catch {
      // No audio device, or audio blocked: stay silent. A kid screen never shows an error (ADR 0016 rule 6).
    }
  }
}
