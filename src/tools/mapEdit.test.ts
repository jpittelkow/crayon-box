import { describe, expect, it } from 'vitest';
import { MAPS, MAP_NAMES } from '../games/racing/maps';
import { mapProblems, shapeProblems } from '../games/racing/maps/check';
import { parseMapFile } from '../games/racing/maps/file';
import { ISLAND } from '../games/racing/maps/island';
import { buildRoad, nearestOn, smoothPath } from '../games/racing/sim/roads';
import {
  addAnimals, addBoat, addHill, addPool, addPuddle, addRoad, addRoundabout, addSand, addStream, addTarget, addTraffic,
  addZone, allProblems, controlPoints, deleteItem, deleteRoad, docFromFile, docFromMap, docToFile, editorProblems,
  handles, History, insertPoint, markers, moveItem, moveRoadPoint, ON_ROAD_ZONES, roadShape, setItemValue, setLand,
  setSettings, setSpawn, settingsValue, type Doc, type Item,
} from './mapEdit';

const island = () => docFromMap(ISLAND, 'Island');
/** A place by the island's loop road in the north-west, away from its junctions. */
const NW = [48, 55] as const;
/** How far the furthest of `a`'s points is from the path `b`. */
const stray = (a: [number, number][], b: [number, number][], closed: boolean) => {
  const road = buildRoad({ kind: 'street', width: 9, closed, points: b });
  return Math.max(...a.map(([x, z]) => nearestOn(road, 0, x, z).dist));
};
const roundTrip = (doc: Doc) => {
  const parsed = parseMapFile(docToFile(doc));
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed;
};

describe.each(MAPS.map((m) => [MAP_NAMES[m.id], m] as const))('the %s in the editor', (name, map) => {
  it('opens and saves as the same map, and the file passes the checks a map file gets on load', () => {
    const doc = docFromMap(map, name!);
    const parsed = roundTrip(doc);
    expect(parsed.name).toBe(name);
    expect(parsed.map).toEqual(map);
    expect(mapProblems(parsed.map)).toEqual([]);
    // Opened from its own file, it is the same document again.
    const again = docFromFile(docToFile(doc));
    expect('error' in again ? again.error : again.map).toEqual(map);
  });

  it('has no problems, the editor\'s own included (no road in the sea, no dead end, every junction end on its road)', () => {
    expect(allProblems(docFromMap(map, name!))).toEqual([]);
  });

  it('gives every road control points whose smooth curve follows it closely', () => {
    const doc = docFromMap(map, name!);
    map.roads.forEach((road, i) => {
      const shape = roadShape(doc, i);
      if (shape.kind === 'ring') {
        expect(road.oneWay).toBe(true);
        return;
      }
      expect(shape.points.length).toBeLessThan(road.points.length);
      const curve = smoothPath(shape.points, road.closed, 1.5);
      expect(stray(road.points, curve, road.closed), `road ${i}`).toBeLessThan(1);
    });
  });

  it('still saves a valid file after something of every kind is added and moved', () => {
    let doc = docFromMap(map, name!);
    const r = buildRoad(map.roads[0]!);
    const near = (f: number, offset = 0) => {
      const p = nearestOn(r, 0, r.xs[Math.floor(f * (r.xs.length - 1))]!, r.zs[Math.floor(f * (r.zs.length - 1))]!);
      return [p.x - Math.cos(p.heading) * offset, p.z + Math.sin(p.heading) * offset] as const;
    };
    doc = addTarget(doc, 'toy/star', ...near(0.93));
    doc = addTarget(doc, 'toy/box-stack', ...near(0.97, 8));
    doc = addPuddle(doc, ...near(0.9));
    doc = addTraffic(doc, 'bus', ...near(0.6));
    doc = addAnimals(doc, 'animal/sheep', ...near(0.5, 20));
    doc = addBoat(doc, ...near(0.5, 200));
    const file = roundTrip(doc);
    expect(shapeProblems(file.map)).toEqual([]);
    expect(file.map.targets!.length).toBe((map.targets ?? []).length + 2);
    expect(file.map.traffic.length).toBe(map.traffic.length + 1);
  });
});

describe('editing roads', () => {
  it('a road never touched keeps every point; a moved control point reshapes only its road', () => {
    const doc = island();
    const spur = roadShape(doc, 2) as { points: [number, number][] };
    const moved = moveRoadPoint(doc, 2, 1, ...addTo(spur.points[1]!, 2, 1));
    expect(moved.map.roads[2]!.points).not.toEqual(ISLAND.roads[2]!.points);
    expect(moved.map.roads[0]!.points).toEqual(ISLAND.roads[0]!.points);
    expect(moved.map.roads[1]!.points).toEqual(ISLAND.roads[1]!.points);
    // The document it came from is unchanged (that is what undo keeps).
    expect(doc.map).toEqual(ISLAND);
  });

  it('roads joined to a moved road keep their ends on it', () => {
    const doc = island();
    const shape = roadShape(doc, 0);
    if (shape.kind !== 'path') throw new Error('the loop is a path');
    // The loop's control point nearest the shortcut's north end (where they join), moved 4 m north.
    const end = ISLAND.roads[1]!.points[0]!;
    const k = shape.points.reduce((b, p, n) => (Math.hypot(p[0] - end[0], p[1] - end[1]) < Math.hypot(shape.points[b]![0] - end[0], shape.points[b]![1] - end[1]) ? n : b), 0);
    const moved = moveRoadPoint(doc, 0, k, shape.points[k]![0], shape.points[k]![1] + 4);
    const loop = buildRoad(moved.map.roads[0]!);
    for (const [j, which] of [[1, 0], [2, 0], [4, -1]] as const) {
      const pts = moved.map.roads[j]!.points;
      const [x, z] = pts.at(which)!;
      expect(nearestOn(loop, 0, x, z).dist, `road ${j}`).toBeLessThan(0.1);
    }
    expect(editorProblems(moved.map)).toEqual([]);
  });

  it('a road dragged into the sea is a problem, shown where it is', () => {
    const doc = island();
    const moved = moveRoadPoint(doc, 2, 1, 200, 0);
    const problems = allProblems(moved);
    const sea = problems.find((p) => p.text.includes('roads[2] runs into the sea'));
    expect(sea).toBeTruthy();
    expect(Number.isFinite(sea!.x) && Number.isFinite(sea!.z)).toBe(true);
  });

  it('an open road\'s end dragged off its road is a dead end; dragged onto a road it joins it', () => {
    const doc = island();
    const spur = roadShape(doc, 2) as { points: [number, number][] };
    const first = spur.points[0]!;
    const off = moveRoadPoint(doc, 2, 0, first[0] - 30, first[1]);
    expect(off.map.roads[2]!.from).toBeUndefined();
    expect(editorProblems(off.map).some((p) => p.text.includes('roads[2]\'s start is a dead end'))).toBe(true);
    const back = moveRoadPoint(off, 2, 0, first[0] + 1, first[1]);
    expect(back.map.roads[2]!.from).toBe(0);
    expect(editorProblems(back.map)).toEqual([]);
  });

  it('a new road joins the roads its ends touch; a new roundabout is a one-way ring with its zone', () => {
    let doc = island();
    const loop = buildRoad(ISLAND.roads[0]!);
    const a = [loop.xs[20]!, loop.zs[20]!] as [number, number], b = [loop.xs[60]!, loop.zs[60]!] as [number, number];
    doc = addRoad(doc, [a, [(a[0] + b[0]) / 2 * 0.7, (a[1] + b[1]) / 2 * 0.7], b]);
    const road = doc.map.roads.at(-1)!;
    expect(road).toMatchObject({ from: 0, to: 0, closed: false });
    doc = addRoundabout(doc, 40, -60);
    const ring = doc.map.roads.at(-1)!;
    expect(ring).toMatchObject({ oneWay: true, closed: true });
    expect(doc.map.zones!.at(-1)).toMatchObject({ kind: 'roundabout', on: { x: 40, z: -60 } });
    // Its middle dragged: the zone goes with it.
    const i = doc.map.roads.length - 1;
    const moved = moveRoadPoint(doc, i, 0, 44, -58);
    expect(moved.map.zones!.at(-1)!.on).toEqual({ x: 44, z: -58 });
    expect(handles(moved, { type: 'road', i })).toHaveLength(2);
    expect(() => addRoad(doc, [a])).toThrow();
  });

  it('a deleted road takes what sits on it, and the roads after it move down a number', () => {
    const doc = island();
    const gone = deleteRoad(doc, 2);
    const m = gone.map;
    expect(m.roads).toHaveLength(4);
    // The ring (3) and the shortcut's south end (4) are 2 and 3 now, and still joined to each other.
    expect(m.roads[1]!.to).toBe(2);
    expect(m.roads[3]).toMatchObject({ from: 2, to: 0 });
    expect(m.water.puddles.every((p) => p.road !== 2 || p.at.length === 2)).toBe(true);
    expect((m.targets ?? []).some((t) => t.on.road === 2 && t.on.at === 0.5)).toBe(false);
    expect(mapProblems(m)).toEqual([]);
    expect(() => deleteRoad(doc, ISLAND.spawn.road)).toThrow(/start/);
    // Traffic by a rule keeps to the roads that are left, renumbered.
    const ruled = deleteRoad({ ...doc, map: { ...doc.map, trafficNear: { count: 4, roads: [1, 2, 4], cruise: [6, 9] } } }, 2);
    expect(ruled.map.trafficNear!.roads).toEqual([1, 3]);
  });
});

/** A point moved east and north (the simulation's x grows westward). */
function addTo(p: [number, number], east: number, north: number): [number, number] {
  return [p[0] - east, p[1] + north];
}

describe('editing the land, water and what is placed', () => {
  it('a new shoreline, a stream and sand are smoothed through their points', () => {
    let doc = island();
    doc = setLand(doc, [[-150, -120], [150, -120], [150, 120], [-150, 120]]);
    expect(doc.map.land.outline.length).toBeGreaterThan(100);
    doc = addStream(doc, [[10, 10], [20, 30], [30, 60]], 5);
    expect(doc.map.water.streams!.at(-1)!.points.length).toBeGreaterThan(10);
    doc = addSand(doc, [[0, 0], [10, 0], [10, 10]]);
    expect(doc.map.sand!.at(-1)).toEqual([[0, 0], [10, 0], [10, 10]]);
    // A control point added on the shoreline, then taken off again.
    const before = handles(doc, { type: 'land' }).length;
    const more = insertPoint(doc, { type: 'land' }, 0, -121);
    expect(handles(more, { type: 'land' })).toHaveLength(before + 1);
    expect(handles(deleteItem(more, { type: 'landPoint', k: 1 }), { type: 'land' })).toHaveLength(before);
    expect(shapeProblems(roundTrip(doc).map)).toEqual([]);
  });

  it('places every set piece kind on the nearest road (the roundabout by its middle), and moves and deletes them', () => {
    let doc = island();
    const n = ISLAND.zones!.length;
    for (const kind of [...ON_ROAD_ZONES, 'roundabout' as const]) doc = addZone(doc, kind, ...NW);
    const zones = doc.map.zones!.slice(n);
    expect(zones.map((z) => z.kind)).toEqual([...ON_ROAD_ZONES, 'roundabout']);
    zones.slice(0, -1).forEach((z) => expect(z.on).toMatchObject({ road: 0 }));
    expect(zones.at(-1)!.on).toEqual({ x: NW[0], z: NW[1] });
    const garage: Item = { type: 'zone', i: n + 2 };
    const moved = moveItem(doc, garage, -60, 0);
    expect((moved.map.zones![n + 2]!.on as { at: number }).at).not.toBe((doc.map.zones![n + 2]!.on as { at: number }).at);
    expect(deleteItem(moved, garage).map.zones).toHaveLength(doc.map.zones!.length - 1);
  });

  it('places targets, water, traffic, animals, boats, hills and the start, each moved and deleted', () => {
    let doc = island();
    doc = addTarget(doc, 'toy/star', ...NW);
    doc = addTarget(doc, 'toy/box-stack', ...NW);
    const [star, stack] = doc.map.targets!.slice(-2);
    expect(star).toMatchObject({ id: 'toy/star', count: 4, on: { road: 0 } });
    expect(star!.on.offset).toBeUndefined();
    // A stack goes beside the road, past its edge.
    expect(Math.abs(stack!.on.offset!)).toBeGreaterThanOrEqual(ISLAND.roads[0]!.width / 2 + 1.5);
    doc = addPool(doc, 'deep', ...NW);
    doc = addPool(doc, 'mud', ...NW);
    expect(doc.map.water.pools.slice(-2)).toMatchObject([{ deep: true }, { deep: false, mud: true }]);
    const puddles = doc.map.water.puddles[0]!.at.length;
    doc = addPuddle(doc, ...NW);
    expect(doc.map.water.puddles[0]!.at).toHaveLength(puddles + 1);
    doc = addTraffic(doc, 'tractor', ...NW);
    expect(Math.abs(doc.map.traffic.at(-1)!.on.offset!)).toBe(2.2);
    doc = addAnimals(doc, 'animal/duck', 10, 10);
    doc = addBoat(doc, 0, 140);
    doc = addHill(doc, 30, 30);
    doc = setSpawn(doc, ...NW);
    expect(doc.map.spawn).toMatchObject({ road: 0 });

    const list = markers(doc.map);
    for (const type of ['target', 'pool', 'puddle', 'traffic', 'animal', 'boat', 'hill', 'spawn', 'zone', 'guard'] as const) {
      expect(list.some((m) => m.item.type === type), type).toBe(true);
    }
    // Each kind moved to a new place, then deleted (the start can only move).
    for (const m of list.filter((x) => x.item.type !== 'guard')) {
      const moved = moveItem(doc, m.item, m.x + 3, m.z + 3);
      expect(moved).not.toBe(doc);
      if (m.item.type === 'spawn') expect(() => deleteItem(doc, m.item)).toThrow();
      else expect(deleteItem(doc, m.item)).not.toEqual(doc);
    }
  });

  it('changes a selected thing\'s fields and the map\'s settings', () => {
    let doc = island();
    doc = setItemValue(doc, { type: 'zone', i: 0 }, { ...ISLAND.zones![0], r: 5 });
    expect(doc.map.zones![0]!.r).toBe(5);
    doc = setItemValue(doc, { type: 'road', i: 2 }, { kind: 'dirt', width: 10, closed: false, from: 0, to: 3, points: 'ignored' });
    expect(doc.map.roads[2]).toMatchObject({ kind: 'dirt', width: 10 });
    expect(doc.map.roads[2]!.points).toEqual(ISLAND.roads[2]!.points);
    doc = setSettings(doc, { ...settingsValue(doc), id: 'my-island', propCount: 100 });
    expect(doc.map).toMatchObject({ id: 'my-island', propCount: 100 });
    expect(() => setItemValue(doc, { type: 'zone', i: 0 }, 3)).toThrow();
    expect(roundTrip(doc).map.id).toBe('my-island');
  });

  it('turns a long list of points into a few control points', () => {
    const pts = Array.from({ length: 200 }, (_, i): [number, number] => [i * 0.5, 0]);
    expect(controlPoints(pts, false)).toEqual([[0, 0], [25, 0], [50, 0], [74.5, 0], [99.5, 0]]);
  });
});

describe('undo', () => {
  it('undoes and redoes committed changes; a drag shows its steps and keeps only where it ended', () => {
    const start = island();
    const h = new History(start);
    expect(h.canUndo).toBe(false);
    const a = addHill(start, 0, 0);
    h.commit(a);
    // A drag: three previews, one step.
    h.preview(moveItem(a, { type: 'hill', i: 1 }, 1, 1));
    h.preview(moveItem(a, { type: 'hill', i: 1 }, 2, 2));
    const b = moveItem(a, { type: 'hill', i: 1 }, 3, 3);
    h.preview(b);
    h.commit();
    expect(h.present.map.hills![1]).toMatchObject({ x: 3, z: 3 });
    h.undo();
    expect(h.present).toBe(a);
    h.undo();
    expect(h.present).toBe(start);
    expect(h.canUndo).toBe(false);
    h.redo();
    h.redo();
    expect(h.present).toBe(b);
    // A drag let go of where it started is no step; a cancelled one goes back.
    h.preview(moveItem(b, { type: 'hill', i: 1 }, 9, 9));
    h.cancel();
    expect(h.present).toBe(b);
    h.undo();
    // A new change after an undo drops what could be redone.
    h.commit(addBoat(h.present, 0, 0));
    expect(h.canRedo).toBe(false);
  });
});
