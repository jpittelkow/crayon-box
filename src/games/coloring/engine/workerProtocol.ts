// Messages between the engine and the region worker.

export type WorkerRequest =
  | { type: 'init'; seq: number; rgba: ArrayBuffer; width: number; height: number }
  | { type: 'regionAt'; seq: number; x: number; y: number }
  | { type: 'mask'; seq: number; id: number };

export type WorkerReply =
  | { type: 'init'; seq: number; lines: ArrayBuffer; count: number }
  | { type: 'regionAt'; seq: number; id: number }
  | {
      type: 'mask';
      seq: number;
      id: number;
      x: number;
      y: number;
      width: number;
      height: number;
      bitmap: ImageBitmap;
    }
  | { type: 'error'; seq: number; message: string };

export interface RegionMask {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  bitmap: ImageBitmap;
}

type Pending = { resolve: (reply: WorkerReply) => void; reject: (err: Error) => void };

/** Promise-based client for the region worker, with a small cache of masks. */
export class RegionClient {
  private readonly worker: Worker;
  private seq = 0;
  private readonly pending = new Map<number, Pending>();
  private readonly masks = new Map<number, Promise<RegionMask>>();
  private static readonly MASK_CACHE = 8;

  constructor() {
    this.worker = new Worker(new URL('./regions.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<WorkerReply>) => {
      const p = this.pending.get(e.data.seq);
      if (!p) return;
      this.pending.delete(e.data.seq);
      if (e.data.type === 'error') p.reject(new Error(e.data.message));
      else p.resolve(e.data);
    };
  }

  private call(msg: WorkerRequest, transfer: Transferable[] = []): Promise<WorkerReply> {
    return new Promise((resolve, reject) => {
      this.pending.set(msg.seq, { resolve, reject });
      this.worker.postMessage(msg, transfer);
    });
  }

  /** Builds the region map. Returns the line layer's pixels (ink, alpha = darkness). */
  async init(rgba: ArrayBuffer, width: number, height: number): Promise<{ lines: ArrayBuffer; count: number }> {
    this.masks.clear();
    const reply = await this.call({ type: 'init', seq: ++this.seq, rgba, width, height }, [rgba]);
    if (reply.type !== 'init') throw new Error('Unexpected reply');
    return reply;
  }

  async regionAt(x: number, y: number): Promise<number> {
    const reply = await this.call({ type: 'regionAt', seq: ++this.seq, x, y });
    if (reply.type !== 'regionAt') throw new Error('Unexpected reply');
    return reply.id;
  }

  mask(id: number): Promise<RegionMask> {
    const cached = this.masks.get(id);
    if (cached) {
      // Refresh its place in the cache.
      this.masks.delete(id);
      this.masks.set(id, cached);
      return cached;
    }
    const p = this.call({ type: 'mask', seq: ++this.seq, id }).then((reply) => {
      if (reply.type !== 'mask') throw new Error('Unexpected reply');
      return reply as RegionMask;
    });
    this.masks.set(id, p);
    p.catch(() => this.masks.delete(id));
    while (this.masks.size > RegionClient.MASK_CACHE) {
      // Not closed: a stroke in progress may still be drawing with it. The garbage collector frees it.
      this.masks.delete(this.masks.keys().next().value!);
    }
    return p;
  }

  /** The mask of the region under (x, y), or null when there is none within reach. */
  async maskAt(x: number, y: number): Promise<RegionMask | null> {
    const id = await this.regionAt(x, y);
    return id ? this.mask(id) : null;
  }

  destroy(): void {
    this.worker.terminate();
    for (const p of this.pending.values()) p.reject(new Error('Worker stopped'));
    this.pending.clear();
    this.masks.clear();
  }
}
