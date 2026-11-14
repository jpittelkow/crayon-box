// The coloring game (ADR 0004, 0007, 0016). Loaded only when the game is opened (ADR 0012).
import type { ColoringMode, GameContext, GameModule } from '../../shell/types';
import { icons } from '../../ui/icons';
import { el, kidButton, setPicked } from '../../ui/kid';
import { PALETTE, RAINBOW } from '../../ui/palette';
import './coloring.css';
import { BRUSH_SIZES, ColoringEngine, type Tool } from './engine/engine';
import { builtinPages, type Page } from './pages';
import {
  findPicture,
  getPaint,
  keepPreviousVersion,
  listPictures,
  newPicture,
  savePicture,
  type Picture,
} from './pictures';

/** Autosave runs this long after the last action (ADR 0007). */
export const AUTOSAVE_MS = 1000;

/** Size dot diameters in the tray, small to big (ADR 0016). */
const DOT_PX = [16, 30, 46];

/** Color drawn on the tool icons while rainbow is picked; the dots show the full rainbow. */
const RAINBOW_ICON = '#9b5de5';

export const coloringGame: GameModule = {
  mount(root, ctx) {
    const game = new ColoringGame(root, ctx);
    void game.showPages();
    return () => game.unmount();
  },
};

class ColoringGame {
  private session: ColoringSession | null = null;
  private urls: string[] = [];
  private pageOffset = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly ctx: GameContext,
  ) {}

  private revokeUrls(): void {
    for (const u of this.urls) URL.revokeObjectURL(u);
    this.urls = [];
  }

  private async closeSession(): Promise<void> {
    const session = this.session;
    this.session = null;
    if (session) await session.close();
  }

  async showPages(): Promise<void> {
    await this.closeSession();
    const pages = builtinPages();
    const pictures = await listPictures(this.ctx.storage, this.ctx.kid.id);
    this.revokeUrls();

    const screen = el('div', 'page-picker', { 'data-screen': 'page-picker' });
    screen.append(
      kidButton({
        kind: 'action-lg',
        label: 'Back',
        html: icons.back(),
        className: 'corner',
        onTap: () => this.ctx.exitToHome(),
      }),
    );

    // Nothing scrolls (ADR 0016 rule 6): six tiles at most; with more pages, the sixth is a "more" arrow.
    const perScreen = pages.length > 6 ? 5 : 6;
    if (this.pageOffset >= pages.length) this.pageOffset = 0;
    const shown = pages.slice(this.pageOffset, this.pageOffset + perScreen);

    const grid = el('div', 'page-grid');
    for (const page of shown) {
      const tile = kidButton({
        kind: 'paper',
        label: `${page.meta.title} page`,
        onTap: () => void this.openPage(page),
      });
      tile.dataset.page = page.id;
      // A started page shows the kid's coloring on its tile (ADR 0016).
      const picture = pictures.find((p) => p.meta.pageId === page.id);
      if (picture) {
        const paint = await getPaint(this.ctx.storage, picture);
        if (paint) {
          const url = URL.createObjectURL(paint);
          this.urls.push(url);
          tile.append(Object.assign(document.createElement('img'), { src: url, alt: '' }));
        }
      }
      tile.append(Object.assign(document.createElement('img'), { src: page.url, alt: '' }));
      grid.append(tile);
    }
    if (pages.length > 6) {
      grid.append(
        kidButton({
          kind: 'paper',
          label: 'More pages',
          html: icons.back(72).replace('<svg ', '<svg style="transform: scaleX(-1)" '),
          className: 'more-tile',
          onTap: () => {
            this.pageOffset += perScreen;
            void this.showPages();
          },
        }),
      );
    }
    screen.append(grid);
    this.root.replaceChildren(screen);
  }

  async openPage(page: Page): Promise<void> {
    if (this.session) return;
    const { storage, kid } = this.ctx;
    const existing = await findPicture(storage, kid.id, page.id);
    const picture = existing ?? newPicture(kid, page.id);
    const paint = existing ? await keepPreviousVersion(storage, existing) : undefined;
    this.revokeUrls();
    this.session = new ColoringSession(this.root, this.ctx, page, picture, () => void this.showPages());
    await this.session.start(paint);
  }

  async unmount(): Promise<void> {
    await this.closeSession();
    this.revokeUrls();
  }
}

class ColoringSession {
  private readonly engine: ColoringEngine;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private saving: Promise<void> = Promise.resolve();
  private sizeIndex = 1;
  private colorValue: string;

  private readonly tools = new Map<Tool, HTMLButtonElement>();
  private readonly swatches = new Map<string, HTMLButtonElement>();
  private readonly sizes: HTMLButtonElement[] = [];
  private readonly modes = new Map<ColoringMode, HTMLButtonElement>();
  private screen!: HTMLElement;
  private sizePanel!: HTMLElement;

  constructor(
    private readonly root: HTMLElement,
    private readonly ctx: GameContext,
    private readonly page: Page,
    private readonly picture: Picture,
    private readonly back: () => void,
  ) {
    this.engine = new ColoringEngine({
      onChange: () => this.changed(),
      onNothing: () => ctx.sound.play('nothing'),
      onFill: () => ctx.sound.play('fill'),
    });
    this.engine.mode = picture.meta.mode;
    this.colorValue = this.engine.color;
  }

  async start(paint: Blob | undefined): Promise<void> {
    this.build();
    await this.engine.load(this.page.url, paint);
  }

  private changed(): void {
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.save(), AUTOSAVE_MS);
  }

  private save(): Promise<void> {
    this.saving = this.saving.then(async () => {
      if (!this.dirty) return;
      this.dirty = false;
      try {
        const paint = await this.engine.exportPaint();
        await savePicture(this.ctx.storage, this.picture, paint);
      } catch (err) {
        // No dialogs on kid screens (ADR 0016 rule 6); keep the change pending and try again next time.
        this.dirty = true;
        console.error('Autosave failed', err);
      }
    });
    return this.saving;
  }

  async close(): Promise<void> {
    clearTimeout(this.timer);
    await this.save();
    this.engine.destroy();
  }

  // ---- Screen ----

  private build(): void {
    const sound = this.ctx.sound;
    const screen = el('div', 'coloring', { 'data-screen': 'coloring', 'data-page': this.page.id });
    this.screen = screen;

    // Tool rail, left
    const rail = el('div', 'cb-panel tool-rail');
    const back = kidButton({ kind: 'action', label: 'Back to the pages', html: icons.back(50), onTap: this.back });
    const toolGroup = el('div', 'rail-group', { role: 'group', 'aria-label': 'Tools' });
    const toolDefs: [Tool, string, string][] = [
      ['bucket', 'Paint bucket', icons.bucket()],
      ['brush', 'Brush', icons.brush()],
      ['eraser', 'Eraser', icons.eraser()],
    ];
    for (const [tool, label, html] of toolDefs) {
      const b = kidButton({
        kind: 'tool',
        label,
        html,
        onTap: () => {
          sound.play('tap');
          this.engine.tool = tool;
          this.update();
        },
      });
      b.dataset.tool = tool;
      this.tools.set(tool, b);
      toolGroup.append(b);
    }
    const actions = el('div', 'rail-group');
    actions.append(
      kidButton({
        kind: 'action',
        label: 'Undo',
        html: icons.undo(),
        onTap: () => {
          if (this.engine.undo()) sound.play('undo');
        },
      }),
      kidButton({
        kind: 'action',
        label: 'Start over',
        html: icons.startOver(),
        onTap: () => {
          sound.play('tap');
          this.engine.startOver();
        },
      }),
    );
    rail.append(back, toolGroup, actions);

    // Page and tray, middle
    const center = el('div', 'center');
    const frame = el('div', 'page-frame');
    frame.append(this.engine.root);

    const tray = el('div', 'tray');
    this.sizePanel = el('div', 'cb-panel tray-panel sizes', { role: 'group', 'aria-label': 'Brush size' });
    ['Small brush', 'Medium brush', 'Big brush'].forEach((label, i) => {
      const b = kidButton({
        kind: 'choice',
        label,
        className: 'cb-size',
        html: `<i style="width:${DOT_PX[i]}px;height:${DOT_PX[i]}px"></i>`,
        onTap: () => {
          sound.play('tap');
          this.sizeIndex = i;
          this.engine.size = BRUSH_SIZES[i];
          // Sizes belong to the brush and eraser: picking one while the bucket is picked picks the brush (ADR 0016).
          if (this.engine.tool === 'bucket') this.engine.tool = 'brush';
          this.update();
        },
      });
      this.sizes.push(b);
      this.sizePanel.append(b);
    });
    const modePanel = el('div', 'cb-panel tray-panel modes', { role: 'group', 'aria-label': 'Coloring mode' });
    const modeDefs: [ColoringMode, string, string][] = [
      ['free', 'Color anywhere', icons.free()],
      ['lines', 'Stay in the lines', icons.lines()],
    ];
    for (const [mode, label, html] of modeDefs) {
      const b = kidButton({
        kind: 'choice',
        label,
        html,
        className: 'cb-mode',
        onTap: () => {
          sound.play('tap');
          if (this.engine.mode === mode) return;
          // The mode belongs to the picture and only affects strokes made after the switch (ADR 0004).
          this.engine.mode = mode;
          this.picture.meta.mode = mode;
          this.changed();
          this.update();
        },
      });
      b.dataset.mode = mode;
      this.modes.set(mode, b);
      modePanel.append(b);
    }
    tray.append(this.sizePanel, modePanel);
    center.append(frame, tray);

    // Color rail, right
    const colors = el('div', 'cb-panel color-rail', { role: 'group', 'aria-label': 'Colors' });
    for (const color of PALETTE) {
      const b = kidButton({
        kind: 'swatch',
        label: color.label,
        className: color.value === RAINBOW ? 'cb-swatch--rainbow' : '',
        onTap: () => {
          sound.play('tap');
          this.colorValue = color.value;
          this.engine.color = color.value;
          this.update();
        },
      });
      if (color.value !== RAINBOW) b.style.background = color.value;
      b.dataset.color = color.token;
      this.swatches.set(color.value, b);
      colors.append(b);
    }

    screen.append(rail, center, colors);
    this.update();
    this.root.replaceChildren(screen);
  }

  private update(): void {
    const e = this.engine;
    setPicked(this.tools.values(), this.tools.get(e.tool));
    setPicked(this.swatches.values(), this.swatches.get(this.colorValue));
    setPicked(this.sizes, this.sizes[this.sizeIndex]);
    setPicked(this.modes.values(), this.modes.get(e.mode));
    // While the bucket is picked the size tray fades (ADR 0016).
    this.sizePanel.classList.toggle('is-faded', e.tool === 'bucket');
    const rainbow = this.colorValue === RAINBOW;
    this.screen.style.setProperty('--current-paint', rainbow ? RAINBOW_ICON : this.colorValue);
    this.screen.style.setProperty('--current-dot', rainbow ? 'var(--crayon-rainbow)' : this.colorValue);
    this.screen.dataset.tool = e.tool;
  }
}
