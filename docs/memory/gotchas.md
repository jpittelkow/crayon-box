# Gotchas

Non-obvious traps, workarounds and lessons learned. Add one bullet per gotcha with the date found and, if it
came from a session, the journal entry.

_Last updated: 2026-11-14_

- ADRs are never rewritten once Accepted; a change gets a new ADR that supersedes the old one (ADR 0001).
  Proposed ADRs may still be edited before acceptance.
- Dev machine is Windows; shell commands in docs should work in PowerShell or Git Bash.
- Tauri has no official plugin for Windows Credential Manager or printing (checked 2026-11-14; ADR 0002).
- OpenRouter per-key spending limits could not be confirmed from its own docs on 2026-11-14; ADR 0006 is worded
  to work either way.
- A keyboard hook can't block Win+L or Ctrl+Alt+Del (checked 2026-11-14; ADR 0014).
