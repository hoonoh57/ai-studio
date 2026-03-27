// src/components/Timeline/TrackRow.tsx

import React from 'react';
import { ClipBlock } from './ClipBlock';
import type { Track, Clip, Asset } from '@/types/project';

interface TrackRowProps {
  track: Track;
  projectAssets: readonly Asset[];
  pps: number;
  selectedClipId: string | null;
  onSelectClip: (clipId: string) => void;
  onMoveStart: (e: React.MouseEvent, clip: Clip) => void;
  onTrimLeftStart: (e: React.MouseEvent, clip: Clip) => void;
  onTrimRightStart: (e: React.MouseEvent, clip: Clip) => void;
  onDropClip: (e: React.DragEvent) => void;
  onDragOverTrack: (e: React.DragEvent) => void;
}

const HIDDEN_TRACK_OPACITY = 0.3;

export function TrackRow({
  track,
  projectAssets,
  pps,
  selectedClipId,
  onSelectClip,
  onMoveStart,
  onTrimLeftStart,
  onTrimRightStart,
  onDropClip,
  onDragOverTrack,
}: TrackRowProps): React.ReactElement {
  const isLocked = track.locked;
  const isVisible = track.visible;

  return (
    <div
      style={{
        position: 'relative',
        borderBottom: '1px solid var(--border)',
        height: track.height,
        opacity: isVisible ? 1 : HIDDEN_TRACK_OPACITY,
        pointerEvents: isLocked ? 'none' : 'auto',
      }}
      onDrop={isLocked ? undefined : onDropClip}
      onDragOver={isLocked ? undefined : onDragOverTrack}
    >
      {track.clips.map((clip) => {
        const asset = projectAssets.find((a) => a.id === clip.assetId);
        const assetName = asset?.name ?? 'Clip';

        return (
          <ClipBlock
            key={clip.id}
            clip={clip}
            track={track}
            assetName={assetName}
            isSelected={selectedClipId === clip.id}
            pps={pps}
            trackHeight={track.height}
            onSelect={() => onSelectClip(clip.id)}
            onMoveStart={(e) => onMoveStart(e, clip)}
            onTrimLeftStart={(e) => onTrimLeftStart(e, clip)}
            onTrimRightStart={(e) => onTrimRightStart(e, clip)}
          />
        );
      })}
    </div>
  );
}
