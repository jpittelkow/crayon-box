// The colour wheel (ADR 0038 part 5, decisions C6 and C7): a ring of 12 big segments of in-between hues, under the
// colour rail where the screen leaves the room, with the current colour in the middle. Tap only, no dragging: a
// segment picks its colour on touch-down, like a swatch. Shown only when it fits without the page or anything else
// getting smaller (ADR 0019); the session decides that with `wheelFits`.
import { el, onPress, setPicked } from '../../ui/kid';
import type { WheelColor } from '../../ui/palette';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The ring's radii, in CSS pixels (the SVG is drawn 1:1). Every segment holds a 64 px circle, the swatches' size
 * (ADR 0019): a circle of radius 32 centred 124 px out fits between the radii and inside a 30° slice
 * (124 × sin 15° ≈ 32.1).
 */
export const WHEEL_OUTER = 156;
export const WHEEL_INNER = 90;
/** Where in a segment its 64 px tap circle is centred, from the middle of the wheel. */
export const WHEEL_TAP_RADIUS = 124;
/** The wheel's drawn size: the ring plus room for the picked segment's ring. */
export const WHEEL_PX = 332;
/** The current colour's disc in the middle. */
const MIDDLE_PX = 132;

/** The colours column: its panel's padding, the gap between the swatches and the wheel, and room kept to the edges. */
export const SIDE_PADDING = 14;
export const WHEEL_GAP = 20;
export const EDGE_ROOM = 24;

export interface WheelRoom {
  /** The centre column's width (page and tray) with the colours column at its width without the wheel. */
  centreWithout: number;
  /** The colours column's width without the wheel, and with it. */
  sideWithout: number;
  sideWith: number;
  /** The widest the 4:3 page could be from its height alone (it is limited by height on wide screens). */
  pageByHeight: number;
  /** The page's outline, left plus right: the page frame is this much wider than the page. */
  pageChrome: number;
  /** The colours column's height, and the swatch grid's. */
  sideHeight: number;
  swatchesHeight: number;
}

/**
 * Whether the wheel fits: the page keeps the width it has without the wheel, and the column has the height for the
 * swatches, the gap and the wheel, with room left to the screen's top and bottom edges, where wrists rest.
 */
export function wheelFits(r: WheelRoom): boolean {
  const centreWith = r.centreWithout - (r.sideWith - r.sideWithout);
  const pageWithout = Math.min(r.centreWithout - r.pageChrome, r.pageByHeight);
  const pageWith = Math.min(centreWith - r.pageChrome, r.pageByHeight);
  const height = r.swatchesHeight + WHEEL_GAP + WHEEL_PX + 2 * SIDE_PADDING + 2 * EDGE_ROOM;
  return pageWith >= pageWithout && r.sideHeight >= height;
}

/** The SVG path of segment `i` of 12, clockwise from the top. */
export function segmentPath(i: number, outer = WHEEL_OUTER, inner = WHEEL_INNER): string {
  const a0 = (i / 12) * 2 * Math.PI - Math.PI / 2;
  const a1 = ((i + 1) / 12) * 2 * Math.PI - Math.PI / 2;
  const p = (rad: number, a: number) => `${(rad * Math.cos(a)).toFixed(2)} ${(rad * Math.sin(a)).toFixed(2)}`;
  return (
    `M${p(inner, a0)}L${p(outer, a0)}A${outer} ${outer} 0 0 1 ${p(outer, a1)}` +
    `L${p(inner, a1)}A${inner} ${inner} 0 0 0 ${p(inner, a0)}Z`
  );
}

/** The middle of segment `i`'s tap circle, from the middle of the wheel. */
export function segmentCentre(i: number): { x: number; y: number } {
  const a = ((i + 0.5) / 12) * 2 * Math.PI - Math.PI / 2;
  return { x: WHEEL_TAP_RADIUS * Math.cos(a), y: WHEEL_TAP_RADIUS * Math.sin(a) };
}

export class ColorWheel {
  readonly el: HTMLElement;
  private readonly segments = new Map<string, SVGPathElement>();
  private readonly ring: SVGPathElement;
  private readonly ringInner: SVGPathElement;

  constructor(colors: readonly WheelColor[], onPick: (color: WheelColor) => void) {
    this.el = el('div', 'color-wheel', { role: 'group', 'aria-label': 'Colour wheel' });
    const svg = document.createElementNS(SVG_NS, 'svg');
    const half = WHEEL_PX / 2;
    svg.setAttribute('width', String(WHEEL_PX));
    svg.setAttribute('height', String(WHEEL_PX));
    svg.setAttribute('viewBox', `${-half} ${-half} ${WHEEL_PX} ${WHEEL_PX}`);
    colors.forEach((color, i) => {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', segmentPath(i));
      path.setAttribute('class', 'wheel-segment');
      path.setAttribute('fill', color.value);
      // Never text on screen (ADR 0003 rule 1); the name is for tests and tools.
      path.setAttribute('role', 'button');
      path.setAttribute('aria-label', color.label);
      path.dataset.color = `wheel-${color.token}`;
      path.dataset.index = String(i);
      onPress(path, () => onPick(color));
      this.segments.set(color.value, path);
      svg.append(path);
    });
    // The picked segment's ring: drawn over the segments so its neighbours don't cover it, and never takes a touch.
    this.ring = document.createElementNS(SVG_NS, 'path');
    this.ring.setAttribute('class', 'wheel-ring');
    this.ringInner = document.createElementNS(SVG_NS, 'path');
    this.ringInner.setAttribute('class', 'wheel-ring-inner');
    svg.append(this.ring, this.ringInner);
    const middle = el('div', 'wheel-middle', { 'aria-hidden': 'true' });
    middle.style.width = middle.style.height = `${MIDDLE_PX}px`;
    this.el.append(svg, middle);
  }

  /** Rings the segment of `value`, or none when the colour is from the rail. */
  pick(value: string): void {
    const picked = this.segments.get(value);
    setPicked(this.segments.values(), picked);
    for (const ring of [this.ring, this.ringInner]) {
      if (picked) ring.setAttribute('d', picked.getAttribute('d')!);
      else ring.removeAttribute('d');
    }
  }
}
