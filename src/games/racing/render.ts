// Draws the scene with three.js (ADR 0021). Every batch is one instanced draw; the scene data says where each
// copy goes, so this file only hands buffers to three.js. Loaded only when the game opens.
import {
  BufferAttribute, BufferGeometry, Color, ColorManagement, DirectionalLight, DynamicDrawUsage, HemisphereLight,
  InstancedBufferAttribute, InstancedMesh, LinearSRGBColorSpace, MeshBasicMaterial, MeshLambertMaterial,
  PerspectiveCamera, Scene, WebGLRenderer, type Material,
} from 'three';
import type { Batch, SceneData } from './sim/scene';

// Colors are used as written in the palette, with no color-space conversion (as tested in spikes/engine-bakeoff).
ColorManagement.enabled = false;

/** The most real pixels drawn per CSS pixel. Built-in laptop graphics (ADR 0021) get no more than this. */
export const MAX_PIXEL_RATIO = 1.5;

export interface Renderer {
  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void;
  render(): void;
  dispose(): void;
}

export function createRenderer(canvas: HTMLCanvasElement, data: SceneData): Renderer {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(new Color(...data.sky), 1);

  const scene = new Scene();
  // three.js divides diffuse light by pi; multiplying it back gives a plain "color times light".
  scene.add(new HemisphereLight(new Color(...data.hemiSky), new Color(...data.hemiGround), Math.PI));
  const sun = new DirectionalLight(new Color(1, 1, 1), Math.PI * data.sun);
  sun.position.set(-data.sunDir[0] * 100, -data.sunDir[1] * 100, -data.sunDir[2] * 100);
  scene.add(sun);

  const camera = new PerspectiveCamera(data.camera.fovDeg, 1, data.camera.near, data.camera.far);
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const moving: { batch: Batch; mesh: InstancedMesh }[] = [];

  for (const b of data.batches) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(b.mesh.positions, 3));
    geometry.setAttribute('normal', new BufferAttribute(b.mesh.normals, 3));
    geometry.setIndex(new BufferAttribute(b.mesh.indices, 1));
    const color = new Color(...b.color);
    const material = b.lit
      ? new MeshLambertMaterial({ color })
      : new MeshBasicMaterial({ color, transparent: b.opacity < 1, opacity: b.opacity, depthWrite: b.opacity >= 1 });
    const mesh = new InstancedMesh(geometry, material, b.count);
    mesh.instanceMatrix = new InstancedBufferAttribute(b.matrices, 16);
    if (b.dynamic) {
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      moving.push({ batch: b, mesh });
    }
    mesh.frustumCulled = false; // copies move anywhere on the island
    scene.add(mesh);
    geometries.push(geometry);
    materials.push(material);
  }

  return {
    resize(cssWidth, cssHeight, pixelRatio) {
      renderer.setPixelRatio(Math.min(pixelRatio, MAX_PIXEL_RATIO));
      renderer.setSize(cssWidth, cssHeight, false);
      camera.aspect = cssWidth / Math.max(1, cssHeight);
      camera.updateProjectionMatrix();
    },
    render() {
      for (const { mesh } of moving) mesh.instanceMatrix.needsUpdate = true;
      camera.position.set(...data.camera.eye);
      camera.lookAt(...data.camera.target);
      renderer.render(scene, camera);
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      renderer.dispose();
    },
  };
}
