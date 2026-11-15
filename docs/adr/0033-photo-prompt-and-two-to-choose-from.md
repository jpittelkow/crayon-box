# 0033. AI pages: a photo prompt for everyone in the picture, and two pages to choose from

- Status: Accepted (by the owner, 2026-11-15: "Both")
- Date: 2026-11-15
- Amends: [ADR 0029](0029-ai-pages-through-the-family-server.md) (the photo prompt and the default image model)
  and builds on [ADR 0032](0032-pick-the-ai-model-in-the-app.md) (picking the model).

## Context
The owner wanted better pages from photos and asked to test prompts and models on real family photos. A sample
tool (`server/tools/ai-samples.ts`) runs photos through several prompts and models and writes a side-by-side
sheet with each call's time and cost. Its output goes to `.ai-samples/`, which git ignores: the photos stay on the
laptop (CLAUDE.md privacy rule).

Two rounds on 2026-11-15 (44 pages, $2.52), on one outdoor photo of two kids and eight party photos: one baby,
pairs, groups of four, and two with no people.

| Model | Per page | What it did |
|---|---|---|
| Nano Banana (`google/gemini-2.5-flash-image`, the first default) | $0.04, 8 s | Thin gray sketches; once in full color. Not usable. |
| Nano Banana 2 (`google/gemini-3.1-flash-image`) | $0.07, 8 s | The best likeness (glasses, beards, hair, bow ties), 4:3. Sometimes cut heads off and kept clothing patterns. |
| GPT-5 Image Mini (`openai/gpt-5-image-mini`) | $0.05, 40 s | The most consistent: clean, simple shapes a toddler can color. More generic faces; square pages. |

The first photo prompt asked for "the main subject". On a busy photo the models invented one: a family of four
at a birthday cake became a dinosaur, or one sad child. Asking for everyone in the photo kept all four people and
the cake on both models. It also drew blurry people from the background, copied the words of a banner, and kept
polka dots and leopard print.

No model won on every photo. The owner found it hard to pick and asked for a picker.

## Decision
- **The photo prompt** asks for every person (and pet) in focus near the front, up to four, leaving out blurry
  people behind; whole, or from the waist up at a table, with a white margin so nothing is cut off; poses, hair,
  glasses and the shapes of clothes kept, but clothes as plain outlines with no patterns; simple faces that are
  never blank; one or two big objects they hold; no letters or words even when the photo has them; and the main
  objects when there are no people. It is `PHOTO_ASK` in `server/src/ai.ts`. The idea prompt is unchanged.
- **The default image model is GPT-5 Image Mini**, and the server has a **second image model**, Nano Banana 2
  (`AI_SECOND_MODEL`, a new container setting next to `AI_IMAGE_MODEL`).
- **Two to choose from:** under the model on *Make a page with AI*, a parent picks *One page* or *Two to choose
  from*. Two sends the same photo or idea to the chosen model and to the other one (the server's second model, or
  its default when the second was chosen) at the same time. Both cleaned pages show side by side with the model
  that made each; *Use this one* goes on to the name, the theme and *Add to the library*. If one model fails, the
  other page shows with the problem in words. Each page counts toward the daily limit. Drawing as SVG has one
  model, so the choice is hidden there. Each device remembers the choice under `local/` (ADR 0024).
- **The sample tool stays in the repo** for the next prompt or model change. Its prompt list
  (`server/tools/photo-prompts.json`) keeps the tried prompts with what went wrong, and a `server` row that always
  uses the live prompt. Every call returns OpenRouter's cost, which the tool shows.

## Consequences
- Two to choose from costs about 12¢ a photo instead of 5 to 7¢, and takes as long as the slower model (about
  40 s).
- A server on 1.2.0 with `AI_IMAGE_MODEL` set in its container keeps that model as the default: the family's
  Unraid container was set to Nano Banana and needs `AI_IMAGE_MODEL` changed (or cleared) by hand.
- GPT-5 Image Mini's square pages get white space at the sides on the 4:3 page.
- The prompt was tuned on one family's photos; a playtest of the pages with the kids is still to come.
