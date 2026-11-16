# 0039. Writing words: the kid's own name first, then short words, one big letter at a time

- Status: Accepted (2026-11-15). The owner took the recommendation on every choice in the
  [table below](#decisions-for-the-owner) (W1 to W10), with the pictures (W9) capped at $8 of AI calls, and
  accepted it without mockups: the built screens are judged instead. The words batch ships take 1 of every line
  (as for letters); for each slow word the stretched take is used and the other kept beside it, so a word can be
  swapped after listening
- Date: 2026-11-15
- Builds on: [ADR 0026](0026-letter-practice.md), [0028](0028-letter-tracing-whole-letter-and-confirm.md),
  [0032](0032-sounds-as-files.md) and [0037](0037-letters-sound-tips-and-how-to.md). Supersedes nothing

## Context
The owner asked (2026-11-14, again 2026-11-15) for a way to write words, the next level after single letters. ADR
0026 covers single letters only. The research is in [research/words-learning.md](../research/words-learning.md).
In short:
- The kids are 4 and under. Sounding out a word alone comes at about 5 to 6, so a kid must be able to finish a
  word with no reading and no blending. The sounds ride along for when a kid is ready.
- A child's **own name** is the first word they write, and its first letter is the first one they use for its
  sound.
- Sounds teach best **with the letters in front of the child**, with one or two things to do (say the sounds, join
  them), and with the word said **stretched** rather than chopped.
- A row of **boxes, one per letter**, shows how long a word is and which letter is next.
- A **picture** gives a word its meaning for a kid who can't read, but beside the letters it can pull eyes away.
- The well-regarded apps do the same few things: one word at a time, huge letters, each letter says its sound, no
  buzzer, one celebration, and a parent can add the family's own words.

Two limits from earlier decisions:
- **The narrator's voice ends on 2026-12-31** (ADR 0037). ADR 0037 already makes 24 words, "Now the next letter."
  and "You wrote a word!". Any other line this design needs has to join that batch: the second run is planned for
  2026-12-06 and the last for 2026-12-13.
- Kid screens show no text (ADR 0003). A word's letters are the content, like letter tiles in ADR 0026.

## Decision (proposed)
### Where it lives
- **A third tile, Words, on the Letters start screen**, beside Practice and Game (ADR 0026). It is part of the
  Letters game (`src/games/letters/`), not a new game: same tracing screen, checker, hint ladder, sounds and
  parent screen. A parent turns Words on per kid; it is off at first.

### What the kid picks from
One screen of big picture tiles, in this order:
1. **My name**: the kid's own badge and photo (ADR 0018). Always first.
2. **Family words**, if a parent has added any (below).
3. **The built-in words**: the 24 short words of ADR 0037, each tile a picture, no text. Every word is open; the
   order puts words that start with a sound that can be held first (sun, sat, map, mud, run, red), then the rest.
A finished word's tile gets a star, like a letter's.

### Writing a word
1. **The word opens.** Its picture fills the middle and the narrator says the word. The picture then shrinks into a
   corner and a **row of empty boxes** appears along the top, one per letter, the first one pulsing.
2. **One letter at a time, full size.** The current letter fills the tracing screen exactly as in letter practice:
   the pale road, start dots, arrows, the hint ladder and sounds of ADR 0037, the whole-letter rule of ADR 0028.
   The narrator says the letter the way the family's saying setting asks (name, name then sound, or sound).
3. **A traced letter goes into its box.** When the letter is fully traced the stroke chime plays and **the kid's own
   crayon line** shrinks and drops into its box: never a tidy font letter (their own wobbly letter is the useful
   part, letters research 1.1). The next box pulses and the next letter opens. "Now the next letter." is said the
   first few times only. There is no check button between letters.
4. **The word is done.** The row of boxes grows to the middle of the screen, showing the whole word in the kid's
   own hand. The narrator says it slowly, each box lighting up as its sound passes, then says it normally. The
   green check appears (ADR 0028). Tapping it plays the cheer, "You wrote a word!", brings the picture back big with
   a small bounce, and gives the tile its star. An arrow goes to the next word; back goes to the word tiles.
5. **No failure**, as everywhere: marks off the letter just stay, wipe restarts the current letter only, and the
   boxes already filled are kept. Leaving in the middle loses nothing but the word in progress.
- A kid can **tap a filled box** at any time to hear that letter again.

### The kid's own name
- The letters come from the profile name a parent typed (ADR 0018). Letters A to Z are traced; a space, hyphen or
  apostrophe shows as a gap and is skipped; an accented letter is traced as its plain letter. A long name makes
  the boxes smaller, never the letter being traced.
- The app's narrator can't say a name. **A parent records it** on the parent Letters screen, next to today's letter
  recordings; without a recording the word plays the cheer and "You wrote your name!".
- The name, its recording and the photo stay on the device and the family's own sync server (ADR 0018, 0024).
  They never reach the repo, a file name or any outside service: a name is never sent to an AI voice.

### Family words
- On the parent Letters screen a parent types words for the family (people, pets, a favourite thing), each with an
  optional recording and an optional photo for its tile. Without a photo the tile shows the word's letters.
- Saved one file per word (`words/<id>.json`, so sync settles each on its own, ADR 0024) with recordings under
  `voice/`. Shared by all kids on the device.

### Capitals or small letters
- Words follow the sets a parent turned on for the kid (ADR 0026): **capitals** while small letters are off;
  with small letters on, words are small letters and names are a capital then small letters.

### Sounds
- Reused from ADR 0037: letter names and sounds, the 24 words, the stroke chime, the drawing sound, tips, praise.
- **The slow word.** First choice: one stretched take per word made with the narrator ("sssuuunnn"), picked by ear.
  If the voice can't do it well, the app plays the letters' sound clips one after another, then the word.
- New narrator lines, to make before the voice ends: see [below](#narrator-lines-to-add-before-2026-12-13).

### Pictures
- One small colour picture per built-in word, all in one style, original or made with the AI page tools and
  checked by a person (ADR 0011, 0022). The words that aren't things get a simple scene (a bunny for "hop").
- The picture shows before the first letter and after the check, not while a letter is being traced.

### Saved
- Per kid, in the Letters game's storage: which words have a star. Nothing of the traces. A parent's reset of a
  kid's stars also clears the word stars.

### Later steps, not in the first build
1. **Build it:** the same boxes with the word's letters as big loose tiles below. Touching a tile says its sound;
   dragging it near its box drops it in; a tile dropped on the wrong box slides back with no sound. Then the slow
   word and the cheer. First only the word's own letters, later one or two extra ones.
2. **Less help on a word done before:** thinner roads, then dots only, then the word shown small with empty boxes
   to write in. This follows the fading planned for letters (letters plan, phase F) and waits for the same playtest.
3. **Write it your way** (5 and up): the picture and the spoken word, empty boxes, any letters count, then the
   word shown beside the kid's try. Its own ADR.

### Not built
- No on-screen keyboard, timer, score, spelling test, sentences or sight-word drills (ADR 0003, 0012).

## Narrator lines to add before 2026-12-13
**Settled by the owner on 2026-11-15 (W1): add them.** They are the `words` batch of `tools/sounds/generate.mjs`
(`ONLY=words`), made like the rest of ADR 0037's lines: three takes each, picked by ear on the audition page, run
the way the letters plan's phase A describes. Made on a guess, as that ADR accepted for its word lines; a line
never used costs a few cents.

| Group | Clips | Lines |
|---|---|---|
| Name | `word-your-name` · `praise-your-name` | "Let's write your name." · "You wrote your name!" |
| Words | `word-lets-write` · `word-listen` · `word-tap-letter` · `word-again` | "Let's write a word." · "Listen." · "Tap a letter to hear it." · "Let's write it again." |
| Build it (later step 1) | `build-word` · `build-boxes` | "Build the word." · "Put the letters in the boxes." |
| Your way (later step 3) | `way-your-way` · `way-what-sound` · `way-starts-with` | "Write it your way." · "What sound does it start with?" · "It starts with…" |
| More words (spares) | `word-<word>` | mom · dad · car · van · jet · zoo · bee · yes · no · hi · go · up · baby · love · truck |
| Slow words | `slow-<word>` and `slow-<word>-alt` | the 24 words of ADR 0037 and mom, dad, van, jet, yes |

- **Each slow word is asked for two ways**, because it is not known which the voice does well: `slow-<word>` reads
  a stretched spelling ("sssuuunnn": sounds that can be held are written three times, b, c, d, g, j, p, t and x
  once), and `slow-<word>-alt` is the plain word with only the direction to draw it out. One of each pair is
  picked by ear and the other left. If neither is good, the app plays the letters' sounds in a row instead.
- The other spare words (car, zoo, bee, no, hi, go, up, baby, love, truck) have no slow take: their letters don't
  each make their usual sound.
- 11 lines, 15 spare words and 58 slow takes: **84 lines, 252 requests**, about what the letters batch cost.

## Decisions for the owner
| # | Decision | Options | Recommended | Needed by |
|---|---|---|---|---|
| W1 | **More narrator lines** | the table above, edited · only ADR 0037's 26 | **Add them**. **Settled 2026-11-15: added as listed.** A word the family wants said by the narrator can still join until the last run | the run itself by **2026-12-13**, the last planned one |
| W2 | Where Words lives | a third tile in Letters · its own game on the home screen | **In Letters**: same screen, checker and settings | before building |
| W3 | How a word is laid out | one big letter at a time with a row of boxes · the whole word across the screen · across only for words of three letters | **One big letter**: a name of eight letters across the laptop's screen leaves letters too small for a finger | before mockups |
| W4 | Finishing | letters move on by themselves, one check for the word · a check after every letter (as in ADR 0028) | **One check per word**: four checks for a three-letter word is a lot of tapping | before mockups |
| W5 | The name as the first word | yes, from the profile · no | **Yes**; a parent records how it is said | before building |
| W6 | Which words are open | all of them · only words whose letters all have a star (the letters plan's outline) | **All open**, in an easy order: a kid who wants "bus" gets "bus" | before building |
| W7 | Capitals or small letters | follow the kid's letter sets · always small letters | **Follow the sets** | before building |
| W8 | Family words | in the first build · later · never | **First build**: names matter most to the kids, and the best-known tracing app sells this as an add-on | before building |
| W9 | Pictures for the 24 words | AI-made in one style, checked · reuse coloring pages where one fits · no pictures | **AI-made in one style**; only five words have a matching coloring page | before building |
| W10 | Build it (letter tiles) | after the first playtest · in the first build · never | **After the first playtest** of tracing words | later |

## Consequences
- Small in code: the tracing screen, checker, hints and sounds are reused; new are the word tiles, the row of
  boxes, shrinking a trace into a box, the slow-word playback, the name and family words in the parent area.
- A second narrator spend in early December 2026, on a guess about what later steps need.
- 24 pictures to make and check, and family words add typing, recording and photos to the parent Letters screen.
- A three-letter word is three full letters to trace under ADR 0028's whole-letter rule. Whether a kid of 3 or 4
  stays to the end is not known; the first playtest decides whether words need a gentler rule than single letters.
- Nothing here teaches a kid to read by itself. It gives them their name, the idea that words are letters in a row,
  and the sounds; the parent area should say so, and suggest a name card and crayons on paper.
- Still open, for a playtest: the easy order, how often "Now the next letter." is said, whether the slow word
  helps or is just odd, and whether the picture in the corner distracts.
