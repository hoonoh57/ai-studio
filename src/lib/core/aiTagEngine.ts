// src/lib/core/aiTagEngine.ts
// 브라우저 내 경량 AI 분석 — 프라이버시 퍼스트 (서버 전송 없음)

import type { AITag } from '@/types/media';

// ── 상수 ──
const SAMPLE_SIZE = 64;
const SAMPLE_POINTS = [0.1, 0.5, 0.9];
const PIXEL_STEP = 16;
const BRIGHTNESS_HIGH = 170;
const BRIGHTNESS_LOW = 85;
const SATURATION_HIGH = 0.5;
const SATURATION_LOW = 0.15;
const RMS_LOUD = 0.15;
const RMS_QUIET = 0.03;
const SFX_MAX_DURATION = 5;
const BGM_MIN_DURATION = 60;
const RATIO_TOLERANCE = 0.1;
const WIDE_RATIO = 16 / 9;
const PORTRAIT_RATIO = 9 / 16;
const SQUARE_RATIO = 1;
const RES_4K = 3840;
const RES_FHD = 1920;
const RES_HD = 1280;
const FILENAME_CONFIDENCE = 0.6;
const COLOR_CONFIDENCE = 0.7;
const BRIGHTNESS_CONFIDENCE = 0.8;
const RESOLUTION_CONFIDENCE = 1.0;
const RATIO_CONFIDENCE = 0.9;
const AUDIO_CONFIDENCE = 0.7;
const AUDIO_TYPE_CONFIDENCE = 0.6;
const MIN_WORD_LENGTH = 2;

// ── 파일명 기반 태그 추출 ──
export function extractTagsFromFilename(filename: string): AITag[] {
  const name = filename.toLowerCase().replace(/\.[^.]+$/, '');
  const words = name.split(/[-_.\s]+/).filter(w => w.length >= MIN_WORD_LENGTH);

  return words.map(word => ({
    label: word,
    confidence: FILENAME_CONFIDENCE,
    source: 'auto' as const,
  }));
}

// ── 비디오에서 canvas로 프레임 캡처 후 RGB 평균 추출 ──
function loadVideoElement(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.muted = true;
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error('Video load failed'));
    video.src = url;
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise(resolve => {
    video.onseeked = () => resolve();
    video.currentTime = time;
  });
}

interface ColorSample {
  readonly avgR: number;
  readonly avgG: number;
  readonly avgB: number;
  readonly avgBrightness: number;
  readonly saturation: number;
}

function analyzeCanvasColors(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): ColorSample {
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;

  for (let i = 0; i < pixels.length; i += PIXEL_STEP) {
    totalR += pixels[i];
    totalG += pixels[i + 1];
    totalB += pixels[i + 2];
    count++;
  }

  if (count === 0) {
    return { avgR: 0, avgG: 0, avgB: 0, avgBrightness: 0, saturation: 0 };
  }

  const avgR = totalR / count;
  const avgG = totalG / count;
  const avgB = totalB / count;
  const avgBrightness = (avgR + avgG + avgB) / 3;
  const maxC = Math.max(avgR, avgG, avgB);
  const minC = Math.min(avgR, avgG, avgB);
  const saturation = maxC > 0 ? (maxC - minC) / maxC : 0;

  return { avgR, avgG, avgB, avgBrightness, saturation };
}

function colorSampleToTags(sample: ColorSample): AITag[] {
  const tags: AITag[] = [];

  // 밝기
  if (sample.avgBrightness > BRIGHTNESS_HIGH) {
    tags.push({ label: '밝은', confidence: BRIGHTNESS_CONFIDENCE, source: 'auto' });
  } else if (sample.avgBrightness < BRIGHTNESS_LOW) {
    tags.push({ label: '어두운', confidence: BRIGHTNESS_CONFIDENCE, source: 'auto' });
  }

  // 색조
  if (sample.avgR > sample.avgG && sample.avgR > sample.avgB) {
    tags.push({ label: '따뜻한', confidence: COLOR_CONFIDENCE, source: 'auto' });
  } else if (sample.avgB > sample.avgR && sample.avgB > sample.avgG) {
    tags.push({ label: '차가운', confidence: COLOR_CONFIDENCE, source: 'auto' });
  } else if (sample.avgG > sample.avgR && sample.avgG > sample.avgB) {
    tags.push({ label: '자연', confidence: COLOR_CONFIDENCE, source: 'auto' });
  }

  // 채도
  if (sample.saturation > SATURATION_HIGH) {
    tags.push({ label: '선명한', confidence: COLOR_CONFIDENCE, source: 'auto' });
  } else if (sample.saturation < SATURATION_LOW) {
    tags.push({ label: '무채색', confidence: COLOR_CONFIDENCE, source: 'auto' });
  }

  return tags;
}

// ── 비디오 색감 분석 (3개 시점 프레임 샘플링) ──
export async function analyzeVideoColorTone(
  videoUrl: string,
): Promise<AITag[]> {
  try {
    const video = await loadVideoElement(videoUrl);
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return [];

    const duration = video.duration;
    const sampleTimes = SAMPLE_POINTS.map(p => duration * p);

    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let totalBrightness = 0;
    let sampleCount = 0;

    for (const time of sampleTimes) {
      await seekVideo(video, time);
      ctx.drawImage(video, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      const sample = analyzeCanvasColors(ctx, SAMPLE_SIZE, SAMPLE_SIZE);
      totalR += sample.avgR;
      totalG += sample.avgG;
      totalB += sample.avgB;
      totalBrightness += sample.avgBrightness;
      sampleCount++;
    }

    if (sampleCount === 0) return [];

    const merged: ColorSample = {
      avgR: totalR / sampleCount,
      avgG: totalG / sampleCount,
      avgB: totalB / sampleCount,
      avgBrightness: totalBrightness / sampleCount,
      saturation: (() => {
        const r = totalR / sampleCount;
        const g = totalG / sampleCount;
        const b = totalB / sampleCount;
        const mx = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return mx > 0 ? (mx - min) / mx : 0;
      })(),
    };

    return colorSampleToTags(merged);
  } catch {
    return [];
  }
}

// ── 오디오 특성 분석 (RMS + 길이) ──
export async function analyzeAudioCharacter(
  audioUrl: string,
): Promise<AITag[]> {
  try {
    const response = await fetch(audioUrl);
    const buffer = await response.arrayBuffer();
    const sampleRate = 44100;
    const audioCtx = new OfflineAudioContext(1, sampleRate, sampleRate);
    const decoded = await audioCtx.decodeAudioData(buffer);
    const channelData = decoded.getChannelData(0);

    // RMS 볼륨
    let sum = 0;
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sum / channelData.length);

    const tags: AITag[] = [];

    if (rms > RMS_LOUD) {
      tags.push({ label: '시끄러운', confidence: AUDIO_CONFIDENCE, source: 'auto' });
    } else if (rms < RMS_QUIET) {
      tags.push({ label: '조용한', confidence: AUDIO_CONFIDENCE, source: 'auto' });
    }

    // 길이 기반 분류
    if (decoded.duration < SFX_MAX_DURATION) {
      tags.push({ label: '효과음', confidence: AUDIO_TYPE_CONFIDENCE, source: 'auto' });
    } else if (decoded.duration > BGM_MIN_DURATION) {
      tags.push({ label: 'BGM', confidence: AUDIO_TYPE_CONFIDENCE, source: 'auto' });
    }

    return tags;
  } catch {
    return [];
  }
}

// ── 이미지/비디오 해상도 + 비율 태그 ──
export function analyzeResolution(
  width: number,
  height: number,
): AITag[] {
  const tags: AITag[] = [];
  const ratio = width / height;

  // 해상도 등급
  if (width >= RES_4K) {
    tags.push({ label: '4K', confidence: RESOLUTION_CONFIDENCE, source: 'auto' });
  } else if (width >= RES_FHD) {
    tags.push({ label: 'FHD', confidence: RESOLUTION_CONFIDENCE, source: 'auto' });
  } else if (width >= RES_HD) {
    tags.push({ label: 'HD', confidence: RESOLUTION_CONFIDENCE, source: 'auto' });
  }

  // 화면 비율
  if (Math.abs(ratio - WIDE_RATIO) < RATIO_TOLERANCE) {
    tags.push({ label: '와이드', confidence: RATIO_CONFIDENCE, source: 'auto' });
  } else if (Math.abs(ratio - PORTRAIT_RATIO) < RATIO_TOLERANCE) {
    tags.push({ label: '세로형', confidence: RATIO_CONFIDENCE, source: 'auto' });
  } else if (Math.abs(ratio - SQUARE_RATIO) < RATIO_TOLERANCE) {
    tags.push({ label: '정사각형', confidence: RATIO_CONFIDENCE, source: 'auto' });
  }

  return tags;
}

// ── 중복 태그 제거 ──
function deduplicateTags(tags: readonly AITag[]): AITag[] {
  const seen = new Set<string>();
  return tags.filter(tag => {
    const key = tag.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── 통합 자동 태깅 (임포트 시 호출) ──
export async function autoTagAsset(
  asset: {
    readonly name: string;
    readonly type: string;
    readonly src: string;
    readonly width?: number;
    readonly height?: number;
  },
): Promise<AITag[]> {
  const tags: AITag[] = [];

  // 1. 파일명 분석 (동기)
  tags.push(...extractTagsFromFilename(asset.name));

  // 2. 해상도 분석 (동기)
  if (asset.width !== undefined && asset.height !== undefined) {
    tags.push(...analyzeResolution(asset.width, asset.height));
  }

  // 3. 미디어 타입별 비동기 분석
  if (asset.type === 'video') {
    const colorTags = await analyzeVideoColorTone(asset.src);
    tags.push(...colorTags);
  } else if (asset.type === 'audio') {
    const audioTags = await analyzeAudioCharacter(asset.src);
    tags.push(...audioTags);
  }

  return deduplicateTags(tags);
}
