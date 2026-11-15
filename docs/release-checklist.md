# Release checklist

Done by hand on a Windows laptop before a draft release is published (ADR 0015). Everything here is what the
browser tests can't reach: the installer, the update itself, the kiosk lock and the Windows-side files. Tick it on
the draft release's page or in a copy of this file; note anything that fails in the journal.

## Make the draft
1. On `main`, bump `version` in `package.json` (and `package-lock.json`'s top-level version).
2. `git tag v<version> && git push origin v<version>`. The *Release* workflow builds the installer, signs the
   update and drafts a release with the installer, its `.sig` and `latest.json` (ADR 0009). It stops early if the
   updater key or its secrets are missing.
3. On the draft: three files are attached, and `latest.json` names the new version and the installer's URL.

## Fresh install (a machine or Windows account without the app)
- [ ] The installer runs without admin rights. SmartScreen asks first (More info › Run anyway); that's expected
      until the app is code-signed.
- [ ] The app opens full screen on the kid picker, with the wordmark.
- [ ] Color a picture, go back, close the app from Parent area › This laptop › Quit, reopen: the picture is in My
      pictures and in `Pictures\Coloring Book\Art\<kid id>\`.

## Update from the previous version
- [ ] On a laptop with the previous version installed: Parent area › Updates shows the new version with its notes
      (after the draft is published; drafts are never offered).
- [ ] *Install and restart*: the app closes, the installer runs on its own, and the new version opens.
- [ ] Pictures, kids and settings are all still there. Parent area › Updates shows the new version number.

## Kiosk lock (ADR 0014, [laptop-setup.md](laptop-setup.md))
With *Keep the app full screen* and *Lock the keyboard* on, on a kid's screen:
- [ ] None of these leave the app: Windows key, Alt+Tab, Alt+Esc, Ctrl+Esc, Alt+F4, F11, Esc, Ctrl+W.
- [ ] Three- and four-finger swipes and swipes from each screen edge don't leave it (with the laptop setup done).
- [ ] The driving game drives with the arrows, W A S D and space; other keys do nothing.
- [ ] In the parent area every key types (a kid's name, the sync address).
- [ ] Ctrl+Shift+Q saves the open picture and quits. So does Parent area › This laptop › Quit.
- [ ] Ctrl+Alt+Del and Win+L still work (nothing can block them).
- [ ] Windows Defender doesn't flag the app. If it does, note it, and turn *Lock the keyboard* off until the app is
      signed.
- [ ] *Start when Windows starts*: sign out and back in; the app opens.

## Files and pages (phase B, F)
- [ ] A PNG and a PDF put in `Pictures\Coloring Book\Pages` become pages at the next start (in Our pages, or a
      theme-named subfolder's theme) and move to `Added`.
- [ ] Parent area › Add pages makes a page from a file; it shows in the kids' library.

## Family sync (phase C, ADR 0024), when a server is set up
- [ ] Parent area › Family sync connects with the server's address and pairing code; *Last synced* shows a time.
- [ ] A picture colored on one device shows up on another after a sync (Sync now, or within a few minutes).
- [ ] With the server stopped the app works as usual, and Family sync says it can't reach the server.

## Publish
- [ ] Everything above passed, or what didn't is written down and accepted.
- [ ] Publish the draft. Installed copies offer the update the next time they check (at start, or *Check now*).
