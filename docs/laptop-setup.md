# Setting up the family laptop

Done once by a parent (ADR 0014). These are Windows settings the app can't change itself; the same steps are in
the app under Parent area › This laptop.

1. **A Windows account for the kids.** A standard account, not an administrator. Install the app there
   (the installer from the Releases page needs no admin rights) and turn on *Start when Windows starts* under
   Parent area › This laptop. If a kid ever gets out of the app, they land in an empty account, not a parent's
   files and email.
2. **Turn off touch gestures:** Settings › Bluetooth & devices › Touch: turn off three- and four-finger gestures,
   so a hand on the screen can't open task view or show the desktop.
3. **Turn off touchpad gestures:** Settings › Bluetooth & devices › Touchpad: turn off three- and four-finger
   gestures.
4. **Turn on Do not disturb** in the kids' account, so notifications don't pop up over the app.
5. **Edge swipes:** full screen already stops most swipes from the screen edges. If the kids still open things
   that way, Windows' edge swipe can be turned off with the "Allow edge swipe" policy
   (Computer Configuration › Administrative Templates › Windows Components › Edge UI, on editions with the Group
   Policy editor).

## In the app (Parent area › This laptop)
- **Keep the app full screen** (on): no resizing, minimizing or closing except from the parent area.
- **Lock the keyboard** (on): on the kids' screens only Ctrl+Shift+Q works, plus the arrows, W A S D and space in
  the driving game. Turn it off if Windows Defender or another antivirus warns about the app watching the
  keyboard (the app isn't code-signed yet, ADR 0009).
- **Start when Windows starts** (off until turned on).
- **Quit the app**, or Ctrl+Shift+Q from anywhere.

## What no app can block
- **Ctrl+Alt+Del** always works, so a grown-up can always get out.
- **Win+L** locks the screen. Sign back in and the app is still there.

## Checking the lock (milestone 2, phase D's "done when")
With the app open on a kid's screen, try each of these; none should leave the app: the Windows key, Alt+Tab,
Alt+Esc, Ctrl+Esc, Alt+F4, F11, Esc, three- and four-finger swipes, swipes from each screen edge, the taskbar
(it shouldn't show). Then Ctrl+Shift+Q should save and quit, and Parent area › This laptop › Quit should too.
