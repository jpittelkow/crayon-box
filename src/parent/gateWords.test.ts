import { describe, expect, it } from 'vitest';
import { GateAttempt, NUMBER_WORDS, newChallenge } from './gateWords';

describe('parent gate challenge', () => {
  it('shows three digits as words', () => {
    const values = [0.71, 0.32, 0.95];
    const c = newChallenge(() => values.shift()!);
    expect(c.digits).toEqual([7, 3, 9]);
    expect(c.words).toEqual(['seven', 'three', 'nine']);
  });

  it('covers every digit', () => {
    for (let d = 0; d < 10; d++) expect(newChallenge(() => d / 10 + 0.01).words[0]).toBe(NUMBER_WORDS[d]);
    expect(newChallenge(() => 0.99999).digits[0]).toBe(9);
  });

  it('opens on the right digits in order and fails on a wrong one', () => {
    const challenge = { digits: [4, 4, 1], words: ['four', 'four', 'one'] };
    const ok = new GateAttempt(challenge);
    expect(ok.tap(4)).toBe('next');
    expect(ok.tap(4)).toBe('next');
    expect(ok.tap(1)).toBe('open');

    const bad = new GateAttempt(challenge);
    expect(bad.tap(4)).toBe('next');
    expect(bad.tap(1)).toBe('wrong');
  });
});
