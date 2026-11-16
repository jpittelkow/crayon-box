// Turns picked sound files into what the app ships (ADR 0032): silence trimmed, levelled to one loudness, short
// one-shots as WAV (no MP3 start delay on a tap), voice as MP3. Writes assets/sounds/ and assets/sounds/sounds.json.
//
//   node tools/sounds/prepare.mjs <sources folder>
//
// <sources folder> holds the downloads (as unpacked from OpenGameArt) and the generated narrator clips in
// narrator/. Needs ffmpeg and ffprobe on PATH, or FFMPEG_DIR pointing at their folder.
// NARRATOR_ONLY=1 does only the narrator clips and keeps the rest of sounds.json (see below).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const out = join(repo, 'assets/sounds');
const srcDir = process.argv[2];
if (!srcDir) { console.error('usage: node tools/sounds/prepare.mjs <sources folder>'); process.exit(1); }
const bin = (name) => (process.env.FFMPEG_DIR ? join(process.env.FFMPEG_DIR, name) : name);
const picks = JSON.parse(readFileSync(join(here, 'picks.json'), 'utf8'));

// Loudness of the sounding part only (the same measure as the audition page the owner picked by ear), capped so
// the peak stays below `peakCap`.
const LEVEL = { ui: { rms: 0.09, peakCap: 0.7 }, voice: { rms: 0.13, peakCap: 0.9 }, loop: { rms: 0.1, peakCap: 0.8 } };
const RATE = 44100;
const TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.005,areverse,'
  + 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse';

function samples(file, filter) {
  const raw = execFileSync(bin('ffmpeg'), ['-v', 'error', '-i', file, '-af', filter, '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'],
    { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

function gainFor(d, { rms, peakCap }) {
  let peak = 0;
  for (const x of d) peak = Math.max(peak, Math.abs(x));
  const floor = peak * 0.05;
  let sum = 0, n = 0;
  for (const x of d) if (Math.abs(x) > floor) { sum += x * x; n++; }
  const r = Math.sqrt(sum / Math.max(1, n));
  return Math.min(rms / Math.max(r, 1e-4), peakCap / Math.max(peak, 1e-4));
}

function prepare(input, output, kind) {
  const g = gainFor(samples(input, TRIM), LEVEL[kind]);
  // A 5 ms fade at each end so no trimmed edge clicks.
  const af = `${TRIM},volume=${g.toFixed(4)},afade=t=in:d=0.005,areverse,afade=t=in:d=0.005,areverse`;
  const codec = output.endsWith('.mp3') ? ['-c:a', 'libmp3lame', '-q:a', '4'] : ['-c:a', 'pcm_s16le'];
  mkdirSync(dirname(output), { recursive: true });
  execFileSync(bin('ffmpeg'), ['-v', 'error', '-y', '-i', input, '-af', af, '-ac', '1', '-ar', '44100', ...codec, '-map_metadata', '-1', output]);
  const secs = Number(execFileSync(bin('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', output]).toString());
  return { seconds: Math.round(secs * 1000) / 1000, bytes: statSync(output).size };
}

/**
 * A seamless loop (engines, the crayon): the steadiest `seconds` of the take (an engine's idle, not its rev), with
 * the stretch just after it crossfaded into its start, so the end runs straight on into the beginning.
 */
function prepareLoop(input, output, seconds) {
  const s = samples(input, TRIM);
  const L = Math.round(seconds * RATE), X = Math.round(0.15 * RATE), frame = Math.round(0.05 * RATE);
  if (s.length < L + X) throw new Error(`${input} is shorter than a ${seconds} s loop`);
  const frameRms = [], frameZcr = [];
  for (let i = 0; i + frame <= s.length; i += frame) {
    let sum = 0, crossings = 0;
    for (let j = i; j < i + frame; j++) {
      sum += s[j] * s[j];
      if (j > i && (s[j] >= 0) !== (s[j - 1] >= 0)) crossings++;
    }
    frameRms.push(Math.sqrt(sum / frame));
    frameZcr.push(crossings / frame);
  }
  const zcrMax = Math.max(...frameZcr, 1e-6);
  const overall = frameRms.reduce((a, b) => a + b, 0) / frameRms.length;
  let best = 0, bestScore = Infinity;
  for (let a = 0; a + L + X <= s.length; a += Math.round(0.01 * RATE)) {
    const fr = frameRms.slice(Math.floor(a / frame), Math.floor((a + L + X) / frame));
    const mean = fr.reduce((p, q) => p + q, 0) / fr.length;
    const sd = Math.sqrt(fr.reduce((p, q) => p + (q - mean) ** 2, 0) / fr.length);
    // Steady (low spread), clearly sounding (not a quiet gap), and low-pitched: an idle, not a rev. Speed raises the
    // pitch in the game, so a loop cut from a rev would sound strained at a standstill.
    const zc = frameZcr.slice(Math.floor(a / frame), Math.floor((a + L + X) / frame));
    const pitch = zc.reduce((p, q) => p + q, 0) / zc.length / zcrMax;
    const score = sd / Math.max(mean, 1e-4) + 0.6 * pitch + (mean < overall * 0.5 ? 10 : 0);
    if (score < bestScore) { bestScore = score; best = a; }
  }
  const out = new Float32Array(L);
  for (let i = 0; i < L; i++) out[i] = s[best + i];
  for (let i = 0; i < X; i++) {
    const t = i / X;
    out[i] = s[best + i] * Math.sin((t * Math.PI) / 2) + s[best + L + i] * Math.cos((t * Math.PI) / 2);
  }
  const g = gainFor(out, LEVEL.loop);
  for (let i = 0; i < L; i++) out[i] *= g;
  mkdirSync(dirname(output), { recursive: true });
  execFileSync(bin('ffmpeg'), ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(RATE), '-ac', '1', '-i', '-', '-c:a', 'pcm_s16le', output],
    { input: Buffer.from(out.buffer) });
  return { seconds, bytes: statSync(output).size, loopFrom: Math.round((best / RATE) * 1000) / 1000 };
}

const manifest = { _about: 'Generated by tools/sounds/prepare.mjs from tools/sounds/picks.json (ADR 0032). Do not edit by hand.', sounds: [] };
const add = (outRel, fromId, kind, extra, info) => {
  const s = picks.sources[fromId];
  manifest.sounds.push({ file: outRel, kind, source: s.title, url: s.url, license: s.license, ...(s.model ? { model: s.model, voice: s.voice } : {}), ...extra, ...info });
};

// NARRATOR_ONLY=1 prepares just the narrator clips in <sources folder>/narrator/ and adds them to the shipped
// sounds.json, keeping every other entry as it is (for a later narrator batch when the first batch's downloads are
// not at hand). A clip with the same file name replaces the old one.
const NARRATOR_ONLY = process.env.NARRATOR_ONLY === '1';
const nar = picks.narrator, narDir = join(srcDir, nar.dir);
const narFiles = readdirSync(narDir).filter((f) => f.endsWith('.mp3')).sort();
if (NARRATOR_ONLY) {
  const shipped = JSON.parse(readFileSync(join(out, 'sounds.json'), 'utf8'));
  const replaced = new Set(narFiles.map((f) => `voice/${f}`));
  manifest.sounds.push(...shipped.sounds.filter((s) => !replaced.has(s.file)));
} else {
  for (const p of picks.sounds) {
    const input = join(srcDir, p.file), output = join(out, p.out);
    const info = p.kind === 'loop' ? prepareLoop(input, output, p.loopSeconds ?? 1.2) : prepare(input, output, p.kind);
    add(p.out, p.from, p.kind, { original: p.file.split('/').pop(), ...(p.prompt ? { prompt: p.prompt } : {}), ...(p.note ? { note: p.note } : {}) }, info);
  }
}
for (const f of narFiles) {
  const rel = `voice/${f}`;
  const info = prepare(join(narDir, f), join(out, rel), nar.kind);
  add(rel, nar.from, nar.kind, {}, info);
}
writeFileSync(join(out, 'sounds.json'), JSON.stringify(manifest, null, 1) + '\n');
const total = manifest.sounds.reduce((a, s) => a + s.bytes, 0);
console.log(`${manifest.sounds.length} files, ${Math.round(total / 1024)} KB`);
for (const s of manifest.sounds.filter((s) => s.kind !== 'voice')) console.log(`  ${s.file}: ${s.seconds} s${s.loopFrom !== undefined ? ` (loop from ${s.loopFrom} s)` : ''}`);
