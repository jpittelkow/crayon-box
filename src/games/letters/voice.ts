// Saying a letter's name (ADR 0026): a parent's own recording when they chose it and made one, else the browser's
// voice (Windows' own voices in the app). Follows the app's Sounds switch and the game's own.
import type { Sound } from '../../shell/types';
import type { GameStorage } from '../../storage/types';
import { findRecording, spoken, type LettersSettings } from './progress';

export class LetterVoice {
  private audio: HTMLAudioElement | null = null;
  private url: string | null = null;

  constructor(
    private readonly storage: GameStorage,
    private readonly settings: LettersSettings,
    private readonly sound: Sound,
  ) {}

  get on(): boolean {
    return this.settings.sounds && this.sound.enabled !== false;
  }

  /** Says the letter. Never throws: a kid screen shows no errors (ADR 0016). */
  async say(ch: string): Promise<void> {
    if (!this.on) return;
    this.stop();
    try {
      if (this.settings.voice === 'own') {
        const path = await findRecording(this.storage, ch);
        const blob = path ? await this.storage.getBlob(path) : undefined;
        if (blob) {
          this.url = URL.createObjectURL(blob);
          this.audio = new Audio(this.url);
          await this.audio.play();
          return;
        }
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

  stop(): void {
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
