// The parent gate's second step (ADR 0008): read three number words, tap the digits. A wrong digit, or 10 seconds
// without a tap, goes back to the kid screen.
import { h } from '../ui/parent';
import { GateAttempt, newChallenge } from './gateWords';

export const GATE_IDLE_MS = 10_000;

export function gateScreen(onOpen: () => void, onFail: () => void): { el: HTMLElement; stop(): void } {
  const challenge = newChallenge();
  const attempt = new GateAttempt(challenge);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let done = false;

  const finish = (open: boolean) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    (open ? onOpen : onFail)();
  };

  const bar = h('i');
  const restartTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(() => finish(false), GATE_IDLE_MS);
    bar.getAnimations().forEach((a) => a.cancel());
    bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: GATE_IDLE_MS, fill: 'forwards' });
  };

  const dots = challenge.digits.map(() => h('i'));
  const keys = h('div', { class: 'pw-keys' });
  for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) {
    const key = h('button', { type: 'button', class: 'pw-key' }, String(d));
    key.addEventListener('click', () => {
      const result = attempt.tap(d);
      if (result === 'wrong') return finish(false);
      dots[attempt.progress - 1].classList.add('is-on');
      if (result === 'open') return finish(true);
      restartTimer();
    });
    keys.append(key);
  }

  const el = h(
    'div',
    { class: 'parent-world pw-gate-ground', 'data-screen': 'parent-gate' },
    h(
      'div',
      { class: 'pw-gate', role: 'dialog', 'aria-label': 'Parent gate' },
      h('p', { class: 'pw-muted', style: 'font-size: 17px' }, 'Grown-ups: tap these three numbers in order'),
      h('p', { class: 'pw-gate-words', 'data-words': challenge.words.join(' ') }, challenge.words.join(' · ')),
      h('div', { class: 'pw-dots', role: 'img', 'aria-label': 'Numbers entered so far' }, ...dots),
      keys,
      h('div', { class: 'pw-timer', 'aria-hidden': 'true' }, bar),
      h('p', { class: 'pw-muted' }, "A wrong number, or 10 seconds without a tap, goes back to the kids' screen."),
    ),
  );
  restartTimer();
  return {
    el,
    stop: () => {
      done = true;
      clearTimeout(timer);
    },
  };
}
