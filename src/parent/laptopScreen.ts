// The parent area's "This laptop" screen (ADR 0014, milestone 2 phase D), Windows app only: Quit, the kiosk lock's
// switches, start at sign-in, and the one-time laptop setup guide. These settings stay on this laptop.
import type { KioskControl } from '../shell/kiosk';
import type { GameStorage } from '../storage/types';
import { button, card, h, switchRow } from '../ui/parent';

export async function renderLaptop(main: HTMLElement, kiosk: KioskControl, shell: GameStorage, quit: () => void): Promise<void> {
  const settings = kiosk.current;
  const startOn = await kiosk.startAtSignIn().catch(() => false);
  const startStatus = h('p', { class: 'pw-muted', role: 'status' });

  main.append(
    h('h1', {}, 'This laptop'),
    card(
      h('h2', {}, 'Quit'),
      h('p', {}, 'Closes the app. Anything open is saved first. From the kids’ screens, Ctrl+Shift+Q does the same.'),
      h('div', { class: 'pw-row' }, button('Quit the app', quit, 'danger')),
    ),
    card(
      h('h2', {}, 'Lock'),
      h('p', { class: 'pw-muted' }, 'These stay on this laptop. The parent area is never locked.'),
      switchRow(
        'Keep the app full screen',
        'It can’t be resized, minimized or closed except from here. Off: an ordinary window with a close button.',
        settings.keepFullScreen,
        (on) => void kiosk.update(shell, { keepFullScreen: on }),
      ),
      switchRow(
        'Lock the keyboard',
        'On the kids’ screens only Ctrl+Shift+Q works (the arrows, W A S D and space too, in the driving game). If your antivirus warns about the app watching the keyboard, turn this off.',
        settings.lockKeyboard,
        (on) => void kiosk.update(shell, { lockKeyboard: on }),
      ),
      switchRow(
        'Start when Windows starts',
        'Opens the app when this Windows account signs in. Best in the kids’ own account (see the setup below).',
        startOn,
        (on) => {
          kiosk.setStartAtSignIn(on).then(
            () => (startStatus.textContent = on ? 'The app will start at sign-in.' : 'The app won’t start by itself.'),
            () => (startStatus.textContent = 'Windows didn’t allow that. Try again, or add the app to Startup apps in Settings.'),
          );
        },
      ),
      startStatus,
    ),
    setupGuide(),
  );
}

/** The laptop setup a parent does once (ADR 0014): the Windows settings the app can't change itself. */
export function setupGuide(): HTMLElement {
  const step = (title: string, text: string) => h('li', {}, h('strong', {}, title), ' ', text);
  return card(
    h('h2', {}, 'Setting up the laptop'),
    h('p', { class: 'pw-muted' }, 'Windows settings the app can’t change itself. Do these once.'),
    h(
      'ol',
      { class: 'pw-steps' },
      step(
        'A Windows account for the kids.',
        'A standard account, not an administrator, with the app installed there and “Start when Windows starts” on. If a kid ever gets out of the app, they land in an empty account, not your files and email.',
      ),
      step(
        'Turn off touch gestures.',
        'Settings › Bluetooth & devices › Touch: turn off three- and four-finger gestures, so a hand on the screen can’t open task view or show the desktop.',
      ),
      step('Turn off touchpad gestures.', 'Settings › Bluetooth & devices › Touchpad: turn off three- and four-finger gestures.'),
      step('Turn on Do not disturb', 'in the kids’ account, so notifications don’t pop up over the app.'),
      step(
        'Edge swipes.',
        'Full screen already stops most swipes from the screen edges. If the kids still open things that way, Windows’ edge swipe can be turned off with the “Allow edge swipe” policy.',
      ),
      step(
        'What no app can block.',
        'Ctrl+Alt+Del always works, so a grown-up can always get out. Win+L locks the screen; sign back in and the app is still there.',
      ),
    ),
  );
}
