# Letters: sound, tips and how-to, then words (plan)

Section 5 of the [to-do list](todo.md), planned 2026-11-15 on the owner's request ("a detailed plan with lots of
research. What helps kids?"). The research is in [research/letters-learning.md](research/letters-learning.md);
the decision this plan asks for is [ADR 0037](adr/0037-letters-sound-tips-and-how-to.md) (Proposed). Writing
words gets its own ADR later (phase G).

This is a plan, not a decision: phases can be reordered or split. **The owner took every recommendation in the
[decisions table](#decisions-for-the-owner) on 2026-11-15.**

**Ground rules** for everything below: kid screens show no text, only the letter itself, icons and the narrator
(ADR 0003); every sound is a file (ADR 0032); nothing in the repo identifies the kids (CLAUDE.md). A kid's name
from the profile stays on the device (ADR 0018).

## Where it starts (2026-11-15)
Built in `src/games/letters/` (ADR 0026, 0028, 0032): one big letter as a pale road; pulsing green start dots,
arrows, and a pressing finger on the first dot; after 8 seconds of nothing a fingertip runs along the next stroke
(`IDLE_MS`, `showHint` in `game.ts`); dots on what is left when a kid lifts with half the letter done (`LEFT_FROM`);
a check button once it is all traced; then the bell, the letter's name and one praise word. Narrator clips in
`assets/sounds/voice/`: A–Z (also used for small letters), 0–9, four praise words, all ElevenLabs v4 voice
Matilda through OpenRouter, made by `tools/sounds/generate.mjs` in the sync server's container. Letters is off
until a parent turns on "Show Letters". Not yet playtested with the kids.

## What the research says, in short
- **Tracing is the right start, not the end.** Kids who write letters freehand learn them better than kids who
  trace (research 1.1). So: trace first with lots of help, fade the help, and later draw the letter beside a model.
- **Fingers did best** on a tablet (2.1); keep fingers first. "Wrong" signals don't teach (2.1); no buzzer.
- **Same words for the same stroke** ("Down.", "Across.", "Around.") plus start dots and arrows is the best
  classroom evidence there is (1.4).
- **Most help first, then fade; wait a few seconds** before a hint (3.1). A simple fixed ladder is enough;
  clever adaptive help did not replicate (3.2).
- **Praise what the kid did**, once per letter (4.1). Today's words are fine; add a few about the effort.
- **Short spoken lines, one action each** (5.2). Under about 3, kids follow a person, not the app (5.1): the
  parent area should say that sitting with the youngest is what helps.
- **Names and sounds together** works slightly better than either alone (1.6); families differ, so a setting.
- **Lines and shapes come before letters** (1.3): many of the kids are too young for slants and crossings.
- **Sounds must belong to the trace** (5.3): drawing, a stroke done, the letter done. Nothing extra.
- **Words come in the order** own name, short words from known letters, then much later "your own way" (1.7).

## The narrator deadline (read first)
ElevenLabs retires its default voices, Matilda among them, on **2026-12-31**; after that they can't be used at all.
Its suggested replacement for Matilda is *Maisie – Friendly Casual Neighbor*, "not a strict 1-to-1 replacement"
([ElevenLabs help page](https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-default-voices),
checked 2026-11-15). Files already made keep working (ADR 0032). So every line any phase below needs, including
words (phase G) and the later levels (phase F), is made in **one batch now**, with spares, even though the code
that plays some of them comes months later.

### Schedule
| By | What | Who |
|---|---|---|
| 2026-11-15 (Sun) | This plan, the research and ADR 0037 (Proposed) in a PR | Claude |
| ~~2026-11-21 (Sat)~~ | Owner decides D1 to D12: **done 2026-11-15**, every recommendation taken | Owner |
| 2026-11-25 (Wed) | `generate.mjs` gets the new lines; one run in the container: 3 takes of every line, plus 10 sample lines in Maisie for comparison; the audition page. **Done 2026-11-15:** 246 takes and the 10 Maisie samples, no errors, about $0.34 on the server's key; the takes are on the laptop in `C:\tmp\gen3` (not in the repo) | Claude, on the owner's request |
| 2026-11-29 (Sun) | Owner picks a take of every line by ear; flags lines to redo | Owner |
| 2026-12-06 (Sun) | Second run: redos and any lines the owner added; `prepare.mjs`; clips committed | Claude |
| 2026-12-13 (Sun) | **Last planned run:** lines found missing while building phases B–D | Claude |
| 2026-12-20 (Sun) | Emergency run only; leaves 11 days for an outage at OpenRouter or ElevenLabs | Claude |
| 2026-12-31 (Thu) | Matilda gone. Building can go on into 2027 with the files in hand | |

Run early because OpenRouter might lose access to the default voices before the last day (they are only for
ElevenLabs accounts made before March 2026, per the same page), and because an outage in late December would
leave no time.

### If a line is missed, or for a new voice later
| Option | Good | Bad |
|---|---|---|
| **1. Matilda now, with spares** (recommended) | Same voice as today's 40 clips; one batch of about 80 lines; nothing to redo | The set is frozen on 2026-12-31: any new line after that means a parent recording, or option 2 or 3 for everything |
| 2. Maisie for the whole set now | Lasts past 2026-12-31; new lines can be added later | Remake today's 40 clips too (about 120 lines); a different voice to audition and get used to; Maisie is also a library voice and could be retired one day |
| 3. A voice the family's account owns (ElevenLabs Voice Design) | Can't be retired by ElevenLabs; new lines any time | Not known whether OpenRouter can use a custom voice; may need a direct ElevenLabs key on the server (a change to ADR 0029); remake everything; more cost |
| 4. Another model's voice from the 2026-11-15 audition | No ElevenLabs dependency | Remake everything; the owner preferred Matilda |

The 10 Maisie samples in the first run make option 2 a known sound, not a guess, if it is ever needed.

### The line list (D2)
Lines are short, warm, one action each (research 5.2). Each is asked for like today's (`[warmly]` for most,
`[excited]` for praise). Ids are the clip names under `assets/sounds/voice/`.

**Letter sounds** (`sound-A` … `sound-Z`, 26), for the "name then sound" and "sound only" settings (phase B).
These are spellings for the AI to read, not text a kid sees; the takes will be picked by ear, and a parent's own
recording can replace any of them. Short, clean sounds where the letter allows ("mmm", not "muh"):

| | | | | | | |
|---|---|---|---|---|---|---|
| A "ah" (apple) | B "buh" | C "kuh" | D "duh" | E "eh" | F "fff" | G "guh" |
| H "hhh" | I "ih" | J "juh" | K "kuh" | L "lll" | M "mmm" | N "nnn" |
| O "aw" (octopus) | P "puh" | Q "kwuh" | R "rrr" | S "sss" | T "tuh" | U "uh" |
| V "vvv" | W "wuh" | X "ks" | Y "yuh" | Z "zzz" | | |

A and O may need the example word to come out right; if so the clip is "ah… apple" and the plan accepts that.
C and K may share one file.

**Tips** (`tip-…`, 6), phase C:
- `tip-start-dot`: "Start at the green dot."
- `tip-top`: "Start at the top."
- `tip-follow-arrow`: "Follow the arrow."
- `tip-keep-going`: "Keep going!"
- `tip-next-line`: "Now the next line."
- `tip-tap-check`: "Tap the check!"

**Stroke words** (`stroke-…`, 6), said as the fingertip or the demo draws a stroke; picked from the stroke data
(phase C):
- `stroke-down`: "Down." · `stroke-across`: "Across." · `stroke-slant`: "Slant." · `stroke-around`: "Around." ·
  `stroke-down-over`: "Down, up and over." (b h m n p r) · `stroke-dot`: "Dot." (i j)

**How-to demo** (`demo-…`, 2), phase D: `demo-watch`: "Watch me." · `demo-your-turn`: "Your turn!"

**Praise about the effort** (`praise-…`, 4 more beside today's 4), phase B:
- `praise-all-the-way`: "You went all the way!" · `praise-kept-going`: "You kept going!" ·
  `praise-whole-letter`: "You traced the whole letter!" · `praise-by-yourself`: "All by yourself!"

**Lines and shapes** (`shape-…`, 5), phase E: "Line." · "Circle." · "Cross." · "Square." · "Triangle."

**Later levels, spares** (`level-…`, 2), phase F: `level-draw-it`: "Now you draw it." · `level-draw-here`:
"Draw it here."

**Words** (`word-…`, 24 short words, plus 2 lines), phase G. Three-letter words a 4 year old knows, that can be
pictured, made of letters with clear sounds: cat, dog, sun, bus, pig, hat, cup, bed, box, fox, hen, bug, map,
pan, pin, sat, tap, top, red, run, hop, big, mud, jam. Plus `word-next-letter`: "Now the next letter." and
`praise-a-word`: "You wrote a word!" The list is final (owner, 2026-11-15).

**Total:** 26 + 6 + 6 + 2 + 4 + 5 + 2 + 26 = **77 lines**, plus 5 extra takes of the short vowels with their
example word (`sound-A-alt` "ah… apple", and E egg, I igloo, O octopus, U umbrella), so the owner can pick the
plain sound or the one with the word: **82 lines**, 3 takes each (246 requests), plus 10 Maisie samples.
The letter's name when it opens (phase B) reuses today's clips; no new lines.

**Coloring screen lines** (added 2026-11-15, asked by the owner): to-do section 2's "buttons a kid can work out"
will want each coloring button's name said and a short demo; its design isn't settled, but the clips must be in
Matilda's voice, so they go in the same schedule. `ONLY=coloring` in `generate.mjs`, 3 takes each, into
`/tmp/gen3/coloring/`, picked on the same audition page. **Made 2026-11-15:** 120 takes, no errors, about $0.13. 40 lines:
- Tools (`tool-…`): "Paint bucket." · "Brush." · "Eraser." · "Undo." · "Start over." · "Back."
- What they do (`do-…`): bucket "Tap a space to fill it." · brush "Draw with your finger." · eraser "Rub it out." ·
  undo "Take it back." · start over "A fresh page."
- Sizes and modes: `size-small` "Small." · `size-medium` "Medium." · `size-big` "Big." · `mode-free` "Color
  anywhere." · `mode-lines` "Stay in the lines."
- Colours (`color-<token>`, the 24 in `src/ui/palette.ts`, said by their labels): "Light pink.", "Pink.", "Red." …
  "Black.", "Rainbow."
- The demo's "Watch me." and "Your turn!" are the letters lines `demo-watch` and `demo-your-turn`.

**Maisie through OpenRouter is not certain.** OpenRouter's page for ElevenLabs v4 lists only the default voices
by name (Matilda among them), not Maisie or custom voice ids (checked 2026-11-15). The script asks for Maisie by
her ElevenLabs voice id and logs an error if that is refused. If it is, options 2 and 3 below would need a direct
ElevenLabs key on the server, and after 2026-12-31 OpenRouter may offer no ElevenLabs voice this project has used.
That is one more reason to make everything now.

---

## Phases

### A. The narrator batch (first, dated above)
- **Builds:** the line list in `tools/sounds/generate.mjs` (a second list, `ONLY=letters2`, so today's clips are
  not remade; **done 2026-11-15**); `tools/sounds/audition.mjs`, which makes a page to pick a take of each line
  and copies the picks to where `prepare.mjs` looks (**done 2026-11-15**); the picked files through `prepare.mjs`
  into `assets/sounds/voice/` and `sounds.json`. `picks.json` needs no new entries: its `narrator` entry takes
  every file in the sources folder's `narrator/`.
- **How to run it:**
  1. Check the list: `DRY=1 ONLY=letters2 node tools/sounds/generate.mjs` (no key needed).
  2. Copy `tools/sounds/generate.mjs` into the sync server's container as `/tmp/generate.mjs`, then
     `docker exec -e ONLY=letters2 <container> node /tmp/generate.mjs`. One request at a time; 256 requests.
  3. Copy `/tmp/gen3` back to the laptop (e.g. `C:\tmp\gen3`), then
     `node tools/sounds/audition.mjs page C:\tmp\gen3` and open `C:\tmp\gen3\audition.html`.
  4. Pick a take of every line (or "redo"), then "Download picks".
  5. `node tools/sounds/audition.mjs apply C:\tmp\gen3 <letters2-picks.json> <sources folder>` copies the picks
     into `<sources folder>\narrator\` and prints an `IDS=…` list for a redo run
     (`docker exec -e ONLY=letters2 -e IDS=… <container> node /tmp/generate.mjs`).
  6. `node tools/sounds/prepare.mjs <sources folder>` (the same sources folder as the first batch, so today's
     clips are kept), then commit `assets/sounds/`.
- **Files:** `tools/sounds/generate.mjs`, `tools/sounds/audition.mjs`, `assets/sounds/voice/*`,
  `assets/sounds/sounds.json` (by the tool), `src/shell/soundFiles.ts` (clip helpers: `soundClip(ch)`,
  `tipClip(id)`, `strokeClip(kind)`, `wordClip(word)`, the longer `PRAISE` list).
- **Clips:** the 77 lines above.
- **Tests:** `src/shell/sound.test.ts` already checks every shipped file has a source and license; add a test that
  every id the letters game asks for has a file.
- **Done when:** every line has a picked take committed before 2026-12-13, or a note of who will record it.
  **Done 2026-11-15:** the owner listened to every take, found no difference between them and chose take 1 of
  every line; for the short vowels the take with the word ("ah… apple") ships as `sound-A` (likewise E, I, O,
  U). 117 clips added to `assets/sounds/voice/` (letters and coloring), with `NARRATOR_ONLY=1 prepare.mjs`.

### B. More sound while tracing (built 2026-11-15)
- **Builds:**
  - The letter's **name said when it opens** (today only when tapped in the grid or finished).
  - **A drawing sound** while a finger is on the road: a soft crayon loop that plays only while the finger moves
    near the letter and stops the moment it leaves (research 2.2). Its stopping is the "off the line" signal; no
    buzzer (D4).
  - **A chime as each stroke is finished** (in stroke order, and in lenient mode when a stroke's own checkpoints
    are all covered), quieter than the finish bell.
  - **Letter sounds as a parent setting** (D3): *name* (today), *name then sound* ("B. Buh."), *sound only*. Per
    family in the Letters settings; a parent's recordings cover names today and get a second row for sounds.
  - **More praise:** the four effort lines join today's four; "All by yourself!" only when no hint past the
    pulsing dot was needed; never the same line twice in a row (research 4.1).
  - A small **line queue** in `voice.ts`: one clip at a time, nothing spoken while a finger is down (except the
    stroke words of a demo), a newer line replaces a waiting one.
- **Files:** `game.ts` (open, stroke done, drawing sound), `voice.ts` (queue, `saySound`, praise rules),
  `trace.ts` (`Tracer.near(p)`: is this point on the road; a stroke-finished event), `progress.ts`
  (`LettersSettings.saying: 'name' | 'name-sound' | 'sound'`), `parentSection.ts` (the setting, recordings for
  sounds), `src/shell/soundFiles.ts`.
- **Sounds:** drawing loop: a stand-in from `ui/crayon.wav` (the coloring scribble), raised in pitch, until a
  better take is found (sounds recipe, way A); stroke chime: `ui/tap.wav` or `ui/cheer.wav` pitched up as a
  stand-in, then a CC0 chime (way B). No new narrator lines.
- **Tests:** unit: `near` on and off the road; the stroke-finished event once per stroke; praise never repeats
  back to back; "by yourself" only without hints; the setting is saved and cleaned. Browser: the name plays on
  open (a played-clip log, as the existing tests use); the sound setting changes what is said after the check.
- **Done when:** the three sound settings work with the narrator and with a parent's recordings, the drawing
  sound stops off the road, and the app's Sounds switch silences all of it.
- **Built 2026-11-15** (not yet heard by the kids). As built, where it differs from or adds to the above:
  - The name is said in `showTrace` itself, so every way into a letter (grid, path, next arrow) uses the setting.
  - "On the road" is within 12.5 glyph units of a stroke's line (`ROAD_HALF`, the road's dark edge). The drawing
    sound also stops after 150 ms held still, since it should play only while the finger moves. It is the crayon at
    1.3 times the speed (`DRAW_RATE` in `game.ts`), and louder with speed, like coloring's.
  - The chime is the `chime` sound kind: `ui/cheer.wav` (the finish bell) at 1.6 times the speed and 0.4 gain, a
    stand-in until a CC0 chime. A stroke that finishes the whole letter gets no chime: the letter's own "ready"
    sound plays then. In lenient mode a stroke counts as traced as `done` judges it (both ends reached and 92 % of its
    own checkpoints), so the chimes and the finish agree.
  - "All by yourself!" is left out when the fingertip hint (today's 8 s idle hint) showed; the dots on what is left
    after a lift are not counted as a hint.
  - The game's own Sounds switch in the parent Letters screen also covers the drawing sound and the chimes.
  - A parent's sound recordings are one per letter (`voice/sound-a.webm` for A and a); numbers have no sound and
    always say their name.
  - The line queue lets a line that has started finish (a finger going down doesn't cut a clip off); it holds back
    the next one.

### C. A hint ladder for a kid who is stuck (built 2026-11-15)
Replaces the single idle hint. Small steps, most help last, each one shown and spoken (research 3.1), and the
whole thing in one place with its numbers, so a playtest can tune it.
- **The ladder** (waits from the last touch; D5):
  | Step | When | Shown | Said |
  |---|---|---|---|
  | 0 | the letter opens | start dot pulses, finger on it (today) | the letter's name |
  | 1 | 5 s with no progress | the dot pulses bigger, the arrow wiggles | "Start at the green dot." (or "Start at the top." when the kid started somewhere else) |
  | 2 | 5 s more | the fingertip runs along the next stroke (today's hint) | its stroke word ("Down.") |
  | 3 | 8 s more | the whole letter is shown stroke by stroke, then the start dot | the stroke words, then "Your turn!" |
  After step 3 it rests: only the dot pulses, and step 3 comes back at most twice more per letter, 20 s apart. A
  touch anywhere resets the wait but not the step reached, so the next pause goes one step further.
- **Other triggers:**
  - **Off the road:** three lines in a row that add nothing → the arrow wiggles, "Follow the arrow."
  - **Lifting early:** a stroke started and left before its end, no progress for 3 s → "Keep going!" and the
    dots on what is left (today's dots, shown from any progress, not only after half).
  - **Stroke order on, a stroke done:** the chime (phase B), the next dot pulses; "Now the next line." only from
    step 1 up.
  - **All traced, check not tapped:** the check pulses bigger at once, "Tap the check!" after 4 s, once more at
    12 s.
- **Saying less once a letter is known** (research 2.3): a letter the kid has finished twice with no hint past
  step 1 starts with waits half as long again and steps 1 and 2 without words (shown only). Step 3 keeps its words.
- **Rules:** never speak over a finger that is drawing; at most one tip every 6 s; a tip is dropped, not queued,
  when the kid has moved on; tips follow the Sounds switch but the shown part always plays.
- **Files:** new `src/games/letters/hints.ts`: the ladder as a plain state machine with no DOM (events in: open,
  down, progress, up, tick, stroke done, ready; actions out: pulse, wiggle, demo stroke, demo letter, say), with
  every number at the top; `game.ts` wires it in place of `armIdle`/`showHint`; `glyphs.ts` gets
  `strokeKind(stroke)` (down, across, slant, around, down-over, dot) from the stroke's shape; `progress.ts` keeps
  per letter how often it was finished and the highest step used (`KidProgress.help`, old files load with none).
- **Clips:** tips and stroke words from phase A.
- **Tests:** unit, with a fake clock: each step at its time; a touch resets the wait not the step; the three other
  triggers; the rest after step 3; the shorter ladder for a known letter; `strokeKind` gives the expected word for
  every stroke of all 62 glyphs (a table in the test the owner can read). Browser: a kid who does nothing sees step
  1, 2, then 3 in order; touching the letter stops a tip from being said.
- **Done when:** the ladder runs on every letter, its numbers are in one place, and the parent Letters screen has
  a switch for the spoken tips (shown tips can't be turned off).
- **Built 2026-11-15** (not yet seen by the kids). As built, where it differs from or adds to the above:
  - `hints.ts` is the state machine (`Hints`: `touch`, `down`, `progress`, `up`, `strokeDone`, `ready`, `wipe`,
    `tick`; actions `step`, `wiggle`, `left`, `check`, `say`), with every number at its top; the trace screen asks
    it every 200 ms (`TICK_MS`). Times are `performance.now()`, so unit tests pass plain numbers.
  - **The show is its own module**, `demo.ts` (`playDemo`): a fingertip draws the given strokes one after another
    in the kid's colour, saying each stroke's word, then the drawing clears. Step 2 plays it for one stroke, step 3
    for the whole letter; phase D can call it as it is. Its timing (`demoPlan`, about 75 glyph units a second, 1.1
    to 2.6 s a stroke, 0.6 s for a dot) is in `hints.ts` with the rest. A whole letter takes under 12 s.
  - **Stroke words:** `strokeKind(stroke)` in `glyphs.ts`, from the shape, with the table for all 62 glyphs in
    `hints.test.ts`. A stroke of straight lines gets a word where its way changes (`strokeWords`): L's one stroke
    says "Down." then "Across." at the corner, Z "Across.", "Slant.", "Across."; a way back up says nothing; a curved
    stroke gets one word. Calls worth a look by ear: J, U and 5 are "Down." (they start down), u is "Around.", f is
    "Around." then "Across.".
  - **"At most one tip every 6 s"** counts the `tip-…` lines only. Stroke words and "Your turn!" belong to their
    step, otherwise step 2's word would always be dropped (it comes 5 s after step 1's tip).
  - **The parent switch** ("Spoken tips", `LettersSettings.tips`, on by default) silences everything the hints say:
    tips, stroke words and "Your turn!". The letter's name and the praise follow only the Sounds switches.
  - **A tip is never kept for later:** `voice.tip()` drops it while a finger is down, and a finger going down drops
    one waiting behind another line. A touch anywhere stops a show at once, so its later words are never said.
  - **Lifting early** is a line that covered some of a stroke's own checkpoints and left that stroke untraced
    (`Tracer.lift` returns `{ added, early }`). Today's dots at half the letter still show at once on a lift; with
    less done, the dots come with "Keep going!" after 3 s.
  - "Start at the top." is said when the last finger came down away from every start dot of a stroke still to
    trace (`Tracer.atStart`, within 14 units, the dot's ring).
  - The check pulses bigger as soon as it appears (it is always "not yet tapped" then).
  - `KidProgress.help[key]` keeps `{ done, alone, top }`: times finished, times with no hint past step 1, the
    highest step ever needed. A letter is known at `alone >= 2`. "All by yourself!" is left out when step 2 or 3
    showed (the triggers beside the ladder don't count as hints for it).
  - The pressing hand on the first dot steps aside while a show runs. With less motion (the browser's setting) the
    bigger dot and the arrow are held still and larger, and the show draws each stroke whole at its turn.
  - Not built: the parent area showing the help counts; per-kid spoken tips (the switch is per family, like Sounds).

### D. The first-time how-to (built 2026-11-15)
- **Builds:** before a kid's first letter ever (and after 14 days without Letters, D7), the tracing screen opens on
  the demo letter (D6, `L`: a line down and a line across, the first two strokes small kids can make, research
  1.3). The narrator says "Watch me.", a hand traces each stroke with its stroke word ("Down." … "Across."), the
  letter clears, "Your turn!", the start dot pulses, and the kid traces the same `L`, which counts and gets its
  star. About 10 seconds. A touch during the demo ends it and starts the kid's turn at once (no waiting, no
  locked screen). It is the same screen the kid then uses, not a video (research 6.1).
- **Parent area:** "Show how to trace again" per kid, which plays it before that kid's next letter; and a short
  note for parents (parents may read): sit with the youngest and point, which helps most under about 3
  (research 5.1); try crayons on paper too (2.1).
- **Files:** `game.ts` (a demo mode on the trace screen, reusing step 3's stroke animation from `hints.ts`),
  `progress.ts` (`KidProgress.demoSeen`, `lastPlayed` as a date), `parentSection.ts`.
- **Clips:** `demo-watch`, `demo-your-turn`, stroke words.
- **Tests:** unit: the demo is due on first play, after 14 days, after a parent's replay, and not otherwise. Browser:
  a new kid sees the demo then traces `L`; a touch cuts it short; the replay button brings it back.
- **Done when:** a new kid's first visit starts with the demo, and a parent can bring it back.
- **Built 2026-11-15** (not yet seen by the kids). As built, where it differs from or adds to the above:
  - It plays when the kid picks a letter (from the grid or the path) while it is due: the trace screen opens on `L`
    instead, and after the kid's `L` the next arrow goes to the letter they picked. Picking `L` itself goes on as
    usual after it.
  - The order: "Watch me." (the letter's name is not said on open), the show starts once that line ends (at least
    0.6 s, at most 2 s), the fingertip draws `L` with "Down." and "Across.", the drawing clears, the start dot
    pulses bigger and "Your turn!". About 4 to 5 seconds. The show is `playDemo` as step 3 uses it.
  - Its lines follow only the Sounds switches, not "Spoken tips": the how-to is not a hint (`LetterVoice.howTo`).
  - While it plays the hint ladder waits; its 5 s start from the end of the how-to. A touch anywhere ends it at once
    (`data-how-to="stopped"`), without "Your turn!", and it counts as seen.
  - `KidProgress.demoSeen` is set when the how-to opens; `lastPlayed` (`YYYY-MM-DD`, the device's clock) is set each
    time a letter opens. It is due when not seen, or after 14 days with no letter opened (`HOWTO_AGAIN_DAYS`; the
    letter and the timings are at the top of `hints.ts` with the other numbers). Progress files from before have no
    `demoSeen`, so a kid who already played sees it once. A parent's "Reset stars and game" also brings it back.
  - The `L` counts like any letter: a star, and a step on the game path when the path has `L` open.
  - Parent area: "Show how to trace again" in each kid's row (`showDemoAgain`), and a "Helping a kid learn" card
    with the note about sitting with the youngest and crayons on paper.

### E. Easier order and a lines-and-shapes set (D8, D9; built 2026-11-15)
- **Easy first on the game path** (D8): the game path walks capitals as straight lines first, then the ones with
  curves and slants, in groups that share a start (research 1.2): `L F E H T I` · `D P B R` · `C O Q G S` ·
  `U J` · `N M K` · `A V W X Y Z`. The practice grid stays alphabetical. No study proves one order better, so this
  is a small change kept in one table in `progress.ts` (`lettersOf`). Existing game progress keeps its stars;
  the path just shows them in the new order.
- **Lines and shapes** (D9): a fourth set before capitals, made with the same strokes and checker: line down,
  line across, circle, cross, slant, square, X (two slants), triangle. A parent turns it on per kid; the
  narrator names each one ("Circle."). For the youngest (research 1.3).
- **Files:** `glyphs.ts` (`SET_CHARS.shapes`, shape glyphs with ids the tiles can draw), `progress.ts`,
  `game.ts` (shape tiles show the shape, not a letter), `parentSection.ts`.
- **Clips:** `shape-…` from phase A ("X" uses the letter X clip).
- **Tests:** the existing glyph tests (in its box, no gaps, a good trace finishes in both modes) run over the
  shapes too; the game path order; old progress files load.
- **Done when:** the chosen order is on the path and shapes can be turned on for a kid.
- **Built 2026-11-15** (not yet seen by the kids). As built, where it differs from or adds to the above:
  - The order is the table `GAME_GROUPS` in `progress.ts`, one row per set; only capitals differ from practice
    (`LFEHTI DPBR COQGS UJ NMK AVWXYZ`). `lettersOf` builds the game path from it; the practice grid and its next
    arrow still use `SET_CHARS` (A to Z). Old game progress needs no change: done letters keep their stars and stay
    open; a kid who had done A B C now has L next. With capitals on and shapes off, the how-to's `L` is the first
    stop, so the how-to also counts as the first step of the game when played from the path.
  - The shapes are a set, `shapes`, first in `SET_ORDER`, with symbols as ids that are no letter or digit
    (`|-○+\□×△`; kids never see them, the tiles and stops draw the shape). `SHAPES` in `glyphs.ts` gives each a key
    for progress (`shape-circle`) and a name for screen readers ("Circle", "X shape"). `allChars()` stays the 62
    letters and numbers (`LETTER_SETS`), so a parent's recordings and the stroke table are unchanged.
  - The strokes, all in the capitals' box: line down; line across; circle (counterclockwise from the top, like O);
    cross (down, then across); slant (top left to bottom right, like X's first stroke); square (down the left side,
    then across, down and back across in one stroke, built like D); X (two slants); triangle (both slants from the
    top, then across the bottom, built like A).
  - The narrator: "Line." for line down, line across and slant; "Circle.", "Cross.", "Square.", "Triangle."; the X
    says the letter X's clip (`nameClip` in `voice.ts`). Shapes have no sound, so every saying setting says the name.
  - The parent switch is a fourth button in each kid's set row, `○ □ △`, off by default; the "What each kid traces"
    card explains it and the game's order. Practice shows a "Lines and shapes" tab first, eight tiles in two rows.
  - Not built: a parent's own recording of a shape's name (the recordings grid stays letters and numbers).

### F. Later, after a playtest: fade the guide, then draw beside it
Not built until the kids have played with B–D. Research 1.1 and 2.3 say help should fade and freehand copying
teaches most.
- A letter finished three times shows a thinner road; five times, only start dots; then a "draw it" turn: the
  letter shown small at the side, an empty space beside it, "Now you draw it." The checker is lenient there
  (a shape about right counts; nothing marks it wrong). A parent can turn fading off.
- Clips: `level-draw-it`, `level-draw-here` (made in phase A so this phase is still possible after 2026-12-31).
- Needs its own short ADR when it is picked up.

### G. Then words (own ADR; part 1 built 2026-11-16)
**Part 1 built 2026-11-16:** the Words tile (on per kid), the kid's name and the 24 words, one letter at a time into
a row of boxes, the slow word and the check, word stars, a parent's recording of a name, and the 84 words-batch clips
(take 1, not yet listened to). Part 2: family words and the 24 pictures. What differs from the ADR is in its
[Built](adr/0039-writing-words.md#built-part-1-2026-11-16) section.
**Part 2 built 2026-11-16:** family words on the parent Letters screen (up to 10, each with an optional recording
and photo, shared by every kid), shown after the name, and the 24 pictures on the built-in words' tiles and as each
word's picture (big, then in the corner while tracing, big again after the check); see
[Built, part 2](adr/0039-writing-words.md#built-part-2-2026-11-16).

Drafted 2026-11-15 as [ADR 0039](adr/0039-writing-words.md) (Proposed), from
[research/words-learning.md](research/words-learning.md). It asks for more narrator lines in this plan's second
run (its decision W1) and proposes every word open rather than only words made of starred letters (W6). The
outline it started from:

ADR 0026 covers single letters, so words need their own ADR; it builds on B–D. The outline, from research 1.7:
1. **The kid's own name** first: the letters come from the profile name a parent typed (ADR 0018); it never
   leaves the device. The narrator can't say a name it doesn't know, so the finished name plays the parent's own
   recording if there is one, else the cheer only.
2. **Short words** made only of letters the kid has stars on, from the 24 in phase A: each letter traced in turn
   in a row of small letters, "Now the next letter." between, each letter's sound when the sound setting is on, the
   word said at the end, "You wrote a word!". A picture for each word is a later wish (art under ADR 0011).
3. Much later, maybe: write a word "your own way" (invented spelling), with no right or wrong.
- Needs the small letters' glyphs at word size and a row layout; those are design work for that ADR.

---

## Decisions for the owner
All settled on 2026-11-15: the owner took every recommendation below.

| # | Decision | Options | Decided (owner, 2026-11-15) | Was needed by |
|---|---|---|---|---|
| D1 | The voice for the new lines | Matilda now with spares · Maisie for everything · an owned voice · another model | **Matilda now with spares**, plus 10 Maisie samples | 2026-11-21 |
| D2 | The line list (wording, the 24 words) | as listed, or edited | as listed | 2026-11-21 |
| D3 | What is said with a letter, and the default | name · name then sound · sound only | the setting, default **name** (today) | 2026-11-21 (the sound clips are made either way) |
| D4 | Going off the line | the drawing sound just stops · a soft "boop" too (as the to-do suggested) | **just stops**: research finds error sounds don't help | before phase B |
| D5 | Wait before the first hint | 5 s · 8 s (today) | **5 s**, tuned in a playtest | before phase C |
| D6 | The demo letter | `L` · `O` | **`L`** (down and across come before circles) | before phase D |
| D7 | When the demo comes back | after 14 days away · never on its own · other | **14 days** | before phase D |
| D8 | Game path order | alphabetical (today) · easy first | **easy first** on the path only; weak evidence, so the owner's taste wins | before phase E |
| D9 | Lines and shapes set | add it · not now | **add it**, off by default, per kid | before phase E |
| D10 | Fading guide and "draw it" (phase F) | after the playtest · never | **after the playtest** | later |
| D11 | Praise | keep 4 and add 4 · replace | **keep and add** | 2026-11-21 |
| D12 | Spend on the batch | about 231 takes plus retakes, through the server's OpenRouter key | OK it | 2026-11-21 |

Also needed before ADR 0037 can be accepted: mockups of the hint steps, the demo and the parent settings, on the
mockup canvas (to-do section 5 asks for them).
