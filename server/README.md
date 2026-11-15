# Crayon Box family sync server

Keeps the kids' profiles, settings and pictures the same on every device that pairs with it
([ADR 0024](../docs/adr/0024-family-sync-server.md)). Each device keeps working on its own copy and syncs in the
background; the server is the meeting point and, with its data folder backed up, the family's backup.

**Home network only.** There are no user accounts, just a pairing code. Don't forward a port to it or expose it
to the internet. Plain `http` on the home network is fine; put your own reverse proxy in front for `https`.

## Install on Unraid
1. Docker › Add Container, and paste this template URL:
   `https://raw.githubusercontent.com/jpittelkow/crayon-box/main/server/unraid/crayon-box-sync.xml`
   (or set it up by hand: repository `ghcr.io/jpittelkow/crayon-box-sync:latest`, port 8787, a path for `/data`,
   and `--user 99:100` in Extra Parameters so the data folder belongs to Unraid's usual user).
2. Start it and open the WebUI (`http://<server>:8787/`). It shows the **pairing code**.
3. In the app, on each device: Parent area › Family sync › enter `http://<server>:8787` and the pairing code.
4. **Back up the data folder** (default `/mnt/user/appdata/crayon-box-sync`): include it in the appdata backup.

Updating is like any other container: pull the new image and restart. The server upgrades its own database on
start; an older server refuses a data folder from a newer one rather than damage it.

## Settings
| Variable | Default | |
|---|---|---|
| `PORT` | `8787` | Where the app reaches it |
| `DATA_DIR` | `/data` in the container | The database (`sync.sqlite`) and the pictures (`blobs/`) |
| `PAIRING_CODE` | made on first start | A fixed pairing code, if you'd rather choose one |

## AI pages (optional, [ADR 0029](../docs/adr/0029-ai-pages-through-the-family-server.md))
With an OpenRouter key the server makes coloring pages from a photo or an idea for paired devices (Parent area ›
Add pages › Make a page with AI). The key stays in the container's settings: never on a laptop, never in the
data folder.
1. At openrouter.ai, make a key just for this app and give it a credit limit. In the account's privacy settings,
   turn off providers that train on inputs.
2. Set `OPENROUTER_API_KEY` in the container (the Unraid template has the field) and restart it. The log says
   `AI pages: on`, and the app shows *Make a page with AI*.

| Variable | Default | |
|---|---|---|
| `OPENROUTER_API_KEY` | none (AI off) | The family's OpenRouter key |
| `AI_DAILY_LIMIT` | `20` | Pages a day, for everyone together |
| `AI_IMAGE_MODEL` | `google/gemini-2.5-flash-image` | Image output: pages from a photo or an idea |
| `AI_DRAW_MODEL` | `google/gemini-2.5-flash` | Writes a page as SVG line art |

The models are starting points: try a few on the same ideas and photos, and keep the one whose pages look best.

## Running it without Docker
Node 24 or newer, no install step: `npm start` in this folder (data goes to `./data`). `npm test` runs its tests.

## How it works
- SQLite (Node's own `node:sqlite`) holds one row per stored item: its revision, change time, and whether it
  was deleted. JSON values are in the row; pictures and photos are files in `blobs/`, named by revision.
- The API is in [`src/api.ts`](src/api.ts), shared with the app's sync client. A device asks for changes since the
  last revision it saw, fetches what it needs, and sends its own changes along with the revision each was based
  on. If someone else changed the item since, the server says so (409) and the app decides: newest change wins,
  and a picture painted on two devices is kept as two pictures.
- Pairing: the code buys a device a token (stored hashed); ten tries a minute at most.
