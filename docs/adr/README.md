# Architecture Decision Records

Each file records one decision for the kids' coloring app: the context, what we chose, and what it costs us.
Status values: Proposed, Accepted, Deferred (agreed but not being built yet), Superseded.
A Proposed ADR may still be edited; an Accepted one is changed only by a new ADR that supersedes it (ADR 0001).

| # | Decision | Status |
|---|----------|--------|
| [0001](0001-record-decisions-as-adrs.md) | Record decisions as ADRs | Accepted |
| [0002](0002-tauri-typescript-canvas-stack.md) | Tauri 2 + TypeScript + HTML canvas | Accepted, partly superseded by 0021 |
| [0003](0003-toddler-first-interaction-rules.md) | Toddler-first interaction rules | Accepted, swatch size superseded by 0019, key blocking by 0021 |
| [0004](0004-coloring-engine.md) | Coloring engine: layers, fill, stay-in-lines, undo | Accepted |
| [0005](0005-page-library-format.md) | Page library format and adding pages | Accepted |
| [0006](0006-ai-page-maker-openrouter.md) | AI page maker via OpenRouter | Accepted |
| [0007](0007-artwork-storage-and-kid-profiles.md) | Artwork storage, autosave and kid profiles | Accepted, partly superseded by 0017, 0018, 0024 |
| [0008](0008-parent-area-hold-to-unlock.md) | Parent area behind a hold-then-read gate | Accepted |
| [0009](0009-install-and-update-from-github.md) | Install and in-app updates from GitHub Releases | Accepted, extended by 0024 |
| [0010](0010-printing-and-export.md) | Printing and export | Deferred |
| [0011](0011-line-art-licensing.md) | Licensing policy: line art, sounds, icons and code | Accepted |
| [0012](0012-multi-game-shell.md) | Multi-game shell (coloring now, racing next) | Accepted, racing sketch superseded by 0021 |
| [0013](0013-code-hosting.md) | Code hosting: GitHub (Gitea optional mirror) | Accepted |
| [0014](0014-web-first-then-kiosk-installer.md) | Web app first, then installer with a kiosk lock | Accepted, partly superseded by 0020, 0021, 0024 |
| [0015](0015-testing-approach.md) | Testing approach | Accepted |
| [0016](0016-visual-design-language.md) | Visual design language: Crayon Box | Accepted, partly superseded by 0017–0019 |
| [0017](0017-new-pictures-and-my-pictures.md) | New pictures from the page library, old ones from My pictures | Accepted |
| [0018](0018-kid-names-and-photos.md) | Kid profiles with names and photos | Accepted, partly superseded by 0024 |
| [0019](0019-bigger-coloring-page.md) | A bigger coloring page: fills the window, 64 px color buttons | Accepted |
| [0020](0020-web-app-from-the-dev-server.md) | The web app runs from the dev server; playtests use an Edge app window | Accepted |
| [0021](0021-racing-game.md) | Driving game: a small 3D island to roam | Accepted, look and sounds superseded by 0025 |
| [0022](0022-where-built-in-pages-come-from.md) | Where the built-in pages come from | Accepted |
| [0023](0023-ai-pages-from-a-prompt.md) | The AI page maker also makes pages from a typed idea | Accepted |
| [0024](0024-family-sync-server.md) | Family sync: a small self-hosted server the app syncs to | Accepted |
| [0025](0025-driving-game-toy-look-and-engine-sounds.md) | Driving game: a polished toy look and an engine sound for every vehicle | Accepted |
| [0026](0026-letter-practice.md) | Letter practice: trace big letters with a finger or a stylus | Accepted |
| [0027](0027-app-name-wordmark.md) | The app's name as a wordmark on a few screens | Accepted |

Both links below are private to the owner.
- Mockups of every screen: https://claude.ai/artifact/UsUp5kExVUs3ikNq9X9q6H
- Design system (tokens, components, rules): https://claude.ai/artifact/5KmapasFWgcTtRsLbYDUkV
