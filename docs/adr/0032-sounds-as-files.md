# 0032. Sounds ship as files: recorded CC0 sounds, AI-made gaps, one AI narrator

- Status: Accepted (by the owner, 2026-11-15, after settling the open choices)
- Date: 2026-11-15
- Supersedes: in [ADR 0016](0016-visual-design-language.md), sounds made from tones with no
  files; in [ADR 0025](0025-driving-game-toy-look-and-engine-sounds.md), engine voices built from oscillators; in
  [ADR 0026](0026-letter-practice.md), letter names said by Windows speech. Everything else in those ADRs stands.

## Context
The owner found the app's sounds and voices not good enough (known bugs, 2026-11-14) and decided on 2026-11-15
that sounds are made ahead of time and shipped as files. [sound-options.md](../sound-options.md) lists where files
can come from. The owner then picked by ear on an audition page with three kinds of sample:
- 90 real CC0 recordings from OpenGameArt, including Kenney's UI set;
- 17 AI narrator voices made through OpenRouter;
- 26 AI sound effects from ByteDance's Seed Audio 1.0.

The owner starred recordings and AI takes and picked one voice. The page's first-round options (synthesized
"feels", device voices) were superseded by those picks (owner, 2026-11-15).

## Decision
- **Every sound is a file**, shipped with the app, levelled to one loudness, and listed in a manifest
  (`assets/sounds/sounds.json`): id, file, source, license, and for AI-made ones the model and prompt. One shared
  sound bank loads them; the shell's `Sound` contract keeps its names. Loops are cut at clean loop points and
  played through Web Audio.
- **Touch sounds** are real recordings (CC0, OpenGameArt):

  | Sound | File | From |
  |---|---|---|
  | tap | `click1` | Kenney's *UI SFX Set* (via OpenGameArt *51 UI sound effects*) |
  | nothing | `click1`, played quieter and lower | as tap |
  | fill | `pop1` | *3 Pop Sounds* |
  | undo | `rollover1` | Kenney's *UI SFX Set* |
  | cheer (finished letter or page) | `bell1` | *100 CC0 SFX* |
  | page turn | `paper2` | *100 CC0 SFX* |

- **Narrator: ElevenLabs v4, voice Matilda**, through OpenRouter. Every letter A to Z, numbers 0 to 9 and the praise
  words are made in one batch. Letters are asked for warm and slow, praise for excited. A finished letter plays
  the cheer, then one praise word picked at random ("Yay!", "You did it!", "Great job!", "Wow!"). A parent's own
  recordings still override the letter names (ADR 0026). ElevenLabs retires its default voices, Matilda among them, on 2026-12-31, so the
  full set is made before then. Shipped files keep working after that; any later additions use Matilda's named
  replacement (*Maisie*) or a new voice for the whole set.
- **Engines are recorded loops**, one per vehicle, from Seed Audio: take 1 for the car, police car and bus, take 2
  for the monster truck. Each is cut to a seamless idle loop. OpenGameArt's CC0 *racing car engine sound loops*
  are the fallback for the car. Speed still bends the pitch (playback rate) and opens a filter, as in ADR 0025.
  The kid's own engine stays as loud as today.
- **The police car's horn button plays a short siren.** None of the samples was a police siren. One is made like
  the other AI sounds (Seed Audio, or ElevenLabs Sound Effects), and the owner picks a take by ear.
- **Driving effects:**

  | Sound | File | From |
  |---|---|---|
  | puddle splash | AI take 2 | Seed Audio |
  | big splash | `splash05` | *40 CC0 water / splash / slime SFX* |
  | car wash | AI take 2 | Seed Audio |
  | prop bump | `box` | *100 CC0 SFX* |
  | horn | `bike-horn` | *Bicycle Horn* |
  | boing | `spring3` | *100 CC0 SFX* |

- **Animals answering the horn:** cow, duck and dog from Seed Audio (take 2 each). The sheep is the CC0 *Sheep Baa*
  recording, or the AI take 2.
- **Coloring:** a crayon-scribble sound while a finger draws, from the Seed Audio takes.
- **Music:** none.
- **Making the AI files:** a dev script runs inside the family server's container and uses its OpenRouter key
  ([ADR 0029](0029-ai-pages-through-the-family-server.md)), so the key never leaves the server. Only the audio
  comes back. The script and its prompts live in the repo; the key does not.
- **Licensing** ([ADR 0011](0011-line-art-licensing.md)):
  - CC0 files are listed in `CREDITS.md`.
  - ElevenLabs output from paid use belongs to the user, with commercial use and no attribution
    ([terms](https://elevenlabs.io/terms-of-use)). OpenRouter defers to each model maker's terms.
  - **Seed Audio files are committed only after its terms are confirmed** to allow redistributing the output. No
    ByteDance or BytePlus terms for it were found on 2026-11-15; hosts such as fal say commercial use is allowed.
  - If the terms don't allow redistributing the files, each Seed Audio sound is replaced: with a CC0 recording
    where one is good enough, else with ElevenLabs Sound Effects, else from a private store CI fetches with a
    secret.

## Settled by the owner (2026-11-15)
- **Tap:** `click1` (not the AI wooden tap).
- **Cheer:** `bell1` (not the AI xylophone).
- **Nothing:** `click1`, quieter and lower.
- **Praise:** the cheer, then a spoken word.
- **Engines:** take 1 for the car, police car and bus; take 2 for the monster truck. Loudness as today.
- **Siren:** yes, for the police car.

## Consequences
- The app sounds like real things, at the cost of about 3 to 5 MB of audio in the installer and the repo.
- Live speech and oscillator code go away, apart from the parent-recordings path.
- AI sounds depend on a terms check; until it passes, Seed Audio files stay out of the repo.
- More letters or praise words in Matilda's voice can't be made after 2026-12-31. Adding to the set later may
  mean regenerating all of it in a new voice.
