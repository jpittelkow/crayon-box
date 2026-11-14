# 0005. Page library format and adding pages

- Status: Proposed
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
      page.json         { "title": "Cat", "tags": ["animal"], "source": "original", "license": "CC0", "ageMin": 2 }
```

- **Built-in pages** live in the repo under `pages/`, are bundled into the app, and arrive with app updates.
  Adding one to the repo = drop a folder in and open a PR. A CI check renders each page, verifies the lines form
  closed regions (no region smaller than 0.2% of the page, no gaps above 6 px) and that `page.json` has a
  license.
- **Family pages** live in `Pictures\Coloring Book\Pages\<theme>\`. Three ways to add one:
  1. *Add with AI* in the parent area (ADR 0006).
  2. *Import files or a folder* in the parent area: PNG, JPG, SVG or the first page of a PDF.
  3. Drop files into that folder in File Explorer; the app picks them up next launch.
  Imported raster images go through cleanup: grayscale, threshold to black and white, remove specks, close gaps
  up to 6 px, scale to 2048 × 1536 with padding, then save as `page.png`.
- **Hiding** a page or theme (parent area) writes `"hidden": true` to a small settings file; nothing is deleted.
- Target for v1: about 48 original built-in pages in 8 themes, plus a blank page. Themes: Race cars (original
  cartoon cars with faces, a big hit for the car-loving 2-year-old), Farm and pets, Wild animals, Under the sea,
  Things that go, Yummy food, Outside, Shapes.

## Consequences
- Adding pages needs no code changes, for us (repo) or for the family (folder or parent area).
- Plain files are easy to back up and to inspect.
- Very detailed imported images may produce tiny regions; the cleanup step's "simple" setting merges small regions.
