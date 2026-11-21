// The first recipe (ADR 0044): pat the dough, spread sauce, sprinkle cheese, drop toppings, bake, eat. Data only;
// how it is drawn is look/pizza.ts. The numbers are guesses for the first playtest.
import type { Recipe } from '../recipe';

export const PIZZA: Recipe = {
  id: 'pizza',
  label: 'Pizza',
  r: 250,
  inner: 208,
  steps: [
    { id: 'dough', label: 'Pat the dough', verb: 'press', pats: 8 },
    {
      id: 'sauce',
      label: 'Spread the sauce',
      verb: 'spread',
      brush: 44,
      enough: 0.6,
      rail: {
        label: 'Sauces',
        options: [
          { id: 'tomato-sauce', label: 'Tomato sauce' },
          { id: 'green-sauce', label: 'Green sauce' },
          { id: 'white-sauce', label: 'White sauce' },
        ],
      },
    },
    { id: 'cheese', label: 'Sprinkle the cheese', verb: 'sprinkle', enough: 40, most: 400 },
    {
      id: 'toppings',
      label: 'Put the toppings on',
      verb: 'place',
      apart: 70,
      most: 80,
      rail: {
        label: 'Toppings',
        options: [
          { id: 'pepperoni', label: 'Pepperoni' },
          { id: 'mushroom', label: 'Mushroom' },
          { id: 'pepper', label: 'Green pepper' },
          { id: 'olive', label: 'Olive' },
          { id: 'tomato', label: 'Tomato' },
          { id: 'pineapple', label: 'Pineapple' },
          { id: 'corn', label: 'Corn' },
          { id: 'basil', label: 'Basil' },
        ],
      },
    },
    { id: 'oven', label: 'The oven', verb: 'cook', seconds: 4 },
    { id: 'eat', label: 'Eat it', verb: 'eat', bite: 58, enough: 0.9 },
  ],
};
