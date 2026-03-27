/* ─── src/components/Timeline/ClipBlock.tsx ─── */
import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { WaveformView } from './WaveformView';
import { ThumbnailStrip } from './ThumbnailStrip';
import type { Clip, Track } from '@/types/project';

interface ClipBlockProps {
  clip: Clip;
  track: Track;
  assetName: string;
  isSelected: boolean;
  pps: number;
  trackHeight: number;
  /* I-2 FIX: 이벤트 객체 전달 → Shift 키 감지 가능 */
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

/* I-2 FIX: 멀티 셀렉션 시 보조 하이라이트 */
const MULTI_SELECTED_BORDER = '2px solid rgba(108, 92, 231, 0.8)';

const handleBase: React.CSSProperties = {
  width: HANDLE_WIDTH,
  height: '100%',
  position: 'absolute',
  top: 0,
  cursor: 'col-resize',
  zIndex: 10,
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

  const thumbnailData = thumbnailCache.get(clip.assetId) ?? null;
  const waveformData = waveformCache.get(clip.assetId) ?? null;

  /* I-2 FIX: primary(단일 선택) vs secondary(멀티 셀렉션 일부) 구분 */
  const isPrimary = clip.id === selectedClipId;
  const bgColor = isPrimary ? 'var(--accent-hover)' : (isSelected ? 'var(--accent, #6c5ce7)' : track.color);
  const border = isPrimary ? SELECTED_BORDER : (isSelected ? MULTI_SELECTED_BORDER : NORMAL_BORDER);

  const showThumbStrip = track.type === 'video' && thumbnailData !== null;
  const showWave = (track.type === 'audio' || track.type === 'video') && waveformData !== null;

  const thumbHeight = showThumbStrip ? clipHeight * THUMBNAIL_HEIGHT_RATIO : 0;
  const waveHeight = showWave ? (showThumbStrip ? clipHeight * WAVEFORM_HEIGHT_RATIO : clipHeight) : 0;

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
