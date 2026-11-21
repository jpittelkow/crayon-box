// Building blocks for kid screens (ADR 0003, 0016).

export type KidButtonKind =
  | 'action' // rounded square, 88 px: undo, start over, back inside a rail
  | 'action-lg' // rounded square, 104 px: corner buttons
  | 'tool' // rounded square, 88 px, can be picked: bucket, brush, eraser
  | 'choice' // round, 80 px, picked from a set: sizes, modes
  | 'swatch' // round, 80 px paint color
  | 'badge-xl' // round, 220 px kid badge
  | 'paper'; // sheet of paper: a picture

const KIND_CLASSES: Record<KidButtonKind, string> = {
  action: 'cb-obj cb-action',
  'action-lg': 'cb-obj cb-action cb-action--lg',
  tool: 'cb-obj cb-action cb-tool',
  choice: 'cb-obj cb-choice',
  swatch: 'cb-obj cb-choice cb-swatch',
  'badge-xl': 'cb-obj cb-badge cb-badge--xl',
  paper: 'cb-obj cb-paper',
};

export interface KidButtonOptions {
  kind: KidButtonKind;
  /** Accessible name. Never rendered as text (ADR 0003 rule 1). */
  label: string;
  html?: string;
  className?: string;
  /** Fires when the finger lifts inside the button: actions (back, undo, start over) and everything else. */
  onTap?: () => void;
  /** Fires as the finger touches: pick buttons (tools, sizes, modes, colors; ADR 0038). */
  onPress?: () => void;
}

export function kidButton(opts: KidButtonOptions): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = KIND_CLASSES[opts.kind] + (opts.className ? ` ${opts.className}` : '');
  button.setAttribute('aria-label', opts.label);
  if (opts.html) button.innerHTML = opts.html;
  if (opts.onPress) onPress(button, opts.onPress);
  else if (opts.onTap) onTap(button, opts.onTap);
  return button;
}

/**
 * Fires `handler` as soon as a finger touches `el` (ADR 0038, superseding ADR 0003 rule 2 for pick buttons: kids
 * hold the finger down until something happens). Only the first finger on a button counts; the button looks
 * pressed until it lifts. `el` may be an SVG shape too (the colour wheel's segments), which takes the same events.
 */
export function onPress(target: HTMLElement | SVGElement, handler: () => void): void {
  const el = target as HTMLElement;
  let active: number | null = null;
  const release = (e: PointerEvent) => {
    if (e.pointerId !== active) return;
    active = null;
    el.classList.remove('is-pressed');
  };
  el.addEventListener('pointerdown', (e) => {
    if (active !== null || e.button > 0) return;
    active = e.pointerId;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events in tests may not be capturable; the press still works.
    }
    el.classList.add('is-pressed');
    handler();
  });
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('lostpointercapture', release);
}

/**
 * Fires `handler` when a press starts and ends inside `el` (ADR 0003 rule 2: buttons fire on pointer-up inside
 * the button). Only the first finger on a button counts; a finger that slides off and lifts does nothing.
 */
export function onTap(el: HTMLElement, handler: () => void): void {
  let active: number | null = null;

  const inside = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  };
  const release = () => {
    active = null;
    el.classList.remove('is-pressed');
  };

  el.addEventListener('pointerdown', (e) => {
    if (active !== null || e.button > 0) return;
    active = e.pointerId;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events in tests may not be capturable; the press still works.
    }
    el.classList.add('is-pressed');
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== active) return;
    el.classList.toggle('is-pressed', inside(e));
  });
  el.addEventListener('pointerup', (e) => {
    if (e.pointerId !== active) return;
    const fire = inside(e);
    release();
    if (fire) handler();
  });
  el.addEventListener('pointercancel', (e) => {
    if (e.pointerId === active) release();
  });
  // Keyboard and synthetic clicks are blocked app-wide (ADR 0003 rule 4), so `click` is not used.
}

/** Marks one element of a set as picked and the rest as not picked. */
export function setPicked(elements: Iterable<Element>, picked: Element | undefined): void {
  for (const el of elements) {
    const on = el === picked;
    el.classList.toggle('is-picked', on);
    el.setAttribute('aria-pressed', String(on));
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}
