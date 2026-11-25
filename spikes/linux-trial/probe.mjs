// Drives the real Linux build of the app through WebKit's own WebDriver (what `tauri-driver` wraps on Linux) and
// reports what works under WebKitGTK. Run inside a headless X display; see probe.sh.
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const TRIAL = process.env.TRIAL;
const APP = `${TRIAL}/src-tauri/target/release/crayon-box`;
const SHOTS = process.env.SHOTS;
const PORT = 4445;
const BASE = `http://127.0.0.1:${PORT}`;
mkdirSync(SHOTS, { recursive: true });

const report = {};
const note = (k, v) => {
  report[k] = v;
  console.log(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
};

const driver = spawn('WebKitWebDriver', [`--port=${PORT}`, '--host=127.0.0.1'], {
  env: { ...process.env, TAURI_WEBVIEW_AUTOMATION: 'true' },
  stdio: ['ignore', 'inherit', 'inherit'],
});
await sleep(1500);

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

let sid;
for (const caps of [
  { browserName: 'wry', 'webkitgtk:browserOptions': { binary: APP, args: [] } },
  { 'webkitgtk:browserOptions': { binary: APP, args: [] } },
]) {
  try {
    const v = await wd('POST', '/session', { capabilities: { alwaysMatch: caps } });
    sid = v.sessionId;
    note('session', v.capabilities);
    break;
  } catch (err) {
    console.log('session attempt failed:', String(err).slice(0, 300));
  }
}
if (!sid) {
  driver.kill();
  process.exit(2);
}
const S = `/session/${sid}`;
await wd('POST', `${S}/timeouts`, { script: 90_000 });

const js = (script, ...args) => wd('POST', `${S}/execute/sync`, { script, args });
const jsAsync = (script, ...args) => wd('POST', `${S}/execute/async`, { script, args });
let shotNo = 0;
async function shot(name) {
  const png = await wd('GET', `${S}/screenshot`);
  const file = `${SHOTS}/${String(++shotNo).padStart(2, '0')}-${name}.png`;
  writeFileSync(file, Buffer.from(png, 'base64'));
}
async function until(what, script, ms = 60_000) {
  const start = Date.now();
  for (;;) {
    let v;
    try {
      v = await js(script);
    } catch (err) {
      v = null;
    }
    if (v) return Date.now() - start;
    if (Date.now() - start > ms) throw new Error(`Timed out waiting for ${what}`);
    await sleep(250);
  }
}
const FIND = `
  const name = arguments[0], exact = arguments[1];
  const label = (e) => (e.getAttribute('aria-label') || e.textContent || '').trim();
  const all = [...document.querySelectorAll('button,[role=button]')].filter((e) => e.getClientRects().length);
  return all.find((e) => (exact ? label(e) === name : label(e).includes(name))) || null;`;
async function press(name, exact = true) {
  const start = Date.now();
  for (;;) {
    const el = await js(FIND, name, exact).catch(() => null);
    if (el) {
      await wd('POST', `${S}/element/${Object.values(el)[0]}/click`, {});
      return;
    }
    if (Date.now() - start > 60_000) throw new Error(`No button "${name}"`);
    await sleep(250);
  }
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
const step = async (name, fn) => {
  try {
    await fn();
  } catch (err) {
    note(`FAILED ${name}`, String(err).slice(0, 400));
    await shot(`failed-${name}`).catch(() => {});
  }
};

// ---- 1. The app starts
await step('start', async () => {
  note('first screen after ms', await until('first screen', `return !!document.querySelector('[data-screen]')`, 60_000));
  await js(`window.__errs = []; addEventListener('error', (e) => __errs.push(String(e.message)));
            const _ce = console.error; console.error = (...a) => { __errs.push('console.error: ' + a.map(String).join(' ')); _ce(...a); };
            addEventListener('unhandledrejection', (e) => __errs.push('rejection: ' + String(e.reason)));`);
  await sleep(1500);
  await shot('kid-picker');
  note('page', await js(`return { href: location.href, ua: navigator.userAgent, screen: document.querySelector('[data-screen]').dataset.screen,
    size: [innerWidth, innerHeight], dpr: devicePixelRatio, tauri: '__TAURI_INTERNALS__' in window, fullscreenEl: !!document.fullscreenElement }`));
});

// ---- 2. What the engine offers
await step('features', async () => {
  note('features', await jsAsync(`
    const done = arguments[arguments.length - 1];
    (async () => {
      const out = {};
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2');
      out.webgl2 = !!gl;
      if (gl) {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        out.glRenderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        out.glVendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
        out.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      }
      out.offscreenCanvas = typeof OffscreenCanvas !== 'undefined';
      try {
        const blob = await new Promise((r) => { const k = document.createElement('canvas'); k.width = k.height = 4; k.toBlob(r, 'image/png'); });
        const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
        out.createImageBitmap = bmp.width === 4;
      } catch (e) { out.createImageBitmap = 'error ' + e; }
      out.webpEncode = document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp');
      const a = new Audio();
      out.canPlay = { mp3: a.canPlayType('audio/mpeg'), wav: a.canPlayType('audio/wav'), webmOpus: a.canPlayType('audio/webm; codecs=opus'),
        oggOpus: a.canPlayType('audio/ogg; codecs=opus'), mp4aac: a.canPlayType('audio/mp4; codecs=mp4a.40.2') };
      out.speech = 'speechSynthesis' in window;
      if (out.speech) {
        speechSynthesis.getVoices();
        await new Promise((r) => setTimeout(r, 1500));
        out.voices = speechSynthesis.getVoices().map((v) => v.lang + ' ' + v.name).slice(0, 5);
        out.voiceCount = speechSynthesis.getVoices().length;
      }
      out.mediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      out.mediaRecorder = typeof MediaRecorder !== 'undefined';
      if (out.mediaRecorder) out.recorderTypes = ['audio/webm', 'audio/webm;codecs=opus', 'audio/ogg', 'audio/mp4'].filter((t) => MediaRecorder.isTypeSupported(t));
      if (out.mediaDevices) {
        out.getUserMedia = await Promise.race([
          navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => { s.getTracks().forEach((t) => t.stop()); return 'granted'; }, (e) => e.name + ': ' + e.message),
          new Promise((r) => setTimeout(() => r('no answer in 8 s'), 8000)),
        ]);
      }
      out.pointerEvents = 'PointerEvent' in window;
      out.maxTouchPoints = navigator.maxTouchPoints;
      out.coalesced = 'getCoalescedEvents' in PointerEvent.prototype;
      out.storagePersist = !!(navigator.storage && navigator.storage.persist);
      done(out);
    })().catch((e) => done({ error: String(e) }));`));
});

// ---- 3. Shipped sounds decode
await step('sounds', async () => {
  const assets = readdirSync(`${TRIAL}/dist/assets`);
  const mp3 = assets.find((f) => f.endsWith('.mp3'));
  const wav = assets.find((f) => f.endsWith('.wav'));
  note('sound files tried', [mp3, wav]);
  note('decode', await jsAsync(`
    const files = arguments[0], done = arguments[arguments.length - 1];
    (async () => {
      const ctx = new AudioContext();
      const out = { state: ctx.state, sampleRate: ctx.sampleRate };
      for (const f of files) {
        try {
          const buf = await (await fetch('/assets/' + f)).arrayBuffer();
          const audio = await ctx.decodeAudioData(buf);
          out[f.split('.').pop()] = audio.duration.toFixed(2) + ' s, ' + audio.numberOfChannels + ' ch';
        } catch (e) { out[f.split('.').pop()] = 'error ' + e; }
      }
      done(out);
    })().catch((e) => done({ error: String(e) }));`, [mp3, wav]));
});

// ---- 4. Coloring: open a page and fill a shape (the worker, createImageBitmap, canvas)
await step('coloring', async () => {
  await press('Star kid', false);
  await until('home or coloring', `return !!document.querySelector('[data-screen="home"],[data-screen="game-coloring"]')`);
  await sleep(800);
  await shot('home');
  if (await js(`return !!document.querySelector('[data-screen="home"]')`)) await press('Coloring');
  await press('Shapes');
  await press('Circle, square and triangle page');
  note('coloring page ready after ms', await until('coloring page', `const p = document.querySelector('.coloring-page'); return !!p && p.dataset.ready === 'true'`));
  const box = await js(`const r = document.querySelector('.coloring-page').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]`);
  // In the circle on the shapes page (page pixels 560, 800 of 2048 x 1536).
  await clickAt(box[0] + (560 / 2048) * box[2], box[1] + (800 / 1536) * box[3]);
  const filled = `const c = document.querySelector('.layer-paint'); return !!c && c.getContext('2d').getImageData(560, 800, 1, 1).data[3] > 0`;
  note('fill landed after ms', await until('the fill', filled, 20_000));
  note('fill pixel', await js(`return Array.from(document.querySelector('.layer-paint').getContext('2d').getImageData(560, 800, 1, 1).data)`));
  await sleep(500);
  await shot('coloring-filled');
  // Leaving the page writes the finished picture to the Pictures folder.
  await press('Back');
  await sleep(3000);
  await shot('after-back');
  note('errors after leaving the page', await js(`return window.__errs || []`));
});

// ---- 5. Driving: WebGL and frame times (software drawing here, so no guide to a real laptop)
await step('driving', async () => {
  await js(`location.reload()`);
  await sleep(1000);
  await until('first screen', `return !!document.querySelector('[data-screen="kid-picker"], [data-screen]')`);
  await sleep(1000);
  await press('Star kid', false);
  await until('home', `return !!document.querySelector('[data-screen="home"]')`);
  await press('Driving');
  note('vehicle picker ready after ms', await until('vehicle picker', `const p = document.querySelector('.driving-picker'); return !!p && p.dataset.ready === 'true'`, 90_000));
  await sleep(1500);
  await shot('driving-picker');
  await press('Car');
  note('driving ready after ms', await until('the island', `const d = document.querySelector('.driving'); return !!d && d.dataset.ready === 'true'`, 120_000));
  await sleep(3000);
  await shot('driving');
  note('driving frames', await jsAsync(`
    const done = arguments[arguments.length - 1];
    const times = []; let last = performance.now(); const start = last;
    const tick = (t) => { times.push(t - last); last = t; if (t - start < 6000) requestAnimationFrame(tick); else {
      times.shift(); times.sort((a, b) => a - b);
      const canvas = document.querySelector('.driving-canvas');
      done({ frames: times.length, fps: +(times.length / 6).toFixed(1), medianMs: +times[times.length >> 1].toFixed(1),
        p95Ms: +times[Math.floor(times.length * 0.95)].toFixed(1), canvas: [canvas.width, canvas.height], detail: canvas.dataset.detail,
        cars: canvas.drivingWorld ? canvas.drivingWorld.cars.length : null });
    } };
    requestAnimationFrame(tick);`));
});

await step('errors', async () => note('page errors', await js(`return window.__errs || []`)));

await wd('DELETE', S).catch(() => {});
driver.kill();
writeFileSync(`${SHOTS}/report.json`, JSON.stringify(report, null, 2));
process.exit(0);
