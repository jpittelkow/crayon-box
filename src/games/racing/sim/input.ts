// Turns fingers and keys into driving (ADR 0021, 0036). Kept apart from the screen so it can be unit-tested.
import type { Input } from './sim';

/** The only keys the game listens to. Every other key stays blocked by the shell (ADR 0003 rule 4). */
export const DRIVE_KEYS: readonly string[] = [
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space',
];

/**
 * @param stick Where the finger is from the middle of the screen (see `stickAt`), or undefined when no finger is
 *   down. The screen is a joystick (ADR 0036, after the playtest of 2026-11-15).
 * @param keys The driving keys held down, by `KeyboardEvent.code`. Keys steer directly, as before.
 */
export function driveInput(stick: { x: number; y: number } | undefined, keys: ReadonlySet<string>): Input {
  const input: Input = { go: false, brake: false, steer: 0 };
  if (stick) input.stick = stick;
  if (keys.has('ArrowUp') || keys.has('KeyW')) input.go = true;
  if (keys.has('ArrowDown') || keys.has('KeyS')) input.brake = true;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) input.steer -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) input.steer += 1;
  // A key takes over from the finger.
  if (input.go || input.brake || input.steer !== 0) delete input.stick;
  return input;
}

/**
 * A point on the screen as a joystick position: `x` -1 at the left edge to 1 at the right, `y` -1 at the bottom
 * to 1 at the top, 0 in the middle. Off the picture counts as its edge.
 */
export function stickAt(clientX: number, clientY: number, box: { left: number; top: number; width: number; height: number }): { x: number; y: number } {
  const x = ((clientX - box.left) / Math.max(1, box.width)) * 2 - 1;
  const y = 1 - ((clientY - box.top) / Math.max(1, box.height)) * 2;
  return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
}
