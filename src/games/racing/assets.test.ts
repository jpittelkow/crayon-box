// Every asset has both halves (driving-assets.md): a definition the simulation reads and a look that draws it.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DECOR_LOOKS, SCENERY_LOOKS } from './look/scenery';
import { TOY_LOOKS } from './look/toys';
import { buildVehicle } from './look/vehicles';
import { ISLAND } from './maps/island';
import { CATEGORIES, VEHICLE_IDS } from './sim/assets';
import { DECOR_IDS, SCENERY, SCENERY_IDS } from './sim/assets/scenery';
import { TOYS, TOY_IDS } from './sim/assets/toys';
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

  it('every toy, tree and bush has a look, and every look has a definition', () => {
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
      expect(['tumble', 'roll']).toContain(TOYS[id].behaviour);
    }
    for (const id of SCENERY_IDS) expect(SCENERY[id].radius).toBeGreaterThan(0);
  });

  it('the island uses only registered toys, scenery and decor', () => {
    for (const k of ISLAND.props.kinds) expect(TOY_IDS).toContain(k.id);
    for (const k of ISLAND.trees.kinds) expect(SCENERY_IDS).toContain(k.id);
    for (const d of ISLAND.decor) expect(DECOR_IDS).toContain(d.id);
  });
});
