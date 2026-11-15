// The coloring screen for one picture (ADR 0004, 0016, 0019), with autosave (ADR 0007).
import type { ColoringMode, GameContext } from '../../shell/types';
import { icons } from '../../ui/icons';
import { el, kidButton, setPicked } from '../../ui/kid';
import { PALETTE, RAINBOW } from '../../ui/palette';
import { BRUSH_SIZES, ColoringEngine, type Tool } from './engine/engine';
import type { Page } from './pages';
import { finishedName, savePicture, type Picture } from './pictures';

/** Autosave runs this long after the last action (ADR 0007). */
export const AUTOSAVE_MS = 1000;

/** Size dot diameters in the tray, small to big (ADR 0016). */
const DOT_PX = [16, 30, 46];

/** Color drawn on the tool icons while rainbow is picked; the dots show the full rainbow. */
const RAINBOW_ICON = '#9b5de5';

/** The page's outline and the drop under it, around the 4:3 drawing area. */
const PAGE_BORDER = 5;
const PAGE_LEDGE = 8;

export class ColoringSession {
  private readonly engine: ColoringEngine;
  private dirty = false;
  /** Something changed since the picture was opened, so the finished picture needs writing on leaving. */
  private touched = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private saving: Promise<void> = Promise.resolve();
  private sizeIndex = 1;
  /** Back was tapped: the picture is being saved and the next screen is on its way. */
  private leaving = false;
  private colorValue: string;
  private resize: ResizeObserver | null = null;

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
      // A slow line is a quiet scratch, a fast scribble a loud one (page pixels a second; the page is 2048 wide).
      onDraw: (speed) => ctx.sound.scratch?.(speed <= 0 ? 0 : Math.min(1, 0.25 + speed / 2500)),
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
    this.touched = true;
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
    this.resize?.disconnect();
    await this.save();
    await this.writeFinished();
    this.engine.destroy();
  }

  /** Leaving the page writes the finished picture to the Pictures folder (Windows app only, ADR 0007). */
  private async writeFinished(): Promise<void> {
    const finished = this.ctx.finished;
    if (!finished || !this.touched) return;
    try {
      await finished.save(this.picture.kid, finishedName(this.picture), await this.engine.exportFlat());
      this.touched = false;
    } catch (err) {
      // Never a dialog on kid screens; the working copy is saved, and the next visit writes it again.
      console.error('Could not write the finished picture', err);
    }
  }

  // ---- Screen ----

  private build(): void {
    const sound = this.ctx.sound;
    const screen = el('div', 'coloring', { 'data-screen': 'coloring', 'data-page': this.page.id });
    this.screen = screen;

    // Tool rail, left
    const rail = el('div', 'cb-panel tool-rail');
    // Saving a big picture can take a moment; more taps on Back meanwhile must not leave twice.
    const back = kidButton({
      kind: 'action',
      label: 'Back',
      html: icons.back(50),
      onTap: () => {
        if (this.leaving) return;
        this.leaving = true;
        this.back();
      },
    });
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

    // Page and tray, middle. The page takes all the room the rails and tray leave, at 4:3 (ADR 0019).
    const center = el('div', 'center');
    const area = el('div', 'page-area');
    const frame = el('div', 'page-frame');
    frame.append(this.engine.root);
    area.append(frame);

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
    center.append(area, tray);

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

    const fit = () => {
      const w = area.clientWidth - PAGE_BORDER * 2;
      const h = area.clientHeight - PAGE_BORDER * 2 - PAGE_LEDGE;
      const pageW = Math.max(0, Math.floor(Math.min(w, (h * 4) / 3)));
      frame.style.width = `${pageW}px`;
      frame.style.height = `${Math.floor((pageW * 3) / 4)}px`;
      tray.style.width = `${pageW + PAGE_BORDER * 2}px`;
    };
    this.resize = new ResizeObserver(fit);
    this.resize.observe(area);
    fit();
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
