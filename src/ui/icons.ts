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
  undo: (size = 50) =>
    svg('<path d="M17 9L7 19l10 10"/><path d="M7 19h20a11.5 11.5 0 0 1 0 23h-9"/>', size, { stroke: 6 }),
  startOver: (size = 50) =>
    svg(
      '<path d="M11 5h19l8 8v30H11z" fill="#ffffff"/><path d="M30 5v8h8"/>' +
        '<path d="M29.5 27a6 6 0 1 1-1.8-4.3"/><path d="M29 18v5h-5"/>',
      size,
    ),
  bucket: (size = 50) =>
    svg(
      '<path d="M10 20L24 6l16 16-14 14z" fill="#ffffff"/><path d="M10 20h30"/>' +
        `<path d="M40 30s4 5 4 8a4 4 0 0 1-8 0c0-3 4-8 4-8z" ${CURRENT}/>`,
      size,
    ),
  brush: (size = 50) =>
    svg(
      '<path d="M40 6L20 28l-4-4L38 4z" fill="#ffffff"/>' +
        `<path d="M16 26c-6 0-8 6-8 10 0 3-2 5-4 6 8 2 18 0 18-8z" ${CURRENT}/>`,
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
  coloring: (size = 120) =>
    svg(
      '<path d="M11 5h19l8 8v30H11z" fill="#ffffff"/><path d="M30 5v8h8"/>' +
        '<path d="M17 34c4-6 8-9 14-10" style="stroke: #ff70a6" stroke-width="5"/>',
      size,
    ),
  /** The driving game's home tile: a cartoon car seen from the side (ADR 0021). Original, CC0. */
  driving: (size = 120) =>
    svg(
      '<path d="M5 32v-7l5-2 6-9h15l7 9 5 2v7z" fill="#3a86ff"/><path d="M17 15l-4 8h11v-8zM28 15v8h9l-6-8z" fill="#cfeaff"/>' +
        '<circle cx="14" cy="34" r="5" fill="#2b2b2b"/><circle cx="35" cy="34" r="5" fill="#2b2b2b"/>',
      size,
    ),
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
