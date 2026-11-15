// Tries AI coloring pages side by side (ADR 0033): one or more photos (or ideas) through several prompts and
// several image models, and writes a contact sheet to compare them. Run from the repo root:
//
//   node server/tools/ai-samples.ts --photo path/to/photo.jpg
//   node server/tools/ai-samples.ts --photo a.jpg --models google/gemini-3.1-flash-image,openai/gpt-5-image-mini --prompts server,trace
//   node server/tools/ai-samples.ts --idea "a fire truck with a ladder"
//
// The OpenRouter key comes from OPENROUTER_API_KEY, or the file ~/.crayon-box/openrouter.key. Never from the repo.
// Output goes to .ai-samples/<time>/ in the repo, which git ignores: photos of the family must never be committed
// (CLAUDE.md privacy rule). Every call costs money; the sheet shows what each one cost.
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { BASE_STYLE, DEFAULT_IMAGE_MODEL, DEFAULT_SECOND_MODEL, PHOTO_ASK, STYLE, detailLine, makePage, type AiConfig } from '../src/ai.ts';
import type { AiPageRequest, Detail } from '../src/api.ts';

interface PromptVariant {
  id: string;
  note?: string;
  text: string;
}

const { values } = parseArgs({
  options: {
    photo: { type: 'string', multiple: true },
    idea: { type: 'string', multiple: true },
    models: { type: 'string' },
    prompts: { type: 'string' },
    'prompts-file': { type: 'string' },
    detail: { type: 'string', default: 'simple' },
    takes: { type: 'string', default: '1' },
    out: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function key(): string {
  const env = process.env.OPENROUTER_API_KEY?.trim();
  if (env) return env;
  const file = join(homedir(), '.crayon-box', 'openrouter.key');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  return fail(`No OpenRouter key: set OPENROUTER_API_KEY, or put the key alone in ${file}.`);
}

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

const detail: Detail = values.detail === 'more' ? 'more' : 'simple';
const takes = Math.max(1, Math.min(4, Number(values.takes) || 1));
const promptsFile = resolve(values['prompts-file'] ?? join(import.meta.dirname, 'photo-prompts.json'));
let variants = JSON.parse(readFileSync(promptsFile, 'utf8')) as PromptVariant[];
if (values.prompts) {
  const want = values.prompts.split(',').map((p) => p.trim());
  variants = variants.filter((v) => want.includes(v.id));
  if (!variants.length) fail(`None of ${want.join(', ')} is in ${promptsFile}.`);
}
const models = values.models ? values.models.split(',').map((m) => m.trim()).filter(Boolean) : [DEFAULT_IMAGE_MODEL, DEFAULT_SECOND_MODEL];

interface Subject {
  name: string;
  /** For a photo: its copy in the output folder, shown on the sheet. */
  shown?: string;
  request: (model: string) => AiPageRequest;
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const out = resolve(values.out ?? join(import.meta.dirname, '..', '..', '.ai-samples', stamp));

const subjects: Subject[] = [];
(values.photo ?? []).forEach((path, i) => {
  const type = MIME[extname(path).toLowerCase()];
  if (!type) fail(`${path}: use a JPG, PNG or WebP photo.`);
  const bytes = readFileSync(path);
  if (bytes.length > 8 * 1024 * 1024) console.warn(`${basename(path)} is ${(bytes.length / 1e6).toFixed(1)} MB; the app shrinks photos to 1600 px first, so results may differ a little.`);
  const shown = `photo-${i + 1}${extname(path).toLowerCase()}`;
  if (!values['dry-run']) {
    mkdirSync(out, { recursive: true });
    copyFileSync(path, join(out, shown));
  }
  const image = `data:${type};base64,${bytes.toString('base64')}`;
  subjects.push({ name: `photo ${i + 1}`, shown, request: (model) => ({ kind: 'photo', image, detail, model }) });
});
(values.idea ?? []).forEach((idea) => subjects.push({ name: idea, request: (model) => ({ kind: 'idea', idea, detail, model }) }));
if (!subjects.length) fail('Give at least one --photo or --idea.');

function fill(text: string, subject: Subject, request: AiPageRequest): string {
  const filled = text
    .replaceAll('{style}', STYLE)
    .replaceAll('{base}', BASE_STYLE)
    .replaceAll('{photo}', PHOTO_ASK)
    .replaceAll('{detail}', detailLine(detail));
  // The photo prompts are about "this photo"; for an idea, say what to draw instead.
  return request.kind === 'idea' ? `${filled} The picture: ${subject.name}` : filled;
}

interface Cell {
  subject: number;
  variant: string;
  model: string;
  take: number;
  file?: string;
  error?: string;
  seconds?: number;
  cost?: number;
}

const jobs: Cell[] = [];
subjects.forEach((_, s) => {
  for (const v of variants) for (const model of models) for (let t = 1; t <= takes; t++) jobs.push({ subject: s, variant: v.id, model, take: t });
});
console.log(`${jobs.length} calls: ${subjects.length} subject(s) × ${variants.length} prompt(s) × ${models.length} model(s) × ${takes} take(s). Writing to ${out}`);
if (values['dry-run']) process.exit(0);
mkdirSync(out, { recursive: true });

const cfg: AiConfig = { key: key(), imageModel: models[0]!, secondModel: models[0]!, drawModel: '', dailyLimit: Infinity, timeoutMs: 180_000 };

function writeSheet(): void {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const total = jobs.reduce((a, j) => a + (j.cost ?? 0), 0);
  let html = `<!doctype html><meta charset="utf-8"><title>AI samples ${stamp}</title>
<style>
body{font:15px system-ui,sans-serif;margin:24px;background:#f4f5f7;color:#1d2433}
table{border-collapse:collapse}td,th{border:1px solid #ccd;padding:8px;vertical-align:top;background:#fff}
th{font-size:13px;text-align:left;max-width:260px}img{width:260px;display:block;border:1px solid #eee}
.meta{font-size:12px;color:#667;margin-top:4px}.err{color:#b3261e;font-size:13px;max-width:260px}
details{font-size:12px;color:#445;max-width:260px}.clean img.out{filter:grayscale(1) contrast(6)}
</style>
<h1>AI samples, ${esc(stamp)}</h1>
<p>Detail: ${detail}. Total cost so far: $${total.toFixed(3)}. <label><input type="checkbox" onchange="document.body.classList.toggle('clean',this.checked)"> Rough clean-up preview (the app's own clean-up is better)</label></p>`;
  subjects.forEach((subject, s) => {
    html += `<h2>${esc(subject.name)}</h2>${subject.shown ? `<img src="${subject.shown}" style="width:200px">` : ''}<table><tr><th>Prompt</th>`;
    for (const m of models) html += `<th>${esc(m)}</th>`;
    html += '</tr>';
    for (const v of variants) {
      html += `<tr><th>${esc(v.id)}<div class="meta">${esc(v.note ?? '')}</div><details><summary>prompt</summary>${esc(fill(v.text, subject, subject.request('')))}</details></th>`;
      for (const m of models) {
        html += '<td>';
        for (const j of jobs.filter((c) => c.subject === s && c.variant === v.id && c.model === m)) {
          if (j.file) html += `<a href="${j.file}"><img class="out" src="${j.file}"></a>`;
          else if (j.error) html += `<div class="err">${esc(j.error)}</div>`;
          else html += '<div class="meta">waiting…</div>';
          if (j.seconds !== undefined) html += `<div class="meta">${j.seconds.toFixed(1)} s${j.cost !== undefined ? ` · $${j.cost.toFixed(3)}` : ''}</div>`;
        }
        html += '</td>';
      }
      html += '</tr>';
    }
    html += '</table>';
  });
  writeFileSync(join(out, 'index.html'), html);
}

writeSheet();
let next = 0;
async function worker(): Promise<void> {
  while (next < jobs.length) {
    const job = jobs[next++]!;
    const subject = subjects[job.subject]!;
    const request = subject.request(job.model);
    const variant = variants.find((v) => v.id === job.variant)!;
    const started = Date.now();
    try {
      const page = await makePage(cfg, request, { model: job.model, prompt: fill(variant.text, subject, request) });
      const file = `s${job.subject + 1}-${job.variant}-${job.model.replace(/[^a-z0-9.-]+/gi, '_')}-${job.take}.${EXT[page.type] ?? 'png'}`;
      writeFileSync(join(out, file), page.bytes);
      job.file = file;
      job.cost = page.cost;
    } catch (err) {
      job.error = err instanceof Error ? err.message : String(err);
    }
    job.seconds = (Date.now() - started) / 1000;
    console.log(`${job.file ? 'ok  ' : 'FAIL'} ${job.variant} × ${job.model} (${job.seconds.toFixed(1)} s)${job.error ? `: ${job.error}` : ''}`);
    writeSheet();
  }
}
await Promise.all([worker(), worker(), worker()]);
const total = jobs.reduce((a, j) => a + (j.cost ?? 0), 0);
console.log(`Done. Cost: $${total.toFixed(3)}. Open ${join(out, 'index.html')}`);
