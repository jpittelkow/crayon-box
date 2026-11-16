// Sounds (ADR 0016, 0032): one short, soft, wordless sound per kind of touch, played from the files the app ships
// (recorded CC0 sounds, see assets/sounds/sounds.json). Touch sounds stay under 300 ms; the cheer and the page
// turn are moments, not touches, and run longer. A parent can turn them off (ADR 0016: sounds are a parent
// setting); the setting is its own file so it syncs on its own (ADR 0024).
import type { GameStorage } from '../storage/types';
import { soundUrl } from './soundFiles';
import type { Effect, Sound, SoundKind } from './types';

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

/** How each kind of sound plays: which file, how loud, and how fast (a lower rate is also a lower pitch). */
export interface SoundSpec {
  file: string;
  gain: number;
  rate: number;
}

/**
 * The file for each kind (ADR 0032). The files are levelled to one loudness, so `gain` only sets the mix. Nothing
 * buzzes or scolds (ADR 0016: no failure buzz): a touch with nothing to do is the tap, quieter and lower.
 */
export const SOUNDS: Record<SoundKind, SoundSpec> = {
  tap: { file: 'ui/tap.wav', gain: 1, rate: 1 },
  fill: { file: 'ui/fill.wav', gain: 1, rate: 1 },
  undo: { file: 'ui/undo.wav', gain: 0.9, rate: 1 },
  nothing: { file: 'ui/tap.wav', gain: 0.4, rate: 0.75 },
  cheer: { file: 'ui/cheer.wav', gain: 1, rate: 1 },
  page: { file: 'ui/page.wav', gain: 0.8, rate: 1 },
  // A stroke of a letter traced (ADR 0037): quieter and higher than the finished letter's bell. Stand-in: the bell
  // itself, pitched up, until a CC0 chime of its own (sounds recipe, way B).
  chime: { file: 'ui/cheer.wav', gain: 0.4, rate: 1.6 },
};

/** The kinds that answer a touch: they stay under 300 ms (ADR 0016). */
export const TOUCH_SOUNDS: SoundKind[] = ['tap', 'fill', 'undo', 'nothing'];

/** The crayon on paper while a finger draws: a seamless loop whose loudness follows the finger (ADR 0032). */
export const CRAYON = { file: 'ui/crayon.wav', gain: 0.7 };

/**
 * Sounds through the Web Audio API, from the shipped files. `refresh` reloads the parent's on/off setting and, with
 * sounds on, decodes the files ahead of the first touch (decoding works before a touch; playing waits for one, as
 * browsers require). A sound asked for before its file is ready plays as soon as it is.
 */
export class WebAudioSound implements Sound {
  private ctx: AudioContext | null = null;
  private on = true;
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();

  constructor(private readonly shell: GameStorage) {}

  get enabled(): boolean {
    return this.on;
  }

  async refresh(): Promise<void> {
    this.on = (await loadSoundSettings(this.shell)).on;
    if (!this.on) return;
    try {
      const ctx = this.context();
      for (const spec of [...Object.values(SOUNDS), CRAYON]) void this.buffer(ctx, spec.file);
    } catch {
      // No audio here: stay silent.
    }
  }

  play(kind: SoundKind): void {
    this.effect(SOUNDS[kind]);
  }

  effect(spec: Effect): void {
    if (!this.on) return;
    try {
      const ctx = this.context();
      if (ctx.state === 'suspended') void ctx.resume();
      void this.buffer(ctx, spec.file).then((buf) => {
        if (!buf) return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = spec.rate ?? 1;
        const gain = ctx.createGain();
        const level = spec.gain ?? 1;
        gain.gain.value = level;
        src.connect(gain).connect(ctx.destination);
        if (spec.seconds === undefined) {
          src.start();
          return;
        }
        // Only the start of the file: a short fade at the end, so it doesn't stop with a click.
        const t = ctx.currentTime, fade = Math.min(0.04, spec.seconds / 3);
        gain.gain.setValueAtTime(level, t + spec.seconds - fade);
        gain.gain.linearRampToValueAtTime(0, t + spec.seconds);
        src.start(t, 0, spec.seconds * (spec.rate ?? 1));
      });
    } catch {
      // No audio device, or audio blocked: stay silent. A kid screen never shows an error (ADR 0016 rule 6).
    }
  }

  preload(files: readonly string[]): void {
    if (!this.on) return;
    try {
      const ctx = this.context();
      for (const file of files) void this.buffer(ctx, file);
    } catch {
      // No audio here: stay silent.
    }
  }

  private crayon: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private crayonStop: ReturnType<typeof setTimeout> | undefined;
  private crayonLevel = 0;
  private crayonRate = 1;

  /**
   * The crayon sound: `level` 0 fades it out, up to 1 for a fast scribble; `rate` above 1 plays it higher. Called on
   * every move of a drawing finger.
   */
  scratch(level: number, rate = 1): void {
    this.crayonLevel = level;
    this.crayonRate = rate;
    try {
      clearTimeout(this.crayonStop);
      if (level <= 0) {
        const c = this.crayon, ctx = this.ctx;
        if (!c || !ctx) return;
        c.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        // Stop the loop once it has faded, rather than keep a silent one running.
        this.crayonStop = setTimeout(() => {
          try {
            c.src.stop();
          } catch {
            // already stopped
          }
          if (this.crayon === c) this.crayon = null;
        }, 400);
        return;
      }
      if (!this.on) return;
      const ctx = this.context();
      if (ctx.state === 'suspended') void ctx.resume();
      void this.buffer(ctx, CRAYON.file).then((buf) => {
        // The finger may have lifted while the file was loading.
        if (!buf || this.crayonLevel <= 0) return;
        if (!this.crayon) {
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          const gain = ctx.createGain();
          gain.gain.value = 0;
          src.connect(gain).connect(ctx.destination);
          // Start somewhere new in the loop each time, so strokes don't all begin with the same scrape.
          src.start(0, Math.random() * buf.duration);
          this.crayon = { src, gain };
        }
        this.crayon.src.playbackRate.value = this.crayonRate;
        this.crayon.gain.gain.setTargetAtTime(CRAYON.gain * Math.min(1, this.crayonLevel), ctx.currentTime, 0.03);
      });
    } catch {
      // No audio: stay silent.
    }
  }

  private context(): AudioContext {
    return (this.ctx ??= new AudioContext());
  }

  private buffer(ctx: AudioContext, file: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(file);
    if (!p) {
      const url = soundUrl(file);
      p = url
        ? fetch(url)
            .then((r) => r.arrayBuffer())
            .then((data) => ctx.decodeAudioData(data))
            .catch(() => null)
        : Promise.resolve(null);
      this.buffers.set(file, p);
    }
    return p;
  }
}
