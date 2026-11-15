# 0024. Family sync: a small self-hosted server the app syncs to

- Status: Accepted (by the owner, 2026-11-14)
- Date: 2026-11-14
- Supersedes:
  - in ADR 0018, "names and photos are kept on the device only ... never sent anywhere": they sync to the
    family's own server.
  - in ADR 0014, the milestone order: sync is planned right after the installer's file storage instead of
    "later". "Never hosted online" stays true: the server is on the home network.
  - in ADR 0007, "nothing is carried over" between devices: a new device pulls the family's data from the server.
  - in ADR 0009, "GitHub Releases hold only the installer": still true for Releases, but the repo also publishes
    the sync server's container image to GitHub's container registry.

## Context
The owner wants settings, profiles and pictures to follow the family across devices, and wants it planned now:
many features (profiles, pictures, family pages, future games) would need rework if sync were bolted on late.
The owner's outline: a small server app, self-hosted on the family's Unraid machine, holding one shared database;
the app asks for the server's address when it is set up.

Two things keep the rework small. Everything the app saves already goes through one storage interface keyed by
path (ADR 0007, 0012), so sync can sit under that interface without game code knowing. And only Windows devices
running the installer need it at first (owner, 2026-11-14); other devices are possible later but not certain.

The repo's privacy rule is about what is committed (`CLAUDE.md`, ADR 0018). What a family stores in their own
app and on their own server is their business; the app does not restrict it.

## Decision
### Shape
- **The device stays the working copy.** The app reads and writes its own local storage, exactly as now, and
  works fully when the server is unreachable. Sync runs in the background: a kid screen never waits on the
  network, and never shows a sync state or error (ADR 0016 rule 6). The parent area shows when the device last
  synced and any problem, in words.
- **Sync is optional.** At first run, and later in the parent area, a parent may enter the server's address and a
  pairing code. Skipping it leaves the app local-only, as today.
- **One family per server.** No user accounts. Kid profiles (ADR 0018) are the only "users".

### What syncs
- **Everything under the storage interface syncs, except paths under `local/`.** That covers kid profiles and
  photos, shell settings, each game's settings, pictures (`art.json`, `paint.png`, `prev.png`), hidden pages, and
  later family pages (ADR 0005) and other games' data, without a per-feature list.
- **Previous versions sync too** (`prev.png`), so *Restore previous version* works on every device. It costs
  about double the picture storage on the server.
- **Device-only data lives under `local/`:** the OpenRouter key reference, the kiosk and keyboard lock
  switches (ADR 0014), the sync settings themselves, and anything else that describes this device rather than
  the family.
- Undo history is never stored, so it never syncs (ADR 0004).

### How changes meet
- Each stored item carries a **change time** and a **revision** the server hands out. A device asks the server
  for everything changed since the last revision it saw, then sends its own changes.
- **Deletions are remembered** (as a small "deleted" record per path), so a deleted picture or kid does not come
  back from another device.
- **Settings and profiles: the newest change wins**, per file. Devices take their clocks from Windows time sync.
- **Pictures are never overwritten by a conflict.** When the same picture was painted on two devices since they
  last synced, the newer one keeps the picture and the other is saved as a new picture next to it. Nothing a kid
  made is lost (ADR 0003 rule 6); at worst My pictures shows two versions.
- Picture and kid ids are made unique across devices (a random part, not only a timestamp).

### The server
- A small web service in a single container, written in TypeScript on Node so it shares the storage types with
  the app. Data in one folder: a SQLite database (paths, revisions, change times, deleted markers) and the files
  themselves on disk. That folder is what gets backed up; the README says to include it in Unraid's appdata
  backup.
- **API:** plain HTTP and JSON under `/api/v1`: server info and supported versions; list changes since a
  revision; get, put and delete one path. Small and boring on purpose, so another kind of client could use it
  later.
- **Access:** the server makes a pairing code on first start (shown in its log and on its one status page). A
  device sends it once and gets a token it keeps under `local/`; every request carries the token. Plain `http` on
  the home network is accepted; a family that wants `https` puts their own reverse proxy in front. The server is
  not meant to be reachable from the internet, and the setup notes say so.
- **Shipping** (decided by the owner, 2026-11-14): a container image built by this repo's CI and published to
  GitHub's container registry, with an Unraid template in the repo, so installing is one line and updates work
  like any other container. The image holds only code; all family data stays in the data folder on the server.
  This is a different thing from the web-app image the owner declined in ADR 0014: that one would have served
  the app itself.
- **Versions:** the app and server each say which API versions they speak. If they share none, the app keeps
  working locally and the parent area says which side needs updating. The server upgrades its own database on
  start.

### When
1. **Now, in milestone 1:** groundwork in the storage layer so nothing needs rewriting later: change times,
   deleted records, the `local/` rule, cross-device ids, a device id.
2. **With milestone 2:** the server, and the sync client under the storage interface, once the installer's file
   storage exists. Because the client sits under the interface it also runs against the web app's browser
   storage, which is how it gets tested early.
3. The first-run question ("Do you have a family server?") arrives with the installer.

The driving game (ADR 0021) is not held up by this and can proceed in parallel; whatever it saves through the
storage interface syncs without extra work.

## Consequences
- A new or replaced laptop gets the kids' profiles and pictures back by entering the server address: sync is also
  the backup and restore the app lacked.
- The app never depends on the server being up. The cost is conflict rules, which are kept deliberately simple.
- Kids' names, photos and pictures are stored on the home server as well as the laptop. Whoever can reach that
  server's data folder can see them.
- One more thing to build, version and keep working: a server with its own releases. Keeping the API tiny is
  what makes that bearable.
- Pictures grow without limit on the server too; deleting in the parent area removes them everywhere.
- "Newest change wins" trusts device clocks. A device with a badly wrong clock could win or lose wrongly; pictures
  are protected from this by the keep-both rule, settings are not.
