// Turns fingers and keys into driving (ADR 0021). Kept apart from the screen so it can be unit-tested.
import type { Input } from './sim';

/** The only keys the game listens to. Every other key stays blocked by the shell (ADR 0003 rule 4). */
export const DRIVE_KEYS: readonly string[] = [
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space',
];

/**
 * @param finger Where across the picture the finger the car follows is, from -1 (left edge) to 1 (right edge),
 *   or undefined when no finger is down. Touching makes the car go; the further to one side, the sharper the turn.
 * @param keys The driving keys held down, by `KeyboardEvent.code`.
 */
export function driveInput(finger: number | undefined, keys: ReadonlySet<string>): Input {
  const input: Input = { go: false, brake: false, steer: 0 };
  if (finger !== undefined) {
    input.go = true;
    input.steer = finger * 1.3;
  }
  if (keys.has('ArrowUp') || keys.has('KeyW')) input.go = true;
  if (keys.has('ArrowDown') || keys.has('KeyS')) input.brake = true;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) input.steer -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) input.steer += 1;
  input.steer = Math.max(-1, Math.min(1, input.steer));
  return input;
}
