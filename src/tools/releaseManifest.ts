// Writes `latest.json` for a release (ADR 0009, milestone 2 phase E): what the installed app's updater reads to
// learn about a newer version. Run by `.github/workflows/release.yml` with Node's built-in TypeScript support:
//
//   node src/tools/releaseManifest.ts --version 0.2.0 --url <installer url> --sig <installer .sig> \
//     --notes <notes.md> --out latest.json
//
// The notes are GitHub's generated release notes, turned into plain lines a parent can read in the parent area.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

/** The updater's static manifest format, for the one platform the app ships on. */
export interface LatestJson {
  version: string;
  notes: string;
  pub_date: string;
  platforms: { 'windows-x86_64': { signature: string; url: string } };
}

export function latestJson(opts: { version: string; notes: string; signature: string; url: string; date: Date }): LatestJson {
  if (!/^\d+\.\d+\.\d+$/.test(opts.version)) throw new Error(`Not a plain version number: ${opts.version}`);
  if (!opts.signature.trim()) throw new Error('The installer signature is empty');
  if (!opts.url.startsWith('https://')) throw new Error(`Not an https url: ${opts.url}`);
  return {
    version: opts.version,
    notes: opts.notes,
    pub_date: opts.date.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    platforms: { 'windows-x86_64': { signature: opts.signature.trim(), url: opts.url } },
  };
}

/**
 * GitHub's generated notes ("## What's Changed", "* Title by @someone in https://…/pull/3", "**Full Changelog**")
 * as plain lines: the change titles only, without who made them or links. Empty when there are none.
 */
export function plainNotes(markdown: string): string {
  const lines: string[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    const item = /^[*-]\s+(.*)$/.exec(line);
    if (!item) continue;
    const text = item[1]
      .replace(/\s+by\s+@[\w-]+(\s+in\s+\S+)?\s*$/, '')
      .replace(/\s+in\s+https?:\/\/\S+\s*$/, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`]/g, '')
      .trim();
    if (text) lines.push(text);
  }
  return lines.join('\n');
}

function main(): void {
  const { values } = parseArgs({
    options: {
      version: { type: 'string' },
      url: { type: 'string' },
      sig: { type: 'string' },
      notes: { type: 'string' },
      out: { type: 'string' },
    },
  });
  const { version, url, sig, notes, out } = values;
  if (!version || !url || !sig || !out) throw new Error('Needs --version, --url, --sig and --out (and --notes)');
  const manifest = latestJson({
    version,
    url,
    signature: readFileSync(sig, 'utf8'),
    notes: notes ? plainNotes(readFileSync(notes, 'utf8')) : '',
    date: new Date(),
  });
  writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest, null, 2));
}

if (import.meta.main) main();
