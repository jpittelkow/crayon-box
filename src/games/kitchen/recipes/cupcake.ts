// The second recipe (ADR 0044): pick a wrapper, pour the batter, bake, squeeze frosting on, shake sprinkles, put a
// topper on, eat. Data only; how it is drawn is look/cupcake.ts. The cupcake is seen from the side: its wrapper is
// below the middle and its frosting above, so where sprinkles and toppers go, and what gets eaten, are ovals and not
// a circle. The numbers are guesses for the first playtest.
import type { Recipe } from '../recipe';

export const CUPCAKE: Recipe = {
  id: 'cupcake',
  label: 'Cupcake',
  r: 250,
  inner: 140,
  /** The frosting, where sprinkles and toppers land: its four swirls (as look/cupcake.ts draws them) and its peak. */
  area: [
    { cx: 0, cy: -22, rx: 152, ry: 46 },
    { cx: 0, cy: -78, rx: 120, ry: 42 },
    { cx: 0, cy: -128, rx: 86, ry: 36 },
    { cx: 0, cy: -170, rx: 50, ry: 30 },
    { cx: 0, cy: -204, rx: 30, ry: 32 },
  ],
  /** Wrapper, cake and frosting together. */
  body: { cx: 0, cy: 4, rx: 172, ry: 244 },
  sayStart: 'cook-lets-make-cupcake',
  sayGone: ['cook-yum', 'cook-yummy', 'cook-all-gone'],
  steps: [
    {
      id: 'wrapper',
      label: 'Pick a wrapper',
      verb: 'choose',
      rail: {
        label: 'Wrappers',
        options: [
          { id: 'blue-wrapper', label: 'Blue wrapper', say: 'color-blue' },
          { id: 'pink-wrapper', label: 'Pink wrapper', say: 'color-pink' },
          { id: 'yellow-wrapper', label: 'Yellow wrapper', say: 'color-yellow' },
          { id: 'green-wrapper', label: 'Green wrapper', say: 'color-green' },
        ],
      },
    },
    {
      id: 'batter',
      label: 'Pour the batter',
      say: 'cook-pour-batter',
      verb: 'pour',
      seconds: 2.5,
      rail: {
        label: 'Batters',
        options: [
          { id: 'vanilla-batter', label: 'Vanilla batter', say: 'food-vanilla' },
          { id: 'chocolate-batter', label: 'Chocolate batter', say: 'food-chocolate' },
          { id: 'strawberry-batter', label: 'Strawberry batter', say: 'food-strawberry' },
        ],
      },
    },
    { id: 'oven', label: 'The oven', say: 'cook-into-oven', verb: 'cook', seconds: 4, sayDone: 'cook-ready' },
    {
      id: 'frosting',
      label: 'Squeeze the frosting',
      say: 'cook-squeeze-frosting',
      verb: 'pour',
      seconds: 2.5,
      rail: {
        label: 'Frostings',
        options: [
          { id: 'strawberry-frosting', label: 'Strawberry frosting', say: 'food-strawberry' },
          { id: 'vanilla-frosting', label: 'Vanilla frosting', say: 'food-vanilla' },
          { id: 'chocolate-frosting', label: 'Chocolate frosting', say: 'food-chocolate' },
          { id: 'blue-frosting', label: 'Blue frosting', say: 'color-sky' },
        ],
      },
    },
    { id: 'sprinkles', label: 'Shake the sprinkles', say: 'cook-shake-sprinkles', verb: 'sprinkle', enough: 30, most: 220 },
    {
      id: 'toppers',
      label: 'Put something on top',
      say: 'cook-cherry-on-top',
      verb: 'place',
      apart: 70,
      most: 12,
      rail: {
        label: 'Toppers',
        options: [
          { id: 'cherry', label: 'Cherry' },
          { id: 'strawberry', label: 'Strawberry' },
          { id: 'blueberry', label: 'Blueberry' },
          { id: 'banana', label: 'Banana' },
          { id: 'candy', label: 'Candy' },
          { id: 'candle', label: 'Candle' },
          { id: 'star', label: 'Star' },
          { id: 'heart', label: 'Heart' },
        ],
      },
    },
    { id: 'eat', label: 'Eat it', say: 'cook-made-cupcake', verb: 'eat', bite: 58, enough: 0.9 },
  ],
};
