// Where the camera goes and which trees step aside for it (ADR 0021): plain maths, so it can be unit-tested.
import { SCENERY } from './assets/scenery';
import type { World } from './sim';

export interface View { eye: [number, number, number]; target: [number, number, number] }

/** The camera's vertical field of view, in degrees. The renderer uses it too, so a touch maps to what is drawn. */
export const CAMERA_FOV = 55;
/** A touch on the sky or near the horizon picks a spot this far from the car, in the direction touched. */
export const FAR_SPOT = 40;

/** Behind and above the kid's car, following its heading a little late. A kid can't move it. */
export function chaseView(w: World): View {
  const kid = w.cars[0]!;
  const fx = Math.sin(w.camHeading), fz = Math.cos(w.camHeading);
  return {
    // The camera rises a little with a car hopping off a ramp, so the hop shows but the car stays in view.
    eye: [kid.x - fx * 10, 5.5 + kid.y + kid.h * 0.6, kid.z - fz * 10],
    target: [kid.x + fx * 5, 1.2 + kid.h * 0.6, kid.z + fz * 5],
  };
}

/**
 * The spot on the ground under a point on the picture, as the chase camera sees it now (ADR 0031).
 * @param nx From -1 (left edge) to 1 (right edge).
 * @param ny From -1 (bottom edge) to 1 (top edge).
 * @param aspect The picture's width over its height.
 */
export function groundPoint(w: World, nx: number, ny: number, aspect: number): { x: number; z: number } {
  const { eye, target } = chaseView(w);
  let fx = target[0] - eye[0], fy = target[1] - eye[1], fz = target[2] - eye[2];
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl; fy /= fl; fz /= fl;
  // Right is forward × up; the camera's own up is right × forward (as three.js's lookAt builds them).
  const rl = Math.hypot(fz, fx) || 1;
  const rx = -fz / rl, rz = fx / rl;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  const tan = Math.tan((CAMERA_FOV * Math.PI) / 360);
  const dx = fx + rx * nx * tan * aspect + ux * ny * tan;
  const dy = fy + uy * ny * tan;
  const dz = fz + rz * nx * tan * aspect + uz * ny * tan;
  const kid = w.cars[0]!;
  if (dy < -1e-3) {
    const t = -eye[1] / dy;
    const x = eye[0] + dx * t, z = eye[2] + dz * t;
    if (Math.hypot(x - kid.x, z - kid.z) <= FAR_SPOT) return { x, z };
  }
  // The sky, or ground too far away: the spot at FAR_SPOT from the car along the same line of sight.
  const hl = Math.hypot(dx, dz) || 1;
  const hx = dx / hl, hz = dz / hl;
  const ox = eye[0] - kid.x, oz = eye[2] - kid.z;
  const b = ox * hx + oz * hz;
  const t = -b + Math.sqrt(Math.max(0, b * b - (ox * ox + oz * oz - FAR_SPOT * FAR_SPOT)));
  return { x: eye[0] + hx * t, z: eye[2] + hz * t };
}

/**
 * Eases each tree's size (0..1) toward 0 while it stands near the line from the camera to the car, and back to 1
 * once it doesn't, so a tree never hides the car (ADR 0021). `sizes` has one entry per tree.
 */
export function stepTreeSizes(w: World, sizes: number[]): void {
  const kid = w.cars[0]!;
  const { eye } = chaseView(w);
  const ex = eye[0], ez = eye[2];
  const len2 = (kid.x - ex) ** 2 + (kid.z - ez) ** 2 || 1;
  w.trees.forEach((t, i) => {
    const along = Math.max(0, Math.min(1, ((t.x - ex) * (kid.x - ex) + (t.z - ez) * (kid.z - ez)) / len2));
    const gap = Math.hypot(t.x - (ex + (kid.x - ex) * along), t.z - (ez + (kid.z - ez) * along));
    const want = SCENERY[t.kind].shrinks && gap < 2.2 * t.scale + 0.8 ? 0 : 1;
    sizes[i] = (sizes[i] ?? 1) + Math.max(-0.12, Math.min(0.12, want - (sizes[i] ?? 1)));
  });
}
