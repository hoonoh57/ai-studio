/* ─── src/engines/exportEngine.ts ─── */
/* B7: FFmpeg-WASM 기반 직접 트랜스코딩 엔진 (v2 — 원본 파일 직접 전달) */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

/* ═══ 타입 ═══ */

export interface ExportPreset {
  id: string;
  name: string;
  icon: string;
  width: number;
  height: number;
  fps: number;
  videoBitrate: string;
  audioBitrate: string;
  format: 'mp4' | 'webm';
  description: string;
}

export interface ExportProgress {
  phase: 'init' | 'loading' | 'encoding' | 'done' | 'error';
  percent: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
  message: string;
}

export type ProgressCallback = (p: ExportProgress) => void;

/* ═══ 플랫폼 프리셋 5종 (B7-5) ═══ */

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'yt-1080', name: 'YouTube 1080p', icon: '📺',
    width: 1920, height: 1080, fps: 30,
    videoBitrate: '8M', audioBitrate: '192k', format: 'mp4',
    description: 'YouTube 표준 Full HD',
  },
  {
    id: 'yt-4k', name: 'YouTube 4K', icon: '🖥️',
    width: 3840, height: 2160, fps: 30,
    videoBitrate: '20M', audioBitrate: '320k', format: 'mp4',
    description: 'YouTube 4K UHD',
  },
  {
    id: 'ig-reels', name: 'Instagram Reels', icon: '📱',
    width: 1080, height: 1920, fps: 30,
    videoBitrate: '6M', audioBitrate: '128k', format: 'mp4',
    description: 'Instagram Reels 9:16 세로형',
  },
  {
    id: 'tiktok', name: 'TikTok', icon: '🎵',
    width: 1080, height: 1920, fps: 30,
    videoBitrate: '6M', audioBitrate: '128k', format: 'mp4',
    description: 'TikTok 세로형 숏폼',
  },
  {
    id: 'twitter', name: 'Twitter / X', icon: '🐦',
    width: 1280, height: 720, fps: 30,
    videoBitrate: '5M', audioBitrate: '128k', format: 'mp4',
    description: 'Twitter 720p (140초 제한 참고)',
  },
];

/* ═══ 엔진 팩토리 ═══ */

export interface ExportEngineApi {
  init(onLog?: (msg: string) => void): Promise<void>;
  isLoaded(): boolean;
  writeFile(filename: string, url: string): Promise<void>;
  writeRaw(filename: string, data: Uint8Array): Promise<void>;
  writeText(filename: string, content: string): Promise<void>;
  exec(args: string[]): Promise<void>;
  readFile(filename: string): Promise<Uint8Array>;
  deleteFile(filename: string): Promise<void>;
  terminate(): void;
  onProgress(cb: ProgressCallback, totalDurationSec: number): void;
}

export function createExportEngine(): ExportEngineApi {
  const ffmpeg = new FFmpeg();
  let loaded = false;
  let progressCb: ProgressCallback | null = null;
  let progressStart = 0;
  let progressTotalDur = 0;

  async function init(onLog?: (msg: string) => void): Promise<void> {
    if (loaded) return;
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
    if (onLog) {
      ffmpeg.on('log', ({ message }) => onLog(message));
    }
    ffmpeg.on('progress', ({ progress, time }) => {
      if (!progressCb) return;
      const elapsed = performance.now() - progressStart;
      const pct = Math.min(99, Math.max(0, Math.round(progress * 100)));
      progressCb({
        phase: 'encoding',
        percent: pct,
        elapsedMs: elapsed,
        estimatedRemainingMs: pct > 0 ? (elapsed / pct) * (100 - pct) : 0,
        message: `인코딩 중… ${pct}%`,
      });
    });
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    loaded = true;
  }

  function isLoaded(): boolean { return loaded; }

  async function writeFile(filename: string, url: string): Promise<void> {
    const resp = await fetch(url);
    const buf = new Uint8Array(await resp.arrayBuffer());
    await ffmpeg.writeFile(filename, buf);
  }

  async function writeRaw(filename: string, data: Uint8Array): Promise<void> {
    await ffmpeg.writeFile(filename, data);
  }

  async function writeText(filename: string, content: string): Promise<void> {
    await ffmpeg.writeFile(filename, new TextEncoder().encode(content));
  }

  async function exec(args: string[]): Promise<void> {
    progressStart = performance.now();
    await ffmpeg.exec(args);
  }

  async function readFile(filename: string): Promise<Uint8Array> {
    return await ffmpeg.readFile(filename) as Uint8Array;
  }

  async function deleteFile(filename: string): Promise<void> {
    try { await ffmpeg.deleteFile(filename); } catch { /* ok */ }
  }

  function onProgress(cb: ProgressCallback, totalDurationSec: number): void {
    progressCb = cb;
    progressTotalDur = totalDurationSec;
  }

  function terminate(): void {
    try { ffmpeg.terminate(); } catch { /* ok */ }
  }

  return {
    init, isLoaded, writeFile, writeRaw, writeText,
    exec, readFile, deleteFile, terminate, onProgress,
  };
}
