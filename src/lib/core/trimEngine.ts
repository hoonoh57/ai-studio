// src/lib/core/trimEngine.ts

import type { Clip, Track } from '@/types/project';

export type ClipUpdate = { clipId: string; updates: Partial<Clip> };

const MIN_CLIP_DURATION = 0.1;

function findNeighbors(
  track: Track,
  clipId: string,
): { prev: Clip | null; next: Clip | null } {
  const sorted = track.clips
    .slice()
    .sort((a, b) => a.startTime - b.startTime);
  const idx = sorted.findIndex((c) => c.id === clipId);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? sorted[idx - 1] : null,
    next: idx < sorted.length - 1 ? sorted[idx + 1] : null,
  };
}

export function normalTrim(
  clip: Clip,
  side: 'left' | 'right',
  deltaTime: number,
): ClipUpdate | null {
  if (side === 'left') {
    const newStart = Math.max(0, clip.startTime + deltaTime);
    const newDur = clip.startTime + clip.duration - newStart;
    if (newDur < MIN_CLIP_DURATION) return null;
    const sourceDelta = newStart - clip.startTime;
    return {
      clipId: clip.id,
      updates: {
        startTime: newStart,
        duration: newDur,
        inPoint: clip.inPoint + sourceDelta,
      },
    };
  }

  const newDur = clip.duration + deltaTime;
  if (newDur < MIN_CLIP_DURATION) return null;
  return {
    clipId: clip.id,
    updates: {
      duration: newDur,
      outPoint: clip.inPoint + newDur,
    },
  };
}

export function rippleTrim(
  clip: Clip,
  track: Track,
  side: 'left' | 'right',
  deltaTime: number,
): readonly ClipUpdate[] {
  const primary = normalTrim(clip, side, deltaTime);
  if (primary === null) return [];

  const results: ClipUpdate[] = [primary];
  const newStart = primary.updates.startTime ?? clip.startTime;
  const newDur = primary.updates.duration ?? clip.duration;
  const newEnd = newStart + newDur;
  const oldEnd = clip.startTime + clip.duration;

  if (side === 'right') {
    const shift = newEnd - oldEnd;
    for (const other of track.clips) {
      if (other.id !== clip.id && other.startTime >= oldEnd) {
        results.push({
          clipId: other.id,
          updates: { startTime: other.startTime + shift },
        });
      }
    }
  } else {
    const shift = newStart - clip.startTime;
    for (const other of track.clips) {
      if (other.id !== clip.id && other.startTime + other.duration <= clip.startTime) {
        results.push({
          clipId: other.id,
          updates: { startTime: Math.max(0, other.startTime + shift) },
        });
      }
    }
  }

  return results;
}

export function rollTrim(
  clipA: Clip,
  clipB: Clip,
  deltaTime: number,
): readonly ClipUpdate[] {
  const newADur = clipA.duration + deltaTime;
  const newBStart = clipB.startTime + deltaTime;
  const newBDur = clipB.duration - deltaTime;

  if (newADur < MIN_CLIP_DURATION || newBDur < MIN_CLIP_DURATION) return [];

  return [
    {
      clipId: clipA.id,
      updates: {
        duration: newADur,
        outPoint: clipA.inPoint + newADur,
      },
    },
    {
      clipId: clipB.id,
      updates: {
        startTime: newBStart,
        duration: newBDur,
        inPoint: clipB.inPoint + deltaTime,
      },
    },
  ];
}

export function slipTrim(
  clip: Clip,
  deltaTime: number,
  assetDuration: number,
): ClipUpdate | null {
  const newIn = clip.inPoint + deltaTime;
  const newOut = clip.outPoint + deltaTime;

  if (newIn < 0 || newOut > assetDuration) return null;

  return {
    clipId: clip.id,
    updates: {
      inPoint: newIn,
      outPoint: newOut,
    },
  };
}

export function slideTrim(
  clip: Clip,
  track: Track,
  deltaTime: number,
): readonly ClipUpdate[] {
  const { prev, next } = findNeighbors(track, clip.id);
  const newStart = Math.max(0, clip.startTime + deltaTime);
  const newEnd = newStart + clip.duration;

  if (prev) {
    if (newStart - prev.startTime < MIN_CLIP_DURATION) return [];
  }
  if (next) {
    if (next.startTime + next.duration - newEnd < MIN_CLIP_DURATION) return [];
  }

  const results: ClipUpdate[] = [
    {
      clipId: clip.id,
      updates: { startTime: newStart },
    },
  ];

  if (prev) {
    const newPrevDur = newStart - prev.startTime;
    results.push({
      clipId: prev.id,
      updates: {
        duration: newPrevDur,
        outPoint: prev.inPoint + newPrevDur,
      },
    });
  }
  if (next) {
    const newNextStart = newEnd;
    const newNextDur = next.startTime + next.duration - newEnd;
    results.push({
      clipId: next.id,
      updates: {
        startTime: newNextStart,
        duration: newNextDur,
        inPoint: next.inPoint + (newNextStart - next.startTime),
      },
    });
  }

  return results;
}

export function executeTrim(
  clip: Clip,
  track: Track,
  side: 'left' | 'right',
  deltaTime: number,
  trimMode: string,
  assetDuration: number,
): readonly ClipUpdate[] {
  switch (trimMode) {
    case 'ripple':
      return rippleTrim(clip, track, side, deltaTime);
    case 'roll': {
      const { prev, next } = findNeighbors(track, clip.id);
      const neighbor = side === 'left' ? prev : next;
      if (!neighbor) return [normalTrim(clip, side, deltaTime)].filter(Boolean) as ClipUpdate[];
      return side === 'left' ? rollTrim(neighbor, clip, deltaTime) : rollTrim(clip, neighbor, deltaTime);
    }
    case 'slip':
      return [slipTrim(clip, deltaTime, assetDuration)].filter(Boolean) as ClipUpdate[];
    case 'slide':
      return slideTrim(clip, track, deltaTime);
    case 'normal':
    default:
      return [normalTrim(clip, side, deltaTime)].filter(Boolean) as ClipUpdate[];
  }
}
