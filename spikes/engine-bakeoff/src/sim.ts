// The driving simulation. Plain TypeScript with no 3D library, as ADR 0021 asks: a car is a position, a
// heading and a speed; knocked props get a push and a spin, bounce, settle, and return home. Both renderers
// draw the state this file produces, so what differs on screen is only the drawing.

export const LAND_R = 60;
export const ROAD_R = 38;
export const ROAD_W = 9;
export const MAX_SPEED = 17;
export const FLOOD_SPEED = 8;

/** Prop kinds, by index: cone, crate, ball, bale. */
export const PROP_HALF = [0.55, 0.5, 0.6, 0.45];
export const PROP_KINDS = PROP_HALF.length;

const HOME = 0, FLYING = 1, AWAY = 2, SHRINK = 3, GROW = 4;

export interface Input {
  go: boolean;
  brake: boolean;
  /** -1 is hard left, 1 is hard right. */
  steer: number;
}

export interface Car {
  x: number; z: number; heading: number; speed: number; spin: number;
  /** How far the car sits below the road (it sinks and bobs in deep water). */
  y: number;
  /** The water it was in last step: 0 none, 1 a puddle, 2 the flood. */
  wet: number;
  /** Time until its next wake ring. */
  wake: number;
  /** Traffic only: where on the ring road it is, which lane, and its own pace. */
  angle: number; lane: number; cruise: number;
}

export interface Tree { x: number; z: number; scale: number }

export interface Prop {
  kind: number;
  homeX: number; homeZ: number; homeYaw: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  qx: number; qy: number; qz: number; qw: number;
  wx: number; wy: number; wz: number;
  scale: number; state: number; timer: number; cool: number;
}

export interface Puff { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number }

/** A round patch of water: a shallow puddle, or the deep flood across the road. */
export interface Water { x: number; z: number; r: number; deep: boolean }

/** A ring on the water that spreads and disappears. */
export interface Ripple { x: number; z: number; life: number; size: number }

export const RIPPLE_LIFE = 1.1;
export const DROP_LIFE = 0.8;

export interface World {
  rng: number;
  time: number;
  /** cars[0] is the kid's car; the rest are traffic. */
  cars: Car[];
  trees: Tree[];
  props: Prop[];
  puffs: Puff[];
  puffNext: number;
  waters: Water[];
  /** Water drops thrown up by splashes and wheel spray. */
  drops: Puff[];
  dropNext: number;
  ripples: Ripple[];
  rippleNext: number;
  /** Splashes the kid's car made in the last step, for the sounds: 1 a puddle, 2 the flood. */
  splashes: number[];
  camHeading: number;
  /** Kinds of the props the kid's car knocked in the last step, for the sounds. */
  knocks: number[];
}

function rand(w: World): number {
  w.rng = (w.rng + 0x6d2b79f5) | 0;
  let t = w.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function trafficPose(c: Car): void {
  c.x = Math.sin(c.angle) * c.lane;
  c.z = Math.cos(c.angle) * c.lane;
  c.heading = c.angle + Math.PI / 2;
}

export function makeWorld(seed: number, propCount: number): World {
  const w: World = {
    rng: seed | 0, time: 0, cars: [], trees: [], props: [], puffs: [], puffNext: 0, camHeading: Math.PI / 2, knocks: [],
    waters: [], drops: [], dropNext: 0, ripples: [], rippleNext: 0, splashes: [],
  };
  const car = (angle: number, lane: number, cruise: number): Car =>
    ({ x: 0, z: ROAD_R, heading: Math.PI / 2, speed: cruise, spin: 0, y: 0, wet: 0, wake: 0, angle, lane, cruise });
  w.cars.push(car(0, ROAD_R, 0));
  [[1.3, ROAD_R - 2.2, 7.5], [3.1, ROAD_R + 2.2, 9], [4.7, ROAD_R - 2.2, 8.2]].forEach(([angle, lane, cruise]) => {
    const c = car(angle!, lane!, cruise!);
    trafficPose(c);
    w.cars.push(c);
  });

  // The flood covers the road on the far side of the island from the start. Puddles sit on and beside the road,
  // each with a smaller lobe so it is not a perfect circle.
  w.waters.push({ x: 0, z: -ROAD_R, r: 12, deep: true });
  for (const a of [0.75, 1.5, 2.2, 4.0, 4.8, 5.6]) {
    const r = ROAD_R + (rand(w) - 0.5) * 7, size = 2.2 + rand(w) * 1.6, lobe = rand(w) * Math.PI * 2;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    w.waters.push({ x, z, r: size, deep: false });
    w.waters.push({ x: x + Math.sin(lobe) * size * 0.7, z: z + Math.cos(lobe) * size * 0.7, r: size * 0.65, deep: false });
  }

  const roadIn = ROAD_R - ROAD_W / 2 - 2.5, roadOut = ROAD_R + ROAD_W / 2 + 2.5;
  let treeTries = 0;
  while (w.trees.length < 44 && treeTries++ < 400) {
    const a = rand(w) * Math.PI * 2;
    const r = rand(w) < 0.5 ? 6 + rand(w) * (roadIn - 6) : roadOut + rand(w) * (55 - roadOut);
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (w.waters.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 2)) continue;
    w.trees.push({ x, z, scale: 0.8 + rand(w) * 0.6 });
  }

  let tries = 0;
  while (w.props.length < propCount && tries++ < propCount * 20) {
    const a = rand(w) * Math.PI * 2;
    // A little over half sit on or beside the road, on purpose in the car's way; the rest are spread about.
    const r = rand(w) < 0.55 ? ROAD_R + (rand(w) - 0.5) * (ROAD_W + 4) : Math.sqrt(rand(w)) * 55;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    const kind = Math.floor(rand(w) * PROP_KINDS);
    const yaw = rand(w) * Math.PI * 2;
    if (Math.hypot(x - w.cars[0]!.x, z - w.cars[0]!.z) < 7) continue;
    if (w.trees.some((t) => Math.hypot(x - t.x, z - t.z) < 1.6 * t.scale)) continue;
    if (waterAt(w, x, z) === 2) continue;
    w.props.push({
      kind, homeX: x, homeZ: z, homeYaw: yaw, x, y: PROP_HALF[kind]!, z, vx: 0, vy: 0, vz: 0,
      qx: 0, qy: Math.sin(yaw / 2), qz: 0, qw: Math.cos(yaw / 2), wx: 0, wy: 0, wz: 0,
      scale: 1, state: HOME, timer: 0, cool: 0,
    });
  }
  for (let i = 0; i < 48; i++) w.puffs.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
  for (let i = 0; i < 160; i++) w.drops.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
  for (let i = 0; i < 40; i++) w.ripples.push({ x: 0, z: 0, life: 0, size: 1 });
  return w;
}

/** 0 for dry land, 1 in a puddle, 2 in the flood. */
export function waterAt(w: World, x: number, z: number): number {
  let found = 0;
  for (const p of w.waters) {
    const dx = x - p.x, dz = z - p.z;
    if (dx * dx + dz * dz > p.r * p.r) continue;
    if (p.deep) return 2;
    found = 1;
  }
  return found;
}

/** Drives the car by itself around the road, weaving through the props. The same run every time. */
export function autopilot(w: World): Input {
  const car = w.cars[0]!;
  const a = Math.atan2(car.x, car.z) + 0.3;
  const r = ROAD_R + Math.sin(w.time * 0.55) * 5;
  const want = Math.atan2(Math.sin(a) * r - car.x, Math.cos(a) * r - car.z);
  return { go: true, brake: false, steer: clamp(-wrap(want - car.heading) * 2.5, -1, 1) };
}

function stepKidCar(w: World, input: Input, dt: number): void {
  const car = w.cars[0]!;
  if (input.brake) car.speed = Math.max(0, car.speed - 24 * dt);
  else if (input.go) car.speed = Math.min(MAX_SPEED, car.speed + 10 * dt);
  else car.speed = Math.max(0, car.speed - 6 * dt);
  // Deep water holds the car back to a wade.
  if (car.wet === 2 && car.speed > FLOOD_SPEED) car.speed = Math.max(FLOOD_SPEED, car.speed - 30 * dt);

  const turn = 2.1 * Math.min(1, car.speed / 5) * (1 - 0.35 * (car.speed / MAX_SPEED));
  car.heading -= clamp(input.steer, -1, 1) * turn * dt;

  // The island's edge turns the car back toward land, harder the closer it gets (ADR 0021: can't get lost).
  const d = Math.hypot(car.x, car.z);
  if (d > LAND_R - 10) {
    const k = Math.min(1, (d - (LAND_R - 10)) / 8);
    const diff = wrap(Math.atan2(-car.x, -car.z) - car.heading);
    car.heading += clamp(diff * 2, -1, 1) * 3.2 * k * dt * Math.min(1, car.speed / 3);
  }

  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.spin += (car.speed / 0.45) * dt;

  const d2 = Math.hypot(car.x, car.z);
  if (d2 > LAND_R - 1.5) {
    car.x *= (LAND_R - 1.5) / d2;
    car.z *= (LAND_R - 1.5) / d2;
  }

  // Trees and traffic are round and never stop the car: it is pushed out and slides along (can't get stuck).
  const pushOut = (ox: number, oz: number, reach: number, drag: number) => {
    const dx = car.x - ox, dz = car.z - oz, dist = Math.hypot(dx, dz);
    if (dist >= reach || dist < 1e-6) return;
    car.x = ox + (dx / dist) * reach;
    car.z = oz + (dz / dist) * reach;
    car.speed *= drag;
    // Turn the nose away from the thing, toward the side it is already passing on.
    const side = Math.sin(car.heading) * dz - Math.cos(car.heading) * dx;
    car.heading += (side > 0 ? -1 : 1) * 1.6 * dt;
  };
  for (const t of w.trees) pushOut(t.x, t.z, 0.45 * t.scale + 1.3, 0.985);
  for (let i = 1; i < w.cars.length; i++) pushOut(w.cars[i]!.x, w.cars[i]!.z, 2.9, 0.96);
}

function stepTraffic(w: World, dt: number): void {
  const kid = w.cars[0]!;
  for (let i = 1; i < w.cars.length; i++) {
    const c = w.cars[i]!;
    // Near the kid's car, traffic matches its pace and drives along with it; otherwise it keeps its own.
    const near = Math.hypot(c.x - kid.x, c.z - kid.z) < 16;
    let want = near ? clamp(kid.speed, 5, MAX_SPEED - 1) : c.cruise;
    if (c.wet === 2) want = Math.min(want, FLOOD_SPEED - 1);
    c.speed += clamp(want - c.speed, -8 * dt, 8 * dt);
    c.angle += (c.speed / c.lane) * dt;
    c.spin += (c.speed / 0.45) * dt;
    trafficPose(c);
  }
}

function puff(w: World, x: number, y: number, z: number): void {
  for (let i = 0; i < 3; i++) {
    const p = w.puffs[w.puffNext]!;
    w.puffNext = (w.puffNext + 1) % w.puffs.length;
    p.x = x; p.y = y; p.z = z;
    p.vx = (rand(w) - 0.5) * 4; p.vy = 2 + rand(w) * 2; p.vz = (rand(w) - 0.5) * 4;
    p.life = 0.5;
  }
}

function drop(w: World, x: number, y: number, z: number, vx: number, vy: number, vz: number): void {
  const d = w.drops[w.dropNext]!;
  w.dropNext = (w.dropNext + 1) % w.drops.length;
  d.x = x; d.y = y; d.z = z; d.vx = vx; d.vy = vy; d.vz = vz; d.life = DROP_LIFE;
}

function ripple(w: World, x: number, z: number, size: number): void {
  const r = w.ripples[w.rippleNext]!;
  w.rippleNext = (w.rippleNext + 1) % w.ripples.length;
  r.x = x; r.z = z; r.size = size; r.life = RIPPLE_LIFE;
}

/** A ring of drops thrown up and outward, carried along by whatever made the splash. */
function splash(w: World, x: number, z: number, vx: number, vz: number, count: number, height: number): void {
  for (let i = 0; i < count; i++) {
    const a = rand(w) * Math.PI * 2, out = 1.5 + rand(w) * 3.5;
    drop(w, x, 0.15, z, vx * 0.3 + Math.sin(a) * out, height * (0.55 + rand(w) * 0.45), vz * 0.3 + Math.cos(a) * out);
  }
  ripple(w, x, z, count > 10 ? 2.2 : 1.2);
}

/** Splashes on the way in, spray off the back wheels, a wake and a sinking, bobbing car in the flood. */
function stepWater(w: World, dt: number): void {
  w.cars.forEach((car, i) => {
    const now = waterAt(w, car.x, car.z);
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    if (now > car.wet && car.speed > 2) {
      splash(w, car.x + fx * 1.6, car.z + fz * 1.6, fx * car.speed, fz * car.speed, now === 2 ? 20 : 8, now === 2 ? 7.5 : 4.5);
      if (i === 0) w.splashes.push(now);
    }
    if (now && car.speed > 3 && rand(w) < car.speed / MAX_SPEED + 0.25) {
      const side = rand(w) < 0.5 ? -0.98 : 0.98;
      drop(w, car.x - fx * 1.3 + fz * side, 0.3, car.z - fz * 1.3 - fx * side,
        -fx * car.speed * 0.2 + fz * side * 1.6, 2.5 + rand(w) * 2.5, -fz * car.speed * 0.2 - fx * side * 1.6);
    }
    if (now === 2) {
      car.wake -= dt;
      if (car.speed > 1 && car.wake <= 0) {
        car.wake = 0.34;
        ripple(w, car.x - fx * 1.8, car.z - fz * 1.8, 1.4);
      }
    }
    const sink = now === 2 ? -0.25 + Math.sin(w.time * 3 + i) * 0.06 : 0;
    car.y += (sink - car.y) * Math.min(1, 8 * dt);
    car.wet = now;
  });

  for (const d of w.drops) {
    if (d.life <= 0) continue;
    d.life -= dt;
    d.vy -= 20 * dt;
    d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
    if (d.y < 0.08) d.life = 0;
  }
  for (const r of w.ripples) if (r.life > 0) r.life -= dt;
}

function stepProps(w: World, dt: number): void {
  for (const p of w.props) {
    const half = PROP_HALF[p.kind]!;
    if (p.cool > 0) p.cool -= dt;

    if (p.state === SHRINK) {
      p.scale -= dt / 0.25;
      if (p.scale <= 0) {
        p.scale = 0; p.state = GROW;
        p.x = p.homeX; p.z = p.homeZ; p.y = half;
        p.qx = 0; p.qy = Math.sin(p.homeYaw / 2); p.qz = 0; p.qw = Math.cos(p.homeYaw / 2);
        p.vx = p.vy = p.vz = p.wx = p.wy = p.wz = 0;
      }
      continue;
    }
    if (p.state === GROW) {
      p.scale += dt / 0.25;
      if (p.scale >= 1) { p.scale = 1; p.state = HOME; }
      continue;
    }

    if (p.cool <= 0 && p.y < 1.8) {
      for (let i = 0; i < w.cars.length; i++) {
        const car = w.cars[i]!;
        if (car.speed < 1) continue;
        const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
        // The car is longer than it is wide: one circle at the nose, one at the tail.
        const reach = 1.15 + half;
        let dx = p.x - (car.x + fx * 1.1), dz = p.z - (car.z + fz * 1.1);
        if (dx * dx + dz * dz > reach * reach) {
          dx = p.x - (car.x - fx * 1.1); dz = p.z - (car.z - fz * 1.1);
          if (dx * dx + dz * dz > reach * reach) continue;
        }
        const len = Math.hypot(dx, dz) || 1;
        p.vx = fx * car.speed * 0.85 + (dx / len) * car.speed * 0.45 + (rand(w) - 0.5) * 2;
        p.vz = fz * car.speed * 0.85 + (dz / len) * car.speed * 0.45 + (rand(w) - 0.5) * 2;
        p.vy = 3 + car.speed * 0.32 + rand(w) * 1.5;
        p.wx = (rand(w) - 0.5) * car.speed * 1.2;
        p.wy = (rand(w) - 0.5) * car.speed * 1.2;
        p.wz = (rand(w) - 0.5) * car.speed * 1.2;
        p.state = FLYING; p.cool = 0.3; p.timer = 0;
        puff(w, p.x, p.y, p.z);
        if (i === 0) w.knocks.push(p.kind);
        break;
      }
    }

    if (p.state === FLYING) {
      p.vy -= 24 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const hx = p.wx * dt * 0.5, hy = p.wy * dt * 0.5, hz = p.wz * dt * 0.5;
      const nx = p.qx + hx * p.qw + hy * p.qz - hz * p.qy;
      const ny = p.qy + hy * p.qw + hz * p.qx - hx * p.qz;
      const nz = p.qz + hz * p.qw + hx * p.qy - hy * p.qx;
      const nw = p.qw - hx * p.qx - hy * p.qy - hz * p.qz;
      const nl = Math.hypot(nx, ny, nz, nw) || 1;
      p.qx = nx / nl; p.qy = ny / nl; p.qz = nz / nl; p.qw = nw / nl;
      if (p.y <= half) {
        p.y = half;
        if (p.vy < -2) {
          if (waterAt(w, p.x, p.z)) splash(w, p.x, p.z, p.vx, p.vz, 6, 4);
          p.vy = -p.vy * 0.42; p.vx *= 0.75; p.vz *= 0.75;
          p.wx *= 0.7; p.wy *= 0.7; p.wz *= 0.7;
        } else {
          p.vy = 0;
          const f = Math.max(0, 1 - 5 * dt);
          p.vx *= f; p.vz *= f; p.wx *= f; p.wy *= f; p.wz *= f;
          if (p.vx * p.vx + p.vz * p.vz < 0.15) { p.state = AWAY; p.timer = 0; }
        }
      }
      if (Math.hypot(p.x, p.z) > LAND_R + 1.5) p.state = SHRINK; // into the water: straight back home
    } else if (p.state === AWAY) {
      // Stand back up where it landed, wait a little, then go home.
      const ty = Math.sin(p.homeYaw / 2), tw = Math.cos(p.homeYaw / 2);
      const sign = p.qy * ty + p.qw * tw < 0 ? -1 : 1;
      const k = Math.min(1, 6 * dt);
      p.qx += (0 - p.qx) * k; p.qy += (ty * sign - p.qy) * k; p.qz += (0 - p.qz) * k; p.qw += (tw * sign - p.qw) * k;
      const nl = Math.hypot(p.qx, p.qy, p.qz, p.qw) || 1;
      p.qx /= nl; p.qy /= nl; p.qz /= nl; p.qw /= nl;
      p.timer += dt;
      if (p.timer > 4) p.state = SHRINK;
    }
  }
}

export function step(w: World, input: Input, dt: number): void {
  w.time += dt;
  w.knocks.length = 0;
  w.splashes.length = 0;
  stepKidCar(w, input, dt);
  stepTraffic(w, dt);
  stepWater(w, dt);
  stepProps(w, dt);
  for (const p of w.puffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  }
  w.camHeading += wrap(w.cars[0]!.heading - w.camHeading) * Math.min(1, 4 * dt);
}
