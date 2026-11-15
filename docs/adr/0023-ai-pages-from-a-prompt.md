# 0023. The AI page maker also makes pages from a typed idea

- Status: Accepted (by the owner, 2026-11-14)
- Date: 2026-11-14
- Extends: ADR 0006 (AI page maker from a photo). Everything there about where, when, the key, privacy and
  failures still holds.

## Context
ADR 0006 turns a photo into a coloring page. The owner also wants to describe a page in words ("a fire truck
with a ladder", "a dinosaur eating a cake") and have the app find, generate or draw it, so the family can add
pages a photo can't give them.

## Decision
- **Where and when:** the same parent-area screen, "Add a page", with two starting points: *From a photo*
  (ADR 0006) and *From an idea*: a short typed description and the detail level. Milestone 2, with ADR 0006.
- **Three ways to make it.** The parent picks one; the screen remembers the last choice.
  1. **Generate:** an image model through OpenRouter (the same key and model setting as ADR 0006) gets the idea
     wrapped in the coloring-page instructions of ADR 0006 (thick black outlines, no shading, no text, large
     closed shapes). The result goes through the ADR 0005 clean-up.
  2. **Draw:** a text model through OpenRouter writes the page as SVG line art in the format of
     `pages/README.md`, the way the built-in pages are drawn (ADR 0022). Crisp and always closed, simpler in
     look. Best for objects, vehicles and shapes.
  3. **Search:** look for existing coloring pages matching the idea on the web, show a few, and let the parent
     pick one; it then goes through the clean-up. Which search service to use, and its key and cost, is still
     open and is settled before this part is built.
- **Every result is previewed and checked** before it joins the library: the page check (ADR 0005) runs on it, an
  open shape is reported in plain words with *Try again*, and nothing is added without the parent pressing
  *Add to library* and picking a theme (or "Our pages").
- **The idea text is the parent's.** As in ADR 0006, the app doesn't steer what a parent asks for. Pages made this
  way are family pages: they stay on the laptop and never enter the repo (ADR 0011). A searched page's source
  link is kept in its `page.json`.

## Consequences
- Families can fill gaps in the library ("more trucks") in a minute, without a photo.
- Three ways means three code paths to keep working; they share the preview, the page check and the save.
- Search needs a provider and may bring in pages under unclear licenses. That is acceptable only because family
  pages are for personal use on the laptop (ADR 0011); it would not be acceptable for built-in pages.
