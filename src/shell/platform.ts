// Where the app is running (milestone 2, phase A). The same build runs in a browser (development, tests) and inside
// the Tauri window on Windows (ADR 0002). Code that needs Windows asks here first and keeps a browser fallback.

/** True inside the Tauri window. Tauri 2 puts its bridge on the page before any app script runs. */
export function inTauri(win: object = globalThis): boolean {
  return '__TAURI_INTERNALS__' in win || (win as { isTauri?: unknown }).isTauri === true;
}
