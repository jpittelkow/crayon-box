// Dev tool: a driving map drawn flat from above on a 2D canvas, for the map editor (the whole map) and the map viewer
// (labels and layers over the game's own picture). North is up and east is right; the simulation's x grows westward,
// so x is turned round here and nowhere else. Text is fine: these pages are for grown-ups making maps.
import { ZONE_COLORS } from './mapSource';
import { spotOn, zoneSpot, type Marker, type Problem } from './mapEdit';
import type { MapDef } from '../games/racing/sim/map';
import type { Road } from '../games/racing/sim/roads';
import type { World } from '../games/racing/sim/sim';

/** What part of the map is in view: the middle (simulation x and z), pixels per metre, and the canvas's size. */
export interface Frame { cx: number; cz: number; scale: number; w: number; h: number }

export const toScreen = (f: Frame, x: number, z: number): [number, number] => [f.w / 2 - (x - f.cx) * f.scale, f.h / 2 - (z - f.cz) * f.scale];
export const toMap = (f: Frame, sx: number, sy: number): [number, number] => [f.cx - (sx - f.w / 2) / f.scale, f.cz - (sy - f.h / 2) / f.scale];

/** The whole land in view, with a little room round it. */
export function fitFrame(map: MapDef, w: number, h: number, room = 1.1): Frame {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of map.land.outline) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const scale = Math.min(w / ((maxX - minX) * room || 1), h / ((maxZ - minZ) * room || 1));
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, scale, w, h };
}

/** Zooms by `factor` about a point on the canvas, which stays where it is. */
export function zoomAt(f: Frame, sx: number, sy: number, factor: number): Frame {
  const [x, z] = toMap(f, sx, sy);
  const scale = Math.min(60, Math.max(0.05, f.scale * factor));
  return { ...f, scale, cx: x + (sx - f.w / 2) / scale, cz: z + (sy - f.h / 2) / scale };
}

const path = (g: CanvasRenderingContext2D, f: Frame, pts: readonly (readonly [number, number])[], closed: boolean) => {
  g.beginPath();
  pts.forEach(([x, z], i) => {
    const [sx, sy] = toScreen(f, x, z);
    if (i) g.lineTo(sx, sy);
    else g.moveTo(sx, sy);
  });
  if (closed) g.closePath();
};

const circle = (g: CanvasRenderingContext2D, f: Frame, x: number, z: number, r: number) => {
  const [sx, sy] = toScreen(f, x, z);
  g.beginPath();
  g.arc(sx, sy, Math.max(1, r * f.scale), 0, Math.PI * 2);
};

/** A label with a pale halo, so it reads on any ground. */
export function label(g: CanvasRenderingContext2D, text: string, sx: number, sy: number, color = '#1d2733', size = 12): void {
  g.font = `600 ${size}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 3.5;
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.strokeText(text, sx, sy);
  g.fillStyle = color;
  g.fillText(text, sx, sy);
}

/** The sea, the land, sand, hills, water and the roads, as the editor draws the whole map. */
export function drawGround(g: CanvasRenderingContext2D, f: Frame, map: MapDef, roads: Road[]): void {
  g.fillStyle = '#4f97cf';
  g.fillRect(0, 0, f.w, f.h);
  path(g, f, map.land.outline, true);
  g.fillStyle = '#e8d9a8';
  g.fill();
  // The grass inside the beach: the shoreline drawn again, narrower by the beach's width (a thick sand edge).
  g.save();
  g.clip();
  g.fillStyle = '#7cbf5a';
  g.fill();
  path(g, f, map.land.outline, true);
  g.strokeStyle = '#e8d9a8';
  g.lineWidth = Math.max(1, map.land.beach * 2 * f.scale);
  g.stroke();
  g.restore();
  for (const sand of map.sand ?? []) {
    path(g, f, sand, true);
    g.fillStyle = '#e8d9a8';
    g.fill();
  }
  for (const h of map.hills ?? []) {
    const [sx, sy] = toScreen(f, h.x, h.z);
    g.beginPath();
    g.ellipse(sx, sy, h.rx * f.scale, h.rz * f.scale, 0, 0, Math.PI * 2);
    g.fillStyle = h.color !== undefined ? `#${h.color.toString(16).padStart(6, '0')}` : '#5c9a45';
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 1;
    g.stroke();
  }
  g.lineCap = 'round';
  g.lineJoin = 'round';
  roads.forEach((road) => {
    const def = road.def;
    path(g, f, def.points, def.closed);
    g.strokeStyle = def.kind === 'dirt' ? '#a8814f' : '#7d838c';
    g.lineWidth = Math.max(2, def.width * f.scale);
    g.stroke();
    if (def.kind === 'street' && f.scale > 1) {
      g.setLineDash([3 * f.scale, 3 * f.scale]);
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = Math.max(1, 0.25 * f.scale);
      g.stroke();
      g.setLineDash([]);
    }
  });
  // Water lies over the roads, as in the game (a ford, a flood across the road, puddles on it).
  g.globalAlpha = 0.85;
  for (const s of map.water.streams ?? []) {
    path(g, f, s.points, false);
    g.strokeStyle = '#7fc3ee';
    g.lineWidth = Math.max(1.5, s.width * f.scale);
    g.stroke();
  }
  for (const p of map.water.pools) {
    const at = spotOn(roads, p.on);
    circle(g, f, at.x, at.z, p.r);
    g.fillStyle = p.mud ? '#7a5634' : p.deep ? '#2f78b8' : '#86c8f0';
    g.fill();
  }
  for (const row of map.water.puddles) {
    for (const at of row.at) {
      const p = spotOn(roads, { road: row.road, at });
      circle(g, f, p.x, p.z, row.size[0] + row.size[1] / 2);
      g.fillStyle = row.mud ? '#7a5634' : '#86c8f0';
      g.fill();
    }
  }
  g.globalAlpha = 1;
  // Bridges and tunnels over their stretch of road.
  for (const gd of map.guards ?? []) {
    const road = roads[gd.road];
    if (!road) continue;
    const pts: [number, number][] = [];
    const a = Math.min(gd.from, gd.to), b = Math.max(gd.from, gd.to);
    for (let t = a; t <= b + 1e-9; t += Math.max(0.001, (b - a) / 40)) {
      const p = spotOn(roads, { road: gd.road, at: t });
      pts.push([p.x, p.z]);
    }
    path(g, f, pts, false);
    g.strokeStyle = gd.kind === 'bridge' ? '#b98b5e' : '#3d3f45';
    g.lineWidth = Math.max(2, (road.def.width + 1.5) * f.scale);
    g.globalAlpha = 0.85;
    g.stroke();
    g.globalAlpha = 1;
  }
}

/** The scattered trees and toys of a built world (placed at random by the map's rules), as small dots. */
export function drawScatter(g: CanvasRenderingContext2D, f: Frame, w: World): void {
  g.fillStyle = 'rgba(30,80,30,0.65)';
  for (const t of w.trees) {
    circle(g, f, t.x, t.z, Math.max(0.8, 1.6 * t.scale));
    g.fill();
  }
  g.fillStyle = 'rgba(200,60,40,0.7)';
  for (const p of w.props) {
    if (p.stack >= 0 || p.toy === 'toy/star') continue;
    circle(g, f, p.x, p.z, 0.6);
    g.fill();
  }
}

/** Road numbers, lengths and the way each road goes (one-way roads with a double arrow); junctions as dots. */
export function drawRoadLabels(g: CanvasRenderingContext2D, f: Frame, roads: Road[]): void {
  roads.forEach((road, i) => {
    const def = road.def;
    // An arrow along the road a quarter of the way along it, the way its points go.
    for (const t of def.oneWay ? [0.15, 0.4, 0.65, 0.9] : [0.25]) {
      const p = spotOn(roads, { road: i, at: t });
      const [sx, sy] = toScreen(f, p.x, p.z);
      // Heading h points along (sin h, cos h) in x and z; on screen x is turned round and z is up.
      const dx = -Math.sin(p.heading), dy = -Math.cos(p.heading);
      g.beginPath();
      g.moveTo(sx + dx * 7, sy + dy * 7);
      g.lineTo(sx - dx * 5 - dy * 5, sy - dy * 5 + dx * 5);
      g.lineTo(sx - dx * 5 + dy * 5, sy - dy * 5 - dx * 5);
      g.closePath();
      g.fillStyle = def.oneWay ? '#d23c3c' : '#ffffff';
      g.fill();
    }
    const mid = spotOn(roads, { road: i, at: def.closed ? 0.6 : 0.5 });
    const [sx, sy] = toScreen(f, mid.x, mid.z);
    label(g, `road ${i} · ${road.length.toFixed(0)} m${def.oneWay ? ' · one way' : ''}`, sx, sy - 12, '#0b2a55');
    for (const [end, k] of [['from', 0], ['to', def.points.length - 1]] as const) {
      if (def.closed) continue;
      const [x, z] = def.points[k]!;
      const [ex, ey] = toScreen(f, x, z);
      g.beginPath();
      g.arc(ex, ey, 4, 0, Math.PI * 2);
      g.fillStyle = def[end] === undefined ? '#d23c3c' : '#ffd23f';
      g.fill();
      g.strokeStyle = '#333';
      g.lineWidth = 1;
      g.stroke();
    }
  });
}

/** Set pieces as their zones (coloured by kind, with their name), and a harbour's way out to sea. */
export function drawZones(g: CanvasRenderingContext2D, f: Frame, map: MapDef, roads: Road[]): void {
  for (const zone of map.zones ?? []) {
    const p = zoneSpot(roads, zone);
    circle(g, f, p.x, p.z, zone.r);
    g.fillStyle = `${ZONE_COLORS[zone.kind]}55`;
    g.fill();
    g.strokeStyle = ZONE_COLORS[zone.kind];
    g.lineWidth = 2;
    g.stroke();
    if (zone.sail?.length) {
      path(g, f, zone.sail, false);
      g.setLineDash([5, 4]);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.5;
      g.stroke();
      g.setLineDash([]);
    }
    const [sx, sy] = toScreen(f, p.x, p.z);
    label(g, zone.kind, sx, sy, '#3a1d00');
  }
}

/** Star rows (each star) and stacks of boxes. */
export function drawTargets(g: CanvasRenderingContext2D, f: Frame, map: MapDef, roads: Road[]): void {
  for (const t of map.targets ?? []) {
    for (let k = 0; k < (t.count ?? 1); k++) {
      const p = spotOn(roads, t.on, k * (t.gap ?? 4));
      const [sx, sy] = toScreen(f, p.x, p.z);
      const r = Math.max(3, Math.min(8, 0.8 * f.scale));
      g.beginPath();
      if (t.id === 'toy/star') {
        for (let n = 0; n < 10; n++) {
          const a = (n / 10) * Math.PI * 2 - Math.PI / 2, rr = n % 2 ? r * 0.45 : r;
          g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
        }
        g.closePath();
        g.fillStyle = '#ffd23f';
      } else {
        g.rect(sx - r, sy - r, r * 2, r * 2);
        g.fillStyle = '#e5813a';
      }
      g.fill();
      g.strokeStyle = '#5a3a00';
      g.lineWidth = 1;
      g.stroke();
    }
  }
}

/** The things placed one at a time: the start, traffic, herds, boats (and what `markers` lists), with names. */
export function drawThings(g: CanvasRenderingContext2D, f: Frame, map: MapDef, roads: Road[], names = true): void {
  for (const a of map.animals ?? []) {
    circle(g, f, a.x, a.z, a.roam);
    g.setLineDash([4, 3]);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.5;
    g.stroke();
    g.setLineDash([]);
    const [sx, sy] = toScreen(f, a.x, a.z);
    g.beginPath();
    g.arc(sx, sy, 4, 0, Math.PI * 2);
    g.fillStyle = '#ffffff';
    g.fill();
    if (names) label(g, `${a.id.replace('animal/', '')} × ${a.count}`, sx, sy + 12);
  }
  for (const b of map.boats ?? []) {
    const [sx, sy] = toScreen(f, b.x, b.z);
    g.save();
    g.translate(sx, sy);
    g.rotate(-b.heading);
    g.beginPath();
    g.ellipse(0, 0, Math.max(3, 1.5 * f.scale), Math.max(6, 4 * f.scale), 0, 0, Math.PI * 2);
    g.fillStyle = '#f4f1e8';
    g.fill();
    g.strokeStyle = '#6b4a2a';
    g.stroke();
    g.restore();
  }
  map.traffic.forEach((t) => {
    const p = spotOn(roads, t.on);
    const [sx, sy] = toScreen(f, p.x, p.z);
    g.beginPath();
    g.arc(sx, sy, 4.5, 0, Math.PI * 2);
    g.fillStyle = '#3b6fd6';
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.5;
    g.stroke();
    if (names) label(g, t.kind, sx, sy + 11, '#16336b', 10);
  });
  const s = spotOn(roads, map.spawn);
  if (Number.isFinite(s.x)) {
    const [sx, sy] = toScreen(f, s.x, s.z);
    const dx = -Math.sin(s.heading), dy = -Math.cos(s.heading);
    g.beginPath();
    g.moveTo(sx + dx * 12, sy + dy * 12);
    g.lineTo(sx - dx * 7 - dy * 8, sy - dy * 7 + dx * 8);
    g.lineTo(sx - dx * 7 + dy * 8, sy - dy * 7 - dx * 8);
    g.closePath();
    g.fillStyle = '#1fa64a';
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.stroke();
    if (names) label(g, 'start', sx, sy + 16, '#0d4d22');
  }
}

/** A grid of round-numbered lines in the simulation's own x and z (as the map file has them). */
export function drawGrid(g: CanvasRenderingContext2D, f: Frame): void {
  const step = [5, 10, 25, 50, 100, 250, 500, 1000].find((s) => s * f.scale >= 70) ?? 1000;
  const [x0, z0] = toMap(f, f.w, f.h), [x1, z1] = toMap(f, 0, 0);
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.lineWidth = 1;
  g.font = '11px system-ui, sans-serif';
  for (let x = Math.ceil(Math.min(x0, x1) / step) * step; x <= Math.max(x0, x1); x += step) {
    const [sx] = toScreen(f, x, 0);
    g.beginPath();
    g.moveTo(sx, 0);
    g.lineTo(sx, f.h);
    g.stroke();
    label(g, `x ${x}`, sx, 10, '#10304f', 11);
  }
  for (let z = Math.ceil(Math.min(z0, z1) / step) * step; z <= Math.max(z0, z1); z += step) {
    const [, sy] = toScreen(f, 0, z);
    g.beginPath();
    g.moveTo(0, sy);
    g.lineTo(f.w, sy);
    g.stroke();
    label(g, `z ${z}`, 24, sy, '#10304f', 11);
  }
  // Which way is which: the simulation's x grows westward.
  label(g, 'N ↑  ·  E →  (x grows west)', f.w - 100, f.h - 12, '#10304f', 11);
}

/** Places a kid can reach further than the reach from every road (`farFromRoad`), as red squares. */
export function drawFar(g: CanvasRenderingContext2D, f: Frame, far: [number, number][], step: number): void {
  g.fillStyle = 'rgba(220,30,30,0.45)';
  const size = Math.max(1, step * f.scale);
  for (const [x, z] of far) {
    const [sx, sy] = toScreen(f, x, z);
    g.fillRect(sx - size / 2, sy - size / 2, size, size);
  }
}

/** Problems with a known place, as numbered red rings (the number is its place in the list). */
export function drawProblems(g: CanvasRenderingContext2D, f: Frame, problems: Problem[]): void {
  problems.forEach((p, n) => {
    if (p.x === undefined || p.z === undefined) return;
    const [sx, sy] = toScreen(f, p.x, p.z);
    g.beginPath();
    g.arc(sx, sy, 11, 0, Math.PI * 2);
    g.strokeStyle = '#e01b1b';
    g.lineWidth = 3;
    g.stroke();
    label(g, String(n + 1), sx, sy, '#e01b1b', 12);
  });
}

/** Rings round the selected thing's marker. */
export function drawMarkerRing(g: CanvasRenderingContext2D, f: Frame, m: Pick<Marker, 'x' | 'z'>, color = '#ff2bd6'): void {
  const [sx, sy] = toScreen(f, m.x, m.z);
  g.beginPath();
  g.arc(sx, sy, 10, 0, Math.PI * 2);
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.stroke();
}
