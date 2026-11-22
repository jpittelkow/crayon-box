// Kid icons from the Crayon Box kit (ADR 0016): original, CC0 (ADR 0011). Drawn on a 48 grid, ink stroke,
// round joins, flat fills. Parts drawn in "the current color" use `var(--current-paint)`.

const INK = '#23201c';

function svg(body: string, size: number, opts: { stroke?: number; fill?: string } = {}): string {
  const stroke = opts.stroke ?? 4;
  const fill = opts.fill ?? 'none';
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="${fill}" stroke="${INK}" ` +
    `stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
  );
}

const CURRENT = 'style="fill: var(--current-paint)"';

export const icons = {
  back: (size = 58) => svg('<path d="M21 9L7 24l14 15"/><path d="M8 24h33"/>', size, { stroke: 6 }),
  /**
   * Undo, as the plan's "backwards scribble being wiped off" (ADR 0038 part 6): a scribble in the current color whose
   * end has gone dotted, with a short arrow running back along it. Checked by eye; a kid playtest comes later.
   */
  undo: (size = 50) =>
    svg(
      '<path d="M4 34c3-11 7-11 9.5 0s6.5 11 9.5 0" stroke-width="8.5"/>' +
        '<path d="M4 34c3-11 7-11 9.5 0s6.5 11 9.5 0" stroke-width="4.5" style="stroke: var(--current-paint)"/>' +
        '<path d="M23 34c2.5-11 6.5-11 9.5 0s6.5 11 9.5 0" stroke-width="3.5" stroke-dasharray="0.1 6.5" stroke-dashoffset="-6.6"/>' +
        '<path d="M41 11H13"/><path d="M20 4l-7 7 7 7"/>',
      size,
      { stroke: 5 },
    ),
  startOver: (size = 50) =>
    svg(
      '<path d="M11 5h19l8 8v30H11z" fill="#ffffff"/><path d="M30 5v8h8"/>' +
        '<path d="M29.5 27a6 6 0 1 1-1.8-4.3"/><path d="M29 18v5h-5"/>',
      size,
    ),
  /** A real pail with a handle, tipped to pour the current color into a puddle (ADR 0038 part 6). */
  bucket: (size = 50) =>
    svg(
      '<g transform="rotate(28 20 24)" stroke-width="3.5">' +
        '<path d="M5 15c0-16 28-16 28 0" stroke-width="3"/>' +
        '<path d="M6 14h26l-4 27H10z" fill="#ffffff"/>' +
        `<ellipse cx="19" cy="14" rx="13" ry="4.5" ${CURRENT}/>` +
        '</g>' +
        '<path d="M36 22c3 5 4 10 4 15" stroke-width="8"/>' +
        '<path d="M36 22c3 5 4 10 4 15" stroke-width="3.5" style="stroke: var(--current-paint)"/>' +
        `<ellipse cx="38.5" cy="42" rx="7.5" ry="3" stroke-width="3.5" ${CURRENT}/>`,
      size,
    ),
  /** A real paintbrush: wooden handle, metal band, bristles dipped in the current color (ADR 0038 part 6). */
  brush: (size = 50) =>
    svg(
      '<g transform="rotate(40 24 24)" stroke-width="3.5">' +
        '<rect x="20" y="0" width="8" height="21" rx="4" fill="#c98f5a"/>' +
        '<rect x="17" y="20" width="14" height="9" rx="1.5" fill="#d4d8dc"/>' +
        `<path d="M17 29h14v4c0 7-3.5 11-7 14-3.5-3-7-7-7-14z" ${CURRENT}/>` +
        '</g>',
      size,
    ),
  eraser: (size = 50) =>
    svg('<path d="M6 30L26 10l16 16-16 16H18z" fill="#ffb3c7"/><path d="M16 20l16 16"/><path d="M18 42h24"/>', size),
  free: (size = 48) =>
    svg(
      '<rect x="9" y="9" width="30" height="30" rx="7" fill="#ffffff"/>' +
        '<path d="M4 31l8-15 7 17 8-19 7 17 10-13" style="stroke: var(--current-paint)" stroke-width="6"/>',
      size,
    ),
  lines: (size = 48) => svg(`<rect x="9" y="9" width="30" height="30" rx="7" ${CURRENT}/>`, size),
  gallery: (size = 60) =>
    svg(
      '<rect x="5" y="8" width="38" height="32" rx="4" fill="#ffffff"/><circle cx="16" cy="19" r="4" fill="#ffd23f"/>' +
        '<path d="M6 35l10-9 8 6 7-7 11 10"/>',
      size,
    ),
  /** A blank sheet with a green plus: start a new picture (ADR 0017). */
  newPicture: (size = 140) =>
    svg(
      '<path d="M11 5h19l8 8v30H11z" fill="#ffffff"/><path d="M30 5v8h8"/>' +
        '<path d="M24.5 20v15M17 27.5h15" stroke-width="5" style="stroke: #2fa35f"/>',
      size,
    ),
  more: (size = 96) => svg('<path d="M17 7l17 17-17 17"/>', size, { stroke: 5 }),
  /** The other way from more: back a page. */
  less: (size = 96) => svg('<path d="M31 7L14 24l17 17"/>', size, { stroke: 5 }),
  /** A check mark: "I'm done" (letters, ADR 0028). */
  check: (size = 96) => svg('<path d="M9 25l10 10L39 13"/>', size, { stroke: 6 }),
  /** An arrow to the right: on to the next step (Kitchen, ADR 0044). The back arrow, the other way. */
  next: (size = 58) => svg('<path d="M27 9l14 15-14 15"/><path d="M40 24H7"/>', size, { stroke: 6 }),
  /** A squeeze-bulb horn, not a speaker, so it never reads as a sound setting. */
  horn: (size = 58) =>
    svg(
      '<circle cx="12" cy="24" r="8" fill="#ff6b9d"/><path d="M20 21h5l17-10v26L25 27h-5z" fill="#ffd23f"/>',
      size,
    ),
} as const;

/** Kid profile symbols, drawn in paper with an ink outline on the kid's color. */
export const symbols: Record<string, string> = {
  star: '<path d="M24 5l5.6 12 13 1.5-9.7 8.8 2.7 12.9L24 33.6l-11.6 6.6 2.7-12.9-9.7-8.8 13-1.5z"/>',
  heart: '<path d="M24 41S6 30 6 17a9 9 0 0 1 18-2 9 9 0 0 1 18 2c0 13-18 24-18 24z"/>',
  moon: '<path d="M30 6a18 18 0 1 0 12 24A14 14 0 0 1 30 6z"/>',
  flower:
    '<circle cx="24" cy="11" r="7"/><circle cx="36" cy="20" r="7"/><circle cx="32" cy="34" r="7"/>' +
    '<circle cx="16" cy="34" r="7"/><circle cx="12" cy="20" r="7"/><circle cx="24" cy="24" r="6" fill="#ffd23f"/>',
  sun: '<circle cx="24" cy="24" r="10"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M38 10l-4 4M14 34l-4 4"/>',
  leaf: '<path d="M8 40C8 20 20 8 40 8c0 20-12 32-32 32z"/><path d="M8 40L28 20"/>',
};

export function symbolIcon(symbol: string, size: number): string {
  return svg(symbols[symbol] ?? symbols.star, size, { stroke: 3, fill: '#ffffff' });
}

/** Theme icons from the Crayon Box kit (original, CC0), keyed by the `icon` name in a theme.json (ADR 0005). */
const THEME_ICONS: Record<string, string> = {
  'race cars': '<path d="M5 31v-7l6-1 5-8h14l6 8 6 1v7z"/><circle cx="14" cy="32" r="5"/><circle cx="34" cy="32" r="5"/>',
  'farm and pets':
    '<ellipse cx="24" cy="31" rx="10" ry="8"/><circle cx="11" cy="20" r="4"/><circle cx="19" cy="12" r="4"/>' +
    '<circle cx="29" cy="12" r="4"/><circle cx="37" cy="20" r="4"/>',
  'wild animals':
    '<circle cx="24" cy="24" r="18" fill="#ff8a1f"/><circle cx="24" cy="25" r="10"/><path d="M20 23v.01M28 23v.01"/>',
  dinosaurs:
    '<path d="M4 25c4 1 7 0 9-2"/><path d="M13 33v8M31 33v8"/><path d="M8 33c0-8 6-13 14-13 4 0 7 1 9 3V11a5 5 0 0 1 5-5h3a5 5 0 0 1 0 10h-3v17z"/>' +
    '<path d="M37 10v.01"/>',
  'under the sea': '<path d="M6 24c6-10 22-10 28 0-6 10-22 10-28 0z"/><path d="M34 24l9-7v14z"/><path d="M14 22v.01"/>',
  'things that go':
    '<rect x="4" y="15" width="24" height="19" rx="2"/><path d="M28 21h9l7 7v6H28z"/><circle cx="13" cy="36" r="5"/>' +
    '<circle cx="35" cy="36" r="5"/>',
  'yummy food':
    '<path d="M24 15c-8-6-17 0-17 11 0 9 7 17 12 17 2 0 3-1 5-1s3 1 5 1c5 0 12-8 12-17 0-11-9-17-17-11z"/>' +
    '<path d="M24 15c0-4 2-7 5-9"/>',
  outside: '<rect x="21" y="29" width="6" height="15"/><circle cx="24" cy="18" r="13"/>',
  shapes: '<rect x="5" y="24" width="18" height="18" rx="2"/><circle cx="34" cy="33" r="9"/><path d="M24 4l10 16H14z"/>',
  'our pages':
    '<rect x="6" y="8" width="36" height="32" rx="4"/>' +
    '<path d="M24 33s-9-5.5-9-12a4.5 4.5 0 0 1 9-1 4.5 4.5 0 0 1 9 1c0 6.5-9 12-9 12z" fill="#ff70a6"/>',
  'blank page': '<path d="M11 5h19l8 8v30H11z"/><path d="M30 5v8h8"/>',
};

export function themeIcon(name: string, size = 46): string {
  return svg(THEME_ICONS[name] ?? THEME_ICONS.shapes, size, { fill: '#ffffff' });
}
