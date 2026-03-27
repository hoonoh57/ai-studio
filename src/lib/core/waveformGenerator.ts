import type { WaveformData } from '@/types/project';

function getAudioContext() {
  return new (window.AudioContext || window.webkitAudioContext)();
}

export function generateWaveformData(
  audioBuffer: AudioBuffer,
  samplesPerPeak = 256,
  assetId = 'unknown'
): WaveformData {
  const channelData = [] as Float32Array[];
  for (let i = 0; i < audioBuffer.numberOfChannels; i += 1) {
    channelData.push(audioBuffer.getChannelData(i));
  }

  const sampleCount = audioBuffer.length;
  const peakCount = Math.ceil(sampleCount / samplesPerPeak);
  const peaks: number[] = [];

  for (let peakIndex = 0; peakIndex < peakCount; peakIndex += 1) {
    const start = peakIndex * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, sampleCount);
    let maxAbs = 0;

    for (let c = 0; c < channelData.length; c += 1) {
      const channel = channelData[c];
      for (let i = start; i < end; i += 1) {
        const absval = Math.abs(channel[i]);
        if (absval > maxAbs) maxAbs = absval;
      }
    }

    peaks.push(Math.min(1, maxAbs));
  }

  return {
    assetId,
    peaks,
    sampleRate: audioBuffer.sampleRate,
    duration: audioBuffer.duration,
  };
}

export async function decodeAudioFromFile(file: File | Blob): Promise<AudioBuffer> {
  const context = getAudioContext();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await context.decodeAudioData(arrayBuffer);
    return decoded;
  } catch (error) {
    console.error('decodeAudioFromFile error:', error);
    return context.createBuffer(1, 1, 44100);
  }
}

export async function generateWaveformFromUrl(
  url: string,
  samplesPerPeak = 256,
  assetId = url
): Promise<WaveformData> {
  const context = getAudioContext();

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio URL: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await context.decodeAudioData(arrayBuffer);
    return generateWaveformData(audioBuffer, samplesPerPeak, assetId);
  } catch (error) {
    console.error('generateWaveformFromUrl error:', error);
    const emptyBuffer = context.createBuffer(1, 1, 44100);
    return generateWaveformData(emptyBuffer, samplesPerPeak, assetId);
  }
}
