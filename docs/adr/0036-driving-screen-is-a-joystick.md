# 0036. Driving game: the screen is a joystick; the picker picks a colour; a quick swap in the game

- Status: Accepted (the owner's choices during the playtest of 2026-11-15)
- Date: 2026-11-15
- Supersedes, in [ADR 0031](0031-driving-to-a-spot-and-traffic-company.md): "A touch picks a spot on the ground".
  Its traffic and bump sections stand.
- Changes, in [ADR 0035](0035-driving-vehicles-maps-picker-garage.md): the picker gains colours, Back in the game
  returns to the picker, and the game gains a quick swap.

## Context
In the playtest of 2026-11-15 a kid didn't understand tap-a-spot. They slid a finger from the middle of the screen
out to the edges, up, down, left and right, as on a joystick, and they liked holding the forward arrow key. The
owner chose a joystick (asked during the playtest). The owner also asked for the car's colour to be picked on the
picker, for Back in the game to go back to the picker, and for a quick way to change vehicle inside the game.

## Decision
### The screen is a joystick
- The newest finger down is a joystick position: how far it is from the middle of the picture, to the edges.
- **Above the middle goes**, faster the higher: just above creeps along at 4 m/s, the top edge is the vehicle's top
  speed. **Left and right turn**, harder the further out. **Below the middle backs up**, at up to 5 m/s.
- Close to the middle (within 12 % of the way to an edge) does nothing that way, so a finger in the middle rolls
  the car to a stop. Lifting the finger rolls it to a stop too.
- Backing up steers like a real car backing up: a finger low and to the left takes the car back toward the left
  of the screen. It knocks toys as driving forward does; the shore and everything else still turn it back.
- A ring shows the middle while a finger is down, and a dot follows the finger, so a kid sees what the finger
  does. Neither takes touches.
- **Keys are unchanged** (ADR 0021). A driving key takes over from the finger while it is held.
- *Follows the road* still ignores where the finger is: a touch only makes it go.
- Tap-a-spot leaves the screen. Its code stays in the simulation (`Input.spot`, tested), so it can come back as a
  parent's choice if a kid ever needs it.

### The picker
- **A colour for the vehicle:** eight swatches down the right of the picker, the kid's own colour first, then the
  crayon box's brightest and black, leaving out any too like the kid's own. A tap paints the vehicles' pictures
  in it at once; the colour goes on the paint or the flag as before (ADR 0035), and is saved per kid.
- **Back a page** after the first page of vehicles; the pages no longer wrap round.
- **The picker's pictures ship with the app** (owner, 2026-11-15): every vehicle in every colour it can be drawn in
  (the six kid colours and the picker's, 12 in all) and both maps, 170 WebP files, about 1.9 MB, in
  `assets/pictures/driving/`. `npm run pictures:driving` draws them on the dev machine with the game's own code;
  a unit test fails while one is missing. The laptop draws nothing; drawing stays only as a fallback (one at a
  time after the picker shows, kept on the device by app version). The picker froze for about 6 s each time before.

### In the game
- **Back returns to the picker**, whose Back goes home.
- **A quick swap:** a button top right shows the vehicle being driven. A tap opens a tray of the vehicles a parent
  has on; a tap on one changes to it on the spot, in a puff, as the garage does, and is remembered as the last
  pick. A tap beside the tray closes it.

### The picture on a slow computer
- If frames average slower than 22 ms (about 45 a second), the game draws 20 % fewer pixels, step by step, down
  to half the screen's own sharpness, and never steps back up during that drive (ADR 0025: the look turns down
  first). The family laptop was reported to stutter; the dev machine never steps down.

## Consequences
- The finger now does what the kid did with it. Whether they find backing up (or back up by mistake when they
  rest a hand low on the screen) is the thing to watch in the next playtest.
- A resting hand low on the screen now backs the car up slowly instead of U-turning it; the palm filter
  (ADR 0003) still ignores a whole hand.
- The swap button sits where nothing was; the horn stays bottom right.
- New unit tests: the joystick's go, crawl, turn, stop and back up; random joystick driving staying on the island;
  colours; the swap. Browser tests: driving by joystick, the colours, the tray.

## Still open
- The numbers (the 12 % middle, 4 m/s creep, 5 m/s backing) are first guesses for the next playtest.
