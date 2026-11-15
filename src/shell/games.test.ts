import { describe, expect, it } from 'vitest';
import { memoryBackend } from '../storage/idb';
import { appStorage } from '../storage/namespaced';
import { enabledGames, loadShellSettings, saveShellSettings } from './profiles';
import type { GameEntry } from './types';

const game = (id: string, startsHidden = false): GameEntry => ({
  id,
  label: id,
  tileIcon: '',
  tileColor: '',
  startsHidden,
  load: () => Promise.reject(new Error('not loaded in this test')),
});

describe('which games the kids see (ADR 0012)', () => {
  const coloring = game('coloring');
  const racing = game('racing', true);

  it('a game that starts hidden stays off until a parent turns it on', async () => {
    const shell = appStorage(memoryBackend()).shell;
    const settings = await loadShellSettings(shell);
    expect(enabledGames([coloring, racing], settings)).toEqual([coloring]);

    settings.games.racing = true;
    await saveShellSettings(shell, settings);
    expect(enabledGames([coloring, racing], await loadShellSettings(shell))).toEqual([coloring, racing]);
  });

  it('a parent can hide any game, but the kids always have one', async () => {
    const settings = await loadShellSettings(appStorage(memoryBackend()).shell);
    settings.games = { coloring: false, racing: true };
    expect(enabledGames([coloring, racing], settings)).toEqual([racing]);
    settings.games = { coloring: false };
    expect(enabledGames([coloring, racing], settings)).toEqual([coloring]);
  });

  it('settings saved before games could be hidden still load', async () => {
    const shell = appStorage(memoryBackend()).shell;
    await shell.putJson('settings.json', { showNames: false });
    expect(await loadShellSettings(shell)).toEqual({ showNames: false, games: {} });
  });
});
