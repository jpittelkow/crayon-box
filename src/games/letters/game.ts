// Letter practice (ADR 0026): trace big letters with a finger or a pen. Two ways in: practice, with every turned-on
// letter open, and the game, where finishing a letter opens the next one along a path. Sound while tracing (ADR
// 0037): the letter is said when it opens, a crayon sound plays while a finger moves on the road, a chime marks
// each finished stroke, and the finished letter gets its name and a word of praise. A kid who is stuck gets the
// hint ladder (hints.ts): a bigger dot, then a fingertip along the next stroke, then the whole letter shown. Before a
// kid's first letter, and after a while away, the first-time how-to shows an L being traced on this same screen.
// Words (ADR 0039), a third tile a parent turns on per kid: the kid's own name and short words, one big letter at a
// time on this same screen, each traced letter dropping into a row of boxes, then the slow word and one check.
import { demoClip, narratorClip, soundClip, strokeClip, tipClip } from '../../shell/soundFiles';
import type { GameContext, GameModule } from '../../shell/types';
import { icons } from '../../ui/icons';
import { el, kidButton, setPicked } from '../../ui/kid';
import { playDemo, type Demo } from './demo';
import { loadFamilyWords, type FamilyWordFiles } from './familyWords';
import { arrowsFor, glyph, pathData, SET_CHARS, SHAPES, setOf, type SetId, type StrokeKind } from './glyphs';
import {
  Hints,
  HOWTO_LEAD_MS,
  HOWTO_LETTER,
  HOWTO_WATCH_MAX_MS,
  isKnown,
  TICK_MS,
  type HintAction,
} from './hints';
import {
  dayOf,
  demoDue,
  findNameRecording,
  finishLetter,
  finishWord,
  forgetKid,
  gameIndex,
  isOpenInGame,
  keyOf,
  lettersOf,
  loadLettersSettings,
  loadPrefs,
  loadProgress,
  nextInSet,
  noteNextSaid,
  notePlayed,
  type KidPrefs,
  type KidProgress,
} from './progress';
import { TOLERANCE, Tracer } from './trace';
import { LetterVoice, type Part } from './voice';
import { avatarEl, boxRow, cellLetters, dropInto, glyphMarkup, INK, light, VIEW, wordLettersMarkup } from './wordView';
import {
  BOX_MAX_DONE,
  BUILT_IN_WORDS,
  boxSize,
  familyCells,
  lettersIn,
  NAME,
  nameCells,
  NEXT_LETTER_TIMES,
  nextWord,
  slowClipId,
  wordCells,
  wordKey,
  wordOrder,
  type Cell,
} from './words';
import './letters.css';

export const lettersGame: GameModule = {
  mount(root, ctx) {
    const game = new LettersGame(root, ctx);
    void game.start();
    return () => game.unmount();
  },
  parentSettings: [
    {
      id: 'letters',
      title: 'Letters',
      render: async (el, ctx) => (await import('./parentSection')).renderLetters(el, ctx),
    },
  ],
  forgetKid,
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const GREEN = '#2fa35f';
/**
 * Once this much of the letter is traced, lifting the finger shows dots on what is left at once (ADR 0028); with
 * less, the hints show them after a pause ("Keep going!", hints.ts).
 */
const LEFT_FROM = 0.5;
/**
 * The drawing sound's pitch (ADR 0037). Stand-in: the coloring game's crayon (`ui/crayon.wav`), raised, until a take
 * of its own (sounds recipe, way A).
 */
const DRAW_RATE = 1.3;
/** A finger still for this long on the road stops the drawing sound: it plays only while the finger moves. */
const STILL_MS = 150;
/** The drawing sound's loudness: this much for a slow line, louder with speed up to 1 (glyph units a second). */
const DRAW_QUIET = 0.3;
const DRAW_LOUD_SPEED = 300;
/** A pen near the screen mutes touches for this long after it was last seen (ADR 0026). */
const PEN_GRACE_MS = 500;
/** A touch reported wider than this (CSS px) is a palm, and is ignored (ADR 0003 rule 3). */
const PALM_CSS_PX = 80;
/** Stops on one screen of the game path. */
const STOPS_PER_PAGE = 10;
/** Where the stops sit on the path, in % of the stage: five along the top, five back along the bottom. */
const SPOTS: [number, number][] = [
  [17, 31], [33, 31], [49, 31], [65, 31], [81, 31],
  [81, 71], [65, 71], [49, 71], [33, 71], [17, 71],
];
const STAR =
  '<svg viewBox="0 0 48 48" width="60%" height="60%" fill="#ffffff" stroke="#23201c" stroke-width="4" ' +
  'stroke-linejoin="round" aria-hidden="true"><path d="M24 4l6 13 14 1.5-10.5 9.5L36.5 42 24 34.5 11.5 42l3-14L4 18.5 18 17z"/></svg>';
const LOCK =
  '<svg viewBox="0 0 48 48" width="60%" height="60%" fill="none" stroke="#23201c" stroke-width="5" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true"><rect x="9" y="21" width="30" height="22" rx="5" fill="#ffffff"/>' +
  '<path d="M16 21v-6a8 8 0 0 1 16 0v6"/></svg>';
const SPEAKER =
  '<svg viewBox="0 0 48 48" width="60%" height="60%" fill="none" stroke="#23201c" stroke-width="4" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true"><path d="M8 18h8l10-8v28l-10-8H8z" fill="#ffd23f"/>' +
  '<path d="M32 17a9 9 0 0 1 0 14"/><path d="M37 12a16 16 0 0 1 0 24"/></svg>';

// ---- Words (ADR 0039) ----
/** The opening: the picture stays big at least this long, and at most this long while its word is said. */
const INTRO_MIN_MS = 1200;
const INTRO_MAX_MS = 3500;
/** A traced letter has landed in its box: the next letter opens this long after. */
const LETTER_GAP_MS = 350;
/** The boxes grow to the middle in this long, before the slow word. */
const GROW_MS = 550;
/** With sounds off (or no recording of a name), each box lights for this long in turn. */
const SILENT_LIGHT_MS = 450;
/** The slow word and the word are never waited on longer than this before the check shows. */
const SLOW_MAX_MS = 9000;
/** Room kept beside the row of boxes for the back button and the picture in the corner (CSS px, each side). */
const WORD_SIDE = 190;

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** A letter's or shape's name for screen readers and tests (kids see no text, ADR 0003). */
function nameOf(ch: string): string {
  const set = setOf(ch);
  if (set === 'shapes') return SHAPES[ch].label;
  return `${set === 'numbers' ? 'Number' : set === 'small' ? 'Small letter' : 'Letter'} ${ch}`;
}

/** Each set's tab in practice: its name, and the three it shows. */
const TABS: Record<SetId, { label: string; show: string }> = {
  shapes: { label: 'Lines and shapes', show: '○□△' },
  capitals: { label: 'Capital letters', show: 'ABC' },
  small: { label: 'Small letters', show: 'abc' },
  numbers: { label: 'Numbers', show: '123' },
};

type Mode = 'practice' | 'game' | 'words';

/** The trace screen as the first-time how-to (ADR 0037): `then` opens what the kid picked, after it. */
interface HowTo {
  then?: () => void;
}

/** A word being written (ADR 0039): its boxes, the letter being traced, and the kid's lines in the boxes before it. */
interface WordTurn {
  /** A built-in word's id, a family word's (`fam-…`), or NAME for the kid's own name. */
  id: string;
  cells: Cell[];
  letters: string[];
  /** Which letter is being traced (an index into `letters`). */
  at: number;
  /** The kid's own line for each letter traced so far, as markup in the tracing view's units. */
  inks: string[];
  /** The opening (the picture big, the word said) plays before the first letter. */
  intro: boolean;
  /** A parent's recording (a storage path) of the kid's name, or of a family word. */
  recording?: string;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A finger's or pen's line on the letter; `last` and `at` are where and when it last moved, for the drawing sound. */
interface Line {
  node: SVGPolylineElement;
  points: string[];
  pen: boolean;
  last?: { x: number; y: number };
  at?: number;
}

class LettersGame {
  private prefs!: KidPrefs;
  private progress!: KidProgress;
  private voice!: LetterVoice;
  /** The set shown in practice; kept while the game is open. */
  private practiceSet: SetId = 'capitals';
  /** The first-time how-to plays before the next letter opened (ADR 0037). */
  private howToDue = false;
  /** Progress saved when a letter opens; a finish waits for it, so the two never overwrite each other. */
  private saved: Promise<unknown> = Promise.resolve();
  private readonly cleanups: (() => void)[] = [];
  /** The kid's photo for their name's tile (ADR 0018), as an object URL while the game is open. */
  private photoUrl: string | undefined;
  /** The family's own words (ADR 0039), oldest first, read when the game opens with Words on. */
  private family: FamilyWordFiles[] = [];
  /** Family words' photos by word id, as object URLs while the game is open. */
  private readonly familyPhotos = new Map<string, string>();

  constructor(
    private readonly root: HTMLElement,
    private readonly ctx: GameContext,
  ) {}

  async start(): Promise<void> {
    const { storage, kid } = this.ctx;
    const [prefs, progress, settings] = await Promise.all([
      loadPrefs(storage, kid.id),
      loadProgress(storage, kid.id),
      loadLettersSettings(storage),
    ]);
    this.prefs = prefs;
    this.progress = progress;
    this.voice = new LetterVoice(storage, settings, this.ctx.sound);
    this.practiceSet = prefs.sets[0];
    this.howToDue = demoDue(progress, dayOf(new Date()));
    if (prefs.words && this.ctx.kid.name) {
      const photo = await this.ctx.photo?.().catch(() => undefined);
      if (photo) this.photoUrl = URL.createObjectURL(photo);
    }
    if (prefs.words) {
      this.family = await loadFamilyWords(storage).catch(() => []);
      for (const word of this.family) {
        const photo = word.photo ? await storage.getBlob(word.photo).catch(() => undefined) : undefined;
        if (photo) this.familyPhotos.set(word.id, URL.createObjectURL(photo));
      }
    }
    this.showStart();
  }

  async unmount(): Promise<void> {
    this.clear();
    this.voice?.stop();
    if (this.photoUrl) URL.revokeObjectURL(this.photoUrl);
    for (const url of this.familyPhotos.values()) URL.revokeObjectURL(url);
  }

  /** The screen's width in CSS px (the laptop's 1280 when not laid out yet). */
  private get width(): number {
    return this.root.clientWidth || 1280;
  }

  private clear(): void {
    for (const c of this.cleanups.splice(0).reverse()) c();
  }

  private get kidColor(): string {
    return `var(--kid-${this.ctx.kid.color})`;
  }

  private get path(): string[] {
    return lettersOf(this.prefs.sets);
  }

  /** A screen with the one way back in the top-left corner (ADR 0016 rule 5). */
  private screen(name: string, back: () => void): HTMLElement {
    this.clear();
    const screen = el('div', 'letters-screen', { 'data-screen': name });
    screen.style.setProperty('--kid-paint', this.kidColor);
    screen.append(kidButton({ kind: 'action-lg', label: 'Back', html: icons.back(), className: 'letters-corner', onTap: back }));
    this.root.replaceChildren(screen);
    return screen;
  }

  private tap(): void {
    this.ctx.sound.play('tap');
  }

  // ---- Start: practice or the game ----

  private showStart(): void {
    const screen = this.screen('letters-start', () => this.ctx.exitToHome());
    const row = el('div', 'letters-start-row');
    const practice = kidButton({
      kind: 'paper',
      label: 'Practice',
      className: 'letters-big',
      onTap: () => {
        this.tap();
        this.showPractice();
      },
    });
    practice.innerHTML =
      '<span class="letters-mini-grid" aria-hidden="true">' +
      [...'ABCD'].map((ch) => `<span>${glyphMarkup(ch, 15)}</span>`).join('') +
      '</span>';
    const gameTile = kidButton({
      kind: 'paper',
      label: 'Game',
      className: 'letters-big',
      onTap: () => {
        this.tap();
        this.showPath();
      },
    });
    gameTile.innerHTML =
      `<svg viewBox="0 0 400 300" width="84%" height="84%" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
      `<path d="M40 230C110 230 100 90 190 90S280 220 360 150" stroke="${INK}" stroke-width="34"/>` +
      `<path d="M40 230C110 230 100 90 190 90S280 220 360 150" stroke="#f4efe6" stroke-width="24"/>` +
      `<circle cx="60" cy="226" r="38" style="fill: var(--kid-paint)" stroke="${INK}" stroke-width="6"/>` +
      `<circle cx="190" cy="90" r="44" fill="#ffffff" stroke="${GREEN}" stroke-width="8"/>` +
      `<circle cx="330" cy="166" r="38" fill="#e4e1dc" stroke="${INK}" stroke-width="6"/>` +
      `<g transform="translate(312 146)" stroke="${INK}" stroke-width="5"><rect x="4" y="16" width="28" height="22" rx="5" fill="#ffffff"/><path d="M10 16v-6a8 8 0 0 1 16 0v6"/></g>` +
      `<g transform="translate(60 226) scale(0.5) translate(-50 -60)" stroke="${INK}" stroke-width="14">${glyph('L').strokes.map((s) => `<path d="${pathData(s)}"/>`).join('')}</g>` +
      `<g transform="translate(190 90) scale(0.55) translate(-50 -60)" stroke="${INK}" stroke-width="14">${glyph('F').strokes.map((s) => `<path d="${pathData(s)}"/>`).join('')}</g>` +
      `</svg>`;
    row.append(practice, gameTile);
    // Words (ADR 0039), once a parent turned it on for this kid: a row of boxes, two with letters in.
    if (this.prefs.words) {
      const words = kidButton({
        kind: 'paper',
        label: 'Words',
        className: 'letters-big',
        onTap: () => {
          this.tap();
          this.showWords();
        },
      });
      words.innerHTML =
        '<span class="letters-mini-boxes" aria-hidden="true">' +
        ['S', 'U', ''].map((ch) => `<span>${ch ? glyphMarkup(ch, 15) : ''}</span>`).join('') +
        '</span>';
      row.append(words);
    }
    row.dataset.count = String(row.children.length);
    screen.append(row);
  }

  // ---- Practice: every letter open ----

  private showPractice(): void {
    const screen = this.screen('letters-practice', () => this.showStart());
    if (!this.prefs.sets.includes(this.practiceSet)) this.practiceSet = this.prefs.sets[0];
    if (this.prefs.sets.length > 1) {
      const tabs = el('div', 'cb-panel letters-tabs', { role: 'group', 'aria-label': 'Letter sets' });
      const buttons = this.prefs.sets.map((set) => {
        const b = kidButton({
          kind: 'choice',
          label: TABS[set].label,
          className: 'letters-tab',
          onTap: () => {
            this.tap();
            this.practiceSet = set;
            this.showPractice();
          },
        });
        b.dataset.set = set;
        b.innerHTML = [...TABS[set].show]
          .map((ch) => `<span>${glyphMarkup(ch, 16)}</span>`)
          .join('');
        return b;
      });
      setPicked(buttons, buttons[this.prefs.sets.indexOf(this.practiceSet)]);
      tabs.append(...buttons);
      screen.append(tabs);
    }
    const chars = [...SET_CHARS[this.practiceSet]];
    const grid = el('div', 'letters-grid', { role: 'group', 'aria-label': 'Letters' });
    grid.dataset.count = String(chars.length);
    const stars = new Set(this.progress.stars);
    for (const ch of chars) {
      const starred = stars.has(keyOf(ch));
      const tile = kidButton({
        kind: 'paper',
        label: nameOf(ch) + (starred ? ', has a star' : ''),
        className: 'letters-tile',
        html: glyphMarkup(ch),
        onTap: () => this.open(ch, 'practice'),
      });
      tile.dataset.letter = ch;
      if (starred) tile.append(this.badge('letters-star', STAR));
      grid.append(tile);
    }
    screen.append(grid);
  }

  private badge(className: string, html: string): HTMLElement {
    const b = el('span', `letters-badge ${className}`, { 'aria-hidden': 'true' });
    b.innerHTML = html;
    return b;
  }

  // ---- The game: a path, one letter at a time ----

  private showPath(): void {
    const screen = this.screen('letters-path', () => this.showStart());
    const path = this.path;
    const at = gameIndex(path, this.progress);
    const page = Math.floor(Math.min(at, path.length - 1) / STOPS_PER_PAGE);
    const shown = path.slice(page * STOPS_PER_PAGE, (page + 1) * STOPS_PER_PAGE);
    const stage = el('div', 'letters-stage');
    const more = (page + 1) * STOPS_PER_PAGE < path.length;
    stage.innerHTML =
      `<svg class="letters-road" viewBox="0 0 1280 800" preserveAspectRatio="none" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
      ['#23201c" stroke-width="58', '#f4efe6" stroke-width="46', '#c9bba5" stroke-width="5" stroke-dasharray="0.1 22']
        .map((style) => `<path d="M218 248H1037Q1150 248 1150 408Q1150 568 1037 568H${more ? 60 : 218}" stroke="${style}"/>`)
        .join('') +
      (more ? `<path d="M70 538l-40 30 40 30" stroke="${INK}" stroke-width="8" opacity="0.35"/>` : '') +
      `</svg>`;
    const done = new Set(this.progress.game);
    shown.forEach((ch, i) => {
      const index = page * STOPS_PER_PAGE + i;
      const isDone = done.has(keyOf(ch));
      const isNow = index === at;
      const open = isOpenInGame(path, this.progress, ch);
      const stop = kidButton({
        kind: 'choice',
        label: `${nameOf(ch)}${isDone ? ', done' : isNow ? ', next to trace' : ', locked'}`,
        className: `letters-stop${isDone ? ' is-done' : ''}${isNow ? ' is-now' : ''}${open ? '' : ' is-locked'}`,
        html: `<span class="letters-stop-glyph">${glyphMarkup(ch, 14)}</span>`,
        onTap: () => {
          if (!open) {
            this.ctx.sound.play('nothing');
            return;
          }
          this.open(ch, 'game');
        },
      });
      stop.dataset.letter = ch;
      stop.style.left = `${SPOTS[i][0]}%`;
      stop.style.top = `${SPOTS[i][1]}%`;
      if (isDone) stop.append(this.badge('letters-star', STAR));
      if (!open) stop.append(this.badge('letters-lock', LOCK));
      stage.append(stop);
    });
    screen.append(stage);
  }

  // ---- Tracing ----

  /** A letter picked from the grid or the path: the first-time how-to comes first when it is due. */
  private open(ch: string, mode: Mode): void {
    if (!this.howToDue) {
      this.showTrace(ch, mode);
      return;
    }
    this.howToDue = false;
    this.showTrace(HOWTO_LETTER, mode, { then: ch === HOWTO_LETTER ? undefined : () => this.showTrace(ch, mode) });
  }

  private showTrace(ch: string, mode: Mode, howTo?: HowTo, word?: WordTurn): void {
    const back = () => (mode === 'game' ? this.showPath() : mode === 'words' ? this.showWords() : this.showPractice());
    const screen = this.screen('letters-trace', back);
    screen.dataset.letter = ch;
    screen.dataset.done = 'false';
    if (word) {
      screen.dataset.word = word.id === NAME ? 'name' : word.id;
      screen.dataset.wordAt = String(word.at);
    }
    const g = glyph(ch);
    const tracer = new Tracer(g, { ordered: this.prefs.ordered });
    const { storage, kid } = this.ctx;
    const today = dayOf(new Date());
    this.saved = this.saved.then(() => notePlayed(storage, kid.id, today, !!howTo)).catch(() => undefined);
    // The letter is said as it opens, by the parent's setting: its name, its name then its sound, or its sound. The
    // how-to says "Watch me." instead.
    // In a word, the opening or "Now the next letter." comes first (below).
    if (!howTo && !word) void this.voice.say(ch);

    const card = el('div', 'letters-card');
    const svg = svgEl('svg', { viewBox: VIEW, class: 'letters-svg', role: 'img', 'aria-label': `Trace ${nameOf(ch)}` });
    card.append(svg);
    const layer = (cls: string, attrs: Record<string, string | number> = {}) => {
      const node = svgEl('g', { class: cls, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...attrs });
      svg.append(node);
      return node;
    };
    const guide = (parent: SVGGElement) => g.strokes.forEach((s) => parent.append(svgEl('path', { d: pathData(s) })));
    guide(layer('letters-outline', { stroke: INK, 'stroke-width': 25 }));
    guide(layer('letters-road-fill', { stroke: '#f4efe6', 'stroke-width': 20 }));
    guide(layer('letters-dots', { stroke: '#c9bba5', 'stroke-width': 2.2, 'stroke-dasharray': '0.1 5.5' }));
    const filled = layer('letters-filled', { 'stroke-width': 20 });
    filled.style.stroke = this.kidColor;
    const arrows = layer('letters-arrows');
    const starts = layer('letters-starts');
    const ink = layer('letters-ink');
    ink.style.stroke = this.kidColor;
    const helpers = layer('letters-helpers');

    // ---- Where to start: start dots, arrows, and a finger on the first dot ----
    const drawGuides = (started: boolean) => {
      arrows.replaceChildren();
      starts.replaceChildren();
      const current = tracer.currentStroke;
      const shown = this.prefs.ordered ? [current] : g.strokes.map((_, i) => i);
      arrows.setAttribute('opacity', started ? '0.55' : '1');
      for (const i of shown) {
        if (i >= g.strokes.length) continue;
        // One group per stroke; a stroke that goes down and back up (n, b, m) has an arrow for each way.
        const list = arrowsFor(g, i);
        if (list.length === 0) continue;
        const grp = svgEl('g', { 'data-stroke': i });
        for (const a of list) {
          grp.append(
            svgEl('path', { d: a.shaft, stroke: INK, 'stroke-width': 5.5 }),
            svgEl('path', { d: a.head, stroke: INK, 'stroke-width': 5.5 }),
            svgEl('path', { d: a.shaft, stroke: GREEN, 'stroke-width': 3.2, 'stroke-dasharray': '7 5', class: 'letters-march' }),
            svgEl('path', { d: a.head, stroke: GREEN, 'stroke-width': 3.2 }),
          );
        }
        arrows.append(grp);
      }
      // Dots: drawn back to front so the first stroke's dot sits on top where two strokes share a start.
      for (const i of [...shown].reverse()) {
        if (i >= g.strokes.length) continue;
        const p = g.strokes[i][0];
        const first = i === shown[0];
        if (first) {
          starts.append(
            svgEl('circle', { cx: p.x, cy: p.y, r: 14, stroke: GREEN, 'stroke-width': 1.5, opacity: 0.4 }),
            svgEl('circle', { cx: p.x, cy: p.y, r: 9, fill: GREEN, stroke: INK, 'stroke-width': 2.5, class: 'letters-pulse', 'data-start': i }),
            svgEl('circle', { cx: p.x, cy: p.y, r: 3.2, fill: '#ffffff' }),
          );
        } else {
          starts.append(
            svgEl('circle', { cx: p.x, cy: p.y, r: 6.5, fill: '#ffffff', stroke: GREEN, 'stroke-width': 3, 'data-start': i }),
            svgEl('circle', { cx: p.x, cy: p.y, r: 2.4, fill: GREEN }),
          );
        }
      }
    };
    drawGuides(false);

    const finger = (() => {
      const p = g.strokes[0][0];
      // The hand comes in from the side with more room, so it never runs off the card.
      const fromRight = p.x <= 55;
      const place = fromRight ? `translate(${p.x + 8} ${p.y + 1}) rotate(-18)` : `translate(${p.x - 8} ${p.y + 1}) scale(-1 1) rotate(-18)`;
      const outer = svgEl('g', { transform: place, class: 'letters-finger' });
      const inner = svgEl('g', { class: 'letters-poke', stroke: INK, 'stroke-width': 1.6 });
      inner.append(
        svgEl('rect', { x: 0, y: -3.2, width: 19, height: 6.4, rx: 3.2, fill: '#ffffff' }),
        svgEl('rect', { x: 15, y: -5.5, width: 17, height: 15, rx: 5, fill: '#ffffff' }),
        svgEl('rect', { x: 17, y: -8.5, width: 9, height: 5, rx: 2.5, fill: '#ffffff' }),
        svgEl('path', { d: 'M20 3.3h8M20 6.6h7', 'stroke-width': 1.2 }),
      );
      const cuff = svgEl('rect', { x: 31, y: -6.5, width: 5, height: 17, rx: 1.5 });
      cuff.style.fill = this.kidColor;
      inner.append(cuff);
      outer.append(inner);
      helpers.append(outer);
      return outer;
    })();

    // ---- What is left: small dots mark the rest, after a lift with most of the letter traced or from the hints ----
    const left = layer('letters-left');
    const showLeft = (any = false) => {
      left.replaceChildren();
      if (screen.dataset.done !== 'false' || tracer.progress === 0 || (!any && tracer.progress < LEFT_FROM)) return;
      // A dotted trail, a dot every 8 units, so it reads as "this way still" rather than one blob.
      let last: { x: number; y: number } | null = null;
      for (const p of tracer.missing) {
        if (last && Math.hypot(p.x - last.x, p.y - last.y) < 8) continue;
        last = p;
        left.append(svgEl('circle', { cx: p.x, cy: p.y, r: 3.4, fill: GREEN, stroke: INK, 'stroke-width': 1.2, class: 'letters-pulse' }));
      }
    };

    // ---- The hint ladder (ADR 0037): hints.ts says what to show and say and when; this draws and says it ----
    const hints = new Hints(
      { ordered: this.prefs.ordered, known: isKnown(this.progress.help[keyOf(ch)]), speak: this.voice.tipsOn },
      performance.now(),
    );
    const shows = layer('letters-shows');
    let demo: Demo | null = null;
    const stopShow = () => {
      demo?.stop();
      demo = null;
      delete screen.dataset.showing;
    };
    /** A fingertip draws `strokes` one after another, saying their words with `say`; `then` once it ran to the end. */
    const show = (strokes: number[], say: ((kind: StrokeKind) => void) | undefined, then?: () => void) => {
      stopShow();
      const d = playDemo({ glyph: g, strokes, layer: shows, color: this.kidColor, still: reducedMotion(), say });
      demo = d;
      // The pressing finger on the first dot steps aside while the fingertip draws.
      screen.dataset.showing = 'true';
      void d.done.then((ran) => {
        if (demo !== d) return;
        demo = null;
        delete screen.dataset.showing;
        if (ran && screen.dataset.done === 'false') then?.();
      });
    };
    /** What the hints have shown on this letter, in order, for tests: `1 2 3 wiggle left check`. */
    /** A hint's stroke words, said as tips (the spoken-tips switch silences them). */
    const hintWords = (words: boolean) => (words ? (kind: StrokeKind) => this.voice.tip([strokeClip(kind)]) : undefined);
    const shown = (what: string) => {
      screen.dataset.hints = `${screen.dataset.hints ?? ''} ${what}`.trim();
    };
    const run = (actions: HintAction[]) => {
      for (const a of actions) {
        if (a.do === 'step') {
          screen.dataset.hintStep = String(a.step);
          shown(String(a.step));
          if (a.step === 1) {
            // Step 1: the start dot pulses bigger and the arrow wiggles (its words come as a tip).
            screen.dataset.nudge = 'dot';
          } else if (a.step === 2) {
            // Step 2: the fingertip runs along the next stroke, saying its word.
            delete screen.dataset.nudge;
            show([tracer.firstUnfinished], hintWords(a.words));
          } else {
            // Step 3: the whole letter, stroke by stroke with its words; then the start dot and "Your turn!".
            delete screen.dataset.nudge;
            show(
              g.strokes.map((_, i) => i),
              hintWords(a.words),
              () => {
                screen.dataset.nudge = 'dot';
                if (a.words) this.voice.tip([demoClip('your-turn')]);
              },
            );
          }
        } else if (a.do === 'wiggle') {
          shown('wiggle');
          screen.dataset.nudge = 'arrow';
        } else if (a.do === 'left') {
          shown('left');
          showLeft(true);
        } else if (a.do === 'check') {
          shown('check');
          confirm.classList.add('is-nudged');
        } else {
          screen.dataset.tip = a.tip;
          this.voice.tip([tipClip(a.tip)]);
        }
      }
    };
    // ---- The first-time how-to (ADR 0037, plan phase D): "Watch me.", the letter drawn with its words, "Your turn!" ----
    // While it plays the hints wait; they start counting when it ends. A touch ends it at once: the kid's turn.
    let howToOn = !!howTo;
    // A word's opening (below): the hints wait for it too, and a touch ends it.
    let introOn = false;
    let endIntro: (() => void) | null = null;
    const endHowTo = (how: 'done' | 'stopped') => {
      if (!howToOn) return;
      howToOn = false;
      screen.dataset.howTo = how;
      hints.touch(performance.now());
    };
    if (howTo) {
      screen.dataset.howTo = 'playing';
      // The pressing hand on the first dot waits for the kid's turn.
      screen.dataset.showing = 'true';
      this.voice.stop();
      void (async () => {
        const watch = this.voice.howTo([demoClip('watch')]);
        await Promise.all([wait(HOWTO_LEAD_MS), Promise.race([watch, wait(HOWTO_WATCH_MAX_MS)])]);
        if (!howToOn) return;
        show(
          g.strokes.map((_, i) => i),
          (kind) => void this.voice.howTo([strokeClip(kind)]),
          () => {
            endHowTo('done');
            screen.dataset.nudge = 'dot';
            void this.voice.howTo([demoClip('your-turn')]);
          },
        );
      })();
    }

    const ticker = setInterval(() => {
      const tracing = screen.dataset.done === 'false' || screen.dataset.done === 'ready';
      if (!howToOn && !introOn && tracing) run(hints.tick(performance.now()));
    }, TICK_MS);
    this.cleanups.push(() => {
      clearInterval(ticker);
      howToOn = false;
      introOn = false;
      stopShow();
    });
    // A touch anywhere: the wait starts again, and whatever the hints or the how-to show stops (the kid has moved on).
    screen.addEventListener(
      'pointerdown',
      () => {
        endHowTo('stopped');
        endIntro?.();
        hints.touch(performance.now());
        stopShow();
        delete screen.dataset.nudge;
      },
      { capture: true },
    );

    // ---- The drawing sound: only while a finger moves on the road; leaving the road just stops it (ADR 0037) ----
    let drawing = false;
    let still: ReturnType<typeof setTimeout> | undefined;
    let chimes = 0;
    screen.dataset.drawing = 'false';
    const drawSound = (level: number) => {
      const on = level > 0 && this.voice.on;
      clearTimeout(still);
      if (on) still = setTimeout(() => drawSound(0), STILL_MS);
      if (!on && !drawing) return;
      drawing = on;
      screen.dataset.drawing = String(on);
      this.ctx.sound.scratch?.(on ? level : 0, DRAW_RATE);
    };
    this.cleanups.push(() => {
      clearTimeout(still);
      if (drawing) this.ctx.sound.scratch?.(0);
      this.voice.hold(false);
    });

    // ---- Fingers and pens ----
    const lines = new Map<number, Line>();
    let penSeenUntil = 0;
    let penDown = false;
    let started = false;
    const toGlyph = (e: PointerEvent) => {
      const m = svg.getScreenCTM();
      if (!m) return null;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    };
    const notePen = (e: PointerEvent) => {
      if (e.pointerType === 'pen') penSeenUntil = performance.now() + PEN_GRACE_MS;
    };
    const endLine = (id: number) => {
      lines.delete(id);
      return tracer.lift(id);
    };
    const onDown = (e: PointerEvent) => {
      notePen(e);
      if (!['false', 'ready'].includes(screen.dataset.done ?? '') || e.button > 0) return;
      const pen = e.pointerType === 'pen';
      if (!pen && e.pointerType === 'touch') {
        if (penDown || performance.now() < penSeenUntil) return;
        if (Math.max(e.width, e.height) > PALM_CSS_PX) return;
      }
      if (pen) {
        penDown = true;
        // A pen coming down ends the touches: they were the hand resting on the screen.
        for (const [id, line] of lines) if (!line.pen) endLine(id);
      }
      const p = toGlyph(e);
      if (!p) return;
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic events in tests can't be captured; tracing still works.
      }
      if (!started) {
        started = true;
        finger.remove();
        drawGuides(true);
      }
      const node = svgEl('polyline', { 'stroke-width': pen ? 6 : 9, opacity: 0.92 });
      ink.append(node);
      lines.set(e.pointerId, { node, points: [], pen });
      hints.down(performance.now(), tracer.atStart(p));
      // Nothing new is said while a finger is on the letter (ADR 0037).
      this.voice.hold(true);
      left.replaceChildren();
      move(e, p);
    };
    const move = (e: PointerEvent, p = toGlyph(e)) => {
      const line = lines.get(e.pointerId);
      if (!line || !p) return;
      line.points.push(`${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`);
      line.node.setAttribute('points', line.points.join(' '));
      const now = performance.now();
      if (line.last && line.at !== undefined) {
        const speed = Math.hypot(p.x - line.last.x, p.y - line.last.y) / Math.max(0.008, (now - line.at) / 1000);
        drawSound(tracer.near(p) && speed > 0 ? Math.min(1, DRAW_QUIET + speed / DRAW_LOUD_SPEED) : 0);
      }
      line.last = p;
      line.at = now;
      const before = tracer.currentStroke;
      const covered = tracer.progress;
      const finished = tracer.add(e.pointerId, p, line.pen ? TOLERANCE.pen : TOLERANCE.finger);
      if (tracer.progress > covered) hints.progress(now);
      if (this.prefs.ordered && tracer.currentStroke !== before) drawGuides(true);
      if (tracer.done) ready();
      else if (finished.length > 0) {
        hints.strokeDone();
        if (this.voice.on) {
          // A stroke traced: a quiet chime (the letter's own sound comes when the whole letter is ready).
          this.ctx.sound.play('chime');
          screen.dataset.chimes = String(++chimes);
        }
      }
    };
    const onMove = (e: PointerEvent) => {
      notePen(e);
      move(e);
    };
    const onUp = (e: PointerEvent) => {
      notePen(e);
      if (e.pointerType === 'pen') penDown = false;
      if (!lines.has(e.pointerId)) return;
      const end = endLine(e.pointerId);
      if (lines.size === 0) {
        drawSound(0);
        this.voice.hold(false);
        showLeft();
      }
      run(hints.up(performance.now(), end));
    };
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    // Pen hover reaches the whole screen, so a pen above the letter mutes touches before it lands.
    screen.addEventListener('pointerover', notePen);
    screen.addEventListener('pointermove', notePen);

    // ---- Wipe ----
    const wipe = kidButton({
      kind: 'action-lg',
      label: 'Wipe',
      html: icons.startOver(58),
      className: 'letters-wipe',
      onTap: () => {
        if (screen.dataset.done !== 'false' && screen.dataset.done !== 'ready') return;
        this.ctx.sound.play('undo');
        ink.replaceChildren();
        left.replaceChildren();
        filled.replaceChildren();
        confirm.remove();
        lines.clear();
        drawSound(0);
        this.voice.hold(false);
        tracer.reset();
        hints.wipe(performance.now());
        confirm.classList.remove('is-nudged');
        screen.dataset.done = 'false';
        drawGuides(started);
      },
    });

    // ---- Ready: the whole letter is traced; the kid says "done" with the big check (ADR 0028) ----
    const confirm = kidButton({
      kind: 'action-lg',
      label: 'Done',
      html: icons.check(84),
      className: 'letters-confirm',
      onTap: () => void finish(),
    });
    const ready = () => {
      if (screen.dataset.done !== 'false') return;
      if (word) {
        void intoBox();
        return;
      }
      screen.dataset.done = 'ready';
      drawSound(0);
      stopShow();
      delete screen.dataset.nudge;
      left.replaceChildren();
      arrows.replaceChildren();
      starts.replaceChildren();
      guide(filled);
      this.ctx.sound.play('fill');
      screen.append(confirm);
      run(hints.ready(performance.now()));
    };

    // ---- Done ----
    const finish = async () => {
      if (screen.dataset.done !== 'ready') return;
      if (word) {
        await finishTheWord();
        return;
      }
      screen.dataset.done = 'saving';
      for (const id of [...lines.keys()]) endLine(id);
      this.voice.hold(false);
      confirm.remove();
      clearInterval(ticker);
      await this.saved;
      // The how-to's letter counts in the game only where the path has it open (always when capitals are the first
      // set: L leads the path, GAME_GROUPS).
      const inGame = mode === 'game' && isOpenInGame(this.path, this.progress, ch);
      this.progress = await finishLetter(this.ctx.storage, this.ctx.kid.id, ch, inGame, hints.reached);
      this.ctx.sound.play('cheer');
      // The bell first, then the letter's name and a word of praise (ADR 0032); "All by yourself!" only when no hint
      // past step 1 (the bigger dot) was needed (ADR 0037).
      void this.voice.sayFinished(ch, hints.helped);
      screen.dataset.said = ch;
      wipe.remove();
      card.append(this.badge('letters-done-star', STAR), this.badge('letters-speaker', SPEAKER));
      card.classList.add('is-done');
      if (!reducedMotion()) screen.append(confetti());
      // After the how-to, what the kid picked.
      const then = howTo?.then;
      const next = then ? null : this.nextAfter(ch, mode);
      screen.append(
        kidButton({
          kind: 'action-lg',
          label: 'Next letter',
          html: icons.more(84),
          className: 'letters-next',
          onTap: () => {
            this.tap();
            if (then) then();
            else if (next) this.showTrace(next, mode);
            else back();
          },
        }),
      );
      screen.dataset.done = 'true';
    };
    // Tapping the finished letter says it again.
    card.addEventListener('pointerup', () => {
      if (screen.dataset.done === 'true') void this.voice.say(ch);
    });

    screen.append(card, wipe);

    // ---- A word (ADR 0039): the row of boxes along the top, the picture, and the opening before the first letter ----
    if (!word) return;
    const row = boxRow(word.cells, word.inks, word.at, this.kidColor, nameOf, (c) => void this.voice.say(c));
    const smallBoxes = `${boxSize(word.cells, this.width - 2 * WORD_SIDE)}px`;
    row.row.style.setProperty('--box', smallBoxes);
    const picture = this.wordPicture(word);
    screen.append(row.row, picture);
    // Leaving a word (back, or on to the next letter) stops whatever it was saying.
    this.cleanups.push(() => this.voice.stop());
    if (word.at === 0 && word.intro) {
      // The picture fills the middle and the word is said; then it shrinks into the corner and the boxes appear.
      introOn = true;
      screen.dataset.intro = 'playing';
      picture.classList.add('is-big');
      row.row.classList.add('is-waiting');
      endIntro = () => {
        if (!introOn) return;
        introOn = false;
        endIntro = null;
        screen.dataset.intro = 'done';
        picture.classList.replace('is-big', 'is-corner');
        row.row.classList.remove('is-waiting');
        hints.touch(performance.now());
        void this.voice.say(ch);
      };
      void (async () => {
        const said = this.voice.sayNow(this.wordOpening(word));
        await Promise.all([wait(INTRO_MIN_MS), Promise.race([said, wait(INTRO_MAX_MS)])]);
        if (screen.isConnected) endIntro?.();
      })();
    } else {
      picture.classList.add('is-corner');
      // "Now the next letter." the first few times, then the letter as the setting asks.
      const due = word.at > 0 && (this.progress.nextSaid ?? 0) < NEXT_LETTER_TIMES;
      if (due) {
        this.progress.nextSaid = (this.progress.nextSaid ?? 0) + 1;
        this.saved = this.saved.then(() => noteNextSaid(storage, kid.id)).catch(() => undefined);
        screen.dataset.nextSaid = 'true';
      }
      void this.voice.say(ch, due ? [narratorClip('word-next-letter')] : []);
    }

    /** The letter is traced: the chime, and the kid's own line drops into its box; then the next letter or the end. */
    const intoBox = async () => {
      screen.dataset.done = 'dropping';
      for (const id of [...lines.keys()]) endLine(id);
      drawSound(0);
      this.voice.hold(false);
      stopShow();
      delete screen.dataset.nudge;
      left.replaceChildren();
      arrows.replaceChildren();
      starts.replaceChildren();
      guide(filled);
      if (this.voice.on) this.ctx.sound.play('chime');
      const markup = ink.innerHTML;
      // The letter counts like one traced on its own: its star and how much help it needed.
      const step = hints.reached;
      this.saved = this.saved
        .then(async () => {
          this.progress = await finishLetter(storage, kid.id, ch, false, step);
        })
        .catch(() => undefined);
      await dropInto(screen, svg, markup, this.kidColor, row.boxes[word.at], reducedMotion());
      if (!screen.isConnected) return;
      row.fill(word.at, markup);
      const next: WordTurn = { ...word, at: word.at + 1, inks: [...word.inks, markup], intro: false };
      if (next.at < word.letters.length) {
        await wait(LETTER_GAP_MS);
        if (screen.isConnected) this.showTrace(next.letters[next.at], 'words', undefined, next);
        return;
      }
      // The whole word: the boxes grow to the middle, the word is said slowly as each box lights, then the check.
      screen.dataset.wordAt = String(next.at);
      screen.dataset.done = 'saying';
      card.remove();
      wipe.remove();
      row.row.style.setProperty('--box', `${boxSize(word.cells, this.width - 160, BOX_MAX_DONE)}px`);
      row.row.classList.add('is-big');
      await wait(reducedMotion() ? 0 : GROW_MS);
      await this.sayWordSlowly(word, row.boxes);
      if (!screen.isConnected) return;
      light(row.boxes, -1);
      screen.dataset.done = 'ready';
      screen.append(confirm);
      run(hints.ready(performance.now()));
    };

    /** The check: the cheer and "You wrote a word!", the picture back big with a bounce, and the word's star. */
    const finishTheWord = async () => {
      screen.dataset.done = 'saving';
      confirm.remove();
      clearInterval(ticker);
      await this.saved;
      this.progress = await finishWord(storage, kid.id, wordKey(word.id));
      this.ctx.sound.play('cheer');
      void this.voice.sayNow(this.wordCheer(word));
      row.row.classList.remove('is-big');
      row.row.style.setProperty('--box', smallBoxes);
      picture.classList.replace('is-corner', 'is-big');
      picture.classList.add('is-after', 'is-bounce');
      picture.append(this.badge('letters-done-star', STAR));
      if (!reducedMotion()) screen.append(confetti());
      const after = nextWord(word.id, this.wordOrder);
      screen.append(
        kidButton({
          kind: 'action-lg',
          label: 'Next word',
          html: icons.more(84),
          className: 'letters-next',
          onTap: () => {
            this.tap();
            if (after) void this.openWord(after);
            else this.showWords();
          },
        }),
      );
      screen.dataset.done = 'true';
    };
  }

  // ---- Words (ADR 0039) ----

  /**
   * The word tiles: the kid's own name first (with their badge and photo), then the family's words (their photo, or
   * their letters), then the built-in words, all open.
   */
  private showWords(): void {
    const screen = this.screen('letters-words', () => this.showStart());
    const grid = el('div', 'words-grid', { role: 'group', 'aria-label': 'Words' });
    // Five tiles a row; six once more than 25 tiles would need a sixth row of five.
    const count = this.wordOrder.length;
    const cols = count > 25 ? 6 : 5;
    grid.style.setProperty('--cols', String(cols));
    grid.style.setProperty('--rows', String(Math.max(5, Math.ceil(count / cols))));
    const stars = new Set(this.progress.words ?? []);
    const tile = (id: string, label: string, content: string | HTMLElement) => {
      const starred = stars.has(wordKey(id));
      const b = kidButton({
        kind: 'paper',
        label: label + (starred ? ', has a star' : ''),
        className: 'words-tile',
        onTap: () => void this.openWord(id),
      });
      b.dataset.word = id === NAME ? 'name' : id;
      if (typeof content === 'string') b.innerHTML = content;
      else b.append(content);
      if (starred) b.append(this.badge('letters-star', STAR));
      grid.append(b);
    };
    if (this.nameCells.length > 0) tile(NAME, 'My name', avatarEl(this.ctx.kid, this.photoUrl, 64));
    for (const w of this.family) tile(w.id, `Family word ${w.text}`, this.familyPicture(w, 14));
    for (const w of BUILT_IN_WORDS) tile(w.id, `Word ${w.id}`, wordLettersMarkup(lettersIn(wordCells(w.id, this.prefs.sets))));
    screen.append(grid);
  }

  /** The kid's name as boxes, from the profile (ADR 0039); empty when the kid has no name. */
  private get nameCells(): Cell[] {
    return nameCells(this.ctx.kid.name ?? '', this.prefs.sets.includes('small'));
  }

  /** Every word tile's id in order: the name (when the kid has one), the family words, the built-in words. */
  private get wordOrder(): string[] {
    return wordOrder(
      this.family.map((w) => w.id),
      this.nameCells.length > 0,
    );
  }

  private familyWord(id: string): FamilyWordFiles | undefined {
    return this.family.find((w) => w.id === id);
  }

  /** A family word's boxes: its letters, following the kid's sets (ADR 0039). */
  private familyCells(word: FamilyWordFiles): Cell[] {
    return familyCells(word.text, this.prefs.sets.includes('small'));
  }

  /** A family word's tile or picture: its photo, or without one its letters drawn in ink. */
  private familyPicture(word: FamilyWordFiles, width: number): string | HTMLElement {
    const url = this.familyPhotos.get(word.id);
    if (!url) return wordLettersMarkup(cellLetters(this.familyCells(word)), width);
    const img = el('img', 'words-photo', { alt: '', draggable: 'false' });
    img.src = url;
    return img;
  }

  /** A word tile tapped: the first-time how-to first when it is due, then the word. */
  private async openWord(id: string): Promise<void> {
    if (this.howToDue) {
      this.howToDue = false;
      this.showTrace(HOWTO_LETTER, 'words', { then: () => void this.startWord(id) });
      return;
    }
    await this.startWord(id);
  }

  private async startWord(id: string): Promise<void> {
    const family = this.familyWord(id);
    const cells = id === NAME ? this.nameCells : family ? this.familyCells(family) : wordCells(id, this.prefs.sets);
    const letters = lettersIn(cells);
    if (letters.length === 0) return this.showWords();
    const recording =
      id === NAME
        ? await findNameRecording(this.ctx.storage, this.ctx.kid.id).catch(() => undefined)
        : family?.recording;
    this.showTrace(letters[0], 'words', undefined, { id, cells, letters, at: 0, inks: [], intro: true, recording });
  }

  /**
   * A word's picture: the kid's badge and photo for their name, a family word's photo (or its letters without one);
   * for now a built-in word's letters (part 2: pictures).
   */
  private wordPicture(word: WordTurn): HTMLElement {
    const picture = el('div', 'words-picture', { 'aria-hidden': 'true' });
    const family = this.familyWord(word.id);
    if (word.id === NAME) picture.append(avatarEl(this.ctx.kid, this.photoUrl, 120));
    else if (family && this.familyPhotos.has(family.id)) picture.append(this.familyPicture(family, 16));
    // Drawn from the glyphs' own paths (letters A to Z only), never from typed text.
    else picture.innerHTML = wordLettersMarkup(cellLetters(word.cells), 16);
    return picture;
  }

  /**
   * A family word the narrator has its own clip for (one of the spare words, ADR 0039: mom, dad, car…), by that
   * clip's word; never otherwise. The word is only looked up among the shipped clips, never sent anywhere.
   */
  private spareWord(word: WordTurn): string | undefined {
    if (word.cells.some((c) => 'gap' in c)) return undefined;
    const plain = word.letters.join('').toLowerCase();
    return narratorClip(`word-${plain}`) ? plain : undefined;
  }

  /**
   * What is said as a word opens: the word; for the name, "Let's write your name." and the parent's recording; for a
   * family word, "Let's write a word." and its recording, or the narrator's own clip of it, or "Let's write a word.".
   */
  private wordOpening(word: WordTurn): Part[] {
    const own: Part[] = word.recording ? [{ own: word.recording }] : [];
    if (word.id === NAME) return [...narrator('word-your-name'), ...own];
    if (this.familyWord(word.id)) {
      const spare = this.spareWord(word);
      if (!word.recording && spare) return narrator(`word-${spare}`);
      return [...narrator('word-lets-write'), ...own];
    }
    return narrator(`word-${word.id}`);
  }

  /**
   * What is said after the check: "You wrote a word!"; for the name, the parent's recording or "You wrote your
   * name!"; for a family word, its recording or "You wrote a word!".
   */
  private wordCheer(word: WordTurn): Part[] {
    if (word.id === NAME) return word.recording ? [{ own: word.recording }] : narrator('praise-your-name');
    if (word.recording) return [{ own: word.recording }];
    return narrator('praise-a-word');
  }

  /**
   * The word said slowly with each box lighting as its sound passes, then said normally (ADR 0039). The slow take is
   * one clip, so the boxes light evenly through it; a word with none says its letters' sounds, a box for each. The
   * name has the parent's recording, or the boxes light with nothing said; a family word has its recording, or else
   * is said like a built-in word (a spare word's slow take, or its letters' sounds).
   */
  private async sayWordSlowly(word: WordTurn, boxes: HTMLElement[]): Promise<void> {
    const n = boxes.length;
    let parts: Part[] = [];
    let even = true;
    const family = !!this.familyWord(word.id);
    if (word.id === NAME || (family && word.recording)) {
      // The parent's recording, the boxes lighting evenly through it (or with nothing said, for a name without one).
      if (word.recording) parts = [{ own: word.recording }];
    } else {
      // A family word without a recording: a spare word's own slow take and clip when it has them, else its sounds.
      const said = family ? this.spareWord(word) : word.id;
      const slow = said ? slowClipId(said) : undefined;
      const slowClip = slow ? narratorClip(slow) : undefined;
      even = !!slowClip;
      const sounds = word.letters.map((ch) => soundClip(ch)).filter((c): c is string => !!c);
      parts = [...(slowClip ? [{ clip: slowClip }] : sounds.map((clip) => ({ clip }))), ...(said ? narrator(`word-${said}`) : [])];
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const stopTimers = () => {
      for (const t of timers.splice(0)) clearTimeout(t);
    };
    if (!this.voice.on || parts.length === 0) {
      for (let i = 0; i < n; i++) {
        light(boxes, i);
        await wait(SILENT_LIGHT_MS);
      }
    } else {
      const said = this.voice.sayNow(parts, (i, audio) => {
        stopTimers();
        if (even && i === 0) {
          // One clip for the whole slow word: the boxes light evenly through it.
          light(boxes, 0);
          const spread = () => {
            const secs = audio?.duration;
            const ms = secs && Number.isFinite(secs) && secs > 0 ? secs * 1000 : n * SILENT_LIGHT_MS;
            for (let j = 1; j < n; j++) timers.push(setTimeout(() => light(boxes, j), (j * ms) / n));
          };
          if (audio && !(audio.duration > 0)) audio.addEventListener('loadedmetadata', spread, { once: true });
          else spread();
        } else if (!even && i < n) light(boxes, i);
        else light(boxes, 'all');
      });
      await Promise.race([said, wait(SLOW_MAX_MS)]);
      stopTimers();
    }
    light(boxes, 'all');
    await wait(SILENT_LIGHT_MS);
  }

  /** What the next arrow leads to: the next letter of the set in practice; the newly opened one in the game. */
  private nextAfter(ch: string, mode: Mode): string | null {
    if (mode === 'practice') return nextInSet(ch);
    const path = this.path;
    const at = gameIndex(path, this.progress);
    return at < path.length ? path[at] : null;
  }
}

/** A narrator clip by name (`word-sun`) as a line's one part, or none when it isn't shipped. */
function narrator(name: string): Part[] {
  const clip = narratorClip(name);
  return clip ? [{ clip }] : [];
}

/** A little confetti over the finished letter. Left out when the computer asks for less motion. */
function confetti(): HTMLElement {
  const box = el('div', 'letters-confetti', { 'aria-hidden': 'true' });
  const colors = ['#ff70a6', '#4cc9f0', '#ffd23f', '#2fa35f', '#9b5de5', '#ff8a1f'];
  for (let i = 0; i < 28; i++) {
    const bit = el('i');
    bit.style.left = `${(i * 37) % 100}%`;
    bit.style.background = colors[i % colors.length];
    bit.style.animationDelay = `${(i % 7) * 70}ms`;
    bit.style.setProperty('--spin', `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`);
    box.append(bit);
  }
  setTimeout(() => box.remove(), 2200);
  return box;
}

