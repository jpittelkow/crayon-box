# 0005. Page library format and adding pages

- Status: Accepted (by the owner, 2026-11-14)
- Date: 2026-11-14

## Context
Jeff wants dozens of pages and an easy way for the family to add more. Pages come from three places: built-in
pages shipped with the app, pages imported from files, and pages made by AI (ADR 0006).

## Decision
**A page is a folder of plain files**, the same format everywhere:

```
pages/
  farm-and-pets/
    theme.json          { "name": "Farm and pets", "icon": "paw", "color": "#FF9F1C", "order": 1 }
    cat/
      page.svg          (or page.png, black lines on white/transparent)
      page.json         { "title": "Cat", "tags": ["animal"], "source": "original", "license": "CC0", "detail": "simple" }
```

- **Page ids:** a page's id is `<library>:<theme>/<page>`, where the library is `builtin` or `family`
  (`builtin:farm-and-pets/cat`). The prefix stops a family page colliding with a built-in one. Saved art refers
  to its page by this id (ADR 0007).
- **`detail`** is `simple` or `more`, matching the AI page maker's levels (ADR 0006). It is recorded so pages can
  be filtered per kid later. No ages are stored anywhere.
- **Built-in pages** live in the repo under `pages/`, are bundled into the app, and arrive with app updates.
  Adding one to the repo = drop a folder in and open a PR. A CI check renders each page and fails it when:
  - the shapes are open: closing gaps of up to 6 px changes the number of regions; or
  - `page.json` has no license (ADR 0011).

  Regions smaller than 0.2% of the page (about 79 × 79 px) are reported as a warning, not a failure, because eyes
  and other small details are legitimately small. Pages marked `simple` should have few of them.
- **Family pages** live in `Pictures\Coloring Book\Pages\<theme>\`. The Pictures folder is looked up from Windows,
  since it is often redirected to OneDrive. Three ways to add one:
  1. *Add with AI* in the parent area (ADR 0006).
  2. *Import files or a folder* in the parent area: PNG, JPG, SVG or the first page of a PDF.
  3. Drop files into that folder in File Explorer; the app picks them up next launch.

  Imported raster images go through cleanup: grayscale, threshold to black and white, remove specks, close gaps
  up to 6 px, scale to 2048 × 1536 with padding, then save as `page.png`.

  Loose files from option 3 are turned into page folders at the next launch: each file is cleaned up, saved as
  `page.png` with a `page.json`, and the original is moved into the new page folder. Files dropped in the `Pages`
  root, outside any theme, go into a "Our pages" theme.
- **Hiding** a page or theme (parent area) writes `"hidden": true` to a small settings file; nothing is deleted.
- Target for v1: about 48 original built-in pages in 8 themes, plus a blank page. Themes: Race cars (original
  cartoon cars with faces, a big hit for the car-loving 2-year-old), Farm and pets, Wild animals, Under the sea,
  Things that go, Yummy food, Outside, Shapes.

## Consequences
- Adding pages needs no code changes, for us (repo) or for the family (folder or parent area).
- Plain files are easy to back up and to inspect.
- Very detailed imported images may produce tiny regions; the cleanup step's "simple" setting merges small regions.
