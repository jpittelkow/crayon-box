// Placeholder sounds made with the browser's own oscillators, so the test needs no sound files and neither
// library's audio code. Browsers only allow sound after a touch or key press, so it starts on the first one.

let ctx: AudioContext | null = null;
let lastBonk = 0;

export function unlockSound(): void {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(type: OscillatorType, from: number, to: number, length: number, volume: number, delay = 0): void {
  if (!ctx || ctx.state !== 'running') return;
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
export function bonk(kind: number): void {
  if (!ctx || ctx.currentTime - lastBonk < 0.05) return;
  lastBonk = ctx.currentTime;
  const pitch = [520, 180, 340, 120][kind] ?? 240;
  tone(kind === 1 || kind === 3 ? 'triangle' : 'sine', pitch, pitch * 0.45, 0.14, 0.25);
}

/** A splash: a short burst of hiss that slides from bright to dull. Longer and deeper for the flood. */
export function splash(big: boolean): void {
  if (!ctx || ctx.state !== 'running') return;
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

export function horn(): void {
  tone('square', 392, 392, 0.16, 0.12);
  tone('square', 494, 494, 0.26, 0.12, 0.18);
}
