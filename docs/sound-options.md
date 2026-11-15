# Sound design: options

Drafted 2026-11-15 for the owner's sound choices. The owner picked by ear the same day; the result is
[ADR 0032](adr/0032-sounds-as-files.md) (Accepted). This file keeps the options and the sources behind it. The
recommendation below came before the listening test and is superseded by ADR 0032.

## The ask
The owner reported the audio isn't good enough (known bugs, 2026-11-14) and decided on 2026-11-15: **sounds are
made ahead of time and shipped with the app as files, not generated as it plays.** AI generators may be used now,
to make those files.

## What plays today
Everything is made by the browser as it plays, so nothing has to be licensed:

| Where | Sound today | Code |
|---|---|---|
| Every screen | `tap`, `fill`, `undo`, `nothing`, `cheer`: one to three sine tones, under 300 ms | `src/shell/sound.ts` |
| Driving | An engine per vehicle (oscillators, filter and throb following speed), bumps, splashes, tyre squeal, brake squeak, horn | `src/games/racing/sound.ts` |
| Letters | Letter names by Windows speech, or a parent's own recordings | `src/games/letters/voice.ts` |

## What needs a file
Roughly 70 to 90 short files. Sizes assume compressed audio. The total stays under about 3 MB, so updates stay
small.

**Shell and coloring (about 10)**
- **Tap:** a soft wooden or bubble click. This is the most-heard sound, so it must never get tiring.
- **Fill:** a bright "bloop" with a little sparkle.
- **Undo:** a soft reverse swoosh.
- **Nothing:** a very quiet low "boop" for a touch that does nothing.
- **Cheer:** a short chime run, for a finished letter and maybe a finished page.
- **Optional:**
  - A crayon-scribble loop while a finger draws.
  - A sticker "pop".
  - A page-turn when opening a page.
  - A gentle "whoosh" on the home screen.

**Letters (about 40)**
- **Names:** A to Z and 0 to 9, said once each, plus a slower version of each if it sounds better.
- **Praise:** three or four short words, picked at random: "Yay!", "You did it!", "Great job!". These are
  spoken, not shown, so ADR 0003's no-text rule still holds.
- **Phonics:** letter sounds ("buh" for B) are for later, if the owner wants them.
- **Parent recordings** stay as an override (ADR 0026).

**Driving (about 30)**
- **Engines:**
  - One loop per vehicle (car, police, monster truck, bus), 1 to 2 seconds long, recorded at idle.
  - Speed bends the pitch (playback rate) and opens a filter, as today.
  - Optionally, a second "revving" loop per vehicle, faded in as it speeds up.
- **Horns:** one per vehicle, plus the police siren.
- **Effects:**
  - Tyre squeal and brake squeak.
  - A bump for each prop: cone, box, beach ball, hay bale.
  - Water: puddle splash, flood splash, and a wading loop.
  - For features in the driving plan that aren't built yet:
    - Car wash bubbles.
    - The ramp: a jump and a landing.
    - An answer for each animal that replies to the horn.
- **New vehicles** from the driving plan ([milestone-3-driving.md](milestone-3-driving.md)) each add an engine
  loop, a horn and one special sound.

**Music (optional)**
- One calm loop for the home screen and maybe one per game.
- Off by default; a parent setting.
- Toddler apps often skip music, because it competes with the sounds a kid's own actions make.

## Where the files can come from
The repo is public (ADR 0013), so **every sound file in it can be downloaded on its own.** ADR 0011 therefore
needs a license that allows redistributing the file itself, not just using it inside a game. This rules out most
paid sound packs.

| Option | Good for | Cost | License fit for a public repo | Quality / effort |
|---|---|---|---|---|
| **1. CC0 libraries:** Kenney's audio packs (*Interface Sounds*, *UI Audio*, *Impact Sounds*), Freesound filtered to CC0, OpenGameArt filtered to CC0 | Taps, clicks, bumps, chimes | Free | **Clean.** CC0, no attribution needed; list them in `CREDITS.md` anyway | Good for UI and impacts; engines and voices are hit or miss. Hours of browsing |
| **2. AI sound effects, local: Stable Audio Open** on your own GPU, weights from Hugging Face | Engines, splashes, bubbles, animals, ambience | Free (your GPU) | **Good.** Stability's Community License: free under $1M a year in revenue, and you own the outputs. Trained on CC-licensed audio | Good for effects and textures, weak for voices and music. Prompt, make 4 to 8 takes, pick one. Clips up to about 47 s |
| **3. AI sound effects, hosted: ElevenLabs Sound Effects** (web, text to effect, has a loop option) | Everything except music; strongest at specific effects and clean loops | Starter plan, about $6 a month, for a month or two | **Check first.** Paid plans allow commercial use without attribution; the free plan needs attribution. Whether its terms allow the raw files in a public repo must be read before committing any | Best and fastest of the effect options |
| **4. AI voice, local: Kokoro** (a small open text-to-speech model, Apache 2.0) | Letter names, numbers, praise | Free | **Clean.** You own what it says | Natural voices, runs on the CPU. One voice used for every clip |
| **5. AI voice, hosted: ElevenLabs text to speech**, a stock voice, never a clone of a real person | Letter names, numbers, praise | Same subscription as option 3 | Same check as option 3 | The most expressive "Yay!" |
| **6. Retro synth tools** (jsfxr style), rendered once to files | Filling gaps: pops, blips, sparkles | Free | **Clean.** The output is yours | Bleepy, game-like. Minutes per sound |
| **7. Record it yourself** (foley): crayon on paper, toy cars, bath water, a squeaky toy, a parent's "Yay!" | Anything with a real-world sound; the most charming option | Free; a quiet room and a phone | **Clean.** Original. Keep kids' voices out (privacy rule) | Hit or miss; clean-up needed |
| **8. AI music:** Suno or Udio paid plan, or Stable Audio | Background music only | A paid month | Check each service's terms the same way as option 3 | Only if music is wanted at all |

**Not recommended:**
- Meta's AudioGen: its weights are non-commercial, so output use is unclear.
- The free tiers of hosted tools: they need attribution or forbid commercial use.
- Commercial packs such as the Sonniss GDC bundle: their licenses cover use in a game, not loose files in a
  public repo.

**Fallback if a source can't go in the repo:** CI could fetch the sound files from a private store using a secret,
so they ship in the installer but never sit in the repo. This adds a moving part, so use it only if a must-have
sound needs it.

## Recommendation (to react to)
- **UI and coloring:** Kenney CC0 packs first. Fill gaps with a synth tool or Stable Audio Open.
- **Driving:**
  - Engines and effects from **Stable Audio Open** (free, clean license).
  - Use **ElevenLabs** only where Stable Audio can't get it right, and only after its terms pass the public-repo
    check.
  - Engine loops stay pitch-bent by speed in code, so each vehicle still responds as it does now.
- **Letters:**
  - One **Kokoro** voice for every letter, number and praise word, so the app has a single consistent narrator.
  - Parent recordings keep overriding it.
- **Music:** none at first.
- **Process:**
  - Every sound gets a line in a manifest (`assets/sounds/sounds.json`): its id, file, source, license, and the
    model and prompt if AI-made.
  - A small dev-only audition page plays the 4 to 8 takes for each sound side by side, so the owner picks by ear
    in one sitting.
  - Everything is levelled to one loudness, so no sound jumps out.
  - Format: AAC or MP3 for one-shots (they play everywhere). Loops are cut at exact loop points and played
    through Web Audio, so they repeat without a gap.
- **Code:**
  - One shared sound bank loads the files when a game opens.
  - The shell's `Sound` contract carries the new names.
  - The driving game's on/off switch also follows the app-wide Sounds switch (left open in ADR 0025).

## Decisions for the owner
1. **Overall feel:** soft and woody (xylophone, bubbles) or bright and toy-like (chimes, boings)? It can differ
   per game.
2. **Sources:** OK with the recommended mix? Should one ElevenLabs month be used, after its terms check out?
3. **Narrator voice:** one AI voice for letters, numbers and praise (which accent and tone), or record a parent?
   (Parent recordings can stay per family either way.)
4. **Praise:** spoken words ("Yay!") or sounds only?
5. **Engines:** realistic, toy-like (like a kid making vroom noises), or in between? Should the kid's own engine be
   louder than today?
6. **Music:** none, home screen only, or per game? Off by default?
7. **Extras:** a crayon-scribble loop while drawing? Animal answers (which animals)? A police siren?

## Sources found for the listening test (2026-11-15)
**Real recordings that can go in the public repo (CC0):**
- **[OpenGameArt](https://opengameart.org)** CC0 packs used on the audition page:
  - *51 UI sound effects* (Kenney's UI SFX Set)
  - *100 CC0 SFX* and *30 CC0 SFX loops*
  - *40 CC0 water / splash / slime SFX* and *6 Short water splashes*
  - *3 Pop Sounds*, *Bell dings/chimes*, *Bicycle Horn* and *Sheep Baa*
  - *[racing car engine sound loops](https://opengameart.org/content/racing-car-engine-sound-loops)*

  Check every page's license: some uploads are CC-BY or CC-BY-SA. *Farm animals*, *Bubble Pop* and *Writing
  Scribbles* were skipped for that reason.
- **Kenney** (*Impact Sounds* and *Interface Sounds*, CC0) is still worth adding. His site only gives downloads
  through the browser.
- **Freesound** filtered to CC0 has the most real recordings (engines, farm animals, crayon on paper). Full-quality
  downloads need an account (OAuth2 in the API).

**Ruled out for files in a public repo:**
- **Pixabay:** [no standalone redistribution](https://pixabay.com/service/terms/), apart from uploads published
  before 2019-01-09.
- **BBC Sound Effects:** free use is non-commercial only.
- **Sonniss GDC bundles:** no standalone redistribution.

**AI through OpenRouter** (one key, on the family server, ADR 0029):
- **Voices:** the [speech endpoint](https://openrouter.ai/docs/guides/overview/multimodal/tts) works like
  OpenAI's. Tried on 2026-11-15:
  - ElevenLabs v4 (Matilda, Sarah, Lily, Charlie)
  - Gemini 3.8 Flash TTS (Aoede, Kore, Achird, Puck; returns 24 kHz PCM only)
  - MAI-Voice 2.1 (Harper, Olivia, Emily, Jasper)
  - MiniMax 2.8 HD (Upbeat Woman, Friendly Person)
  - Kokoro (Heart, Emma)
  - Grok (Eve)

  Gemini and ElevenLabs take delivery directions, as instructions and as tags like `[excited]`.
- **Sound effects:** ByteDance's **Seed Audio 1.0** turns a description into audio. It made usable engines,
  animals, crayon and water. Its output terms are not confirmed yet.
- **Music:** Google's Lyria 3, if music is ever wanted.
- **ElevenLabs retires its default voices**, Matilda among them, on 2026-12-31
  ([ElevenLabs](https://elevenlabs.io/docs/help-center/product/voice-customization/my-voices/what-are-default-voices)).
  Shipped files keep working.
- **The key's credit limit** stopped some parallel requests (a 402 error for the in-flight budget). One request at
  a time worked.

## Sources checked (2026-11-15)
- **ElevenLabs:** [sound effects, commercial use](https://elevenlabs.io/sound-effects/commercial) and
  [sound effects terms](https://elevenlabs.io/sound-effects-terms).
- **Stable Audio Open:** the [model card](https://huggingface.co/stabilityai/stable-audio-open-1.0),
  [Stability's licenses](https://stability.ai/license), and the
  [research paper notes](https://stability.ai/news/stable-audio-open-research-paper).
- **Kenney's CC0 audio:** [kenney.nl/assets](https://kenney.nl/assets), filtered to audio.

Check each license again on the day files are made. Terms change.
