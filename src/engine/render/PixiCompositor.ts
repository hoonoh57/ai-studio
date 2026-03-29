/* --- src/engine/render/PixiCompositor.ts --- */
/* PixiJS v8 기반 비디오 합성 엔진 - WebGL2 자동 GPU 가속 */

import { Application, Sprite, Texture, VideoSource } from 'pixi.js';

export interface PixiCompositorConfig {
  canvas: HTMLCanvasElement;
  width?: number;
  height?: number;
}

export class PixiCompositor {
  private app: Application;
  private sprite: Sprite | null = null;
  private videoSource: VideoSource | null = null;
  private ready = false;
  private _canvas: HTMLCanvasElement;

  constructor(private config: PixiCompositorConfig) {
    this._canvas = config.canvas;
    this.app = new Application();
  }

  async init(): Promise<void> {
    try {
      await this.app.init({
        canvas: this._canvas,
        width: this.config.width || 1920,
        height: this.config.height || 1080,
        backgroundColor: 0x000000,
        antialias: true,
        preference: 'webgl',
        autoDensity: true,
      });
      const r = this.app.renderer as any;
      const name = r.type === 0x1 ? 'WebGL' : 'WebGPU';
      console.log('[PixiCompositor] init OK - backend:', name);
      this.ready = true;
    } catch (e) {
      console.error('[PixiCompositor] init FAIL:', e);
      this.ready = false;
      throw e;
    }
  }

  renderFrame(video: HTMLVideoElement): boolean {
    if (!this.ready) return false;
    if (!video || video.readyState < 2) return false;
    try {
      if (!this.videoSource || this.videoSource.resource !== video) {
        if (this.sprite) {
          this.app.stage.removeChild(this.sprite);
          this.sprite.destroy();
        }
        this.videoSource = new VideoSource({ resource: video, autoPlay: false, updateFPS: 0 });
        const texture = new Texture({ source: this.videoSource });
        this.sprite = new Sprite(texture);
        this.app.stage.addChild(this.sprite);
      }
      const cw = this._canvas.width || this.app.screen.width;
      const ch = this._canvas.height || this.app.screen.height;
      const vw = video.videoWidth || cw;
      const vh = video.videoHeight || ch;
      const srcAspect = vw / vh;
      const dstAspect = cw / ch;
      let dw: number, dh: number;
      if (srcAspect > dstAspect) { dw = cw; dh = cw / srcAspect; }
      else { dh = ch; dw = ch * srcAspect; }
      this.sprite!.width = dw;
      this.sprite!.height = dh;
      this.sprite!.x = (cw - dw) / 2;
      this.sprite!.y = (ch - dh) / 2;
      this.videoSource.update();
      this.app.renderer.render(this.app.stage);
      return true;
    } catch (e) {
      console.warn('[PixiCompositor] render fail:', e);
      return false;
    }
  }

  resize(w: number, h: number): void {
    if (!this.ready) return;
    this.app.renderer.resize(w, h);
  }

  clear(): void {
    if (!this.ready) return;
    if (this.sprite) this.sprite.visible = false;
    this.app.renderer.render(this.app.stage);
    if (this.sprite) this.sprite.visible = true;
  }

  get backendName(): string {
    if (!this.ready) return 'none';
    const r = this.app.renderer as any;
    return r.type === 0x1 ? 'WebGL' : r.type === 0x2 ? 'WebGPU' : 'Unknown';
  }

  destroy(): void {
    this.ready = false;
    if (this.sprite) {
      this.sprite.destroy({ children: true, texture: true });
      this.sprite = null;
    }
    this.videoSource = null;
    try { this.app.destroy(false); } catch { /* ignore */ }
  }
}
