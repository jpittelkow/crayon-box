// The driving game (ADR 0021): a vehicle picker (milestone-3 B5), then an island with traffic, things to knock around,
// water and set pieces. Touch a spot and the car drives there (ADR 0031), or drive with the arrow keys or W, A, S, D.
// three.js loads only when the game opens; the parent area can load this file without it.
import type { GameContext, GameModule } from '../../shell/types';
import { icons } from '../../ui/icons';
import { el, kidButton, setPicked } from '../../ui/kid';
import type { createRenderer as CreateRendererFn } from './render';
import { MAPS, MAP_NAMES } from './maps';
import { VEHICLE_NAMES } from './names';
import { pagesOf } from './pickerPages';
import { detailWatcher } from './detail';
import type { MapDef } from './sim/map';
import { forgetKid, loadDrivingSettings, loadKidDriving, saveKidDriving, shownVehicles, type KidDriving } from './settings';
import { DRIVE_KEYS, driveInput } from './sim/input';
import { TOYS } from './sim/assets/toys';
import { honk, makeWorld, step, type Assist, type VehicleKind, type World } from './sim/sim';
import { groundPoint } from './sim/view';
import { DrivingSound } from './sound';
import './racing.css';
import { version as APP_VERSION } from '../../../package.json';

/** How many things to knock around on the island. */
export const PROP_COUNT = 150;
const SEED = 7;
const STEP = 1 / 60;
/** A touch reported wider than this (CSS px) is a palm, and is ignored (ADR 0003 rule 3). */
const PALM_CSS_PX = 80;

type CreateRenderer = typeof CreateRendererFn;

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
  /** What to undo when the drive ends (Back to the picker, or the game closing). */
  private readonly driving: (() => void)[] = [];
  private loaded?: {
    prefs: KidDriving;
    settings: Awaited<ReturnType<typeof loadDrivingSettings>>;
    createRenderer: CreateRenderer;
    thumbs: typeof import('./look/thumbs');
  };

  constructor(
    private readonly root: HTMLElement,
    private readonly ctx: GameContext,
  ) {}

  async start(): Promise<void> {
    const { kid, storage } = this.ctx;
    const [prefs, settings, { createRenderer }, thumbs] = await Promise.all([
      loadKidDriving(storage, kid.id),
      loadDrivingSettings(storage),
      import('./render'),
      import('./look/thumbs'),
    ]);
    if (this.stopped) return;
    this.loaded = { prefs, settings, createRenderer, thumbs };
    this.showPicker();
  }

  /**
   * The picker (milestone-3 B5 and E, ADR 0035): one screen on the kid's colour (ADR 0021), the maps along the top
   * and the vehicles below. A tap on a map rings it; a tap on a vehicle drives off on the ringed map. The last map
   * and vehicle show picked. It shows at once; the pictures are drawn one at a time after it (playtest, 2026-11-15).
   */
  private showPicker(): void {
    const { kid, storage } = this.ctx;
    const { prefs, settings, createRenderer, thumbs } = this.loaded!;
    const kidColor = this.kidColor();
    const picker = el('div', 'driving-picker', { 'data-ready': 'false' });
    picker.style.background = `var(--kid-${kid.color}-tint, var(--paper))`;
    picker.append(kidButton({ kind: 'action-lg', label: 'Back', html: icons.back(), className: 'driving-back', onTap: () => this.ctx.exitToHome() }));
    let chosen = false;
    const choose = async (vehicle: VehicleKind) => {
      if (chosen) return;
      chosen = true;
      this.loaded!.prefs = { ...prefs, vehicle, map: map.id };
      await saveKidDriving(storage, kid.id, this.loaded!.prefs);
      if (this.stopped) return;
      picker.remove();
      this.drive(prefs.assist, settings.sounds, createRenderer, vehicle, kidColor, shown, map);
    };
    // Pictures to draw once the picker shows: what is in view first.
    const jobs: { key: string; img: HTMLImageElement; draw: () => string; first: boolean }[] = [];
    const picture = (tile: HTMLElement) => {
      const img = Object.assign(document.createElement('img'), { alt: '' });
      tile.append(img);
      return img;
    };
    // The maps: wide tiles, each a picture of it from above.
    let map = MAPS.find((m) => m.id === prefs.map) ?? MAPS[0]!;
    const mapTilesEls = MAPS.map((m) => {
      const tile = kidButton({
        kind: 'paper', label: MAP_NAMES[m.id] ?? m.id, className: 'map-tile',
        onTap: () => {
          map = m;
          setPicked(mapTilesEls, tile);
        },
      });
      tile.dataset.map = m.id;
      jobs.push({ key: `map-${m.id}-${kidColor}`, img: picture(tile), draw: () => thumbs.mapPicture(m, kidColor), first: false });
      return tile;
    });
    setPicked(mapTilesEls, mapTilesEls[MAPS.indexOf(map)]);
    const mapRow = el('div', 'map-row');
    mapRow.append(...mapTilesEls);
    // The vehicles a parent has on (ADR 0035).
    const shown = shownVehicles(settings);
    let painter: import('./look/thumbs').VehiclePainter | undefined;
    const tiles = shown.map((vehicle) => {
      const tile = kidButton({ kind: 'paper', label: VEHICLE_NAMES[vehicle], className: 'vehicle-tile', onTap: () => void choose(vehicle) });
      tile.dataset.vehicle = vehicle;
      jobs.push({ key: `vehicle-${vehicle}-${kidColor}`, img: picture(tile), draw: () => (painter ??= thumbs.vehiclePainter()).draw(vehicle, kidColor), first: false });
      return tile;
    });
    const last = Math.max(0, shown.indexOf(prefs.vehicle));
    setPicked(tiles, tiles[last]);
    // Six places: a page of vehicles, with a "more" tile and, after the first page, a "back a page" tile (ADR 0016
    // rule 6; the playtest of 2026-11-15 found no way back). It opens on the page with the last pick.
    const pages = pagesOf(tiles.length);
    let page = Math.max(0, pages.findIndex((p) => p.includes(last)));
    const grid = el('div', 'vehicle-grid');
    const turn = (by: number) => {
      page = Math.max(0, Math.min(pages.length - 1, page + by));
      showPage();
    };
    const less = kidButton({ kind: 'paper', label: 'Back a page', html: icons.less(), className: 'vehicle-tile vehicle-more vehicle-less', onTap: () => turn(-1) });
    const more = kidButton({ kind: 'paper', label: 'More', html: icons.more(), className: 'vehicle-tile vehicle-more', onTap: () => turn(1) });
    const showPage = () =>
      grid.replaceChildren(...(page > 0 ? [less] : []), ...pages[page]!.map((i) => tiles[i]!), ...(page < pages.length - 1 ? [more] : []));
    showPage();
    picker.append(mapRow, grid);
    this.root.append(picker);
    picker.dataset.ready = 'true';

    // The pictures: the vehicles on this page first, then the maps, then the rest; kept for next time.
    for (const i of pages[page]!) jobs[MAPS.length + i]!.first = true;
    jobs.sort((a, b) => Number(b.first) - Number(a.first));
    void (async () => {
      const { cachedPicture } = await import('./look/pictureCache');
      try {
        for (const job of jobs) {
          if (this.stopped || chosen) break;
          job.img.src = await cachedPicture(job.key, job.draw, import.meta.env.DEV ? undefined : storage, APP_VERSION);
          // Let the screen show it, and take a tap, before drawing the next.
          await new Promise((r) => setTimeout(r, 16));
        }
        if (!chosen) picker.dataset.pictures = 'true';
      } finally {
        painter?.dispose();
      }
    })();
  }

  /** A map, driven in the vehicle the kid picked. */
  private drive(assist: Assist, soundsOn: boolean, createRenderer: CreateRenderer, vehicle: VehicleKind, kidColor: string, shown: VehicleKind[], map: MapDef): void {
    const screen = el('div', 'driving', { 'data-ready': 'false' });
    const canvas = el('canvas', 'driving-canvas') as DrivingCanvas;
    // Back returns to the picker (playtest, 2026-11-15), whose Back goes home.
    const back = kidButton({
      kind: 'action-lg', label: 'Back', html: icons.back(), className: 'driving-back',
      onTap: () => {
        for (const cleanup of this.driving.splice(0).reverse()) cleanup();
        screen.remove();
        if (!this.stopped) this.showPicker();
      },
    });
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
    this.driving.push(() => sound.close());

    const world = makeWorld(SEED, map.propCount ?? PROP_COUNT, assist, map, vehicle, shown);
    canvas.drivingWorld = world;
    let renderer = createRenderer(canvas, world, kidColor);
    this.driving.push(() => renderer.dispose());

    // ---- Size: real pixels, capped for built-in graphics (ADR 0021), fewer if frames fall behind ----
    const watcher = detailWatcher();
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const css = { w: canvas.clientWidth || 1, h: canvas.clientHeight || 1 };
      // The frame may be scaled down to fit the window (ADR 0019); draw at the size it really is on screen.
      const shown = r.width / css.w || 1;
      // Fewer pixels on a computer that can't keep up (detail.ts).
      renderer.resize(css.w, css.h, (window.devicePixelRatio || 1) * shown * watcher.detail);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    this.driving.push(() => observer.disconnect());
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
    this.driving.push(() => {
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
    this.driving.push(() => {
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
      if (watcher.frame(now - last) !== null) {
        canvas.dataset.detail = String(watcher.detail);
        resize();
      }
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
    this.driving.push(() => cancelAnimationFrame(frame));
    screen.dataset.ready = 'true';
  }

  /** The kid's own color from the Crayon Box tokens (ADR 0016 rule 7), for their car. */
  private kidColor(): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(`--kid-${this.ctx.kid.color}`).trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : '#3a86ff';
  }

  async unmount(): Promise<void> {
    this.stopped = true;
    for (const cleanup of this.driving.splice(0).reverse()) cleanup();
  }
}
