// Pictures of the vehicles for the picker's tiles (milestone-3 B5): each one drawn in the toy look, in the kid's
// colour or with their flag, on a little patch of grass. Drawn once when the picker opens, with a renderer that is
// thrown away straight after, so the game's own renderer is the only one left running.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { VehicleKind } from '../sim/sim';
import { buildKidVehicle } from './vehicles';

/** One picture per vehicle, as image URLs, `width` by `height` pixels. */
export function vehicleTiles(kinds: readonly VehicleKind[], kidColor: THREE.ColorRepresentation, width = 480, height = 360): string[] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  try {
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    return kinds.map((kind) => {
      const scene = new THREE.Scene();
      scene.environment = env;
      scene.environmentIntensity = 0.45;
      scene.add(new THREE.HemisphereLight(0xe4f2ff, 0x7a6a4c, 0.9));
      const sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
      sun.position.set(8, 20, 10);
      sun.castShadow = true;
      sun.shadow.mapSize.setScalar(1024);
      Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 60 });
      scene.add(sun);

      const vehicle = buildKidVehicle(kind, kidColor).group;
      vehicle.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
      });
      // Turned to show its side and front, as a toy on a shelf.
      vehicle.rotation.y = -0.65;
      scene.add(vehicle);
      const box = new THREE.Box3().setFromObject(vehicle);
      const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
      const grass = new THREE.Mesh(new THREE.CircleGeometry(Math.max(size.x, size.z) * 0.62, 48).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x6fb84a, roughness: 0.95 }));
      grass.position.set(mid.x, 0, mid.z);
      grass.receiveShadow = true;
      scene.add(grass);

      // Framed to fit the vehicle, whatever its size.
      const half = Math.max(size.x, size.z, size.y * 1.4) * 0.62;
      const camera = new THREE.OrthographicCamera(-half, half, half * (height / width), -half * (height / width), 0.1, 100);
      camera.position.set(mid.x + 10, mid.y + 7, mid.z + 12);
      camera.lookAt(mid.x, mid.y * 0.8, mid.z);
      renderer.render(scene, camera);
      const url = canvas.toDataURL('image/png');
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
        }
      });
      return url;
    });
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
