// Turning the picture down on a slow computer (ADR 0025, 0035: "the look turns down first"). After the playtest of
// 2026-11-15 found the game seemed to freeze on the family laptop, the game watches its own frame times and draws
// fewer pixels while it keeps falling behind, down to half the screen's own sharpness.

/** Frames are timed in groups of this many. */
export const DETAIL_FRAMES = 60;
/** A group slower than this on average (ms a frame; about 45 frames a second) turns the picture down a step. */
export const SLOW_MS = 22;
/** Never below this share of the screen's own pixel ratio. */
export const MIN_DETAIL = 0.5;

/** The detail to draw at next, from the average frame time of the last group. It never goes back up. */
export function nextDetail(detail: number, averageMs: number): number {
  return averageMs > SLOW_MS ? Math.max(MIN_DETAIL, Math.round(detail * 0.8 * 100) / 100) : detail;
}

/** Times frames and says when the detail changed. The first frames (shaders compiling) are not counted. */
export function detailWatcher(skip = 30): { frame(ms: number): number | null; readonly detail: number } {
  let detail = 1, seen = 0, sum = 0, n = 0;
  return {
    get detail() {
      return detail;
    },
    frame(ms) {
      if (seen++ < skip || detail <= MIN_DETAIL) return null;
      // A frame over half a second is the tab being hidden or the computer waking, not drawing.
      if (ms > 500) return null;
      sum += ms;
      if (++n < DETAIL_FRAMES) return null;
      const next = nextDetail(detail, sum / n);
      sum = n = 0;
      if (next === detail) return null;
      detail = next;
      return detail;
    },
  };
}
