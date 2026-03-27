// src/lib/core/waveformGenerator.ts

import type { WaveformData } from '@/types/project';

const DEFAULT_PEAK_COUNT = 200;

/**
 * AudioBuffer에서 peak 배열을 추출합니다.
 * 각 peak는 0~1 범위로 정규화됩니다.
 * 모든 채널의 절대값 최대치를 사용합니다.
 */
export function extractPeaks(
  audioBuffer: AudioBuffer,
  peakCount: number = DEFAULT_PEAK_COUNT,
): readonly number[] {
  const channelCount = audioBuffer.numberOfChannels;
  const frameCount = audioBuffer.length;
  const framesPerPeak = Math.max(1, Math.floor(frameCount / peakCount));
  const peaks: number[] = [];

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < channelCount; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  for (let i = 0; i < peakCount; i++) {
    const start = i * framesPerPeak;
    const end = Math.min(start + framesPerPeak, frameCount);
    let max = 0;

    for (let frame = start; frame < end; frame++) {
      for (let ch = 0; ch < channelCount; ch++) {
        const abs = Math.abs(channels[ch][frame]);
        if (abs > max) max = abs;
      }
    }

    peaks.push(max);
  }

  return peaks;
}

/**
 * ArrayBuffer를 AudioBuffer로 디코딩합니다.
 * 디코딩 실패 시 null을 반환합니다.
 */
export async function decodeAudio(
  arrayBuffer: ArrayBuffer,
): Promise<AudioBuffer | null> {
  try {
    const ctx = new OfflineAudioContext(1, 1, 44100);
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    return decoded;
  } catch {
    return null;
  }
}

/**
 * URL에서 오디오를 fetch하여 WaveformData를 생성합니다.
 * 비디오 URL도 지원합니다 (브라우저가 오디오 트랙을 디코딩).
 * 실패 시 null을 반환합니다.
 */
export async function generateWaveformFromUrl(
  url: string,
  assetId: string,
  peakCount: number = DEFAULT_PEAK_COUNT,
): Promise<WaveformData | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await decodeAudio(arrayBuffer);
    if (audioBuffer === null) return null;

    const peaks = extractPeaks(audioBuffer, peakCount);

    return {
      assetId,
      peaks,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
    };
  } catch {
    return null;
  }
}

/**
 * Blob/File 객체에서 직접 WaveformData를 생성합니다.
 * MediaPanel에서 파일 임포트 시 사용할 수 있습니다.
 */
export async function generateWaveformFromBlob(
  blob: Blob,
  assetId: string,
  peakCount: number = DEFAULT_PEAK_COUNT,
): Promise<WaveformData | null> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await decodeAudio(arrayBuffer);
    if (audioBuffer === null) return null;

    const peaks = extractPeaks(audioBuffer, peakCount);

    return {
      assetId,
      peaks,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
    };
  } catch {
    return null;
  }
}

/**
 * Web Audio API 디코딩이 실패할 경우의 폴백입니다.
 * HTMLMediaElement의 재생 시간 기반으로 빈 파형을 생성합니다.
 * UI에서 "파형 없음" 대신 무음 막대라도 표시하기 위함입니다.
 */
export function createEmptyWaveform(
  assetId: string,
  duration: number,
  peakCount: number = DEFAULT_PEAK_COUNT,
): WaveformData {
  const peaks: number[] = new Array(peakCount).fill(0.02);
  return {
    assetId,
    peaks,
    sampleRate: 44100,
    duration,
  };
}
