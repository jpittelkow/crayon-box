// Dev tool: the map editor's editing operations (tools/map-editor.html; docs/recipes/maps.md, "Making a map with the
// editor"). Plain functions on a map document, no DOM, so they are unit-tested (mapEdit.test.ts). Every operation
// returns a new document and leaves the one it was given alone, which is what undo keeps.
//
// Places are the simulation's own x and z, as in a map file: x grows westward, z northward. The editor's picture
// turns them so north is up and east is right (mapDraw.ts).
//
// Roads, the shoreline, streams and sand are long lists of close points in a map. The editor edits a road through a
// handful of control points (a smooth curve through them, `smoothPath`, as the built-in maps are made), made the
// first time that road is edited, so a road nobody touches keeps every point it had. A roundabout's ring is edited
// as a middle and a radius (`ringRoad`).
import { mapProblems } from '../games/racing/maps/check';
import { mapToFile, parseMapFile } from '../games/racing/maps/file';
import type { AnimalId } from '../games/racing/sim/assets/animals';
import type { TargetId } from '../games/racing/sim/assets/toys';
import { buildGuards, guardAt } from '../games/racing/sim/ground';
import { buildLand, onLand } from '../games/racing/sim/land';
import type { MapDef, OnRoad, ZoneDef, ZoneKind } from '../games/racing/sim/map';
import { buildRoad, nearestOn, pointAt, ringRoad, smoothPath, type Road, type RoadDef } from '../games/racing/sim/roads';
import type { VehicleKind } from '../games/racing/sim/sim';

export type Pt = [number, number];

/** How a road is edited: control points for a smooth path, or a roundabout's ring by its middle and radius. */
export type RoadShape = { kind: 'path'; points: Pt[] } | { kind: 'ring'; x: number; z: number; r: number };

/** A map being edited: the map itself, its name, and control points for whatever has been edited so far. */
export interface Doc {
  name: string;
  map: MapDef;
  /** Per road, its shape once it has been edited (left out until then). */
  roads: (RoadShape | undefined)[];
  /** The shoreline's control points once it has been edited. */
  land?: Pt[];
  streams: (Pt[] | undefined)[];
  sand: (Pt[] | undefined)[];
}

/** Something on the map the editor can select, move, change or delete. */
export type Item =
  | { type: 'spawn' }
  | { type: 'road'; i: number }
  | { type: 'roadPoint'; i: number; k: number }
  | { type: 'land' }
  | { type: 'landPoint'; k: number }
  | { type: 'stream'; i: number }
  | { type: 'streamPoint'; i: number; k: number }
  | { type: 'sand'; i: number }
  | { type: 'sandPoint'; i: number; k: number }
  | { type: 'zone'; i: number }
  | { type: 'target'; i: number }
  | { type: 'pool'; i: number }
  | { type: 'puddle'; g: number; i: number }
  | { type: 'traffic'; i: number }
  | { type: 'animal'; i: number }
  | { type: 'boat'; i: number }
  | { type: 'hill'; i: number }
  | { type: 'guard'; i: number };

/** A problem with the map, with where it is when that is known. */
export interface Problem { text: string; x?: number; z?: number }

/** Points apart along a smoothed road, stream and shoreline (as the built-in maps use). */
const ROAD_STEP = 1.5;
const LAND_STEP = 2;
/** How far a smooth curve may stray from a road's own points when its control points are first made, in metres. */
const SIMPLIFY = 0.35;
/** An open road's end this close to another road joins it (a junction), in metres past that road's edge. */
const JOIN_REACH = 3;
/** Default sizes of a new set piece's zone (as the built-in maps use). */
export const ZONE_R: Record<ZoneKind, number> = {
  ramp: 3.5, 'car-wash': 4, garage: 4, mud: 6, ford: 6, lights: 5, roundabout: 12.5, harbour: 14,
};
/** Zone kinds placed on a road (facing along it); the others stand by their middle. */
export const ON_ROAD_ZONES: readonly ZoneKind[] = ['ramp', 'car-wash', 'garage', 'mud', 'ford', 'lights', 'harbour'];

const round = (n: number) => Math.round(n * 100) / 100;
const roundPt = ([x, z]: Pt): Pt => [round(x), round(z)];
const copy = <T>(v: T): T => structuredClone(v);

// The document

export function docFromMap(map: MapDef, name: string): Doc {
  return { name, map: copy(map), roads: map.roads.map(() => undefined), streams: (map.water.streams ?? []).map(() => undefined), sand: (map.sand ?? []).map(() => undefined) };
}

/** A map file's text as a document, or the reason it can't be opened (the same reading as the game's). */
export function docFromFile(text: string): Doc | { error: string } {
  const parsed = parseMapFile(text);
  return parsed.ok ? docFromMap(parsed.map, parsed.name) : { error: parsed.reason };
}

/** The map file for a document (ADR 0043), as `maps/file.ts` writes it. */
export const docToFile = (doc: Doc): string => mapToFile(doc.map, doc.name);

function edit(doc: Doc, change: (d: Doc) => void): Doc {
  const d = copy(doc);
  change(d);
  return d;
}

const roadsOf = (map: MapDef): Road[] => map.roads.map(buildRoad);

// Control points

/** Distance from p to the segment a-b. */
function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2));
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
}

/** Ramer-Douglas-Peucker: the indices of the points to keep so no point is further than `tol` from the line. */
function keep(points: Pt[], lo: number, hi: number, tol: number, out: Set<number>): void {
  let far = -1, best = tol;
  for (let i = lo + 1; i < hi; i++) {
    const d = segDist(points[i]!, points[lo]!, points[hi]!);
    if (d > best) {
      best = d;
      far = i;
    }
  }
  if (far < 0) return;
  out.add(far);
  keep(points, lo, far, tol, out);
  keep(points, far, hi, tol, out);
}

/**
 * A few control points for a long list of points, so a smooth curve through them follows the list closely. A loop's
 * first point is kept first, so what is placed by a fraction along it stays put.
 */
export function controlPoints(points: Pt[], closed: boolean, tol = SIMPLIFY): Pt[] {
  if (points.length <= 3) return points.map(roundPt);
  const list = closed ? [...points, points[0]!] : points;
  const kept = new Set([0, list.length - 1]);
  if (closed) {
    // Split the loop at the point furthest from its start, so both halves have ends to measure from.
    let far = 0, best = -1;
    list.forEach(([x, z], i) => {
      const d = Math.hypot(x - list[0]![0], z - list[0]![1]);
      if (d > best) {
        best = d;
        far = i;
      }
    });
    kept.add(far);
    keep(list, 0, far, tol, kept);
    keep(list, far, list.length - 1, tol, kept);
  } else {
    keep(list, 0, list.length - 1, tol, kept);
  }
  let idx = [...kept].sort((a, b) => a - b);
  if (closed) idx = idx.slice(0, -1);
  // A curve is smoothed between control points; keep them no more than about 25 m apart so it doesn't bulge.
  const out: number[] = [];
  const at = (i: number) => list[i]!;
  idx.forEach((i, n) => {
    out.push(i);
    const next = n + 1 < idx.length ? idx[n + 1]! : closed ? list.length - 1 : -1;
    if (next < 0) return;
    const gap = Math.hypot(at(next)[0] - at(i)[0], at(next)[1] - at(i)[1]);
    const extra = Math.floor(gap / 25);
    for (let e = 1; e <= extra; e++) out.push(Math.round(i + ((next - i) * e) / (extra + 1)));
  });
  const pts = [...new Set(out)].sort((a, b) => a - b).map((i) => roundPt(at(i)));
  // A loop needs at least four control points to stay a loop.
  if (closed && pts.length < 4) return [0, 1, 2, 3].map((q) => roundPt(points[Math.floor((q * points.length) / 4)]!));
  return pts;
}

/** Whether a road is a roundabout's ring (one-way and closed, every point about as far from its middle). */
function ringOf(def: RoadDef): RoadShape | undefined {
  if (!def.closed || !def.oneWay || def.points.length < 12) return undefined;
  const n = def.points.length;
  const x = def.points.reduce((s, p) => s + p[0], 0) / n, z = def.points.reduce((s, p) => s + p[1], 0) / n;
  const ds = def.points.map(([px, pz]) => Math.hypot(px - x, pz - z));
  const r = ds.reduce((s, d) => s + d, 0) / n;
  return ds.every((d) => Math.abs(d - r) < 0.05 * r + 0.05) ? { kind: 'ring', x: round(x), z: round(z), r: round(r) } : undefined;
}

/** A road's shape for editing: the one made earlier, or one made now from its points. */
export function roadShape(doc: Doc, i: number): RoadShape {
  const def = doc.map.roads[i]!;
  return doc.roads[i] ?? ringOf(def) ?? { kind: 'path', points: controlPoints(def.points, def.closed) };
}

/** A road's points from its shape. */
function roadPoints(shape: RoadShape, closed: boolean, width: number): Pt[] {
  if (shape.kind === 'ring') return ringRoad(shape.x, shape.z, shape.r, width).points;
  const pts = smoothPath(shape.points, closed && shape.points.length >= 3, ROAD_STEP);
  return pts.map(roundPt);
}

export const landShape = (doc: Doc): Pt[] => doc.land ?? controlPoints(doc.map.land.outline, true, 0.6);
export const streamShape = (doc: Doc, i: number): Pt[] => doc.streams[i] ?? controlPoints(doc.map.water.streams![i]!.points, false);
export const sandShape = (doc: Doc, i: number): Pt[] => doc.sand[i] ?? controlPoints(doc.map.sand![i]!, true, 0.6);

// Roads

/**
 * Gives road `i` a new shape and rebuilds its points. Roads joined to it keep their ends on it (each end is moved to
 * the nearest point of the road it joins), and a roundabout moved or resized takes its zone along.
 */
export function setRoadShape(doc: Doc, i: number, shape: RoadShape): Doc {
  return edit(doc, (d) => {
    const def = d.map.roads[i]!;
    const old = roadShape(d, i);
    d.roads[i] = copy(shape);
    def.points = roadPoints(shape, def.closed, def.width);
    if (shape.kind === 'ring' && old.kind === 'ring') {
      for (const z of d.map.zones ?? []) {
        if (z.kind !== 'roundabout' || 'road' in z.on || Math.hypot(z.on.x - old.x, z.on.z - old.z) > old.r) continue;
        z.on.x = shape.x;
        z.on.z = shape.z;
        z.r = round(shape.r + def.width / 2);
      }
    }
    reattach(d, i);
  });
}

/** Moves the ends of the open roads joined to road `i` back onto it. Changes `d` in place. */
function reattach(d: Doc, i: number): void {
  const road = buildRoad(d.map.roads[i]!);
  d.map.roads.forEach((def, j) => {
    if (j === i || def.closed) return;
    for (const end of ['from', 'to'] as const) {
      if (def[end] !== i) continue;
      const shape = roadShape(d, j);
      if (shape.kind !== 'path') continue;
      const k = end === 'from' ? 0 : shape.points.length - 1;
      const [x, z] = shape.points[k]!;
      const spot = nearestOn(road, i, x, z);
      if (spot.dist < 0.05) continue;
      const pts = shape.points.map((p) => [...p] as Pt);
      pts[k] = roundPt([spot.x, spot.z]);
      d.roads[j] = { kind: 'path', points: pts };
      def.points = roadPoints(d.roads[j]!, false, def.width);
    }
  });
}

/** The nearest other road to a point, if its edge is within `JOIN_REACH`. */
function joinable(map: MapDef, x: number, z: number, not: number): { road: number; x: number; z: number } | undefined {
  let best: { road: number; x: number; z: number; gap: number } | undefined;
  roadsOf(map).forEach((road, j) => {
    if (j === not) return;
    const spot = nearestOn(road, j, x, z);
    const gap = spot.dist - road.def.width / 2;
    if (gap < JOIN_REACH && (!best || gap < best.gap)) best = { road: j, x: round(spot.x), z: round(spot.z), gap };
  });
  return best;
}

/**
 * Moves control point `k` of road `i` (a ring's point 0 is its middle, point 1 a point on its edge, setting the
 * radius). An open road's end dragged near another road joins it there; dragged away, it joins nothing.
 */
export function moveRoadPoint(doc: Doc, i: number, k: number, x: number, z: number): Doc {
  const shape = roadShape(doc, i);
  if (shape.kind === 'ring') {
    if (k === 0) return setRoadShape(doc, i, { ...shape, x: round(x), z: round(z) });
    return setRoadShape(doc, i, { ...shape, r: round(Math.max(3, Math.hypot(x - shape.x, z - shape.z))) });
  }
  const def = doc.map.roads[i]!;
  const pts = shape.points.map((p) => [...p] as Pt);
  const end = def.closed ? undefined : k === 0 ? 'from' : k === pts.length - 1 ? 'to' : undefined;
  let join: number | undefined;
  if (end) {
    const near = joinable(doc.map, x, z, i);
    if (near) {
      [x, z] = [near.x, near.z];
      join = near.road;
    }
  }
  pts[k] = roundPt([x, z]);
  const next = setRoadShape(doc, i, { kind: 'path', points: pts });
  if (!end) return next;
  return edit(next, (d) => {
    const r = d.map.roads[i]!;
    if (join === undefined) delete r[end];
    else r[end] = join;
  });
}

/** Adds a control point to road `i` after point `k` (a ring has no control points to add). */
export function insertRoadPoint(doc: Doc, i: number, k: number, x: number, z: number): Doc {
  const shape = roadShape(doc, i);
  if (shape.kind === 'ring') return doc;
  const pts = shape.points.map((p) => [...p] as Pt);
  pts.splice(k + 1, 0, roundPt([x, z]));
  return setRoadShape(doc, i, { kind: 'path', points: pts });
}

/** Takes a control point off road `i`, as long as it keeps enough to be a road. */
export function deleteRoadPoint(doc: Doc, i: number, k: number): Doc {
  const shape = roadShape(doc, i);
  const def = doc.map.roads[i]!;
  if (shape.kind === 'ring' || shape.points.length <= (def.closed ? 4 : 2)) return doc;
  const pts = shape.points.filter((_, n) => n !== k);
  return setRoadShape(doc, i, { kind: 'path', points: pts });
}

/** Where along a control-point path the point (x, z) would go: after which control point. */
export function insertAfter(points: Pt[], closed: boolean, x: number, z: number): number {
  let best = 0, bestD = Infinity;
  const spans = closed ? points.length : points.length - 1;
  for (let k = 0; k < spans; k++) {
    const d = segDist([x, z], points[k]!, points[(k + 1) % points.length]!);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

export interface NewRoad { kind?: RoadDef['kind']; width?: number; closed?: boolean }

/**
 * A new road through `points` (control points). An open road's ends that touch other roads join them there
 * (junctions); a loop joins nothing. It is added last, so no other road's number changes.
 */
export function addRoad(doc: Doc, points: Pt[], opts: NewRoad = {}): Doc {
  const closed = opts.closed ?? false;
  if (points.length < (closed ? 3 : 2)) throw new Error(closed ? 'A loop needs at least 3 points.' : 'A road needs at least 2 points.');
  const pts = points.map(roundPt);
  const def: RoadDef = { kind: opts.kind ?? 'street', width: opts.width ?? 9, closed, points: [] };
  const i = doc.map.roads.length;
  if (!closed) {
    for (const [end, k] of [['from', 0], ['to', pts.length - 1]] as const) {
      const near = joinable(doc.map, pts[k]![0], pts[k]![1], -1);
      if (!near) continue;
      pts[k] = [near.x, near.z];
      def[end] = near.road;
    }
  }
  return edit(doc, (d) => {
    const shape: RoadShape = { kind: 'path', points: pts };
    def.points = roadPoints(shape, closed, def.width);
    d.map.roads.push(def);
    d.roads[i] = shape;
  });
}

/**
 * A roundabout (ADR 0042): a one-way ring road of radius `r` round (x, z) and its zone by the middle. Roads meet it
 * by having an end dragged onto the ring.
 */
export function addRoundabout(doc: Doc, x: number, z: number, r = 8, width = 9): Doc {
  return edit(doc, (d) => {
    d.roads[d.map.roads.length] = { kind: 'ring', x: round(x), z: round(z), r };
    d.map.roads.push(ringRoad(round(x), round(z), r, width));
    (d.map.zones ??= []).push({ kind: 'roundabout', on: { x: round(x), z: round(z) }, r: r + width / 2 });
  });
}

/**
 * Takes road `i` off the map with what sits on it (set pieces, targets, traffic, water, bridges); roads after it
 * move down a number. The start's road and the last road can't go.
 */
export function deleteRoad(doc: Doc, i: number): Doc {
  if (doc.map.roads.length <= 1) throw new Error('A map needs at least one road.');
  if (doc.map.spawn.road === i) throw new Error('The start is on this road: move the start to another road first.');
  return edit(doc, (d) => {
    const m = d.map;
    const renum = (r: number) => (r > i ? r - 1 : r);
    const onIt = (on: OnRoad | { x: number; z: number }) => 'road' in on && on.road === i;
    const move = (on: OnRoad | { x: number; z: number }) => {
      if ('road' in on) on.road = renum(on.road);
    };
    m.roads.splice(i, 1);
    d.roads.splice(i, 1);
    for (const r of m.roads) {
      for (const end of ['from', 'to'] as const) {
        if (r[end] === i) delete r[end];
        else if (r[end] !== undefined) r[end] = renum(r[end]!);
      }
    }
    move(m.spawn);
    if (m.zones) m.zones = m.zones.filter((z) => !onIt(z.on));
    if (m.guards) m.guards = m.guards.filter((g) => g.road !== i);
    if (m.targets) m.targets = m.targets.filter((t) => !onIt(t.on));
    m.traffic = m.traffic.filter((t) => !onIt(t.on));
    m.water.pools = m.water.pools.filter((p) => !onIt(p.on));
    m.water.puddles = m.water.puddles.filter((p) => p.road !== i);
    for (const list of [m.zones ?? [], m.targets ?? [], m.traffic, m.water.pools]) for (const o of list) move(o.on);
    for (const g of m.guards ?? []) g.road = renum(g.road);
    // Traffic by a rule (map tiles): the roads it may use.
    if (m.trafficNear?.roads) {
      m.trafficNear.roads = m.trafficNear.roads.filter((r) => r !== i).map(renum);
      if (!m.trafficNear.roads.length) delete m.trafficNear.roads;
    }
    for (const p of m.water.puddles) p.road = renum(p.road);
  });
}

// The land, streams and sand

/** A new shoreline through control points (smoothed, as the island's). */
export function setLand(doc: Doc, points: Pt[]): Doc {
  if (points.length < 3) throw new Error('The land needs at least 3 points.');
  return edit(doc, (d) => {
    d.land = points.map(roundPt);
    d.map.land.outline = smoothPath(d.land, true, LAND_STEP).map(roundPt);
  });
}

export function moveLandPoint(doc: Doc, k: number, x: number, z: number): Doc {
  const pts = landShape(doc).map((p) => [...p] as Pt);
  pts[k] = [x, z];
  return setLand(doc, pts);
}

export function setStream(doc: Doc, i: number, points: Pt[]): Doc {
  if (points.length < 2) throw new Error('A stream needs at least 2 points.');
  return edit(doc, (d) => {
    d.streams[i] = points.map(roundPt);
    d.map.water.streams![i]!.points = smoothPath(d.streams[i]!, false, ROAD_STEP).map(roundPt);
  });
}

/** A stream (ADR 0042) along control points, `width` metres across. Where it crosses a road, place a ford. */
export function addStream(doc: Doc, points: Pt[], width = 6): Doc {
  if (points.length < 2) throw new Error('A stream needs at least 2 points.');
  const next = edit(doc, (d) => {
    (d.map.water.streams ??= []).push({ points: [], width });
  });
  return setStream(next, next.map.water.streams!.length - 1, points);
}

export function setSand(doc: Doc, i: number, points: Pt[]): Doc {
  if (points.length < 3) throw new Error('Sand needs at least 3 points.');
  return edit(doc, (d) => {
    d.sand[i] = points.map(roundPt);
    d.map.sand![i] = d.sand[i]!.map((p) => [...p] as Pt);
  });
}

/** A sandy place (a beach) inside these points. */
export function addSand(doc: Doc, points: Pt[]): Doc {
  const next = edit(doc, (d) => {
    (d.map.sand ??= []).push([]);
  });
  return setSand(next, next.map.sand!.length - 1, points);
}

// Things placed on roads and on the land

/** The place on the nearest road to a point: a fraction along it and how far right of its centre line. */
export function onNearestRoad(map: MapDef, x: number, z: number): OnRoad {
  let best: OnRoad | undefined, bestD = Infinity;
  roadsOf(map).forEach((road, i) => {
    const spot = nearestOn(road, i, x, z);
    if (spot.dist < bestD) {
      bestD = spot.dist;
      best = { road: i, at: Math.min(1, Math.max(0, round4(spot.s / road.length))), offset: round(spot.offset) };
    }
  });
  return best!;
}
const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** A place on a road with the offset given (0: on the centre line). */
const onRoadAt = (map: MapDef, x: number, z: number, offset: number | ((o: number, road: RoadDef) => number)): OnRoad => {
  const on = onNearestRoad(map, x, z);
  const o = typeof offset === 'number' ? offset : offset(on.offset ?? 0, map.roads[on.road]!);
  return o ? { ...on, offset: round(o) } : { road: on.road, at: on.at };
};

/** A stack goes just off the road, on the side of the point, at least 1.5 m past its edge. */
const besideRoad = (o: number, road: RoadDef) => Math.sign(o || 1) * Math.max(Math.abs(o), road.width / 2 + 1.5);
/** Traffic keeps to a lane, on the side of the point. */
const inLane = (o: number) => Math.sign(o || 1) * 2.2;

/** A set piece (ADR 0042) at a point: on the nearest road, or a roundabout with its ring there. */
export function addZone(doc: Doc, kind: ZoneKind, x: number, z: number): Doc {
  if (kind === 'roundabout') return addRoundabout(doc, x, z);
  return edit(doc, (d) => {
    (d.map.zones ??= []).push({ kind, on: onRoadAt(d.map, x, z, 0), r: ZONE_R[kind] });
  });
}

/** A target (ADR 0041): a row of four stars on the road, or a stack of boxes just off it. */
export function addTarget(doc: Doc, id: TargetId, x: number, z: number): Doc {
  return edit(doc, (d) => {
    (d.map.targets ??= []).push(id === 'toy/star' ? { id, on: onRoadAt(d.map, x, z, 0), count: 4 } : { id, on: onRoadAt(d.map, x, z, besideRoad) });
  });
}

export type PoolKind = 'deep' | 'shallow' | 'mud';

/** A round pool on the nearest road: the flood (deep), a shallow one or a muddy one. */
export function addPool(doc: Doc, kind: PoolKind, x: number, z: number): Doc {
  return edit(doc, (d) => {
    d.map.water.pools.push({ on: onRoadAt(d.map, x, z, (o) => o), r: kind === 'deep' ? 12 : 6, deep: kind === 'deep', ...(kind === 'mud' ? { mud: true } : {}) });
  });
}

/** A puddle on the nearest road: added to that road's puddles (a new row when it has none). */
export function addPuddle(doc: Doc, x: number, z: number, mud = false): Doc {
  return edit(doc, (d) => {
    const on = onNearestRoad(d.map, x, z);
    const row = d.map.water.puddles.find((p) => p.road === on.road && !!p.mud === mud);
    if (row) row.at.push(on.at);
    else d.map.water.puddles.push({ road: on.road, at: [on.at], spread: 5, size: [2, 1.6], ...(mud ? { mud: true } : {}) });
  });
}

export function addTraffic(doc: Doc, kind: VehicleKind, x: number, z: number): Doc {
  return edit(doc, (d) => {
    d.map.traffic.push({ kind, on: onRoadAt(d.map, x, z, inLane), cruise: 7 });
  });
}

export function addAnimals(doc: Doc, id: AnimalId, x: number, z: number): Doc {
  return edit(doc, (d) => {
    (d.map.animals ??= []).push({ id, x: round(x), z: round(z), count: 3, roam: 6 });
  });
}

export function addBoat(doc: Doc, x: number, z: number): Doc {
  return edit(doc, (d) => {
    (d.map.boats ??= []).push({ x: round(x), z: round(z), heading: 0 });
  });
}

export function addHill(doc: Doc, x: number, z: number): Doc {
  return edit(doc, (d) => {
    (d.map.hills ??= []).push({ x: round(x), z: round(z), rx: 15, rz: 12, height: 8 });
  });
}

/** The kid's start, on the nearest road's centre line. */
export const setSpawn = (doc: Doc, x: number, z: number): Doc => edit(doc, (d) => {
  d.map.spawn = onRoadAt(d.map, x, z, 0);
});

// Moving, changing and deleting what is selected

/** Moves a thing placed on a road to the nearest road to (x, z), keeping its offset's kind. */
function moveOnRoad(map: MapDef, on: OnRoad, x: number, z: number, kind: 'centre' | 'beside' | 'lane' | 'free'): OnRoad {
  const offset = kind === 'centre' ? 0 : kind === 'beside' ? besideRoad : kind === 'lane' ? inLane : (o: number) => o;
  // A thing kept on the centre line keeps the offset it had (a star row along a lane, say).
  if (kind === 'centre' && on.offset) return onRoadAt(map, x, z, on.offset);
  return onRoadAt(map, x, z, offset);
}

/** Moves the selected thing so it is at (x, z): a thing on a road goes to the nearest road there. */
export function moveItem(doc: Doc, item: Item, x: number, z: number): Doc {
  switch (item.type) {
    case 'roadPoint': return moveRoadPoint(doc, item.i, item.k, x, z);
    case 'landPoint': return moveLandPoint(doc, item.k, x, z);
    case 'streamPoint': {
      const pts = streamShape(doc, item.i).map((p) => [...p] as Pt);
      pts[item.k] = [x, z];
      return setStream(doc, item.i, pts);
    }
    case 'sandPoint': {
      const pts = sandShape(doc, item.i).map((p) => [...p] as Pt);
      pts[item.k] = [x, z];
      return setSand(doc, item.i, pts);
    }
    case 'road': case 'land': case 'stream': case 'sand': case 'guard': return doc;
    default: break;
  }
  return edit(doc, (d) => {
    const m = d.map;
    switch (item.type) {
      case 'spawn': m.spawn = moveOnRoad(m, m.spawn, x, z, 'centre'); break;
      case 'zone': {
        const zone = m.zones![item.i]!;
        if ('road' in zone.on) zone.on = moveOnRoad(m, zone.on, x, z, 'centre');
        else zone.on = { ...zone.on, x: round(x), z: round(z) };
        break;
      }
      case 'target': {
        const t = m.targets![item.i]!;
        t.on = moveOnRoad(m, t.on, x, z, t.id === 'toy/star' ? 'centre' : 'beside');
        break;
      }
      case 'pool': m.water.pools[item.i]!.on = moveOnRoad(m, m.water.pools[item.i]!.on, x, z, 'free'); break;
      case 'puddle': {
        const on = onNearestRoad(m, x, z);
        const row = m.water.puddles[item.g]!;
        if (on.road === row.road) row.at[item.i] = on.at;
        break;
      }
      case 'traffic': m.traffic[item.i]!.on = moveOnRoad(m, m.traffic[item.i]!.on, x, z, 'lane'); break;
      case 'animal': Object.assign(m.animals![item.i]!, { x: round(x), z: round(z) }); break;
      case 'boat': Object.assign(m.boats![item.i]!, { x: round(x), z: round(z) }); break;
      case 'hill': Object.assign(m.hills![item.i]!, { x: round(x), z: round(z) }); break;
    }
  });
}

/** Takes the selected thing off the map (a control point off its road, shoreline, stream or sand). */
export function deleteItem(doc: Doc, item: Item): Doc {
  switch (item.type) {
    case 'road': return deleteRoad(doc, item.i);
    case 'roadPoint': return deleteRoadPoint(doc, item.i, item.k);
    case 'landPoint': {
      const pts = landShape(doc);
      return pts.length > 3 ? setLand(doc, pts.filter((_, n) => n !== item.k)) : doc;
    }
    case 'streamPoint': {
      const pts = streamShape(doc, item.i);
      return pts.length > 2 ? setStream(doc, item.i, pts.filter((_, n) => n !== item.k)) : doc;
    }
    case 'sandPoint': {
      const pts = sandShape(doc, item.i);
      return pts.length > 3 ? setSand(doc, item.i, pts.filter((_, n) => n !== item.k)) : doc;
    }
    case 'spawn': throw new Error('A map needs its start: move it instead.');
    case 'land': throw new Error('A map needs its land: draw a new shoreline instead.');
    default: break;
  }
  return edit(doc, (d) => {
    const m = d.map;
    switch (item.type) {
      case 'stream': m.water.streams!.splice(item.i, 1); d.streams.splice(item.i, 1); break;
      case 'sand': m.sand!.splice(item.i, 1); d.sand.splice(item.i, 1); break;
      case 'zone': m.zones!.splice(item.i, 1); break;
      case 'target': m.targets!.splice(item.i, 1); break;
      case 'pool': m.water.pools.splice(item.i, 1); break;
      case 'puddle': {
        const row = m.water.puddles[item.g]!;
        row.at.splice(item.i, 1);
        if (!row.at.length) m.water.puddles.splice(item.g, 1);
        break;
      }
      case 'traffic': m.traffic.splice(item.i, 1); break;
      case 'animal': m.animals!.splice(item.i, 1); break;
      case 'boat': m.boats!.splice(item.i, 1); break;
      case 'hill': m.hills!.splice(item.i, 1); break;
      case 'guard': m.guards!.splice(item.i, 1); break;
    }
  });
}

/** The part of the map file a selected thing is, as it is written there, for the editor's details box. */
export function itemValue(doc: Doc, item: Item): unknown {
  const m = doc.map;
  switch (item.type) {
    case 'spawn': return m.spawn;
    case 'road': case 'roadPoint': {
      const { points, ...rest } = m.roads[item.i]!;
      return { ...rest, points: `${points.length} points` };
    }
    case 'land': case 'landPoint': return { beach: m.land.beach, outline: `${m.land.outline.length} points` };
    case 'stream': case 'streamPoint': return { width: m.water.streams![item.i]!.width, points: `${m.water.streams![item.i]!.points.length} points` };
    case 'sand': case 'sandPoint': return { points: `${m.sand![item.i]!.length} points` };
    case 'zone': return m.zones![item.i];
    case 'target': return m.targets![item.i];
    case 'pool': return m.water.pools[item.i];
    case 'puddle': return m.water.puddles[item.g];
    case 'traffic': return m.traffic[item.i];
    case 'animal': return m.animals![item.i];
    case 'boat': return m.boats![item.i];
    case 'hill': return m.hills![item.i];
    case 'guard': return m.guards![item.i];
  }
}

/**
 * Changes a selected thing to `value` (edited in the details box). A road, the land or a stream keep their points:
 * only the other fields change. The map's own checks then say if a value is wrong.
 */
export function setItemValue(doc: Doc, item: Item, value: unknown): Doc {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('It needs to be an object { }.');
  const v = copy(value) as Record<string, unknown>;
  return edit(doc, (d) => {
    const m = d.map;
    const put = <T extends object>(list: T[], i: number) => void (list[i] = v as T);
    switch (item.type) {
      case 'spawn': m.spawn = v as unknown as OnRoad; break;
      case 'road': case 'roadPoint': {
        const def = m.roads[item.i]!;
        const { points: _p, ...rest } = v;
        for (const k of ['from', 'to', 'oneWay'] as const) delete def[k];
        Object.assign(def, rest);
        // A new width changes a ring's points, which are built for it.
        const shape = d.roads[item.i];
        if (shape) def.points = roadPoints(shape, def.closed, def.width);
        break;
      }
      case 'land': case 'landPoint': m.land.beach = v.beach as number; break;
      case 'stream': case 'streamPoint': m.water.streams![item.i]!.width = v.width as number; break;
      case 'sand': case 'sandPoint': break;
      case 'zone': put(m.zones!, item.i); break;
      case 'target': put(m.targets!, item.i); break;
      case 'pool': put(m.water.pools, item.i); break;
      case 'puddle': put(m.water.puddles, item.g); break;
      case 'traffic': put(m.traffic, item.i); break;
      case 'animal': put(m.animals!, item.i); break;
      case 'boat': put(m.boats!, item.i); break;
      case 'hill': put(m.hills!, item.i); break;
      case 'guard': put(m.guards!, item.i); break;
    }
  });
}

/** The map's settings that aren't placed on it (scattered trees, toys and decor, traffic's rules, the id). */
export function settingsValue(doc: Doc): Record<string, unknown> {
  const { id, propCount, trafficPrefer, trafficNear, trees, props, decor } = doc.map;
  return { id, propCount, trafficPrefer, trafficNear, trees, props, decor };
}

export function setSettings(doc: Doc, value: unknown): Doc {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('It needs to be an object { }.');
  const v = copy(value) as Partial<MapDef>;
  return edit(doc, (d) => {
    for (const k of ['id', 'propCount', 'trafficPrefer', 'trafficNear', 'trees', 'props', 'decor'] as const) {
      if (v[k] === undefined) delete d.map[k];
      else (d.map as unknown as Record<string, unknown>)[k] = v[k];
    }
  });
}

// Where things are, for drawing and picking

/** A thing placed at one spot, for drawing and picking. */
export interface Marker { item: Item; x: number; z: number; label: string }

/** Where a place on a road is. */
export function spotOn(roads: Road[], on: OnRoad, along = 0): { x: number; z: number; heading: number } {
  const road = roads[on.road];
  if (!road) return { x: NaN, z: NaN, heading: 0 };
  return pointAt(road, on.at * road.length + along, on.offset ?? 0);
}

/** Where a zone's middle is. */
export function zoneSpot(roads: Road[], zone: ZoneDef): { x: number; z: number } {
  return 'road' in zone.on ? spotOn(roads, zone.on) : zone.on;
}

/** Every thing placed at a spot (not the roads, land, streams and sand, which are drawn as lines). */
export function markers(map: MapDef, roads: Road[] = roadsOf(map)): Marker[] {
  const out: Marker[] = [];
  const add = (item: Item, p: { x: number; z: number }, label: string) => {
    if (Number.isFinite(p.x) && Number.isFinite(p.z)) out.push({ item, x: p.x, z: p.z, label });
  };
  (map.zones ?? []).forEach((z, i) => add({ type: 'zone', i }, zoneSpot(roads, z), z.kind));
  (map.targets ?? []).forEach((t, i) => add({ type: 'target', i }, spotOn(roads, t.on), t.id === 'toy/star' ? `stars × ${t.count ?? 1}` : 'stack'));
  map.water.pools.forEach((p, i) => add({ type: 'pool', i }, spotOn(roads, p.on), p.deep ? 'flood' : p.mud ? 'mud pool' : 'pool'));
  map.water.puddles.forEach((row, g) => row.at.forEach((at, i) => add({ type: 'puddle', g, i }, spotOn(roads, { road: row.road, at }), row.mud ? 'mud' : 'puddle')));
  map.traffic.forEach((t, i) => add({ type: 'traffic', i }, spotOn(roads, t.on), t.kind));
  (map.animals ?? []).forEach((a, i) => add({ type: 'animal', i }, a, `${a.id.replace('animal/', '')} × ${a.count}`));
  (map.boats ?? []).forEach((b, i) => add({ type: 'boat', i }, b, 'boat'));
  (map.hills ?? []).forEach((h, i) => add({ type: 'hill', i }, h, 'hill'));
  (map.guards ?? []).forEach((g, i) => add({ type: 'guard', i }, spotOn(roads, { road: g.road, at: (g.from + g.to) / 2 }), g.kind));
  add({ type: 'spawn' }, spotOn(roads, map.spawn), 'start');
  return out;
}

/** The control points of a selected road, shoreline, stream or sand, as items to drag. */
export function handles(doc: Doc, item: Item | null): { item: Item; x: number; z: number }[] {
  if (!item) return [];
  const pts = (list: Pt[], make: (k: number) => Item) => list.map(([x, z], k) => ({ item: make(k), x, z }));
  switch (item.type) {
    case 'road': case 'roadPoint': {
      const i = item.i;
      const shape = roadShape(doc, i);
      if (shape.kind === 'ring') {
        return [{ item: { type: 'roadPoint', i, k: 0 }, x: shape.x, z: shape.z }, { item: { type: 'roadPoint', i, k: 1 }, x: shape.x, z: shape.z + shape.r }];
      }
      return pts(shape.points, (k) => ({ type: 'roadPoint', i, k }));
    }
    case 'land': case 'landPoint': return pts(landShape(doc), (k) => ({ type: 'landPoint', k }));
    case 'stream': case 'streamPoint': return pts(streamShape(doc, item.i), (k) => ({ type: 'streamPoint', i: item.i, k }));
    case 'sand': case 'sandPoint': return pts(sandShape(doc, item.i), (k) => ({ type: 'sandPoint', i: item.i, k }));
    default: return [];
  }
}

/** The line a control point belongs to (a road's point to its road), for keeping it selected. */
export function owner(item: Item): Item {
  switch (item.type) {
    case 'roadPoint': return { type: 'road', i: item.i };
    case 'landPoint': return { type: 'land' };
    case 'streamPoint': return { type: 'stream', i: item.i };
    case 'sandPoint': return { type: 'sand', i: item.i };
    default: return item;
  }
}

/** Inserts a control point on the selected line where it is nearest (x, z). */
export function insertPoint(doc: Doc, item: Item, x: number, z: number): Doc {
  switch (item.type) {
    case 'road': case 'roadPoint': {
      const shape = roadShape(doc, item.i);
      if (shape.kind === 'ring') return doc;
      return insertRoadPoint(doc, item.i, insertAfter(shape.points, doc.map.roads[item.i]!.closed, x, z), x, z);
    }
    case 'land': case 'landPoint': {
      const pts = landShape(doc).map((p) => [...p] as Pt);
      pts.splice(insertAfter(pts, true, x, z) + 1, 0, [x, z]);
      return setLand(doc, pts);
    }
    case 'stream': case 'streamPoint': {
      const pts = streamShape(doc, item.i).map((p) => [...p] as Pt);
      pts.splice(insertAfter(pts, false, x, z) + 1, 0, [x, z]);
      return setStream(doc, item.i, pts);
    }
    case 'sand': case 'sandPoint': {
      const pts = sandShape(doc, item.i).map((p) => [...p] as Pt);
      pts.splice(insertAfter(pts, true, x, z) + 1, 0, [x, z]);
      return setSand(doc, item.i, pts);
    }
    default: return doc;
  }
}

// Problems

/**
 * What the editor checks beyond the map's own rules (`maps/check.ts`): roads in the sea, junction ends that have come
 * off the road they join, and dead ends (recipes/maps.md: loops and junctions only).
 */
export function editorProblems(map: MapDef): Problem[] {
  const out: Problem[] = [];
  let roads: Road[];
  try {
    roads = roadsOf(map);
  } catch {
    return out;
  }
  const land = buildLand(map.land);
  const guards = buildGuards(map.guards, roads);
  roads.forEach((road, i) => {
    const sea = road.def.points.find(([x, z]) => !onLand(land, x, z) && guardAt(guards, roads, x, z)?.guard.kind !== 'bridge');
    if (sea) out.push({ text: `roads[${i}] runs into the sea at ${sea[0].toFixed(0)}, ${sea[1].toFixed(0)}: keep it on the land, or make that stretch a bridge.`, x: sea[0], z: sea[1] });
    if (road.def.closed) return;
    const pts = road.def.points;
    for (const [end, [x, z], name] of [['from', pts[0]!, 'start'], ['to', pts[pts.length - 1]!, 'end']] as const) {
      const joins = road.def[end];
      if (joins === undefined) {
        out.push({ text: `roads[${i}]'s ${name} is a dead end: drag it onto another road to join it.`, x, z });
      } else if (roads[joins]) {
        const gap = nearestOn(roads[joins]!, joins, x, z).dist;
        // A metre or two off is how hand-made maps join (the large stand-in's do); further is a road pulled away.
        if (gap > 2) out.push({ text: `roads[${i}]'s ${name} is ${gap.toFixed(0)} m from road ${joins}, which it joins: drag it back onto that road.`, x, z });
      }
    }
  });
  return out;
}

/** Where a problem from `check.ts` is on the map, when its text says (a place, or a zone's number). */
function whereIs(map: MapDef, roads: Road[], text: string): { x?: number; z?: number } {
  const at = /at (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)/.exec(text);
  if (at) return { x: Number(at[1]), z: Number(at[2]) };
  const zone = /zones\[(\d+)\]/.exec(text);
  const z = zone ? map.zones?.[Number(zone[1])] : undefined;
  if (z) {
    try {
      return zoneSpot(roads, z);
    } catch {
      return {};
    }
  }
  return {};
}

/** Every problem with the document's map: the game's own checks (as a map file is checked on load), then the editor's. */
export function allProblems(doc: Doc): Problem[] {
  const out: Problem[] = [];
  if (!doc.name.trim() || doc.name.length > 60) out.push({ text: 'The map needs a name of 1 to 60 characters.' });
  const checks = mapProblems(doc.map);
  let roads: Road[] = [];
  try {
    roads = roadsOf(doc.map);
  } catch {
    // The shape check has said what is wrong.
  }
  out.push(...checks.map((text) => ({ text, ...whereIs(doc.map, roads, text) })));
  return [...out, ...editorProblems(doc.map)];
}

// Undo

/**
 * The editor's history: the document now, the ones before it (undo) and after it (redo). A drag shows each step
 * with `preview` and keeps only where it ended with `commit`.
 */
export class History {
  private past: Doc[] = [];
  private future: Doc[] = [];
  /** The document as last committed; `present` differs from it only during a preview. */
  private committed: Doc;
  present: Doc;

  constructor(doc: Doc, private readonly limit = 200) {
    this.committed = this.present = doc;
  }

  /** A change shown but not kept yet (a drag in progress). */
  preview(doc: Doc): void {
    this.present = doc;
  }

  /** Keeps a change (or the preview shown) as one step to undo. */
  commit(doc: Doc = this.present): void {
    this.present = doc;
    if (doc === this.committed) return;
    this.past.push(this.committed);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    this.committed = doc;
  }

  /** Drops a preview: back to the document as last committed. */
  cancel(): void {
    this.present = this.committed;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  undo(): void {
    const doc = this.past.pop();
    if (!doc) return;
    this.future.push(this.committed);
    this.committed = this.present = doc;
  }

  redo(): void {
    const doc = this.future.pop();
    if (!doc) return;
    this.past.push(this.committed);
    this.committed = this.present = doc;
  }
}
