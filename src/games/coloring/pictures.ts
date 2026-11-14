// A kid's pictures in the game's storage (ADR 0007): `art/<kid>/<picture>/` holds `paint.png` (the paint layer),
// `prev.png` (the version before the picture was last reopened) and `art.json`.
import type { ColoringMode, KidProfile } from '../../shell/types';
import type { GameStorage } from '../../storage/types';

export interface ArtMeta {
  pageId: string;
  mode: ColoringMode;
  created: string;
  updated: string;
}

export interface Picture {
  kid: string;
  id: string;
  meta: ArtMeta;
}

const dir = (p: { kid: string; id: string }) => `art/${p.kid}/${p.id}/`;

export async function listPictures(storage: GameStorage, kid: string): Promise<Picture[]> {
  const paths = (await storage.list(`art/${kid}/`)).filter((p) => p.endsWith('/art.json'));
  const pictures: Picture[] = [];
  for (const path of paths) {
    const meta = await storage.getJson<ArtMeta>(path);
    if (meta) pictures.push({ kid, id: path.split('/')[2], meta });
  }
  // Newest first, like the gallery (ADR 0007).
  return pictures.sort((a, b) => b.meta.updated.localeCompare(a.meta.updated));
}

/** The newest picture of a page, which starting that page again continues (ADR 0007). */
export async function findPicture(storage: GameStorage, kid: string, pageId: string): Promise<Picture | undefined> {
  return (await listPictures(storage, kid)).find((p) => p.meta.pageId === pageId);
}

export function newPicture(kid: KidProfile, pageId: string, now = new Date()): Picture {
  const slug = pageId.replace(/^[a-z]+:/, '').replace(/[^a-z0-9]+/gi, '-');
  const stamp = now.toISOString();
  return {
    kid: kid.id,
    id: `${slug}-${now.getTime().toString(36)}`,
    meta: { pageId, mode: kid.startMode, created: stamp, updated: stamp },
  };
}

export function getPaint(storage: GameStorage, picture: Picture): Promise<Blob | undefined> {
  return storage.getBlob(`${dir(picture)}paint.png`);
}

/** Reopening a picture first keeps its current paint as the previous version (ADR 0007). */
export async function keepPreviousVersion(storage: GameStorage, picture: Picture): Promise<Blob | undefined> {
  const paint = await getPaint(storage, picture);
  if (paint) await storage.putBlob(`${dir(picture)}prev.png`, paint);
  return paint;
}

export async function savePicture(storage: GameStorage, picture: Picture, paint: Blob | null): Promise<void> {
  picture.meta.updated = new Date().toISOString();
  if (paint) await storage.putBlob(`${dir(picture)}paint.png`, paint);
  await storage.putJson(`${dir(picture)}art.json`, picture.meta);
}
