/* ─── src/components/Timeline/ClipBlock.tsx ─── */
import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { WaveformView } from './WaveformView';
import { ThumbnailStrip } from './ThumbnailStrip';
import { KeyframeDiamonds } from './KeyframeDiamonds';
import type { Clip, Track } from '@/types/project';

/* ========== 상수 ========== */
const CLIP_PADDING_TOP = 2;
const CLIP_PADDING_HORIZONTAL = 8;
const CLIP_BORDER_RADIUS = 4;
const CLIP_FONT_SIZE = 11;
const CLIP_FONT_WEIGHT = 500;
const HANDLE_WIDTH = 6;
const THUMBNAIL_HEIGHT_RATIO = 0.6;   // 비디오 상단 60% 썸네일
const WAVEFORM_HEIGHT_RATIO = 0.4;    // 비디오 하단 40% 파형
const VISUALIZATION_DIVIDER = '1px solid rgba(255,255,255,0.1)';

const NORMAL_BORDER = '1px solid rgba(0,0,0,0.2)';
const SELECTED_BORDER = '2px solid #fff';
const MULTI_SELECTED_BORDER = '2px solid rgba(255,255,255,0.6)';

const badgeBase: React.CSSProperties = {
  position: 'absolute',
  fontSize: 9,
  padding: '1px 3px',
  background: 'rgba(0,0,0,0.4)',
  borderRadius: 3,
  fontWeight: 700,
  pointerEvents: 'none',
  zIndex: 10,
};

const handleBase: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: HANDLE_WIDTH,
  background: 'rgba(255,255,255,0.1)',
  cursor: 'ew-resize',
  zIndex: 15,
};

interface ClipBlockProps {
  clip: Clip;
  track: Track;
  assetName: string;
  isSelected: boolean;
  pps: number;
  trackHeight: number;
  onSelect: (e: React.MouseEvent) => void;
  onMoveStart: (e: React.MouseEvent) => void;
  onTrimLeftStart: (e: React.MouseEvent) => void;
  onTrimRightStart: (e: React.MouseEvent) => void;
}

export function ClipBlock({
  clip, track, assetName, isSelected, pps, trackHeight,
  onSelect, onMoveStart, onTrimLeftStart, onTrimRightStart,
}: ClipBlockProps): React.ReactElement {
  const left = clip.startTime * pps;
  const width = clip.duration * pps;
  const clipHeight = trackHeight - (CLIP_PADDING_TOP * 2);

  const config = useEditorStore((s) => s.getSkillConfig());
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const thumbnailCache = useEditorStore((s) => s.thumbnailCache);
  const waveformCache = useEditorStore((s) => s.waveformCache);

  const thumbnailData = thumbnailCache.get(clip.assetId) ?? null;
  const waveformData = waveformCache.get(clip.assetId) ?? null;

  const isPrimary = clip.id === selectedClipId;
  const isDisabled = clip.disabled === true;
  // ★ B4: 텍스트 클립은 오렌지 계열로 시각 구분
  const isTextClip = !!clip.textContent;
  const baseColor = isTextClip ? '#E67E22' : track.color;
  const bgColor = isPrimary ? 'var(--accent-hover)' : (isSelected ? 'var(--accent, #6c5ce7)' : baseColor);
  const border = isPrimary ? SELECTED_BORDER : (isSelected ? MULTI_SELECTED_BORDER : NORMAL_BORDER);

  const showThumbStrip = track.type === 'video' && thumbnailData !== null;
  const showWave = (track.type === 'audio' || track.type === 'video') && waveformData !== null;

  const thumbHeight = showThumbStrip ? clipHeight * THUMBNAIL_HEIGHT_RATIO : 0;
  const waveHeight = showWave ? (showThumbStrip ? clipHeight * WAVEFORM_HEIGHT_RATIO : clipHeight) : 0;

  const filterCount = clip.filters?.length ?? 0;
  const kfCount = clip.keyframeTracks?.reduce((sum, kt) => sum + kt.keyframes.length, 0) ?? 0;

  /* ★ E-6a: 키프레임 다이아몬드 표시 조건 */
  const KF_AREA_MAX_HEIGHT = Math.max(0, clipHeight * 0.4);
  const hasKeyframes = (clip.keyframeTracks?.some(
    kt => kt.enabled && kt.keyframes.length > 0
  )) ?? false;
  const showKfDiamonds = config.showKeyframes && hasKeyframes;

  return (
    <div
      style={{
        position: 'absolute', left, width,
        top: CLIP_PADDING_TOP, height: clipHeight,
        borderRadius: CLIP_BORDER_RADIUS, cursor: 'pointer',
        display: 'flex', alignItems: 'center',
        padding: `0 ${CLIP_PADDING_HORIZONTAL}px`,
        fontSize: CLIP_FONT_SIZE, color: '#fff', fontWeight: CLIP_FONT_WEIGHT,
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        userSelect: 'none', background: bgColor, border,
        boxSizing: 'border-box', zIndex: isSelected ? 20 : 1,
        opacity: isDisabled ? 0.35 : 1,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(e); }}
      onMouseDown={onMoveStart}
    >
      {/* Linked Indicator */}
      {clip.linkedClipId && (
        <div style={{
          position: 'absolute', top: 2, left: 4,
          fontSize: 10, opacity: 0.6, pointerEvents: 'none', zIndex: 3,
        }}>🔗</div>
      )}

      {/* ★ B2-5: 클립 비활성화 오버레이 */}
      {isDisabled && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 25, pointerEvents: 'none',
          background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,0,0,0.15) 4px, rgba(255,0,0,0.15) 8px)',
          borderRadius: CLIP_BORDER_RADIUS,
        }}>
          <span style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 10, color: '#ff6b6b', fontWeight: 700,
          }}>
            DISABLED
          </span>
        </div>
      )}

      {/* Visualizations */}
      <div style={{
        width: '100%', position: 'absolute',
        top: 0, bottom: 0, left: 0, right: 0,
        pointerEvents: 'none', display: 'flex', flexDirection: 'column',
      }}>
        {showThumbStrip && (
          <div style={{ height: thumbHeight, overflow: 'hidden', borderBottom: VISUALIZATION_DIVIDER }}>
            <ThumbnailStrip
              thumbnailData={thumbnailData} width={width} height={thumbHeight}
              clipStart={clip.startTime} clipEnd={clip.startTime + clip.duration}
              sourceStart={clip.inPoint} sourceEnd={clip.outPoint}
            />
          </div>
        )}
        {showWave && (
          <div style={{ height: waveHeight, overflow: 'hidden' }}>
            <WaveformView
              waveformData={waveformData} width={width} height={waveHeight}
              clipStart={clip.startTime} clipEnd={clip.startTime + clip.duration}
              sourceStart={clip.inPoint} sourceEnd={clip.outPoint}
            />
          </div>
        )}
      </div>

      {/* ★ E-6a: 키프레임 다이아몬드 오버레이 */}
      {showKfDiamonds && (
        <KeyframeDiamonds
          clip={clip}
          pps={pps}
          clipWidthPx={width}
          maxHeight={KF_AREA_MAX_HEIGHT}
        />
      )}

      {/* 속도 뱃지 */}
      {clip.speed !== 1 && (
        <div style={{ ...badgeBase, bottom: showKfDiamonds ? KF_AREA_MAX_HEIGHT + 2 : 2, left: 4, color: '#ffd700' }}>
          {clip.speed}x{clip.reverse ? '⏪' : ''}
        </div>
      )}

      {/* 블렌드 모드 뱃지 */}
      {clip.blendMode !== 'normal' && (
        <div style={{ ...badgeBase, bottom: showKfDiamonds ? KF_AREA_MAX_HEIGHT + 2 : 2, right: HANDLE_WIDTH + 4, color: '#da70d6' }}>
          {clip.blendMode}
        </div>
      )}

      {/* 효과 뱃지 */}
      {filterCount > 0 && (
        <div style={{ ...badgeBase, top: 2, right: HANDLE_WIDTH + (clip.groupId ? 24 : 4), color: '#00d2ff' }}>
          ✨{filterCount} FX
        </div>
      )}

      {/* 키프레임 뱃지 (다이아몬드가 안 보일 때만 표시) */}
      {kfCount > 0 && !showKfDiamonds && (
        <div style={{
          ...badgeBase,
          bottom: clip.speed !== 1 ? 14 : 2,
          left: clip.speed !== 1 ? 4 : (filterCount > 0 ? 50 : 4),
          color: '#ff6b6b',
        }}>
          ◆{kfCount} KF
        </div>
      )}

      {/* 그룹 인디케이터 */}
      {clip.groupId && (
        <div style={{
          position: 'absolute', top: 2, right: HANDLE_WIDTH + 4,
          fontSize: 9, opacity: 0.6, pointerEvents: 'none', zIndex: 3,
        }}>📦</div>
      )}

      {/* Name */}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none', zIndex: 5 }}>
        {clip.textContent ? '🔤 ' : ''}{assetName}
      </span>

      {/* Trim Handles */}
      <div style={{ ...handleBase, left: 0 }}
        onMouseDown={(e) => { e.stopPropagation(); onTrimLeftStart(e); }} />
      <div style={{ ...handleBase, right: 0 }}
        onMouseDown={(e) => { e.stopPropagation(); onTrimRightStart(e); }} />
    </div>
  );
}
