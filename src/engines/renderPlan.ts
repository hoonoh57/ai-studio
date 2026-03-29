/* ─── src/engines/renderPlan.ts ─── */
/* 타임라인 분석 → 구간별 최적 처리 방식 자동 결정 */

import type { Track, Clip, Asset } from '@/types/project';

/* ═══ 타입 정의 ═══ */

export type SegmentType = 'passthrough' | 'transcode' | 'composite';

export interface RenderSegment {
  type: SegmentType;
  startTime: number;   // export 범위 내 상대 시간 (초)
  endTime: number;
  reasons: string[];
  /** 이 구간에서 활성화된 비디오 클립 (1개만 있어야 passthrough/transcode 가능) */
  videoClips: { clip: Clip; asset: Asset }[];
  /** 이 구간에서 활성화된 텍스트 클립 */
  textClips: Clip[];
  /** 이미지, 이펙트 등 오버레이 레이어 존재 여부 */
  hasImageOverlay: boolean;
  hasEffect: boolean;
}

export interface RenderPlan {
  segments: RenderSegment[];
  totalDuration: number;
  passthroughDuration: number;
  transcodeDuration: number;
  compositeDuration: number;
}

/* ═══ 변화 지점 수집 ═══ */

function collectChangePoints(
  tracks: Track[],
  rangeStart: number,
  rangeEnd: number,
): number[] {
  const points = new Set<number>();
  points.add(rangeStart);
  points.add(rangeEnd);

  for (const track of tracks) {
    if (track.muted) continue;
    for (const clip of track.clips) {
      if (clip.disabled) continue;
      const cs = clip.startTime;
      const ce = cs + clip.duration;
      // 범위와 겹치는 클립의 시작/끝을 수집
      if (ce > rangeStart && cs < rangeEnd) {
        if (cs > rangeStart) points.add(cs);
        if (ce < rangeEnd) points.add(ce);
      }
    }
  }

  return [...points].sort((a, b) => a - b);
}

/* ═══ 특정 시각에 활성화된 레이어 수집 ═══ */

function getActiveClipsAt(
  tracks: Track[],
  time: number,
  assets: Asset[],
): {
  videoClips: { clip: Clip; asset: Asset }[];
  textClips: Clip[];
  hasImageOverlay: boolean;
  hasEffect: boolean;
} {
  const videoClips: { clip: Clip; asset: Asset }[] = [];
  const textClips: Clip[] = [];
  let hasImageOverlay = false;
  let hasEffect = false;

  for (const track of tracks) {
    if (track.muted) continue;
    for (const clip of track.clips) {
      if (clip.disabled) continue;
      const cs = clip.startTime;
      const ce = cs + clip.duration;
      if (time < cs || time >= ce) continue;

      if (track.type === 'video') {
        const asset = assets.find(a => a.id === clip.assetId);
        if (!asset) continue;
        if (asset.type === 'image') {
          hasImageOverlay = true;
        } else {
          videoClips.push({ clip, asset });
        }
      } else if (track.type === 'text') {
        if (clip.textContent) textClips.push(clip);
      } else if (track.type === 'effect') {
        hasEffect = true;
      }

      // 클립에 필터가 있으면 이펙트 취급
      if (clip.filters && clip.filters.length > 0) {
        hasEffect = true;
      }
    }
  }

  return { videoClips, textClips, hasImageOverlay, hasEffect };
}

/* ═══ 구간 타입 결정 ═══ */

function determineSegmentType(
  videoClips: { clip: Clip; asset: Asset }[],
  textClips: Clip[],
  hasImageOverlay: boolean,
  hasEffect: boolean,
  preset: { width: number; height: number },
): { type: SegmentType; reasons: string[] } {
  const reasons: string[] = [];

  // composite 필요 조건들
  if (videoClips.length > 1) {
    reasons.push(`다중 비디오 레이어(${videoClips.length}개)`);
    return { type: 'composite', reasons };
  }
  if (hasImageOverlay) {
    reasons.push('이미지 오버레이');
    return { type: 'composite', reasons };
  }
  if (textClips.length > 0) {
    reasons.push(`텍스트 오버레이(${textClips.length}개)`);
    return { type: 'composite', reasons };
  }
  if (hasEffect) {
    reasons.push('비디오 이펙트');
    return { type: 'composite', reasons };
  }

  // 비디오가 없는 구간 (갭) → 검은 화면 합성 필요
  if (videoClips.length === 0) {
    reasons.push('비디오 없음(갭)');
    return { type: 'composite', reasons };
  }

  // 단일 비디오만 존재 → 해상도 검사
  const asset = videoClips[0].asset;
  const srcW = asset.width ?? 0;
  const srcH = asset.height ?? 0;

  if (srcW > 0 && srcH > 0) {
    const sizesMatch =
      (Math.abs(srcW - preset.width) <= 2 && Math.abs(srcH - preset.height) <= 2) ||
      (Math.abs(srcW - preset.height) <= 2 && Math.abs(srcH - preset.width) <= 2);
    const smallerThanTarget = srcW <= preset.width && srcH <= preset.height;

    if (sizesMatch || smallerThanTarget) {
      reasons.push('원본 직접 복사 가능');
      return { type: 'passthrough', reasons };
    } else {
      reasons.push(`해상도 변환: ${srcW}x${srcH} → ${preset.width}x${preset.height}`);
      return { type: 'transcode', reasons };
    }
  }

  // 해상도 정보 없으면 안전하게 transcode
  reasons.push('소스 해상도 미확인');
  return { type: 'transcode', reasons };
}

/* ═══ 인접 동일 타입 구간 병합 ═══ */

function mergeAdjacentSegments(segments: RenderSegment[]): RenderSegment[] {
  if (segments.length <= 1) return segments;

  const merged: RenderSegment[] = [segments[0]];

  for (let i = 1; i < segments.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = segments[i];

    // 같은 타입 + 같은 소스 자산이면 병합
    const prevAssetIds = prev.videoClips.map(vc => vc.asset.id).join(',');
    const currAssetIds = curr.videoClips.map(vc => vc.asset.id).join(',');

    if (prev.type === curr.type && prevAssetIds === currAssetIds) {
      prev.endTime = curr.endTime;
      prev.reasons = [...new Set([...prev.reasons, ...curr.reasons])];
      prev.textClips = [...prev.textClips, ...curr.textClips];
      prev.hasImageOverlay = prev.hasImageOverlay || curr.hasImageOverlay;
      prev.hasEffect = prev.hasEffect || curr.hasEffect;
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

/* ═══ 메인: 타임라인 분석 ═══ */

export function analyzeTimeline(
  tracks: Track[],
  assets: Asset[],
  rangeStart: number,
  rangeEnd: number,
  preset: { width: number; height: number },
): RenderPlan {
  const changePoints = collectChangePoints(tracks, rangeStart, rangeEnd);

  const rawSegments: RenderSegment[] = [];

  for (let i = 0; i < changePoints.length - 1; i++) {
    const start = changePoints[i];
    const end = changePoints[i + 1];
    if (end - start < 0.001) continue; // 무시할 정도로 짧은 구간

    const midpoint = (start + end) / 2;
    const { videoClips, textClips, hasImageOverlay, hasEffect } =
      getActiveClipsAt(tracks, midpoint, assets);

    const { type, reasons } = determineSegmentType(
      videoClips, textClips, hasImageOverlay, hasEffect, preset,
    );

    rawSegments.push({
      type,
      startTime: start - rangeStart,  // 상대 시간으로 변환
      endTime: end - rangeStart,
      reasons,
      videoClips,
      textClips,
      hasImageOverlay,
      hasEffect,
    });
  }

  const segments = mergeAdjacentSegments(rawSegments);
  const totalDuration = rangeEnd - rangeStart;

  let passthroughDuration = 0;
  let transcodeDuration = 0;
  let compositeDuration = 0;

  for (const seg of segments) {
    const dur = seg.endTime - seg.startTime;
    if (seg.type === 'passthrough') passthroughDuration += dur;
    else if (seg.type === 'transcode') transcodeDuration += dur;
    else compositeDuration += dur;
  }

  return {
    segments,
    totalDuration,
    passthroughDuration,
    transcodeDuration,
    compositeDuration,
  };
}
