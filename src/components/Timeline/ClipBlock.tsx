/* ─── src/components/Timeline/ClipBlock.tsx ─── */
import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { WaveformView } from './WaveformView';
import { ThumbnailStrip } from './ThumbnailStrip';
import type { Clip, Track, Transition } from '@/types/project';

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

const CLIP_PADDING_TOP = 4;
const CLIP_PADDING_HORIZONTAL = 8;
const CLIP_BORDER_RADIUS = 4;
const CLIP_FONT_SIZE = 10;
const CLIP_FONT_WEIGHT = 500;
const HANDLE_WIDTH = 6;
const SELECTED_BORDER = '2px solid #fff';
const NORMAL_BORDER = '1px solid rgba(255,255,255,0.15)';
const THUMBNAIL_HEIGHT_RATIO = 0.65;
const WAVEFORM_HEIGHT_RATIO = 0.35;
const VISUALIZATION_DIVIDER = '1px solid rgba(255,255,255,0.1)';
const MULTI_SELECTED_BORDER = '2px solid rgba(108, 92, 231, 0.8)';

/* ★ NEW: 전환 오버레이 색상 */
const TRANSITION_OVERLAY_COLOR = 'rgba(138, 43, 226, 0.35)';
const TRANSITION_ICON_MAP: Record<string, string> = {
  'dissolve': '🌊', 'fade-black': '⬛', 'fade-white': '⬜',
  'wipe-left': '◀', 'wipe-right': '▶', 'wipe-up': '🔼', 'wipe-down': '🔽',
  'slide-left': '⏪', 'slide-right': '⏩',
  'zoom-in': '🔍', 'zoom-out': '🔎', 'blur': '🌫',
};

const handleBase: React.CSSProperties = {
  width: HANDLE_WIDTH,
  height: '100%',
  position: 'absolute',
  top: 0,
  cursor: 'col-resize',
  zIndex: 10,
};

/* ★ NEW: 뱃지 공통 스타일 */
const badgeBase: React.CSSProperties = {
  fontSize: 8,
  opacity: 0.9,
  pointerEvents: 'none',
  zIndex: 3,
  background: 'rgba(0,0,0,0.6)',
  borderRadius: 2,
  padding: '1px 4px',
  position: 'absolute',
  whiteSpace: 'nowrap',
};

export function ClipBlock({
  clip,
  track,
  assetName,
  isSelected,
  pps,
  trackHeight,
  onSelect,
  onMoveStart,
  onTrimLeftStart,
  onTrimRightStart,
}: ClipBlockProps): React.ReactElement {
  const left = clip.startTime * pps;
  const width = clip.duration * pps;
  const clipHeight = trackHeight - (CLIP_PADDING_TOP * 2);

  const config = useEditorStore((s) => s.getSkillConfig());
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const thumbnailCache = useEditorStore((s) => s.thumbnailCache);
  const waveformCache = useEditorStore((s) => s.waveformCache);
  const transitions = useEditorStore((s) => s.transitions); /* ★ NEW */

  const thumbnailData = thumbnailCache.get(clip.assetId) ?? null;
  const waveformData = waveformCache.get(clip.assetId) ?? null;

  const isPrimary = clip.id === selectedClipId;
  const bgColor = isPrimary ? 'var(--accent-hover)' : (isSelected ? 'var(--accent, #6c5ce7)' : track.color);
  const border = isPrimary ? SELECTED_BORDER : (isSelected ? MULTI_SELECTED_BORDER : NORMAL_BORDER);

  const showThumbStrip = track.type === 'video' && thumbnailData !== null;
  const showWave = (track.type === 'audio' || track.type === 'video') && waveformData !== null;

  const thumbHeight = showThumbStrip ? clipHeight * THUMBNAIL_HEIGHT_RATIO : 0;
  const waveHeight = showWave ? (showThumbStrip ? clipHeight * WAVEFORM_HEIGHT_RATIO : clipHeight) : 0;

  /* ★ NEW: 이 클립에 연결된 전환 찾기 */
  const transitionAsA = transitions.find(t => t.clipAId === clip.id);  // 이 클립이 from (끝에 전환)
  const transitionAsB = transitions.find(t => t.clipBId === clip.id);  // 이 클립이 to (시작에 전환)

  /* ★ NEW: 효과/키프레임 카운트 */
  const filterCount = clip.filters?.length ?? 0;
  const kfCount = clip.keyframeTracks?.reduce((sum, kt) => sum + kt.keyframes.length, 0) ?? 0;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        width,
        top: CLIP_PADDING_TOP,
        height: clipHeight,
        borderRadius: CLIP_BORDER_RADIUS,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${CLIP_PADDING_HORIZONTAL}px`,
        fontSize: CLIP_FONT_SIZE,
        color: '#fff',
        fontWeight: CLIP_FONT_WEIGHT,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        userSelect: 'none',
        background: bgColor,
        border,
        boxSizing: 'border-box',
        zIndex: isSelected ? 20 : 1,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(e); }}
      onMouseDown={onMoveStart}
    >
      {/* ★ NEW: 전환 오버레이 — 클립 끝 (이 클립이 from) */}
      {transitionAsA && (
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: Math.min(transitionAsA.duration * pps, width * 0.5),
          height: '100%',
          background: `linear-gradient(to right, transparent, ${TRANSITION_OVERLAY_COLOR})`,
          borderRadius: `0 ${CLIP_BORDER_RADIUS}px ${CLIP_BORDER_RADIUS}px 0`,
          pointerEvents: 'none',
          zIndex: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>
            {TRANSITION_ICON_MAP[transitionAsA.type] ?? '🔀'}
          </span>
        </div>
      )}

      {/* ★ NEW: 전환 오버레이 — 클립 시작 (이 클립이 to) */}
      {transitionAsB && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: Math.min(transitionAsB.duration * pps, width * 0.5),
          height: '100%',
          background: `linear-gradient(to left, transparent, ${TRANSITION_OVERLAY_COLOR})`,
          borderRadius: `${CLIP_BORDER_RADIUS}px 0 0 ${CLIP_BORDER_RADIUS}px`,
          pointerEvents: 'none',
          zIndex: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>
            {TRANSITION_ICON_MAP[transitionAsB.type] ?? '🔀'}
          </span>
        </div>
      )}

      {/* Linked Indicator */}
      {clip.linkedClipId && (
        <div style={{
          position: 'absolute',
          top: 2,
          left: 4,
          fontSize: 10,
          opacity: 0.6,
          pointerEvents: 'none',
          zIndex: 3,
        }}>
          🔗
        </div>
      )}

      {/* Visualizations */}
      <div style={{
        width: '100%',
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {showThumbStrip && (
          <div style={{ height: thumbHeight, overflow: 'hidden', borderBottom: VISUALIZATION_DIVIDER }}>
            <ThumbnailStrip
              thumbnailData={thumbnailData}
              width={width}
              height={thumbHeight}
              clipStart={clip.startTime}
              clipEnd={clip.startTime + clip.duration}
              sourceStart={clip.inPoint}
              sourceEnd={clip.outPoint}
            />
          </div>
        )}
        {showWave && (
          <div style={{ height: waveHeight, overflow: 'hidden' }}>
            <WaveformView
              waveformData={waveformData}
              width={width}
              height={waveHeight}
              clipStart={clip.startTime}
              clipEnd={clip.startTime + clip.duration}
              sourceStart={clip.inPoint}
              sourceEnd={clip.outPoint}
            />
          </div>
        )}
      </div>

      {/* T-3.6: 속도 뱃지 */}
      {clip.speed !== 1 && (
        <div style={{
          ...badgeBase,
          bottom: 2,
          left: 4,
          color: '#ffd700',
        }}>
          {clip.speed}x{clip.reverse ? '⏪' : ''}
        </div>
      )}

      {/* T-3.2: 블렌드 모드 뱃지 */}
      {clip.blendMode !== 'normal' && (
        <div style={{
          ...badgeBase,
          bottom: 2,
          right: HANDLE_WIDTH + 4,
          color: '#da70d6',
        }}>
          {clip.blendMode}
        </div>
      )}

      {/* ★ NEW: 효과 뱃지 */}
      {filterCount > 0 && (
        <div style={{
          ...badgeBase,
          top: 2,
          right: HANDLE_WIDTH + (clip.groupId ? 24 : 4),
          color: '#00d2ff',
        }}>
          ✨{filterCount} FX
        </div>
      )}

      {/* ★ NEW: 키프레임 뱃지 */}
      {kfCount > 0 && (
        <div style={{
          ...badgeBase,
          bottom: clip.speed !== 1 ? 14 : 2,
          left: clip.speed !== 1 ? 4 : (filterCount > 0 ? 50 : 4),
          color: '#ff6b6b',
        }}>
          ◆{kfCount} KF
        </div>
      )}

      {/* T-3.3: 그룹 인디케이터 */}
      {clip.groupId && (
        <div style={{
          position: 'absolute',
          top: 2,
          right: HANDLE_WIDTH + 4,
          fontSize: 9,
          opacity: 0.6,
          pointerEvents: 'none',
          zIndex: 3,
        }}>
          📦
        </div>
      )}

      {/* Name */}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none', zIndex: 5 }}>
        {assetName}
      </span>

      {/* Trim Handles */}
      <div
        style={{ ...handleBase, left: 0 }}
        onMouseDown={(e) => { e.stopPropagation(); onTrimLeftStart(e); }}
      />
      <div
        style={{ ...handleBase, right: 0 }}
        onMouseDown={(e) => { e.stopPropagation(); onTrimRightStart(e); }}
      />
    </div>
  );
}
