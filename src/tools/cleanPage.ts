// Dev tool: turns an image (an AI-made page, a scan) into a page.png that passes the page check (ADR 0005, 0022).
// Open http://localhost:5173/tools/clean-page.html while `npm run dev` runs. Nothing here ships in the app.
import { cleanUpLineArt } from '../games/coloring/engine/cleanup';
import { checkPage } from '../games/coloring/engine/pageCheck';
import '../ui/tokens.css';
import { button, card, h } from '../ui/parent';

const root = document.getElementById('tool')!;
document.body.style.margin = '0';

const file = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Image to clean up' });
const gap = h('input', { class: 'pw-input', type: 'number', min: '0', max: '20', value: '6', id: 'gap' });
const status = h('p', { class: 'pw-muted', role: 'status' }, 'Pick an image of black line art on a light background.');
const report = h('div', { style: 'display: flex; flex-direction: column; gap: 6px' });
const before = h('img', { alt: 'Original', style: 'width: 100%; border: 1px solid var(--line); background: #fff' });
const after = h('canvas', {
  width: '2048',
  height: '1536',
  style: 'width: 100%; border: 1px solid var(--line); background: #fff',
}) as HTMLCanvasElement;
let pngUrl: string | null = null;
const download = h('a', { class: 'pw-btn pw-btn--primary', download: 'page.png', hidden: true }, 'Download page.png');

async function run(): Promise<void> {
  const chosen = file.files?.[0];
  if (!chosen) return;
  status.textContent = 'Cleaning up…';
  report.replaceChildren();
  download.hidden = true;
  before.src = URL.createObjectURL(chosen);
  const bitmap = await createImageBitmap(chosen);
  const c = document.createElement('canvas');
  c.width = bitmap.width;
  c.height = bitmap.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  const pixels = ctx.getImageData(0, 0, c.width, c.height);

  // Let the status paint before the heavy work.
  await new Promise((r) => setTimeout(r, 30));
  const t0 = performance.now();
  const result = cleanUpLineArt(pixels.data, c.width, c.height, { gap: Number(gap.value) || 0 });
  const check = checkPage(result.ink, result.width, result.height);
  after.getContext('2d')!.putImageData(new ImageData(result.rgba, result.width, result.height), 0, 0);

  const blob = await new Promise<Blob | null>((r) => after.toBlob(r, 'image/png'));
  if (pngUrl) URL.revokeObjectURL(pngUrl);
  pngUrl = blob ? URL.createObjectURL(blob) : null;
  if (pngUrl) {
    download.setAttribute('href', pngUrl);
    download.hidden = false;
  }

  status.textContent = `Done in ${Math.round(performance.now() - t0)} ms. Threshold ${result.threshold}.`;
  const where = (b: { x: number; y: number; width: number; height: number }) =>
    `x ${b.x}–${b.x + b.width}, y ${b.y}–${b.y + b.height}`;
  report.append(
    h('p', {}, `${check.regions} areas to color.`),
    check.openShapes.length
      ? h('p', { style: 'color: var(--danger); font-weight: 700' }, `Open shapes around: ${check.openShapes.map(where).join('; ')}`)
      : h('p', { style: 'color: var(--ok); font-weight: 700' }, 'No open shapes.'),
    h('p', { class: 'pw-muted' }, `${check.smallRegions.length} small areas (a warning, not a failure).`),
  );
}

file.addEventListener('change', () => void run());
gap.addEventListener('change', () => void run());

root.append(
  h(
    'div',
    { class: 'parent-world', style: 'position: static; background: var(--desk); min-height: 100vh' },
    h(
      'main',
      { class: 'pw-main', style: 'overflow: visible' },
      h('h1', {}, 'Clean up a page'),
      card(
        h(
          'p',
          {},
          'Turns line art into a page: gray becomes black or white, dust is removed, gaps up to the width below are ' +
            'closed, and it is fitted to 2048 × 1536. Save the result as page.png in a page folder (see pages/README.md).',
        ),
        h('div', { class: 'pw-row' }, file),
        h('div', { class: 'pw-field' }, h('label', { for: 'gap' }, 'Close gaps up to (px)'), gap),
        status,
        report,
        h('div', { class: 'pw-row' }, download, button('Pick another image', () => file.click())),
      ),
      h(
        'div',
        { style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 20px' },
        h('div', {}, h('h2', {}, 'Before'), before),
        h('div', {}, h('h2', {}, 'After'), after),
      ),
    ),
  ),
);
