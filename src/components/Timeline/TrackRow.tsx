/* ─── src/components/Timeline/TrackRow.tsx ─── */
import React from 'react';
import type { Track, Asset } from '@/types/project';
import { useEditorStore } from '@/stores/editorStore';
import { ClipBlock } from './ClipBlock';

interface TrackRowProps {
  track: Track;
  assets: Asset[];
  pps: number;
  selectedClipId: string | null;
  onSelectClip: (id: string) => void;
  onMoveClip: (e: React.MouseEvent, clipId: string) => void;
  onTrimLeft: (e: React.MouseEvent, clipId: string) => void;
  onTrimRight: (e: React.MouseEvent, clipId: string) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track, assets, pps, selectedClipId,
  onSelectClip, onMoveClip, onTrimLeft, onTrimRight,
  onDrop, onDragOver,
}) => {
  const store = useEditorStore();
  const trackColor = (track as any).color || '#4A90D9';

  /* Solo로 인한 실효 mute 계산 - 안전 체크 */
  let effectiveMuted = track.muted;
  if (typeof (store as any).getEffectiveMuted === 'function') {
    effectiveMuted = (store as any).getEffectiveMuted(track.id);
  }

  return (
    <div
      style={{
        position: 'relative',
        height: track.height,
        boxSizing: 'border-box',
        borderBottom: '1px solid var(--border-secondary, #333)',
        opacity: track.visible ? 1 : 0.3,
        pointerEvents: track.locked ? 'none' : 'auto',
        borderLeft: `3px solid ${trackColor}`,
        background: effectiveMuted && !track.muted
          ? 'rgba(255,100,100,.04)'
          : 'transparent',
      }}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {effectiveMuted && !track.muted && (
        <div style={{
          position: 'absolute', top: 2, right: 4,
          fontSize: 9, color: '#ff6b6b', opacity: 0.7,
          zIndex: 5, pointerEvents: 'none',
        }}>
          MUTED (Solo)
        </div>
      )}

      {track.clips.map(clip => {
        const asset = assets.find(a => a.id === clip.assetId);
        return (
          <ClipBlock
            key={clip.id}
            clip={clip}
            track={track}
            assetName={asset?.name ?? 'Unknown'}
            isSelected={clip.id === selectedClipId}
            pps={pps}
            trackHeight={track.height}
            onSelect={() => onSelectClip(clip.id)}
            onMoveStart={(e) => onMoveClip(e, clip.id)}
            onTrimLeftStart={(e) => onTrimLeft(e, clip.id)}
            onTrimRightStart={(e) => onTrimRight(e, clip.id)}
          />
        );
      })}
    </div>
  );
};
