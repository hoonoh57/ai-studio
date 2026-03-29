/* ─── src/engines/exportEngine.ts ─── */
/* B7 v3: 파이썬 aivideostudio 패턴 + 프로덕션 벤치마킹 반영
 *
 * 핵심 원칙:
 *   1. 원본 파일 → FFmpeg 직접 트랜스코딩 (캔버스 캡처 절대 금지)
 *   2. 단일 ffmpeg.exec() 호출로 완결 (파이썬 버전 동일 패턴)
 *   3. 다중 클립 = 개별 인코딩 + concat demuxer (FFmpeg 공식 권장)
 *   4. CDN @ffmpeg/core@0.12.10 ESM + toBlobURL
 */

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
  crf: string;           // ★ CRF 추가 (파이썬 버전 핵심)
  preset: string;         // ★ x264 preset 추가
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

/* ═══ 프리셋 (파이썬 aivideostudio PRESETS 벤치마킹) ═══ */

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

/* ═══ 엔진 인터페이스 ═══ */

export interface ExportEngineApi {
  init(onLog?: (msg: string) => void): Promise<void>;
  isLoaded(): boolean;

  /**
   * 소스 파일을 FFmpeg 가상 FS에 기록.
   * src는 blob URL 또는 http URL.
   */
  loadSource(filename: string, src: string): Promise<void>;

  /**
   * 텍스트 파일 기록 (concat 리스트 등).
   */
  writeText(filename: string, content: string): Promise<void>;

  /**
   * FFmpeg 명령 실행. 파이썬 export_engine.py의 cmd 빌드와 동일한 패턴.
   */
  exec(args: string[]): Promise<number>;

  /**
   * 결과 파일 읽기.
   */
  readOutput(filename: string): Promise<Uint8Array>;

  /**
   * 파일 삭제.
   */
  cleanup(filenames: string[]): Promise<void>;

  /**
   * 엔진 종료.
   */
  terminate(): void;

  /**
   * 진행률 콜백 등록.
   */
  setProgressCallback(cb: ProgressCallback | null): void;
}

/* ═══ 엔진 구현 ═══ */

export function createExportEngine(): ExportEngineApi {
  const ffmpeg = new FFmpeg();
  let loaded = false;
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
          phase: 'encoding',
          percent: pct,
          elapsedMs: elapsed,
          estimatedRemainingMs: remaining,
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

    async loadSource(filename, src) {
      const data = await fetchFile(src);
      await ffmpeg.writeFile(filename, data);
    },

    async writeText(filename, content) {
      await ffmpeg.writeFile(filename, new TextEncoder().encode(content));
    },

    async exec(args) {
      execStart = performance.now();
      return await ffmpeg.exec(args);
    },

    async readOutput(filename) {
      const data = await ffmpeg.readFile(filename);
      return data as Uint8Array;
    },

    async cleanup(filenames) {
      for (const fn of filenames) {
        try { await ffmpeg.deleteFile(fn); } catch { /* ignore */ }
      }
    },

    terminate() {
      try { ffmpeg.terminate(); } catch { /* ignore */ }
    },

    setProgressCallback(cb) {
      progressCb = cb;
    },
  };
}

/* ═══ 유틸: FFmpeg 인자 빌더 (파이썬 export_engine.py 패턴 그대로) ═══ */

/**
 * 단일 소스 파일 → 출력 파일로 트랜스코딩하는 FFmpeg 인자 배열 생성.
 * 파이썬 버전의 cmd 빌드 로직과 동일:
 *   -i input → -vf (scale,pad,fps) → -c:v libx264 -b:v -c:a aac -b:a → preset,crf → output
 */
export function buildSingleClipArgs(
  inputFn: string,
  outputFn: string,
  preset: ExportPreset,
  opts: {
    ss?: number;       // 시작점 (초)
    duration?: number;  // 길이 (초)
    textFilter?: string; // drawtext 필터 문자열 (선택)
  } = {},
): string[] {
  const args: string[] = [];

  // 입력 트림 (seek before input for speed)
  if (opts.ss != null && opts.ss > 0) {
    args.push('-ss', opts.ss.toFixed(3));
  }
  args.push('-i', inputFn);
  if (opts.duration != null && opts.duration > 0) {
    args.push('-t', opts.duration.toFixed(3));
  }

  // 비디오 필터 체인 (파이썬 버전: scale, pad, fps + subtitles)
  const vfParts: string[] = [
    `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease`,
    `pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2:black`,
    `fps=${preset.fps}`,
  ];
  if (opts.textFilter) {
    vfParts.push(opts.textFilter);
  }
  args.push('-vf', vfParts.join(','));

  // 코덱 (파이썬 버전: libx264 + preset + crf + aac)
  args.push(
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-b:v', preset.videoBitrate,
    '-preset', preset.preset,
    '-crf', preset.crf,
    '-c:a', 'aac',
    '-b:a', preset.audioBitrate,
    '-movflags', '+faststart',
    '-y', outputFn,
  );

  return args;
}

/**
 * concat demuxer를 사용한 다중 세그먼트 합치기 인자 생성.
 * FFmpeg 공식 권장 방식 (코덱/해상도/fps가 동일한 세그먼트).
 */
export function buildConcatArgs(
  listFn: string,
  outputFn: string,
  opts: {
    streamCopy?: boolean;  // true면 -c copy (재인코딩 없음)
    textFilter?: string;   // 있으면 재인코딩 필요
    preset?: ExportPreset;
  } = {},
): string[] {
  const args: string[] = [
    '-f', 'concat',
    '-safe', '0',
    '-i', listFn,
  ];

  if (opts.streamCopy && !opts.textFilter) {
    // 스트림 복사 (재인코딩 없음 → 가장 빠름)
    args.push('-c', 'copy');
  } else if (opts.preset) {
    // 재인코딩 (텍스트 오버레이가 있을 때)
    const vfParts: string[] = [];
    if (opts.textFilter) vfParts.push(opts.textFilter);
    if (vfParts.length > 0) args.push('-vf', vfParts.join(','));
    args.push(
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-b:v', opts.preset.videoBitrate,
      '-preset', opts.preset.preset,
      '-crf', opts.preset.crf,
      '-c:a', 'aac',
      '-b:a', opts.preset.audioBitrate,
    );
  }

  args.push('-movflags', '+faststart', '-y', outputFn);
  return args;
}
