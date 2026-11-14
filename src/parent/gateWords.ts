// The read-and-tap part of the parent gate (ADR 0008): three digits shown as words, different every time.

export const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

export interface GateChallenge {
  digits: number[];
  words: string[];
}

export function newChallenge(random: () => number = Math.random, length = 3): GateChallenge {
  const digits = Array.from({ length }, () => Math.floor(random() * 10) % 10);
  return { digits, words: digits.map((d) => NUMBER_WORDS[d]) };
}

/** Tracks taps against a challenge. */
export class GateAttempt {
  private entered = 0;

  constructor(private readonly challenge: GateChallenge) {}

  /** Returns 'next' for a right digit, 'open' when the last one is right, 'wrong' otherwise. */
  tap(digit: number): 'next' | 'open' | 'wrong' {
    if (this.challenge.digits[this.entered] !== digit) return 'wrong';
    this.entered++;
    return this.entered === this.challenge.digits.length ? 'open' : 'next';
  }

  get progress(): number {
    return this.entered;
  }
}
