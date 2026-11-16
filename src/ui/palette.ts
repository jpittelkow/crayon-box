// The paint colors in rail order (ADR 0016): three across, one color family per row, light to dark.
// Values must match the `--crayon-*` tokens in tokens.css; a unit test checks that they do.

export interface PaintColor {
  /** Token name without the `--crayon-` prefix. */
  token: string;
  /** Accessible name for tests and tools; never shown on a kid screen. */
  label: string;
  /** Hex value, or `rainbow`. */
  value: string;
}

export const RAINBOW = 'rainbow';

export const PALETTE: readonly PaintColor[] = [
  { token: 'light-pink', label: 'Light pink', value: '#ffc2d6' },
  { token: 'pink', label: 'Pink', value: '#ff70a6' },
  { token: 'red', label: 'Red', value: '#f23b2f' },
  { token: 'apricot', label: 'Apricot', value: '#ffbf75' },
  { token: 'orange', label: 'Orange', value: '#ff8a1f' },
  { token: 'dark-red', label: 'Dark red', value: '#a8201a' },
  { token: 'yellow', label: 'Yellow', value: '#ffd23f' },
  { token: 'lime', label: 'Light green', value: '#9bd93c' },
  { token: 'green', label: 'Green', value: '#2fa35f' },
  { token: 'dark-green', label: 'Dark green', value: '#1b6b3c' },
  { token: 'teal', label: 'Teal', value: '#12a8a3' },
  { token: 'sky', label: 'Light blue', value: '#4cc9f0' },
  { token: 'pale-blue', label: 'Pale blue', value: '#b5e8f8' },
  { token: 'blue', label: 'Blue', value: '#2f6fed' },
  { token: 'navy', label: 'Dark blue', value: '#1d3a9e' },
  { token: 'lavender', label: 'Lavender', value: '#d2b7f7' },
  { token: 'purple', label: 'Purple', value: '#9b5de5' },
  { token: 'gray', label: 'Gray', value: '#9aa0a6' },
  { token: 'peach', label: 'Peach', value: '#f6c9a0' },
  { token: 'tan', label: 'Tan', value: '#c98f5a' },
  { token: 'brown', label: 'Brown', value: '#8d5a3b' },
  { token: 'dark-brown', label: 'Dark brown', value: '#5b3a26' },
  { token: 'black', label: 'Black', value: '#23201c' },
  { token: 'rainbow', label: 'Rainbow', value: RAINBOW },
];

/** A colour on the colour wheel: like a paint color, plus the rail color whose spoken name it borrows. */
export interface WheelColor extends PaintColor {
  /**
   * The rail token whose narrator clip says this colour's name (`color-<says>`). The wheel's in-between hues have no
   * clips of their own, so each says the plain colour word it falls under ("Pink" for magenta), the words kids this
   * age are learning (ADR 0038, decision C2).
   */
  says: string;
}

/**
 * The colour wheel's 12 in-between hues, clockwise from the top (ADR 0038 part 5, decision C7): hues the rail lacks,
 * so the wheel adds colours rather than repeating the rail. Values match the `--crayon-wheel-*` tokens.
 */
export const WHEEL: readonly WheelColor[] = [
  { token: 'coral', label: 'Coral', value: '#ff6a3d', says: 'orange' },
  { token: 'gold', label: 'Gold', value: '#e3a21a', says: 'yellow' },
  { token: 'chartreuse', label: 'Chartreuse', value: '#c4e538', says: 'lime' },
  { token: 'mint', label: 'Mint', value: '#8ee6b8', says: 'green' },
  { token: 'sea-green', label: 'Sea green', value: '#1f9e89', says: 'teal' },
  { token: 'aqua', label: 'Aqua', value: '#63e2e6', says: 'sky' },
  { token: 'cornflower', label: 'Cornflower', value: '#7c9cf2', says: 'blue' },
  { token: 'indigo', label: 'Indigo', value: '#4338a8', says: 'navy' },
  { token: 'violet', label: 'Violet', value: '#b06ce8', says: 'purple' },
  { token: 'plum', label: 'Plum', value: '#8e2f6f', says: 'purple' },
  { token: 'magenta', label: 'Magenta', value: '#d81b84', says: 'pink' },
  { token: 'rose', label: 'Rose', value: '#f28cb1', says: 'pink' },
];

/** Colors the rainbow brush and fill cycle through, matching the rainbow swatch. */
export const RAINBOW_STOPS = ['#f23b2f', '#ff8a1f', '#ffd23f', '#2fa35f', '#4cc9f0', '#2f6fed', '#9b5de5'];
