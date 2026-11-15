# 0032. Pick the AI model in the app, from OpenRouter's list, with family favorites on the server

- Status: Accepted (by the owner, 2026-11-15: "Yes, ADR and build")
- Date: 2026-11-15
- Amends: [ADR 0029](0029-ai-pages-through-the-family-server.md), "Models are server settings". The settings
  stay, as the defaults; a parent can now pick another model for a page.

## Context
ADR 0029 made the models container settings (`AI_IMAGE_MODEL`, `AI_DRAW_MODEL`). Trying a different model meant
editing the container on Unraid and restarting it, which makes the quality test ADR 0029 asks for slow. The owner
asked (2026-11-15) for a dropdown in the app filled from OpenRouter's model list, with a few favorites kept on the
server.

OpenRouter's public model list (`GET https://openrouter.ai/api/v1/models`, no key needed) gives each model's
input and output modalities and its prices. On 2026-11-15 it listed 467 models, 72 of them with image output.
Some image models give back only an image and refuse a request that asks for image and text, which the server
always asked for.

## Decision
- **The server serves the model list:** `GET /api/v1/ai/models`, for paired devices. It fetches OpenRouter's list,
  keeps it for six hours, and sorts each model into the ways of making a page it can do:
  - **idea:** the model's output includes an image;
  - **photo:** it also takes an image in;
  - **draw:** text out and no image out (it writes SVG).

  Each entry has an id, a name, its ways, its output modalities and a short price label. If OpenRouter can't be
  reached, the answer still carries the favorites and the defaults, and says what went wrong.
- **Favorites are family-wide and live on the server** (in its settings table, so in its data folder and its
  backup). A parent stars or unstars a model from the app: `PUT /api/v1/ai/favorites`. They are not synced items:
  they belong to the server, like the daily count.
- **A page request may name a model** (`model` in the request). The server takes it only if it is in the list
  for that way. When the list can't be fetched, any well-formed id is passed on and OpenRouter has the last word.
  Without `model`, the server's settings are used, as before.
- **The server asks each model for what it gives back:** `modalities: ["image"]` for an image-only model,
  `["image", "text"]` for one that gives both, as the list says.
- **In the app** (Parent area › Add pages › Make a page with AI): a **Model** dropdown for the chosen way, with
  the server's default first, then the favorites, then all models, and a search box to narrow the list. A star
  button adds or removes the chosen model from the favorites. Each device remembers its last pick per way under
  `local/` (device only, ADR 0024). The status line names the model that made the page, so models are easy to
  compare on the same idea.
- **Older servers** without the model list: the dropdown is left out and pages use the server's settings.

## Consequences
- Trying a model is a dropdown pick, not a container edit. The container settings remain the family default.
- Any paired device can pick any listed model, including expensive ones. The daily cap still bounds the number of
  pages; the price label and OpenRouter's key limit are the guard on cost.
- The server makes one more outside call (the model list), at most every six hours. It sends no key or family
  data with it.
- Favorites are lost only with the server's data folder, which is backed up with appdata.
