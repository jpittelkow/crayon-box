// The driving game's sounds (ADR 0025, 0032). Every vehicle has an engine of its own: a recorded idle loop (shipped
// file) that plays faster, so higher, and brighter as the vehicle speeds up; traffic is heard only nearby. Effects
// are shipped files too: each toy's bump, splashes, the horn, the police car's siren, the tyre squeal and the
// brake squeak. The set pieces (milestone-3 B6) reuse them for now: plank knocks on a bridge, a whoosh and popping
// bubbles at the car wash; the tunnel's echo and the sand's hiss are made by the app.
import { soundUrl } from '../../shell/soundFiles';
import type { AnimalCall } from './sim/assets/animals';
import type { BumpSound } from './sim/assets/toys';
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
  // Milestone 3, phase D (ADR 0035): stand-ins from the four loops above, pitched and toned for each vehicle, until
  // takes of their own can be made.
  fire: { file: 'drive/engine-bus.wav', idleRate: 0.85, perSpeed: 0.045, toneHz: 1400, tonePerSpeed: 180, volume: 0.65 },
  ambulance: { file: 'drive/engine-police.wav', idleRate: 0.95, perSpeed: 0.065, toneHz: 2000, tonePerSpeed: 260, volume: 0.55 },
  tow: { file: 'drive/engine-car.wav', idleRate: 0.85, perSpeed: 0.055, toneHz: 1500, tonePerSpeed: 200, volume: 0.6 },
  digger: { file: 'drive/engine-monster.wav', idleRate: 0.75, perSpeed: 0.04, toneHz: 1000, tonePerSpeed: 150, volume: 0.65 },
  dump: { file: 'drive/engine-bus.wav', idleRate: 0.78, perSpeed: 0.04, toneHz: 1100, tonePerSpeed: 150, volume: 0.65 },
  mixer: { file: 'drive/engine-bus.wav', idleRate: 0.82, perSpeed: 0.04, toneHz: 1200, tonePerSpeed: 160, volume: 0.62 },
  tractor: { file: 'drive/engine-monster.wav', idleRate: 0.7, perSpeed: 0.035, toneHz: 900, tonePerSpeed: 120, volume: 0.6 },
  garbage: { file: 'drive/engine-bus.wav', idleRate: 0.8, perSpeed: 0.04, toneHz: 1150, tonePerSpeed: 150, volume: 0.62 },
  icecream: { file: 'drive/engine-car.wav', idleRate: 0.9, perSpeed: 0.05, toneHz: 1600, tonePerSpeed: 200, volume: 0.55 },
  race: { file: 'drive/engine-police.wav', idleRate: 1.15, perSpeed: 0.08, toneHz: 2600, tonePerSpeed: 340, volume: 0.6 },
};

/** The effect files, under assets/sounds/. */
export const EFFECTS = {
  horn: 'drive/horn.wav',
  siren: 'drive/siren.mp3',
  bump: 'drive/bump.wav',
  boing: 'drive/boing.wav',
  puddle: 'drive/puddle.wav',
  splash: 'drive/splash.wav',
  squeal: 'drive/squeal.wav',
  brake: 'drive/brake.wav',
  // Stand-in for the car wash's bubbles until a take of its own (milestone-3 B6): the app's soft pop.
  pop: 'ui/fill.wav',
} as const;

/** How far apart the bridge's planks are, for their knocks under the wheels. */
const PLANK_M = 1.6;

/** The wooden knock at each toy's pitch and loudness (the boing is a file of its own). */
const BUMP: Record<Exclude<BumpSound, 'boing'>, { rate: number; volume: number }> = {
  ping: { rate: 1.35, volume: 0.8 },
  knock: { rate: 1, volume: 0.8 },
  thump: { rate: 0.6, volume: 1 },
};

/** The horn's pitch per vehicle: the same bicycle horn, lower for the big ones. The police car sounds its siren. */
/**
 * Each vehicle's horn (ADR 0035): the bicycle horn played as one or more notes (each a pitch), or the siren at a
 * pitch. Stand-ins until takes of their own: a beep-beep for the digger, a little tune for the ice-cream van.
 */
const HORNS: Record<VehicleKind, { siren?: number; notes?: number[]; gap?: number; volume: number }> = {
  car: { notes: [1], volume: 0.9 },
  police: { siren: 1, volume: 0.7 },
  monster: { notes: [0.55], volume: 1 },
  bus: { notes: [0.72, 0.72], gap: 0.3, volume: 0.9 },
  fire: { siren: 0.88, volume: 0.75 },
  ambulance: { siren: 1.15, volume: 0.7 },
  tow: { notes: [0.7], volume: 0.9 },
  digger: { notes: [1.9, 1.9], gap: 0.24, volume: 0.6 },
  dump: { notes: [0.6], volume: 0.95 },
  mixer: { notes: [0.66], volume: 0.9 },
  tractor: { notes: [0.48], volume: 0.95 },
  garbage: { notes: [0.8], volume: 0.9 },
  icecream: { notes: [1.2, 1.5, 1.35, 1.8], gap: 0.18, volume: 0.6 },
  race: { notes: [1.5], volume: 0.8 },
};

/**
 * Animals answering the horn (milestone-3 B3): stand-ins until takes of their own, the horn file at a pitch for
 * each call. Rates and loudness.
 */
const CALL: Record<AnimalCall, { rate: number; volume: number }> = {
  baa: { rate: 0.62, volume: 0.45 },
  quack: { rate: 1.45, volume: 0.4 },
  moo: { rate: 0.42, volume: 0.55 },
};

/** Traffic further away than this is not heard. */
const HEARING_M = 40;

/** How loud a vehicle's engine is: the kid's own car always, traffic fading with distance. */
export function engineLoudness(world: World, index: number): number {
  const c = world.cars[index]!;
  // Speed either way: backing up (ADR 0036) sounds like driving slowly.
  const effort = 0.35 + 0.65 * Math.min(1, Math.abs(c.speed) / MAX_SPEED);
  const base = ENGINES[c.kind].volume * effort;
  if (index === 0) return base;
  const kid = world.cars[0]!;
  const d = Math.hypot(c.x - kid.x, c.z - kid.z);
  if (d > HEARING_M) return 0;
  return base * 0.8 / (1 + (d / 8) ** 2);
}

interface Running {
  /** The vehicle it was started for: the garage can change the kid's (ADR 0035). */
  kind: VehicleKind;
  src: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

export class DrivingSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engines: Running[] = [];
  private squeal: GainNode | null = null;
  private lastBump = 0;
  private braking = false;
  /** Decoded sound files by path; null while loading or when a file could not load. */
  private readonly files = new Map<string, AudioBuffer | null>();
  /** The same files as they finish loading, for sounds that wait for theirs (the squeal loop). */
  private readonly loaded = new Map<string, Promise<AudioBuffer | null>>();
  private kidKind: VehicleKind = 'car';
  private siren: AudioBufferSourceNode | null = null;
  /** The tunnel's echo: how much of everything is sent round the echo (0 outside a tunnel). */
  private echo: GainNode | null = null;
  /** The hiss of sand under the wheels, made by the app: its loudness. */
  private sand: GainNode | null = null;
  /** For effects that depend on time or distance between frames. */
  private last = { time: 0, x: 0, z: 0, zone: -1, plank: 0 };

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
      const loading = fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .then((buf) => {
          if (this.ctx === ctx) this.files.set(path, buf);
          return buf;
        })
        .catch(() => null);
      this.loaded.set(path, loading);
    }
  }

  /** Plays an effect file once; `rate` also sets its pitch. */
  private effect(path: string, volume: number, rate = 1, delay = 0): AudioBufferSourceNode | null {
    const ctx = this.running();
    const buf = this.files.get(path);
    if (!ctx || !buf) return null;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(this.out(ctx));
    src.start(ctx.currentTime + delay);
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
      // The tunnel's echo (milestone-3 B6, made by the app as the owner allowed): everything is also sent through a
      // short delay that feeds back into itself, faded in only inside a tunnel.
      this.echo = ctx.createGain();
      this.echo.gain.value = 0;
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.14;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.38;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 2400;
      this.master.connect(this.echo).connect(delay).connect(tone).connect(feedback).connect(delay);
      tone.connect(ctx.destination);
    }
    return this.master;
  }

  /** The hiss of sand under the wheels: noise through a band-pass, quiet until the car is on sand. */
  private startSand(ctx: AudioContext): GainNode {
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1400;
    band.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(band).connect(gain).connect(this.out(ctx));
    src.start();
    return gain;
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
    return { kind, src, filter, gain };
  }

  /** Called once a frame: engines follow their vehicles, tyres squeal on hard turns, brakes squeak. */
  update(world: World, input: Input): void {
    const ctx = this.running();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.kidKind = world.cars[0]?.kind ?? 'car';
    world.cars.forEach((c, i) => {
      if (this.engines[i] && this.engines[i]!.kind !== c.kind) {
        // A new vehicle from the garage: its own engine.
        try {
          this.engines[i]!.src.stop();
        } catch {
          // already stopped
        }
        delete this.engines[i];
      }
      if (!this.engines[i]) {
        const started = this.startEngine(ctx, c.kind);
        if (!started) return; // its loop is still loading
        this.engines[i] = started;
      }
      const e = this.engines[i]!;
      const v = ENGINES[c.kind];
      e.src.playbackRate.setTargetAtTime(v.idleRate + v.perSpeed * Math.abs(c.speed), t, 0.08);
      e.filter.frequency.setTargetAtTime(v.toneHz + v.tonePerSpeed * Math.abs(c.speed), t, 0.08);
      e.gain.gain.setTargetAtTime(engineLoudness(world, i), t, 0.1);
    });

    // Tyre squeal: a recorded squeal loop, faded in only on a hard turn at speed.
    const kid = world.cars[0]!;
    if (!this.squeal) {
      const squeal = ctx.createGain();
      squeal.gain.value = 0;
      // The loop is levelled like every file; this lifts it to sit with the engines at the fade-in level below.
      const lift = ctx.createGain();
      lift.gain.value = 6;
      lift.connect(squeal).connect(this.out(ctx));
      this.squeal = squeal;
      void this.loaded.get(EFFECTS.squeal)?.then((buf) => {
        if (!buf || this.squeal !== squeal) return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(lift);
        src.start();
      });
    }
    // The steering the car really used: a finger's spot steers in the simulation, not in the input.
    const squealing = kid.speed > 10 && Math.abs(world.steer) > 0.7 && world.assist === 'free';
    this.squeal.gain.setTargetAtTime(squealing ? 0.09 : 0, t, 0.06);

    // Brakes: one squeak when a quick stop starts.
    const braking = input.brake && kid.speed > 6;
    if (braking && !this.braking) this.effect(EFFECTS.brake, 0.6);
    this.braking = braking;

    this.setPieces(ctx, world);
  }

  /**
   * The set pieces' sounds (milestone-3 B6): the tunnel's echo, the bridge's planks knocking under the wheels,
   * sand hissing, and the car wash (a whoosh going in, then bubbles popping while the car is soapy). Landing from
   * a ramp is a bump, played by the game.
   */
  private setPieces(ctx: AudioContext, world: World): void {
    const t = ctx.currentTime, dt = Math.min(0.1, Math.max(0, t - this.last.time));
    const kid = world.cars[0]!;
    const moved = Math.hypot(kid.x - this.last.x, kid.z - this.last.z);
    this.last.time = t;
    this.last.x = kid.x;
    this.last.z = kid.z;

    this.echo?.gain.setTargetAtTime(world.under.tunnel ? 0.55 : 0, t, 0.15);

    this.sand ??= this.startSand(ctx);
    const hiss = world.under.sand && kid.h === 0 ? 0.05 + 0.1 * Math.min(1, kid.speed / MAX_SPEED) : 0;
    this.sand.gain.setTargetAtTime(kid.speed > 1 ? hiss : 0, t, 0.08);

    // A plank under the wheels every PLANK_M metres on the bridge: the wooden knock, high and quiet.
    if (world.under.bridge && moved < 5) {
      this.last.plank += moved;
      if (this.last.plank >= PLANK_M) {
        this.last.plank %= PLANK_M;
        this.effect(EFFECTS.bump, 0.22, 1.7 + Math.random() * 0.2);
      }
    }

    const zone = world.zone >= 0 ? world.zones[world.zone]! : null;
    if (zone?.kind === 'car-wash' && this.last.zone !== world.zone) this.effect(EFFECTS.splash, 0.5, 1.3);
    this.last.zone = world.zone;
    if (kid.soap > 0.05 && Math.random() < kid.soap * dt * 7) this.effect(EFFECTS.pop, 0.3, 0.8 + Math.random() * 0.7);
  }

  /**
   * A toy's own bump (sim/assets/toys.ts), from one wooden knock and one spring: a plastic ping (the knock, high), a
   * wooden knock, a rubber boing, a soft thump (the knock, low; also a landing from a ramp hop).
   */
  bump(kind: BumpSound): void {
    const ctx = this.running();
    if (!ctx || ctx.currentTime - this.lastBump < 0.05) return;
    this.lastBump = ctx.currentTime;
    if (kind === 'boing') this.effect(EFFECTS.boing, 0.8);
    else this.effect(EFFECTS.bump, BUMP[kind].volume, BUMP[kind].rate);
  }

  /** An animal answering the horn; each a little different, so a herd doesn't sound like one. */
  call(kind: AnimalCall): void {
    const c = CALL[kind];
    this.effect(EFFECTS.horn, c.volume, c.rate * (0.92 + Math.random() * 0.16));
  }

  /** A puddle splash, or a big one for the flood. */
  splash(big: boolean): void {
    this.effect(big ? EFFECTS.splash : EFFECTS.puddle, big ? 1 : 0.8);
  }

  /** The kid's horn: each vehicle's own (HORNS); emergency vehicles sound their siren instead. */
  horn(): void {
    const horn = HORNS[this.kidKind];
    if (horn.siren) {
      // A new tap starts the siren again rather than piling a second one on top.
      try {
        this.siren?.stop();
      } catch {
        // already over
      }
      this.siren = this.effect(EFFECTS.siren, horn.volume, horn.siren);
      return;
    }
    (horn.notes ?? [1]).forEach((rate, i) => this.effect(EFFECTS.horn, horn.volume, rate, i * (horn.gap ?? 0)));
  }

  close(): void {
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
    this.engines = [];
    this.squeal = null;
    this.siren = null;
    this.echo = null;
    this.sand = null;
    this.files.clear();
    this.loaded.clear();
  }
}
