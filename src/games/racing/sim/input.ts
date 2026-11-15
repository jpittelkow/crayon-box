// Turns fingers and keys into driving (ADR 0021, 0031). Kept apart from the screen so it can be unit-tested.
import type { Input } from './sim';

/** The only keys the game listens to. Every other key stays blocked by the shell (ADR 0003 rule 4). */
export const DRIVE_KEYS: readonly string[] = [
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space',
];

/**
 * @param spot The spot on the ground under the finger the car follows (see `groundPoint`), or undefined when no
 *   finger is down. A finger makes the car drive to that spot (ADR 0031).
 * @param keys The driving keys held down, by `KeyboardEvent.code`. Keys steer directly, as before.
 */
export function driveInput(spot: { x: number; z: number } | undefined, keys: ReadonlySet<string>): Input {
  const input: Input = { go: false, brake: false, steer: 0 };
  if (spot) {
    input.go = true;
    input.spot = spot;
  }
  if (keys.has('ArrowUp') || keys.has('KeyW')) input.go = true;
  if (keys.has('ArrowDown') || keys.has('KeyS')) input.brake = true;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) input.steer -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) input.steer += 1;
  // A steering key takes over from the finger's spot.
  if (input.steer !== 0) delete input.spot;
  return input;
}
