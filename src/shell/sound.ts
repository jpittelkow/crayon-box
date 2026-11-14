import type { Sound } from './types';

/**
 * Sounds are a parent setting (ADR 0016) and no sound files exist yet (they must be original or CC0, ADR 0011).
 * Until both exist, the app is silent.
 */
export const silentSound: Sound = {
  play() {},
};
