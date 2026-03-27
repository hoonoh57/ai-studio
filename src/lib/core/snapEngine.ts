import type { Project } from '@/types/project';
import type { Marker, InOutRange, Transition, SnapPoint, WaveformData, ThumbnailData } from '@/types/project';

// === Timeline Engine Snap Utilities ===

export function collectSnapPoints(
  project: Project,
  markers: readonly Marker[],
  inOut: InOutRange,
  playheadTime: number
): SnapPoint[] {
  const points: SnapPoint[] = [];

  for (const track of project.tracks) {
    for (const clip of track.clips) {
      points.push({ time: clip.timelineStart, source: 'clip-start', trackId: track.id });
      points.push({ time: clip.timelineEnd, source: 'clip-end', trackId: track.id });
    }
  }

  points.push({ time: playheadTime, source: 'playhead' });

  for (const marker of markers) {
    points.push({ time: marker.time, source: 'marker', trackId: undefined });
  }

  if (typeof inOut?.inPoint === 'number') {
    points.push({ time: inOut.inPoint, source: 'in-out' });
  }

  if (typeof inOut?.outPoint === 'number') {
    points.push({ time: inOut.outPoint, source: 'in-out' });
  }

  return points.sort((a, b) => a.time - b.time);
}

export function findNearestSnap(
  time: number,
  snapPoints: readonly SnapPoint[],
  threshold = 0.1
): { snapped: number; point: SnapPoint } | null {
  let nearest: { snapped: number; point: SnapPoint } | null = null;

  for (const point of snapPoints) {
    const delta = Math.abs(time - point.time);
    if (delta > threshold) continue;

    if (nearest === null || delta < Math.abs(time - nearest.snapped)) {
      nearest = { snapped: point.time, point };
    }
  }

  return nearest;
}

export function snapTime(
  time: number,
  project: Project,
  markers: readonly Marker[],
  inOut: InOutRange,
  playheadTime: number,
  snapEnabled: boolean,
  zoom: number
): number {
  if (!snapEnabled) return time;

  const snapPoints = collectSnapPoints(project, markers, inOut, playheadTime);
  const adjustedThreshold = Math.max(0.001, 0.1 / Math.max(0.1, zoom));
  const nearest = findNearestSnap(time, snapPoints, adjustedThreshold);

  return nearest ? nearest.snapped : time;
}
