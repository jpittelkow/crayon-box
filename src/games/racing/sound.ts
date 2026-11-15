// The driving game's sounds, made by the browser as it plays: no sound files, so nothing to license (ADR 0011).
// Placeholders until the app has real sounds and a sound setting (milestone 1 phase D); a parent can switch them
// off for this game in the parent area meanwhile.

export class DrivingSound {
  private ctx: AudioContext | null = null;
  private lastBump = 0;

  constructor(private readonly enabled: boolean) {}

  /** Browsers allow sound only after a touch or key press, so this runs on each one. */
  unlock(): void {
    if (!this.enabled) return;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private running(): AudioContext | null {
    return this.ctx && this.ctx.state === 'running' ? this.ctx : null;
  }

  private tone(type: OscillatorType, from: number, to: number, length: number, volume: number, delay = 0): void {
    const ctx = this.running();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(to, start + length);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + length + 0.02);
  }

  /** A bump, pitched by the kind of prop: cone, crate, ball, bale. */
  bump(kind: number): void {
    const ctx = this.running();
    if (!ctx || ctx.currentTime - this.lastBump < 0.05) return;
    this.lastBump = ctx.currentTime;
    const pitch = [520, 180, 340, 120][kind] ?? 240;
    this.tone(kind === 1 || kind === 3 ? 'triangle' : 'sine', pitch, pitch * 0.45, 0.14, 0.25);
  }

  /** A burst of hiss that slides from bright to dull. Longer and deeper for the flood. */
  splash(big: boolean): void {
    const ctx = this.running();
    if (!ctx) return;
    const length = big ? 0.55 : 0.28;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(big ? 2600 : 3800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(big ? 350 : 700, ctx.currentTime + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(big ? 0.45 : 0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + length);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
  }

  horn(): void {
    this.tone('square', 392, 392, 0.16, 0.12);
    this.tone('square', 494, 494, 0.26, 0.12, 0.18);
  }

  close(): void {
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
