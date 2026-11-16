// Every asset has both halves (driving-assets.md): a definition the simulation reads and a look that draws it.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ANIMAL_LOOKS } from './look/animals';
import { DECOR_LOOKS, SCENERY_LOOKS } from './look/scenery';
import { TOY_LOOKS } from './look/toys';
import { buildVehicle } from './look/vehicles';
import { MAPS } from './maps';
import { CATEGORIES, VEHICLE_IDS } from './sim/assets';
import { ANIMAL_IDS } from './sim/assets/animals';
import { DECOR_IDS, SCENERY, SCENERY_IDS } from './sim/assets/scenery';
import { TARGET_IDS, TOYS, TOY_IDS } from './sim/assets/toys';
import { CONFETTI_BURST, CONFETTI_POOL } from './sim/sim';
import type { VehicleKind } from './sim/sim';

const triangles = (root: THREE.Object3D) => {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const g = o.geometry as THREE.BufferGeometry;
      n += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    }
  });
  return n;
};

describe('the asset registry', () => {
  it('lists every category of driving-assets.md once, and every id once', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual(['vehicles', 'toys', 'scenery', 'decor', 'roads', 'ground', 'setpieces', 'animals', 'effects', 'sky']);
    const ids = CATEGORIES.flatMap((c) => c.assets);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every toy, tree, bush and animal has a look, and every look has a definition', () => {
    expect(Object.keys(ANIMAL_LOOKS).sort()).toEqual([...ANIMAL_IDS].sort());
    for (const id of ANIMAL_IDS) expect(triangles(ANIMAL_LOOKS[id]()), id).toBeLessThanOrEqual(3000);
    expect(Object.keys(TOY_LOOKS).sort()).toEqual([...TOY_IDS].sort());
    expect(Object.keys(SCENERY_LOOKS).sort()).toEqual([...SCENERY_IDS].sort());
    expect(Object.keys(DECOR_LOOKS).sort()).toEqual([...DECOR_IDS].sort());
  });

  it('every look builds, within its category budget (driving-assets.md)', () => {
    for (const id of TOY_IDS) expect(triangles(TOY_LOOKS[id]()), id).toBeLessThanOrEqual(1500);
    for (const id of SCENERY_IDS) expect(triangles(SCENERY_LOOKS[id]()), id).toBeLessThanOrEqual(1000);
    for (const id of VEHICLE_IDS) {
      expect(triangles(buildVehicle(id.slice('vehicle/'.length) as VehicleKind, 0xff0000).group), id).toBeLessThanOrEqual(30000);
    }
  });

  it('definitions are sensible: toys have a size and behaviour, scenery a collision radius', () => {
    for (const id of TOY_IDS) {
      expect(TOYS[id].half).toBeGreaterThan(0);
      expect(['tumble', 'roll', 'topple', 'collect']).toContain(TOYS[id].behaviour);
    }
    // Targets (ADR 0041): a stack and a star, each with its celebration; the other toys have none.
    expect([...TARGET_IDS].sort()).toEqual(['toy/box-stack', 'toy/star']);
    for (const id of TOY_IDS) expect('target' in TOYS[id], id).toBe(['topple', 'collect'].includes(TOYS[id].behaviour));
    for (const id of SCENERY_IDS) expect(SCENERY[id].radius).toBeGreaterThan(0);
  });

  it('every map uses only registered toys, targets, scenery and decor, and scatters no targets', () => {
    for (const map of MAPS) {
      for (const k of map.props.kinds) expect(TOY_IDS, map.id).toContain(k.id);
      for (const k of map.props.kinds) expect(TARGET_IDS, map.id).not.toContain(k.id);
      for (const t of map.targets ?? []) expect(TARGET_IDS, map.id).toContain(t.id);
      for (const k of map.trees.kinds) expect(SCENERY_IDS, map.id).toContain(k.id);
      for (const d of map.decor) expect(DECOR_IDS, map.id).toContain(d.id);
    }
  });

  it('confetti stays within the effects budget (ADR 0041): one small pool, three bursts at once', () => {
    expect(CONFETTI_POOL).toBeLessThanOrEqual(120);
    expect(CONFETTI_POOL / CONFETTI_BURST).toBeGreaterThanOrEqual(3);
  });
});
