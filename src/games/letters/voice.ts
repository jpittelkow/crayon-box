// Saying a letter (ADR 0026, 0032, 0037): its name, its sound, or both, as a parent chose. Each part is a parent's
// own recording when they chose their own voice and made one, else the app's narrator (shipped clips, see
// assets/sounds/sounds.json). The browser's voice is only a last resort, for a character with no clip. After a
// finished letter, the narrator adds a word of praise. Follows the app's Sounds switch and the game's own.
//
// A small line queue (ADR 0037): a line is one or more clips said back to back, and only one line plays at a time.
// While a finger is on the letter no new line starts; a line asked for meanwhile waits, and a newer one replaces
// it. Opening a letter, finishing it or tapping it cuts in at once instead (`say`, `sayFinished`). A hint's line
// (`tip`) is never kept for later: it is dropped when a finger is down, and a finger going down drops it if it waits.
import { PRAISE, letterClip, praiseClip, soundClip, type Praise } from '../../shell/soundFiles';
import type { Sound } from '../../shell/types';
import type { GameStorage } from '../../storage/types';
import { findRecording, spoken, type LettersSettings, type Said, type Saying } from './progress';

/** One clip of a line: a shipped file, a parent's recording (a storage path), or the browser's voice. */
export type Part = { clip: string } | { own: string } | { speech: string };

/** What is said for a letter, in order, by the setting. A digit has no sound, so it is always its name. */
export function partsFor(saying: Saying, ch: string): Said[] {
  if (!soundClip(ch)) return ['name'];
  return saying === 'name' ? ['name'] : saying === 'sound' ? ['sound'] : ['name', 'sound'];
}

/**
 * A word of praise for a finished letter (research 4.1): never the one said last time, and "All by yourself!" only
 * when the kid needed no hint.
 */
export function pickPraise(last: Praise | null, helped: boolean, random: () => number = Math.random): Praise {
  const pool = PRAISE.filter((w) => w !== last && !(helped && w === 'by-yourself'));
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!;
}

/** The parts that say a letter: each from a parent's recording when chosen and made, else the narrator. */
export async function letterParts(storage: GameStorage, settings: LettersSettings, ch: string): Promise<Part[]> {
  const out: Part[] = [];
  for (const what of partsFor(settings.saying, ch)) {
    const own = settings.voice === 'own' ? await findRecording(storage, ch, what) : undefined;
    const clip = what === 'sound' ? soundClip(ch) : letterClip(ch);
    out.push(own ? { own } : clip ? { clip } : { speech: spoken(ch) });
  }
  return out;
}

export class LetterVoice {
  private audio: HTMLAudioElement | null = null;
  private urls: string[] = [];
  /** Bumped by every stop, so a line being looked up or played is dropped once something else starts. */
  private turn = 0;
  private playing = false;
  private waiting: Part[] | null = null;
  /** The line waiting is a hint's, dropped when a finger goes down. */
  private waitingTip = false;
  private held = false;
  private lastPraise: Praise | null = null;

  constructor(
    private readonly storage: GameStorage,
    private readonly settings: LettersSettings,
    private readonly sound: Sound,
    private readonly random: () => number = Math.random,
  ) {}

  get on(): boolean {
    return this.settings.sounds && this.sound.enabled !== false;
  }

  /** Whether the hints may speak: sounds on, and the parent's spoken-tips switch on (ADR 0037). */
  get tipsOn(): boolean {
    return this.on && this.settings.tips;
  }

  /**
   * A hint's line (a tip, a stroke word, "Your turn!"): now when nothing is said, after the line being said, and
   * dropped when a finger is on the letter: the kid has moved on.
   */
  tip(clips: (string | undefined)[]): void {
    const parts = clips.filter((c): c is string => !!c).map((clip) => ({ clip }));
    if (!this.tipsOn || this.held || parts.length === 0) return;
    void this.line(parts);
    if (this.waiting === parts) this.waitingTip = true;
  }

  /** Says the letter as the setting asks, cutting in: when a letter opens, or a finished one is tapped. */
  async say(ch: string): Promise<void> {
    if (!this.on) return;
    this.stop();
    const turn = this.turn;
    const parts = await this.lookUp(ch);
    if (turn === this.turn) await this.line(parts);
  }

  /** Says the letter, then a word of praise, cutting in: for a finished letter (ADR 0032). */
  async sayFinished(ch: string, helped: boolean): Promise<void> {
    if (!this.on) return;
    this.stop();
    const turn = this.turn;
    const parts = await this.lookUp(ch);
    const word = pickPraise(this.lastPraise, helped, this.random);
    this.lastPraise = word;
    const praise = praiseClip(word);
    if (turn === this.turn) await this.line(praise ? [...parts, { clip: praise }] : parts);
  }

  /** A finger is on the letter (true) or every finger has lifted (false): no new line starts while one is. */
  hold(down: boolean): void {
    this.held = down;
    if (down && this.waitingTip) {
      this.waiting = null;
      this.waitingTip = false;
    }
    if (!down && !this.playing && this.waiting) {
      const next = this.waiting;
      this.waiting = null;
      this.waitingTip = false;
      void this.run(next, this.turn);
    }
  }

  /** Queues a line: now when nothing is said and no finger is down, else after, replacing any line still waiting. */
  line(parts: Part[]): Promise<void> {
    if (!this.on || parts.length === 0) return Promise.resolve();
    if (this.playing || this.held) {
      this.waiting = parts;
      this.waitingTip = false;
      return Promise.resolve();
    }
    return this.run(parts, this.turn);
  }

  private async lookUp(ch: string): Promise<Part[]> {
    try {
      return await letterParts(this.storage, this.settings, ch);
    } catch {
      // Storage failed: the narrator alone.
      return partsFor(this.settings.saying, ch).map((what) => ({
        clip: (what === 'sound' ? soundClip(ch) : letterClip(ch)) ?? '',
      }));
    }
  }

  private async run(parts: Part[], turn: number): Promise<void> {
    this.playing = true;
    for (const part of parts) {
      await this.playPart(part, turn);
      if (turn !== this.turn) return;
    }
    this.playing = false;
    this.revoke();
    if (!this.held && this.waiting) {
      const next = this.waiting;
      this.waiting = null;
      this.waitingTip = false;
      await this.run(next, turn);
    }
  }

  /** Plays one part; resolves when it ends, fails, or is stopped. Never throws: a kid screen shows no errors. */
  private async playPart(part: Part, turn: number): Promise<void> {
    try {
      if ('clip' in part) {
        if (part.clip) await this.play(part.clip, turn);
      } else if ('own' in part) {
        const blob = await this.storage.getBlob(part.own);
        if (!blob || turn !== this.turn) return;
        const url = URL.createObjectURL(blob);
        this.urls.push(url);
        await this.play(url, turn);
      } else {
        await this.speak(part.speech, turn);
      }
    } catch {
      // No voice or no audio: stay quiet.
    }
  }

  /** Plays one clip; resolves when it ends, fails, or is stopped. */
  private play(url: string, turn: number): Promise<void> {
    if (turn !== this.turn) return Promise.resolve();
    this.audio?.pause();
    const audio = new Audio(url);
    this.audio = audio;
    return new Promise<void>((resolve) => {
      const done = () => resolve();
      audio.addEventListener('ended', done, { once: true });
      audio.addEventListener('error', done, { once: true });
      audio.addEventListener('pause', done, { once: true });
      audio.play().catch(done);
    });
  }

  private speak(text: string, turn: number): Promise<void> {
    if (turn !== this.turn || !('speechSynthesis' in window)) return Promise.resolve();
    const u = new SpeechSynthesisUtterance(text);
    const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('en'));
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'en-US';
    u.rate = 0.8;
    u.pitch = 1.15;
    return new Promise<void>((resolve) => {
      u.addEventListener('end', () => resolve(), { once: true });
      u.addEventListener('error', () => resolve(), { once: true });
      // Some browsers never say "end" for a cancelled line; a letter's name is well under this.
      setTimeout(resolve, 3000);
      speechSynthesis.speak(u);
    });
  }

  private revoke(): void {
    for (const url of this.urls.splice(0)) URL.revokeObjectURL(url);
  }

  /** Stops whatever is being said and drops any line waiting. */
  stop(): void {
    this.turn++;
    this.playing = false;
    this.waiting = null;
    this.waitingTip = false;
    try {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    } catch {
      // ignore
    }
    this.audio?.pause();
    this.audio = null;
    this.revoke();
  }
}

/** Records a short clip from the microphone, for the parent area. Rejects when there is no microphone. */
export async function recordClip(ms = 1600): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  try {
    const recorder = new MediaRecorder(stream);
    const parts: Blob[] = [];
    recorder.addEventListener('dataavailable', (e) => parts.push(e.data));
    const stopped = new Promise<void>((resolve) => recorder.addEventListener('stop', () => resolve()));
    recorder.start();
    await new Promise((r) => setTimeout(r, ms));
    recorder.stop();
    await stopped;
    return new Blob(parts, { type: recorder.mimeType || 'audio/webm' });
  } finally {
    for (const track of stream.getTracks()) track.stop();
  }
}
