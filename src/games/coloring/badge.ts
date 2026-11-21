// The tool at the finger (ADR 0038 part 2): while a finger is on the page, a small badge follows it, the current
// tool's icon on a dot of the current color, a little above and to the side so the finger doesn't hide it. The
// bucket's badge pours; the brush's dot grows with the brush size; the eraser's dot is white. It never takes a touch.
import { icons } from '../../ui/icons';
import { el } from '../../ui/kid';
import { RAINBOW } from '../../ui/palette';
import { PALM_CSS_PX, type Tool } from './engine/engine';

/** The badge's diameter for the small, medium and big brush (and eraser); the bucket's is the medium one. */
export const BADGE_PX = [68, 80, 94] as const;

/** Where the badge's centre sits from the finger, in screen pixels: up, and to the right unless that leaves the screen. */
const OFFSET_X = 56;
const OFFSET_Y = 70;

const ICONS: Record<Tool, () => string> = {
  bucket: () => icons.bucket(32),
  brush: () => icons.brush(32),
  eraser: () => icons.eraser(32),
};

export class ToolBadge {
  readonly el: HTMLElement;
  private readonly icon: HTMLElement;
  private finger: number | null = null;
  private tool: Tool | null = null;
  private diameter: number = BADGE_PX[1];
  private readonly off: (() => void)[] = [];

  /**
   * `screen` is the positioned element the badge is placed in (the coloring screen); `page` the element a finger
   * touches to draw (the engine's root).
   */
  constructor(
    private readonly screen: HTMLElement,
    page: HTMLElement,
  ) {
    this.el = el('div', 'tool-badge', { 'aria-hidden': 'true' });
    this.el.hidden = true;
    this.icon = el('span', 'tool-badge-icon');
    this.el.append(this.icon);

    const listen = <K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      target.addEventListener(type, fn);
      this.off.push(() => target.removeEventListener(type, fn));
    };
    listen(page, 'pointerdown', (e) => {
      // The first finger on the page; a palm or a second finger doesn't move it (the engine ignores palms too).
      if (this.finger !== null || e.button > 0 || (e.pointerType === 'touch' && Math.max(e.width, e.height) > PALM_CSS_PX)) return;
      this.finger = e.pointerId;
      this.moveTo(e);
      this.el.hidden = false;
    });
    // Moves and lifts bubble up to the screen wherever the finger has gone (touches stay with the page they started on).
    listen(screen, 'pointermove', (e) => {
      if (e.pointerId === this.finger) this.moveTo(e);
    });
    const lift = (e: PointerEvent) => {
      if (e.pointerId !== this.finger) return;
      this.finger = null;
      this.el.hidden = true;
    };
    listen(screen, 'pointerup', lift);
    listen(screen, 'pointercancel', lift);
  }

  /** Shows what a touch on the page will do next. Called whenever the tool, size or color changes. */
  show(tool: Tool, sizeIndex: number, color: string): void {
    this.el.dataset.tool = tool;
    this.el.dataset.color = color;
    if (tool !== this.tool) {
      this.icon.innerHTML = ICONS[tool]();
      this.tool = tool;
    }
    this.diameter = tool === 'bucket' ? BADGE_PX[1] : (BADGE_PX[sizeIndex] ?? BADGE_PX[1]);
    this.el.style.setProperty('--badge-size', `${this.diameter}px`);
    this.el.style.setProperty(
      '--badge-dot',
      tool === 'eraser' ? 'var(--paper)' : color === RAINBOW ? 'var(--crayon-rainbow)' : color,
    );
  }

  private moveTo(e: PointerEvent): void {
    // The screen may be scaled down to fit a small window (ADR 0019): work in its own, unscaled pixels.
    const r = this.screen.getBoundingClientRect();
    const scale = r.width / (this.screen.offsetWidth || r.width || 1);
    const x = (e.clientX - r.left) / scale;
    const y = (e.clientY - r.top) / scale;
    const half = this.diameter / 2 + 4;
    const w = this.screen.offsetWidth;
    // To the right of the finger; to the left near the right edge. Above it; below it near the top.
    const cx = x + OFFSET_X + half > w ? x - OFFSET_X : x + OFFSET_X;
    const cy = y - OFFSET_Y - half < 0 ? y + OFFSET_Y : y - OFFSET_Y;
    this.el.style.left = `${Math.round(cx)}px`;
    this.el.style.top = `${Math.round(cy)}px`;
  }

  destroy(): void {
    for (const off of this.off.splice(0)) off();
  }
}
