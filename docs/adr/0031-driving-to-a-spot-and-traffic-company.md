# 0031. Driving game: a touch picks a spot to drive to; traffic rides alongside, then leaves

- Status: Accepted (owner, 2026-11-15). Its touch section, "A touch picks a spot on the ground", is superseded by
  [ADR 0036](0036-driving-screen-is-a-joystick.md) after the playtest of 2026-11-15; the traffic and bump sections stand.
- Date: 2026-11-15
- Supersedes, in [ADR 0021](0021-racing-game.md):
  - under Controls, "the further the finger is to one side, the sharper the turn": a touch now picks a spot.
  - under The game, how traffic "matches the kid's speed and drives alongside for a while".
  - under How it is built, a bump with traffic "only nudges both cars": now spelled out below.

## Context
On 2026-11-15 the owner asked to dig further into the driving game's design. Reading ADR 0021 next to the
prototype's simulation (`src/games/racing/sim/`) turned up three places where the code and the toddler rules
(ADR 0003) pulled apart:
- **Steering came from how far across the screen the finger was.** A finger held to one side made the car circle
  forever, and how high or low the touch was made no difference. A toddler who points at a cone expects the car
  to go to the cone. The outer quarter of each side was already a full turn.
- **Traffic copied the kid's speed whenever it was near.** A car behind the kid never caught up, so nobody drove
  alongside. Cars coming the other way also copied the speed, and none ever left.
- **A bump with traffic cost the kid's car about 4 % of its speed every step it touched,** so brushing the bus
  could halve its speed in a quarter of a second, and the traffic car didn't move at all.

The owner chose to fix steering and traffic, together with the bump (2026-11-15).

## Decision
### A touch picks a spot on the ground
- The spot is the point on the ground under the finger, as the chase camera shows it (`groundPoint` in
  `sim/view.ts`, which shares the renderer's field of view). Touching the sky or the far distance picks a spot
  40 m away in that direction. A spot out at sea is pulled back onto the island.
- **The spot stays put on the ground while the finger rests,** and moves only when the finger moves. The car
  steers at the spot, eases off within 12 m, and stops on it (within 2.5 m) with a short, firm stop.
- **A spot it can't get closer to** (one inside its turning circle, about 2.4 m to the side) **is given up**
  after 2 s without progress, so the car never circles. A new touch, or a finger that moves, gives a new spot.
- A spot well off to the side (more than about 70°) slows the car to a walking pace so it turns tightly.
- Lifting the finger still lets the car roll to a stop.
- **Keys are unchanged** (ADR 0021). A steering key takes over from a finger's spot while it is held.
- The *follows the road* assist ignores where the spot is: a touch still only makes the car go.

### Traffic keeps the kid company
- When the kid's car is on the road, moving, and heading the way traffic goes, **one traffic car at a time**
  within 20 m along the road catches up (or waits) and pulls **alongside, in the next lane**.
- It rides there for **4 to 6 s**, matching the kid's speed, then **speeds off ahead** until it is 12 m clear and
  goes back to its own pace. It won't join the kid again for 12 s. It also leaves if the kid stops, turns
  round or leaves the road.
- A kid driving against the traffic gets no company. As before, traffic moves over a lane near the kid's car
  and never blocks the road. "Over a lane" now means to whichever side has road.

### A bump with traffic is a toy bump
- The kid's car is pushed clear and loses almost no speed (0.3 % a step). The traffic car is shoved sideways
  across its lane and then eases back to it.

## Consequences
- The finger is a pointer, not a steering wheel. A finger held still now ends in a stop, not a circle. Whether
  the kids read that as "it got there" or "it stopped working" is the first thing to watch in a playtest.
- The bottom edge of the picture maps to just behind the car, so a resting hand low on the screen sends the car
  round in a U-turn and then stops it. Better than before (it used to drive off), but still one to watch.
- Touch steering is no longer in the input. The simulation records the steering it really used
  (`World.steer`), and the tyre squeal reads that.
- Traffic still runs on the one ring road. When roads become curves in the world data (ADR 0021, step 2), the
  "how far along the road" measure moves to the road curve.
- New unit tests: driving to spots in four directions, giving up on a spot it can't reach, a spot at sea, a new
  spot after arriving, the picture-to-ground mapping, one car riding along then leaving, no company against the
  traffic, and the bump. The browser test drives to a touched spot and checks it stops there.

## Still open
- The numbers (12 m easing, 2.5 m arrival, 4 to 6 s alongside, 12 s rest) are guesses for a playtest.
- Whether a parent wants the old steering back as an option. Not built.
