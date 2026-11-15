// The Model dropdown on "Make a page with AI" (ADR 0032): the server's default first, then the family's
// favorites, then every model OpenRouter lists for the chosen way, narrowed by a search box. A star adds the
// chosen model to the favorites, which live on the server. Each device remembers its last pick per way.
import type { AiModel, AiModelsResponse, AiWay } from '../../../server/src/api';
import type { GameStorage } from '../../storage/types';
import type { AiPageMaker } from '../../sync/service';
import { button, h } from '../../ui/parent';

/** Device-only (ADR 0024: `local/` never syncs). */
const PICKS_PATH = 'local/ai-models.json';

type Picks = Partial<Record<AiWay, string>>;

export interface ModelChoices {
  /** The server's setting for this way. */
  defaultId: string;
  favorites: AiModel[];
  /** Every other listed model for this way that matches the search. */
  others: AiModel[];
}

/** A model the list doesn't know (an older favorite, or the list couldn't be fetched): just its id. */
const bare = (id: string): AiModel => ({ id, name: id, ways: [], output: [] });

export function modelChoices(list: AiModelsResponse, way: AiWay, search = ''): ModelChoices {
  const defaultId = way === 'draw' ? list.defaults.draw : list.defaults.image;
  const byId = new Map(list.models.map((m) => [m.id, m]));
  const known = list.models.length > 0;
  const fits = (m: AiModel) => m.ways.includes(way);
  const favorites = list.favorites
    .map((id) => byId.get(id) ?? (known ? null : bare(id)))
    .filter((m): m is AiModel => m !== null && (!known || fits(m)));
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (m: AiModel) => words.every((w) => m.name.toLowerCase().includes(w) || m.id.toLowerCase().includes(w));
  const others = list.models.filter((m) => fits(m) && !list.favorites.includes(m.id) && matches(m));
  return { defaultId, favorites, others };
}

/** Whether a remembered pick can still be used for this way. */
export function pickStillFits(list: AiModelsResponse, way: AiWay, id: string | undefined): id is string {
  if (!id) return false;
  if (list.models.length === 0) return list.favorites.includes(id);
  return list.models.some((m) => m.id === id && m.ways.includes(way));
}

/**
 * The other model for "two to choose from" (ADR 0033): the server's second model, or its default when the parent
 * picked the second one. Undefined when there is no different model to ask (an older server, or both the same).
 */
export function secondModelFor(list: AiModelsResponse, chosenId: string): string | undefined {
  const { second, image } = list.defaults;
  if (second && second !== chosenId) return second;
  if (image !== chosenId) return image;
  return undefined;
}

export interface ModelPicker {
  /** The other model to ask for "two to choose from" (ADR 0033), for the image ways. */
  second(): string | undefined;
  el: HTMLElement;
  /** Shows the models for another way. */
  setWay(way: AiWay): void;
  /** The picked model, or undefined for the server's default. */
  chosen(): string | undefined;
  /** The name to show for a model id. */
  nameOf(id: string): string;
}

/** Builds the picker, or returns null when the server is too old to list models. */
export async function modelPicker(ai: AiPageMaker, storage: GameStorage, startWay: AiWay): Promise<ModelPicker | null> {
  let list: AiModelsResponse | null;
  try {
    list = await ai.models();
  } catch (err) {
    // The page maker still works with the server's default; say why there is no list.
    list = { models: [], favorites: [], defaults: { image: ai.info.imageModel, draw: ai.info.drawModel }, fetched: 0, problem: err instanceof Error ? err.message : String(err) };
  }
  if (!list) return null;
  const models = list;
  const picks: Picks = (await storage.getJson<Picks>(PICKS_PATH)) ?? {};
  let way = startWay;

  const search = h('input', { class: 'pw-input', id: 'ai-model-search', type: 'search', placeholder: 'Search models', 'aria-label': 'Search models' });
  const select = h('select', { class: 'pw-input', id: 'ai-model' });
  const star = button('', () => void toggleFavorite());
  star.dataset.aiStar = '';
  const price = h('p', { class: 'pw-muted', 'data-ai-price': '' });
  const problem = h('p', { class: 'pw-muted', 'data-ai-models-problem': '', hidden: !models.problem }, models.problem ? `${models.problem} Your favorites and the default still work.` : '');

  const byId = new Map(models.models.map((m) => [m.id, m]));
  const nameOf = (id: string) => byId.get(id)?.name ?? id;
  const current = () => select.value || modelChoices(models, way).defaultId;

  function option(m: AiModel, label = m.name): HTMLOptionElement {
    return h('option', { value: m.id }, m.price ? `${label} (${m.price})` : label);
  }

  function fill(): void {
    const keep = select.value;
    const { defaultId, favorites, others } = modelChoices(models, way, search.value);
    const options: (HTMLOptionElement | HTMLOptGroupElement)[] = [h('option', { value: '' }, `Server default: ${nameOf(defaultId)}`)];
    if (favorites.length) {
      const group = h('optgroup', { label: 'Favorites' });
      group.append(...favorites.map((m) => option(m, `★ ${m.name}`)));
      options.push(group);
    }
    if (others.length) {
      const group = h('optgroup', { label: search.value.trim() ? `Matching “${search.value.trim()}”` : 'All models' });
      group.append(...others.map((m) => option(m)));
      options.push(group);
    }
    select.replaceChildren(...options);
    const wanted = keep || picks[way];
    select.value = [...select.options].some((o) => o.value === wanted) ? (wanted ?? '') : '';
    describe();
  }

  function describe(): void {
    const id = current();
    const fav = models.favorites.includes(id);
    star.textContent = fav ? '★ Remove from favorites' : '☆ Add to favorites';
    star.setAttribute('aria-pressed', String(fav));
    price.textContent = byId.get(id)?.price ? `Price: ${byId.get(id)!.price}.` : '';
  }

  async function toggleFavorite(): Promise<void> {
    const id = current();
    const next = models.favorites.includes(id) ? models.favorites.filter((f) => f !== id) : [...models.favorites, id];
    star.disabled = true;
    try {
      models.favorites = await ai.setFavorites(next);
      problem.hidden = !models.problem;
    } catch (err) {
      problem.hidden = false;
      problem.textContent = err instanceof Error ? err.message : String(err);
    } finally {
      star.disabled = false;
    }
    fill();
  }

  select.addEventListener('change', () => {
    if (select.value) picks[way] = select.value;
    else delete picks[way];
    void storage.putJson(PICKS_PATH, picks);
    describe();
  });
  search.addEventListener('input', () => fill());

  // A remembered pick that no longer fits (the model left OpenRouter) falls back to the default.
  for (const w of Object.keys(picks) as AiWay[]) if (!pickStillFits(models, w, picks[w])) delete picks[w];
  fill();

  const el = h(
    'div',
    { class: 'pw-field', 'data-ai-models': '' },
    h('label', { for: 'ai-model' }, 'Model'),
    search,
    select,
    h('div', { class: 'pw-row' }, star),
    price,
    problem,
  );
  return {
    el,
    setWay(w) {
      way = w;
      select.value = '';
      fill();
    },
    chosen: () => select.value || undefined,
    second: () => (way === 'draw' ? undefined : secondModelFor(models, current())),
    nameOf,
  };
}
