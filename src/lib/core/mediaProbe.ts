// src/lib/core/mediaProbe.ts
// 브라우저 환경에서 비디오/오디오 스트림 존재 여부를 판별

export interface MediaProbeResult {
  duration: number;
  width: number;
  height: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

/**
 * URL 또는 ObjectURL의 미디어를 <video> 엘리먼트로 로드하여
 * 오디오/비디오 스트림 존재 여부를 판별합니다.
 *
 * 판별 방법 (우선순위):
 * 1. HTMLMediaElement.audioTracks (Safari/일부 브라우저)
 * 2. webkitAudioDecodedByteCount (Chrome 레거시)
 * 3. Web Audio API decodeAudioData (가장 범용적)
 */
export function probeMedia(src: string): Promise<MediaProbeResult> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const timeoutId = setTimeout(() => {
      cleanup();
      resolve({
        duration: 0,
        width: 0,
        height: 0,
        hasVideo: false,
        hasAudio: false,
      });
    }, 10000);

    function cleanup() {
      clearTimeout(timeoutId);
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('error', onError);
      video.src = '';
      video.load();
    }

    function onError() {
      cleanup();
      resolve({
        duration: 0,
        width: 0,
        height: 0,
        hasVideo: false,
        hasAudio: false,
      });
    }

    async function onLoaded() {
      const duration = isFinite(video.duration) ? video.duration : 0;
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      const hasVideo = width > 0 && height > 0;

      // ── 오디오 판별 ──
      let hasAudio = false;

      // 방법 1: audioTracks API (Safari, 일부 브라우저)
      if ('audioTracks' in video) {
        const tracks = (video as any).audioTracks;
        if (tracks && tracks.length > 0) {
          hasAudio = true;
          cleanup();
          resolve({ duration, width, height, hasVideo, hasAudio });
          return;
        }
      }

      // 방법 2: webkitAudioDecodedByteCount (Chrome)
      if ('webkitAudioDecodedByteCount' in video) {
        // 짧은 재생 후 디코딩된 바이트 확인
        video.currentTime = 0;
        try {
          await video.play();
          // 100ms 대기
          await new Promise(r => setTimeout(r, 150));
          video.pause();
          hasAudio = (video as any).webkitAudioDecodedByteCount > 0;
          cleanup();
          resolve({ duration, width, height, hasVideo, hasAudio });
          return;
        } catch {
          // play 실패 → 방법 3으로
        }
      }

      // 방법 3: Web Audio API decodeAudioData
      try {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        const offlineCtx = new OfflineAudioContext(1, 1, 44100);
        const decoded = await offlineCtx.decodeAudioData(arrayBuffer);
        // 디코딩 성공 + 실제 데이터가 있으면 오디오 있음
        hasAudio = decoded.duration > 0 && decoded.length > 0;
      } catch {
        // 디코딩 실패 → 오디오 없음
        hasAudio = false;
      }

      cleanup();
      resolve({ duration, width, height, hasVideo, hasAudio });
    }

    video.addEventListener('loadeddata', onLoaded, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.src = src;
    video.load();
  });
}

/**
 * File/Blob 객체에서 미디어 프로브 수행
 */
export async function probeMediaBlob(file: Blob): Promise<MediaProbeResult> {
  const url = URL.createObjectURL(file);
  try {
    return await probeMedia(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
