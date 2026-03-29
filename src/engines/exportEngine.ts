/* ─── src/engines/exportEngine.ts ─── */
/* B7 v3.1: drawtext 폰트 URL 수정 + 인스턴스 초기화 지원 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

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
  crf: string;
  preset: string;
  format: 'mp4' | 'webm';
  description: string;
}

export interface ExportProgress {
  phase: 'init' | 'loading' | 'encoding' | 'concat' | 'done' | 'error';
  percent: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
  message: string;
}

export type ProgressCallback = (p: ExportProgress) => void;

/* ═══ 프리셋 ═══ */

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'yt-1080', name: 'YouTube 1080p', icon: '📺',
    width: 1920, height: 1080, fps: 30,
    videoBitrate: '8M', audioBitrate: '192k',
    crf: '20', preset: 'medium', format: 'mp4',
    description: 'YouTube 표준 Full HD',
  },
  {
    id: 'yt-4k', name: 'YouTube 4K', icon: '🖥️',
    width: 3840, height: 2160, fps: 30,
    videoBitrate: '35M', audioBitrate: '320k',
    crf: '18', preset: 'medium', format: 'mp4',
    description: 'YouTube 4K UHD',
  },
  {
    id: 'ig-reels', name: 'Instagram Reels', icon: '📱',
    width: 1080, height: 1920, fps: 30,
    videoBitrate: '5M', audioBitrate: '128k',
    crf: '23', preset: 'medium', format: 'mp4',
    description: 'Instagram Reels 9:16 세로형',
  },
  {
    id: 'tiktok', name: 'TikTok', icon: '🎵',
    width: 1080, height: 1920, fps: 30,
    videoBitrate: '4M', audioBitrate: '128k',
    crf: '23', preset: 'fast', format: 'mp4',
    description: 'TikTok 세로형 숏폼',
  },
  {
    id: 'twitter', name: 'Twitter / X', icon: '🐦',
    width: 1280, height: 720, fps: 30,
    videoBitrate: '5M', audioBitrate: '128k',
    crf: '22', preset: 'fast', format: 'mp4',
    description: 'Twitter 720p (140초 제한 참고)',
  },
  {
    id: 'fast-preview', name: '빠른 미리보기', icon: '⚡',
    width: 1280, height: 720, fps: 30,
    videoBitrate: '2M', audioBitrate: '128k',
    crf: '28', preset: 'ultrafast', format: 'mp4',
    description: '빠른 확인용 저품질',
  },
];

/* ═══ 폰트 URL (Subset OTF - freetype 호환용) ═══ */
const FONT_URL = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf';
const FONT_FALLBACK_URL = 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSans/hinted/ttf/NotoSans-Regular.ttf';
export const FONT_FILENAME = '/tmp/font.otf';

/* ═══ 엔진 인터페이스 ═══ */

export interface ExportEngineApi {
  init(onLog?: (msg: string) => void): Promise<void>;
  isLoaded(): boolean;
  loadFont(): Promise<boolean>;
  isFontLoaded(): boolean;
  loadSource(filename: string, src: string): Promise<void>;
  writeText(filename: string, content: string): Promise<void>;
  writeRaw(filename: string, data: Uint8Array): Promise<void>;
  exec(args: string[]): Promise<number>;
  readOutput(filename: string): Promise<Uint8Array>;
  readFileRaw(filename: string): Promise<Uint8Array | null>;
  cleanup(filenames: string[]): Promise<void>;
  terminate(): void;
  setProgressCallback(cb: ProgressCallback | null): void;
}

/* ═══ 엔진 구현 ═══ */

export function createExportEngine(): ExportEngineApi {
  const ffmpeg = new FFmpeg();
  let loaded = false;
  let fontLoaded = false;
  let progressCb: ProgressCallback | null = null;
  let execStart = 0;

  return {
    async init(onLog) {
      if (loaded) return;
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

      if (onLog) {
        ffmpeg.on('log', ({ message }) => onLog(message));
      }

      ffmpeg.on('progress', ({ progress }) => {
        if (!progressCb) return;
        const elapsed = performance.now() - execStart;
        const pct = Math.min(99, Math.max(0, Math.round(progress * 100)));
        const remaining = pct > 2 ? (elapsed / pct) * (100 - pct) : 0;
        progressCb({
          phase: 'encoding', percent: pct,
          elapsedMs: elapsed, estimatedRemainingMs: remaining,
          message: `인코딩 중… ${pct}%`,
        });
      });

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      loaded = true;
    },

    isLoaded() { return loaded; },

    async loadFont(): Promise<boolean> {
      if (fontLoaded) return true;
      try {
        const data = await fetchFile(FONT_URL);
        await ffmpeg.writeFile(FONT_FILENAME, data);
        fontLoaded = true;
        return true;
      } catch {
        try {
          const data = await fetchFile(FONT_FALLBACK_URL);
          await ffmpeg.writeFile(FONT_FILENAME, data);
          fontLoaded = true;
          return true;
        } catch {
          return false;
        }
      }
    },

    isFontLoaded() { return fontLoaded; },

    async loadSource(filename, src) {
      const data = await fetchFile(src);
      await ffmpeg.writeFile(filename, data);
    },

    async writeText(filename, content) {
      await ffmpeg.writeFile(filename, new TextEncoder().encode(content));
    },

    async writeRaw(filename, data) {
      await ffmpeg.writeFile(filename, data);
    },

    async exec(args) {
      try {
        execStart = performance.now();
        return await ffmpeg.exec(args);
      } catch (e: any) {
        if (String(e).includes('Aborted')) {
          console.warn('[ExportEngine] Aborted() caught — post-exec corruption check');
          return -1;
        }
        throw e;
      }
    },

    async readOutput(filename) {
      return await ffmpeg.readFile(filename) as Uint8Array;
    },

    async readFileRaw(filename) {
      try {
        const data = await ffmpeg.readFile(filename);
        return data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
      } catch {
        return null;
      }
    },

    async cleanup(filenames) {
      for (const fn of filenames) {
        try { await ffmpeg.deleteFile(fn); } catch { /* ignore */ }
      }
    },

    terminate() {
      try { ffmpeg.terminate(); } catch { /* ignore */ }
    },

    setProgressCallback(cb) { progressCb = cb; },
  };
}

export function createFreshEngine() {
  return createExportEngine();
}

/* ═══ FFmpeg 인자 빌더 ═══ */

export function buildSingleClipArgs(
  inputFn: string,
  outputFn: string,
  preset: ExportPreset,
  opts: {
    ss?: number;
    duration?: number;
    textFilter?: string;
  } = {},
): string[] {
  const args: string[] = [];

  if (opts.ss != null && opts.ss > 0) {
    args.push('-ss', opts.ss.toFixed(3));
  }
  args.push('-i', inputFn);
  if (opts.duration != null && opts.duration > 0) {
    args.push('-t', opts.duration.toFixed(3));
  }

  const vfParts: string[] = [
    `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease`,
    `pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2:black`,
    `fps=${preset.fps}`,
  ];
  if (opts.textFilter) {
    vfParts.push(opts.textFilter);
  }
  args.push('-vf', vfParts.join(','));

  args.push(
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-b:v', preset.videoBitrate,
    '-preset', preset.preset, '-crf', preset.crf,
    '-c:a', 'aac', '-b:a', preset.audioBitrate,
    '-movflags', '+faststart',
    '-y', outputFn,
  );
  return args;
}

export function buildConcatArgs(
  listFn: string,
  outputFn: string,
  opts: {
    streamCopy?: boolean;
    textFilter?: string;
    preset?: ExportPreset;
  } = {},
): string[] {
  const args: string[] = ['-f', 'concat', '-safe', '0', '-i', listFn];

  if (opts.streamCopy && !opts.textFilter) {
    args.push('-c', 'copy');
  } else if (opts.preset) {
    const vfParts: string[] = [];
    if (opts.textFilter) vfParts.push(opts.textFilter);
    if (vfParts.length > 0) args.push('-vf', vfParts.join(','));
    args.push(
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-b:v', opts.preset.videoBitrate,
      '-preset', opts.preset.preset, '-crf', opts.preset.crf,
      '-c:a', 'aac', '-b:a', opts.preset.audioBitrate,
    );
  }
  args.push('-movflags', '+faststart', '-y', outputFn);
  return args;
}
