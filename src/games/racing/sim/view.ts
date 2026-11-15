// Where the camera goes and which trees step aside for it (ADR 0021): plain maths, so it can be unit-tested.
import type { World } from './sim';

export interface View { eye: [number, number, number]; target: [number, number, number] }

/** Behind and above the kid's car, following its heading a little late. A kid can't move it. */
export function chaseView(w: World): View {
  const kid = w.cars[0]!;
  const fx = Math.sin(w.camHeading), fz = Math.cos(w.camHeading);
  return {
    eye: [kid.x - fx * 10, 5.5 + kid.y, kid.z - fz * 10],
    target: [kid.x + fx * 5, 1.2, kid.z + fz * 5],
  };
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
    const want = gap < 2.2 * t.scale + 0.8 ? 0 : 1;
    sizes[i] = (sizes[i] ?? 1) + Math.max(-0.12, Math.min(0.12, want - (sizes[i] ?? 1)));
  });
}
