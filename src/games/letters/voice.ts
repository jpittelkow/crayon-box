// Saying a letter's name (ADR 0026, 0032): a parent's own recording when they chose it and made one, else the
// app's narrator (shipped clips, see assets/sounds/sounds.json). The browser's voice is only a last resort, for a
// character with no clip. After a finished letter, the narrator adds a word of praise. Follows the app's Sounds
// switch and the game's own.
import { PRAISE, letterClip, praiseClip } from '../../shell/soundFiles';
import type { Sound } from '../../shell/types';
import type { GameStorage } from '../../storage/types';
import { findRecording, spoken, type LettersSettings } from './progress';

export class LetterVoice {
  private audio: HTMLAudioElement | null = null;
  private url: string | null = null;
  /** Bumped by every stop, so a praise waiting on a letter's name is dropped once something else starts. */
  private turn = 0;

  constructor(
    private readonly storage: GameStorage,
    private readonly settings: LettersSettings,
    private readonly sound: Sound,
    private readonly pick: () => number = Math.random,
  ) {}

  get on(): boolean {
    return this.settings.sounds && this.sound.enabled !== false;
  }

  /** Says the letter, then a random word of praise: for a finished letter (ADR 0032). */
  async sayAndPraise(ch: string): Promise<void> {
    if (!this.on) return;
    await this.say(ch);
    const turn = this.turn;
    const word = PRAISE[Math.min(PRAISE.length - 1, Math.floor(this.pick() * PRAISE.length))]!;
    const url = praiseClip(word);
    if (url && turn === this.turn) await this.play(url, turn);
  }

  /** Says the letter; resolves when it has been said. Never throws: a kid screen shows no errors (ADR 0016). */
  async say(ch: string): Promise<void> {
    if (!this.on) return;
    this.stop();
    const turn = this.turn;
    try {
      if (this.settings.voice === 'own') {
        const path = await findRecording(this.storage, ch);
        const blob = path ? await this.storage.getBlob(path) : undefined;
        if (turn !== this.turn) return;
        if (blob) {
          this.url = URL.createObjectURL(blob);
          await this.play(this.url, turn);
          return;
        }
      }
      const clip = letterClip(ch);
      if (clip) {
        await this.play(clip, turn);
        return;
      }
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(spoken(ch));
      const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('en'));
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? 'en-US';
      u.rate = 0.8;
      u.pitch = 1.15;
      speechSynthesis.speak(u);
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

  stop(): void {
    this.turn++;
    try {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    } catch {
      // ignore
    }
    this.audio?.pause();
    this.audio = null;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
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
