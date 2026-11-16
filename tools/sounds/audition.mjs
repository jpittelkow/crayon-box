// Picking narrator takes by ear (ADR 0032, 0037). Works on the folder generate.mjs writes with ONLY=letters2 and ONLY=coloring
// (copied back from the container, e.g. to C:\tmp\gen3).
//
//   node tools/sounds/audition.mjs page <gen folder>
//     writes <gen folder>/audition.html: every line with its takes; pick one or mark it "redo", then
//     "Download picks" saves letters2-picks.json. Open the page from that folder (it plays the files beside it).
//   node tools/sounds/audition.mjs apply <gen folder> <picks.json> <sources folder>
//     copies each picked take to <sources folder>/narrator/<id>.mp3, where prepare.mjs looks for narrator clips,
//     and prints the IDS=… list of lines marked redo, for the next generate.mjs run.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [cmd, gen, picksFile, sources] = process.argv.slice(2);
if (!gen || (cmd !== 'page' && cmd !== 'apply') || (cmd === 'apply' && (!picksFile || !sources))) {
  console.error('usage: audition.mjs page <gen folder> | apply <gen folder> <picks.json> <sources folder>');
  process.exit(1);
}
// Every batch in the folder: manifest.json (letters2) and manifest-<batch>.json (coloring, …).
const manifests = readdirSync(gen).filter((f) => /^manifest(-[a-z0-9]+)?\.json$/.test(f))
  .sort((a, b) => (a === 'manifest.json' ? -1 : b === 'manifest.json' ? 1 : a.localeCompare(b)))
  .map((f) => JSON.parse(readFileSync(join(gen, f), 'utf8')));
if (manifests.length === 0) { console.error(`no manifest*.json in ${gen}`); process.exit(1); }
const manifest = {
  clips: manifests.flatMap((m) => m.clips.map((c) => ({ ...c, batch: m.batch ?? 'letters2' }))),
  maisie: manifests.flatMap((m) => m.maisie ?? []),
  errors: manifests.flatMap((m) => m.errors ?? []),
};

/** Lines in the order made, each with its takes. */
function lines() {
  const byId = new Map();
  for (const c of manifest.clips) {
    if (!byId.has(c.id)) byId.set(c.id, { id: c.id, input: c.input, batch: c.batch, takes: [] });
    byId.get(c.id).takes.push({ take: c.take, file: c.file });
  }
  return [...byId.values()];
}

if (cmd === 'apply') {
  const picks = JSON.parse(readFileSync(picksFile, 'utf8'));
  const out = join(sources, 'narrator');
  mkdirSync(out, { recursive: true });
  const redo = [];
  let copied = 0;
  for (const line of lines()) {
    const pick = picks[line.id];
    const take = pick === 'redo' ? undefined : line.takes.find((t) => t.take === pick);
    if (!take || !existsSync(join(gen, take.file))) { redo.push(line); continue; }
    copyFileSync(join(gen, take.file), join(out, `${line.id}.mp3`));
    copied++;
  }
  console.log(`copied ${copied} picked takes to ${out}`);
  if (redo.length) console.log(`not picked or marked redo (${redo.length}):`);
  for (const batch of new Set(redo.map((l) => l.batch))) {
    console.log(`  ONLY=${batch} IDS=${redo.filter((l) => l.batch === batch).map((l) => l.id).join(',')}`);
  }
  process.exit(0);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const group = (id) => id.split('-')[0];
const GROUPS = { sound: 'Letter sounds', tip: 'Tips', stroke: 'Stroke words', demo: 'How-to demo', praise: 'Praise',
  shape: 'Lines and shapes', level: 'Later levels', word: 'Words', tool: 'Coloring: tools', do: 'Coloring: what they do',
  size: 'Coloring: brush sizes', mode: 'Coloring: modes', color: 'Coloring: colours' };
let html = '';
let last = '';
for (const line of lines()) {
  const g = group(line.id);
  if (g !== last) { html += `<h2>${esc(GROUPS[g] ?? g)}</h2>`; last = g; }
  html += `<div class="line" data-id="${esc(line.id)}"><div class="name"><b>${esc(line.id)}</b> <span>${esc(line.input)}</span></div><div class="takes">`;
  for (const t of line.takes) {
    html += `<label><input type="radio" name="${esc(line.id)}" value="${t.take}"> ${t.take} <audio controls preload="none" src="${esc(t.file)}"></audio></label>`;
  }
  html += `<label><input type="radio" name="${esc(line.id)}" value="redo"> redo</label></div></div>`;
}
if (manifest.maisie?.length) {
  html += '<h2>Maisie samples (comparison only)</h2>';
  for (const c of manifest.maisie) {
    html += `<div class="line"><div class="name"><b>${esc(c.id)}</b> <span>${esc(c.input)}</span></div><div class="takes"><audio controls preload="none" src="${esc(c.file)}"></audio></div></div>`;
  }
}
if (manifest.errors?.length) html += `<h2>Errors</h2><pre>${esc(manifest.errors.join('\n'))}</pre>`;

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Narrator takes</title>
<style>
 :root { --bg: #fffaf2; --fg: #2b2b2b; --muted: #6b6b6b; --line: #e6dccb; --accent: #2f8f4e; }
 @media (prefers-color-scheme: dark) { :root { --bg: #1d1c1a; --fg: #eee; --muted: #aaa; --line: #3a3732; --accent: #5cc07c; } }
 body { background: var(--bg); color: var(--fg); font: 15px/1.4 system-ui, sans-serif; margin: 0 auto; max-width: 980px; padding: 16px; }
 h1 { font-size: 20px; } h2 { font-size: 17px; margin-top: 28px; border-bottom: 1px solid var(--line); padding-bottom: 4px; }
 .bar { position: sticky; top: 0; background: var(--bg); padding: 8px 0; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; border-bottom: 1px solid var(--line); }
 button { font: inherit; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--accent); background: var(--accent); color: #fff; cursor: pointer; }
 .line { padding: 8px 0; border-bottom: 1px dashed var(--line); }
 .line.picked .name b { color: var(--accent); }
 .name span { color: var(--muted); }
 .takes { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
 .takes label { display: flex; align-items: center; gap: 4px; }
 audio { height: 32px; max-width: 240px; }
 pre { white-space: pre-wrap; }
</style></head><body>
<h1>Narrator takes: letters batch 2 (ADR 0037)</h1>
<div class="bar"><span id="count"></span><button id="dl">Download picks</button><span id="redo"></span></div>
${html}
<script>
const KEY = 'letters2-picks';
let picks = {};
try { picks = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
const lines = [...document.querySelectorAll('.line[data-id]')];
function show() {
  let n = 0; const redo = [];
  for (const el of lines) {
    const id = el.dataset.id, v = picks[id];
    el.classList.toggle('picked', v !== undefined);
    if (v !== undefined) n++;
    if (v === 'redo') redo.push(id);
    for (const r of el.querySelectorAll('input')) r.checked = String(v) === r.value;
  }
  document.getElementById('count').textContent = n + ' of ' + lines.length + ' picked';
  document.getElementById('redo').textContent = redo.length ? 'redo: ' + redo.join(', ') : '';
  try { localStorage.setItem(KEY, JSON.stringify(picks)); } catch {}
}
document.addEventListener('change', (e) => {
  const r = e.target; if (r.type !== 'radio') return;
  picks[r.name] = r.value === 'redo' ? 'redo' : Number(r.value); show();
});
document.addEventListener('play', (e) => { for (const a of document.querySelectorAll('audio')) if (a !== e.target) a.pause(); }, true);
document.getElementById('dl').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(picks, null, 1)], { type: 'application/json' }));
  a.download = 'letters2-picks.json'; a.click();
});
show();
</script></body></html>`;
writeFileSync(join(gen, 'audition.html'), page);
console.log(`wrote ${join(gen, 'audition.html')} (${lines().length} lines)`);
