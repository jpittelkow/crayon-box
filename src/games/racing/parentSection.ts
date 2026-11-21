// The driving game's screen in the parent area (ADR 0008, 0012, 0021): each kid's assist level, sounds, the
// vehicles, and in the Windows app the maps from the device's maps folder (ADR 0043).
import { drawAvatar } from '../../shell/profiles';
import type { MapsFolder, ParentSectionContext } from '../../shell/types';
import { button, card, h, segmented, switchRow } from '../../ui/parent';
import { loadFolderMaps, loadFolderMapsOff, saveFolderMapsOff } from './maps/folder';
import { VEHICLE_NAMES } from './names';
import { VEHICLES, loadDrivingSettings, loadKidDriving, saveDrivingSettings, saveKidDriving } from './settings';
import type { Assist } from './sim/sim';

export async function renderDriving(el: HTMLElement, ctx: ParentSectionContext): Promise<void> {
  const rows = h('div', { style: 'display: flex; flex-direction: column; gap: 6px' });
  for (const kid of ctx.kids) {
    const prefs = await loadKidDriving(ctx.storage, kid.id);
    const dot = h('span', { class: 'pw-avatar', style: 'width: 44px; height: 44px', 'aria-hidden': 'true' });
    drawAvatar(dot, kid, undefined, 24);
    rows.append(
      h(
        'div',
        { class: 'pw-row', 'data-kid': kid.id },
        dot,
        h('span', { style: 'min-width: 120px; font-weight: 700' }, ctx.kidLabel(kid)),
        segmented<Assist>(
          `Driving help for ${ctx.kidLabel(kid)}`,
          [
            ['free', 'Steers freely'],
            ['road', 'Follows the road'],
          ],
          prefs.assist,
          // Change only the assist level: the kid's last vehicle is kept too.
          async (assist) => saveKidDriving(ctx.storage, kid.id, { ...(await loadKidDriving(ctx.storage, kid.id)), assist }),
        ),
      ),
    );
  }

  const settings = await loadDrivingSettings(ctx.storage);
  el.append(
    h(
      'p',
      { class: 'pw-muted' },
      'A first try of the driving game. Turn it on or off for the kids under Settings, Games.',
    ),
    card(
      h('h2', {}, 'Driving help'),
      h(
        'p',
        { class: 'pw-muted' },
        'Steers freely: the car drives to where the kid touches. Follows the road: the car steers itself along the road, and a touch only makes it go.',
      ),
      rows,
    ),
    card(
      switchRow(
        'Sounds',
        'Engines, horns, bumps, splashes and the set pieces.',
        settings.sounds,
        async (on) => saveDrivingSettings(ctx.storage, { ...(await loadDrivingSettings(ctx.storage)), sounds: on }),
      ),
    ),
    card(
      h('h2', {}, 'Vehicles'),
      h('p', { class: 'pw-muted' }, 'Switch off a vehicle a kid finds too loud or scary: it leaves the picker, the garage and traffic. The car is always there.'),
      ...VEHICLES.filter((k) => k !== 'car').map((kind) =>
        switchRow(VEHICLE_NAMES[kind], '', !settings.hidden.includes(kind), async (on) => {
          const now = await loadDrivingSettings(ctx.storage);
          const hidden = now.hidden.filter((k) => k !== kind);
          if (!on) hidden.push(kind);
          await saveDrivingSettings(ctx.storage, { ...now, hidden });
        }),
      ),
    ),
  );
  if (ctx.mapsFolder) el.append(await folderCard(ctx.mapsFolder, ctx));
}

/**
 * Maps from the folder (ADR 0043): each one that loaded, with a switch to take it off the picker, and each file
 * left out, with why. Read afresh every time this screen opens.
 */
async function folderCard(folder: MapsFolder, ctx: ParentSectionContext): Promise<HTMLElement> {
  const [{ maps, problems }, off] = await Promise.all([loadFolderMaps(folder), loadFolderMapsOff(ctx.storage)]);
  const rows = maps.map((m) => {
    const row = switchRow(m.name, m.file, !off.includes(m.map.id), async (on) => {
      const now = (await loadFolderMapsOff(ctx.storage)).filter((id) => id !== m.map.id);
      if (!on) now.push(m.map.id);
      await saveFolderMapsOff(ctx.storage, now);
    });
    row.dataset.folderMap = m.file;
    return row;
  });
  const left = problems.map((p) =>
    h('p', { class: 'pw-problem', role: 'alert', 'data-map-problem': p.file }, p.file ? `${p.file} was left out. ${p.reason}` : p.reason),
  );
  return card(
    h('h2', {}, 'Maps from the folder'),
    h(
      'p',
      { class: 'pw-muted' },
      'Map files (.json) put in the app’s maps folder show on the picker after the built-in maps, the next time a kid opens Driving. A file with a problem is left out, and the problem shows here.',
    ),
    ...(rows.length || left.length ? [] : [h('p', { class: 'pw-muted', 'data-folder-empty': '' }, 'No map files in the folder.')]),
    ...rows,
    ...left,
    h('div', { class: 'pw-row' }, button('Open the maps folder', () => void folder.openFolder().catch((err) => console.error(err)))),
  );
}
