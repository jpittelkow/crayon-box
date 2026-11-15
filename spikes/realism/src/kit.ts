// Shared building blocks for the realism samples: materials and shapes at each level of detail.
//   1 = toy, simple   2 = toy, polished   3 = near-photo
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type Level = 1 | 2 | 3;

export class Kit {
  constructor(readonly level: Level) {}

  /** Rounded-box corner smoothness and round-shape segment counts grow with the level. */
  get segs(): number {
    return [0, 2, 4, 6][this.level]!;
  }
  get round(): number {
    return [0, 16, 28, 40][this.level]!;
  }

  rbox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
    return new RoundedBoxGeometry(w, h, d, this.segs, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
  }

  /** Glossy toy paint: matte at level 1, clear-coated from level 2. */
  paint(color: THREE.ColorRepresentation): THREE.Material {
    if (this.level === 1) return new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
    return new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.07 });
  }
  plastic(color: THREE.ColorRepresentation, roughness = 0.6): THREE.Material {
    return new THREE.MeshStandardMaterial({ color, roughness });
  }
  glass(): THREE.Material {
    if (this.level === 1) return new THREE.MeshStandardMaterial({ color: 0x35506e, roughness: 0.25 });
    return new THREE.MeshPhysicalMaterial({ color: 0x1b2a3c, roughness: 0.04, metalness: 0.2, clearcoat: 1 });
  }
  chrome(): THREE.Material {
    return new THREE.MeshStandardMaterial({ color: this.level === 1 ? 0xb8bcc2 : 0xe8eaee, metalness: this.level === 1 ? 0.3 : 1, roughness: 0.18 });
  }
  rubber(): THREE.Material {
    return new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.92 });
  }
  /** A lamp: glows, and at level 3 blooms. */
  lamp(color: THREE.ColorRepresentation, strength = 1.6): THREE.Material {
    return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: strength, roughness: 0.3 });
  }

  mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  /**
   * A wheel with its axle along x: a tyre with rounded shoulders, a rim and a hub. From level 2 the rim has
   * spokes and the tyre a tread band.
   */
  wheel(radius: number, width: number): THREE.Group {
    const g = new THREE.Group();
    const rim = radius * 0.6;
    const c = Math.min(width * 0.3, radius * 0.25);
    const pts: THREE.Vector2[] = [new THREE.Vector2(rim, -width / 2)];
    const steps = this.level === 1 ? 3 : 6;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * (Math.PI / 2);
      pts.push(new THREE.Vector2(radius - c + Math.sin(a) * c, -width / 2 + c - Math.cos(a) * c));
    }
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * (Math.PI / 2);
      pts.push(new THREE.Vector2(radius - c + Math.cos(a) * c, width / 2 - c + Math.sin(a) * c));
    }
    pts.push(new THREE.Vector2(rim, width / 2));
    const tyre = new THREE.LatheGeometry(pts, this.round + 8);
    tyre.rotateZ(Math.PI / 2);
    g.add(this.mesh(tyre, this.rubber()));

    const rimGeo = new THREE.CylinderGeometry(rim, rim, width * 0.82, this.round);
    rimGeo.rotateZ(Math.PI / 2);
    g.add(this.mesh(rimGeo, this.level === 1 ? this.plastic(0xd9dce1, 0.4) : this.chrome()));
    const hubGeo = new THREE.CylinderGeometry(rim * 0.32, rim * 0.38, width * 0.9, this.round);
    hubGeo.rotateZ(Math.PI / 2);
    g.add(this.mesh(hubGeo, this.plastic(0x30343a, 0.4)));

    if (this.level >= 2) {
      // Five spokes on each face, a dark well behind them.
      const well = new THREE.CylinderGeometry(rim * 0.92, rim * 0.92, width * 0.84, this.round);
      well.rotateZ(Math.PI / 2);
      g.add(this.mesh(well, this.plastic(0x2a2d31, 0.7)));
      for (const side of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          const spoke = this.mesh(new THREE.BoxGeometry(width * 0.08, rim * 0.95, rim * 0.22), this.chrome());
          spoke.position.x = side * width * 0.43;
          spoke.rotation.x = (i / 5) * Math.PI * 2;
          spoke.geometry.translate(0, rim * 0.45, 0);
          g.add(spoke);
        }
      }
      // Tread: raised blocks around the tyre.
      const blocks = this.level === 3 ? 28 : 18;
      for (let i = 0; i < blocks; i++) {
        const b = this.mesh(new THREE.BoxGeometry(width * 0.7, radius * 0.06, radius * 0.16), this.rubber());
        b.geometry.translate(0, radius - radius * 0.005, 0);
        b.rotation.x = (i / blocks) * Math.PI * 2;
        g.add(b);
      }
    }
    return g;
  }
}
