// src/lib/core/thumbnailGenerator.ts

import type { ThumbnailData } from '@/types/project';

const DEFAULT_FRAME_COUNT = 10;
const DEFAULT_THUMB_WIDTH = 160;
const DEFAULT_THUMB_HEIGHT = 90;
const JPEG_QUALITY = 0.6;

/**
 * 비디오 요소를 생성하고 메타데이터가 로드될 때까지 대기합니다.
 * 실패 시 null을 반환합니다.
 */
async function createVideoElement(
  url: string,
): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;

    const cleanup = () => {
      video.onloadeddata = null;
      video.onerror = null;
    };

    video.onloadeddata = () => {
      cleanup();
      resolve(video);
    };

    video.onerror = () => {
      cleanup();
      resolve(null);
    };

    video.src = url;
    video.load();
  });
}

/**
 * 비디오 요소를 특정 시간으로 seek하고 완료를 대기합니다.
 */
async function seekTo(
  video: HTMLVideoElement,
  time: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve(true);
    };

    const onError = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve(false);
    };

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = time;
  });
}

/**
 * 비디오의 현재 프레임을 canvas에 그려 dataURL로 반환합니다.
 */
function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): string {
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

/**
 * 비디오 URL에서 일정 간격으로 프레임을 캡처하여
 * ThumbnailData를 생성합니다.
 *
 * frameCount: 추출할 총 프레임 수 (기본 10)
 * thumbWidth/Height: 각 프레임의 해상도 (기본 160x90)
 *
 * 실패 시 null을 반환합니다.
 */
export async function generateThumbnails(
  url: string,
  assetId: string,
  frameCount: number = DEFAULT_FRAME_COUNT,
  thumbWidth: number = DEFAULT_THUMB_WIDTH,
  thumbHeight: number = DEFAULT_THUMB_HEIGHT,
): Promise<ThumbnailData | null> {
  const video = await createVideoElement(url);
  if (video === null) return null;

  const duration = video.duration;
  if (!isFinite(duration) || duration <= 0) return null;

  const interval = duration / frameCount;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx === null) return null;

  const frames: string[] = [];

  for (let i = 0; i < frameCount; i++) {
    const time = i * interval;
    const seeked = await seekTo(video, time);

    if (seeked) {
      const dataUrl = captureFrame(video, canvas, ctx, thumbWidth, thumbHeight);
      frames.push(dataUrl);
    } else {
      frames.push('');
    }
  }

  video.src = '';
  video.load();

  return {
    assetId,
    frames,
    interval,
  };
}

/**
 * ThumbnailData에서 특정 시간에 해당하는 프레임 인덱스를 계산하고
 * dataURL을 반환합니다. 범위를 벗어나면 null을 반환합니다.
 */
export function getThumbnailAtTime(
  data: ThumbnailData,
  time: number,
): string | null {
  if (data.frames.length === 0) return null;
  if (data.interval <= 0) return null;

  const index = Math.min(
    Math.floor(time / data.interval),
    data.frames.length - 1,
  );

  const frame = data.frames[Math.max(0, index)];
  return frame.length > 0 ? frame : null;
}

/**
 * 썸네일 생성이 실패했을 때의 폴백입니다.
 * 빈 프레임 배열을 가진 ThumbnailData를 반환합니다.
 * UI에서 "Generating..." 표시를 유지하지 않고 빈 상태로 확정합니다.
 */
export function createEmptyThumbnails(
  assetId: string,
  duration: number,
  frameCount: number = DEFAULT_FRAME_COUNT,
): ThumbnailData {
  const interval = duration / frameCount;
  return {
    assetId,
    frames: [],
    interval,
  };
}
