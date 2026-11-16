// Makes the narrator's clips (ElevenLabs v4, voice Matilda) and sound-effect takes (Seed Audio) through OpenRouter
// (ADR 0032). Runs inside the family sync server's container, which holds the OpenRouter key (ADR 0029), so the key
// never leaves the server; only the audio comes back. One request at a time (the key's in-flight budget).
//
//   copy this file into the container, then:  docker exec <container> node /tmp/generate.mjs
//   copy /tmp/gen2 back, put narrator/*.mp3 in the sources folder, run tools/sounds/prepare.mjs
//
// ONLY=letters2 makes the second letters batch instead (ADR 0037, docs/letters-plan.md phase A): three takes of
// every new line in Matilda into /tmp/gen3/narrator/<id>-<take>.mp3, and one take of ten sample lines in Maisie,
// her suggested replacement, into /tmp/gen3/maisie/. Then tools/sounds/audition.mjs makes a page to pick takes by
// ear. DRY=1 lists the lines and makes nothing (no key needed). TAKES=1 makes one take each (for a redo run), and
// IDS=a,b,c makes only those lines.
//
// ElevenLabs retires Matilda on 2026-12-31: clips made later need her replacement or a new voice for the whole set.
import { mkdirSync, writeFileSync } from 'node:fs';

const KEY = process.env.OPENROUTER_API_KEY;
const DRY = process.env.DRY === '1';
if (!KEY && !DRY) { console.error('no key'); process.exit(1); }
if (DRY && process.env.ONLY !== 'letters2') { console.error('DRY=1 works with ONLY=letters2'); process.exit(1); }
// ONLY=narrator or ONLY=effects makes just that half; ONLY=letters2 the second letters batch (see above).
const ONLY = process.env.ONLY ?? '';
const OUT = '/tmp/gen2';
if (ONLY !== 'letters2' && !DRY) {
  mkdirSync(`${OUT}/narrator`, { recursive: true });
  mkdirSync(`${OUT}/effects`, { recursive: true });
}

const NUMBERS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const PRAISE = [['yay', 'Yay!'], ['you-did-it', 'You did it!'], ['great-job', 'Great job!'], ['wow', 'Wow!']];
const narrator = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => [`letter-${l}`, `[warmly] ${l}.`]),
  ...NUMBERS.map((n, i) => [`number-${i}`, `[warmly] ${n}.`]),
  ...PRAISE.map(([id, t]) => [`praise-${id}`, `[excited] ${t}`]),
];
// Sound effects from Seed Audio: [id, description]; three takes of each, to pick by ear.
const EFFECTS = [
  ['siren-toy', 'A friendly toy police car siren going wee-woo wee-woo, two tones, bright and cheerful, not scary, no engine, no music, about 2 seconds.'],
  ['siren-real', 'A police car siren wailing up and down twice, heard from a short distance, not too harsh, no engine, no music, about 2.5 seconds.'],
  ['squeal', 'A steady tyre squeal of a small car cornering on smooth tarmac, a continuous high screech, no engine, no crash, no music, about 3 seconds.'],
  ['brake', 'A short squeak of a toy car braking, a single bright brake squeal, no engine, no crash, no music, about half a second.'],
];

async function speak(body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(120000),
    });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    const text = (await r.text()).slice(0, 300);
    if (r.status === 429 || r.status === 402 || r.status >= 500) { await new Promise((s) => setTimeout(s, 4000 * (attempt + 1))); continue; }
    throw new Error(`${r.status} ${text}`);
  }
  throw new Error('gave up after retries');
}

// ---- The second letters batch (ADR 0037). The line list is docs/letters-plan.md, "The line list". ----
// Letter sounds are spellings for the voice to read; the short vowels also get a take with an example word.
const SOUNDS = {
  A: 'ah', B: 'buh', C: 'kuh', D: 'duh', E: 'eh', F: 'fff', G: 'guh', H: 'hhh', I: 'ih', J: 'juh', K: 'kuh',
  L: 'lll', M: 'mmm', N: 'nnn', O: 'aw', P: 'puh', Q: 'kwuh', R: 'rrr', S: 'sss', T: 'tuh', U: 'uh', V: 'vvv',
  W: 'wuh', X: 'ks', Y: 'yuh', Z: 'zzz',
};
const VOWEL_WORDS = { A: 'apple', E: 'egg', I: 'igloo', O: 'octopus', U: 'umbrella' };
const WORDS = ['cat', 'dog', 'sun', 'bus', 'pig', 'hat', 'cup', 'bed', 'box', 'fox', 'hen', 'bug', 'map', 'pan',
  'pin', 'sat', 'tap', 'top', 'red', 'run', 'hop', 'big', 'mud', 'jam'];
const letters2 = [
  ...Object.entries(SOUNDS).map(([l, s]) => [`sound-${l}`, `[warmly] ${s}.`]),
  ...Object.entries(VOWEL_WORDS).map(([l, w]) => [`sound-${l}-alt`, `[warmly] ${SOUNDS[l]}... ${w}.`]),
  ['tip-start-dot', '[warmly] Start at the green dot.'],
  ['tip-top', '[warmly] Start at the top.'],
  ['tip-follow-arrow', '[warmly] Follow the arrow.'],
  ['tip-keep-going', '[warmly] Keep going!'],
  ['tip-next-line', '[warmly] Now the next line.'],
  ['tip-tap-check', '[warmly] Tap the check!'],
  ['stroke-down', '[warmly] Down.'],
  ['stroke-across', '[warmly] Across.'],
  ['stroke-slant', '[warmly] Slant.'],
  ['stroke-around', '[warmly] Around.'],
  ['stroke-down-over', '[warmly] Down, up and over.'],
  ['stroke-dot', '[warmly] Dot.'],
  ['demo-watch', '[warmly] Watch me.'],
  ['demo-your-turn', '[excited] Your turn!'],
  ['praise-all-the-way', '[excited] You went all the way!'],
  ['praise-kept-going', '[excited] You kept going!'],
  ['praise-whole-letter', '[excited] You traced the whole letter!'],
  ['praise-by-yourself', '[excited] All by yourself!'],
  ['shape-line', '[warmly] Line.'],
  ['shape-circle', '[warmly] Circle.'],
  ['shape-cross', '[warmly] Cross.'],
  ['shape-square', '[warmly] Square.'],
  ['shape-triangle', '[warmly] Triangle.'],
  ['level-draw-it', '[warmly] Now you draw it.'],
  ['level-draw-here', '[warmly] Draw it here.'],
  ...WORDS.map((w) => [`word-${w}`, `[warmly] ${w}.`]),
  ['word-next-letter', '[warmly] Now the next letter.'],
  ['praise-a-word', '[excited] You wrote a word!'],
];
// Ten lines in Maisie, to hear what a switch would sound like. OpenRouter documents only the default voice names
// (checked 2026-11-15), so this asks by ElevenLabs' voice id; an error here is logged and nothing else stops.
const MAISIE = 'QtY3JBOUKEB5xzrRfOKc';
const maisieLines = [
  ['letter-A', '[warmly] A.'], ['letter-B', '[warmly] B.'], ['number-3', '[warmly] Three.'],
  ['praise-yay', '[excited] Yay!'], ['praise-you-did-it', '[excited] You did it!'],
  ['tip-start-dot', '[warmly] Start at the green dot.'], ['stroke-down', '[warmly] Down.'],
  ['demo-your-turn', '[excited] Your turn!'], ['sound-M', '[warmly] mmm.'], ['word-cat', '[warmly] cat.'],
];
if (ONLY === 'letters2') {
  const OUT3 = '/tmp/gen3';
  const takes = Number(process.env.TAKES ?? 3);
  const ids = process.env.IDS ? new Set(process.env.IDS.split(',')) : null;
  const lines = letters2.filter(([id]) => !ids || ids.has(id));
  const samples = ids ? [] : maisieLines;
  if (DRY) {
    for (const [id, input] of lines) console.log(`${id}  ${input}`);
    console.log(`${lines.length} lines x ${takes} takes = ${lines.length * takes} requests, plus ${samples.length} in Maisie`);
    process.exit(0);
  }
  mkdirSync(`${OUT3}/narrator`, { recursive: true });
  mkdirSync(`${OUT3}/maisie`, { recursive: true });
  const m = { model: 'elevenlabs/eleven-v4', voice: 'matilda', clips: [], maisie: [], errors: [] };
  for (const [id, input] of lines) for (let take = 1; take <= takes; take++) {
    const file = `narrator/${id}-${take}.mp3`;
    try {
      writeFileSync(`${OUT3}/${file}`, await speak({ model: m.model, voice: 'matilda', input, response_format: 'mp3' }));
      m.clips.push({ id, take, input, file });
    } catch (e) { m.errors.push(`${id}-${take}: ${e.message}`); }
    console.log(`${id} take ${take}`);
  }
  for (const [id, input] of samples) {
    const file = `maisie/${id}.mp3`;
    try {
      writeFileSync(`${OUT3}/${file}`, await speak({ model: m.model, voice: MAISIE, input, response_format: 'mp3' }));
      m.maisie.push({ id, input, file });
    } catch (e) { m.errors.push(`maisie ${id}: ${e.message}`); }
  }
  writeFileSync(`${OUT3}/manifest.json`, JSON.stringify(m, null, 1));
  console.log(`clips ${m.clips.length}, maisie ${m.maisie.length}, errors ${m.errors.length}`);
  for (const e of m.errors) console.log('ERR', e);
  process.exit(0);
}

const manifest = { narrator: { model: 'elevenlabs/eleven-v4', voice: 'matilda', clips: [] }, effects: [], errors: [] };
for (const [id, input] of ONLY === 'effects' ? [] : narrator) {
  try {
    writeFileSync(`${OUT}/narrator/${id}.mp3`, await speak({ model: 'elevenlabs/eleven-v4', voice: 'matilda', input, response_format: 'mp3' }));
    manifest.narrator.clips.push({ id, input, file: `narrator/${id}.mp3` });
  } catch (e) { manifest.errors.push(`${id}: ${e.message}`); }
}
for (const [id, prompt] of ONLY === 'narrator' ? [] : EFFECTS) for (const take of [1, 2, 3]) {
  try {
    writeFileSync(`${OUT}/effects/${id}-${take}.mp3`, await speak({ model: 'bytedance-seed/seed-audio-1-0', input: prompt, response_format: 'mp3' }));
    manifest.effects.push({ id, take, prompt, file: `effects/${id}-${take}.mp3`, model: 'bytedance-seed/seed-audio-1-0' });
  } catch (e) { manifest.errors.push(`${id}-${take}: ${e.message}`); }
}
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1));
console.log(`narrator ${manifest.narrator.clips.length}, effects ${manifest.effects.length}, errors ${manifest.errors.length}`);
for (const e of manifest.errors) console.log('ERR', e);
