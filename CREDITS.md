# Credits

Third-party assets that ship with the app (ADR 0011). Code dependencies are listed in `package.json`.

| Asset | Source | License |
|---|---|---|
| Fredoka font (weights 500, 600) | [Fontsource `@fontsource/fredoka`](https://fontsource.org/fonts/fredoka) | SIL Open Font License 1.1 |
| Atkinson Hyperlegible font (weights 400, 700) | [Fontsource `@fontsource/atkinson-hyperlegible`](https://fontsource.org/fonts/atkinson-hyperlegible), by the Braille Institute | SIL Open Font License 1.1 |

| Sounds: tap (and "nothing"), undo | [51 UI sound effects](https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks), Kenney's UI SFX Set | CC0 |
| Sound: fill | [3 Pop Sounds](https://opengameart.org/content/3-pop-sounds) | CC0 |
| Sounds: cheer, page turn | [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx) | CC0 |
| Narrator: letters, numbers, praise | Made with ElevenLabs v4 (voice Matilda) through OpenRouter for this project ([ADR 0032](docs/adr/0032-sounds-as-files.md)) | Owned by the project; released as CC0 |

Every sound file is listed with its source in `assets/sounds/sounds.json`; `tools/sounds/` remakes them.
The fonts are bundled into the app and never loaded from the network (ADR 0016). Icons and the built-in coloring
pages are original and released as CC0.
