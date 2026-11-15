// The vehicle picker's pages (milestone-3 B5; a "back a page" tile since the playtest of 2026-11-15).

/**
 * The vehicle picker's pages for `n` vehicles, as indexes, in six places: the first page has a "more" tile, the
 * last a "back a page" tile, the ones between both. Six or fewer fit on one page.
 */
export function pagesOf(n: number): number[][] {
  const range = (a: number, b: number) => Array.from({ length: b - a }, (_, k) => a + k);
  if (n <= 6) return [range(0, n)];
  const pages: number[][] = [];
  let i = 0;
  while (i < n) {
    const room = pages.length === 0 ? 6 : 5;
    if (n - i <= room) {
      pages.push(range(i, n));
      break;
    }
    pages.push(range(i, i + room - 1));
    i += room - 1;
  }
  return pages;
}
