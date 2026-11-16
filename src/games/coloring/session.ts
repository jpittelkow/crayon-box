// The coloring screen for one picture (ADR 0004, 0016, 0019), with autosave (ADR 0007).
import type { ColoringMode, GameContext } from '../../shell/types';
import { icons } from '../../ui/icons';
import { el, kidButton, setPicked } from '../../ui/kid';
import { PALETTE, RAINBOW, WHEEL } from '../../ui/palette';
import { ToolBadge } from './badge';
import {
  ACTION_BUTTONS,
  MODE_BUTTONS,
  Narrator,
  SIZE_BUTTONS,
  TOOL_BUTTONS,
  buttonFiles,
  colorButton,
  wheelButton,
} from './buttons';
import { ShowHow } from './demo';
import { BRUSH_SIZES, ColoringEngine, type Tool } from './engine/engine';
import { NameCounter, loadNamesSetting, type NamesSetting } from './names';
import {
  demoOnOpen,
  demoOnPick,
  emptyRecord,
  loadAsk,
  loadRecord,
  saveRecord,
  seen,
  started,
  type Demo,
  type ShowHowRecord,
} from './showHow';
import type { Page } from './pages';
import { finishedName, savePicture, type Picture } from './pictures';
import { ColorWheel, SIDE_PADDING, WHEEL_PX, wheelFits } from './wheel';

/** Autosave runs this long after the last action (ADR 0007). */
export const AUTOSAVE_MS = 1000;

/** Size dot diameters in the tray, small to big (ADR 0016). */
const DOT_PX = [16, 30, 46];

/** Color drawn on the tool icons while rainbow is picked; the dots show the full rainbow. */
const RAINBOW_ICON = '#9b5de5';

/** The page's outline and the drop under it, around the 4:3 drawing area. */
const PAGE_BORDER = 5;
const PAGE_LEDGE = 8;

/** A first-page demo waits this long after the page appears; a first pick's waits for the tool's name too. */
const OPEN_DEMO_MS = 1200;
const PICK_DEMO_MS = 300;

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
  private badge!: ToolBadge;
  private wheel!: ColorWheel;
  private readonly names: NameCounter;
  private namesSetting: NamesSetting = 'first';
  private readonly narrator: Narrator;
  private showHow!: ShowHow;
  private shown: ShowHowRecord = emptyRecord();
  /** When a parent last asked for "Show the buttons" for this kid. */
  private asked = 0;
  private showHowSaving: Promise<void> = Promise.resolve();
  private closed = false;

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
    this.names = new NameCounter(ctx.storage, picture.kid);
    this.narrator = new Narrator(ctx.sound, this.names, () => this.namesSetting);
  }

  async start(paint: Blob | undefined): Promise<void> {
    // Names are a nicety: if their files can't be read, the screen still opens and every button still sounds.
    await Promise.all([
      this.names.load().catch((err) => console.error('Could not read the button names heard', err)),
      loadNamesSetting(this.ctx.storage).then(
        (s) => void (this.namesSetting = s),
        (err) => console.error('Could not read the button names setting', err),
      ),
      // So is the show-how: unreadable, it just doesn't play.
      Promise.all([loadRecord(this.ctx.storage, this.picture.kid), loadAsk(this.ctx.storage, this.picture.kid)]).then(
        ([rec, asked]) => {
          this.shown = rec;
          this.asked = asked;
        },
        (err) => {
          this.shown = { ...emptyRecord(), page: true, seen: ['bucket', 'brush', 'eraser'] };
          console.error('Could not read the show-how record', err);
        },
      ),
    ]);
    this.ctx.sound.preload?.(buttonFiles());
    this.build();
    await this.engine.load(this.page.url, paint);
    const demo = demoOnOpen(this.shown, this.asked, this.engine.tool, Date.now());
    if (demo && !this.closed) this.showHow.play(demo, OPEN_DEMO_MS);
  }

  /** Keeps what the kid has seen of the show-how; saves run one after another and never throw. */
  private recordShowHow(change: (rec: ShowHowRecord) => ShowHowRecord): void {
    this.shown = change(this.shown);
    const snapshot = this.shown;
    this.showHowSaving = this.showHowSaving
      .then(() => saveRecord(this.ctx.storage, this.picture.kid, snapshot))
      .catch((err) => console.error('Could not save the show-how record', err));
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
    this.closed = true;
    clearTimeout(this.timer);
    this.resize?.disconnect();
    this.badge?.destroy();
    this.showHow?.destroy();
    await this.save();
    await this.showHowSaving;
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
    const say = this.narrator;
    const screen = el('div', 'coloring', { 'data-screen': 'coloring', 'data-page': this.page.id });
    this.screen = screen;

    // Tool rail, left. Picks (tools, sizes, modes, colors) fire on touch-down; back, undo and start over on lift
    // (ADR 0038). Each says what it is (buttons.ts).
    const rail = el('div', 'cb-panel tool-rail');
    // Saving a big picture can take a moment; more taps on Back meanwhile must not leave twice.
    const back = kidButton({
      kind: 'action',
      label: 'Back',
      html: icons.back(50),
      onTap: () => {
        if (this.leaving) return;
        this.leaving = true;
        say.pick(ACTION_BUTTONS.back);
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
        onPress: () => {
          say.pick(TOOL_BUTTONS[tool]);
          this.engine.tool = tool;
          this.update();
          // The first pick of a tool shows what it does, after its name (ADR 0038 part 3).
          const demo = demoOnPick(this.shown, tool, Date.now());
          if (demo) this.showHow.play(demo, PICK_DEMO_MS);
        },
      });
      b.dataset.tool = tool;
      this.tools.set(tool, b);
      toolGroup.append(b);
    }
    const actions = el('div', 'rail-group');
    const undo = kidButton({
      kind: 'action',
      label: 'Undo',
      html: icons.undo(),
      onTap: () => {
        // With nothing to undo the engine plays its quiet "nothing" tap instead.
        if (this.engine.undo()) say.pick(ACTION_BUTTONS.undo);
      },
    });
    const startOver = kidButton({
      kind: 'action',
      label: 'Start over',
      html: icons.startOver(),
      onTap: () => {
        say.pick(ACTION_BUTTONS['start-over']);
        this.engine.startOver();
      },
    });
    actions.append(undo, startOver);
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
        onPress: () => {
          say.pick(SIZE_BUTTONS[i]!);
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
        onPress: () => {
          say.pick(MODE_BUTTONS[mode]);
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

    // Colors, right: the rail, and the colour wheel under it where the screen has the room (ADR 0038 part 5).
    const side = el('div', 'cb-panel color-side');
    const colors = el('div', 'color-rail', { role: 'group', 'aria-label': 'Colors' });
    for (const color of PALETTE) {
      const b = kidButton({
        kind: 'swatch',
        label: color.label,
        className: color.value === RAINBOW ? 'cb-swatch--rainbow' : '',
        onPress: () => {
          say.pick(colorButton(color.token));
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
    // A wheel segment is picked like a swatch, works with every tool, and says its plain colour word.
    this.wheel = new ColorWheel(WHEEL, (color) => {
      say.pick(wheelButton(color));
      this.colorValue = color.value;
      this.engine.color = color.value;
      this.update();
    });
    this.wheel.el.hidden = true;
    side.append(colors, this.wheel.el);

    // The current tool on a dot of the current color follows a finger on the page (ADR 0038). It sits on the whole
    // screen, not the page, so near the page's edge it can stand out over the margin.
    this.badge = new ToolBadge(screen, this.engine.root);
    screen.append(rail, center, side, this.badge.el);

    // The show-how plays over the page's corner; any touch stops it (ADR 0038 part 3).
    this.showHow = new ShowHow({
      screen,
      frame,
      page: this.engine.root,
      narrator: say,
      sound: this.ctx.sound,
      look: () => ({ color: this.colorValue, sizeIndex: this.sizeIndex }),
      button: (step) => (step === 'undo' ? undo : step === 'start-over' ? startOver : this.tools.get(step)),
      onStart: () => this.recordShowHow((rec) => started(rec, Date.now())),
      onSeen: (demo: Demo) => this.recordShowHow((rec) => seen(rec, demo)),
    });
    this.update();
    this.root.replaceChildren(screen);

    const fit = () => {
      const h = area.clientHeight - PAGE_BORDER * 2 - PAGE_LEDGE;
      // The wheel shows only where it fits without the page getting smaller (ADR 0019, 0038). Its column is wider than
      // the rail's, so what the centre would have without it is worked out from what it has now.
      const sideWithout = colors.offsetWidth + 2 * SIDE_PADDING;
      const sideWith = Math.max(sideWithout, WHEEL_PX + 2 * SIDE_PADDING);
      const show = wheelFits({
        centreWithout: area.clientWidth + side.offsetWidth - sideWithout,
        sideWithout,
        sideWith,
        pageByHeight: Math.floor((h * 4) / 3),
        pageChrome: PAGE_BORDER * 2,
        sideHeight: side.clientHeight,
        swatchesHeight: colors.offsetHeight,
      });
      if (this.wheel.el.hidden === show) this.wheel.el.hidden = !show;
      screen.dataset.wheel = String(show);
      const w = area.clientWidth - PAGE_BORDER * 2;
      const pageW = Math.max(0, Math.floor(Math.min(w, (h * 4) / 3)));
      frame.style.width = `${pageW}px`;
      frame.style.height = `${Math.floor((pageW * 3) / 4)}px`;
      tray.style.width = `${pageW + PAGE_BORDER * 2}px`;
    };
    this.resize = new ResizeObserver(fit);
    this.resize.observe(area);
    this.resize.observe(screen);
    fit();
  }

  private update(): void {
    const e = this.engine;
    setPicked(this.tools.values(), this.tools.get(e.tool));
    setPicked(this.swatches.values(), this.swatches.get(this.colorValue));
    this.wheel.pick(this.colorValue);
    // While the bucket is picked the sizes grey out and none is ringed: they don't apply (ADR 0016, 0038). A tap on
    // one still works: it picks that size and the brush.
    const bucket = e.tool === 'bucket';
    setPicked(this.sizes, bucket ? undefined : this.sizes[this.sizeIndex]);
    setPicked(this.modes.values(), this.modes.get(e.mode));
    this.sizePanel.classList.toggle('is-faded', bucket);
    const rainbow = this.colorValue === RAINBOW;
    this.screen.style.setProperty('--current-paint', rainbow ? RAINBOW_ICON : this.colorValue);
    this.screen.style.setProperty('--current-dot', rainbow ? 'var(--crayon-rainbow)' : this.colorValue);
    this.screen.dataset.tool = e.tool;
    this.badge.show(e.tool, this.sizeIndex, this.colorValue);
  }
}
