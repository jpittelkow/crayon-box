# Credits

Third-party assets that ship with the app (ADR 0011). Code dependencies are listed in `package.json`.

| Asset | Source | License |
|---|---|---|
| Fredoka font (weights 500, 600) | [Fontsource `@fontsource/fredoka`](https://fontsource.org/fonts/fredoka) | SIL Open Font License 1.1 |
| Atkinson Hyperlegible font (weights 400, 700) | [Fontsource `@fontsource/atkinson-hyperlegible`](https://fontsource.org/fonts/atkinson-hyperlegible), by the Braille Institute | SIL Open Font License 1.1 |

| Sounds: tap (and "nothing"), undo | [51 UI sound effects](https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks), Kenney's UI SFX Set | CC0 |
| Sound: fill | [3 Pop Sounds](https://opengameart.org/content/3-pop-sounds) | CC0 |
| Sounds: cheer, page turn | [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx) | CC0 |
| Driving: bumps (box), beach-ball boing | [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx) | CC0 |
| Driving: flood splash | [40 CC0 water / splash / slime SFX](https://opengameart.org/content/40-cc0-water-splash-slime-sfx) | CC0 |
| Driving: horn | [Bicycle Horn](https://opengameart.org/content/bicycle-horn) | CC0 |
| Engines, police siren, tyre squeal, brake squeak, puddle splash, crayon on paper | Made with Seed Audio 1.0 (ByteDance) through OpenRouter for this project ([ADR 0032](docs/adr/0032-sounds-as-files.md)) | Owned by the project (BytePlus General Terms for AI Services); released as CC0 |
| Narrator: letters, numbers, praise | Made with ElevenLabs v4 (voice Matilda) through OpenRouter for this project ([ADR 0032](docs/adr/0032-sounds-as-files.md)) | Owned by the project; released as CC0 |

Every sound file is listed with its source in `assets/sounds/sounds.json`; `tools/sounds/` remakes them.
The fonts are bundled into the app and never loaded from the network (ADR 0016). Icons and the built-in coloring
pages are original and released as CC0. The driving game's 3D vehicles, animals, toys, scenery and set pieces are original,
built in code (ADR 0025, 0035), and released as CC0; no third-party model ships with the app.
