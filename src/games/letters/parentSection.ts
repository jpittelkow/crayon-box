// The letters game's screen in the parent area (ADR 0008, 0012, 0026, 0037): each kid's letter sets and stroke order,
// resetting a kid's stars and game, showing a kid the first-time how-to again, a note for parents, what is said with
// a letter (its name, its sound or both), the voice that says it (with recordings of names and sounds), sounds, and
// whether the hints' tips are spoken. Words (ADR 0039): turned on per kid, a recording of each kid's name, and the
// family's own words (each with an optional recording and photo).
import { preparePhoto } from '../../parent/photo';
import { drawAvatar } from '../../shell/profiles';
import type { ParentSectionContext } from '../../shell/types';
import { button, card, confirmInline, h, segmented, switchRow } from '../../ui/parent';
import {
  cleanWordText,
  deleteFamilyPhoto,
  deleteFamilyRecording,
  deleteFamilyWord,
  hasLetters,
  loadFamilyWords,
  MAX_FAMILY_WORDS,
  MAX_WORD_LENGTH,
  newFamilyId,
  saveFamilyPhoto,
  saveFamilyRecording,
  saveFamilyWord,
  type FamilyWordFiles,
} from './familyWords';
import { allChars, SET_ORDER, type SetId } from './glyphs';
import {
  deleteNameRecording,
  deleteRecording,
  findNameRecording,
  findRecording,
  loadLettersSettings,
  loadPrefs,
  recordingKey,
  resetProgress,
  saveLettersSettings,
  saveNameRecording,
  savePrefs,
  saveRecording,
  showDemoAgain,
  VOICE_DIR,
  type Said,
  type Saying,
  type Voice,
} from './progress';
import { recordClip } from './voice';
import { cellLetters, wordLettersMarkup } from './wordView';
import { familyCells, nameCells } from './words';

/** How long a recording of a kid's name runs: a name can be longer than a letter. */
const NAME_RECORD_MS = 2200;

const SET_LABELS: Record<SetId, string> = { shapes: '○ □ △', capitals: 'A B C', small: 'a b c', numbers: '1 2 3' };
const SET_NAMES: Record<SetId, string> = {
  shapes: 'Lines and shapes',
  capitals: 'Capital letters',
  small: 'Small letters',
  numbers: 'Numbers',
};

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

    // Words (ADR 0039): off at first, turned on per kid.
    const words = h('div', { class: 'pw-seg', role: 'group', 'aria-label': `Words for ${label}` });
    const wordsButton = h('button', { type: 'button', 'aria-pressed': String(prefs.words === true), title: 'Writing words' }, 'Words');
    wordsButton.addEventListener('click', () => {
      prefs.words = wordsButton.getAttribute('aria-pressed') !== 'true';
      wordsButton.setAttribute('aria-pressed', String(prefs.words));
      void savePrefs(storage, kid.id, prefs);
    });
    words.append(wordsButton);

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

    // One kid's settings wrap onto a second line on a narrow screen; a rule keeps each kid's together.
    const row = h('div', {
      class: 'pw-row',
      'data-kid': kid.id,
      style: 'flex-wrap: wrap; row-gap: 10px; padding: 10px 0; border-bottom: 1px solid #e3e7ec',
    });
    const reset = button('Reset stars and game', () =>
      confirmInline(row, `Reset ${label}'s stars (letters and words) and game? This can't be undone.`, 'Reset', async () => {
        await resetProgress(storage, kid.id);
        el.replaceChildren();
        await renderLetters(el, ctx);
      }),
    );
    // The first-time how-to again, before this kid's next letter (ADR 0037).
    const again = button('Show how to trace again', () => {
      void showDemoAgain(storage, kid.id);
      again.disabled = true;
      again.textContent = 'Shows before the next letter';
    });
    again.dataset.howTo = kid.id;
    row.append(
      dot,
      h('span', { style: 'min-width: 110px; font-weight: 700' }, label),
      sets,
      order,
      words,
      h('div', { class: 'pw-grow' }),
      again,
      reset,
    );
    rows.append(row);
  }

  const settings = await loadLettersSettings(storage);
  const recorder = await recordingGrids(ctx);
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
      h(
        'p',
        { class: 'pw-muted' },
        '○ □ △ is lines and shapes, for the youngest: a line down, a line across, a circle, a cross, a slant, a ' +
          'square, an X and a triangle, traced like letters and before them. Off until you turn it on. In the game, ' +
          'capitals come easiest first: straight lines (L F E H T I), then curves, then slants. Practice stays A to Z.',
      ),
      rows,
    ),
    card(
      h('h2', {}, 'Writing words'),
      h(
        'p',
        { class: 'pw-muted' },
        'With Words on for a kid (above), Letters shows a third tile: their own name first, then the family words ' +
          'below, then 24 short words. Each ' +
          'letter is traced big, one at a time, and drops into a row of boxes; then the word is said slowly and the ' +
          "kid taps the check. A name comes from the kid's profile; spaces and hyphens are skipped and accents are " +
          'traced plain. Capitals, or small letters once those are on for the kid.',
      ),
      h(
        'p',
        { class: 'pw-muted' },
        "The app's voice can't say a name, so record each kid's name here. Without a recording, a finished name gets " +
          '"You wrote your name!". Recordings stay on this device and your own sync server.',
      ),
      await nameRecordings(ctx),
      h('h3', {}, 'Family words'),
      h(
        'p',
        { class: 'pw-muted' },
        `Words for every kid on this device, after their name and before the 24 words: people, pets, a favourite ` +
          `thing (up to ${MAX_FAMILY_WORDS}). Record how you say it, and add a photo for its tile if you like; ` +
          "without a photo the tile shows the word's letters. Letters A to Z are traced; spaces and hyphens are " +
          'skipped and accents traced plain. With small letters on, the letters keep the case you type. Words, ' +
          'recordings and photos stay on this device and your own sync server.',
      ),
      await familyWords(ctx),
      h(
        'p',
        { class: 'pw-muted' },
        'This gives a kid their name and the idea that a word is letters in a row; it does not teach reading by ' +
          'itself. A card with their name on it and crayons on paper help too.',
      ),
    ),
    card(
      h('h2', {}, 'Helping a kid learn'),
      h(
        'p',
        { class: 'pw-muted' },
        "Before a kid's first letter, and after 14 days without letters, the app shows how to trace: a fingertip " +
          'draws an L ("Watch me." … "Your turn!"), then the kid traces it. A touch ends it early. "Show how to trace ' +
          'again" above plays it before that kid\'s next letter.',
      ),
      h(
        'p',
        { class: 'pw-muted' },
        'Under about 3, kids learn most from a grown-up beside them: sit with the youngest, point to the green dot and ' +
          'the arrow, and trace along with them. Crayons on paper help too.',
      ),
    ),
    card(
      h('h2', {}, 'What is said with a letter'),
      h(
        'p',
        { class: 'pw-muted' },
        "When a letter opens and when it is done. Hearing a letter's name and its sound together helps a little more " +
          'than either alone; numbers always get their name.',
      ),
      segmented<Saying>(
        'What is said with a letter',
        [
          ['name', 'Its name'],
          ['name-sound', 'Name, then sound'],
          ['sound', 'Its sound'],
        ],
        settings.saying,
        (saying) => {
          settings.saying = saying;
          void saveLettersSettings(storage, settings);
        },
      ),
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
      switchRow(
        'Sounds',
        "The letter's name or sound, the crayon sound while tracing, a chime for each line, and a word of praise when " +
          'a letter is done.',
        settings.sounds,
        (on) => {
          settings.sounds = on;
          void saveLettersSettings(storage, settings);
        },
      ),
      switchRow(
        'Spoken tips',
        'When a kid is stuck, hints come one step at a time: a bigger start dot ("Start at the green dot."), a ' +
          'fingertip along the next line ("Down."), then the whole letter shown ("Your turn!"). Off, the hints are ' +
          'still shown, just not said.',
        settings.tips,
        (on) => {
          settings.tips = on;
          void saveLettersSettings(storage, settings);
        },
      ),
    ),
  );
}

/** One row per kid with a name: record their name (a couple of seconds), play it back, or remove it (ADR 0039). */
async function nameRecordings(ctx: ParentSectionContext): Promise<HTMLElement> {
  const { storage } = ctx;
  const box = h('div', { style: 'display: flex; flex-direction: column; gap: 8px', 'data-name-recordings': '' });
  const status = h('p', { class: 'pw-muted', 'aria-live': 'polite' });
  let busy = false;
  for (const kid of ctx.kids) {
    const label = ctx.kidLabel(kid);
    const row = h('div', { class: 'pw-row', 'data-name-recording': kid.id, style: 'gap: 8px' });
    if (nameCells(kid.name ?? '', false).length === 0) {
      row.append(
        h('span', { style: 'min-width: 110px; font-weight: 700' }, label),
        h('span', { class: 'pw-muted' }, 'No name yet: give this kid a name under Kids to have them write it.'),
      );
      box.append(row);
      continue;
    }
    let has = !!(await findNameRecording(storage, kid.id));
    const draw = () => {
      row.replaceChildren(
        h('span', { style: 'min-width: 110px; font-weight: 700' }, label),
        button(has ? 'Record again' : 'Record the name', () => void record()),
        ...(has ? [button('Play', () => void play()), button('Remove', () => void remove())] : []),
      );
    };
    const record = async () => {
      if (busy) return;
      busy = true;
      status.textContent = `Recording ${label}'s name… say it now.`;
      try {
        await saveNameRecording(storage, kid.id, await recordClip(NAME_RECORD_MS));
        has = true;
        status.textContent = `${label}'s name is recorded.`;
      } catch {
        status.textContent = 'No microphone could be used. Check that one is plugged in and allowed.';
      } finally {
        busy = false;
        draw();
      }
    };
    const play = async () => {
      const path = await findNameRecording(storage, kid.id);
      const blob = path ? await storage.getBlob(path) : undefined;
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.addEventListener('ended', () => URL.revokeObjectURL(url));
      void audio.play().catch(() => URL.revokeObjectURL(url));
    };
    const remove = async () => {
      await deleteNameRecording(storage, kid.id);
      has = false;
      status.textContent = '';
      draw();
    };
    draw();
    box.append(row);
  }
  box.append(status);
  return box;
}

/** Plays a parent's recording from storage once. */
async function playStored(ctx: ParentSectionContext, path: string | undefined): Promise<void> {
  const blob = path ? await ctx.storage.getBlob(path) : undefined;
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.addEventListener('ended', () => URL.revokeObjectURL(url));
  void audio.play().catch(() => URL.revokeObjectURL(url));
}

/**
 * The family's own words (ADR 0039): add one, change its text, record it, give it a photo, delete it. Each word is
 * its own file; shared by every kid on the device.
 */
async function familyWords(ctx: ParentSectionContext): Promise<HTMLElement> {
  const { storage } = ctx;
  const list = h('div', { style: 'display: flex; flex-direction: column' });
  const status = h('p', { class: 'pw-muted', 'aria-live': 'polite' });
  const input = h('input', {
    class: 'pw-input',
    type: 'text',
    maxlength: String(MAX_WORD_LENGTH),
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': 'A new family word',
    placeholder: 'A new word',
    style: 'max-width: 240px',
  });
  const addRow = h('div', { class: 'pw-row', style: 'gap: 8px' }, input, button('Add word', () => void add(), 'primary'));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void add();
  });
  let busy = false;
  let thumbs: string[] = [];

  const redraw = async () => {
    for (const url of thumbs) URL.revokeObjectURL(url);
    thumbs = [];
    const words = await loadFamilyWords(storage);
    list.replaceChildren(...(await Promise.all(words.map(row))));
    if (words.length === 0) list.append(h('p', { class: 'pw-muted' }, 'No family words yet.'));
    addRow.hidden = words.length >= MAX_FAMILY_WORDS;
  };

  // Adds run one after another, and the field is emptied at once: a word typed while the last one saves is kept.
  let adding: Promise<void> = Promise.resolve();
  const add = () => {
    const text = cleanWordText(input.value);
    if (!hasLetters(text)) {
      status.textContent = 'Type a word with at least one letter A to Z.';
      return adding;
    }
    input.value = '';
    adding = adding.then(async () => {
      const words = await loadFamilyWords(storage);
      if (words.length >= MAX_FAMILY_WORDS) return;
      // Always after the last word, even when two are added within the same millisecond.
      const last = Date.parse(words.at(-1)?.added ?? '');
      const added = new Date(Math.max(Date.now(), Number.isFinite(last) ? last + 1 : 0)).toISOString();
      await saveFamilyWord(storage, { id: newFamilyId(), text, added });
      status.textContent = `Added "${text}". Record how you say it below.`;
      await redraw();
    });
    return adding;
  };

  const row = async (word: FamilyWordFiles): Promise<HTMLElement> => {
    const r = h('div', {
      class: 'pw-row',
      'data-family-word': word.id,
      style: 'gap: 8px; flex-wrap: wrap; padding: 8px 0; border-bottom: 1px solid #e3e7ec',
    });
    const thumb = h('span', {
      'aria-hidden': 'true',
      style:
        'flex: none; width: 56px; height: 56px; box-sizing: border-box; padding: 4px; border: 2px solid #d3d9e0; ' +
        'border-radius: 12px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #fff',
    });
    const photo = word.photo ? await storage.getBlob(word.photo).catch(() => undefined) : undefined;
    if (photo) {
      const url = URL.createObjectURL(photo);
      thumbs.push(url);
      thumb.style.padding = '0';
      thumb.append(h('img', { src: url, alt: '', style: 'width: 100%; height: 100%; object-fit: cover' }));
    } else {
      // Drawn from the glyphs' own paths (letters A to Z only), never from the typed text.
      thumb.innerHTML = wordLettersMarkup(cellLetters(familyCells(word.text, true)), 16);
    }

    const text = h('input', {
      class: 'pw-input',
      type: 'text',
      maxlength: String(MAX_WORD_LENGTH),
      autocomplete: 'off',
      spellcheck: 'false',
      'aria-label': `Family word ${word.text}`,
      style: 'max-width: 200px',
    });
    text.value = word.text;
    text.addEventListener('change', async () => {
      const t = cleanWordText(text.value);
      if (!hasLetters(t)) {
        status.textContent = 'Type a word with at least one letter A to Z.';
        text.value = word.text;
        return;
      }
      await saveFamilyWord(storage, { ...word, text: t });
      status.textContent = `Changed to "${t}".`;
      await redraw();
    });

    const file = h('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-label': `Photo for ${word.text}` });
    file.addEventListener('change', async () => {
      const chosen = file.files?.[0];
      file.value = '';
      if (!chosen) return;
      try {
        await saveFamilyPhoto(storage, word.id, await preparePhoto(chosen));
        status.textContent = `"${word.text}" has a photo.`;
        await redraw();
      } catch {
        status.textContent = 'That file could not be read as a picture. Try a JPG or PNG photo.';
      }
    });

    const record = async () => {
      if (busy) return;
      busy = true;
      status.textContent = `Recording "${word.text}"… say it now.`;
      try {
        await saveFamilyRecording(storage, word.id, await recordClip(NAME_RECORD_MS));
        status.textContent = `"${word.text}" is recorded.`;
      } catch {
        status.textContent = 'No microphone could be used. Check that one is plugged in and allowed.';
      } finally {
        busy = false;
        await redraw();
      }
    };

    r.append(
      thumb,
      text,
      button(word.recording ? 'Record again' : 'Record the word', () => void record()),
      ...(word.recording
        ? [
            button('Play', () => void playStored(ctx, word.recording)),
            button('Remove recording', async () => {
              await deleteFamilyRecording(storage, word.id);
              status.textContent = '';
              await redraw();
            }),
          ]
        : []),
      button(word.photo ? 'Change photo' : 'Add photo', () => file.click()),
      ...(word.photo
        ? [
            button('Remove photo', async () => {
              await deleteFamilyPhoto(storage, word.id);
              status.textContent = '';
              await redraw();
            }),
          ]
        : []),
      file,
      h('div', { class: 'pw-grow' }),
      button(
        'Delete',
        () =>
          confirmInline(r, `Delete "${word.text}" with its recording and photo?`, 'Delete', async () => {
            await deleteFamilyWord(storage, word.id);
            status.textContent = `Deleted "${word.text}".`;
            await redraw();
          }),
        'danger',
      ),
    );
    return r;
  };

  await redraw();
  return h('div', { style: 'display: flex; flex-direction: column; gap: 8px', 'data-family-words': '' }, list, addRow, status);
}

/** Recordings of each letter's name, and below them each letter's sound (ADR 0037). */
async function recordingGrids(ctx: ParentSectionContext): Promise<HTMLElement> {
  const names = await recordingGrid(ctx, 'name', allChars());
  const sounds = await recordingGrid(ctx, 'sound', [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']);
  return h(
    'div',
    { style: 'display: flex; flex-direction: column; gap: 10px' },
    h('h3', {}, 'Names'),
    names,
    h('h3', {}, 'Sounds'),
    h('p', { class: 'pw-muted' }, 'Used with "Name, then sound" and "Its sound". One for each letter, capital and small.'),
    sounds,
  );
}

/** One cell per letter: record (about a second and a half), play it back, or remove it. */
async function recordingGrid(ctx: ParentSectionContext, what: Said, chars: string[]): Promise<HTMLElement> {
  const { storage } = ctx;
  const keys = new Set(chars.map((ch) => recordingKey(ch, what)));
  const recorded = new Set(
    (await storage.list(VOICE_DIR))
      .map((p) => p.slice(VOICE_DIR.length).replace(/\.[a-z0-9]+$/, ''))
      .filter((k) => keys.has(k)),
  );
  const status = h('p', { class: 'pw-muted', 'aria-live': 'polite' });
  const count = () => `${recorded.size} of ${chars.length} recorded. Those without a recording use the app's voice.`;
  status.textContent = count();
  const grid = h('div', {
    'data-recordings': what,
    style: 'display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; max-height: 320px; overflow: auto',
  });
  let busy = false;
  for (const ch of chars) {
    const key = recordingKey(ch, what);
    const cell = h('div', { class: 'pw-row', style: 'gap: 6px; padding: 4px 8px; border: 1px solid #d3d9e0; border-radius: 10px' });
    const draw = () => {
      const has = recorded.has(key);
      cell.replaceChildren(
        h('span', { style: 'min-width: 28px; font-weight: 700; font-size: 20px' }, what === 'sound' ? `${ch}${ch.toLowerCase()}` : ch),
        button(has ? 'Again' : 'Record', () => void record()),
        ...(has ? [button('Play', () => void play()), button('Remove', () => void remove())] : []),
      );
    };
    const record = async () => {
      if (busy) return;
      busy = true;
      status.textContent = what === 'sound' ? `Recording the sound of ${ch}… say it now.` : `Recording ${ch}… say it now.`;
      try {
        await saveRecording(storage, ch, await recordClip(), what);
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
      const path = await findRecording(storage, ch, what);
      const blob = path ? await storage.getBlob(path) : undefined;
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.addEventListener('ended', () => URL.revokeObjectURL(url));
      void audio.play().catch(() => URL.revokeObjectURL(url));
    };
    const remove = async () => {
      await deleteRecording(storage, ch, what);
      recorded.delete(key);
      status.textContent = count();
      draw();
    };
    draw();
    grid.append(cell);
  }
  return h('div', { style: 'display: flex; flex-direction: column; gap: 10px' }, status, grid);
}
