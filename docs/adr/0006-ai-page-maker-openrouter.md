# 0006. AI page maker via OpenRouter

- Status: Proposed
- Date: 2026-11-14

## Context
Jeff wants to upload a photo or drawing (the dog, a favorite toy, a kid's own scribble) and get a coloring page
back. OpenRouter gives one API key and one API for many image-capable models, so the model can be swapped
without code changes.

## Decision
- **Where:** parent area, "Add a page". Kids never see it.
- **Flow:** pick a file or take a camera photo → choose detail level (very simple for ages 2–3, more detail for
  4+, or "already a coloring page: just clean it up", which skips AI) → the app shows the result side by side →
  *Try again* or *Add to library* with a theme picker.
- **API call:** `POST https://openrouter.ai/api/v1/chat/completions` with an image-output model, the photo as an
  image input, and `modalities: ["image", "text"]`. The returned image is run through the same cleanup as
  imports (ADR 0005), so the bucket fill works. The prompt asks for: thick uniform black outlines on pure white,
  no shading or gray, no text, large closed shapes, one centered subject, and (simple mode) under ~15 shapes.
- **Model:** a setting, filled from OpenRouter's model list filtered to image output. Default chosen during
  implementation after a quick quality test with a few family photos.
- **Key:** Jeff's own OpenRouter key, entered in the parent area, stored in Windows Credential Manager (not in a
  plain file, never in the repo). Requests go straight from the laptop to OpenRouter.
- **Privacy:** photos are sent to OpenRouter and the chosen model provider only when a parent presses the button.
  The parent area states this next to the button. Original photos aren't kept after the page is made.
- **Failure:** no internet, no key or an API error shows a plain message and leaves the photo in place to retry.

## Consequences
- Turns family photos into pages in seconds; cost per page depends on the model chosen (shown in settings).
- Quality varies by model; the "Try again" button and the cleanup step absorb most of it.
- If OpenRouter changes its image API, only one small module changes.
