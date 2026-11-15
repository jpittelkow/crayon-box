// Makes the narrator's clips (ElevenLabs v4, voice Matilda) and sound-effect takes (Seed Audio) through OpenRouter
// (ADR 0032). Runs inside the family sync server's container, which holds the OpenRouter key (ADR 0029), so the key
// never leaves the server; only the audio comes back. One request at a time (the key's in-flight budget).
//
//   copy this file into the container, then:  docker exec <container> node /tmp/generate.mjs
//   copy /tmp/gen2 back, put narrator/*.mp3 in the sources folder, run tools/sounds/prepare.mjs
//
// ElevenLabs retires Matilda on 2026-12-31: clips made later need her replacement or a new voice for the whole set.
import { mkdirSync, writeFileSync } from 'node:fs';

const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) { console.error('no key'); process.exit(1); }
// ONLY=narrator or ONLY=effects makes just that half.
const ONLY = process.env.ONLY ?? '';
const OUT = '/tmp/gen2';
mkdirSync(`${OUT}/narrator`, { recursive: true });
mkdirSync(`${OUT}/effects`, { recursive: true });

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
