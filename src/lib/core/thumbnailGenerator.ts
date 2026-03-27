import type { ThumbnailData } from '@/types/project';

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = url;
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const onLoaded = () => {
      cleanup();
      resolve(video);
    };

    const onError = (e: Event | string) => {
      cleanup();
      reject(new Error(`Video load failed: ${e}`));
    };

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
  });
}

export async function generateThumbnails(
  videoUrl: string,
  interval: number,
  width: number,
  assetId = videoUrl
): Promise<ThumbnailData> {
  const video = await loadVideo(videoUrl);
  const duration = video.duration;
  const frameCount = Math.max(1, Math.ceil(duration / interval));

  const canvas = document.createElement('canvas');
  const scale = width / video.videoWidth;
  canvas.width = width;
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  const frames: string[] = [];

  for (let i = 0; i < frameCount; i += 1) {
    const time = Math.min(duration, i * interval);
    await new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/jpeg', 0.6));
        cleanup();
        resolve();
      };

      const onError = (e: Event) => {
        cleanup();
        reject(new Error(`Video seek error at ${time}: ${e}`));
      };

      const cleanup = () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
      };

      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);
      video.currentTime = time;
    });
  }

  return {
    assetId,
    frames,
    interval,
  };
}

export function getThumbnailAtTime(thumbnailData: ThumbnailData, time: number): string | null {
  if (!thumbnailData.frames.length || thumbnailData.interval <= 0) {
    return null;
  }

  const index = Math.round(time / thumbnailData.interval);
  if (index < 0 || index >= thumbnailData.frames.length) {
    return null;
  }

  return thumbnailData.frames[index];
}
