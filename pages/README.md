# Making a coloring page

How to draw a built-in page so it colors well and passes the page check. The format is
[ADR 0005](../docs/adr/0005-page-library-format.md); the licensing rules are
[ADR 0011](../docs/adr/0011-line-art-licensing.md). The order to work in, and what to avoid, is the
[coloring page recipe](../docs/recipes/coloring-pages.md).

## Folder layout
```
pages/
  <theme>/
    theme.json                 { "name": "Farm and pets", "icon": "farm and pets", "color": "#ff8a1f", "order": 2 }
    <page>/
      page.svg  (or page.png)  the line art
      page.json                { "title": "Cat", "tags": ["animal"], "source": "original", "license": "CC0", "detail": "simple" }
```
- Folder names are lowercase words joined by dashes (`farm-and-pets/sleepy-cat`). The page id becomes
  `builtin:farm-and-pets/sleepy-cat`.
- The nine themes are Race cars, Farm and pets, Wild animals, Dinosaurs, Under the sea, Things that go, Yummy food,
  Outside and Shapes. `icon` is one of those names in lowercase; `order` sets their place in the theme strip.
- `page.json`: `title` (for parents and tests, never shown to kids), `tags`, `source` (`original`, `ai` or
  `third-party`), `license` (required), `detail` (`simple` or `more`). AI pages also record `model`; third-party
  pages record a source link.

## Drawing
- **Canvas:** 2048 × 1536 (4:3). In SVG, set `width="2048" height="1536" viewBox="0 0 2048 1536"`.
- **Lines:** ink `#23201c`, about **16 px** wide (14 to 20), round caps and joins. Everything dark becomes a line
  that paint can't cross; everything light is paper.
- **Background:** transparent or white. White fills are allowed and handy: they count as paper, so a white-filled
  shape drawn on top hides the lines behind it (the fish page draws its fins first, then a white body over them).
- **Closed shapes.** Every area a kid might fill must be fully enclosed, by lines or by the page edge. Lines that
  should meet must overlap; don't stop them just short. A line that runs to the edge should go past it.
- **Size of areas.** Keep areas at least about 80 × 80 px where you can. Smaller ones (eyes, buttons, bubbles)
  are fine but hard for little fingers; `simple` pages should have few of them.
- **Margins.** Leave about 40 px of paper at the page edges unless a line is meant to run off the page.
- **Solid black parts** (a pupil, a tire) are fine; they simply can't be colored.
- **No text or numbers** on pages (ADR 0003), and nothing recognisable from a show, film, game or brand
  (ADR 0011).

## The page check
CI renders every page in the browser and runs the same region code the app uses
([`pageCheck.ts`](../src/games/coloring/engine/pageCheck.ts)):
- **Fails** when closing gaps of up to 6 px splits an area in two: somewhere a line doesn't quite meet another,
  and paint would leak through. The message gives the area's position in page pixels.
- **Warns** about areas smaller than 0.2% of the page (about 79 × 79 px). Warnings show as annotations in the test
  report and don't fail the build.
- Also fails a page without a `license` in `page.json`
  ([pages.test.ts](../src/games/coloring/pages.test.ts)).

Run it locally on every page:
```bash
npx playwright test tests/e2e/pages.spec.ts
```

## Cleaning up a picture
For line art from elsewhere (an AI-made page, a scan, a photo of a drawing): with `npm run dev` running, open
`http://localhost:5173/tools/clean-page.html`, pick the image, and download the result as `page.png`. It turns gray
into black or white, removes dust, closes gaps up to 6 px, fits the picture to 2048 × 1536, and runs the page check
on the result. For a whole folder at once, `node tools/clean-pages.mjs <in> <out>` does the same in a browser it
starts itself, writes a `report.json`, trims the faint frame AI images often have at the edge, and closes shapes
that a tail or claw running off the picture left open. The same clean-up ([`cleanup.ts`](../src/games/coloring/engine/cleanup.ts)) will serve import and the
AI page maker in the installer (ADR 0005, 0006, 0023).

## Before adding a page
1. Open it in the app (`npm run dev`), fill every area with the bucket, and look for white edges or leaks.
2. Run the page check.
3. For AI-made pages: the model's terms allow redistribution, the prompt named no franchise, character or artist,
   and a person has looked at the page and found nothing recognisable in it (ADR 0011).

The `shapes/circle-square-triangle` page is also used by the browser tests; keep its geometry, or update
`tests/e2e/helpers.ts` with it.
