/* ─── src/components/Timeline/TrackRow.tsx ─── */
import React, { forwardRef } from 'react';
import type { Track, Asset } from '@/types/project';
import { useEditorStore } from '@/stores/editorStore';
import { ClipBlock } from './ClipBlock';
import { TransitionBlock } from './TransitionBlock';

interface TrackRowProps {
  track: Track;
  assets: Asset[];
  pps: number;
  selectedClipId: string | null;
  /* I-2 FIX: 멀티 셀렉션 지원 */
  selectedClipIds: Set<string>;
  onSelectClip: (id: string, e?: React.MouseEvent) => void;
  onMoveClip: (e: React.MouseEvent, clipId: string) => void;
  onTrimLeft: (e: React.MouseEvent, clipId: string) => void;
  onTrimRight: (e: React.MouseEvent, clipId: string) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  /* Phase T-3: 컨텍스트 메뉴 */
  onClipContextMenu?: (e: React.MouseEvent, clipId: string, trackId: string) => void;
}

export const TrackRow = forwardRef<HTMLDivElement, TrackRowProps>(({
  track, assets, pps, selectedClipId, selectedClipIds,
  onSelectClip, onMoveClip, onTrimLeft, onTrimRight,
  onDrop, onDragOver, onClipContextMenu,
}, ref) => {
  const store = useEditorStore();
  const trackColor = track.color || '#4A90D9';
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
        borderLeft: `3px solid ${trackColor}`,
        background: effectiveMuted && !track.muted
          ? 'rgba(255,100,100,.04)'
          : 'transparent',
      }}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {/* 잠금 오버레이 */}
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

      {/* 클립 블록 */}
      {track.clips.map(clip => {
        const asset = assets.find(a => a.id === clip.assetId);
        /* I-2 FIX: 멀티 셀렉션 하이라이트 */
        const isSelected = clip.id === selectedClipId || selectedClipIds.has(clip.id);
        return (
          <div
            key={clip.id}
            onContextMenu={(e) => {
              e.preventDefault();
              onClipContextMenu?.(e, clip.id, track.id);
            }}
          >
            <ClipBlock
              clip={clip}
              track={track}
              assetName={
                clip.textContent
                  ? (clip.textContent.text.length > 20
                      ? clip.textContent.text.substring(0, 20) + '…'
                      : clip.textContent.text)
                  : (asset?.name ?? 'Unknown')
              }
              isSelected={isSelected}
              pps={pps}
              trackHeight={track.height}
              onSelect={(e) => onSelectClip(clip.id, e)}
              onMoveStart={(e) => {
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
          </div>
        );
      })}

      {/* 전환 블록 — 클립 위에 표시되는 별도 레이어 */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 25 }}>
        {store.transitions
          .filter(t => track.clips.some(c => c.id === t.clipAId))
          .map(t => {
            const clipA = track.clips.find(c => c.id === t.clipAId);
            if (!clipA) return null;
            const clipAEnd = (clipA.startTime + clipA.duration) * pps;
            return (
              <div key={t.id} style={{ pointerEvents: 'auto' }}>
                <TransitionBlock
                  transition={t}
                  clipAEnd={clipAEnd}
                  pps={pps}
                  trackHeight={track.height}
                />
              </div>
            );
          })}
      </div>
    </div>
  );
});

TrackRow.displayName = 'TrackRow';
