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

/** Colors the rainbow brush and fill cycle through, matching the rainbow swatch. */
export const RAINBOW_STOPS = ['#f23b2f', '#ff8a1f', '#ffd23f', '#2fa35f', '#4cc9f0', '#2f6fed', '#9b5de5'];
