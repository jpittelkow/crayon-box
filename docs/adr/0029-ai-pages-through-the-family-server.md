# 0029. AI pages through the family server: one OpenRouter key, kept off the laptops

- Status: Accepted (by the owner, 2026-11-14: "Do it.")
- Date: 2026-11-14
- Supersedes: in [ADR 0006](0006-ai-page-maker-openrouter.md), the key stored in Windows Credential Manager on the laptop and
  requests going straight from the laptop to OpenRouter, and the "Model" setting in the parent area. In
  [ADR 0023](0023-ai-pages-from-a-prompt.md), "the same key and model setting as ADR 0006". Everything else in both
  (the flow, the prompts, the preview and page check, privacy, the parent's own choice of photo or idea) stands.

## Context
ADR 0006 put the OpenRouter key on each laptop, in Credential Manager. Since then the family sync server
(ADR 0024) exists: a container on the family's Unraid machine that every device already pairs with. The owner
asked (2026-11-14) whether the AI page maker should go through it, so the key lives in one place.

## Decision
- **The family server holds the key and calls OpenRouter.** `OPENROUTER_API_KEY` is a masked setting of the
  container (the Unraid template has it). The key is never on a laptop, never synced, never in the repo.
- **One endpoint**, `POST /api/v1/ai/page`, for paired devices (the sync token). It takes one of:
  - `photo`: a picture (ADR 0006) and a detail level;
  - `idea`: a short description (ADR 0023 *Generate*) and a detail level;
  - `draw`: a short description (ADR 0023 *Draw*): a text model writes the page as SVG line art.
  It answers with the raw image (PNG, JPEG or SVG). The prompts are ADR 0006's: thick black outlines on white,
  no shading, no gray, no text, large closed shapes, one centered subject; simple mode asks for under about 15
  shapes.
- **The app does the rest, as for any file** (milestone 2 phase F): the clean-up step, the page check, the
  preview, a name and a theme, and *Add to the library*. The result is a family page, so it syncs. Nothing is
  added without the parent pressing the button.
- **Models are server settings:** `AI_IMAGE_MODEL` (image output; used for photo and idea) and `AI_DRAW_MODEL`
  (text, for SVG). Defaults are picked to start with and replaced after the owner's quality test.
- **A spending cap:** `AI_DAILY_LIMIT` pages a day for the whole family (default 20). The server counts them and
  says plainly when the day's are used up. OpenRouter's own key limit is still worth setting.
- **Where it shows:** Parent area › Add pages, under "Make a page with AI", only when the device is connected to a
  family server that reports AI as set up (`/api/v1/info`). Kids never see it. Without a server there is no AI
  page maker; a local-key fallback is not built.
- **Privacy** as in ADR 0006: a photo or idea leaves the home network only when a parent presses the button, and
  the screen says it goes to OpenRouter and the model's provider. The server keeps no copy of photos or results.
- **Search** (ADR 0023's third way) is still waiting on a search service.

## Consequences
- One key for the family, set once in the container; changing the model or the cap is a container setting, not an
  app release. No Rust Credential Manager code.
- The AI page maker needs the family server. Fine for this family; a family without one has no AI pages.
- Anyone with a paired device can spend credits up to the daily cap. The parent gate keeps kids out of the
  parent area; the cap bounds mistakes.
- The server now reaches the internet (OpenRouter) and holds a secret. Its data folder still holds no key: the
  key is only in the container's settings.
