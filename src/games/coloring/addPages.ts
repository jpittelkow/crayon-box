// The parent area's "Add pages" screen (ADR 0005, milestone 2 phase F): a file becomes a page. It is cleaned up
// and checked, previewed, named and given a theme, then added to the library on every device (it syncs).
import type { ParentSectionContext } from '../../shell/types';
import { button, card, h } from '../../ui/parent';
import { OUR_THEME_META } from './catalog';
import { addFamilyPage, OUR_THEME } from './family';
import { IMPORT_ACCEPT, ImportProblem, importFile, titleFromName, type CleanedPage } from './importPage';
import { builtinThemes } from './pages';

export async function renderAddPages(el: HTMLElement, ctx: ParentSectionContext): Promise<void> {
  const file = h('input', { type: 'file', accept: IMPORT_ACCEPT, id: 'add-page-file', class: 'pw-file' });
  const status = h('p', { class: 'pw-muted', role: 'status', 'data-add-status': '' });
  const result = h('div', { style: 'display: flex; flex-direction: column; gap: 14px' });

  const themes = builtinThemes();
  const themeOptions: [string, string][] = [
    [OUR_THEME, OUR_THEME_META.name],
    ...[...themes.entries()].sort((a, b) => a[1].order - b[1].order).map(([id, meta]): [string, string] => [id, meta.name]),
  ];

  const showResult = (name: string, page: CleanedPage) => {
    const preview = h('canvas', { width: '2048', height: '1536', class: 'pw-page-preview', 'aria-label': 'The page as the kids will see it' });
    preview.getContext('2d')!.putImageData(new ImageData(page.rgba, 2048, 1536), 0, 0);
    const title = h('input', { class: 'pw-input', id: 'add-page-title', type: 'text', maxlength: '40', value: titleFromName(name) });
    const theme = h('select', { class: 'pw-input', id: 'add-page-theme' });
    for (const [id, label] of themeOptions) theme.append(h('option', { value: id }, label));
    const open = page.check.openShapes.length;
    result.replaceChildren(
      preview,
      h('p', {}, `${page.check.regions} areas to color.`),
      open
        ? h(
            'p',
            { class: 'pw-problem', role: 'alert' },
            `${open === 1 ? 'One shape has' : `${open} shapes have`} a gap, so color can spill out of it. A darker or cleaner scan usually fixes that; the page still works.`,
          )
        : h('p', { class: 'pw-ok' }, 'Every shape is closed: color stays inside the lines.'),
      h('div', { class: 'pw-field' }, h('label', { for: 'add-page-title' }, 'Name'), title),
      h('div', { class: 'pw-field' }, h('label', { for: 'add-page-theme' }, 'Theme'), theme),
      h(
        'div',
        { class: 'pw-row' },
        button(
          'Add to the library',
          async () => {
            const name = title.value.trim() || titleFromName(file.files?.[0]?.name ?? '');
            await addFamilyPage(ctx.storage, page.png, { title: name, theme: theme.value, added: Date.now(), source: 'import' });
            const where = themeOptions.find(([id]) => id === theme.value)?.[1] ?? OUR_THEME_META.name;
            result.replaceChildren();
            file.value = '';
            status.textContent = `Added “${name}” to ${where}.`;
            status.dataset.addStatus = 'added';
          },
          'primary',
        ),
        button('Choose another file', () => file.click()),
      ),
    );
  };

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
      showResult(chosen.name, page);
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
