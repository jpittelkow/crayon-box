// What the narrator says in Kitchen (ADR 0044, 0032), from the shipped clips (`voice/food-*`, `voice/cook-*`):
//   - a thing's name when a kid picks it ("Mushroom."), the first few times per kid, as the coloring buttons do
//     (ADR 0038). A parent's setting can make it every time or never.
//   - one short line a step ("Pat the dough."), the first few times per kid.
//   - the moments ("It's ready!", "Yum!"), every time.
// One line plays at a time. A name or a moment cuts in; a step's line waits for whatever is being said, and is
// dropped if the kid has moved on to another step by then. A line counts as heard when it starts, not when it is
// asked for. Everything follows the app's Sounds switch.
import { narratorClip } from '../../shell/soundFiles';
import type { Sound } from '../../shell/types';
// The counting of names heard is the coloring game's (kept in this game's own storage, per kid).
import { NAMED_PICKS, NameCounter, saysName, type NamesSetting } from '../coloring/names';
import { nameClipOf, type Option } from './recipe';

export class KitchenVoice {
  private audio: HTMLAudioElement | null = null;
  /** Lines waiting their turn; a line's `key` is counted as heard when the line starts. */
  private waiting: { url: string; key?: string }[] = [];

  constructor(
    private readonly sound: Sound,
    private readonly counter: NameCounter,
    private readonly names: () => NamesSetting,
    private readonly random: () => number = Math.random,
  ) {}

  private get on(): boolean {
    return this.sound.enabled !== false;
  }

  /** A thing was picked: its name, cutting in, while this kid still gets names. */
  name(option: Option): void {
    const key = nameClipOf(option), url = narratorClip(key);
    if (!this.on || !url || !saysName(this.names(), this.counter.heard(key))) return;
    this.now({ url, key });
  }

  /**
   * A step opened: its lines, after anything being said, each only the first few times this kid hears it. Lines
   * still waiting from an earlier step are dropped: a kid tapping next quickly hears only where they are.
   */
  tip(keys: readonly (string | undefined)[]): void {
    this.waiting = [];
    if (!this.on) return;
    for (const key of keys) {
      const url = key && narratorClip(key);
      if (!key || !url || this.counter.heard(key) >= NAMED_PICKS) continue;
      this.waiting.push({ url, key });
    }
    this.next();
  }

  /** A moment: one of these lines, cutting in, every time. */
  moment(keys: readonly string[]): void {
    const urls = keys.map((k) => narratorClip(k)).filter((u): u is string => !!u);
    if (!this.on || !urls.length) return;
    this.now({ url: urls[Math.min(urls.length - 1, Math.floor(this.random() * urls.length))] });
  }

  stop(): void {
    this.waiting = [];
    const audio = this.audio;
    this.audio = null;
    audio?.pause();
  }

  private now(line: { url: string; key?: string }): void {
    this.stop();
    this.waiting = [line];
    this.next();
  }

  private next(): void {
    if (this.audio) return;
    const line = this.waiting.shift();
    if (!line) return;
    if (line.key) void this.counter.said(line.key);
    const audio = new Audio(line.url);
    this.audio = audio;
    const done = () => {
      if (this.audio !== audio) return;
      this.audio = null;
      this.next();
    };
    audio.addEventListener('ended', done);
    audio.addEventListener('error', done);
    // No audio device, or audio blocked: stay silent. A kid screen never shows an error (ADR 0016 rule 6).
    audio.play().catch(done);
  }
}
