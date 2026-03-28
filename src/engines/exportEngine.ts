/* ─── src/engines/exportEngine.ts ─── */
/* B7: FFmpeg-WASM 기반 Canvas→MP4 내보내기 엔진 */

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
  phase: 'init' | 'frames' | 'audio' | 'muxing' | 'done' | 'error';
  percent: number;
  currentFrame: number;
  totalFrames: number;
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
  writeFrame(pngBytes: Uint8Array, frameIndex: number): Promise<void>;
  writeAudioWav(wavBytes: Uint8Array): Promise<void>;
  encode(preset: ExportPreset, totalFrames: number, hasAudio: boolean,
         onProgress?: ProgressCallback): Promise<Uint8Array>;
  cleanup(totalFrames: number): Promise<void>;
  terminate(): void;

  /* ═══ Phase B7-A: 직접 인코딩 지원 ═══ */
  writeSourceVideo(filename: string, url: string): Promise<void>;
  writeTextFile(filename: string, content: string): Promise<void>;
  encodeDirect(args: string[]): Promise<void>;
  readOutput(filename: string): Promise<Uint8Array>;
}

export function createExportEngine(): ExportEngineApi {
  const ffmpeg = new FFmpeg();
  let loaded = false;

  async function init(onLog?: (msg: string) => void): Promise<void> {
    if (loaded) return;
    /* Vite → ESM 빌드 사용 */
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
    if (onLog) {
      ffmpeg.on('log', ({ message }) => onLog(message));
    }
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    loaded = true;
  }

  /* B7-2: 프레임 PNG를 FFmpeg 가상 FS에 기록 */
  async function writeFrame(pngBytes: Uint8Array, frameIndex: number): Promise<void> {
    const fn = `frame_${String(frameIndex).padStart(6, '0')}.png`;
    await ffmpeg.writeFile(fn, pngBytes);
  }

  /* B7-3: 오디오 WAV를 FFmpeg 가상 FS에 기록 */
  async function writeAudioWav(wavBytes: Uint8Array): Promise<void> {
    await ffmpeg.writeFile('audio.wav', wavBytes);
  }

  /* B7-4: 인코딩 + 먹싱 */
  async function encode(
    preset: ExportPreset,
    totalFrames: number,
    hasAudio: boolean,
    onProgress?: ProgressCallback,
  ): Promise<Uint8Array> {
    const startMs = performance.now();

    ffmpeg.on('progress', ({ progress }) => {
      if (!onProgress) return;
      const elapsed = performance.now() - startMs;
      const pct = Math.min(99, Math.round(progress * 100));
      onProgress({
        phase: 'muxing',
        percent: pct,
        currentFrame: Math.round(progress * totalFrames),
        totalFrames,
        elapsedMs: elapsed,
        estimatedRemainingMs: pct > 0 ? (elapsed / pct) * (100 - pct) : 0,
        message: `인코딩 중… ${pct}%`,
      });
    });

    const args: string[] = [
      '-framerate', String(preset.fps),
      '-i', 'frame_%06d.png',
    ];
    if (hasAudio) args.push('-i', 'audio.wav');

    args.push(
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-b:v', preset.videoBitrate,
      '-preset', 'fast',
      '-movflags', '+faststart',
    );
    if (hasAudio) {
      args.push('-c:a', 'aac', '-b:a', preset.audioBitrate);
    }
    args.push(
      '-vf', `scale=${preset.width}:${preset.height}`,
      `output.${preset.format}`,
    );

    await ffmpeg.exec(args);
    const data = await ffmpeg.readFile(`output.${preset.format}`);
    return data as Uint8Array;
  }

  /* ═══ Phase B7-A: 직접 인코딩 구현 ═══ */

  async function writeSourceVideo(filename: string, url: string): Promise<void> {
    const resp = await fetch(url);
    const buf = new Uint8Array(await resp.arrayBuffer());
    await ffmpeg.writeFile(filename, buf);
  }

  async function writeTextFile(filename: string, content: string): Promise<void> {
    const encoder = new TextEncoder();
    await ffmpeg.writeFile(filename, encoder.encode(content));
  }

  async function encodeDirect(args: string[]): Promise<void> {
    await ffmpeg.exec(args);
  }

  async function readOutput(filename: string): Promise<Uint8Array> {
    return await ffmpeg.readFile(filename) as Uint8Array;
  }

  /* 가상 FS 정리 */
  async function cleanup(totalFrames: number): Promise<void> {
    for (let i = 0; i < totalFrames; i++) {
      try { await ffmpeg.deleteFile(`frame_${String(i).padStart(6, '0')}.png`); } catch { /* ok */ }
    }
    try { await ffmpeg.deleteFile('audio.wav'); } catch { /* ok */ }
    try { await ffmpeg.deleteFile('output.mp4'); } catch { /* ok */ }
    try { await ffmpeg.deleteFile('output.webm'); } catch { /* ok */ }
    try { await ffmpeg.deleteFile('concat.txt'); } catch { /* ok */ }
  }

  function terminate(): void {
    try { ffmpeg.terminate(); } catch { /* ok */ }
  }

  return { 
    init, writeFrame, writeAudioWav, encode, cleanup, terminate,
    writeSourceVideo, writeTextFile, encodeDirect, readOutput,
  };
}
