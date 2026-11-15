// Sample 1 of 3: a fire truck built in code with the game's own toy kit (ADR 0025), the way every vehicle in the
// game is made today. Front is +z, wheels on y = 0. An original design (ADR 0011).
import * as THREE from 'three';
import { bakedGroup, chrome, glass, lamp, paint, part, plastic, rbox, ROUND, wheel } from '../../../src/games/racing/look/kit';

export interface Sample {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  animate?(time: number): void;
}

export function codeFiretruck(): Sample {
  const body = new THREE.Group();
  const red = paint(0xd81e1e);
  const white = paint(0xf4f5f7);
  const dark = plastic(0x24272c, 0.55);
  const metal = chrome();
  const pane = glass();

  // Chassis and the cab: a tall, short-nosed cab with a big windscreen and a white roof.
  body.add(part(new THREE.BoxGeometry(1.9, 0.3, 7.2), dark, 0, 0.62, -0.2));
  body.add(part(rbox(2.4, 1.9, 2.0, 0.28), red, 0, 1.55, 2.4));
  body.add(part(rbox(2.3, 0.85, 0.1, 0.05), pane, 0, 2.0, 3.39));
  body.add(part(rbox(2.42, 0.7, 1.4, 0.06), pane, 0, 2.0, 2.45));
  for (const z of [3.2, 2.45, 1.7]) {
    for (const side of [-1, 1]) body.add(part(new THREE.BoxGeometry(0.12, 0.74, 0.14), red, side * 1.17, 2.0, z));
  }
  body.add(part(rbox(2.44, 0.18, 2.04, 0.06), white, 0, 2.48, 2.4));
  // Front: grille, chrome bumper, lamps.
  body.add(part(rbox(1.5, 0.6, 0.06, 0.03), metal, 0, 1.05, 3.42));
  for (let i = 0; i < 5; i++) body.add(part(new THREE.BoxGeometry(1.4, 0.04, 0.04), dark, 0, 0.85 + i * 0.1, 3.45));
  body.add(part(rbox(2.6, 0.32, 0.36, 0.12), metal, 0, 0.62, 3.5));
  const head = lamp(0xfff4d0, 1.4);
  for (const side of [-1, 1]) {
    body.add(part(new THREE.CylinderGeometry(0.16, 0.16, 0.08, ROUND).rotateX(Math.PI / 2), head, side * 0.95, 1.05, 3.42));
    body.add(part(rbox(0.12, 0.18, 0.28, 0.05), red, side * 1.27, 2.15, 3.1)); // mirrors
  }

  // The body behind the cab: lockers with chrome shutters, a white stripe, and the ladder on top.
  body.add(part(rbox(2.4, 1.7, 4.8, 0.22), red, 0, 1.55, -1.3));
  body.add(part(new THREE.BoxGeometry(2.44, 0.14, 7.0), white, 0, 1.15, 0.0));
  for (const side of [-1, 1]) {
    for (const z of [-0.2, -1.3, -2.4]) {
      body.add(part(rbox(0.05, 0.62, 0.95, 0.03), metal, side * 1.21, 1.75, z));
      for (let i = 0; i < 6; i++) body.add(part(new THREE.BoxGeometry(0.03, 0.02, 0.9), dark, side * 1.235, 1.48 + i * 0.1, z));
    }
  }
  body.add(part(rbox(2.5, 0.28, 0.34, 0.1), metal, 0, 0.62, -3.75));
  const tail = lamp(0xff2a1a, 1.2);
  for (const side of [-1, 1]) body.add(part(new THREE.BoxGeometry(0.3, 0.18, 0.07), tail, side * 0.9, 1.0, -3.72));
  // Ladder: two rails with rungs, on a turntable at the back.
  body.add(part(new THREE.CylinderGeometry(0.5, 0.55, 0.22, ROUND), metal, 0, 2.52, -3.0));
  for (const side of [-1, 1]) body.add(part(rbox(0.1, 0.14, 5.4, 0.04), white, side * 0.42, 2.72, -0.6));
  for (let i = 0; i < 14; i++) body.add(part(new THREE.CylinderGeometry(0.035, 0.035, 0.84, 8).rotateZ(Math.PI / 2), metal, 0, 2.72, -3.1 + i * 0.38));
  // Hose reel on the side.
  body.add(part(new THREE.CylinderGeometry(0.32, 0.32, 0.2, ROUND).rotateZ(Math.PI / 2), paint(0xf2c200), 1.28, 1.75, 0.9));

  // Light bar on the cab roof, kept out of the bake so it can flash red and white.
  const redLamp = lamp(0xff1a1a, 2.6), whiteLamp = lamp(0xffffff, 2.2);
  const live: THREE.Object3D[] = [
    part(rbox(0.8, 0.18, 0.34, 0.07), redLamp, -0.5, 2.67, 2.5),
    part(rbox(0.8, 0.18, 0.34, 0.07), whiteLamp, 0.5, 2.67, 2.5),
  ];
  const light = new THREE.PointLight(0xff2020, 6, 8, 2);
  light.position.set(0, 2.9, 2.5);
  live.push(light);

  const wheels: THREE.Object3D[] = [];
  for (const z of [2.3, -2.4]) {
    for (const side of [-1, 1]) {
      const w = wheel(0.58, 0.48);
      w.position.set(side * 1.08, 0.58, z);
      wheels.push(w);
    }
  }
  const group = new THREE.Group();
  group.add(bakedGroup(body), ...wheels, ...live);
  return {
    group,
    wheels,
    animate(time) {
      const on = Math.floor(time * 4) % 2 === 0;
      redLamp.emissiveIntensity = on ? 3 : 0.3;
      whiteLamp.emissiveIntensity = on ? 0.3 : 2.6;
      light.color.set(on ? 0xff2020 : 0xffffff);
    },
  };
}
