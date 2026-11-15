// The scene drawn with three.js.
import {
  BufferAttribute, BufferGeometry, Color, ColorManagement, DataTexture, DirectionalLight, DynamicDrawUsage,
  HemisphereLight, InstancedBufferAttribute, InstancedMesh, LinearFilter, LinearMipmapLinearFilter,
  LinearSRGBColorSpace, Mesh, MeshBasicMaterial, MeshLambertMaterial, PerspectiveCamera, RepeatWrapping, REVISION,
  RGBAFormat, Scene, Vector3, WebGLRenderer, type Material,
} from 'three';
import type { CreateRenderer } from './renderer';
import type { Batch } from './scene';

// Colors are used as written, with no color-space conversion, which is what Babylon's standard material does.
ColorManagement.enabled = false;

export const createRenderer: CreateRenderer = async (canvas, data, opts) => {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setClearColor(new Color(...data.sky), 1);

  const scene = new Scene();
  // three.js divides diffuse light by pi; multiplying it back gives the plain "color x light" both libraries share.
  const hemi = new HemisphereLight(new Color(...data.hemiSky), new Color(...data.hemiGround), Math.PI);
  const sun = new DirectionalLight(new Color(1, 1, 1), Math.PI * data.sun);
  sun.position.set(-data.sunDir[0] * 100, -data.sunDir[1] * 100, -data.sunDir[2] * 100);
  scene.add(hemi, sun);

  const camera = new PerspectiveCamera(data.camera.fovDeg, 1, data.camera.near, data.camera.far);

  const instancedBatches: { batch: Batch; mesh: InstancedMesh }[] = [];
  const separateBatches: { batch: Batch; meshes: Mesh[] }[] = [];

  for (const b of data.batches) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(b.mesh.positions, 3));
    geometry.setAttribute('normal', new BufferAttribute(b.mesh.normals, 3));
    geometry.setIndex(new BufferAttribute(b.mesh.indices, 1));
    const color = new Color(...b.color);
    const material: Material = b.lit
      ? new MeshLambertMaterial({ color })
      : new MeshBasicMaterial({ color, transparent: b.opacity < 1, opacity: b.opacity, depthWrite: b.opacity >= 1 });

    if (b.separable && !opts.instanced) {
      const meshes: Mesh[] = [];
      for (let i = 0; i < b.capacity; i++) {
        const mesh = new Mesh(geometry, material);
        meshes.push(mesh);
        scene.add(mesh);
      }
      separateBatches.push({ batch: b, meshes });
    } else {
      const mesh = new InstancedMesh(geometry, material, b.capacity);
      mesh.instanceMatrix = new InstancedBufferAttribute(b.matrices, 16);
      if (b.dynamic) mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.count = b.count;
      mesh.frustumCulled = false; // the copies move; neither library culls them
      scene.add(mesh);
      instancedBatches.push({ batch: b, mesh });
    }
  }

  // three.js's own water: a mirror-like surface from its add-ons. It draws the whole scene a second time,
  // upside down, to get the reflection.
  let waterTime: { value: number } | null = null;
  if (data.water.own) {
    const { Water } = await import('three/addons/objects/Water.js');
    // Water expects a sheet standing in the x-y plane and laid flat by turning it, so the shared sheet is stood up.
    const src = data.water.mesh.positions, stood = new Float32Array(src.length);
    for (let i = 0; i < src.length; i += 3) { stood[i] = src[i]!; stood[i + 1] = -src[i + 2]!; }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(stood, 3));
    geometry.setIndex(new BufferAttribute(data.water.mesh.indices, 1));
    const map = new DataTexture(data.water.ripples.data, data.water.ripples.size, data.water.ripples.size, RGBAFormat);
    map.wrapS = map.wrapT = RepeatWrapping;
    map.minFilter = LinearMipmapLinearFilter;
    map.magFilter = LinearFilter;
    map.generateMipmaps = true;
    map.needsUpdate = true;
    const water = new Water(geometry, {
      textureWidth: 512, textureHeight: 512, waterNormals: map,
      sunDirection: new Vector3(-data.sunDir[0], -data.sunDir[1], -data.sunDir[2]).normalize(),
      sunColor: 0xffffff, waterColor: new Color(...data.water.color), distortionScale: 1.2,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.y = data.water.y;
    water.material.uniforms['size']!.value = 0.25; // one repeat of the ripple map every 4 m
    waterTime = water.material.uniforms['time']!;
    scene.add(water);
  }

  return {
    label: `three.js r${REVISION}`,
    resize(width, height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    render() {
      for (const { batch, mesh } of instancedBatches) {
        if (!batch.dynamic) continue;
        mesh.count = batch.count;
        mesh.instanceMatrix.needsUpdate = true;
      }
      for (const { batch, meshes } of separateBatches) {
        const t = batch.trs;
        for (let i = 0; i < meshes.length; i++) {
          const m = meshes[i]!, o = i * 8;
          m.visible = i < batch.count;
          m.position.set(t[o]!, t[o + 1]!, t[o + 2]!);
          m.quaternion.set(t[o + 3]!, t[o + 4]!, t[o + 5]!, t[o + 6]!);
          m.scale.setScalar(t[o + 7]!);
        }
      }
      if (waterTime) waterTime.value = data.water.time;
      camera.position.set(...data.camera.eye);
      camera.lookAt(...data.camera.target);
      renderer.render(scene, camera);
    },
    drawCalls: () => renderer.info.render.calls,
  };
};
