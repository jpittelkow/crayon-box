// The land of a map as an outline (milestone-3 phase B2): any shape, not only a circle. The simulation asks how far
// a point is from the shore and which way is inland, to turn the car back before the edge, keep it on the land and
// place things. Plain TypeScript, no three.js.

/** The land as a map file gives it. */
export interface LandDef {
  /** The shoreline, a closed loop of points about 1 to 3 m apart, in either direction. */
  outline: [number, number][];
  /** How wide the sand is, inland from the shoreline. */
  beach: number;
}

/** The land ready for the simulation. */
export interface Land {
  def: LandDef;
  xs: Float64Array;
  zs: Float64Array;
  minX: number; maxX: number; minZ: number; maxZ: number;
  /** The middle of the outline's points: a fallback "inland" for a point right on the shore. */
  cx: number; cz: number;
}

/** Where a point is relative to the shore. */
export interface Shore {
  /** Metres from the shoreline: positive on the land, negative out at sea. */
  depth: number;
  /** A unit direction pointing inland, away from the nearest shore. */
  nx: number; nz: number;
}

export function buildLand(def: LandDef): Land {
  const n = def.outline.length;
  const xs = new Float64Array(n), zs = new Float64Array(n);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, cx = 0, cz = 0;
  def.outline.forEach(([x, z], i) => {
    xs[i] = x;
    zs[i] = z;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    cx += x / n;
    cz += z / n;
  });
  return { def, xs, zs, minX, maxX, minZ, maxZ, cx, cz };
}

/** Whether a point is on the land (inside the outline). */
export function onLand(land: Land, x: number, z: number): boolean {
  const { xs, zs } = land;
  let inside = false;
  for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) {
    const zi = zs[i]!, zj = zs[j]!;
    if (zi > z !== zj > z && x < ((xs[j]! - xs[i]!) * (z - zi)) / (zj - zi) + xs[i]!) inside = !inside;
  }
  return inside;
}

/** How far a point is from the shore, and which way is inland. */
export function shore(land: Land, x: number, z: number): Shore {
  const { xs, zs } = land;
  let best = Infinity, bx = 0, bz = 0;
  for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) {
    const ax = xs[j]!, az = zs[j]!, dx = xs[i]! - ax, dz = zs[i]! - az;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const px = ax + dx * t, pz = az + dz * t;
    const d2 = (x - px) ** 2 + (z - pz) ** 2;
    if (d2 < best) {
      best = d2;
      bx = px;
      bz = pz;
    }
  }
  const dist = Math.sqrt(best);
  const inside = onLand(land, x, z);
  let nx = inside ? x - bx : bx - x, nz = inside ? z - bz : bz - z;
  const len = Math.hypot(nx, nz);
  if (len < 1e-6) {
    // Right on the shoreline: inland is toward the middle.
    nx = land.cx - x;
    nz = land.cz - z;
  }
  const nl = Math.hypot(nx, nz) || 1;
  return { depth: inside ? dist : -dist, nx: nx / nl, nz: nz / nl };
}

/** Moves a point inland until it is at least `gap` metres from the shore. */
export function keepInland(land: Land, x: number, z: number, gap: number): { x: number; z: number } {
  for (let i = 0; i < 4; i++) {
    const s = shore(land, x, z);
    if (s.depth >= gap - 1e-6) break;
    x += s.nx * (gap - s.depth);
    z += s.nz * (gap - s.depth);
  }
  return { x, z };
}

/** A random point on the land, at least `gap` metres from the shore. */
export function randomInland(land: Land, rand: () => number, gap: number): [number, number] {
  for (let i = 0; i < 200; i++) {
    const x = land.minX + rand() * (land.maxX - land.minX), z = land.minZ + rand() * (land.maxZ - land.minZ);
    if (shore(land, x, z).depth >= gap) return [x, z];
  }
  return [land.cx, land.cz];
}

/** A round shoreline: `count` points on a circle. */
export function roundOutline(cx: number, cz: number, r: number, count = 160): [number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return [cx + Math.sin(a) * r, cz + Math.cos(a) * r];
  });
}

/**
 * The outline moved `d` metres outward (inward when negative), for drawing the beach and the grass. Good for the
 * gentle shapes a map uses; a very tight bend may fold.
 */
export function offsetOutline(land: Land, d: number): [number, number][] {
  const { xs, zs } = land;
  const n = xs.length;
  return Array.from({ length: n }, (_, i) => {
    // At each point, square to the line through its neighbours.
    const px = xs[(i + n - 1) % n]!, pz = zs[(i + n - 1) % n]!, qx = xs[(i + 1) % n]!, qz = zs[(i + 1) % n]!;
    let ox = qz - pz, oz = -(qx - px);
    const ol = Math.hypot(ox, oz) || 1;
    ox /= ol;
    oz /= ol;
    // Pick the side that points out to sea.
    if (onLand(land, xs[i]! + ox * 0.5, zs[i]! + oz * 0.5)) {
      ox = -ox;
      oz = -oz;
    }
    return [xs[i]! + ox * d, zs[i]! + oz * d];
  });
}
