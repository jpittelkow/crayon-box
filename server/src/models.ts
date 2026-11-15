// The models a parent can pick for AI pages (ADR 0032): OpenRouter's public model list, sorted into the ways of
// making a page each model can do. Fetched without the key, kept for a while, and kept when a refresh fails.
import type { AiModel, AiWay } from './api.ts';

export const MODELS_URL = 'https://openrouter.ai/api/v1/models';
/** How long a fetched list is used before asking again. */
export const MODELS_TTL_MS = 6 * 3600_000;
/** After a failed fetch, wait this long before trying again. */
const RETRY_MS = 5 * 60_000;

/** The part of an OpenRouter model entry this server reads. */
export interface OpenRouterModel {
  id: string;
  name?: string;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  pricing?: Record<string, string | unknown>;
}

/** The ways a model can make a page: idea needs image output, photo also image input, draw text-only output. */
export function waysOf(m: OpenRouterModel): AiWay[] {
  const input = m.architecture?.input_modalities ?? [];
  const output = m.architecture?.output_modalities ?? [];
  const ways: AiWay[] = [];
  if (output.includes('image')) {
    ways.push('idea');
    if (input.includes('image')) ways.push('photo');
  } else if (output.includes('text') && input.includes('text')) {
    ways.push('draw');
  }
  return ways;
}

const num = (v: unknown) => {
  const n = typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

function money(perToken: number): string {
  const perMillion = perToken * 1e6;
  const digits = perMillion >= 10 ? 0 : perMillion >= 1 ? 2 : 3;
  const text = perMillion.toFixed(digits);
  return `$${text.includes('.') ? text.replace(/\.?0+$/, '') : text}`;
}

/** A short price for the dropdown: what the model's output costs, or `free`. */
export function priceLabel(m: OpenRouterModel): string | undefined {
  const p = m.pricing ?? {};
  const prices = Object.values(p).map(num).filter((n): n is number => n !== undefined);
  if (m.id.endsWith(':free') || (prices.length > 0 && prices.every((n) => n === 0))) return 'free';
  const output = m.architecture?.output_modalities ?? [];
  if (output.includes('image')) {
    const perImage = num(p.image_output) || num(p.image_token) || num(p.completion);
    return perImage ? `${money(perImage)} per million image tokens` : undefined;
  }
  const out = num(p.completion);
  return out ? `${money(out)} per million tokens out` : undefined;
}

export function toAiModel(m: OpenRouterModel): AiModel | null {
  if (typeof m.id !== 'string' || !m.id) return null;
  const ways = waysOf(m);
  if (ways.length === 0) return null;
  const model: AiModel = { id: m.id, name: (typeof m.name === 'string' && m.name) || m.id, ways, output: m.architecture?.output_modalities ?? [] };
  const price = priceLabel(m);
  if (price) model.price = price;
  return model;
}

export interface CatalogState {
  models: AiModel[];
  fetched: number;
  problem?: string;
}

/** OpenRouter's model list, cached. */
export class ModelCatalog {
  private state: CatalogState = { models: [], fetched: 0 };
  private byId = new Map<string, AiModel>();
  private lastTry = 0;
  private pending: Promise<CatalogState> | null = null;

  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;

  constructor(fetchFn: typeof fetch = fetch, now: () => number = Date.now) {
    this.fetchFn = fetchFn;
    this.now = now;
  }

  /** The list, fetched again when it is old. Never throws: a failure is kept as `problem`. */
  list(): Promise<CatalogState> {
    const t = this.now();
    const fresh = this.state.fetched > 0 && !this.state.problem && t - this.state.fetched < MODELS_TTL_MS;
    const justFailed = !!this.state.problem && t - this.lastTry < RETRY_MS;
    if (fresh || justFailed) return Promise.resolve(this.state);
    this.pending ??= this.refresh().finally(() => (this.pending = null));
    return this.pending;
  }

  /** A model from the last fetched list, if there is one. */
  find(id: string): AiModel | undefined {
    return this.byId.get(id);
  }

  /** Whether a list has been fetched at all, so `find` can be trusted. */
  get known(): boolean {
    return this.state.fetched > 0;
  }

  private async refresh(): Promise<CatalogState> {
    this.lastTry = this.now();
    try {
      const res = await this.fetchFn(MODELS_URL, { headers: { 'x-title': 'Crayon Box' }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`OpenRouter's model list answered ${res.status}.`);
      const data = (await res.json()) as { data?: OpenRouterModel[] };
      if (!Array.isArray(data.data)) throw new Error('OpenRouter’s model list wasn’t in the expected shape.');
      const models = data.data
        .map(toAiModel)
        .filter((m): m is AiModel => m !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
      this.state = { models, fetched: this.now() };
      this.byId = new Map(models.map((m) => [m.id, m]));
    } catch (err) {
      const why = err instanceof Error && !/abort|fetch failed/i.test(err.message) ? err.message : 'The family server couldn’t reach OpenRouter.';
      this.state = { ...this.state, problem: this.state.fetched ? `${why} Showing the list from earlier.` : why };
    }
    return this.state;
  }
}
