// Sounds (ADR 0016, 0032): one short, soft, wordless sound per kind of touch, played from the files the app ships
// (recorded CC0 sounds, see assets/sounds/sounds.json). Touch sounds stay under 300 ms; the cheer and the page
// turn are moments, not touches, and run longer. A parent can turn them off (ADR 0016: sounds are a parent
// setting); the setting is its own file so it syncs on its own (ADR 0024).
import type { GameStorage } from '../storage/types';
import { soundUrl } from './soundFiles';
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
};

/** The kinds that answer a touch: they stay under 300 ms (ADR 0016). */
export const TOUCH_SOUNDS: SoundKind[] = ['tap', 'fill', 'undo', 'nothing'];

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
      for (const spec of Object.values(SOUNDS)) void this.buffer(ctx, spec.file);
    } catch {
      // No audio here: stay silent.
    }
  }

  play(kind: SoundKind): void {
    if (!this.on) return;
    try {
      const ctx = this.context();
      if (ctx.state === 'suspended') void ctx.resume();
      const spec = SOUNDS[kind];
      void this.buffer(ctx, spec.file).then((buf) => {
        if (!buf) return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = spec.rate;
        const gain = ctx.createGain();
        gain.gain.value = spec.gain;
        src.connect(gain).connect(ctx.destination);
        src.start();
      });
    } catch {
      // No audio device, or audio blocked: stay silent. A kid screen never shows an error (ADR 0016 rule 6).
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
