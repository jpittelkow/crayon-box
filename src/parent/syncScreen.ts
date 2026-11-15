// The parent area's Family sync screen (ADR 0024, milestone 2 phase C2): connect this device to the family server
// with its address and pairing code, see when it last synced and any problem in words, sync now, or disconnect.
import type { SyncService, SyncSettings } from '../sync/service';
import { button, card, h } from '../ui/parent';

function when(ms: number): string {
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return sameDay ? `today at ${time}` : `${d.toLocaleDateString([], { month: 'long', day: 'numeric' })} at ${time}`;
}

export async function renderSync(main: HTMLElement, sync: SyncService): Promise<() => void> {
  const body = h('div', { style: 'display: contents' });
  main.append(h('h1', {}, 'Family sync'), body);

  // The form is drawn once and left alone while it shows: background rounds (every few minutes, even when not set
  // up) must not wipe what a parent is typing or the problem it was told.
  let showingForm = false;
  const draw = (s: SyncSettings, busy: boolean) => {
    if (s.server && s.token) {
      showingForm = false;
      body.replaceChildren(connected(s, busy));
    } else if (!showingForm) {
      showingForm = true;
      body.replaceChildren(connectForm());
    }
  };

  const connected = (s: SyncSettings, busy: boolean) => {
    const status = busy ? 'Syncing…' : s.lastSync ? `Last synced ${when(s.lastSync)}.` : 'Not synced yet.';
    return card(
      h('h2', {}, 'Connected'),
      h('p', {}, `This device syncs with the family server at ${s.server}.`),
      h('p', { role: 'status', 'data-sync-status': busy ? 'busy' : s.problem ? 'problem' : 'ok' }, status),
      s.problem ? h('p', { class: 'pw-problem', role: 'alert' }, s.problem) : null,
      h(
        'div',
        { class: 'pw-row' },
        button('Sync now', () => void sync.syncNow(), 'primary'),
        button('Disconnect', () => void sync.disconnect(), 'danger'),
      ),
      h(
        'p',
        { class: 'pw-muted' },
        'Disconnecting keeps everything on this device; it just stops syncing. Syncing runs by itself every few minutes, never on the kids’ screens.',
      ),
    );
  };

  const connectForm = () => {
    const serverInput = h('input', { class: 'pw-input', id: 'sync-server', type: 'text', inputmode: 'url', autocomplete: 'off', placeholder: '192.168.1.20:8787' });
    const codeInput = h('input', { class: 'pw-input', id: 'sync-code', type: 'text', autocomplete: 'off', placeholder: 'ABCD-EFGH' });
    const status = h('p', { class: 'pw-muted', id: 'sync-connect-status', role: 'status' });
    const go = button(
      'Connect',
      async () => {
        if (!serverInput.value.trim() || !codeInput.value.trim()) {
          status.textContent = 'Enter the server’s address and its pairing code.';
          return;
        }
        go.disabled = true;
        status.textContent = 'Connecting…';
        try {
          await sync.connect(serverInput.value, codeInput.value);
        } catch (err) {
          status.textContent = err instanceof Error ? err.message : String(err);
          go.disabled = false;
        }
      },
      'primary',
    );
    return card(
      h('h2', {}, 'Connect to the family server'),
      h(
        'p',
        { class: 'pw-muted' },
        'Keeps the kids, their settings and their pictures the same on every device, through a small server at home. Without one, this device keeps everything to itself.',
      ),
      h('div', { class: 'pw-field' }, h('label', { for: 'sync-server' }, 'Server address'), serverInput),
      h('div', { class: 'pw-field' }, h('label', { for: 'sync-code' }, 'Pairing code (on the server’s page)'), codeInput),
      h('div', { class: 'pw-row' }, go),
      status,
      h('p', { class: 'pw-muted' }, 'Setting up the server: see server/README.md in the app’s GitHub repository.'),
    );
  };

  draw(await sync.settings(), sync.busy);
  return sync.subscribe(draw);
}

/** The one-time question at the top of Settings (ADR 0024): "Do you have a family server?" */
export function firstRunCard(sync: SyncService, openSync: () => void): HTMLElement {
  const el = card(
    h('h2', {}, 'Do you have a family server?'),
    h(
      'p',
      { class: 'pw-muted' },
      'With one, the kids’ profiles, settings and pictures follow them to every device, and come back on a new laptop. You can set it up later under Family sync.',
    ),
    h(
      'div',
      { class: 'pw-row' },
      button('Set up sync', openSync, 'primary'),
      button('Not now', () => {
        void sync.notNow();
        el.remove();
      }),
    ),
  );
  el.dataset.firstRun = 'sync';
  return el;
}
