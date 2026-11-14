# 0012. Multi-game shell (coloring now, racing next)

- Status: Proposed
- Date: 2026-11-14

## Context
Milestone 3 (ADR 0014) adds a simple racing game for a 2-year-old who loves cars, and more games may follow. They should live in
the same app, share kid profiles, the parent area and updates, and not slow down each other's development.

## Decision
- **App shell** owns: the home screen (big picture tile per game), the kid picker, the parent area and its lock
  button (ADR 0008), settings storage, sounds, and updates (ADR 0009).
- **Each game lives in `src/games/<id>/` and has two parts.** A small registry entry is loaded at start-up and is
  enough to draw the home tile. The game itself is loaded only when its tile is tapped:

  ```ts
  // Registry entry: loaded at start-up.
  export interface GameEntry {
    id: string;                 // "coloring", "racing"
    tileIcon: string;           // SVG for the home tile
    tileColor: string;
    load(): Promise<GameModule>; // dynamic import of the game's code
  }
  // The game: loaded on demand.
  export interface GameModule {
    mount(el: HTMLElement, ctx: GameContext): () => Promise<void>; // returns unmount
    parentSettings?: SettingsSection[];                            // shown in the parent area
  }
  interface GameContext { kid: KidProfile; storage: GameStorage; sound: Sound; exitToHome(): void; }
  ```

  Unmount returns a promise that resolves once the game has finished saving. The shell waits for it before
  showing the next screen, so leaving a game can't cut off a save.
- Games get their own storage namespace in the app data folder and can't touch each other's data. The coloring
  game also writes finished pictures to `Pictures\Coloring Book\...` (ADR 0007).
- Home screen shows only enabled games; a parent can hide a game. With one game enabled, the home screen is
  skipped.
- Shared kid UI rules (ADR 0003) apply to every game.
- **Racing game (milestone 3, own ADR later):** canvas-based, original cartoon cars, one-finger controls
  (touch left/right half to steer, car drives itself), no way to lose, stickers or confetti for finishing a lap.

## Consequences
- Adding a game = a new folder plus one line in the game registry.
- Lazy-loading each game keeps start-up fast as games are added.
