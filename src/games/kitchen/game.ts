// Kitchen (ADR 0044): a kid makes a thing step by step with their fingers. This file is the game's two screens: the
// start screen, with a tile for each thing to make, and the counter, with the canvas the thing is on, the rail of
// choices, next and back, the fingers, and the sounds. What a touch does to the thing is in make/verbs.ts (plain
// rules with unit tests); how each thing looks is under look/.
import type { GameContext, GameModule } from '../../shell/types';
import { icons } from '../../ui/icons';
import { el, kidButton, setPicked } from '../../ui/kid';
import { NameCounter, loadNamesSetting, type NamesSetting } from '../coloring/names';
import { optionSvg } from './look/art';
import { CupcakeLook } from './look/cupcake';
import { drawPiece, seeded, type Look, type View } from './look/kit';
import { PizzaLook } from './look/pizza';
import { fresh, stepOf, untouched, type Made, type Placed, type Pt } from './make/made';
import { cook, doneEnough, next, pick, pour, progress, sample, touch } from './make/verbs';
import { railOf, type Recipe, type Step } from './recipe';
import { CUPCAKE } from './recipes/cupcake';
import { PIZZA } from './recipes/pizza';
import { KITCHEN_SOUND_FILES, KITCHEN_SOUNDS, POUR_RATE, SPREAD_RATE } from './sounds';
import { forgetKid, Making } from './store';
import { KitchenVoice } from './voice';
import './kitchen.css';

export const kitchenGame: GameModule = {
  mount(root, ctx) {
    const game = new KitchenGame(root, ctx);
    game.start();
    return () => game.unmount();
  },
  forgetKid,
};

/** The things to make, in the order of their tiles, each with how it is drawn. */
const RECIPES: readonly { recipe: Recipe; look: () => Look; tile: { units: number; cy: number } }[] = [
  { recipe: PIZZA, look: () => new PizzaLook(), tile: { units: 660, cy: 0 } },
  { recipe: CUPCAKE, look: () => new CupcakeLook(), tile: { units: 560, cy: 26 } },
];
type Entry = (typeof RECIPES)[number];

/**
 * A tile's picture, in CSS px. Each recipe says how many of its units the picture shows across its shorter side, and
 * where the picture's middle is (a cupcake on its plate is not centred on 0,0).
 */
const TILE_W = 300, TILE_H = 240;

/** A picture of a finished one, drawn by the recipe's own look: what its tile on the start screen shows. */
function tilePicture(entry: Entry): HTMLCanvasElement {
  const canvas = el('canvas', 'kitchen-tile-picture');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(TILE_W * dpr);
  canvas.height = Math.round(TILE_H * dpr);
  const c = canvas.getContext('2d');
  if (!c) return canvas;
  const unit = Math.min(TILE_W, TILE_H) / entry.tile.units;
  c.setTransform(unit * dpr, 0, 0, unit * dpr, canvas.width / 2, canvas.height / 2 - entry.tile.cy * unit * dpr);
  const view: View = { time: 0, flat: 1, width: TILE_W / unit, height: TILE_H / unit, held: false, pop: () => 1, bubbles: [] };
  entry.look().draw(c, entry.recipe, sample(entry.recipe, seeded(7)), view);
  return canvas;
}

/**
 * The game: the start screen, then the counter for the thing picked. Back on the counter comes back here; back
 * here leaves the game.
 */
class KitchenGame {
  private counter: Counter | undefined;
  private stopped = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly ctx: GameContext,
  ) {}

  start(): void {
    this.showStart();
  }

  async unmount(): Promise<void> {
    this.stopped = true;
    await this.counter?.unmount();
  }

  /** One big tile for each thing to make (three across, ADR 0016 rule 6). */
  private showStart(): void {
    const screen = el('div', 'kitchen-screen kitchen-start', { 'data-screen': 'kitchen-start' });
    const back = kidButton({ kind: 'action-lg', label: 'Back', html: icons.back(), className: 'kitchen-corner', onTap: () => this.ctx.exitToHome() });
    const row = el('div', 'kitchen-start-row');
    for (const entry of RECIPES) {
      const tile = kidButton({
        kind: 'paper',
        label: entry.recipe.label,
        className: 'kitchen-tile',
        onTap: () => {
          this.ctx.sound.play('tap');
          this.open(entry);
        },
      });
      tile.append(tilePicture(entry));
      row.append(tile);
    }
    screen.append(back, row);
    this.root.replaceChildren(screen);
  }

  private open(entry: Entry): void {
    const counter = new Counter(this.root, this.ctx, entry.recipe, entry.look(), () => void this.leave(counter));
    this.counter = counter;
    void counter.start();
  }

  /** Back on the counter: what is being made is saved first, then the start screen shows. */
  private async leave(counter: Counter): Promise<void> {
    await counter.unmount();
    if (this.counter === counter) this.counter = undefined;
    if (!this.stopped) this.showStart();
  }
}

/** A touch reported wider than this (CSS px) is a palm, and is ignored (ADR 0003 rule 3). */
const PALM_CSS_PX = 80;
/** The canvas shows this many of the thing's units across its shorter side (the board is 636 across). */
const UNITS_ACROSS = 720;
/** The logic that runs on time, not on touches (the oven, cheese under a held finger), ticks this often. */
const TICK_MS = 50;
/** A finger held still on the cheese step drops more this often. */
const HOLD_DROP_MS = 90;
/** A finger still for this long stops the spreading sound: it plays only while the finger moves. */
const STILL_MS = 150;
/** After the oven's bell the pizza comes out this much later. */
const OUT_OF_OVEN_MS = 700;
/** After the last bite the empty plate stays this long before the new dough arrives. */
const EMPTY_PLATE_MS = 1500;
/** How long a bit or a piece takes to settle after it lands. */
const POP_S = 0.18;
/** A sprinkle sound at most this often, however fast the cheese falls. */
const SPRINKLE_SOUND_MS = 110;

/** How far a finger that is down must move before it acts again, in units, for each verb. */
function gapOf(step: Step): number {
  switch (step.verb) {
    case 'press': return 70;
    case 'spread': return 6;
    case 'sprinkle': return 14;
    case 'place': return step.apart;
    case 'eat': return step.bite * 0.9;
    default: return Infinity;
  }
}

interface Finger {
  at: Pt;
  /** Where it last did something. */
  acted: Pt;
  /** When it last dropped anything (ms), for a finger held still. */
  dropped: number;
}

/** Things that fly for a moment and are never saved: a pat's ring, a topping that missed, crumbs. */
type Fx =
  | { kind: 'ring'; x: number; y: number; age: number; life: number }
  | { kind: 'piece'; piece: Placed; vx: number; vy: number; spin: number; age: number; life: number }
  | { kind: 'crumb'; x: number; y: number; vx: number; vy: number; r: number; colour: string; age: number; life: number };

const CRUMB_COLOURS = ['#e2a85c', '#ffcf5a', '#e2a85c', '#c92a20'];

/** The counter: one thing being made. */
class Counter {
  private made: Made;
  private making!: Making;
  private voice: KitchenVoice | undefined;
  /** How often a picked thing's name is said (the coloring game's rule, ADR 0038), until Kitchen's parent screen sets it. */
  private names: NamesSetting = 'first';
  private screen!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private rail!: HTMLElement;
  private nextButton!: HTMLButtonElement;
  private readonly fingers = new Map<number, Finger>();
  private fx: Fx[] = [];
  private bubbles: { x: number; y: number; at: number }[] = [];
  /** When each new bit and piece landed (`time`), for its little pop. */
  private born = new WeakMap<object, number>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private ticker: ReturnType<typeof setInterval> | undefined;
  private still: ReturnType<typeof setTimeout> | undefined;
  private frame = 0;
  private resize: ResizeObserver | undefined;
  private stopped = false;
  /** Between the last bite and the new dough: touches and next wait. */
  private busy = false;
  /** CSS px per unit. */
  private unit = 1;
  private readonly opened = performance.now();
  private time = 0;
  private lastFrame = this.opened;
  private lastTick = this.opened;
  private lastSprinkleSound = 0;
  /** The dough's flatness as shown; it eases toward the saved number. */
  private flat = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly ctx: GameContext,
    private readonly recipe: Recipe,
    private readonly look: Look,
    private readonly onBack: () => void,
  ) {
    this.made = fresh(recipe);
  }

  /** How flat the thing has been pressed (1 for a recipe with nothing to press). */
  private pressedFlat(): number {
    const press = this.recipe.steps.find((s) => s.verb === 'press');
    return press ? (this.made.pressed[press.id] ?? 0) : 1;
  }

  async start(): Promise<void> {
    this.making = new Making(this.ctx.storage, this.ctx.kid.id, this.recipe);
    const counter = new NameCounter(this.ctx.storage, this.ctx.kid.id);
    const [made, names] = await Promise.all([
      this.making.load(),
      loadNamesSetting(this.ctx.storage).catch((): NamesSetting => 'first'),
      counter.load().catch(() => undefined),
    ]);
    if (this.stopped) return;
    this.names = names;
    this.voice = new KitchenVoice(this.ctx.sound, counter, () => this.names);
    this.made = made;
    this.flat = this.pressedFlat();
    this.ctx.sound.preload?.(KITCHEN_SOUND_FILES);
    this.build();
    this.enterStep();
    this.ticker = setInterval(() => this.tick(), TICK_MS);
    this.frame = requestAnimationFrame(() => this.draw());
  }

  async unmount(): Promise<void> {
    this.stopped = true;
    cancelAnimationFrame(this.frame);
    clearInterval(this.ticker);
    clearTimeout(this.still);
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.resize?.disconnect();
    this.ctx.sound.scratch?.(0);
    this.voice?.stop();
    await this.making?.flush();
  }

  private get step(): Step {
    return stepOf(this.recipe, this.made);
  }

  private later(ms: number, run: () => void): void {
    const t = setTimeout(() => {
      this.timers.delete(t);
      if (!this.stopped) run();
    }, ms);
    this.timers.add(t);
  }

  // ---- The screen ----

  private build(): void {
    const screen = el('div', 'kitchen-screen', { 'data-screen': 'kitchen-counter' });
    const back = kidButton({ kind: 'action-lg', label: 'Back', html: icons.back(), className: 'kitchen-corner', onTap: () => this.onBack() });
    const worktop = el('div', 'kitchen-worktop');
    const canvas = el('canvas', 'kitchen-canvas', { role: 'img' });
    worktop.append(canvas);
    const side = el('div', 'kitchen-side');
    const rail = el('div', 'kitchen-rail', { role: 'group' });
    const nextButton = kidButton({ kind: 'action-lg', label: 'Next', html: icons.next(72), className: 'kitchen-next', onTap: () => this.goNext(true) });
    side.append(rail, nextButton);
    screen.append(back, worktop, side);
    this.screen = screen;
    this.canvas = canvas;
    this.rail = rail;
    this.nextButton = nextButton;
    this.root.replaceChildren(screen);

    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) canvas.addEventListener(type, (e) => this.up(e));
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(worktop);
    this.fit();
  }

  /** Sizes the canvas's pixels to its box. */
  private fit(): void {
    const w = this.canvas.clientWidth || 826, h = this.canvas.clientHeight || 734;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.unit = Math.min(w, h) / UNITS_ACROSS;
  }

  /** A step opens: its rail, its name for screen readers, and whatever starts by itself. */
  private enterStep(): void {
    const step = this.step;
    this.fingers.clear();
    this.ctx.sound.scratch?.(0);
    this.canvas.setAttribute('aria-label', `${this.recipe.label}: ${step.label}`);
    const rail = railOf(step);
    this.rail.replaceChildren();
    this.rail.hidden = !rail;
    if (rail) {
      this.rail.setAttribute('aria-label', rail.label);
      this.rail.dataset.cols = rail.options.length > 4 ? '2' : '1';
      const buttons: HTMLButtonElement[] = [];
      for (const option of rail.options) {
        const button = kidButton({
          kind: 'choice',
          label: option.label,
          html: optionSvg(option.id),
          className: 'kitchen-pick',
          onPress: () => {
            if (!pick(this.made, step, option.id)) return;
            setPicked(buttons, button);
            this.ctx.sound.play('tap');
            this.voice?.name(option);
            this.changed();
          },
        });
        buttons.push(button);
      }
      this.rail.append(...buttons);
      setPicked(buttons, buttons[rail.options.findIndex((o) => o.id === this.made.picked[step.id])]);
    }
    const cooked = step.verb === 'cook' && (this.made.cooked[step.id] ?? 0) >= 1;
    if (step.verb === 'cook') {
      if (cooked) this.later(OUT_OF_OVEN_MS, () => this.leaveOven(step));
      else this.ctx.sound.effect?.(KITCHEN_SOUNDS.ovenIn);
    }
    // The step's line, and before a new thing's first step the recipe's own ("Let's make a pizza!").
    if (!cooked) this.voice?.tip([untouched(this.made) ? this.recipe.sayStart : undefined, step.say]);
    this.show();
  }

  /** What tests and screen readers can see of where things stand; and the next arrow's pulse. */
  private show(): void {
    const step = this.step;
    const done = doneEnough(this.recipe, this.made, step);
    this.screen.dataset.step = step.id;
    this.screen.dataset.done = String(done);
    this.screen.dataset.progress = String(Math.round(progress(this.recipe, this.made, step) * 100));
    this.screen.dataset.count = step.verb === 'place' ? String(this.made.placed[step.id]?.length ?? 0) : '';
    this.nextButton.classList.toggle('is-ready', done && !this.busy);
  }

  /** The thing changed: save it soon (ADR 0003 rule 6) and show where it stands. */
  private changed(): void {
    this.making.changed(this.made);
    this.show();
  }

  // ---- Next ----

  private goNext(byHand: boolean): void {
    if (this.busy || this.stopped) return;
    if (byHand) this.ctx.sound.play('tap');
    const before = this.made;
    this.made = next(this.recipe, this.made, Math.random);
    if (this.made !== before) this.flat = 0; // a new lump of dough
    this.making.changed(this.made);
    this.enterStep();
  }

  private leaveOven(step: Step): void {
    if (this.step === step) this.goNext(false);
  }

  /** The plate is empty: crumbs and the bell, then a new lump of dough (ADR 0044). */
  private allGone(): void {
    this.busy = true;
    this.fingers.clear();
    this.ctx.sound.play('cheer');
    this.voice?.moment(this.recipe.sayGone ?? []);
    for (let i = 0; i < 26; i++) this.crumb({ x: (Math.random() - 0.5) * 300, y: (Math.random() - 0.5) * 300 }, 1.2);
    this.show();
    this.later(EMPTY_PLATE_MS, () => {
      this.busy = false;
      this.made = fresh(this.recipe);
      this.flat = 0;
      this.making.changed(this.made);
      this.enterStep();
    });
  }

  // ---- Fingers ----

  private isPalm(e: PointerEvent): boolean {
    return e.pointerType === 'touch' && Math.max(e.width, e.height) > PALM_CSS_PX;
  }

  /** A pointer's place in the thing's units. The frame may be scaled (ADR 0019), so this goes through the box. */
  private at(e: PointerEvent): Pt {
    const box = this.canvas.getBoundingClientRect();
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const x = ((e.clientX - box.left) / (box.width || 1)) * w, y = ((e.clientY - box.top) / (box.height || 1)) * h;
    return { x: (x - w / 2) / this.unit, y: (y - h / 2) / this.unit };
  }

  private down(e: PointerEvent): void {
    if (e.button > 0 || this.isPalm(e) || this.busy) return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events in tests may not be capturable; the touch still works.
    }
    const at = this.at(e);
    const finger: Finger = { at, acted: at, dropped: performance.now() };
    this.fingers.set(e.pointerId, finger);
    this.act(finger, at, true);
  }

  private move(e: PointerEvent): void {
    const finger = this.fingers.get(e.pointerId);
    if (!finger || this.busy) return;
    const at = this.at(e);
    finger.at = at;
    if (Math.hypot(at.x - finger.acted.x, at.y - finger.acted.y) >= gapOf(this.step)) this.act(finger, at, false);
  }

  private up(e: PointerEvent): void {
    if (!this.fingers.delete(e.pointerId)) return;
    if (!this.fingers.size) this.ctx.sound.scratch?.(0);
  }

  /** One finger does the open step's verb at `at`. `first` is the touch itself, not a move after it. */
  private act(finger: Finger, at: Pt, first: boolean): void {
    const step = this.step, sound = this.ctx.sound;
    finger.acted = at;
    finger.dropped = performance.now();
    if (step.verb === 'cook') {
      // A touch on the oven's window makes a bubble; nothing is changed.
      if (first && Math.abs(at.x) < 250 && at.y > -160 && at.y < 190) {
        this.bubbles = [...this.bubbles.filter((b) => this.time - b.at < 0.6), { x: at.x, y: at.y, at: this.time }];
        sound.effect?.(KITCHEN_SOUNDS.bubble);
      }
      return;
    }
    switch (touch(this.recipe, this.made, at, Math.random)) {
      case 'pressed':
        sound.effect?.(KITCHEN_SOUNDS.pat);
        this.fx.push({ kind: 'ring', x: at.x, y: at.y, age: 0, life: 0.3 });
        break;
      case 'spread':
        sound.scratch?.(0.6, SPREAD_RATE);
        clearTimeout(this.still);
        this.still = setTimeout(() => sound.scratch?.(0), STILL_MS);
        break;
      case 'poured':
        sound.effect?.(KITCHEN_SOUNDS.pour);
        break;
      case 'sprinkled': {
        for (const b of (this.made.bits[step.id] ?? []).slice(-3)) if (!this.born.has(b)) this.born.set(b, this.time);
        const now = performance.now();
        if (now - this.lastSprinkleSound >= SPRINKLE_SOUND_MS) {
          this.lastSprinkleSound = now;
          sound.effect?.(KITCHEN_SOUNDS.sprinkle);
        }
        break;
      }
      case 'placed': {
        const piece = this.made.placed[step.id]?.at(-1);
        if (piece) this.born.set(piece, this.time);
        sound.play('fill');
        break;
      }
      case 'off':
        // A topping dropped off the pizza bounces away (ADR 0044). Only a touch does it, not a drag past the edge.
        if (first) {
          sound.effect?.(KITCHEN_SOUNDS.miss);
          const far = Math.hypot(at.x, at.y) || 1;
          this.fx.push({
            kind: 'piece',
            piece: { kind: this.made.picked[step.id], x: at.x, y: at.y, rot: Math.random() * 360 },
            vx: (at.x / far) * 420,
            vy: (at.y / far) * 420,
            spin: 500,
            age: 0,
            life: 0.45,
          });
        }
        return;
      case 'bitten':
        sound.effect?.(KITCHEN_SOUNDS.munch);
        for (let i = 0; i < 5; i++) this.crumb(at, 0.6);
        this.changed();
        if (doneEnough(this.recipe, this.made, step)) this.allGone();
        return;
      case 'nothing':
        return;
    }
    this.changed();
  }

  private crumb(at: Pt, life: number): void {
    const turn = Math.random() * Math.PI * 2, speed = 60 + Math.random() * 160;
    this.fx.push({
      kind: 'crumb',
      x: at.x,
      y: at.y,
      vx: Math.cos(turn) * speed,
      vy: Math.sin(turn) * speed,
      r: 4 + Math.random() * 5,
      colour: CRUMB_COLOURS[Math.floor(Math.random() * CRUMB_COLOURS.length)],
      age: 0,
      life,
    });
  }

  // ---- Time ----

  /** What happens by itself: the oven bakes, and a finger held on the cheese step keeps dropping. */
  private tick(): void {
    const now = performance.now(), seconds = Math.min(0.25, (now - this.lastTick) / 1000);
    this.lastTick = now;
    const step = this.step;
    if (step.verb === 'cook' && (this.made.cooked[step.id] ?? 0) < 1) {
      if (cook(this.made, step, seconds)) {
        this.ctx.sound.play('cheer');
        if (step.sayDone) this.voice?.moment([step.sayDone]);
        this.later(OUT_OF_OVEN_MS, () => this.leaveOven(step));
      }
      this.changed();
    } else if (step.verb === 'sprinkle' && !this.busy) {
      for (const finger of this.fingers.values()) if (now - finger.dropped >= HOLD_DROP_MS) this.act(finger, finger.at, false);
    } else if (step.verb === 'pour' && !this.busy && this.fingers.size) {
      // A held finger keeps pouring, with a glug while it does.
      if (pour(this.made, step, seconds)) {
        this.ctx.sound.scratch?.(0.5, POUR_RATE);
        this.changed();
      } else {
        this.ctx.sound.scratch?.(0);
      }
    }
  }

  private draw(): void {
    if (this.stopped) return;
    this.frame = requestAnimationFrame(() => this.draw());
    const now = performance.now(), dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.time = (now - this.opened) / 1000;
    const target = this.pressedFlat();
    this.flat += (target - this.flat) * Math.min(1, dt * 14);
    if (Math.abs(target - this.flat) < 0.003) this.flat = target;

    const c = this.canvas.getContext('2d');
    if (!c || !this.canvas.width) return;
    const w = this.canvas.clientWidth || 826, h = this.canvas.clientHeight || 734;
    const k = (this.canvas.width / w) * this.unit;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(k, 0, 0, k, this.canvas.width / 2, this.canvas.height / 2);
    const view: View = {
      time: this.time,
      flat: this.flat,
      width: w / this.unit,
      height: h / this.unit,
      held: this.fingers.size > 0,
      pop: (thing) => this.pop(thing),
      bubbles: this.bubbles,
    };
    this.look.draw(c, this.recipe, this.made, view);
    this.drawFx(c, dt);
  }

  /** A bit or a piece grows in with a small bounce as it lands. */
  private pop(thing: object): number {
    const at = this.born.get(thing);
    if (at === undefined) return 1;
    const t = (this.time - at) / POP_S;
    return t >= 1 ? 1 : 0.5 + 0.5 * t + 0.3 * Math.sin(t * Math.PI);
  }

  private drawFx(c: CanvasRenderingContext2D, dt: number): void {
    this.fx = this.fx.filter((f) => (f.age += dt) < f.life);
    for (const f of this.fx) {
      const t = f.age / f.life;
      c.globalAlpha = 1 - t;
      if (f.kind === 'ring') {
        c.beginPath();
        c.arc(f.x, f.y, 26 + 44 * t, 0, Math.PI * 2);
        c.strokeStyle = '#23201c';
        c.lineWidth = 5;
        c.stroke();
      } else if (f.kind === 'piece') {
        f.piece.x += f.vx * dt;
        f.piece.y += f.vy * dt;
        f.piece.rot += f.spin * dt;
        drawPiece(c, f.piece, 0);
      } else {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        c.beginPath();
        c.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        c.fillStyle = f.colour;
        c.fill();
        c.strokeStyle = '#23201c';
        c.lineWidth = 2.5;
        c.stroke();
      }
    }
    c.globalAlpha = 1;
  }
}
