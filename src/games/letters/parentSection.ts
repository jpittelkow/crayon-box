// The letters game's screen in the parent area (ADR 0008, 0012, 0026): each kid's letter sets and stroke order,
// resetting a kid's stars and game, the voice that says the letters (with recording), and sounds.
import { drawAvatar } from '../../shell/profiles';
import type { ParentSectionContext } from '../../shell/types';
import { button, card, confirmInline, h, segmented, switchRow } from '../../ui/parent';
import { allChars, SET_ORDER, type SetId } from './glyphs';
import {
  deleteRecording,
  findRecording,
  keyOf,
  loadLettersSettings,
  loadPrefs,
  resetProgress,
  saveLettersSettings,
  savePrefs,
  saveRecording,
  VOICE_DIR,
  type Voice,
} from './progress';
import { recordClip } from './voice';

const SET_LABELS: Record<SetId, string> = { capitals: 'A B C', small: 'a b c', numbers: '1 2 3' };
const SET_NAMES: Record<SetId, string> = { capitals: 'Capital letters', small: 'Small letters', numbers: 'Numbers' };

export async function renderLetters(el: HTMLElement, ctx: ParentSectionContext): Promise<void> {
  const { storage } = ctx;
  const rows = h('div', { style: 'display: flex; flex-direction: column; gap: 6px' });
  for (const kid of ctx.kids) {
    const prefs = await loadPrefs(storage, kid.id);
    const label = ctx.kidLabel(kid);
    const dot = h('span', { class: 'pw-avatar', style: 'width: 44px; height: 44px', 'aria-hidden': 'true' });
    drawAvatar(dot, kid, undefined, 24);

    const sets = h('div', { class: 'pw-seg', role: 'group', 'aria-label': `Letter sets for ${label}` });
    const setButtons = SET_ORDER.map((set) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(prefs.sets.includes(set)), title: SET_NAMES[set] }, SET_LABELS[set]);
      b.addEventListener('click', () => {
        const on = new Set(setButtons.filter((x) => x.getAttribute('aria-pressed') === 'true').map((x) => x.dataset.set as SetId));
        if (on.has(set)) on.delete(set);
        else on.add(set);
        if (on.size === 0) return; // a kid always has one set
        for (const x of setButtons) x.setAttribute('aria-pressed', String(on.has(x.dataset.set as SetId)));
        prefs.sets = SET_ORDER.filter((s) => on.has(s));
        void savePrefs(storage, kid.id, prefs);
      });
      b.dataset.set = set;
      return b;
    });
    sets.append(...setButtons);

    const order = segmented<'any' | 'order'>(
      `How tracing counts for ${label}`,
      [
        ['any', 'Any way'],
        ['order', 'Stroke order'],
      ],
      prefs.ordered ? 'order' : 'any',
      (v) => {
        prefs.ordered = v === 'order';
        void savePrefs(storage, kid.id, prefs);
      },
    );

    const row = h('div', { class: 'pw-row', 'data-kid': kid.id, style: 'flex-wrap: wrap' });
    const reset = button('Reset stars and game', () =>
      confirmInline(row, `Reset ${label}'s stars and game? This can't be undone.`, 'Reset', async () => {
        await resetProgress(storage, kid.id);
        el.replaceChildren();
        await renderLetters(el, ctx);
      }),
    );
    row.append(dot, h('span', { style: 'min-width: 110px; font-weight: 700' }, label), sets, order, h('div', { class: 'pw-grow' }), reset);
    rows.append(row);
  }

  const settings = await loadLettersSettings(storage);
  const recorder = await recordingGrid(ctx);
  recorder.hidden = settings.voice !== 'own';
  el.append(
    h('p', { class: 'pw-muted' }, 'Tracing letters with a finger or a pen. Turn it on or off for the kids under Settings, Games.'),
    card(
      h('h2', {}, 'What each kid traces'),
      h(
        'p',
        { class: 'pw-muted' },
        'Any way: any order and direction counts. Stroke order: each stroke from its start dot, in turn. ' +
          'Practice has every turned-on letter open; the game opens them one at a time, in this order.',
      ),
      rows,
    ),
    card(
      h('h2', {}, 'The voice that says the letters'),
      segmented<Voice>(
        'Letter voice',
        [
          ['windows', "The app's voice"],
          ['own', 'Your own voice'],
        ],
        settings.voice,
        (voice) => {
          settings.voice = voice;
          recorder.hidden = voice !== 'own';
          void saveLettersSettings(storage, settings);
        },
      ),
      recorder,
    ),
    card(
      switchRow('Sounds', "The letter's name, and the cheer and a word of praise when a letter is done.", settings.sounds, (on) => {
        settings.sounds = on;
        void saveLettersSettings(storage, settings);
      }),
    ),
  );
}

/** One cell per letter: record (about a second and a half), play it back, or remove it. */
async function recordingGrid(ctx: ParentSectionContext): Promise<HTMLElement> {
  const { storage } = ctx;
  const recorded = new Set((await storage.list(VOICE_DIR)).map((p) => p.slice(VOICE_DIR.length).replace(/\.[a-z0-9]+$/, '')));
  const status = h('p', { class: 'pw-muted', 'aria-live': 'polite' });
  const count = () => `${recorded.size} of ${allChars().length} recorded. Letters without a recording use the app's voice.`;
  status.textContent = count();
  const grid = h('div', {
    style: 'display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; max-height: 320px; overflow: auto',
  });
  let busy = false;
  for (const ch of allChars()) {
    const key = keyOf(ch);
    const cell = h('div', { class: 'pw-row', style: 'gap: 6px; padding: 4px 8px; border: 1px solid #d3d9e0; border-radius: 10px' });
    const draw = () => {
      const has = recorded.has(key);
      cell.replaceChildren(
        h('span', { style: 'min-width: 28px; font-weight: 700; font-size: 20px' }, ch),
        button(has ? 'Again' : 'Record', () => void record()),
        ...(has ? [button('Play', () => void play()), button('Remove', () => void remove())] : []),
      );
    };
    const record = async () => {
      if (busy) return;
      busy = true;
      status.textContent = `Recording ${ch}… say it now.`;
      try {
        await saveRecording(storage, ch, await recordClip());
        recorded.add(key);
        status.textContent = count();
      } catch {
        status.textContent = 'No microphone could be used. Check that one is plugged in and allowed.';
      } finally {
        busy = false;
        draw();
      }
    };
    const play = async () => {
      const path = await findRecording(storage, ch);
      const blob = path ? await storage.getBlob(path) : undefined;
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.addEventListener('ended', () => URL.revokeObjectURL(url));
      void audio.play().catch(() => URL.revokeObjectURL(url));
    };
    const remove = async () => {
      await deleteRecording(storage, ch);
      recorded.delete(key);
      status.textContent = count();
      draw();
    };
    draw();
    grid.append(cell);
  }
  return h('div', { style: 'display: flex; flex-direction: column; gap: 10px' }, status, grid);
}
