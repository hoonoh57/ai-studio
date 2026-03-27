// src/lib/core/trimEngine.ts

import type { Clip, Track } from '@/types/project';

export type ClipUpdate = { clipId: string; updates: Partial<Clip> };

const MIN_CLIP_DURATION = 0.1;

/**
 * 같은 트랙에서 특정 클립을 제외하고,
 * timelineStart 기준 정렬된 클립 목록을 반환합니다.
 */
function getTrackClipsSorted(
  track: Track,
  excludeId?: string,
): readonly Clip[] {
  return track.clips
    .filter((c) => c.id !== excludeId)
    .sort((a, b) => a.timelineStart - b.timelineStart);
}

/**
 * 특정 클립의 바로 앞/뒤 인접 클립을 찾습니다.
 */
function findNeighbors(
  track: Track,
  clipId: string,
): { prev: Clip | null; next: Clip | null } {
  const sorted = track.clips
    .slice()
    .sort((a, b) => a.timelineStart - b.timelineStart);
  const idx = sorted.findIndex((c) => c.id === clipId);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? sorted[idx - 1] : null,
    next: idx < sorted.length - 1 ? sorted[idx + 1] : null,
  };
}

/**
 * Normal Trim — 한쪽 끝만 이동합니다.
 * side='left': timelineStart 변경 (sourceStart도 연동)
 * side='right': timelineEnd 변경 (sourceEnd도 연동)
 */
export function normalTrim(
  clip: Clip,
  side: 'left' | 'right',
  deltaTime: number,
): ClipUpdate | null {
  if (side === 'left') {
    const newStart = Math.max(0, clip.timelineStart + deltaTime);
    if (clip.timelineEnd - newStart < MIN_CLIP_DURATION) return null;
    const sourceDelta = newStart - clip.timelineStart;
    return {
      clipId: clip.id,
      updates: {
        timelineStart: newStart,
        sourceStart: clip.sourceStart + sourceDelta,
      },
    };
  }

  const newEnd = clip.timelineEnd + deltaTime;
  if (newEnd - clip.timelineStart < MIN_CLIP_DURATION) return null;
  const sourceDelta = newEnd - clip.timelineEnd;
  return {
    clipId: clip.id,
    updates: {
      timelineEnd: newEnd,
      sourceEnd: clip.sourceEnd + sourceDelta,
    },
  };
}

/**
 * Ripple Trim — 트림 후 뒤(또는 앞) 클립들을 자동 밀기/당기기합니다.
 * 같은 트랙의 클립만 영향을 받습니다.
 */
export function rippleTrim(
  clip: Clip,
  track: Track,
  side: 'left' | 'right',
  deltaTime: number,
): readonly ClipUpdate[] {
  const primary = normalTrim(clip, side, deltaTime);
  if (primary === null) return [];

  const results: ClipUpdate[] = [primary];
  const newStart = primary.updates.timelineStart ?? clip.timelineStart;
  const newEnd = primary.updates.timelineEnd ?? clip.timelineEnd;

  if (side === 'right') {
    const shift = newEnd - clip.timelineEnd;
    const sorted = getTrackClipsSorted(track, clip.id);
    for (const other of sorted) {
      if (other.timelineStart >= clip.timelineEnd) {
        results.push({
          clipId: other.id,
          updates: {
            timelineStart: other.timelineStart + shift,
            timelineEnd: other.timelineEnd + shift,
          },
        });
      }
    }
  } else {
    const shift = newStart - clip.timelineStart;
    const sorted = getTrackClipsSorted(track, clip.id);
    for (const other of sorted) {
      if (other.timelineEnd <= clip.timelineStart) {
        results.push({
          clipId: other.id,
          updates: {
            timelineStart: Math.max(0, other.timelineStart + shift),
            timelineEnd: Math.max(MIN_CLIP_DURATION, other.timelineEnd + shift),
          },
        });
      }
    }
  }

  return results;
}

/**
 * Roll Trim — 두 인접 클립의 접점을 동시에 이동합니다.
 * clipA의 끝과 clipB의 시작이 동시에 deltaTime만큼 움직입니다.
 * 전체 타임라인 길이는 변하지 않습니다.
 */
export function rollTrim(
  clipA: Clip,
  clipB: Clip,
  deltaTime: number,
): readonly ClipUpdate[] {
  const newAEnd = clipA.timelineEnd + deltaTime;
  const newBStart = clipB.timelineStart + deltaTime;

  if (newAEnd - clipA.timelineStart < MIN_CLIP_DURATION) return [];
  if (clipB.timelineEnd - newBStart < MIN_CLIP_DURATION) return [];

  const aDelta = newAEnd - clipA.timelineEnd;
  const bDelta = newBStart - clipB.timelineStart;

  return [
    {
      clipId: clipA.id,
      updates: {
        timelineEnd: newAEnd,
        sourceEnd: clipA.sourceEnd + aDelta,
      },
    },
    {
      clipId: clipB.id,
      updates: {
        timelineStart: newBStart,
        sourceStart: clipB.sourceStart + bDelta,
      },
    },
  ];
}

/**
 * Slip Trim — 타임라인 위치는 유지하고 소스 구간만 이동합니다.
 * 클립의 시작/끝은 그대로이고, 내부에 보이는 영상 구간이 바뀝니다.
 * assetDuration을 초과하지 않도록 보호합니다.
 */
export function slipTrim(
  clip: Clip,
  deltaTime: number,
  assetDuration: number,
): ClipUpdate | null {
  const newSourceStart = clip.sourceStart + deltaTime;
  const newSourceEnd = clip.sourceEnd + deltaTime;

  if (newSourceStart < 0) return null;
  if (newSourceEnd > assetDuration) return null;

  return {
    clipId: clip.id,
    updates: {
      sourceStart: newSourceStart,
      sourceEnd: newSourceEnd,
    },
  };
}

/**
 * Slide Trim — 클립 자체를 이동하면서 양옆 인접 클립의 끝/시작을 자동 조정합니다.
 * 클립의 소스 구간은 변하지 않고, 타임라인 위치만 이동합니다.
 * 인접 클립이 없는 쪽은 자유롭게 이동합니다.
 */
export function slideTrim(
  clip: Clip,
  track: Track,
  deltaTime: number,
): readonly ClipUpdate[] {
  const { prev, next } = findNeighbors(track, clip.id);
  const clipDuration = clip.timelineEnd - clip.timelineStart;

  const newStart = Math.max(0, clip.timelineStart + deltaTime);
  const newEnd = newStart + clipDuration;

  if (prev !== null) {
    const newPrevEnd = newStart;
    if (newPrevEnd - prev.timelineStart < MIN_CLIP_DURATION) return [];
  }

  if (next !== null) {
    const newNextStart = newEnd;
    if (next.timelineEnd - newNextStart < MIN_CLIP_DURATION) return [];
  }

  const results: ClipUpdate[] = [
    {
      clipId: clip.id,
      updates: {
        timelineStart: newStart,
        timelineEnd: newEnd,
      },
    },
  ];

  if (prev !== null) {
    const prevDelta = newStart - prev.timelineEnd;
    results.push({
      clipId: prev.id,
      updates: {
        timelineEnd: newStart,
        sourceEnd: prev.sourceEnd + prevDelta,
      },
    });
  }

  if (next !== null) {
    const nextDelta = newEnd - next.timelineStart;
    results.push({
      clipId: next.id,
      updates: {
        timelineStart: newEnd,
        sourceStart: next.sourceStart + nextDelta,
      },
    });
  }

  return results;
}

/**
 * trimMode에 따라 적절한 트림 함수를 선택하여 실행합니다.
 * Roll/Slide는 인접 클립이 필요하므로 track 정보를 사용합니다.
 */
export function executeTrim(
  clip: Clip,
  track: Track,
  side: 'left' | 'right',
  deltaTime: number,
  trimMode: string,
  assetDuration: number,
): readonly ClipUpdate[] {
  switch (trimMode) {
    case 'normal': {
      const result = normalTrim(clip, side, deltaTime);
      return result !== null ? [result] : [];
    }
    case 'ripple':
      return rippleTrim(clip, track, side, deltaTime);
    case 'roll': {
      const { prev, next } = findNeighbors(track, clip.id);
      const neighbor = side === 'left' ? prev : next;
      if (neighbor === null) {
        const result = normalTrim(clip, side, deltaTime);
        return result !== null ? [result] : [];
      }
      return side === 'left'
        ? rollTrim(neighbor, clip, deltaTime)
        : rollTrim(clip, neighbor, deltaTime);
    }
    case 'slip': {
      const result = slipTrim(clip, deltaTime, assetDuration);
      return result !== null ? [result] : [];
    }
    case 'slide':
      return slideTrim(clip, track, deltaTime);
    default: {
      const result = normalTrim(clip, side, deltaTime);
      return result !== null ? [result] : [];
    }
  }
}
