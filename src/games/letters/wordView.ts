// What a word looks like on screen (ADR 0039): its picture (until part 2's pictures, the word's letters drawn, or
// the kid's own badge and photo for their name), the row of boxes with the kid's own crayon line in each finished
// one, a traced letter dropping into its box, and the boxes lighting up as the slow word is said.
import { drawAvatar } from '../../shell/profiles';
import type { KidProfile } from '../../shell/types';
import { el } from '../../ui/kid';
import { glyph, pathData } from './glyphs';
import type { Cell } from './words';

export const INK = '#23201c';
/** The tracing view: the 100 x 140 glyph box with room round it for the arrows. A box shows the kid's line in it too. */
export const VIEW = '-16 -8 132 156';

/** A glyph drawn in ink, for tiles, path stops and a word's letters. */
export function glyphMarkup(ch: string, width = 13): string {
  const paths = glyph(ch).strokes.map((s) => `<path d="${pathData(s)}"/>`).join('');
  return (
    `<svg viewBox="-10 -5 120 150" width="100%" height="100%" fill="none" stroke="${INK}" stroke-width="${width}" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
  );
}

/** A word's letters in a row, drawn in ink: a built-in word's tile and its picture until part 2 adds pictures. */
export function wordLettersMarkup(letters: readonly string[], width = 14): string {
  return (
    `<span class="words-letters" aria-hidden="true" style="--n: ${letters.length}">` +
    letters.map((ch) => `<span>${glyphMarkup(ch, width)}</span>`).join('') +
    '</span>'
  );
}

/** The kid's badge: their photo ringed in their colour, or their symbol on it (ADR 0018). */
export function avatarEl(kid: KidProfile, photoUrl: string | undefined, iconSize: number): HTMLElement {
  const badge = el('span', 'words-avatar', { 'aria-hidden': 'true' });
  drawAvatar(badge, kid, photoUrl, iconSize);
  return badge;
}

/** The kid's own line from the trace screen, as markup for a box: thicker so it reads at the small size. */
export function inkForBox(markup: string): string {
  return markup.replace(/\sstroke-width="[^"]*"/g, '');
}

function boxInk(markup: string, color: string): string {
  return (
    `<svg viewBox="${VIEW}" width="100%" height="100%" fill="none" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true"><g stroke-width="13" style="stroke: ${color}">${markup}</g></svg>`
  );
}

export interface BoxRow {
  row: HTMLElement;
  /** The letters' boxes in order, gaps left out. */
  boxes: HTMLElement[];
  /** Puts the kid's line into box `i`. */
  fill(i: number, markup: string): void;
}

/**
 * The row of boxes: one per letter, a gap for a space or hyphen. Boxes `inks` already has are filled with the kid's
 * line; box `at` pulses. A filled box is tapped to hear its letter.
 */
export function boxRow(
  cells: readonly Cell[],
  inks: readonly string[],
  at: number,
  color: string,
  name: (ch: string) => string,
  onTapBox: (ch: string) => void,
): BoxRow {
  const row = el('div', 'words-boxes', { role: 'group', 'aria-label': 'Word' });
  const boxes: HTMLElement[] = [];
  for (const cell of cells) {
    if ('gap' in cell) {
      row.append(el('span', 'words-gap', { 'aria-hidden': 'true' }));
      continue;
    }
    const i = boxes.length;
    const box = el('span', 'words-box', { 'data-box': String(i), 'aria-label': `Box ${i + 1}, empty`, role: 'img' });
    box.dataset.letter = cell.ch;
    if (i === at) box.classList.add('is-now');
    box.addEventListener('pointerup', () => {
      if (box.classList.contains('is-filled')) onTapBox(cell.ch);
    });
    boxes.push(box);
    row.append(box);
  }
  const fill = (i: number, markup: string) => {
    const box = boxes[i];
    if (!box) return;
    box.innerHTML = boxInk(inkForBox(markup), color);
    box.classList.remove('is-now');
    box.classList.add('is-filled');
    box.setAttribute('role', 'button');
    box.setAttribute('aria-label', `${name(box.dataset.letter!)}, written`);
  };
  inks.forEach((m, i) => fill(i, m));
  return { row, boxes, fill };
}

/**
 * The kid's line flies from the letter into its box, shrinking on the way (ADR 0039); resolves once it has landed.
 * With less motion it lands at once.
 */
export function dropInto(screen: HTMLElement, from: Element, markup: string, color: string, box: HTMLElement, still: boolean): Promise<void> {
  if (still) return Promise.resolve();
  const base = screen.getBoundingClientRect();
  const a = from.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  if (a.width === 0 || b.width === 0) return Promise.resolve();
  const fly = el('div', 'words-fly', { 'aria-hidden': 'true' });
  fly.innerHTML =
    `<svg viewBox="${VIEW}" width="100%" height="100%" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<g style="stroke: ${color}">${markup}</g></svg>`;
  Object.assign(fly.style, {
    left: `${a.left - base.left}px`,
    top: `${a.top - base.top}px`,
    width: `${a.width}px`,
    height: `${a.height}px`,
  });
  screen.append(fly);
  const to = `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width}, ${b.height / a.height})`;
  const anim = fly.animate([{ transform: 'none' }, { transform: to }], { duration: 550, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
  return new Promise((resolve) => {
    const done = () => {
      fly.remove();
      resolve();
    };
    anim.addEventListener('finish', done, { once: true });
    anim.addEventListener('cancel', done, { once: true });
    // Never wait forever on a hidden page (animations can be paused there).
    setTimeout(done, 900);
  });
}

/** Lights box `i` (and only it); -1 lights none, `all` lights every box. */
export function light(boxes: readonly HTMLElement[], i: number | 'all'): void {
  boxes.forEach((b, j) => b.classList.toggle('is-lit', i === 'all' || i === j));
}
