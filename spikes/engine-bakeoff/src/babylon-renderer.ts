// The scene drawn with Babylon.js.
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Engine } from '@babylonjs/core/Engines/engine';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Material } from '@babylonjs/core/Materials/material';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { Scene } from '@babylonjs/core/scene';
import type { CreateRenderer } from './renderer';
import type { Batch } from './scene';

export const createRenderer: CreateRenderer = async (canvas, data, opts) => {
  const engine = new Engine(canvas, true, { powerPreference: 'high-performance', stencil: false }, false);
  const scene = new Scene(engine);
  // Same handedness as three.js, so the shared positions, rotations and matrices mean the same thing.
  scene.useRightHandedSystem = true;
  scene.clearColor = new Color4(...data.sky, 1);
  // The test page handles touches and keys itself; Babylon's own pointer picking would be wasted work.
  scene.detachControl();

  const black = new Color3(0, 0, 0);
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.diffuse = new Color3(...data.hemiSky);
  hemi.groundColor = new Color3(...data.hemiGround);
  hemi.specular = black;
  const sun = new DirectionalLight('sun', new Vector3(...data.sunDir).normalize(), scene);
  sun.diffuse = new Color3(1, 1, 1);
  sun.intensity = data.sun;
  sun.specular = black;

  const camera = new TargetCamera('camera', new Vector3(0, 5, -10), scene);
  camera.fov = (data.camera.fovDeg * Math.PI) / 180;
  camera.minZ = data.camera.near;
  camera.maxZ = data.camera.far;

  const instancedBatches: { batch: Batch; mesh: Mesh }[] = [];
  const separateBatches: { batch: Batch; meshes: Mesh[] }[] = [];

  for (const b of data.batches) {
    const mesh = new Mesh(b.name, scene);
    const vertexData = new VertexData();
    vertexData.positions = b.mesh.positions;
    vertexData.normals = b.mesh.normals;
    vertexData.indices = b.mesh.indices;
    vertexData.applyToMesh(mesh);
    // The shared shapes wind their triangles counter-clockwise when seen from outside, as three.js expects.
    mesh.sideOrientation = Material.CounterClockWiseSideOrientation;

    const material = new StandardMaterial(b.name, scene);
    material.specularColor = black;
    if (b.lit) {
      material.diffuseColor = new Color3(...b.color);
    } else {
      material.disableLighting = true;
      material.diffuseColor = black;
      material.emissiveColor = new Color3(...b.color);
      material.alpha = b.opacity;
      material.disableDepthWrite = b.opacity < 1;
    }
    mesh.material = material;

    if (b.separable && !opts.instanced) {
      const meshes: Mesh[] = [mesh];
      for (let i = 1; i < b.capacity; i++) meshes.push(mesh.clone(`${b.name}-${i}`));
      for (const m of meshes) m.rotationQuaternion = new Quaternion();
      separateBatches.push({ batch: b, meshes });
    } else {
      mesh.thinInstanceSetBuffer('matrix', b.matrices, 16, !b.dynamic);
      mesh.thinInstanceCount = b.count;
      mesh.alwaysSelectAsActiveMesh = true; // the copies move; neither library culls them
      instancedBatches.push({ batch: b, mesh });
    }
  }

  // Babylon's own water, from its materials add-on. It draws the whole scene two more times: once upside down
  // for the reflection and once for what shows through the water.
  if (data.water.own) {
    const [{ WaterMaterial }, { RawTexture }] = await Promise.all([
      import('@babylonjs/materials/water/waterMaterial'),
      import('@babylonjs/core/Materials/Textures/rawTexture'),
    ]);
    const sheet = new Mesh('own-water', scene);
    const vertexData = new VertexData();
    vertexData.positions = data.water.mesh.positions;
    vertexData.normals = data.water.mesh.normals;
    vertexData.uvs = data.water.uvs;
    vertexData.indices = data.water.mesh.indices;
    vertexData.applyToMesh(sheet);
    sheet.sideOrientation = Material.CounterClockWiseSideOrientation;
    sheet.position.y = data.water.y;
    const map = RawTexture.CreateRGBATexture(data.water.ripples.data, data.water.ripples.size, data.water.ripples.size,
      scene, true, false, Constants.TEXTURE_TRILINEAR_SAMPLINGMODE);
    map.wrapU = map.wrapV = Constants.TEXTURE_WRAP_ADDRESSMODE;
    const water = new WaterMaterial('own-water', scene, new Vector2(512, 512));
    water.bumpTexture = map;
    water.waveHeight = 0; // the sheet is flat and has few vertices, so no vertex waves
    water.bumpHeight = 0.35;
    water.windForce = -4;
    water.waveLength = 0.1; // with the sheet's coordinates, one repeat of the ripple map every 4 m
    water.waterColor = new Color3(...data.water.color);
    water.colorBlendFactor = 0.35;
    // Everything but the sheet itself: a sheet that reflects itself gets hidden for good by the material.
    for (const m of scene.meshes) if (m !== sheet) water.addToRenderList(m);
    sheet.material = water;
  }

  const instrumentation = new SceneInstrumentation(scene);

  return {
    label: `Babylon.js ${Engine.Version}`,
    resize(width, height) {
      engine.setSize(width, height);
    },
    render() {
      for (const { batch, mesh } of instancedBatches) {
        if (!batch.dynamic) continue;
        mesh.thinInstanceCount = batch.count;
        mesh.thinInstanceBufferUpdated('matrix');
      }
      for (const { batch, meshes } of separateBatches) {
        const t = batch.trs;
        for (let i = 0; i < meshes.length; i++) {
          const m = meshes[i]!, o = i * 8;
          m.setEnabled(i < batch.count);
          m.position.set(t[o]!, t[o + 1]!, t[o + 2]!);
          m.rotationQuaternion!.set(t[o + 3]!, t[o + 4]!, t[o + 5]!, t[o + 6]!);
          m.scaling.setAll(t[o + 7]!);
        }
      }
      camera.position.set(...data.camera.eye);
      camera.setTarget(new Vector3(...data.camera.target));
      engine.beginFrame();
      scene.render();
      engine.endFrame();
    },
    drawCalls: () => instrumentation.drawCallsCounter.current,
  };
};
