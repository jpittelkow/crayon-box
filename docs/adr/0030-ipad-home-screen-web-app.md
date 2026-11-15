# 0030. An iPad version as a Home Screen web app, with Apple Pencil

- Status: Proposed, a draft kept for later (asked for by the owner, 2026-11-14; not up for acceptance yet)
- Date: 2026-11-14
- Would supersede, if accepted: for the iPad only, "never hosted" and "runs from the dev server only" in ADR 0014
  and ADR 0020. The Windows app and its plans don't change.

## Context
The owner asked (2026-11-14) how hard an iOS or Android version would be, mainly for an iPad, and whether
Apple Pencil would work. Three ways to get there:

| Option | Cost | Notes |
|---|---|---|
| Home Screen web app (PWA) | Small | Same code, no Mac, no fee. Needs HTTPS hosting. Updates when the hosted copy changes. |
| Tauri 2 iOS build | Medium | Same code in a native shell. Needs a Mac or a macOS CI runner, Apple's $99 a year program, and TestFlight to install. The GitHub updater (ADR 0009) is not allowed on iOS. |
| App Store release | Large | Tauri iOS plus App Store review under the Kids category rules and a privacy disclosure for OpenRouter. |

ADR 0002 turned down a plain web app for Windows because of weak file access, no real installer and updates tied
to hosting. On an iPad those reasons mostly go away: iPadOS can't lock a device from inside an app either, so the
installer's kiosk lock has no iPad equivalent, and the system's Guided Access does that job.

### What Apple Pencil gives a web page (researched 2026-11-14)
- **Pencil arrives as Pointer Events with `pointerType === 'pen'`**, with `pressure`, `tiltX` and `tiltY`.
  WebKit has passed Pencil data (force, altitude, azimuth, touch type) to the web since 2016.
- **Safari 18.2** (iPadOS 18.2) added `getCoalescedEvents()`, `getPredictedEvents()`, and `altitudeAngle` and
  `azimuthAngle` on `PointerEvent` ([WebKit, Safari 18.2](https://webkit.org/blog/16301/webkit-features-in-safari-18-2/)).
  A Flutter engine change at the time reported the coalesced events as incomplete compared with other browsers,
  so the code must keep working without them. It already does: `getCoalescedEvents?.() ?? []` in the coloring
  engine.
- **Hover:** on iPads with Pencil hover (iPadOS 16.4 onward, M2 iPad Pro and later with a supported Pencil),
  Safari sends pointer moves before the tip touches the glass.
- **Not available to the web:** the Pencil's double-tap and squeeze gestures, Pencil Pro barrel roll (an open
  WebKit request in 2025), haptics, and PencilKit's native drawing and stroke prediction.
- **Scribble** (handwriting into text fields) can swallow pointer events near editable elements; a 2020 report
  saw most of the `pointerdown` events go missing. Kid screens have no text fields. In the parent area Scribble is
  welcome, because a parent can write a kid's name with the Pencil.
- **Palm rejection:** iPadOS rejects most of a resting palm by itself while the Pencil is in use, and signals a
  rejected contact with `pointercancel`. How Safari fills in `width` and `height` for a finger, which the app's
  palm check (`PALM_CSS_PX`, 80 CSS px) relies on, was not confirmed from documentation. It has to be measured on
  a real iPad.

### What the app already does (checked in the code, 2026-11-14)
- Uses Pointer Events everywhere and sets `touch-action: none` on the play areas. `kid.css` sets
  `user-select: none` and `-webkit-touch-callout: none`, which stop iOS's long-press magnifier and callout.
  `guards.ts` blocks Safari's `gesturestart` (pinch) and multi-finger `touchmove`.
- **Letter practice** treats the pen as the writer: a pen coming down ends any touch strokes, and touches are
  ignored for 500 ms after the pen was last seen. Hover moves count as "seen", so a hovering Pencil already
  protects against the hand.
- **The coloring engine** only drops large touches (`isPalm`). It has no pen-first rule, so on an iPad a resting
  palm that iPadOS lets through could paint while the Pencil draws. This is the main Pencil gap.
- Asks for persistent storage at start (`navigator.storage.persist()` in `main.ts`). Records letters with
  `MediaRecorder` and keeps the recorder's own type, so Safari's `audio/mp4` is stored correctly.
- Pressure and tilt are read nowhere yet.

### Hosting
A Home Screen web app needs a secure origin (HTTPS) for its service worker (offline start, updates) and for the
best chance at persistent storage. The family sync server (ADR 0024) speaks plain `http` on the home network, and
an `https` page may not call an `http` server, so iPad sync needs that server behind HTTPS either way.

## Decision (proposed)
1. **The iPad gets a Home Screen web app**, the same build as the web app plus a web app manifest, icons, iOS
   meta tags and a small service worker. No Tauri iOS build and no App Store for now. Tauri iOS stays the next
   step if the web app falls short (storage lost, Pencil too slow, sound problems).
2. **Served over HTTPS from the family's server**: the sync server's container also serves the built app, behind
   the family's own reverse proxy with a certificate. One origin for the app and sync means no cross-origin setup.
   Nothing is hosted on the public internet, which keeps the spirit of ADR 0014. **HTTPS on the family's server
   is required**, for the app and for sync. The owner confirmed it can have HTTPS (2026-11-14); how is the
   family's setup and not part of this repo.
3. **Pencil spike first, before any PWA work.** Open the dev server from the iPad over the home network
   (`npm run dev -- --host`, plain `http`, which is enough for Pointer Events) and add a dev-only pen test page
   next to `tools/clean-page.html` that shows, live, for each pointer: `pointerType`, `pressure`, `width` and
   `height`, tilt and angles, coalesced and predicted event counts, hover moves, and `pointercancel`. On a real
   iPad, with a real Pencil and a real hand:
   - Is a resting palm reported (as touch, how large, or cancelled), and is 80 CSS px the right limit?
   - Do coloring strokes keep up with a fast Pencil, with and without coalesced events?
   - Does letter tracing finish and score the same with the Pencil as with the Windows pen?
4. **Pencil changes to the app:**
   - The coloring engine gets the letter game's pen-first rule (a pen down ends touch strokes, touches ignored
     while a pen was just seen), shared from one helper instead of copied.
   - `pointercancel` ends a stroke like a lift.
   - Pressure and tilt stay unused for now. Pressure-varying lines are a later design question, since toddlers
     press hard or barely touch.
5. **What changes on the iPad:**
   - **Lock:** no kiosk lock in the app. The setup guide gets an iPad section: turn on Guided Access, with a
     passcode only a parent knows, and start it from the Home Screen app. This replaces the Windows laptop setup
     of ADR 0014 for this device.
   - **Updates:** the service worker loads the new build on the next start. The parent area's Updates screen
     stays Windows-only (`inTauri`); the version is shown in the parent area.
   - **Storage:** IndexedDB behind the storage interface (ADR 0007), as in the web app. Must be opened from the
     Home Screen, not a Safari tab. Sync (ADR 0024) is the backup once it exists.
   - **Not on the iPad:** the AI page maker (ADR 0006 keeps its key in Windows Credential Manager, and a browser
     has no safe place for it), the Pictures folder and loose files (ADR 0007), and the keyboard lock.
6. **Checks on the iPad besides the Pencil:** sounds start after the first touch (`AudioContext` resume), speech
   voices for letter practice, letter recordings made on Windows (`audio/webm`) playing on the iPad once sync
   carries them, the driving game's frame rate, the layout at the iPad's screen sizes (4:3 and wider), and that
   full screen and the status bar in standalone mode leave the play area intact.

## Consequences
- An iPad version for a few days of work and no Apple fees, sharing all game code with Windows.
- The family's server, with HTTPS, becomes part of running the app on the iPad; if it is down, an installed
  copy still starts from the service worker's cache.
- Safari can still clear an origin's storage in rare cases. Until sync exists, pictures on the iPad are less
  safe than on the Windows app.
- The coloring engine's palm handling improves on Windows touch laptops with a pen too.
- If the spike shows the web falls short, this ADR is superseded by a Tauri iOS one; the spike's findings carry
  over, since Tauri on iOS runs the same WebKit.
- Android would follow the same path (Chrome supports the same Pointer Events and Home Screen installs) and is
  not planned.
