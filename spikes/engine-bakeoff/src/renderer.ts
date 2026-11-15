import type { SceneData } from './scene';

export interface RenderOptions {
  /** True: every batch is one instanced draw. False: props and their outlines are one object each. */
  instanced: boolean;
}

/** What each library has to do. Everything else in the test is shared. */
export interface EngineRenderer {
  /** Library name and version, for the label and the results. */
  label: string;
  /** Sets the drawing size in real pixels. */
  resize(width: number, height: number): void;
  /** Draws one frame from the scene data, which has already been refreshed. */
  render(): void;
  /** Draw calls in the last frame, as the library counts them. */
  drawCalls(): number;
}

export type CreateRenderer = (canvas: HTMLCanvasElement, scene: SceneData, opts: RenderOptions) => Promise<EngineRenderer>;
