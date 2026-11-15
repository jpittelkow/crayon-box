// The driving game's sounds (ADR 0025), made by the browser as it plays: no sound files, so nothing to license
// (ADR 0011). Every vehicle has an engine voice of its own whose pitch and loudness follow its speed; traffic is
// heard only nearby. Effects: bumps per prop kind, splashes, tyre squeal, brake squeak and the horn.
import { MAX_SPEED, type Input, type VehicleKind, type World } from './sim/sim';

/** How a kind of vehicle's engine sounds. A new vehicle gets a new entry. */
export interface EngineVoice {
  /** Main and second oscillator shapes. */
  wave: OscillatorType;
  sub: OscillatorType;
  /** Pitch at idle, and how much it rises per metre a second. */
  idleHz: number;
  perSpeed: number;
  /** Brightness: the filter's cut-off at idle and how far it opens with speed. */
  toneHz: number;
  tonePerSpeed: number;
  /** A throb in the loudness: rate at idle, rate added per metre a second, and depth (0..1). */
  throbHz: number;
  throbPerSpeed: number;
  throb: number;
  /** Loudness at full speed. */
  volume: number;
}

export const ENGINES: Record<VehicleKind, EngineVoice> = {
  // A small car hums.
  car: { wave: 'sawtooth', sub: 'square', idleHz: 72, perSpeed: 8, toneHz: 700, tonePerSpeed: 45, throbHz: 0, throbPerSpeed: 0, throb: 0, volume: 0.09 },
  // A police car runs higher and brighter.
  police: { wave: 'sawtooth', sub: 'sawtooth', idleHz: 88, perSpeed: 10, toneHz: 1000, tonePerSpeed: 60, throbHz: 0, throbPerSpeed: 0, throb: 0, volume: 0.08 },
  // A monster truck rumbles low.
  monster: { wave: 'square', sub: 'sawtooth', idleHz: 40, perSpeed: 4.5, toneHz: 420, tonePerSpeed: 25, throbHz: 9, throbPerSpeed: 0.4, throb: 0.45, volume: 0.12 },
  // A school bus chugs like a diesel.
  bus: { wave: 'square', sub: 'square', idleHz: 46, perSpeed: 3.5, toneHz: 380, tonePerSpeed: 18, throbHz: 5, throbPerSpeed: 0.7, throb: 0.7, volume: 0.1 },
};

/** Traffic further away than this is not heard. */
const HEARING_M = 40;

/** How loud a vehicle's engine is: the kid's own car always, traffic fading with distance. */
export function engineLoudness(world: World, index: number): number {
  const c = world.cars[index]!;
  const effort = 0.35 + 0.65 * Math.min(1, c.speed / MAX_SPEED);
  const base = ENGINES[c.kind].volume * effort;
  if (index === 0) return base;
  const kid = world.cars[0]!;
  const d = Math.hypot(c.x - kid.x, c.z - kid.z);
  if (d > HEARING_M) return 0;
  return base * 0.8 / (1 + (d / 8) ** 2);
}

interface Running {
  osc: OscillatorNode;
  sub: OscillatorNode;
  throb: OscillatorNode;
  throbDepth: GainNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

export class DrivingSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engines: Running[] = [];
  private squeal: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastBump = 0;
  private braking = false;

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

  private out(ctx: AudioContext): GainNode {
    if (!this.master) {
      this.master = ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(ctx.destination);
    }
    return this.master;
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  private startEngine(ctx: AudioContext, kind: VehicleKind): Running {
    const v = ENGINES[kind];
    const osc = ctx.createOscillator();
    osc.type = v.wave;
    const sub = ctx.createOscillator();
    sub.type = v.sub;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.5;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 2;
    const throbbing = ctx.createGain();
    throbbing.gain.value = 1 - v.throb / 2;
    const throb = ctx.createOscillator();
    const throbDepth = ctx.createGain();
    throbDepth.gain.value = v.throb / 2;
    throb.connect(throbDepth).connect(throbbing.gain);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    sub.connect(subGain).connect(filter);
    filter.connect(throbbing).connect(gain).connect(this.out(ctx));
    for (const o of [osc, sub, throb]) o.start();
    return { osc, sub, throb, throbDepth, filter, gain };
  }

  /** Called once a frame: engines follow their vehicles, tyres squeal on hard turns, brakes squeak. */
  update(world: World, input: Input): void {
    const ctx = this.running();
    if (!ctx) return;
    const t = ctx.currentTime;
    world.cars.forEach((c, i) => {
      const e = (this.engines[i] ??= this.startEngine(ctx, c.kind));
      const v = ENGINES[c.kind];
      const hz = v.idleHz + v.perSpeed * c.speed;
      e.osc.frequency.setTargetAtTime(hz, t, 0.08);
      e.sub.frequency.setTargetAtTime(hz * 0.5, t, 0.08);
      e.filter.frequency.setTargetAtTime(v.toneHz + v.tonePerSpeed * c.speed, t, 0.08);
      e.throb.frequency.setTargetAtTime(v.throbHz + v.throbPerSpeed * c.speed, t, 0.1);
      e.gain.gain.setTargetAtTime(engineLoudness(world, i), t, 0.1);
    });

    // Tyre squeal: a hiss through a narrow band, only on a hard turn at speed.
    const kid = world.cars[0]!;
    if (!this.squeal) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(ctx);
      src.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 2600;
      band.Q.value = 8;
      this.squeal = ctx.createGain();
      this.squeal.gain.value = 0;
      src.connect(band).connect(this.squeal).connect(this.out(ctx));
      src.start();
    }
    const squealing = kid.speed > 10 && Math.abs(input.steer) > 0.7 && world.assist === 'free';
    this.squeal.gain.setTargetAtTime(squealing ? 0.09 : 0, t, 0.06);

    // Brakes: one squeak when a quick stop starts.
    const braking = input.brake && kid.speed > 6;
    if (braking && !this.braking) this.tone('triangle', 1900, 1300, 0.35, 0.06);
    this.braking = braking;
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
    osc.connect(gain).connect(this.out(ctx));
    osc.start(start);
    osc.stop(start + length + 0.02);
  }

  /** A bump of its own for each kind of prop: a plastic cone pings, a crate knocks, a ball boings, a bale thumps. */
  bump(kind: number): void {
    const ctx = this.running();
    if (!ctx || ctx.currentTime - this.lastBump < 0.05) return;
    this.lastBump = ctx.currentTime;
    if (kind === 0) {
      this.tone('triangle', 700, 420, 0.12, 0.2);
    } else if (kind === 1) {
      this.tone('square', 160, 90, 0.08, 0.14);
      this.tone('triangle', 240, 120, 0.1, 0.12, 0.03);
    } else if (kind === 2) {
      this.tone('sine', 260, 520, 0.18, 0.22);
    } else {
      this.tone('sine', 110, 60, 0.18, 0.3);
    }
  }

  /** A burst of hiss that slides from bright to dull. Longer and deeper for the flood. */
  splash(big: boolean): void {
    const ctx = this.running();
    if (!ctx) return;
    const length = big ? 0.55 : 0.28;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(big ? 2600 : 3800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(big ? 350 : 700, ctx.currentTime + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(big ? 0.45 : 0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + length);
    source.connect(filter).connect(gain).connect(this.out(ctx));
    source.start();
    source.stop(ctx.currentTime + length + 0.02);
  }

  horn(): void {
    this.tone('square', 392, 392, 0.16, 0.12);
    this.tone('square', 494, 494, 0.26, 0.12, 0.18);
  }

  close(): void {
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
    this.engines = [];
    this.squeal = null;
  }
}
