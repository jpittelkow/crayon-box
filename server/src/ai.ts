// AI pages through the family server (ADR 0029): the server holds the OpenRouter key and calls it for a paired
// device. The app turns what comes back into a page (clean-up, page check, preview), like any other file.
import type { AiPageRequest, Detail } from './api.ts';

export interface AiConfig {
  /** OPENROUTER_API_KEY. Without it the server has no AI pages. */
  key?: string;
  /** An image-output model, for photos and ideas (ADR 0006, 0023 Generate). */
  imageModel: string;
  /** A text model that writes SVG line art (ADR 0023 Draw). */
  drawModel: string;
  /** Pages a day for the whole family. */
  dailyLimit: number;
  fetchFn?: typeof fetch;
  /** How long one call may take. */
  timeoutMs?: number;
}

export const DEFAULT_IMAGE_MODEL = 'google/gemini-2.5-flash-image';
export const DEFAULT_DRAW_MODEL = 'google/gemini-2.5-flash';
export const DEFAULT_DAILY_LIMIT = 20;

export class AiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function aiConfigFromEnv(env: NodeJS.ProcessEnv): AiConfig {
  const limit = Number(env.AI_DAILY_LIMIT);
  return {
    key: env.OPENROUTER_API_KEY?.trim() || undefined,
    imageModel: env.AI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL,
    drawModel: env.AI_DRAW_MODEL?.trim() || DEFAULT_DRAW_MODEL,
    dailyLimit: Number.isFinite(limit) && limit >= 0 ? Math.floor(limit) : DEFAULT_DAILY_LIMIT,
  };
}

/** ADR 0006's coloring-page instructions. */
const STYLE = [
  'A coloring page for a young child (ages 2 to 4).',
  'Thick, uniform black outlines on a pure white background.',
  'No shading, no gray, no color, no fill, no texture, no text, no letters, no border or frame.',
  'Large, closed shapes that are easy to fill with a crayon; one subject, centered, filling most of the page.',
  'Landscape, 4:3. Friendly and suitable for young children.',
].join(' ');

function detailLine(detail: Detail): string {
  return detail === 'simple'
    ? 'Keep it very simple: fewer than 15 shapes, no small details.'
    : 'A little more detail is fine, but every shape must stay big enough for a small child to color.';
}

export function promptFor(req: AiPageRequest): string {
  if (req.kind === 'photo') {
    return `${STYLE} ${detailLine(req.detail)} Turn the main subject of this photo into such a coloring page. Keep its pose and what makes it recognizable; leave out the background.`;
  }
  if (req.kind === 'idea') return `${STYLE} ${detailLine(req.detail)} The picture: ${req.idea}`;
  return [
    `Write an SVG coloring page of: ${req.idea}.`,
    'Rules: a single <svg> element with xmlns, width="2048" height="1536" viewBox="0 0 2048 1536".',
    'Only black strokes (stroke="#000", stroke-width between 12 and 20, stroke-linecap="round", stroke-linejoin="round") with fill="none", on a white page (one white rect as the first element).',
    'Every shape closed. No text, no gradients, no filters, no images, no scripts.',
    detailLine(req.detail),
    'Answer with the SVG only, no explanation and no code fence.',
  ].join(' ');
}

interface ChatMessage {
  content?: string | { type: string; text?: string; image_url?: { url: string } }[] | null;
  images?: { type?: string; image_url?: { url: string } }[];
}

interface ChatResponse {
  choices?: { message?: ChatMessage }[];
  error?: { message?: string };
}

function parseDataUrl(url: string): { bytes: Buffer; type: string } | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url);
  if (!m) return null;
  return { type: m[1], bytes: m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3])) };
}

/** Takes out anything in an SVG that isn't line art: scripts, event handlers, outside links. */
export function cleanSvg(text: string): string | null {
  const m = /<svg[\s\S]*<\/svg>/i.exec(text);
  if (!m) return null;
  return m[0]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\s(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '');
}

export interface AiResult {
  bytes: Buffer;
  type: string;
  model: string;
}

export async function makePage(cfg: AiConfig, req: AiPageRequest): Promise<AiResult> {
  if (!cfg.key) throw new AiError(503, 'AI pages aren’t set up on the family server (no OpenRouter key).');
  const fetchFn = cfg.fetchFn ?? fetch;
  const model = req.kind === 'draw' ? cfg.drawModel : cfg.imageModel;
  const prompt = promptFor(req);
  const content: { type: string; text?: string; image_url?: { url: string } }[] = [{ type: 'text', text: prompt }];
  if (req.kind === 'photo') content.push({ type: 'image_url', image_url: { url: req.image } });
  const body: Record<string, unknown> = { model, messages: [{ role: 'user', content }] };
  if (req.kind !== 'draw') body.modalities = ['image', 'text'];

  let res: Response;
  try {
    res = await fetchFn('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.key}`, 'content-type': 'application/json', 'x-title': 'Crayon Box' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(cfg.timeoutMs ?? 120_000),
    });
  } catch {
    throw new AiError(502, 'The family server couldn’t reach OpenRouter. Is it online?');
  }
  let data: ChatResponse;
  try {
    data = (await res.json()) as ChatResponse;
  } catch {
    throw new AiError(502, `OpenRouter answered ${res.status} without JSON.`);
  }
  if (!res.ok || data.error) {
    const why = data.error?.message ?? `status ${res.status}`;
    if (res.status === 401) throw new AiError(502, 'OpenRouter didn’t accept the key. Check OPENROUTER_API_KEY on the server.');
    if (res.status === 402) throw new AiError(502, 'The OpenRouter account is out of credits.');
    throw new AiError(502, `OpenRouter said: ${why}`);
  }
  const message = data.choices?.[0]?.message;
  if (!message) throw new AiError(502, 'OpenRouter sent back nothing.');

  if (req.kind === 'draw') {
    const text = typeof message.content === 'string' ? message.content : (message.content ?? []).map((p) => p.text ?? '').join('');
    const svg = cleanSvg(text);
    if (!svg) throw new AiError(502, 'The model didn’t draw an SVG. Try again, or try a different idea.');
    return { bytes: Buffer.from(svg, 'utf8'), type: 'image/svg+xml', model };
  }

  const urls = [
    ...(message.images ?? []).map((i) => i.image_url?.url),
    ...(Array.isArray(message.content) ? message.content.filter((p) => p.type === 'image_url').map((p) => p.image_url?.url) : []),
  ].filter((u): u is string => !!u);
  for (const url of urls) {
    const inline = parseDataUrl(url);
    if (inline) return { ...inline, model };
    if (/^https:\/\//.test(url)) {
      const img = await fetchFn(url, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
      if (img?.ok) return { bytes: Buffer.from(await img.arrayBuffer()), type: img.headers.get('content-type') ?? 'image/png', model };
    }
  }
  const said = typeof message.content === 'string' && message.content.trim() ? ` It said: “${message.content.trim().slice(0, 200)}”` : '';
  throw new AiError(502, `The model didn’t send a picture back (some decline photos of people).${said}`);
}
