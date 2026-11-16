# Recipe: coloring pages

The format and drawing rules are in [pages/README.md](../../pages/README.md) and ADR 0005; where pages come from
is ADR 0022; licensing is ADR 0011. This file is the order to work in and what to avoid.

## Recipe: one page
1. **Pick the subject** for its theme and a `detail` level: `simple` for big shapes and few parts, `more` for older
   kids. One clear subject, filling most of the page.
2. **Make the line art**, one of two ways:
   - **Drawn as SVG** (Race cars, Things that go, Shapes, Yummy food): 2048 × 1536, ink `#23201c`, lines about
     16 px with round caps and joins, about 40 px of paper at the edges.
   - **AI-made** (the animal themes, 2026-11-15): the idea prompt plus a style line, e.g. "a cute, friendly cartoon
     animal", and **ask for a white margin all round**. Make two takes, pick by eye.
3. **Clean it up** (AI or scanned art): `node tools/clean-pages.mjs <in> <out> --trim --join`, or one at a time in
   `tools/clean-page.html`. Read `report.json`.
4. **Add the folder** `pages/<theme>/<page>/` with `page.svg` or `page.png` and `page.json` (`title`, `tags`,
   `source`, `license`, `detail`; AI pages also `model`).
5. **Check it:** `npx playwright test tests/e2e/pages.spec.ts` (fails on a leak, warns on tiny areas) and
   `npx vitest run src/games/coloring/pages.test.ts` (license present).
6. **Color it in the app** (`npm run dev`): fill every area with the bucket; look for leaks and white rims, and
   for two things that should be separate filling as one (sky and grass).
7. **For AI pages,** a person looks for anything recognisable (a franchise character, a logo); if in doubt, drop it.

## Recipe: a new theme
1. Six pages, made as above, so the theme strip never shows a thin theme.
2. `pages/<theme>/theme.json`: `name`, `icon` (a name the icon set has; a new theme needs a new icon in
   `src/ui/icons.ts`), `color`, `order`.
3. Update the theme list in [pages/README.md](../../pages/README.md) and any browser test that counts themes
   (`tests/e2e/coloring.spec.ts`).

## Patterns
- **White fills hide lines behind a shape.** Draw the back part first, then a white-filled front part over it
  (the fish's fins).
- **Lines either cross clearly or keep 20 px apart.** That is what keeps the gap closer from joining or splitting
  areas.
- **Lines meant to run off the page go past the edge,** so the shape is closed by the page edge.
- **Ask the AI for the margin** rather than fixing open shapes afterwards; `--join` is the fallback.
- **Three AI runs side by side** was the quickest; more than about six calls at once slowed GPT-5 Image Mini down.

## Anti-recipes
- **Ground that is only a line running toward the page edges** (a horizon, a hill's top edge). The clean-up adds
  a margin, so the line stops short of the page edge and sky and grass become one area: filling the sky turns the
  grass blue too. The page check can't see it (nothing leaks; it is just one big area). Ask for the ground as
  "a small rounded grassy hill drawn as one closed shape", or close it by hand (found 2026-11-15, Outside theme).
- **A line that stops just short** of another (a smile 4 px from the face): paint leaks through, the check fails.
- **A line running beside another within ~6 px** (a wheel top near the body, a flagpole by a seat): the gap closer
  joins them into one line and an area vanishes.
- **Lots of tiny areas on a `simple` page** (toes, scales, freckles): fine fingers can't hit them. Keep areas about
  80 × 80 px or bigger.
- **Text, numbers or a logo** anywhere on the page (ADR 0003, 0011).
- **A franchise, character, toy brand or artist named in a prompt,** or a page that looks like one anyway.
- **A page made from a family photo committed to the repo.** Those are family pages, made in the app and kept on
  the device and the family server only (ADR 0011, 0018).
- **Gray, soft or anti-aliased AI art used as is.** It must go through the clean-up, or gray turns into stray lines.
- **Skipping the check because "it looked fine".** The check finds the 3 px gap the eye doesn't.
