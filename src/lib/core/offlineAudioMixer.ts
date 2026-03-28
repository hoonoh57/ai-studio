/* ─── src/lib/core/offlineAudioMixer.ts ─── */
/* B7-3: OfflineAudioContext 오프라인 오디오 믹스다운 → WAV Uint8Array */

import type { Track, Clip, Asset } from '@/types/project';

/**
 * 타임라인의 모든 오디오 트랙을 하나의 스테레오 WAV로 믹스다운.
 * @returns WAV 바이트 배열 (PCM 16-bit LE)
 */
export async function mixdownToWav(
  tracks: Track[],
  assets: Asset[],
  startTime: number,
  endTime: number,
  sampleRate = 44100,
): Promise<Uint8Array | null> {
  const duration = endTime - startTime;
  if (duration <= 0) return null;

  const audioTracks = tracks.filter(t => t.type === 'audio' && !t.muted && t.visible);
  if (audioTracks.length === 0) return null;

  /* 1) 모든 오디오 에셋 URL 수집 */
  const clipInfos: { clip: Clip; url: string }[] = [];
  for (const track of audioTracks) {
    const anySolo = audioTracks.some(t => t.solo);
    if (anySolo && !track.solo) continue;

    for (const clip of track.clips) {
      if (clip.disabled) continue;
      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd <= startTime || clip.startTime >= endTime) continue;

      const asset = assets.find(a => a.id === clip.assetId);
      if (!asset?.src) continue;
      clipInfos.push({ clip, url: asset.src });
    }
  }

  if (clipInfos.length === 0) return null;

  /* 2) OfflineAudioContext 생성 */
  const totalSamples = Math.ceil(duration * sampleRate);
  const offCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

  /* 3) 각 클립을 디코드 & 스케줄링 */
  for (const { clip, url } of clipInfos) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const arrBuf = await resp.arrayBuffer();
      const audioBuf = await offCtx.decodeAudioData(arrBuf);

      const source = offCtx.createBufferSource();
      source.buffer = audioBuf;
      source.playbackRate.value = clip.speed || 1;

      const gain = offCtx.createGain();
      gain.gain.value = clip.volume ?? 1;
      source.connect(gain);
      gain.connect(offCtx.destination);

      /* 클립 내 오프셋 (inPoint) */
      const clipInPoint = clip.inPoint || 0;
      /* 타임라인 기준 시작 (startTime 이전 부분 잘라냄) */
      const scheduleAt = Math.max(0, clip.startTime - startTime);
      const skipInSource = Math.max(0, startTime - clip.startTime) + clipInPoint;
      const playDuration = Math.min(
        clip.duration - Math.max(0, startTime - clip.startTime),
        endTime - Math.max(clip.startTime, startTime),
      );

      if (playDuration > 0) {
        source.start(scheduleAt, skipInSource, playDuration);
      }
    } catch (err) {
      console.warn('[OfflineAudioMixer] 클립 디코드 실패:', clip.id, err);
    }
  }

  /* 4) 렌더링 */
  const rendered = await offCtx.startRendering();

  /* 5) AudioBuffer → WAV (PCM 16-bit LE) */
  return audioBufferToWav(rendered);
}

function audioBufferToWav(buf: AudioBuffer): Uint8Array {
  const numCh = buf.numberOfChannels;
  const sr = buf.sampleRate;
  const len = buf.length;
  const bps = 2; // 16-bit
  const blockAlign = numCh * bps;
  const dataSize = len * blockAlign;
  const totalSize = 44 + dataSize;

  const out = new ArrayBuffer(totalSize);
  const v = new DataView(out);

  const ws = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };

  ws(0, 'RIFF');
  v.setUint32(4, totalSize - 8, true);
  ws(8, 'WAVE');
  ws(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, numCh, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * blockAlign, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, 16, true);
  ws(36, 'data');
  v.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numCh; ch++) channels.push(buf.getChannelData(ch));

  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }

  return new Uint8Array(out);
}
