// Parent world building blocks (ADR 0016 rule 8). Fonts are bundled, never loaded from the network (ADR 0016).
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './parent.css';

type Child = Node | string | null | undefined | false;

/** Creates an element with attributes and children. Text children are set as text, never as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') node.className = String(v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

export type ButtonKind = 'default' | 'primary' | 'danger' | 'danger-solid';

export function button(label: string, onClick: () => void, kind: ButtonKind = 'default'): HTMLButtonElement {
  const b = h('button', { type: 'button', class: kind === 'default' ? 'pw-btn' : `pw-btn pw-btn--${kind}` }, label);
  b.addEventListener('click', onClick);
  return b;
}

/**
 * A "working on it" panel for something slow (the AI page maker, playtest of 2026-11-15: with only a line of grey
 * text, a parent took a running request for a frozen screen). A spinner, what is happening, the seconds so far,
 * and a moving bar. Hidden until `start`.
 */
export function working(): { el: HTMLElement; start(text: string): void; stop(): void } {
  const text = h('span', { class: 'pw-working-text' });
  const time = h('span', { class: 'pw-working-time', 'aria-hidden': 'true' });
  const el = h(
    'div',
    { class: 'pw-working', role: 'status', 'aria-live': 'polite', 'data-working': '', hidden: true },
    h('span', { class: 'pw-spinner', 'aria-hidden': 'true' }),
    h('div', { class: 'pw-working-body' }, h('div', { class: 'pw-working-line' }, text, time), h('div', { class: 'pw-working-bar', 'aria-hidden': 'true' }, h('span', {}))),
  );
  let timer = 0;
  return {
    el,
    start(what) {
      text.textContent = what;
      const began = Date.now();
      const tick = () => {
        const s = Math.floor((Date.now() - began) / 1000);
        time.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      };
      tick();
      clearInterval(timer);
      timer = window.setInterval(tick, 1000);
      el.hidden = false;
      el.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    },
    stop() {
      clearInterval(timer);
      el.hidden = true;
    },
  };
}

export function card(...children: Child[]): HTMLElement {
  return h('section', { class: 'pw-card' }, ...children);
}

export function switchRow(
  label: string,
  help: string | null,
  checked: boolean,
  onChange: (on: boolean) => void,
): HTMLLabelElement {
  const input = h('input', { type: 'checkbox', role: 'switch', class: 'pw-switch' });
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'pw-switch-row' }, input, h('span', {}, label, help && h('span', { class: 'pw-muted' }, help)));
}

export function segmented<T extends string>(
  groupLabel: string,
  options: [T, string][],
  value: T,
  onChange: (v: T) => void,
): HTMLElement {
  const group = h('div', { class: 'pw-seg', role: 'group', 'aria-label': groupLabel });
  const buttons = options.map(([v, label]) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(v === value) }, label);
    b.addEventListener('click', () => {
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === b));
      onChange(v);
    });
    return b;
  });
  group.append(...buttons);
  return group;
}

/** Round picks shown as a radio group: colors, symbols. */
export function chips<T extends string>(
  groupLabel: string,
  options: { value: T; label: string; render: (chip: HTMLButtonElement) => void }[],
  value: T,
  onChange: (v: T) => void,
): HTMLElement {
  const group = h('div', { class: 'pw-chips', role: 'radiogroup', 'aria-label': groupLabel });
  const buttons = options.map((o) => {
    const b = h('button', {
      type: 'button',
      class: 'pw-chip',
      role: 'radio',
      'aria-label': o.label,
      'aria-checked': String(o.value === value),
    });
    o.render(b);
    b.addEventListener('click', () => {
      for (const other of buttons) other.setAttribute('aria-checked', String(other === b));
      onChange(o.value);
    });
    return b;
  });
  group.append(...buttons);
  return group;
}

/** A destructive action that asks once, inline, and names what happens (ADR 0016: no dialogs, words for parents). */
export function confirmInline(
  host: HTMLElement,
  question: string,
  confirmLabel: string,
  onConfirm: () => void | Promise<void>,
): void {
  const original = [...host.childNodes];
  const restore = () => host.replaceChildren(...original);
  host.replaceChildren(
    h('span', { class: 'pw-grow', style: 'font-weight: 700' }, question),
    button(confirmLabel, () => void onConfirm(), 'danger-solid'),
    button('Keep it', restore),
  );
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
