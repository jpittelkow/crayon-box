// Heavy per-pixel work runs here so painting never freezes (ADR 0004): the region map, and each region's mask.
import { labelRegions, regionAt, regionMask, wallsFromRgba, type Regions } from './regions';
import type { WorkerReply, WorkerRequest } from './workerProtocol';

interface WorkerScope {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerReply, transfer?: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;

let regions: Regions | null = null;

scope.onmessage = async (e) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case 'init': {
        const rgba = new Uint8ClampedArray(msg.rgba);
        const { walls, lines } = wallsFromRgba(rgba, msg.width, msg.height);
        regions = labelRegions(walls, msg.width, msg.height);
        scope.postMessage({ type: 'init', seq: msg.seq, lines: lines.buffer, count: regions.count }, [lines.buffer]);
        break;
      }
      case 'regionAt': {
        const id = regions ? regionAt(regions, msg.x, msg.y) : 0;
        scope.postMessage({ type: 'regionAt', seq: msg.seq, id });
        break;
      }
      case 'mask': {
        if (!regions) throw new Error('Page not loaded');
        const mask = regionMask(regions, msg.id);
        const rgba = new Uint8ClampedArray(mask.width * mask.height * 4);
        for (let i = 0; i < mask.alpha.length; i++) {
          if (mask.alpha[i]) rgba.set([255, 255, 255, 255], i * 4);
        }
        const bitmap = await createImageBitmap(new ImageData(rgba, mask.width, mask.height));
        scope.postMessage(
          { type: 'mask', seq: msg.seq, id: msg.id, x: mask.x, y: mask.y, width: mask.width, height: mask.height, bitmap },
          [bitmap],
        );
        break;
      }
    }
  } catch (err) {
    scope.postMessage({ type: 'error', seq: msg.seq, message: String(err) });
  }
};
