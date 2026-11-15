// AI pages through the family server (ADR 0029), against a fake OpenRouter.
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { cleanSvg, promptFor, type AiConfig } from '../src/ai.ts';
import type { ServerInfo } from '../src/api.ts';
import { handler } from '../src/http.ts';
import { Store } from '../src/store.ts';

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

interface Sent {
  url: string;
  auth: string;
  body: { model: string; modalities?: string[]; messages: { content: { type: string; text?: string; image_url?: { url: string } }[] }[] };
}

let dir = '';
let store: Store;
let server: Server;
let base = '';
let token = '';
const sent: Sent[] = [];

/** A fake OpenRouter: answers each call with `reply(body)`. */
function fakeOpenRouter(reply: (body: Sent['body']) => { status?: number; json: unknown }): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Sent['body'];
    sent.push({ url: String(url), auth: String((init?.headers as Record<string, string>).authorization), body });
    const r = reply(body);
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

const imageReply = () => ({
  json: { choices: [{ message: { content: '', images: [{ type: 'image_url', image_url: { url: `data:image/png;base64,${PNG.toString('base64')}` } }] } }] },
});

async function start(ai?: Partial<AiConfig>, now = () => Date.parse('2026-11-14T12:00:00Z')): Promise<void> {
  dir = mkdtempSync(join(tmpdir(), 'cb-ai-'));
  store = Store.open(dir);
  const config: AiConfig | undefined = ai ? { key: 'sk-test', imageModel: 'img/model', secondModel: 'img/second', drawModel: 'draw/model', dailyLimit: 3, ...ai } : undefined;
  server = createServer(handler({ store, version: 't', pairingCode: 'ABCD-EFGH', ai: config, now }));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const res = await fetch(`${base}/api/v1/pair`, { method: 'POST', body: JSON.stringify({ code: 'ABCD-EFGH', device: 'd' }) });
  token = ((await res.json()) as { token: string }).token;
  sent.length = 0;
}

afterEach(async () => {
  if (!dir) return;
  await new Promise<void>((r) => server.close(() => r()));
  store.close();
  rmSync(dir, { recursive: true, force: true });
  dir = '';
});

const ask = (body: unknown, auth = true) =>
  fetch(`${base}/api/v1/ai/page`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

const errorOf = async (res: Response) => ((await res.json()) as { error: string }).error;

describe('AI pages (ADR 0029)', () => {
  it('without a key: no AI in info, and the endpoint says so in words', async () => {
    await start();
    const info = (await (await fetch(`${base}/api/v1/info`)).json()) as ServerInfo;
    assert.equal(info.ai, undefined);
    const res = await ask({ kind: 'idea', idea: 'a cat', detail: 'simple' });
    assert.equal(res.status, 503);
    assert.match(await errorOf(res), /set up/);
  });

  it('makes a page from an idea with the image model, and counts it', async () => {
    await start({ fetchFn: fakeOpenRouter(imageReply) });
    const res = await ask({ kind: 'idea', idea: 'a fire truck', detail: 'simple' });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.equal(res.headers.get('x-ai-model'), 'img/model');
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), PNG);
    assert.equal(sent[0].url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(sent[0].auth, 'Bearer sk-test');
    assert.equal(sent[0].body.model, 'img/model');
    assert.deepEqual(sent[0].body.modalities, ['image', 'text']);
    assert.match(sent[0].body.messages[0].content[0].text!, /fire truck/);
    const info = (await (await fetch(`${base}/api/v1/info`)).json()) as ServerInfo;
    assert.deepEqual(info.ai, { imageModel: 'img/model', drawModel: 'draw/model', dailyLimit: 3, usedToday: 1 });
  });

  it('sends a photo along as an image', async () => {
    await start({ fetchFn: fakeOpenRouter(imageReply) });
    const photo = `data:image/jpeg;base64,${Buffer.from('jpeg').toString('base64')}`;
    const res = await ask({ kind: 'photo', image: photo, detail: 'more' });
    assert.equal(res.status, 200);
    const content = sent[0].body.messages[0].content;
    assert.equal(content[1].image_url?.url, photo);
    assert.match(content[0].text!, /photo/);
    assert.match(content[0].text!, /in focus/);
    assert.match(content[0].text!, /No letters, words or numbers/);
    assert.doesNotMatch(content[0].text!, /fewer than 15/);
  });

  it('draws SVG with the text model, and strips anything that is not line art', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="x()"><script>alert(1)</script><circle r="5" stroke="#000"/><image href="https://x/y.png"/></svg>';
    await start({ fetchFn: fakeOpenRouter(() => ({ json: { choices: [{ message: { content: `Here you go:\n${svg}` } }] } })) });
    const res = await ask({ kind: 'draw', idea: 'a boat', detail: 'simple' });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/svg+xml');
    const text = await res.text();
    assert.match(text, /^<svg/);
    assert.doesNotMatch(text, /script|onload|https:/);
    assert.equal(sent[0].body.model, 'draw/model');
    assert.equal(sent[0].body.modalities, undefined);
  });

  it('stops at the daily limit, and starts again the next day', async () => {
    let t = Date.parse('2026-11-14T08:00:00Z');
    await start({ fetchFn: fakeOpenRouter(imageReply), dailyLimit: 2 }, () => t);
    assert.equal((await ask({ kind: 'idea', idea: 'a', detail: 'simple' })).status, 200);
    assert.equal((await ask({ kind: 'idea', idea: 'b', detail: 'simple' })).status, 200);
    const third = await ask({ kind: 'idea', idea: 'c', detail: 'simple' });
    assert.equal(third.status, 429);
    assert.match(await errorOf(third), /used up/);
    t += 24 * 3600_000;
    assert.equal((await ask({ kind: 'idea', idea: 'd', detail: 'simple' })).status, 200);
  });

  it('a failed call is not counted, and OpenRouter problems come back in words', async () => {
    await start({ fetchFn: fakeOpenRouter(() => ({ status: 402, json: { error: { message: 'Insufficient credits' } } })) });
    const res = await ask({ kind: 'idea', idea: 'a cat', detail: 'simple' });
    assert.equal(res.status, 502);
    assert.match(await errorOf(res), /out of credits/);
    assert.equal(store.aiUsed('2026-11-14'), 0);
  });

  it('a model that sends no picture is said in words', async () => {
    await start({ fetchFn: fakeOpenRouter(() => ({ json: { choices: [{ message: { content: 'I cannot help with that.' } }] } })) });
    const res = await ask({ kind: 'photo', image: 'data:image/png;base64,AA==', detail: 'simple' });
    assert.equal(res.status, 502);
    assert.match(await errorOf(res), /send a picture back/);
  });

  it('needs a paired device and a sensible request', async () => {
    await start({ fetchFn: fakeOpenRouter(imageReply) });
    assert.equal((await ask({ kind: 'idea', idea: 'a', detail: 'simple' }, false)).status, 401);
    assert.equal((await ask({ kind: 'idea', idea: ' ', detail: 'simple' })).status, 400);
    assert.equal((await ask({ kind: 'idea', idea: 'x'.repeat(301), detail: 'simple' })).status, 400);
    assert.equal((await ask({ kind: 'photo', image: 'https://example.com/a.png', detail: 'simple' })).status, 400);
    assert.equal((await ask({ kind: 'nope' })).status, 400);
    assert.equal(sent.length, 0);
  });
});

describe('AI pieces', () => {
  it('asks for a very simple page in simple mode', () => {
    assert.match(promptFor({ kind: 'idea', idea: 'a cat', detail: 'simple' }), /fewer than 15 shapes/);
    assert.match(promptFor({ kind: 'draw', idea: 'a cat', detail: 'simple' }), /viewBox="0 0 2048 1536"/);
  });

  it('finds the SVG in an answer, or says there is none', () => {
    assert.equal(cleanSvg('no svg here'), null);
    assert.equal(cleanSvg('```svg\n<svg><path d="M0 0"/></svg>\n```'), '<svg><path d="M0 0"/></svg>');
  });
});
