# Playtest guide (milestone 1)

How to run a playtest of the web app with the kids, what to watch, and how to write it down. Playtests are the
real test of the interaction rules (ADR 0015).

## Before
1. On the dev machine: `git pull`, then `npm install` if `package.json` changed.
2. Double-click `scripts\playtest.cmd`. It starts the dev server if needed and opens the app in a full-screen
   Edge app window (ADR 0020). Pictures made there are kept in that window's own browser profile
   (`%LOCALAPPDATA%\CrayonBox\EdgePlaytest`) until that folder is deleted.
   - Not Edge kiosk mode: it runs InPrivate, so every picture would be gone when the window closes.
3. In the parent area (hold the lock on the kid picker for a second, then tap the three numbers), set up the kids:
   names, photos, colors, and where each kid's new pictures start.
4. Windows: turn off three- and four-finger touch gestures (Settings > Bluetooth & devices > Touch) and turn on
   Do not disturb, so a hand on the screen can't open task view and nothing pops up over the app (ADR 0014).
5. Have a grown-up nearby: Esc or F11 can leave full screen, and Alt+F4 closes the window. The installer's kiosk
   lock (milestone 2) is what closes those.

Playing on another device than the dev machine: run `npm run dev -- --host` and open the address it prints. Over
plain `http` from another device the browser may clear stored pictures (ADR 0014), so prefer the dev machine.

### The driving game
Driving shows on the home screen by default (since 0.7.0); a parent can hide it under Settings, Games. A kid picks
a map and a vehicle (and a colour) on one screen, then drives. The screen is a joystick (ADR 0036): a finger above
the middle goes, left and right of it turn, below it backs up. Under **Driving** in the parent area, each kid can be
set to *Steers freely* or *Follows the road* (the car steers itself and a touch only makes it go), and any vehicle
can be switched off (say, one whose siren is too loud).

## What to watch
Write down what happened, not what should have happened. One line per moment is enough.

| Watch for | Why | Decides |
|---|---|---|
| Taps on the color buttons that pick the color next to the one the kid wanted | Swatches are 64 px, smaller than every other kid button (ADR 0019) | Keep 64 px, or fewer colors at a bigger size |
| A finger that slides off a button before lifting, so nothing happens | Buttons fire on lift today (ADR 0003) | Pick buttons fire on touch-down instead |
| Brush sizes that are always too thin or too thick | The three sizes are a guess | New brush sizes |
| A resting hand or a thumb on the screen edge leaving marks, or blocking painting | Every finger paints; palms are ignored where the screen reports size | Palm threshold |
| Two kids painting at once, then one taps undo | Undo with two fingers can leave a bit of a stroke behind (gotchas) | Whether to fix it now |
| Bucket taps that fill the wrong area, or leave white edges | The fill grows 2 px under lines and picks the nearest area within 8 px | Fill tuning, page art |
| Finding New picture and My pictures, and getting back | One way back, top-left (ADR 0016) | Start screen layout |
| A kid finding their own badge by photo or name | Names and photos are new (ADR 0018) | Badge design |
| Driving: a kid who can't make the car go where they want, backs up by mistake, or rests a hand that moves it | The joystick is new (ADR 0036) | Joystick numbers, palm handling |
| Driving: a picture that stutters or freezes, on the big maps or near traffic | The laptop's graphics are unmeasured; the game turns its picture down when slow | Map size, the look |
| Driving: the picker (20 vehicles on five pages, 2 maps, colours) too busy, or the last pages never found; a siren too loud or scary | ADR 0035 | Picker layout, which vehicles are on |
| Curiosity about the lock in the corner | It should be ignored (ADR 0008) | Lock size and contrast |
| Boredom: what the kids ask for that isn't there | Pages, colors, sounds | What to build next |

## Afterwards
- Add a "Playtest" section to that day's journal entry (`docs/journal/YYYY-MM-DD.md`) with the notes.
- **Privacy rule:** say "a kid", "the youngest" or "the car-loving kid", never a name, age or anything that
  identifies them (`CLAUDE.md`). No photos or screenshots of the kids' pictures in the repo.
- Each finding becomes a fix, an answered [open question](memory/open-questions.md), or a new ADR when it
  changes a decision.
