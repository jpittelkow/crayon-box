import { describe, expect, it } from 'vitest';
import type { AiModelsResponse } from '../../../server/src/api';
import { modelChoices, pickStillFits, secondModelFor } from './aiModelPicker';

const list: AiModelsResponse = {
  models: [
    { id: 'a/both', name: 'Alpha Image', ways: ['idea', 'photo'], output: ['image', 'text'] },
    { id: 'b/only', name: 'Beta Image', ways: ['idea'], output: ['image'] },
    { id: 'c/text', name: 'Gamma Text', ways: ['draw'], output: ['text'] },
  ],
  favorites: ['b/only', 'c/text', 'gone/model'],
  defaults: { image: 'a/both', draw: 'c/text' },
  fetched: 1,
};

describe('model choices (ADR 0033)', () => {
  it('splits favorites from the rest, for the chosen way', () => {
    const idea = modelChoices(list, 'idea');
    expect(idea.defaultId).toBe('a/both');
    expect(idea.favorites.map((m) => m.id)).toEqual(['b/only']);
    expect(idea.others.map((m) => m.id)).toEqual(['a/both']);
    const photo = modelChoices(list, 'photo');
    expect(photo.favorites).toEqual([]);
    expect(photo.others.map((m) => m.id)).toEqual(['a/both']);
    const draw = modelChoices(list, 'draw');
    expect(draw.defaultId).toBe('c/text');
    expect(draw.favorites.map((m) => m.id)).toEqual(['c/text']);
  });

  it('narrows the rest by every word of the search, in the name or the id', () => {
    expect(modelChoices({ ...list, favorites: [] }, 'idea', 'beta').others.map((m) => m.id)).toEqual(['b/only']);
    expect(modelChoices({ ...list, favorites: [] }, 'idea', 'image a/').others.map((m) => m.id)).toEqual(['a/both']);
    expect(modelChoices({ ...list, favorites: [] }, 'idea', 'nothing').others).toEqual([]);
  });

  it('without a list, still offers the favorites by id', () => {
    const empty = { ...list, models: [] };
    expect(modelChoices(empty, 'idea').favorites.map((m) => m.id)).toEqual(['b/only', 'c/text', 'gone/model']);
    expect(pickStillFits(empty, 'idea', 'b/only')).toBe(true);
    expect(pickStillFits(empty, 'idea', 'x/y')).toBe(false);
  });

  it('drops a remembered pick that no longer fits the way', () => {
    expect(pickStillFits(list, 'idea', 'b/only')).toBe(true);
    expect(pickStillFits(list, 'photo', 'b/only')).toBe(false);
    expect(pickStillFits(list, 'idea', 'gone/model')).toBe(false);
    expect(pickStillFits(list, 'idea', undefined)).toBe(false);
  });
});

describe('two to choose from (ADR 0034)', () => {
  it("asks the server's second model, or its default when the parent picked the second one", () => {
    const withSecond: AiModelsResponse = { ...list, defaults: { image: 'a/both', draw: 'c/text', second: 'b/only' } };
    expect(secondModelFor(withSecond, 'a/both')).toBe('b/only');
    expect(secondModelFor(withSecond, 'x/other')).toBe('b/only');
    expect(secondModelFor(withSecond, 'b/only')).toBe('a/both');
  });

  it('falls back to the default model on an older server, and has none when both would be the same', () => {
    expect(secondModelFor(list, 'b/only')).toBe('a/both');
    expect(secondModelFor(list, 'a/both')).toBeUndefined();
  });
});
