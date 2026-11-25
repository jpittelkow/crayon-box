// The Linux smoke run (ADR 0046, linux-plan.md phase A): drives the built app under WebKitGTK and fails when something
// a browser test on Chromium cannot see is broken. Run by CI's `linux-appimage` job; by hand on Linux or in WSL:
//
//   dbus-run-session -- xvfb-run -a -s "-screen 0 1920x1080x24" node tools/linux-smoke.mjs
//
// It checks that the app starts, that a bucket fill lands (the worker and the canvas), that leaving the page writes
// the finished picture into the Pictures folder (the fs plugin's scope), that the shipped sounds decode, that the
// driving game opens (WebGL), and that the page reported no errors.
//
// How: WebKit's own WebDriver (`WebKitWebDriver`, package `webkit2gtk-driver` or `webkitgtk-webdriver`) starts the
// program named in `webkitgtk:browserOptions`; `TAURI_WEBVIEW_AUTOMATION=true` lets it in. That is all `tauri-driver`
// does on Linux. The app gets a home folder of its own with a Pictures folder set up, so nothing of the machine's
// is touched. It opens full screen and ignores close requests: keep it on a headless display (`xvfb`), never a
// desktop. The headless display draws in software, so nothing here says how fast the driving game is.
//
//   APP    the program or AppImage to drive (default src-tauri/target/release/crayon-box)
//   SHOTS  where screenshots and report.json go (default test-results/linux-smoke)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const APP = resolve(process.env.APP ?? 'src-tauri/target/release/crayon-box');
const SHOTS = resolve(process.env.SHOTS ?? 'test-results/linux-smoke');
const PORT = Number(process.env.SMOKE_PORT ?? 4445);
const BASE = `http://127.0.0.1:${PORT}`;
/** The shapes page's circle, in page pixels (tests/e2e/helpers.ts). */
const CIRCLE = { x: 560, y: 800, pageW: 2048, pageH: 1536 };

if (!existsSync(APP)) {
  console.error(`No program at ${APP}. Build it first: npx tauri build`);
  process.exit(2);
}
mkdirSync(SHOTS, { recursive: true });

// A home of its own, with the standard folders a desktop account has (without them there is no Pictures folder).
const home = mkdtempSync(join(tmpdir(), 'crayon-smoke-'));
mkdirSync(join(home, '.config'), { recursive: true });
writeFileSync(join(home, '.config', 'user-dirs.dirs'), 'XDG_PICTURES_DIR="$HOME/Pictures"\n');
const env = { ...process.env, HOME: home, TAURI_WEBVIEW_AUTOMATION: 'true', GDK_BACKEND: 'x11', APPIMAGE_EXTRACT_AND_RUN: '1' };
for (const name of ['WAYLAND_DISPLAY', 'XDG_DATA_HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_PICTURES_DIR']) delete env[name];

const report = { app: APP, checks: [] };
const failures = [];
const pass = (name, detail = '') => {
  report.checks.push({ name, ok: true, detail });
  console.log(`ok    ${name}${detail ? `: ${detail}` : ''}`);
};
const fail = (name, detail) => {
  report.checks.push({ name, ok: false, detail });
  failures.push(name);
  console.log(`FAIL  ${name}: ${detail}`);
};

const driver = spawn('WebKitWebDriver', [`--port=${PORT}`, '--host=127.0.0.1'], { env, stdio: ['ignore', 'ignore', 'inherit'] });
driver.on('error', (err) => {
  console.error(`WebKitWebDriver did not start (${err.message}). Install webkit2gtk-driver (or webkitgtk-webdriver).`);
  process.exit(2);
});

async function wd(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  if (json.value && json.value.error) throw new Error(`${path}: ${json.value.error}: ${json.value.message}`);
  return json.value;
}

let S = '';
const js = (script, ...args) => wd('POST', `${S}/execute/sync`, { script, args });
const jsAsync = (script, ...args) => wd('POST', `${S}/execute/async`, { script, args });
let shotNo = 0;
async function shot(name) {
  const png = await wd('GET', `${S}/screenshot`);
  writeFileSync(join(SHOTS, `${String(++shotNo).padStart(2, '0')}-${name}.png`), Buffer.from(png, 'base64'));
}
async function until(what, check, ms = 60_000) {
  const start = Date.now();
  for (;;) {
    const value = await check().catch(() => null);
    if (value) return Date.now() - start;
    if (Date.now() - start > ms) throw new Error(`timed out after ${ms / 1000} s waiting for ${what}`);
    await sleep(250);
  }
}
const untilJs = (what, script, ms) => until(what, () => js(script), ms);
/** A visible button by its accessible name. */
const FIND = `
  const name = arguments[0], exact = arguments[1];
  const label = (e) => (e.getAttribute('aria-label') || e.textContent || '').trim();
  const all = [...document.querySelectorAll('button,[role=button]')].filter((e) => e.getClientRects().length);
  return all.find((e) => (exact ? label(e) === name : label(e).includes(name))) || null;`;
async function press(name, exact = true) {
  let el = null;
  await until(`the button "${name}"`, async () => (el = await js(FIND, name, exact)));
  await wd('POST', `${S}/element/${Object.values(el)[0]}/click`, {});
}
async function clickAt(x, y) {
  await wd('POST', `${S}/actions`, {
    actions: [
      {
        type: 'pointer',
        id: 'mouse',
        parameters: { pointerType: 'mouse' },
        actions: [
          { type: 'pointerMove', duration: 0, x: Math.round(x), y: Math.round(y) },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 60 },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ],
  });
  await wd('DELETE', `${S}/actions`);
}
/** Page errors and `console.error` lines since the page loaded, kept by the page itself. */
const WATCH_ERRORS = `
  window.__smokeErrors = [];
  addEventListener('error', (e) => __smokeErrors.push(String(e.message)));
  addEventListener('unhandledrejection', (e) => __smokeErrors.push('rejection: ' + String(e.reason)));
  const original = console.error;
  console.error = (...a) => { __smokeErrors.push(a.map(String).join(' ')); original(...a); };`;
async function expectNoErrors(name) {
  const errors = await js(`return window.__smokeErrors || []`);
  if (errors.length) fail(name, errors.join(' | ').slice(0, 600));
  else pass(name);
}
async function check(name, fn) {
  try {
    const detail = await fn();
    if (detail !== false) pass(name, detail ?? '');
  } catch (err) {
    fail(name, String(err.message ?? err).slice(0, 600));
    await shot(`failed-${name.replace(/\W+/g, '-')}`).catch(() => {});
  }
}

async function run() {
  await until('WebKitWebDriver', async () => (await fetch(`${BASE}/status`)).ok, 15_000);
  const session = await wd('POST', '/session', {
    capabilities: { alwaysMatch: { browserName: 'wry', 'webkitgtk:browserOptions': { binary: APP, args: [] } } },
  });
  S = `/session/${session.sessionId}`;
  await wd('POST', `${S}/timeouts`, { script: 120_000 });

  await check('the app starts', async () => {
    const ms = await untilJs('the first screen', `return !!document.querySelector('[data-screen]')`, 90_000);
    await js(WATCH_ERRORS);
    await sleep(1000);
    await shot('kid-picker');
    const page = await js(`return { screen: document.querySelector('[data-screen]').dataset.screen, tauri: '__TAURI_INTERNALS__' in window, ua: navigator.userAgent }`);
    report.userAgent = page.ua;
    if (page.screen !== 'kid-picker' || !page.tauri) throw new Error(`opened on ${page.screen}, shell ${page.tauri ? 'present' : 'missing'}`);
    return `the kid picker after ${ms} ms`;
  });

  await check('the shipped sounds decode', async () => {
    const assets = readdirSync('dist/assets');
    const files = ['.mp3', '.wav'].map((ext) => assets.find((f) => f.endsWith(ext))).filter(Boolean);
    if (files.length < 2) throw new Error('no built sound files in dist/assets');
    const out = await jsAsync(
      `const files = arguments[0], done = arguments[arguments.length - 1];
       (async () => {
         const ctx = new AudioContext(); const out = {};
         for (const f of files) {
           try { out[f] = (await ctx.decodeAudioData(await (await fetch('/assets/' + f)).arrayBuffer())).duration; }
           catch (e) { out[f] = 'error: ' + e; }
         }
         done(out);
       })().catch((e) => done({ error: String(e) }));`,
      files,
    );
    const bad = Object.entries(out).filter(([, v]) => typeof v !== 'number' || !(v > 0));
    if (bad.length) throw new Error(JSON.stringify(bad));
    return files.map((f) => `${f.split('.').pop()} ${out[f].toFixed(2)} s`).join(', ');
  });

  await check('a fill lands on a coloring page', async () => {
    await press('Star kid', false);
    await untilJs('home or coloring', `return !!document.querySelector('[data-screen="home"],[data-screen="game-coloring"]')`);
    if (await js(`return !!document.querySelector('[data-screen="home"]')`)) await press('Coloring');
    await press('Shapes');
    await press('Circle, square and triangle page');
    await untilJs('the coloring page', `const p = document.querySelector('.coloring-page'); return !!p && p.dataset.ready === 'true'`);
    const box = await js(`const r = document.querySelector('.coloring-page').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]`);
    await clickAt(box[0] + (CIRCLE.x / CIRCLE.pageW) * box[2], box[1] + (CIRCLE.y / CIRCLE.pageH) * box[3]);
    const ms = await untilJs(
      'the fill',
      `const c = document.querySelector('.layer-paint'); return !!c && c.getContext('2d').getImageData(${CIRCLE.x}, ${CIRCLE.y}, 1, 1).data[3] > 0`,
      30_000,
    );
    await shot('coloring-filled');
    return `after ${ms} ms`;
  });

  await check('leaving the page writes the finished picture', async () => {
    await press('Back');
    const art = join(home, 'Pictures', 'Coloring Book', 'Art', 'star');
    const names = () => (existsSync(art) ? readdirSync(art) : []);
    await until('a .png in Pictures/Coloring Book/Art/star', async () => names().some((n) => n.endsWith('.png')), 20_000).catch((err) => {
      throw new Error(`${err.message}; the folder holds [${names().join(', ')}]`);
    });
    const left = names().filter((n) => !n.endsWith('.png'));
    if (left.length) throw new Error(`left behind: ${left.join(', ')}`);
    return names().join(', ');
  });
  await expectNoErrors('no page errors in coloring');

  await check('the driving game opens', async () => {
    await js(`location.reload()`);
    await sleep(1000);
    await untilJs('the first screen', `return !!document.querySelector('[data-screen="kid-picker"]')`, 60_000);
    await js(WATCH_ERRORS);
    await press('Star kid', false);
    await untilJs('home', `return !!document.querySelector('[data-screen="home"]')`);
    await press('Driving');
    await untilJs('the vehicle picker', `const p = document.querySelector('.driving-picker'); return !!p && p.dataset.ready === 'true'`, 120_000);
    await press('Car');
    // Software drawing can take a while to build the island (docs/memory/gotchas.md, "CI draws the game in software").
    const ms = await untilJs('the island', `const d = document.querySelector('.driving'); return !!d && d.dataset.ready === 'true'`, 240_000);
    await sleep(2000);
    await shot('driving');
    const state = await js(`const c = document.querySelector('.driving-canvas'); return { webgl2: !!document.createElement('canvas').getContext('webgl2'), cars: c.drivingWorld ? c.drivingWorld.cars.length : 0 }`);
    if (!state.webgl2 || state.cars < 1) throw new Error(JSON.stringify(state));
    return `ready after ${ms} ms, ${state.cars} vehicles`;
  });
  await expectNoErrors('no page errors in driving');
}

let crashed = null;
try {
  await run();
} catch (err) {
  crashed = err;
  fail('the smoke run itself', String(err.message ?? err).slice(0, 600));
  if (S) await shot('crashed').catch(() => {});
}
if (S) await wd('DELETE', S).catch(() => {});
driver.kill();
// The app ignores close requests while it is kept full screen, so the driver can leave it running.
spawnSync('pkill', ['-x', 'crayon-box']);
writeFileSync(join(SHOTS, 'report.json'), JSON.stringify(report, null, 2) + '\n');
rmSync(home, { recursive: true, force: true });
console.log(failures.length ? `\n${failures.length} failed: ${failures.join('; ')}. Screenshots in ${SHOTS}` : '\nAll passed.');
process.exit(failures.length || crashed ? 1 : 0);
