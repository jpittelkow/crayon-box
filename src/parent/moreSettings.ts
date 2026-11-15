// Settings cards for sounds and the parent gate PIN (ADR 0008, 0016). Each setting has its own file, so a change
// on one device never overwrites another setting changed elsewhere (ADR 0024).
import { loadSoundSettings, saveSoundSettings } from '../shell/sound';
import type { AppStorage } from '../storage/types';
import { button, card, h, switchRow } from '../ui/parent';
import { PIN_LENGTH, hashPin, isValidPin, loadGateSettings, saveGateSettings } from './gatePin';

export async function moreSettingsCards(storage: AppStorage): Promise<HTMLElement[]> {
  const sounds = await loadSoundSettings(storage.shell);
  const gate = await loadGateSettings(storage.shell);

  const soundCard = card(
    h('h2', {}, 'Sounds'),
    switchRow('Sounds', "One short, soft sound for each touch on the kids' screens.", sounds.on, (on) => {
      void saveSoundSettings(storage.shell, { on });
    }),
  );

  // ---- PIN ----
  const pinInput = h('input', {
    class: 'pw-input',
    id: 'gate-pin',
    type: 'password',
    inputmode: 'numeric',
    autocomplete: 'off',
    maxlength: String(PIN_LENGTH),
    'aria-describedby': 'gate-pin-status',
  });
  const status = h('p', { class: 'pw-muted', id: 'gate-pin-status', role: 'status' });
  const pinRow = h(
    'div',
    { style: 'display: flex; flex-direction: column; gap: 10px' },
    h(
      'div',
      { class: 'pw-field' },
      h('label', { for: 'gate-pin' }, gate.pinHash ? 'New PIN (4 digits)' : 'PIN (4 digits)'),
      pinInput,
    ),
    h(
      'div',
      { class: 'pw-row' },
      button(
        'Save PIN',
        async () => {
          if (!isValidPin(pinInput.value)) {
            status.textContent = `The PIN is ${PIN_LENGTH} digits, 0 to 9.`;
            return;
          }
          await saveGateSettings(storage.shell, { pinHash: await hashPin(pinInput.value) });
          pinInput.value = '';
          status.textContent = 'PIN saved. The gate now asks for it instead of number words.';
        },
        'primary',
      ),
    ),
    status,
  );
  let pinOn = !!gate.pinHash;
  pinRow.hidden = !pinOn;

  const gateCard = card(
    h('h2', {}, 'Parent gate'),
    switchRow(
      'Use a PIN instead of number words',
      'For when one of the kids can read. Until then the gate shows three number words to tap.',
      pinOn,
      (on) => {
        pinOn = on;
        pinRow.hidden = !on;
        status.textContent = '';
        if (!on) {
          // Turning it off removes the PIN; the gate goes back to number words.
          void saveGateSettings(storage.shell, {});
        } else {
          pinInput.focus();
        }
      },
    ),
    pinRow,
  );

  return [soundCard, gateCard];
}
