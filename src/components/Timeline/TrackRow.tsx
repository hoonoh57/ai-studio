import React from 'react';
import type { Track, Clip } from '@/types/project';
import ClipBlock from './ClipBlock';

type TrackRowProps = {
  track: Track;
  projectAssets: readonly { id: string; name: string }[];
  pps: number;
  selectedClipId: string | null;
  onSelectClip: (clipId: string) => void;
  onMoveStart: (e: React.MouseEvent, clip: Clip) => void;
  onTrimLeftStart: (e: React.MouseEvent, clip: Clip) => void;
  onTrimRightStart: (e: React.MouseEvent, clip: Clip) => void;
  onDropClip: (e: React.DragEvent) => void;
  onDragOverTrack: (e: React.DragEvent) => void;
};

export default function TrackRow({
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
}: TrackRowProps) {
  return (
    <div
      style={{
        position: 'relative',
        borderBottom: '1px solid var(--border)',
        height: track.height,
        opacity: track.visible ? 1 : 0.3,
        pointerEvents: track.locked ? 'none' : 'auto',
      }}
      onDrop={track.locked ? undefined : onDropClip}
      onDragOver={track.locked ? undefined : onDragOverTrack}
    >
      {track.clips.map((clip) => {
        const asset = projectAssets.find((a) => a.id === clip.assetId);
        const assetName = asset?.name || 'Clip';
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
