// What each coloring button sounds like and what it is called (ADR 0038): every tool, size, mode, color and action
// has its own sound, then the narrator says its name the first few times a kid picks it (names.ts).
//
// The sounds are stand-ins (ADR 0032, sounds recipe "A"): shipped files, re-pitched and cut short, until real
// takes are made. Every one stays under 300 ms (ADR 0016: touch sounds are short).
import { narratorClip } from '../../shell/soundFiles';
import type { ColoringMode, Effect, Sound } from '../../shell/types';
import type { Tool } from './engine/engine';
import { NameCounter, saysName, type NamesSetting } from './names';

/** A button's sound and name. `key` is what the name counter counts; `clip` the narrator's line, when there is one. */
export interface ButtonVoice {
  key: string;
  clip?: string;
  effect: Effect;
}

const button = (key: string, effect: Effect): ButtonVoice => ({ key, clip: narratorClip(key), effect });

export const TOOL_BUTTONS: Record<Tool, ButtonVoice> = {
  // Stand-in: a splash, raised a little.
  bucket: button('tool-bucket', { file: 'drive/splash.wav', gain: 0.7, rate: 1.25, seconds: 0.28 }),
  // Stand-in: a quick swish of the crayon loop.
  brush: button('tool-brush', { file: 'ui/crayon.wav', gain: 0.9, rate: 1.3, seconds: 0.22 }),
  // Stand-in: the crayon loop slowed down and soft, a rub.
  eraser: button('tool-eraser', { file: 'ui/crayon.wav', gain: 0.6, rate: 0.7, seconds: 0.25 }),
};

export type Action = 'undo' | 'start-over' | 'back';

export const ACTION_BUTTONS: Record<Action, ButtonVoice> = {
  // The undo sound is already a short rewind.
  undo: button('tool-undo', { file: 'ui/undo.wav', gain: 0.9 }),
  // Stand-in: the start of the page turn.
  'start-over': button('tool-start-over', { file: 'ui/page.wav', gain: 0.8, rate: 1.15, seconds: 0.28 }),
  back: button('tool-back', { file: 'ui/tap.wav' }),
};

/** Small, medium and big, in the tray's order: a small, a middle and a big pop (stand-in: the tap, re-pitched). */
export const SIZE_BUTTONS: readonly ButtonVoice[] = [
  button('size-small', { file: 'ui/tap.wav', rate: 1.5 }),
  button('size-medium', { file: 'ui/tap.wav', rate: 1.05 }),
  button('size-big', { file: 'ui/tap.wav', rate: 0.7 }),
];

export const MODE_BUTTONS: Record<ColoringMode, ButtonVoice> = {
  // Stand-in: a boing, for paint that goes anywhere.
  free: button('mode-free', { file: 'drive/boing.wav', gain: 0.7, rate: 1.35, seconds: 0.26 }),
  // Stand-in: a soft bump, for paint that stops at the line.
  lines: button('mode-lines', { file: 'drive/bump.wav', gain: 0.8, rate: 1.2, seconds: 0.25 }),
};

/** A paint color, by its palette token (`red`, `light-pink`, `rainbow`). Stand-in sound: a dab of the crayon. */
export function colorButton(token: string): ButtonVoice {
  return button(`color-${token}`, { file: 'ui/crayon.wav', gain: 0.8, rate: 1.6, seconds: 0.12 });
}

/** Every effect file the buttons use, to load ahead of the first touch. */
export function buttonFiles(): string[] {
  const all = [...Object.values(TOOL_BUTTONS), ...Object.values(ACTION_BUTTONS), ...SIZE_BUTTONS, ...Object.values(MODE_BUTTONS), colorButton('red')];
  return [...new Set(all.map((b) => b.effect.file))];
}

/** The pause between a button's sound and its name, so the two don't talk over each other. */
export const NAME_DELAY_MS = 220;

/**
 * Plays buttons' sounds and says their names (ADR 0038). A new pick cuts off the name still being said or waiting to
 * be said, so a kid tapping along the colors hears the one they stopped on. Follows the app's Sounds switch. Never
 * throws: a kid screen shows no errors (ADR 0016).
 */
export class Narrator {
  private audio: HTMLAudioElement | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly sound: Sound,
    private readonly counter: NameCounter,
    private readonly setting: () => NamesSetting,
  ) {}

  private get on(): boolean {
    return this.sound.enabled !== false;
  }

  /** A button was picked: its sound now, then its name if this kid should still hear it. */
  pick(b: ButtonVoice): void {
    this.sound.effect?.(b.effect);
    this.stop();
    if (!this.on || !b.clip || !saysName(this.setting(), this.counter.heard(b.key))) return;
    const clip = b.clip;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.counter.said(b.key);
      this.say(clip);
    }, NAME_DELAY_MS);
  }

  /** Says one narrator clip by URL, cutting off any other. For later lines too (the show-how, ADR 0038 part 3). */
  say(url: string): void {
    if (!this.on) return;
    this.audio?.pause();
    try {
      const audio = new Audio(url);
      this.audio = audio;
      void audio.play().catch(() => {});
    } catch {
      // No audio here: stay quiet.
    }
  }

  /** Stops a name being said or waiting to be. */
  stop(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.audio?.pause();
    this.audio = null;
  }
}
