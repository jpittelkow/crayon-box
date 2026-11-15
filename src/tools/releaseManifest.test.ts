import { describe, expect, it } from 'vitest';
import { latestJson, plainNotes } from './releaseManifest';

describe('latest.json', () => {
  const base = {
    version: '0.2.0',
    notes: 'Faster start.',
    signature: 'dW50cnVzdGVkIGNvbW1lbnQ=\n',
    url: 'https://github.com/example/crayon-box/releases/download/v0.2.0/CrayonBox_0.2.0_x64-setup.exe',
    date: new Date('2026-11-14T12:34:56.789Z'),
  };

  it('has what the updater reads, for Windows only', () => {
    expect(latestJson(base)).toEqual({
      version: '0.2.0',
      notes: 'Faster start.',
      pub_date: '2026-11-14T12:34:56Z',
      platforms: { 'windows-x86_64': { signature: 'dW50cnVzdGVkIGNvbW1lbnQ=', url: base.url } },
    });
  });

  it('refuses a missing signature, a tag-style version or a plain http url', () => {
    expect(() => latestJson({ ...base, signature: ' ' })).toThrow(/signature/);
    expect(() => latestJson({ ...base, version: 'v0.2.0' })).toThrow(/version/);
    expect(() => latestJson({ ...base, url: 'http://example.com/a.exe' })).toThrow(/https/);
  });
});

describe('release notes', () => {
  it('keep the change titles, without names or links', () => {
    const md = [
      "## What's Changed",
      '* Add letter practice: trace letters with a finger or a pen (ADR 0026) by @someone in https://github.com/x/y/pull/4',
      '* Fix the `Back` race in https://github.com/x/y/pull/5',
      '- **Bigger** [color buttons](https://example.com)',
      '',
      '**Full Changelog**: https://github.com/x/y/compare/v0.1.0...v0.2.0',
    ].join('\n');
    expect(plainNotes(md)).toBe(
      'Add letter practice: trace letters with a finger or a pen (ADR 0026)\nFix the Back race\nBigger color buttons',
    );
  });

  it('are empty when there are no changes listed', () => {
    expect(plainNotes('**Full Changelog**: https://github.com/x/y/commits/v0.1.0')).toBe('');
  });
});
