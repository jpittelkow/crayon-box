// Add or edit a kid (ADR 0007, 0018): name, photo, color, symbol, where new pictures start.
import {
  KID_COLORS,
  KID_SYMBOLS,
  MAX_NAME_LENGTH,
  deleteProfile,
  drawAvatar,
  kidLabel,
  newProfile,
  putPhoto,
  saveProfile,
} from '../shell/profiles';
import type { KidColor, KidProfile, KidSymbol } from '../shell/types';
import type { AppStorage } from '../storage/types';
import { symbolIcon } from '../ui/icons';
import { button, card, chips, confirmInline, h, segmented } from '../ui/parent';
import { preparePhoto } from './photo';

export interface KidEditorOptions {
  storage: AppStorage;
  kids: KidProfile[];
  /** null adds a new kid. */
  kidId: string | null;
  currentPhotoUrl(kid: KidProfile): Promise<string | undefined>;
  forgetKid(kidId: string): Promise<void>;
  done(): void;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export async function kidEditor(opts: KidEditorOptions): Promise<HTMLElement> {
  const { storage, kids } = opts;
  const existing = kids.find((k) => k.id === opts.kidId);
  const draft: KidProfile = existing ? { ...existing } : newProfile(kids);
  /** undefined: unchanged; null: removed; Blob: newly chosen. */
  let photo: Blob | null | undefined;
  let previewUrl: string | undefined = existing ? await opts.currentPhotoUrl(existing) : undefined;
  const ownUrls: string[] = [];

  const preview = h('span', { class: 'pw-avatar', style: 'width: 120px; height: 120px; border-width: 5px' });
  const redrawPreview = () => drawAvatar(preview, draft, previewUrl, 64);

  const name = h('input', {
    class: 'pw-input',
    type: 'text',
    id: 'kid-name',
    maxlength: String(MAX_NAME_LENGTH),
    autocomplete: 'off',
    spellcheck: 'false',
  });
  name.value = draft.name ?? '';

  const file = h('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-label': 'Photo file' });
  const photoStatus = h('p', { class: 'pw-muted', role: 'status' });
  const removePhoto = button('Remove photo', () => {
    photo = null;
    previewUrl = undefined;
    removePhoto.hidden = true;
    redrawPreview();
  });
  removePhoto.hidden = !previewUrl;
  file.addEventListener('change', async () => {
    const chosen = file.files?.[0];
    file.value = '';
    if (!chosen) return;
    try {
      photo = await preparePhoto(chosen);
      previewUrl = URL.createObjectURL(photo);
      ownUrls.push(previewUrl);
      removePhoto.hidden = false;
      photoStatus.textContent = '';
      redrawPreview();
    } catch {
      photoStatus.textContent = 'That file could not be read as a picture. Try a JPG or PNG photo.';
    }
  });

  const colorChips = chips<KidColor>(
    'Color',
    KID_COLORS.map((c) => ({
      value: c,
      label: cap(c),
      render: (b) => {
        b.style.background = `var(--kid-${c})`;
      },
    })),
    draft.color,
    (c) => {
      draft.color = c;
      redrawPreview();
    },
  );
  const symbolChips = chips<KidSymbol>(
    'Symbol',
    KID_SYMBOLS.map((s) => ({
      value: s,
      label: cap(s),
      render: (b) => {
        b.innerHTML = symbolIcon(s, 30);
      },
    })),
    draft.symbol,
    (s) => {
      draft.symbol = s;
      redrawPreview();
    },
  );
  const usedColors = kids.filter((k) => k.id !== draft.id).map((k) => k.color);
  const colorNote = h('p', { class: 'pw-muted' });
  const updateColorNote = () => {
    colorNote.textContent = usedColors.includes(draft.color)
      ? 'Another kid has this color too, so their screens will look the same.'
      : "The kid's screens are tinted with this color.";
  };
  colorChips.addEventListener('click', updateColorNote);
  updateColorNote();

  const save = async () => {
    draft.name = name.value.trim().slice(0, MAX_NAME_LENGTH) || undefined;
    if (photo !== undefined) {
      await putPhoto(storage.shell, draft.id, photo);
      draft.hasPhoto = photo !== null;
    }
    await saveProfile(storage.shell, draft);
    cleanup();
    opts.done();
  };
  const cleanup = () => ownUrls.forEach((u) => URL.revokeObjectURL(u));

  const actions = h(
    'div',
    { class: 'pw-row' },
    button(existing ? 'Save changes' : 'Add this kid', () => void save(), 'primary'),
    button('Cancel', () => {
      cleanup();
      opts.done();
    }),
  );

  const deleteRow = h('div', { class: 'pw-row' });
  if (existing && kids.length > 1) {
    deleteRow.append(
      h('div', { class: 'pw-grow' }),
      button(
        `Delete ${kidLabel(existing)}`,
        () =>
          confirmInline(
            deleteRow,
            `Delete ${kidLabel(existing)} and all of their pictures for good?`,
            'Delete',
            async () => {
              await opts.forgetKid(existing.id);
              await deleteProfile(storage.shell, existing.id);
              cleanup();
              opts.done();
            },
          ),
        'danger',
      ),
    );
  } else if (existing) {
    deleteRow.append(h('p', { class: 'pw-muted' }, 'The last kid can be changed but not deleted.'));
  }

  redrawPreview();
  return h(
    'div',
    { style: 'display: flex; flex-direction: column; gap: 20px', 'data-editor': draft.id },
    h('h1', {}, existing ? `Edit ${kidLabel(existing)}` : 'Add a kid'),
    card(
      h('div', { class: 'pw-field' }, h('label', { for: 'kid-name' }, 'Name (optional)'), name),
      h('p', { class: 'pw-muted' }, 'Kept on this device only. Leave it empty to go by the symbol.'),
      h('h2', {}, 'Photo'),
      h(
        'div',
        { class: 'pw-row' },
        preview,
        button('Choose photo', () => file.click()),
        removePhoto,
        file,
      ),
      h('p', { class: 'pw-muted' }, 'Shown in the kid’s badge, cropped to a circle. Kept on this device only.'),
      photoStatus,
      h('h2', {}, 'Color'),
      colorChips,
      colorNote,
      h('h2', {}, 'Symbol'),
      h('p', { class: 'pw-muted' }, 'Shown in the badge when there is no photo.'),
      symbolChips,
      h('h2', {}, 'New pictures start as'),
      segmented(
        'Starting coloring mode',
        [
          ['free', 'Free coloring'],
          ['lines', 'Stay in the lines'],
        ],
        draft.startMode,
        (m) => {
          draft.startMode = m;
        },
      ),
    ),
    actions,
    deleteRow,
  );
}
