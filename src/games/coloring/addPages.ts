// The parent area's "Add pages" screen (ADR 0005, milestone 2 phase F): a file becomes a page. It is cleaned up
// and checked, previewed, named and given a theme, then added to the library on every device (it syncs). With a
// family server that has AI set up (ADR 0029), a page can also be made from a photo or a typed idea.
import type { ParentSectionContext } from '../../shell/types';
import type { AiPageMaker } from '../../sync/service';
import { modelPicker } from './aiModelPicker';
import { button, card, h, segmented, working } from '../../ui/parent';
import { OUR_THEME_META } from './catalog';
import { addFamilyPage, OUR_THEME, type FamilyPageMeta } from './family';
import { IMPORT_ACCEPT, ImportProblem, importFile, titleFromName, type CleanedPage } from './importPage';
import { builtinThemes } from './pages';

export async function renderAddPages(el: HTMLElement, ctx: ParentSectionContext): Promise<void> {
  const themes = builtinThemes();
  const themeOptions: [string, string][] = [
    [OUR_THEME, OUR_THEME_META.name],
    ...[...themes.entries()].sort((a, b) => a[1].order - b[1].order).map(([id, meta]): [string, string] => [id, meta.name]),
  ];

  /**
   * The preview, what the page check found, a name and a theme, and *Add to the library*. `prefix` keeps the
   * field ids apart when the AI and file results are both on screen.
   */
  const showResult = (
    into: HTMLElement,
    prefix: string,
    name: string,
    page: CleanedPage,
    source: FamilyPageMeta['source'],
    done: (message: string) => void,
    extra: HTMLElement | null = null,
  ) => {
    const preview = h('canvas', { width: '2048', height: '1536', class: 'pw-page-preview', 'aria-label': 'The page as the kids will see it' });
    preview.getContext('2d')!.putImageData(new ImageData(page.rgba, 2048, 1536), 0, 0);
    const title = h('input', { class: 'pw-input', id: `${prefix}-title`, type: 'text', maxlength: '40', value: titleFromName(name) });
    const theme = h('select', { class: 'pw-input', id: `${prefix}-theme` });
    for (const [id, label] of themeOptions) theme.append(h('option', { value: id }, label));
    const open = page.check.openShapes.length;
    into.replaceChildren(
      preview,
      h('p', {}, `${page.check.regions} areas to color.`),
      open
        ? h(
            'p',
            { class: 'pw-problem', role: 'alert' },
            `${open === 1 ? 'One shape has' : `${open} shapes have`} a gap, so color can spill out of it. A darker or cleaner picture usually fixes that; the page still works.`,
          )
        : h('p', { class: 'pw-ok' }, 'Every shape is closed: color stays inside the lines.'),
      h('div', { class: 'pw-field' }, h('label', { for: `${prefix}-title` }, 'Name'), title),
      h('div', { class: 'pw-field' }, h('label', { for: `${prefix}-theme` }, 'Theme'), theme),
      h(
        'div',
        { class: 'pw-row' },
        button(
          'Add to the library',
          async () => {
            const pageName = title.value.trim() || titleFromName(name);
            await addFamilyPage(ctx.storage, page.png, { title: pageName, theme: theme.value, added: Date.now(), source });
            const where = themeOptions.find(([id]) => id === theme.value)?.[1] ?? OUR_THEME_META.name;
            into.replaceChildren();
            done(`Added “${pageName}” to ${where}.`);
          },
          'primary',
        ),
        extra,
      ),
    );
  };

  // ---- Make a page with AI (ADR 0029) ----
  if (ctx.ai) {
    const maker = await ctx.ai();
    el.append(maker ? await aiCard(maker) : aiOffCard());
  }

  function aiOffCard(): HTMLElement {
    return card(
      h('h2', {}, 'Make a page with AI'),
      h(
        'p',
        { class: 'pw-muted', 'data-ai-off': '' },
        'Pages from a photo or a typed idea, made through the family server. It needs this device connected (Family sync) and an OpenRouter key set on the server (see server/README.md).',
      ),
    );
  }

  async function aiCard(ai: AiPageMaker): Promise<HTMLElement> {
    type Way = 'idea' | 'draw' | 'photo';
    let way: Way = 'idea';
    let detail: 'simple' | 'more' = 'simple';
    const status = h('p', { class: 'pw-muted', role: 'status', 'data-ai-status': '' });
    // While a page is being made: a spinner, the seconds so far and a moving bar (playtest, 2026-11-15: a line of
    // grey text alone looked like a frozen screen).
    const busy = working();
    const result = h('div', { style: 'display: flex; flex-direction: column; gap: 14px' });
    const idea = h('input', { class: 'pw-input', id: 'ai-idea', type: 'text', maxlength: '300', placeholder: 'a fire truck with a ladder' });
    const photo = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', id: 'ai-photo', class: 'pw-file' });
    const ideaField = h('div', { class: 'pw-field' }, h('label', { for: 'ai-idea' }, 'What should it be?'), idea);
    const photoField = h('div', { class: 'pw-field', hidden: true }, h('label', { for: 'ai-photo' }, 'Photo'), photo);
    const usage = () => `Today: ${ai.info.usedToday} of ${ai.info.dailyLimit} AI pages used.`;
    const used = h('p', { class: 'pw-muted' }, usage());
    // The model to use (ADR 0033); absent with an older server, which uses its own setting.
    const picker = await modelPicker(ai, ctx.storage, way);
    // One page, or two from different models to choose from (ADR 0034). Remembered on this device.
    let count: Count = (await ctx.storage.getJson<{ count?: Count }>(MAKE_PATH))?.count === 'two' ? 'two' : 'one';
    const howMany = h(
      'div',
      { 'data-ai-count': '' },
      segmented<Count>(
        'How many',
        [
          ['one', 'One page'],
          ['two', 'Two to choose from'],
        ],
        count,
        (c) => {
          count = c;
          void ctx.storage.putJson(MAKE_PATH, { count: c });
        },
      ),
      h('p', { class: 'pw-muted' }, 'Two asks a second model too, so it counts as two of today’s pages.'),
    );
    howMany.hidden = !picker?.second();

    const make = button(
      'Make it',
      async () => {
        let name: string;
        let request: Parameters<AiPageMaker['make']>[0];
        if (way === 'photo') {
          const chosen = photo.files?.[0];
          if (!chosen) {
            status.textContent = 'Choose a photo first.';
            return;
          }
          name = chosen.name;
          make.disabled = true;
          make.textContent = 'Making…';
          busy.start('Getting the photo ready…');
          try {
            request = { kind: 'photo', image: await photoDataUrl(chosen), detail };
          } catch (err) {
            busy.stop();
            make.disabled = false;
            make.textContent = 'Make it';
            status.textContent = err instanceof Error ? err.message : String(err);
            return;
          }
        } else {
          const text = idea.value.trim();
          if (!text) {
            status.textContent = 'Type what the page should show.';
            return;
          }
          name = text.slice(0, 40);
          request = { kind: way, idea: text, detail };
        }
        const model = picker?.chosen();
        if (model) request.model = model;
        // Two to choose from (ADR 0034): the same request to a second model, at the same time.
        const second = count === 'two' ? picker?.second() : undefined;
        const requests = second ? [request, { ...request, model: second }] : [request];
        make.disabled = true;
        make.textContent = 'Making…';
        result.replaceChildren();
        status.textContent = '';
        busy.start(requests.length > 1 ? 'Making two pages to choose from. This can take up to a minute.' : 'Making a page. This can take up to a minute.');
        status.dataset.aiStatus = 'working';
        const added = (message: string) => {
          status.textContent = message;
          status.dataset.aiStatus = 'added';
        };
        try {
          const made = await Promise.allSettled(
            requests.map(async (req) => {
              const { image, model: madeBy } = await ai.make(req);
              ai.info.usedToday++;
              const ext = image.type === 'image/svg+xml' ? 'svg' : image.type === 'image/jpeg' ? 'jpg' : 'png';
              const page = await importFile(`${name.replace(/\.[^.]+$/, '')}.${ext}`, image);
              return { page, by: picker?.nameOf(madeBy ?? req.model ?? '') ?? madeBy ?? '' };
            }),
          );
          used.textContent = usage();
          const pages = made.flatMap((m) => (m.status === 'fulfilled' ? [m.value] : []));
          const failed = made.flatMap((m) => (m.status === 'rejected' ? [m.reason instanceof Error ? m.reason.message : String(m.reason)] : []));
          // Which model each failure came from, by name, for the notice below.
          const failedBy = made.flatMap((m, i) => (m.status === 'rejected' ? [picker?.nameOf(requests[i]!.model ?? '') || requests[i]!.model || 'The other model'] : []));
          if (!pages.length) throw new Error(failed[0] ?? 'No page came back.');
          if (pages.length === 1) {
            const by = pages[0]!.by ? ` Made by ${pages[0]!.by}.` : '';
            status.textContent = `Here it is.${by} Not quite right? Make it again, or try another model.`;
            status.dataset.aiStatus = 'ready';
            showResult(result, 'ai', name, pages[0]!.page, 'ai', added);
            // Two were asked for and one failed: say so plainly, above the page, with why (playtest, 2026-11-15:
            // tucked into the status line in brackets, it read as "two to choose from shows one").
            if (failed.length) {
              result.prepend(h('p', { class: 'pw-problem', role: 'alert', 'data-ai-other': '' }, `Only one page came back. ${failedBy[0]} had a problem: ${failed[0]}`));
            }
          } else {
            status.textContent = 'Here are two. Pick the one to keep, or make them again.';
            status.dataset.aiStatus = 'choose';
            showChoices(result, pages, (page) => showResult(result, 'ai', name, page, 'ai', added));
          }
        } catch (err) {
          status.textContent = err instanceof Error ? err.message : String(err);
          status.dataset.aiStatus = 'problem';
        } finally {
          busy.stop();
          make.disabled = false;
          make.textContent = 'Make it';
          // Show what came back (or the problem), not the form above it.
          (result.firstElementChild ?? status).scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        }
      },
      'primary',
    );

    return card(
      h('h2', {}, 'Make a page with AI'),
      h(
        'p',
        { class: 'pw-muted' },
        'The family server asks an AI model through OpenRouter. What you type, or the photo, goes to OpenRouter and the model’s provider; nothing is kept on the server.',
      ),
      segmented<Way>(
        'How to make it',
        [
          ['idea', 'From an idea'],
          ['draw', 'Drawn simply'],
          ['photo', 'From a photo'],
        ],
        way,
        (w) => {
          way = w;
          ideaField.hidden = w === 'photo';
          photoField.hidden = w !== 'photo';
          picker?.setWay(w);
          howMany.hidden = !picker?.second();
        },
      ),
      ideaField,
      photoField,
      picker?.el ?? null,
      howMany,
      segmented<'simple' | 'more'>(
        'Detail',
        [
          ['simple', 'Very simple'],
          ['more', 'More detail'],
        ],
        detail,
        (d) => (detail = d),
      ),
      h('div', { class: 'pw-row' }, make),
      busy.el,
      used,
      status,
      result,
    );
  }

  // ---- Add a page from a file ----
  const file = h('input', { type: 'file', accept: IMPORT_ACCEPT, id: 'add-page-file', class: 'pw-file' });
  const status = h('p', { class: 'pw-muted', role: 'status', 'data-add-status': '' });
  const result = h('div', { style: 'display: flex; flex-direction: column; gap: 14px' });

  file.addEventListener('change', async () => {
    const chosen = file.files?.[0];
    if (!chosen) return;
    result.replaceChildren();
    status.textContent = 'Making a page…';
    status.dataset.addStatus = 'working';
    // Let the status paint before the heavy work.
    await new Promise((r) => setTimeout(r, 30));
    try {
      const page = await importFile(chosen.name, chosen);
      status.textContent = 'Here it is, cleaned up into a page.';
      status.dataset.addStatus = 'ready';
      showResult(
        result,
        'add-page',
        chosen.name,
        page,
        'import',
        (message) => {
          file.value = '';
          status.textContent = message;
          status.dataset.addStatus = 'added';
        },
        button('Choose another file', () => file.click()),
      );
    } catch (err) {
      status.textContent = err instanceof ImportProblem ? err.message : 'That file couldn’t be made into a page.';
      status.dataset.addStatus = 'problem';
      if (!(err instanceof ImportProblem)) console.error(err);
    }
  });

  el.append(
    card(
      h('h2', {}, 'Add a page from a file'),
      h(
        'p',
        { class: 'pw-muted' },
        'A scan or photo of a drawing, a coloring sheet, or line art: PNG, JPG, SVG, or the first page of a PDF. It is cleaned up into black lines on white, and goes to every device that syncs.',
      ),
      h('div', { class: 'pw-field' }, h('label', { for: 'add-page-file' }, 'Choose a file'), file),
      status,
      result,
    ),
  );

  if (ctx.pagesFolder) {
    const folder = ctx.pagesFolder;
    el.append(
      card(
        h('h2', {}, 'The Pages folder'),
        h(
          'p',
          { class: 'pw-muted' },
          'Files put in Pictures › Coloring Book › Pages become pages the next time the app starts. A folder in it named after a theme (like “Under the sea”) puts its pages in that theme; everything else goes to Our pages. Done files move to the Added folder.',
        ),
        h('div', { class: 'pw-row' }, button('Open the Pages folder', () => void folder.openFolder().catch((err) => console.error(err)))),
      ),
    );
  }
}

type Count = 'one' | 'two';
/** Device-only (ADR 0024): whether this device makes one page or two to choose from. */
const MAKE_PATH = 'local/ai-make.json';

/** Two cleaned pages side by side, each with the model that made it; picking one moves on to name and theme. */
function showChoices(into: HTMLElement, pages: { page: CleanedPage; by: string }[], pick: (page: CleanedPage) => void): void {
  const tiles = pages.map(({ page, by }, i) => {
    const preview = h('canvas', { width: '2048', height: '1536', class: 'pw-page-preview', 'aria-label': `Choice ${i + 1}, made by ${by}` });
    preview.getContext('2d')!.putImageData(new ImageData(page.rgba, 2048, 1536), 0, 0);
    return h(
      'div',
      { class: 'pw-ai-choice', 'data-ai-choice': String(i + 1) },
      preview,
      h('p', { class: 'pw-muted' }, `${by}. ${page.check.regions} areas to color.`),
      button(`Use this one`, () => pick(page), i === 0 ? 'primary' : 'default'),
    );
  });
  into.replaceChildren(h('div', { class: 'pw-ai-choices' }, ...tiles));
}

/** A photo as a JPEG data URL, at most 1600 px on its longest side: enough for the model, small to send. */
async function photoDataUrl(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.88);
}
