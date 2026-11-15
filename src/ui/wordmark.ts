// The app's name as a wordmark (ADR 0027): a picture of the name in crayon colors, never a control and never
// something a kid has to read, so it fits the no-text rule for kid screens (ADR 0003 rule 1).
import { el } from './kid';

export const APP_NAME = 'Crayon Box';

/** One crayon per letter, in rainbow order; spaces take no color. */
const LETTER_COLORS = [
  'var(--crayon-red)',
  'var(--crayon-orange)',
  'var(--crayon-yellow)',
  'var(--crayon-green)',
  'var(--crayon-sky)',
  'var(--crayon-blue)',
  'var(--crayon-purple)',
  'var(--crayon-pink)',
];

export type WordmarkSize = 'xl' | 'md' | 'sm';

export function wordmark(size: WordmarkSize, className = ''): HTMLElement {
  const mark = el('div', `wordmark wordmark--${size} ${className}`.trim(), {
    role: 'img',
    'aria-label': APP_NAME,
  });
  let n = 0;
  for (const ch of APP_NAME) {
    const letter = el('span', ch === ' ' ? 'wordmark-gap' : 'wordmark-letter', {
      'aria-hidden': 'true',
    });
    letter.textContent = ch;
    if (ch !== ' ') {
      letter.style.color = LETTER_COLORS[n % LETTER_COLORS.length];
      // A small tilt per letter, alternating, so it looks drawn by hand.
      letter.style.setProperty('--tilt', `${n % 2 === 0 ? -4 : 3}deg`);
      n++;
    }
    mark.append(letter);
  }
  return mark;
}
