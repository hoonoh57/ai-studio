// src/lib/core/snapEngine.ts

import type { Track, Marker, InOutRange, SnapPoint } from '@/types/project';

const SNAP_SOURCES = {
  clipStart: 'clip-start',
  clipEnd: 'clip-end',
  playhead: 'playhead',
  marker: 'marker',
  inOut: 'in-out',
} as const;

/**
 * 프로젝트의 모든 스냅 포인트를 수집합니다.
 * 클립 시작/끝, 재생헤드, 마커, In/Out 포인트를 포함합니다.
 */
export function collectSnapPoints(
  tracks: readonly Track[],
  markers: readonly Marker[],
  inOut: InOutRange,
  playheadTime: number,
  projectDuration: number,
): readonly SnapPoint[] {
  const points: SnapPoint[] = [];
  const seen = new Set<number>();

  const add = (time: number, source: SnapPoint['source'], trackId?: string) => {
    const rounded = Math.round(time * 1000) / 1000;
    if (seen.has(rounded) && source !== 'clip-start' && source !== 'clip-end') return;
    seen.add(rounded);
    points.push({ time: rounded, source, trackId });
  };

  add(0, 'clip-start');
  add(projectDuration, 'clip-end');

  for (const track of tracks) {
    for (const clip of track.clips) {
      add(clip.startTime, 'clip-start', track.id);
      add(clip.startTime + clip.duration, 'clip-end', track.id);
    }
  }

  add(playheadTime, 'playhead');

  for (const marker of markers) {
    add(marker.time, 'marker');
  }

  if (inOut.inPoint !== null) {
    add(inOut.inPoint, 'in');
  }
  if (inOut.outPoint !== null) {
    add(inOut.outPoint, 'out');
  }

  return points;
}

/**
 * 주어진 시간에서 가장 가까운 스냅 포인트를 찾습니다.
 * threshold(초) 이내에 없으면 null을 반환합니다.
 */
export function findNearestSnap(
  time: number,
  snapPoints: readonly SnapPoint[],
  threshold: number,
): { snapped: number; point: SnapPoint } | null {
  let closest: SnapPoint | null = null;
  let minDiff = threshold;

  for (const point of snapPoints) {
    const diff = Math.abs(time - point.time);
    if (diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }

  if (closest === null) return null;

  return { snapped: closest.time, point: closest };
}

/**
 * 스냅이 활성화되어 있으면 가장 가까운 스냅 포인트로 보정된 시간을 반환합니다.
 */
export function snapTime(
  time: number,
  tracks: readonly Track[],
  markers: readonly Marker[] | undefined,
  inOut: InOutRange | undefined,
  playheadTime: number,
  projectDuration: number,
  snapEnabled: boolean,
  zoom: number,
): number {
  if (!snapEnabled) return time;

  const baseThreshold = 0.2;
  const threshold = baseThreshold / Math.max(0.1, zoom);

  const points = collectSnapPoints(
    tracks,
    markers ?? [],
    inOut ?? { inPoint: null, outPoint: null },
    playheadTime,
    projectDuration,
  );

  const result = findNearestSnap(time, points, threshold);

  return result !== null ? result.snapped : time;
}
