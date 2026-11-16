// The show-how on the page (ADR 0038 part 3): the tool's badge does the thing on its own in a corner of the page,
// while the narrator says what it does. It is drawn over the page, never on it, so the kid's picture can't change;
// it never takes a touch, and any new touch anywhere stops it at once (ADR 0003: nothing locks the screen). When a
// demo is due is decided in showHow.ts.
import { narratorClip } from '../../shell/soundFiles';
import type { Sound } from '../../shell/types';
import { icons } from '../../ui/icons';
import { el } from '../../ui/kid';
import { RAINBOW, RAINBOW_STOPS } from '../../ui/palette';
import { TOOL_BUTTONS, type Narrator } from './buttons';
import type { Tool } from './engine/engine';
import { DEMO_SEEN_AFTER_MS, DEMO_TOOLS, type Demo } from './showHow';

/** The "what it does" lines (made with the button names, tools/sounds/generate.mjs). */
const DOES: Record<Tool | Action, string | undefined> = {
  bucket: narratorClip('do-bucket'),
  brush: narratorClip('do-brush'),
  eraser: narratorClip('do-eraser'),
  undo: narratorClip('do-undo'),
  'start-over': narratorClip('do-start-over'),
};
const NAMES: Record<Action, string | undefined> = {
  undo: narratorClip('tool-undo'),
  'start-over': narratorClip('tool-start-over'),
};

type Action = 'undo' | 'start-over';

/** How long one tool's demo runs; "Show the buttons" plays them slower, for a parent and kid to watch together. */
export const DEMO_MS = 2800;
export const SLOW_DEMO_MS = 4200;

/** The longest wait for the narrator to finish a line before the demo goes on without it. */
const QUIET_CAP_MS = 3000;

/** The drawing is 230 by 170 units, in the page's bottom-right corner. */
const W = 230;
const H = 170;

/** The brush's squiggle and the line the eraser rubs out, as points across the corner. */
const SQUIGGLE = Array.from({ length: 41 }, (_, i) => {
  const q = i / 40;
  return [30 + 170 * q, 100 - 38 * Math.sin(q * Math.PI * 3)] as const;
});
const ZIGZAG = [
  [32, 120],
  [62, 78],
  [92, 128],
  [122, 78],
  [152, 128],
  [182, 78],
  [202, 104],
] as const;
const CLOUD = 'M52 124 a24 24 0 0 1 40 -22 a30 30 0 0 1 56 6 a22 22 0 0 1 10 40 h-96 a22 22 0 0 1 -10 -24z';

/** Brush widths in drawing units, small to big. */
const STROKE = [8, 13, 19];

type Pts = readonly (readonly [number, number])[];
const polyline = (pts: Pts) => pts.map(([x, y]) => `${x},${y}`).join(' ');

/** The point `k` (0 to 1) of the way along a polyline. */
function along(pts: Pts, k: number): [number, number] {
  const lengths = pts.slice(1).map(([x, y], i) => Math.hypot(x - pts[i]![0], y - pts[i]![1]));
  let left = Math.max(0, Math.min(1, k)) * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i]!;
    if (left <= len || i === lengths.length - 1) {
      const t = len === 0 ? 0 : Math.min(1, left / len);
      const [x0, y0] = pts[i]!;
      const [x1, y1] = pts[i + 1]!;
      return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
    }
    left -= len;
  }
  return [pts[0]![0], pts[0]![1]];
}

const ease = (k: number) => 0.5 - Math.cos(Math.min(1, Math.max(0, k)) * Math.PI) / 2;

export interface DemoHost {
  /** The coloring screen: any touch on it stops a demo. */
  screen: HTMLElement;
  /** The page's frame, which the demo is drawn over. */
  frame: HTMLElement;
  /** The element fingers draw on: a demo doesn't start while a finger is on it. */
  page: HTMLElement;
  narrator: Narrator;
  sound: Sound;
  /** The current color and brush size index, which the demo paints with. */
  look(): { color: string; sizeIndex: number };
  /** The rail button a step points at while it plays. */
  button(step: Tool | Action): HTMLElement | undefined;
  /** A demo has started (for the one-a-minute rule). */
  onStart(demo: Demo): void;
  /** A demo ran long enough to count as seen. */
  onSeen(demo: Demo): void;
}

export class ShowHow {
  /** The drawing over the page's corner. */
  readonly el: HTMLElement;
  private readonly art: SVGSVGElement;
  private readonly badge: HTMLElement;
  private readonly badgeIcon: HTMLElement;
  /** Bumped by every stop: a demo still running from before sees it changed and ends. */
  private run = 0;
  private raf = 0;
  private showing: HTMLElement | undefined;
  private readonly onPage = new Set<number>();
  private readonly off: (() => void)[] = [];

  constructor(private readonly host: DemoHost) {
    this.el = el('div', 'show-how', { 'aria-hidden': 'true' });
    this.el.hidden = true;
    this.art = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.art.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this.badge = el('div', 'show-how-badge');
    this.badgeIcon = el('span', 'tool-badge-icon');
    this.badge.append(this.badgeIcon);
    this.el.append(this.art, this.badge);
    host.frame.append(this.el);

    // Captured on the way down, so a touch stops the demo before the button or page under it acts on it.
    const down = (e: PointerEvent) => {
      if (host.page.contains(e.target as Node)) this.onPage.add(e.pointerId);
      this.stop();
    };
    const up = (e: PointerEvent) => void this.onPage.delete(e.pointerId);
    host.screen.addEventListener('pointerdown', down, true);
    host.screen.addEventListener('pointerup', up, true);
    host.screen.addEventListener('pointercancel', up, true);
    this.off.push(
      () => host.screen.removeEventListener('pointerdown', down, true),
      () => host.screen.removeEventListener('pointerup', up, true),
      () => host.screen.removeEventListener('pointercancel', up, true),
    );
  }

  /**
   * Plays `demo` after `delayMs` and once the narrator has finished (a tool's name is said first). It doesn't start
   * while a finger is on the page; a touch before it starts cancels it.
   */
  play(demo: Demo, delayMs: number): void {
    this.stop();
    const run = this.run;
    this.el.dataset.state = 'waiting';
    void (async () => {
      await wait(delayMs);
      await this.quiet();
      if (run !== this.run) return;
      if (this.onPage.size > 0) return this.end(run);
      this.host.onStart(demo);
      setTimeout(() => {
        if (run === this.run) this.host.onSeen(demo);
      }, DEMO_SEEN_AFTER_MS);
      if (demo.kind === 'tool') await this.tool(demo.tool, DEMO_MS, run);
      else await this.tour(run);
      this.end(run);
    })();
  }

  /** Stops a demo at once: nothing of it stays on screen. */
  stop(): void {
    this.run++;
    cancelAnimationFrame(this.raf);
    if (this.el.dataset.state === 'playing') this.host.narrator.stop();
    this.clear();
  }

  destroy(): void {
    this.stop();
    for (const off of this.off.splice(0)) off();
    this.el.remove();
  }

  private end(run: number): void {
    if (run === this.run) this.clear();
  }

  private clear(): void {
    this.el.hidden = true;
    delete this.el.dataset.state;
    delete this.el.dataset.demo;
    this.point(undefined);
  }

  private quiet(): Promise<void> {
    return Promise.race([this.host.narrator.quiet(), wait(QUIET_CAP_MS)]);
  }

  /** Rings the rail button the demo is about. */
  private point(b: HTMLElement | undefined): void {
    this.showing?.classList.remove('is-showing');
    this.showing = b;
    b?.classList.add('is-showing');
  }

  /** "Show the buttons": each tool's demo in turn, slowly, each named first; then undo and start over, pointed at. */
  private async tour(run: number): Promise<void> {
    const n = this.host.narrator;
    for (const tool of DEMO_TOOLS) {
      this.el.dataset.state = 'playing';
      this.point(this.host.button(tool));
      const name = TOOL_BUTTONS[tool].clip;
      if (name) n.say(name);
      await Promise.all([this.quiet(), wait(900)]);
      if (run !== this.run) return;
      if (!(await this.tool(tool, SLOW_DEMO_MS, run))) return;
      await wait(700);
      if (run !== this.run) return;
    }
    for (const action of ['undo', 'start-over'] as const) {
      this.el.dataset.state = 'playing';
      this.el.dataset.demo = action;
      this.point(this.host.button(action));
      for (const clip of [NAMES[action], DOES[action]]) {
        if (clip) n.say(clip);
        await Promise.all([this.quiet(), wait(900)]);
        if (run !== this.run) return;
      }
      this.point(undefined);
      await wait(500);
      if (run !== this.run) return;
    }
  }

  /** One tool's demo. Resolves true when it played to the end, false when it was stopped. */
  private tool(tool: Tool, ms: number, run: number): Promise<boolean> {
    const { color, sizeIndex } = this.host.look();
    const paint = color === RAINBOW ? 'url(#show-how-rainbow)' : color;
    this.el.dataset.state = 'playing';
    this.el.dataset.demo = tool;
    this.el.hidden = false;
    this.el.style.opacity = '1';
    this.badge.dataset.tool = tool;
    this.badgeIcon.innerHTML = { bucket: icons.bucket, brush: icons.brush, eraser: icons.eraser }[tool](32);
    this.badge.style.setProperty(
      '--badge-dot',
      tool === 'eraser' ? 'var(--paper)' : color === RAINBOW ? 'var(--crayon-rainbow)' : color,
    );
    this.point(this.host.button(tool));
    const does = DOES[tool];
    if (does) this.host.narrator.say(does);

    const defs = `<defs><linearGradient id="show-how-rainbow">${RAINBOW_STOPS.map(
      (c, i) => `<stop offset="${i / (RAINBOW_STOPS.length - 1)}" stop-color="${c}"/>`,
    ).join('')}</linearGradient></defs>`;
    const width = STROKE[sizeIndex] ?? STROKE[1]!;
    let filled = false;

    return new Promise((resolve) => {
      const t0 = performance.now();
      const frame = (now: number) => {
        if (run !== this.run) return resolve(false);
        const k = Math.min(1, (now - t0) / ms);
        let body: string;
        let at: [number, number];
        if (tool === 'bucket') {
          // The badge comes over the cloud, pours, and the cloud fills with the color.
          const fill = k >= 0.42;
          if (fill && !filled) {
            filled = true;
            this.host.sound.play('fill');
          }
          body = `<path d="${CLOUD}" fill="${fill ? paint : 'var(--paper)'}" stroke="var(--ink)" stroke-width="6" stroke-linejoin="round"/>`;
          const m = ease(k / 0.35);
          at = [56 + 54 * m, 40 + 34 * m];
        } else if (tool === 'brush') {
          // The badge draws a squiggle behind it.
          const d = ease(k / 0.8);
          body = `<polyline points="${polyline(SQUIGGLE)}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${1 - d}" fill="none" stroke="${paint}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
          at = along(SQUIGGLE, d);
        } else {
          // A zigzag of the color, there for a moment, then rubbed out by the eraser as it goes over it.
          const d = ease((k - 0.15) / 0.7);
          body =
            `<polyline points="${polyline(ZIGZAG)}" fill="none" stroke="${paint}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>` +
            `<polyline points="${polyline(ZIGZAG)}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${1 - d}" fill="none" stroke="var(--paper)" stroke-width="${Math.max(24, width + 12)}" stroke-linecap="round" stroke-linejoin="round"/>`;
          at = along(ZIGZAG, d);
        }
        this.art.innerHTML = defs + body;
        // The badge sits just above and to the side of where the tool acts, as it does at a kid's finger.
        this.badge.style.left = `${((at[0] + 16) / W) * 100}%`;
        this.badge.style.top = `${((at[1] - 30) / H) * 100}%`;
        this.el.style.opacity = k > 0.86 ? String(Math.max(0, (1 - k) / 0.14)) : '1';
        if (k < 1) this.raf = requestAnimationFrame(frame);
        else {
          this.el.hidden = true;
          this.point(undefined);
          resolve(true);
        }
      };
      this.raf = requestAnimationFrame(frame);
    });
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
