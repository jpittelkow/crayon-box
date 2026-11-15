// The driving game's screen in the parent area (ADR 0008, 0012, 0021): each kid's assist level, and sounds.
import { drawAvatar } from '../../shell/profiles';
import type { ParentSectionContext } from '../../shell/types';
import { card, h, segmented, switchRow } from '../../ui/parent';
import { loadDrivingSettings, loadKidDriving, saveDrivingSettings, saveKidDriving } from './settings';
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
        'Steers freely: the car heads toward the finger. Follows the road: the car steers itself along the road, and a touch only makes it go.',
      ),
      rows,
    ),
    card(
      switchRow(
        'Sounds',
        'Bumps, splashes and the horn. Made by the app as it plays.',
        settings.sounds,
        (on) => void saveDrivingSettings(ctx.storage, { sounds: on }),
      ),
    ),
  );
}
