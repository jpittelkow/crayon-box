// The parent area's Updates screen (ADR 0009, milestone 2 phase E): the version, a newer one with its notes, and
// *Install and restart*. Shown only in the Windows app, where there is an updater. Problems are said in words.
import { loadUpdateSettings, saveUpdateSettings, type UpdateController, type UpdateState } from '../shell/updates';
import type { GameStorage } from '../storage/types';
import { button, card, h, switchRow } from '../ui/parent';

/** Draws the screen into `main` and keeps it current. Returns the way to stop listening. */
export async function renderUpdates(main: HTMLElement, updates: UpdateController, shell: GameStorage): Promise<() => void> {
  const version = await updates.currentVersion().catch(() => 'unknown');
  const settings = await loadUpdateSettings(shell);

  const status = h('div', { style: 'display: flex; flex-direction: column; gap: 14px', 'data-update-state': '' });
  // For screen readers only: the card already shows the same thing.
  const live = h('p', { class: 'pw-sr-only', role: 'status' });

  const draw = (state: UpdateState) => {
    status.dataset.updateState = state.kind;
    status.replaceChildren(...view(state, updates));
    live.textContent = announce(state);
  };

  main.append(
    h('h1', {}, 'Updates'),
    card(
      h('h2', {}, 'This app'),
      h('p', {}, `Version ${version}`),
      status,
      live,
    ),
    card(
      h('h2', {}, 'Checking'),
      switchRow(
        'Check for updates when the app starts',
        'A new version is only shown here, never on the kids’ screens. Nothing installs until you choose it.',
        settings.checkOnStart,
        (on) => void saveUpdateSettings(shell, { checkOnStart: on }),
      ),
      h(
        'p',
        { class: 'pw-muted' },
        'Updates come from the app’s releases page on GitHub. Each one is signed, and the app refuses a download whose signature doesn’t match.',
      ),
    ),
  );

  draw(updates.state);
  return updates.subscribe(draw);
}

function view(state: UpdateState, updates: UpdateController): Node[] {
  const check = (label: string) => button(label, () => void updates.check());
  switch (state.kind) {
    case 'idle':
      return [h('p', {}, 'Not checked yet.'), row(check('Check now'))];
    case 'checking':
      return [h('p', {}, 'Checking for a newer version…')];
    case 'upToDate':
      return [
        h('p', {}, `This is the newest version. Checked at ${state.checkedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`),
        row(check('Check again')),
      ];
    case 'available':
      return [
        h('h2', {}, `Version ${state.version} is ready`),
        state.date ? h('p', { class: 'pw-muted' }, `Released ${formatDate(state.date)}.`) : null,
        state.notes ? h('div', { class: 'pw-notes', 'aria-label': 'What’s new' }, state.notes) : null,
        h(
          'p',
          { class: 'pw-muted' },
          'The app closes for a moment while it installs, then opens again on the kid picker. Pictures and settings are kept.',
        ),
        row(button('Install and restart', () => void updates.install(), 'primary')),
      ].filter((n): n is HTMLElement => !!n);
    case 'installing': {
      const bar = h('progress', { class: 'pw-progress', max: '1', 'aria-label': `Downloading version ${state.version}` });
      if (state.progress !== null) bar.value = state.progress;
      const words =
        state.progress === null || state.progress < 1
          ? `Downloading version ${state.version}${state.progress === null ? '…' : ` (${Math.round(state.progress * 100)} %)`}`
          : `Installing version ${state.version}…`;
      return [h('p', {}, words), bar, h('p', { class: 'pw-muted' }, 'Please don’t close the app.')];
    }
    case 'restarting':
      return [h('p', {}, `Version ${state.version} is installed. The app is restarting…`)];
    case 'failed':
      if (state.during === 'check') {
        return [
          h('p', {}, 'Couldn’t reach the releases page. Check that the laptop is online, then try again.'),
          h('p', { class: 'pw-muted' }, `Details: ${state.detail}`),
          row(check('Try again')),
        ];
      }
      return [
        h('p', {}, 'The update didn’t install. Nothing was changed; this version keeps working.'),
        h('p', { class: 'pw-muted' }, `Details: ${state.detail}`),
        row(
          updates.canRetryInstall ? button('Try installing again', () => void updates.retryInstall(), 'primary') : null,
          check('Check again'),
        ),
      ];
  }
}

/** One short line for screen readers when the state changes. */
function announce(state: UpdateState): string {
  switch (state.kind) {
    case 'available':
      return `Version ${state.version} is available.`;
    case 'upToDate':
      return 'No update. This is the newest version.';
    case 'restarting':
      return 'Restarting.';
    case 'failed':
      return state.during === 'check' ? 'The check failed.' : 'The update failed.';
    default:
      return '';
  }
}

function row(...buttons: (HTMLElement | null)[]): HTMLElement {
  return h('div', { class: 'pw-row' }, ...buttons);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
}
