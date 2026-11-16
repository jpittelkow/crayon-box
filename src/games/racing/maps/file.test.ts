// The map file format (ADR 0043): a built-in map written to a file and read back is the same map, a file for a
// newer app or with a broken map is turned away with a reason, and fields this version doesn't know pass through.
import { describe, expect, it } from 'vitest';
import { makeWorld, step } from '../sim/sim';
import type { MapDef } from '../sim/map';
import { MAPS } from '.';
import { RING } from './ring';
import { mapProblems, placeProblems, shapeProblems } from './check';
import { MAP_FORMAT, MAP_FORMAT_VERSION, mapToFile, parseMapFile } from './file';
import example from './examples/test-loop.json?raw';

const load = (text: string): MapDef => {
  const parsed = parseMapFile(text);
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.map;
};
/** The reason a file is turned away. */
const reason = (text: string): string => {
  const parsed = parseMapFile(text);
  if (parsed.ok) throw new Error('it loaded');
  return parsed.reason;
};
/** A copy of the ring with something changed, as a file. */
const fileWith = (change: (m: Record<string, unknown>) => void, name = 'Test') => {
  const m = structuredClone(RING) as unknown as Record<string, unknown>;
  change(m);
  return mapToFile(m as unknown as MapDef, name);
};

describe('a map file (ADR 0043)', () => {
  it.each(MAPS.map((m) => [m.id, m] as const))('the %s, written and read back, is the same map and drives the same', (_id, map) => {
    const text = mapToFile(map, 'A map');
    const back = load(text);
    // Exactly the same, -0 and all: it covers every field the built-in maps use (targets, mud, streams, lights).
    expect(back).toStrictEqual(map);
    // And a world built from it is the same world, a second of driving later.
    const w1 = makeWorld(7, 150, 'free', map), w2 = makeWorld(7, 150, 'free', back);
    for (let i = 0; i < 60; i++) {
      step(w1, { go: true, brake: false, steer: 0.3 }, 1 / 60);
      step(w2, { go: true, brake: false, steer: 0.3 }, 1 / 60);
    }
    expect(w2.cars.map((c) => [c.x, c.z, c.speed])).toEqual(w1.cars.map((c) => [c.x, c.z, c.speed]));
    expect(w2.props.map((p) => [p.toy, p.homeX, p.homeZ])).toEqual(w1.props.map((p) => [p.toy, p.homeX, p.homeZ]));
    // Writing it again gives the same text.
    expect(mapToFile(back, 'A map')).toBe(text);
  });

  it('keeps the island\'s ADR 0041 and 0042 pieces: targets, the stream, the ford and the lights', () => {
    const island = load(mapToFile(MAPS.find((m) => m.id === 'island')!, 'Island'));
    expect(island.targets!.length).toBeGreaterThan(5);
    expect(island.water.streams!.length).toBe(1);
    expect(island.zones!.map((z) => z.kind)).toEqual(expect.arrayContaining(['ford', 'lights', 'garage']));
    const site = load(mapToFile(MAPS.find((m) => m.id === 'site')!, 'Site'));
    expect(site.zones!.filter((z) => z.kind === 'mud').length).toBe(2);
  });

  it('writes -0 so it comes back as -0, and refuses numbers JSON can\'t hold', () => {
    const map = structuredClone(RING);
    map.land.outline[0] = [-0, 60];
    expect(Object.is(load(mapToFile(map, 'Zero')).land.outline[0]![0], -0)).toBe(true);
    map.land.outline[0] = [Number.NaN, 60];
    expect(() => mapToFile(map, 'NaN')).toThrow(/NaN/);
  });

  it('keeps points on a few lines, so a person can read it', () => {
    const text = mapToFile(RING, 'Ring');
    expect(text.split('\n').length).toBeLessThan(JSON.stringify(RING, null, 2).split('\n').length / 5);
    expect(text).toMatch(/^\{\n {2}"format": "crayon-box-map",\n {2}"version": 1,\n {2}"name": "Ring",/);
  });

  it('the example file loads and keeps every rule', () => {
    const map = load(example);
    expect(map.id).toBe('test-loop');
    expect(mapProblems(map)).toEqual([]);
    // It is written as `mapToFile` writes, so it can be made again the same way.
    expect(mapToFile(map, 'Test loop')).toBe(example.replace(/\r\n/g, '\n'));
  });

  it('checks the format and its version', () => {
    expect(reason('not json')).toMatch(/isn't valid JSON/);
    expect(reason('[1, 2]')).toMatch(/needs "format": "crayon-box-map"/);
    expect(reason(JSON.stringify({ format: 'something-else', version: 1, name: 'x', map: RING }))).toMatch(/isn't a map file/);
    expect(reason(JSON.stringify({ format: MAP_FORMAT, name: 'x', map: RING }))).toMatch(/no format version/);
    expect(reason(JSON.stringify({ format: MAP_FORMAT, version: 1.5, name: 'x', map: RING }))).toMatch(/no format version/);
    expect(reason(JSON.stringify({ format: MAP_FORMAT, version: MAP_FORMAT_VERSION + 1, name: 'x', map: RING }))).toMatch(
      /made for a newer version of the app \(map format 2; this one reads format 1\)\. Update the app\./,
    );
    expect(reason(JSON.stringify({ format: MAP_FORMAT, version: 1, name: '  ', map: RING }))).toMatch(/needs a "name"/);
    expect(reason(JSON.stringify({ format: MAP_FORMAT, version: 1, name: 'x'.repeat(61), map: RING }))).toMatch(/needs a "name"/);
    expect(reason(' '.repeat(10 * 1024 * 1024 + 1))).toMatch(/too big/);
  });

  it('carries fields it doesn\'t know forward, at the top and inside', () => {
    const map = load(fileWith((m) => {
      m.roundabouts = [{ x: 0, z: 0, r: 7 }];
      (m.roads as Record<string, unknown>[])[0]!.oneWay = true;
    }));
    expect((map as unknown as Record<string, unknown>).roundabouts).toEqual([{ x: 0, z: 0, r: 7 }]);
    expect((map.roads[0] as unknown as Record<string, unknown>).oneWay).toBe(true);
  });
});

describe('the shape rules, with their reasons', () => {
  const cases: [string, (m: Record<string, unknown>) => void, RegExp][] = [
    ['an id with capitals', (m) => (m.id = 'My Map'), /map\.id: needs to be lower case letters/],
    ['an id with a colon', (m) => (m.id = 'folder:x'), /map\.id/],
    ['no roads', (m) => (m.roads = []), /map\.roads: needs at least 1/],
    ['a road joining one that isn\'t there', (m) => ((m.roads as Record<string, unknown>[])[0]!.from = 3), /map\.roads\[0\]\.from: there is no road 3/],
    ['a point that isn\'t one', (m) => ((m.land as { outline: unknown[] }).outline[4] = [1]), /map\.land\.outline\[4\]: needs to be a point \[x, z\]/],
    ['a point far away', (m) => ((m.land as { outline: unknown[] }).outline[4] = [1, 99999]), /map\.land\.outline\[4\]\[1\]: needs to be from -5000 to 5000/],
    ['the start on a road that isn\'t there', (m) => (m.spawn = { road: 2, at: 0 }), /map\.spawn\.road: there is no road 2/],
    ['the start past the end of the road', (m) => (m.spawn = { road: 0, at: 1.5 }), /map\.spawn\.at: needs to be from 0 to 1/],
    ['a zone kind the game hasn\'t got', (m) => (m.zones = [{ kind: 'volcano', on: { x: 0, z: 0 }, r: 3 }]), /map\.zones\[0\]\.kind: needs to be one of "ramp"/],
    ['a vehicle the game hasn\'t got', (m) => ((m.traffic as Record<string, unknown>[])[0]!.kind = 'spaceship'), /map\.traffic\[0\]\.kind/],
    ['a tree the game hasn\'t got', (m) => ((m.trees as { kinds: Record<string, unknown>[] }).kinds[0]!.id = 'scenery/palm'), /map\.trees\.kinds\[0\]\.id/],
    ['a target as a scattered toy', (m) => ((m.props as { kinds: Record<string, unknown>[] }).kinds[0]!.id = 'toy/star'), /map\.props\.kinds\[0\]\.id/],
    ['too many trees', (m) => ((m.trees as Record<string, unknown>).count = 1e6), /map\.trees\.count: needs to be from 0 to 5000/],
    ['a count that isn\'t whole', (m) => ((m.trees as Record<string, unknown>).count = 4.5), /map\.trees\.count: needs to be a whole number/],
    ['no water', (m) => delete m.water, /map\.water: needs to be an object/],
    ['a hill of text', (m) => (m.hills = [{ x: 0, z: 0, rx: 'big', rz: 3, height: 2 }]), /map\.hills\[0\]\.rx: needs to be a number/],
  ];
  it.each(cases)('%s', (_what, change, why) => {
    expect(reason(fileWith(change))).toMatch(why);
  });

  it('lists at most five problems', () => {
    const many = shapeProblems({ id: 'X', roads: 'no' });
    expect(many.length).toBe(5);
  });
});

describe('the placing rules, with their reasons', () => {
  const ring = (change: (m: MapDef) => void) => {
    const m = structuredClone(RING);
    m.zones = [...(m.zones ?? []), { kind: 'garage', on: { road: 0, at: 0.62 }, r: 4 }];
    change(m);
    return placeProblems(m);
  };
  it('the ring with a garage is fine', () => expect(ring(() => {})).toEqual([]));
  it('needs a garage', () => {
    expect(placeProblems(RING)).toEqual([expect.stringMatching(/no garage/)]);
  });
  it('keeps zones apart', () => {
    expect(ring((m) => m.zones!.push({ kind: 'ramp', on: { road: 0, at: 0.63 }, r: 3.5 })).join(' ')).toMatch(/\(garage\) and zones\[3\] \(ramp\) are too close/);
  });
  it('keeps the start out of the sea', () => {
    // 25 m one side of the ring road is the sea; the other side is the middle of the island.
    const sides = [25, -25].map((offset) => ring((m) => (m.spawn = { road: 0, at: 0, offset })).join(' '));
    expect(sides.filter((s) => /The start \(spawn\) is in the sea/.test(s)).length).toBe(1);
  });
  it('keeps stars on the road and stacks off it, clear of zones', () => {
    expect(ring((m) => (m.targets = [{ id: 'toy/star', on: { road: 0, at: 0.25, offset: 6 } }])).join(' ')).toMatch(/off the road: stars go on it/);
    expect(ring((m) => (m.targets = [{ id: 'toy/box-stack', on: { road: 0, at: 0.25 } }])).join(' ')).toMatch(/on the road: stacks go just off it/);
    expect(ring((m) => (m.targets = [{ id: 'toy/star', on: { road: 0, at: 0.39 } }])).join(' ')).toMatch(/is in a zone/);
    expect(ring((m) => (m.targets = [{ id: 'toy/star', on: { road: 0, at: 0.01 } }])).join(' ')).toMatch(/within 10 m of the start/);
  });
});
