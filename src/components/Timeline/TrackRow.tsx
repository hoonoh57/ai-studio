/* ─── src/components/Timeline/TrackRow.tsx ─── */
import React, { forwardRef } from 'react';
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

/* B4 FIX + B5 FIX: forwardRef 적용, pointerEvents 제거(locked 트랙도 drop 가능) */
export const TrackRow = forwardRef<HTMLDivElement, TrackRowProps>(({
  track, assets, pps, selectedClipId,
  onSelectClip, onMoveClip, onTrimLeft, onTrimRight,
  onDrop, onDragOver,
}, ref) => {
  const store = useEditorStore();
  const trackColor = track.color || '#4A90D9';

  /* Solo로 인한 실효 mute 계산 */
  const effectiveMuted = store.getEffectiveMuted(track.id);

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        height: track.height,
        boxSizing: 'border-box',
        borderBottom: '1px solid var(--border-secondary, #333)',
        opacity: track.visible ? 1 : 0.3,
        /* B4 FIX: pointerEvents 제거 — locked 트랙에서도 드래그 오버/드롭 이벤트 수신 */
        borderLeft: `3px solid ${trackColor}`,
        background: effectiveMuted && !track.muted
          ? 'rgba(255,100,100,.04)'
          : 'transparent',
      }}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {/* 잠금 오버레이 — 시각적으로만 잠금 표시, 이벤트 통과 */}
      {track.locked && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.15)',
          zIndex: 15,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          color: 'rgba(255,255,255,0.2)',
        }}>
          🔒
        </div>
      )}

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
            onMoveStart={(e) => {
              /* 잠긴 트랙의 클립은 이동 방지 */
              if (track.locked) return;
              onMoveClip(e, clip.id);
            }}
            onTrimLeftStart={(e) => {
              if (track.locked) return;
              onTrimLeft(e, clip.id);
            }}
            onTrimRightStart={(e) => {
              if (track.locked) return;
              onTrimRight(e, clip.id);
            }}
          />
        );
      })}
    </div>
  );
});

TrackRow.displayName = 'TrackRow';
