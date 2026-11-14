# 0012. Multi-game shell (coloring now, racing next)

- Status: Proposed
- Date: 2026-11-14

## Context
Phase 2 adds a simple racing game for a 2-year-old who loves cars, and more games may follow. They should live in
the same app, share kid profiles, the parent area and updates, and not slow down each other's development.

## Decision
- **App shell** owns: the home screen (big picture tile per game), the kid picker, the parent area (ADR 0008),
  settings storage, sounds, and updates (ADR 0009).
- **Each game is a module** in `src/games/<id>/` that exports a manifest and a mount function:

  ```ts
  export interface GameModule {
    id: string;                 // "coloring", "racing"
    tileIcon: string;           // SVG for the home tile
    tileColor: string;
    mount(el: HTMLElement, ctx: GameContext): () => void; // returns unmount
    parentSettings?: SettingsSection[];                   // shown in the parent area
  }
  interface GameContext { kid: KidProfile; storage: GameStorage; sound: Sound; exitToHome(): void; }
  ```

- Games get their own storage namespace (`Pictures\Coloring Book\...` stays the coloring game's;
  other games use the app data folder) and can't touch each other's data.
- Home screen shows only enabled games; a parent can hide a game. With one game enabled, the home screen is
  skipped.
- Shared kid UI rules (ADR 0003) apply to every game.
- **Racing game (phase 2, own ADR later):** canvas-based, original cartoon cars, one-finger controls
  (touch left/right half to steer, car drives itself), no way to lose, stickers or confetti for finishing a lap.

## Consequences
- Adding a game = a new folder plus one line in the game registry.
- Lazy-loading each game keeps start-up fast as games are added.
