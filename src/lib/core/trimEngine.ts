import type { Clip } from '@/types/project';

// === Timeline Engine Trim Utilities ===

export function normalTrim(clip: Clip, side: 'left' | 'right', deltaTime: number): Partial<Clip> {
  if (side === 'left') {
    return {
      timelineStart: clip.timelineStart + deltaTime,
      sourceStart: clip.sourceStart + deltaTime,
    };
  }

  return {
    timelineEnd: clip.timelineEnd + deltaTime,
    sourceEnd: clip.sourceEnd + deltaTime,
  };
}

export function rippleTrim(
  clip: Clip,
  allClips: Clip[],
  side: 'left' | 'right',
  deltaTime: number
): Map<string, Partial<Clip>> {
  const updates = new Map<string, Partial<Clip>>();

  // Apply base trim to target clip first
  const base = normalTrim(clip, side, deltaTime);
  updates.set(clip.id, base);

  // Only affect clips on same track
  const trackClips = allClips
    .filter((c) => c.trackId === clip.trackId && c.id !== clip.id)
    .sort((a, b) => a.timelineStart - b.timelineStart);

  if (side === 'left') {
    // If trimming left, gap/overlap happens before clip; shift right-side clips to preserve continuity.
    const shift = -deltaTime;
    for (const c of trackClips) {
      if (c.timelineStart >= clip.timelineEnd) continue; // not in timeline flow
      if (c.timelineStart >= clip.timelineStart) {
        updates.set(c.id, {
          timelineStart: c.timelineStart + shift,
          timelineEnd: c.timelineEnd + shift,
        });
      }
    }
  } else {
    // side == right: affects clips after clip
    for (const c of trackClips) {
      if (c.timelineStart >= clip.timelineEnd) {
        updates.set(c.id, {
          timelineStart: c.timelineStart + deltaTime,
          timelineEnd: c.timelineEnd + deltaTime,
        });
      }
    }
  }

  return updates;
}

export function rollTrim(
  clipA: Clip,
  clipB: Clip,
  deltaTime: number
): { a: Partial<Clip>; b: Partial<Clip> } {
  // Move boundary between two adjacent clips preserving total duration value of the pair.
  return {
    a: {
      timelineEnd: clipA.timelineEnd + deltaTime,
      sourceEnd: clipA.sourceEnd + deltaTime,
    },
    b: {
      timelineStart: clipB.timelineStart + deltaTime,
      sourceStart: clipB.sourceStart + deltaTime,
    },
  };
}

export function slipTrim(clip: Clip, deltaTime: number): Partial<Clip> {
  const length = clip.sourceEnd - clip.sourceStart;
  const candidateStart = clip.sourceStart + deltaTime;
  const candidateEnd = candidateStart + length;

  const normalizedStart = Math.max(0, candidateStart);
  const normalizedEnd = normalizedStart + length;

  // Note: asset duration constraint is external; this function enforces lower bound only.
  return {
    sourceStart: normalizedStart,
    sourceEnd: normalizedEnd,
  };
}

export function slideTrim(
  clip: Clip,
  neighbors: { previous?: Clip; next?: Clip },
  deltaTime: number
): Map<string, Partial<Clip>> {
  const updates = new Map<string, Partial<Clip>>();

  // Move current clip on timeline
  updates.set(clip.id, {
    timelineStart: clip.timelineStart + deltaTime,
    timelineEnd: clip.timelineEnd + deltaTime,
  });

  // Adjust edges of neighbors to stay adjacent
  if (neighbors.previous) {
    updates.set(neighbors.previous.id, {
      timelineEnd: neighbors.previous.timelineEnd + deltaTime,
    });
  }

  if (neighbors.next) {
    updates.set(neighbors.next.id, {
      timelineStart: neighbors.next.timelineStart + deltaTime,
    });
  }

  return updates;
}
