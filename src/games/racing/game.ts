// The driving game (ADR 0021): a vehicle picker (milestone-3 B5), then an island with traffic, things to knock around,
// water and set pieces. Touch a spot and the car drives there (ADR 0031), or drive with the arrow keys or W, A, S, D.
// three.js loads only when the game opens; the parent area can load this file without it.
import type { GameContext, GameModule } from '../../shell/types';
import { icons } from '../../ui/icons';
import { el, kidButton, setPicked } from '../../ui/kid';
import type { createRenderer as CreateRendererFn } from './render';
import { VEHICLES, forgetKid, loadDrivingSettings, loadKidDriving, saveKidDriving } from './settings';
import { DRIVE_KEYS, driveInput } from './sim/input';
import { TOYS } from './sim/assets/toys';
import { honk, makeWorld, step, type Assist, type VehicleKind, type World } from './sim/sim';
import { groundPoint } from './sim/view';
import { DrivingSound } from './sound';
import './racing.css';

/** How many things to knock around on the island. */
export const PROP_COUNT = 150;
const SEED = 7;
const STEP = 1 / 60;
/** A touch reported wider than this (CSS px) is a palm, and is ignored (ADR 0003 rule 3). */
const PALM_CSS_PX = 80;

type CreateRenderer = typeof CreateRendererFn;

/** The vehicles' names, for screen readers and tests only: the picker shows no text (ADR 0003). */
const VEHICLE_NAMES: Record<VehicleKind, string> = { car: 'Car', police: 'Police car', monster: 'Monster truck', bus: 'School bus' };

/** The canvas carries the running world, for tests and the dev tools only. */
export type DrivingCanvas = HTMLCanvasElement & { drivingWorld?: World };

export const drivingGame: GameModule = {
  mount(root, ctx) {
    const game = new DrivingGame(root, ctx);
    void game.start();
    return () => game.unmount();
  },
  parentSettings: [
    {
      id: 'driving',
      title: 'Driving',
      render: async (el, ctx) => (await import('./parentSection')).renderDriving(el, ctx),
    },
  ],
  forgetKid,
};

class DrivingGame {
  private stopped = false;
  private readonly cleanups: (() => void)[] = [];

  constructor(
    private readonly root: HTMLElement,
    private readonly ctx: GameContext,
  ) {}

  async start(): Promise<void> {
    const { kid, storage } = this.ctx;
    const [prefs, settings, { createRenderer }, { vehicleTiles }] = await Promise.all([
      loadKidDriving(storage, kid.id),
      loadDrivingSettings(storage),
      import('./render'),
      import('./look/thumbs'),
    ]);
    if (this.stopped) return;
    const kidColor = this.kidColor();

    // The vehicle picker (milestone-3 B5): a tile for each vehicle, on the kid's colour (ADR 0021); the last one
    // picked shows picked, and a tap drives off in that vehicle.
    const picker = el('div', 'driving-picker', { 'data-ready': 'false' });
    picker.style.background = `var(--kid-${kid.color}-tint, var(--paper))`;
    picker.append(kidButton({ kind: 'action-lg', label: 'Back', html: icons.back(), className: 'driving-back', onTap: () => this.ctx.exitToHome() }));
    let chosen = false;
    const choose = async (vehicle: VehicleKind) => {
      if (chosen) return;
      chosen = true;
      await saveKidDriving(storage, kid.id, { ...prefs, vehicle });
      if (this.stopped) return;
      picker.remove();
      this.drive(prefs.assist, settings.sounds, createRenderer, vehicle, kidColor);
    };
    const pictures = vehicleTiles(VEHICLES, kidColor);
    const tiles = VEHICLES.map((vehicle, i) => {
      const tile = kidButton({ kind: 'paper', label: VEHICLE_NAMES[vehicle], className: 'vehicle-tile', onTap: () => void choose(vehicle) });
      tile.dataset.vehicle = vehicle;
      tile.append(Object.assign(document.createElement('img'), { src: pictures[i], alt: '' }));
      return tile;
    });
    setPicked(tiles, tiles[VEHICLES.indexOf(prefs.vehicle)]);
    const grid = el('div', 'vehicle-grid');
    grid.append(...tiles);
    picker.append(grid);
    this.root.append(picker);
    picker.dataset.ready = 'true';
  }

  /** The island, driven in the vehicle the kid picked. */
  private drive(assist: Assist, soundsOn: boolean, createRenderer: CreateRenderer, vehicle: VehicleKind, kidColor: string): void {
    const screen = el('div', 'driving', { 'data-ready': 'false' });
    const canvas = el('canvas', 'driving-canvas') as DrivingCanvas;
    const back = kidButton({ kind: 'action-lg', label: 'Back', html: icons.back(), className: 'driving-back', onTap: () => this.ctx.exitToHome() });
    // The game's own sounds switch, and the app's (ADR 0032 settles what ADR 0025 left open: both must be on).
    const sound = new DrivingSound(soundsOn && this.ctx.sound.enabled !== false);
    // Start decoding the sound files now (that needs no touch), so the first honk isn't silent.
    sound.unlock();
    // The horn: its sound, and the animals nearby answer it (milestone-3 B3). The world is made just below.
    const hornNow = () => {
      sound.horn();
      honk(world);
    };
    const hornButton = kidButton({ kind: 'action-lg', label: 'Horn', html: icons.horn(), className: 'driving-horn', onTap: () => hornNow() });
    // The horn sounds on touch-down, so a quick tap still honks; onTap's lift still gives the press bounce.
    hornButton.addEventListener('pointerdown', () => sound.unlock());
    screen.append(canvas, back, hornButton);
    this.root.append(screen);
    this.cleanups.push(() => sound.close());

    const world = makeWorld(SEED, PROP_COUNT, assist, undefined, vehicle);
    canvas.drivingWorld = world;
    let renderer = createRenderer(canvas, world, kidColor);
    this.cleanups.push(() => renderer.dispose());

    // ---- Size: real pixels, capped for built-in graphics (ADR 0021) ----
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const css = { w: canvas.clientWidth || 1, h: canvas.clientHeight || 1 };
      // The frame may be scaled down to fit the window (ADR 0019); draw at the size it really is on screen.
      const shown = r.width / css.w || 1;
      renderer.resize(css.w, css.h, (window.devicePixelRatio || 1) * shown);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    this.cleanups.push(() => observer.disconnect());
    resize();

    // If the browser drops the drawing context, build a fresh renderer once it is back (ADR 0021).
    const onLost = (e: Event) => e.preventDefault();
    const onRestored = () => {
      renderer.dispose();
      renderer = createRenderer(canvas, world, kidColor);
      resize();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    this.cleanups.push(() => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    });

    // ---- Fingers: the car drives to the spot under the newest one still down (ADR 0031) ----
    // The spot is picked when the finger lands or moves, then stays put on the ground while the finger rests, so
    // the car arrives and stops instead of chasing a point that moves with the camera.
    const fingers = new Map<number, { x: number; z: number }>();
    const spotUnder = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      const ny = Math.max(-1, Math.min(1, 1 - ((e.clientY - r.top) / r.height) * 2));
      return groundPoint(world, nx, ny, r.width / Math.max(1, r.height));
    };
    const isPalm = (e: PointerEvent) => e.pointerType === 'touch' && Math.max(e.width, e.height) > PALM_CSS_PX;
    canvas.addEventListener('pointerdown', (e) => {
      sound.unlock();
      if (isPalm(e) || e.button > 0) return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic events in tests can't be captured; driving still works.
      }
      fingers.delete(e.pointerId);
      fingers.set(e.pointerId, spotUnder(e));
    });
    canvas.addEventListener('pointermove', (e) => {
      if (fingers.has(e.pointerId)) fingers.set(e.pointerId, spotUnder(e));
    });
    const lift = (e: PointerEvent) => fingers.delete(e.pointerId);
    canvas.addEventListener('pointerup', lift);
    canvas.addEventListener('pointercancel', lift);

    // ---- Keys: arrows or W, A, S, D; space is the horn. The shell still blocks what keys normally do. ----
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (!DRIVE_KEYS.includes(e.code)) return;
      sound.unlock();
      if (e.code === 'Space' && !e.repeat) hornNow();
      keys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const onBlur = () => {
      keys.clear();
      fingers.clear();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    this.cleanups.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    });

    // ---- The loop: the simulation runs at a fixed step, drawing at the screen's own rate ----
    let last = performance.now();
    let owed = 0;
    let frame = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      owed = Math.min(owed + (now - last) / 1000, STEP * 5);
      last = now;
      const input = driveInput([...fingers.values()].at(-1), keys);
      while (owed >= STEP) {
        step(world, input, STEP);
        for (const toy of world.knocks) sound.bump(TOYS[toy].bump);
        for (const depth of world.splashes) sound.splash(depth === 2);
        // Animals answering the horn (milestone-3 B3).
        for (const kind of world.calls) sound.call(kind);
        // Landing from a ramp hop: a soft thump (its own sound comes with the sound files, milestone-3 B6).
        if (world.landings.includes(0)) sound.bump('thump');
        owed -= STEP;
      }
      sound.update(world, input);
      renderer.render(world);
    };
    frame = requestAnimationFrame(tick);
    this.cleanups.push(() => cancelAnimationFrame(frame));
    screen.dataset.ready = 'true';
  }

  /** The kid's own color from the Crayon Box tokens (ADR 0016 rule 7), for their car. */
  private kidColor(): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(`--kid-${this.ctx.kid.color}`).trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : '#3a86ff';
  }

  async unmount(): Promise<void> {
    this.stopped = true;
    for (const cleanup of this.cleanups.splice(0).reverse()) cleanup();
  }
}
