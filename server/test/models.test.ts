// Picking the AI model (ADR 0032): OpenRouter's model list, the family's favorites, and a model per page.
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import type { AiConfig } from '../src/ai.ts';
import type { AiModelsResponse } from '../src/api.ts';
import { handler } from '../src/http.ts';
import { MODELS_URL, ModelCatalog, priceLabel, toAiModel, waysOf, type OpenRouterModel } from '../src/models.ts';
import { Store } from '../src/store.ts';

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

const LIST: OpenRouterModel[] = [
  {
    id: 'img/both',
    name: 'Both Image',
    architecture: { input_modalities: ['text', 'image'], output_modalities: ['image', 'text'] },
    pricing: { prompt: '0.0000003', completion: '0.0000025', image_output: '0.00003' },
  },
  {
    id: 'img/only',
    name: 'Only Image',
    architecture: { input_modalities: ['text'], output_modalities: ['image'] },
    pricing: { prompt: '0', completion: '0', image_output: '0.0000019' },
  },
  { id: 'txt/draw', name: 'A Drawer', architecture: { input_modalities: ['text'], output_modalities: ['text'] }, pricing: { prompt: '0.0000003', completion: '0.0000025' } },
  { id: 'txt/free:free', name: 'Free Drawer', architecture: { input_modalities: ['text'], output_modalities: ['text'] }, pricing: { prompt: '0', completion: '0' } },
  { id: 'audio/only', name: 'Speaker', architecture: { input_modalities: ['text'], output_modalities: ['audio'] } },
];

let dir = '';
let store: Store;
let server: Server;
let base = '';
let token = '';
let listCalls = 0;
let listFails = false;
const sent: { model: string; modalities?: string[] }[] = [];

const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
  if (String(url) === MODELS_URL) {
    listCalls++;
    if (listFails) throw new TypeError('fetch failed');
    return new Response(JSON.stringify({ data: LIST }), { headers: { 'content-type': 'application/json' } });
  }
  const body = JSON.parse(String(init?.body)) as { model: string; modalities?: string[] };
  sent.push({ model: body.model, modalities: body.modalities });
  const message = body.modalities
    ? { content: '', images: [{ image_url: { url: `data:image/png;base64,${PNG.toString('base64')}` } }] }
    : { content: '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>' };
  return new Response(JSON.stringify({ choices: [{ message }] }), { headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

let clock = Date.parse('2026-11-15T12:00:00Z');

async function start(ai: Partial<AiConfig> | null = {}): Promise<void> {
  dir = mkdtempSync(join(tmpdir(), 'cb-models-'));
  store = Store.open(dir);
  const config: AiConfig | undefined =
    ai === null ? undefined : { key: 'sk-test', imageModel: 'img/both', drawModel: 'txt/draw', dailyLimit: 10, fetchFn: fakeFetch, ...ai };
  server = createServer(handler({ store, version: 't', pairingCode: 'ABCD-EFGH', ai: config, now: () => clock }));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const res = await fetch(`${base}/api/v1/pair`, { method: 'POST', body: JSON.stringify({ code: 'ABCD-EFGH', device: 'd' }) });
  token = ((await res.json()) as { token: string }).token;
  sent.length = 0;
  listCalls = 0;
  listFails = false;
}

afterEach(async () => {
  if (!dir) return;
  await new Promise<void>((r) => server.close(() => r()));
  store.close();
  rmSync(dir, { recursive: true, force: true });
  dir = '';
});

const auth = () => ({ authorization: `Bearer ${token}` });
const models = async () => {
  const res = await fetch(`${base}/api/v1/ai/models`, { headers: auth() });
  assert.equal(res.status, 200);
  return (await res.json()) as AiModelsResponse;
};
const setFavorites = (favorites: unknown) =>
  fetch(`${base}/api/v1/ai/favorites`, { method: 'PUT', headers: { ...auth(), 'content-type': 'application/json' }, body: JSON.stringify({ favorites }) });
const ask = (body: unknown) =>
  fetch(`${base}/api/v1/ai/page`, { method: 'POST', headers: { ...auth(), 'content-type': 'application/json' }, body: JSON.stringify(body) });
const errorOf = async (res: Response) => ((await res.json()) as { error: string }).error;

describe('The model list (ADR 0032)', () => {
  it('lists the models that can make a page, sorted by name, with the defaults', async () => {
    await start();
    const list = await models();
    assert.deepEqual(
      list.models.map((m) => [m.id, m.ways]),
      [
        ['txt/draw', ['draw']],
        ['img/both', ['idea', 'photo']],
        ['txt/free:free', ['draw']],
        ['img/only', ['idea']],
      ],
    );
    assert.deepEqual(list.defaults, { image: 'img/both', draw: 'txt/draw' });
    assert.deepEqual(list.favorites, []);
    assert.ok(list.fetched > 0);
    assert.equal(list.problem, undefined);
  });

  it('fetches the list once and keeps it for hours', async () => {
    await start();
    await models();
    await models();
    assert.equal(listCalls, 1);
    clock += 7 * 3600_000;
    await models();
    assert.equal(listCalls, 2);
  });

  it('when OpenRouter can’t be reached, still answers with the favorites, the defaults and the problem', async () => {
    await start();
    listFails = true;
    assert.equal((await setFavorites(['img/only'])).status, 200);
    const list = await models();
    assert.deepEqual(list.models, []);
    assert.deepEqual(list.favorites, ['img/only']);
    assert.match(list.problem!, /couldn’t reach OpenRouter/);
  });

  it('needs a key and a paired device', async () => {
    await start(null);
    assert.equal((await fetch(`${base}/api/v1/ai/models`, { headers: auth() })).status, 503);
    await new Promise<void>((r) => server.close(() => r()));
    store.close();
    rmSync(dir, { recursive: true, force: true });
    await start();
    assert.equal((await fetch(`${base}/api/v1/ai/models`)).status, 401);
  });
});

describe('Favorites (ADR 0032)', () => {
  it('are kept on the server, without repeats', async () => {
    await start();
    const res = await setFavorites(['img/only', 'txt/draw', 'img/only']);
    assert.equal(res.status, 200);
    assert.deepEqual((await models()).favorites, ['img/only', 'txt/draw']);
    assert.deepEqual(store.aiFavorites(), ['img/only', 'txt/draw']);
  });

  it('refuses anything that isn’t a list of model ids', async () => {
    await start();
    assert.equal((await setFavorites('img/only')).status, 400);
    assert.equal((await setFavorites(['not a model'])).status, 400);
    assert.equal((await setFavorites(Array.from({ length: 31 }, (_, i) => `a/m${i}`))).status, 400);
  });
});

describe('A model per page (ADR 0032)', () => {
  it('uses the picked model, and asks an image-only model for an image only', async () => {
    await start();
    await models();
    const res = await ask({ kind: 'idea', idea: 'a cat', detail: 'simple', model: 'img/only' });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-ai-model'), 'img/only');
    assert.deepEqual(sent[0], { model: 'img/only', modalities: ['image'] });
  });

  it('asks a model that gives both for image and text, and uses the setting without a pick', async () => {
    await start();
    await models();
    assert.equal((await ask({ kind: 'idea', idea: 'a cat', detail: 'simple' })).status, 200);
    assert.deepEqual(sent[0], { model: 'img/both', modalities: ['image', 'text'] });
  });

  it('refuses a model that can’t do that way, or isn’t listed', async () => {
    await start();
    const photo = await ask({ kind: 'photo', image: 'data:image/png;base64,AA==', detail: 'simple', model: 'img/only' });
    assert.equal(photo.status, 400);
    assert.match(await errorOf(photo), /Only Image can’t make a page that way/);
    const unknown = await ask({ kind: 'idea', idea: 'a cat', detail: 'simple', model: 'no/such' });
    assert.equal(unknown.status, 400);
    assert.match(await errorOf(unknown), /isn’t on OpenRouter’s list/);
    assert.equal((await ask({ kind: 'idea', idea: 'a cat', detail: 'simple', model: 'bad id' })).status, 400);
    assert.equal(sent.length, 0);
    assert.equal(store.aiUsed('2026-11-15'), 0);
  });

  it('draws with a picked text model', async () => {
    await start();
    const res = await ask({ kind: 'draw', idea: 'a boat', detail: 'simple', model: 'txt/free:free' });
    assert.equal(res.status, 200);
    assert.deepEqual(sent[0], { model: 'txt/free:free', modalities: undefined });
  });

  it('when the list can’t be fetched, passes a well-formed pick on to OpenRouter', async () => {
    await start();
    listFails = true;
    assert.equal((await ask({ kind: 'idea', idea: 'a cat', detail: 'simple', model: 'new/model' })).status, 200);
    assert.deepEqual(sent[0], { model: 'new/model', modalities: ['image', 'text'] });
  });
});

describe('Model list pieces', () => {
  it('sorts models into ways', () => {
    assert.deepEqual(waysOf(LIST[0]), ['idea', 'photo']);
    assert.deepEqual(waysOf(LIST[1]), ['idea']);
    assert.deepEqual(waysOf(LIST[2]), ['draw']);
    assert.deepEqual(waysOf(LIST[4]), []);
    assert.equal(toAiModel(LIST[4]), null);
  });

  it('labels prices in plain words', () => {
    assert.equal(priceLabel(LIST[0]), '$30 per million image tokens');
    assert.equal(priceLabel(LIST[1]), '$1.9 per million image tokens');
    assert.equal(priceLabel(LIST[2]), '$2.5 per million tokens out');
    assert.equal(priceLabel(LIST[3]), 'free');
    assert.equal(priceLabel({ id: 'x/y' }), undefined);
  });

  it('a failed refresh keeps the list from earlier', async () => {
    let fail = false;
    let t = 1_000;
    const catalog = new ModelCatalog(
      (async () => {
        if (fail) throw new TypeError('fetch failed');
        return new Response(JSON.stringify({ data: LIST }));
      }) as unknown as typeof fetch,
      () => t,
    );
    assert.equal((await catalog.list()).models.length, 4);
    fail = true;
    t += 7 * 3600_000;
    const after = await catalog.list();
    assert.equal(after.models.length, 4);
    assert.match(after.problem!, /from earlier/);
    assert.ok(catalog.find('img/only'));
  });
});
