// src/components/Timeline/ClipBlock.tsx

import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { WaveformView } from './WaveformView';
import { ThumbnailStrip } from './ThumbnailStrip';
import type { Clip, Track, TrackType } from '@/types/project';

interface ClipBlockProps {
  clip: Clip;
  track: Track;
  assetName: string;
  isSelected: boolean;
  pps: number;
  trackHeight: number;
  onSelect: () => void;
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
const TRANSITION_OVERLAY_WIDTH = 10;
const TRANSITION_OVERLAY_COLOR = 'rgba(255,255,255,0.4)';
const SELECTED_BORDER = '2px solid #fff';
const NORMAL_BORDER = '1px solid rgba(255,255,255,0.15)';
const THUMBNAIL_HEIGHT_RATIO = 0.65;
const WAVEFORM_HEIGHT_RATIO = 0.35;
const VISUALIZATION_DIVIDER = '1px solid rgba(255,255,255,0.1)';

const CLIP_COLORS: Record<TrackType | string, string> = {
  video: 'var(--clip-video)',
  audio: 'var(--clip-audio)',
  text: 'var(--clip-text)',
  effect: 'var(--clip-effect)',
};

const handleBase: React.CSSProperties = {
  width: HANDLE_WIDTH,
  height: '100%',
  position: 'absolute',
  top: 0,
  cursor: 'col-resize',
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
  const left = clip.timelineStart * pps;
  const width = (clip.timelineEnd - clip.timelineStart) * pps;
  const clipHeight = trackHeight - (CLIP_PADDING_TOP * 2);

  const showWaveform = useEditorStore((s) => s.getSkillConfig().showWaveform);
  const showThumbnailStrip = useEditorStore(
    (s) => s.getSkillConfig().showThumbnailStrip,
  );
  const transitions = useEditorStore((s) => s.transitions);
  const toggleMultiSelect = useEditorStore((s) => s.toggleMultiSelect);
  const waveformCache = useEditorStore((s) => s.waveformCache);
  const thumbnailCache = useEditorStore((s) => s.thumbnailCache);

  const waveformData = waveformCache.get(clip.assetId) ?? null;
  const thumbnailData = thumbnailCache.get(clip.assetId) ?? null;

  const transitionStart = transitions.find((t) => t.clipBId === clip.id);
  const transitionEnd = transitions.find((t) => t.clipAId === clip.id);

  const bgColor = isSelected
    ? 'var(--accent-hover)'
    : CLIP_COLORS[track.type] ?? CLIP_COLORS.video;

  const border = isSelected ? SELECTED_BORDER : NORMAL_BORDER;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      toggleMultiSelect(clip.id);
      return;
    }
    onSelect();
  };

  const showThumbStrip =
    track.type === 'video' && showThumbnailStrip && thumbnailData !== null;

  const showWave =
    (track.type === 'audio' || track.type === 'video') &&
    showWaveform &&
    waveformData !== null;

  const thumbHeight = showThumbStrip
    ? clipHeight * THUMBNAIL_HEIGHT_RATIO
    : 0;

  const waveHeight = showWave
    ? showThumbStrip
      ? clipHeight * WAVEFORM_HEIGHT_RATIO
      : clipHeight
    : 0;

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
        willChange: 'transform',
        contain: 'layout',
        background: bgColor,
        border,
      }}
      onClick={handleClick}
      onMouseDown={onMoveStart}
    >
      {transitionStart !== undefined && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: TRANSITION_OVERLAY_WIDTH,
            height: '100%',
            background: TRANSITION_OVERLAY_COLOR,
            pointerEvents: 'none',
          }}
          title={`Transition from ${transitionStart.clipAId}`}
        />
      )}

      {transitionEnd !== undefined && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: TRANSITION_OVERLAY_WIDTH,
            height: '100%',
            background: TRANSITION_OVERLAY_COLOR,
            pointerEvents: 'none',
          }}
          title={`Transition to ${transitionEnd.clipBId}`}
        />
      )}

      <div
        style={{
          width: '100%',
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {showThumbStrip && (
          <div
            style={{
              height: thumbHeight,
              position: 'relative',
              overflow: 'hidden',
              borderBottom: VISUALIZATION_DIVIDER,
            }}
          >
            <ThumbnailStrip
              thumbnailData={thumbnailData}
              width={width}
              height={thumbHeight}
              clipStart={clip.timelineStart}
              clipEnd={clip.timelineEnd}
              sourceStart={clip.sourceStart}
              sourceEnd={clip.sourceEnd}
            />
          </div>
        )}

        {showWave && (
          <div
            style={{
              height: waveHeight,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <WaveformView
              waveformData={waveformData}
              width={width}
              height={waveHeight}
              clipStart={clip.timelineStart}
              clipEnd={clip.timelineEnd}
              sourceStart={clip.sourceStart}
              sourceEnd={clip.sourceEnd}
            />
          </div>
        )}
      </div>

      <div
        style={{
          ...handleBase,
          left: 0,
          borderRadius: `${CLIP_BORDER_RADIUS}px 0 0 ${CLIP_BORDER_RADIUS}px`,
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onTrimLeftStart(e);
        }}
      />

      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          pointerEvents: 'none',
        }}
      >
        {assetName}
      </span>

      <div
        style={{
          ...handleBase,
          right: 0,
          left: 'auto',
          borderRadius: `0 ${CLIP_BORDER_RADIUS}px ${CLIP_BORDER_RADIUS}px 0`,
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onTrimRightStart(e);
        }}
      />
    </div>
  );
}
