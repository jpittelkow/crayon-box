// The driving game's sounds (ADR 0025, 0032). Every vehicle has an engine of its own: a recorded idle loop (shipped
// file) that plays faster, so higher, and brighter as the vehicle speeds up; traffic is heard only nearby. Effects
// are shipped files too: bumps per prop kind, splashes, the horn, and the police car's siren. The tyre squeal and the
// brake squeak are still made as they play (none was picked as a file).
import { soundUrl } from '../../shell/soundFiles';
import { MAX_SPEED, type Input, type VehicleKind, type World } from './sim/sim';

/** How a kind of vehicle's engine sounds. A new vehicle gets a new entry (and a loop in assets/sounds/drive/). */
export interface EngineVoice {
  /** The idle loop, under assets/sounds/. */
  file: string;
  /** Playback rate at idle, and how much it rises per metre a second (a faster loop is a higher engine). */
  idleRate: number;
  perSpeed: number;
  /** Brightness: a filter's cut-off at idle and how far it opens with speed. */
  toneHz: number;
  tonePerSpeed: number;
  /** Loudness at full speed (the loops are levelled to one loudness). */
  volume: number;
}

export const ENGINES: Record<VehicleKind, EngineVoice> = {
  car: { file: 'drive/engine-car.wav', idleRate: 1, perSpeed: 0.065, toneHz: 1800, tonePerSpeed: 260, volume: 0.6 },
  // The police car revs higher.
  police: { file: 'drive/engine-police.wav', idleRate: 1, perSpeed: 0.07, toneHz: 2200, tonePerSpeed: 300, volume: 0.55 },
  // The big vehicles stay low: a slower loop at every speed.
  monster: { file: 'drive/engine-monster.wav', idleRate: 0.9, perSpeed: 0.045, toneHz: 1200, tonePerSpeed: 180, volume: 0.7 },
  bus: { file: 'drive/engine-bus.wav', idleRate: 0.9, perSpeed: 0.04, toneHz: 1300, tonePerSpeed: 160, volume: 0.65 },
};

/** The effect files, under assets/sounds/. */
export const EFFECTS = {
  horn: 'drive/horn.wav',
  siren: 'drive/siren.mp3',
  bump: 'drive/bump.wav',
  boing: 'drive/boing.wav',
  puddle: 'drive/puddle.wav',
  splash: 'drive/splash.wav',
} as const;

/** The horn's pitch per vehicle: the same bicycle horn, lower for the big ones. The police car sounds its siren. */
const HORN_RATE: Record<VehicleKind, number> = { car: 1, police: 1, monster: 0.7, bus: 0.8 };

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
  src: AudioBufferSourceNode;
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
  /** Decoded sound files by path; null while loading or when a file could not load. */
  private readonly files = new Map<string, AudioBuffer | null>();
  private kidKind: VehicleKind = 'car';
  private siren: AudioBufferSourceNode | null = null;

  constructor(private readonly enabled: boolean) {}

  /** Browsers allow sound only after a touch or key press, so this runs on each one. */
  unlock(): void {
    if (!this.enabled) return;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      this.load(this.ctx);
    } catch {
      this.ctx = null;
    }
  }

  /** Starts decoding every file once. An engine waits silently for its loop; an effect not loaded yet is skipped. */
  private load(ctx: AudioContext): void {
    if (this.files.size > 0) return;
    for (const path of [...Object.values(ENGINES).map((v) => v.file), ...Object.values(EFFECTS)]) {
      this.files.set(path, null);
      const url = soundUrl(path);
      if (!url) continue;
      void fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .then((buf) => {
          if (this.ctx === ctx) this.files.set(path, buf);
        })
        .catch(() => {});
    }
  }

  /** Plays an effect file once; `rate` also sets its pitch. */
  private effect(path: string, volume: number, rate = 1): AudioBufferSourceNode | null {
    const ctx = this.running();
    const buf = this.files.get(path);
    if (!ctx || !buf) return null;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(this.out(ctx));
    src.start();
    return src;
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

  /** A vehicle's engine: its idle loop, through a filter that opens with speed. Null until the loop has loaded. */
  private startEngine(ctx: AudioContext, kind: VehicleKind): Running | null {
    const buf = this.files.get(ENGINES[kind].file);
    if (!buf) return null;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.out(ctx));
    // Each engine starts at its own point in the loop, so two of the same kind don't beat against each other.
    src.start(0, Math.random() * buf.duration);
    return { src, filter, gain };
  }

  /** Called once a frame: engines follow their vehicles, tyres squeal on hard turns, brakes squeak. */
  update(world: World, input: Input): void {
    const ctx = this.running();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.kidKind = world.cars[0]?.kind ?? 'car';
    world.cars.forEach((c, i) => {
      if (!this.engines[i]) {
        const started = this.startEngine(ctx, c.kind);
        if (!started) return; // its loop is still loading
        this.engines[i] = started;
      }
      const e = this.engines[i]!;
      const v = ENGINES[c.kind];
      e.src.playbackRate.setTargetAtTime(v.idleRate + v.perSpeed * c.speed, t, 0.08);
      e.filter.frequency.setTargetAtTime(v.toneHz + v.tonePerSpeed * c.speed, t, 0.08);
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

  /**
   * A bump for each kind of prop, from one wooden knock and one spring: a plastic cone knocks high, a crate knocks,
   * a beach ball boings, a hay bale thumps low.
   */
  bump(kind: number): void {
    const ctx = this.running();
    if (!ctx || ctx.currentTime - this.lastBump < 0.05) return;
    this.lastBump = ctx.currentTime;
    if (kind === 2) this.effect(EFFECTS.boing, 0.8);
    else this.effect(EFFECTS.bump, kind === 3 ? 1 : 0.8, kind === 0 ? 1.35 : kind === 3 ? 0.6 : 1);
  }

  /** A puddle splash, or a big one for the flood. */
  splash(big: boolean): void {
    this.effect(big ? EFFECTS.splash : EFFECTS.puddle, big ? 1 : 0.8);
  }

  /** The kid's horn: a bicycle horn, lower for the big vehicles; the police car sounds its siren instead. */
  horn(): void {
    if (this.kidKind === 'police') {
      // A new tap starts the siren again rather than piling a second one on top.
      try {
        this.siren?.stop();
      } catch {
        // already over
      }
      this.siren = this.effect(EFFECTS.siren, 0.7);
      return;
    }
    this.effect(EFFECTS.horn, 0.9, HORN_RATE[this.kidKind]);
  }

  close(): void {
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
    this.engines = [];
    this.squeal = null;
    this.siren = null;
    this.files.clear();
  }
}
