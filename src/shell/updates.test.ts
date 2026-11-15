import { describe, expect, it } from 'vitest';
import { memoryBackend } from '../storage/idb';
import { appStorage } from '../storage/namespaced';
import { FAKE_NEW_VERSION, fakeUpdater } from './fakeUpdater';
import {
  UpdateController,
  loadUpdateSettings,
  saveUpdateSettings,
  type AvailableUpdate,
  type UpdateState,
  type Updater,
} from './updates';

function record(c: UpdateController): UpdateState['kind'][] {
  const kinds: UpdateState['kind'][] = [];
  c.subscribe((s) => kinds.push(s.kind));
  return kinds;
}

describe('update controller', () => {
  it('says so when this is the newest version', async () => {
    const c = new UpdateController(fakeUpdater('none'));
    const kinds = record(c);
    await c.check();
    expect(kinds).toEqual(['checking', 'upToDate']);
    expect(c.hasNews).toBe(false);
  });

  it('announces a newer version, and installs it on request only', async () => {
    const c = new UpdateController(fakeUpdater('available'));
    await c.check();
    expect(c.state).toMatchObject({ kind: 'available', version: FAKE_NEW_VERSION });
    expect(c.hasNews).toBe(true);
    const kinds = record(c);
    await c.install();
    expect(kinds[0]).toBe('installing');
    expect(kinds.at(-1)).toBe('restarting');
  });

  it('reports download progress', async () => {
    const c = new UpdateController(fakeUpdater('available'));
    await c.check();
    const progress: (number | null)[] = [];
    c.subscribe((s) => s.kind === 'installing' && progress.push(s.progress));
    await c.install();
    expect(progress).toEqual([0, 0, 0.25, 0.5, 0.75, 1]);
  });

  it('turns an unreachable release into a failed check, and can check again', async () => {
    const c = new UpdateController(fakeUpdater('offline'));
    await c.check();
    expect(c.state).toMatchObject({ kind: 'failed', during: 'check' });
    expect(c.canRetryInstall).toBe(false);
    await c.check();
    expect(c.state.kind).toBe('failed');
  });

  it('keeps the update after a failed install, so it can be tried again', async () => {
    const c = new UpdateController(fakeUpdater('broken'));
    await c.check();
    await c.install();
    expect(c.state).toMatchObject({ kind: 'failed', during: 'install', detail: 'signature does not match' });
    expect(c.canRetryInstall).toBe(true);
    const kinds = record(c);
    await c.retryInstall();
    expect(kinds[0]).toBe('available');
    expect(c.state.kind).toBe('failed');
  });

  it('does nothing on install before an update was found', async () => {
    const c = new UpdateController(fakeUpdater('none'));
    await c.install();
    expect(c.state.kind).toBe('idle');
  });

  it('runs one check at a time, and lets go of an update it replaces', async () => {
    let checks = 0;
    let closed = 0;
    const update: AvailableUpdate = {
      version: '2.0.0',
      notes: '  Notes.  ',
      install: async () => {},
      close: async () => void closed++,
    };
    const updater: Updater = {
      currentVersion: async () => '1.0.0',
      check: async () => {
        checks++;
        await new Promise((r) => setTimeout(r, 10));
        return update;
      },
    };
    const c = new UpdateController(updater);
    await Promise.all([c.check(), c.check()]);
    expect(checks).toBe(1);
    expect(c.state).toMatchObject({ kind: 'available', notes: 'Notes.' });
    await c.check();
    expect(closed).toBe(1);
  });

  it('asks for the running version once', async () => {
    let asked = 0;
    const c = new UpdateController({ currentVersion: async () => (asked++, '1.2.3'), check: async () => null });
    expect(await c.currentVersion()).toBe('1.2.3');
    expect(await c.currentVersion()).toBe('1.2.3');
    expect(asked).toBe(1);
  });
});

describe('update settings', () => {
  it('check at start until a parent turns it off', async () => {
    const shell = appStorage(memoryBackend()).shell;
    expect((await loadUpdateSettings(shell)).checkOnStart).toBe(true);
    await saveUpdateSettings(shell, { checkOnStart: false });
    expect((await loadUpdateSettings(shell)).checkOnStart).toBe(false);
  });
});
