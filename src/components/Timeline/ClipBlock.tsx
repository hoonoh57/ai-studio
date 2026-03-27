import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { Clip, Track, ThumbnailData, WaveformData } from '@/types/project';
import { WaveformView } from './WaveformView';
import { ThumbnailStrip } from './ThumbnailStrip';

type ClipBlockProps = {
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
};

const clipColors: Record<string, string> = {
  video: 'var(--clip-video)',
  audio: 'var(--clip-audio)',
  text: 'var(--clip-text)',
  effect: 'var(--clip-effect)',
};

const styles: Record<string, React.CSSProperties> = {
  clip: {
    position: 'absolute',
    top: 4,
    borderRadius: 4,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    fontSize: 10,
    color: '#fff',
    fontWeight: 500,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    userSelect: 'none',
    willChange: 'transform',
    contain: 'layout',
  },
  clipLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    pointerEvents: 'none',
  },
  handle: {
    width: 6,
    height: '100%',
    position: 'absolute',
    top: 0,
    cursor: 'col-resize',
  },
  handleLeft: {
    left: 0,
    borderRadius: '4px 0 0 4px',
  },
  handleRight: {
    right: 0,
    borderRadius: '0 4px 4px 0',
  },
};

export default function ClipBlock({
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
}: ClipBlockProps) {
  const left = clip.timelineStart * pps;
  const width = (clip.timelineEnd - clip.timelineStart) * pps;

  const showWaveform = useEditorStore((s) => s.getSkillConfig().showWaveform);
  const showThumbnailStrip = useEditorStore((s) => s.getSkillConfig().showThumbnailStrip);
  const transitions = useEditorStore((s) => s.transitions);
  const toggleMultiSelect = useEditorStore((s) => s.toggleMultiSelect);
  const selectClipRange = useEditorStore((s) => s.selectClipRange);

  const waveformCache = useEditorStore((s) => s.waveformCache);
  const thumbnailCache = useEditorStore((s) => s.thumbnailCache);

  const waveformData = waveformCache.get(clip.assetId) ?? null;
  const thumbnailData = thumbnailCache.get(clip.assetId) ?? null;

  const transitionStart = transitions.find((t) => t.clipBId === clip.id);
  const transitionEnd = transitions.find((t) => t.clipAId === clip.id);

  return (
    <div
      style={{
        ...styles.clip,
        left,
        width,
        height: trackHeight - 8,
        background: isSelected ? 'var(--accent-hover)' : clipColors[track.type] || 'var(--clip-video)',
        border: isSelected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.15)',
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.shiftKey) {
          selectClipRange(clip.id, clip.id); // in Multi-select context this should be range from last selected to this; simplified
          return;
        }
        if (e.ctrlKey || e.metaKey) {
          toggleMultiSelect(clip.id);
          return;
        }
        onSelect();
      }}
      onMouseDown={onMoveStart}
    >
      {transitionStart && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 10,
            height: '100%',
            background: 'rgba(255,255,255,0.4)',
            pointerEvents: 'none',
          }}
          title={`Transition from ${transitionStart.clipAId}`}
        />
      )}
      {transitionEnd && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: 10,
            height: '100%',
            background: 'rgba(255,255,255,0.4)',
            pointerEvents: 'none',
          }}
          title={`Transition to ${transitionEnd.clipBId}`}
        />
      )}

      <div style={{ width: '100%', position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column' }}>
        {track.type === 'video' && showThumbnailStrip && thumbnailData && (
          <div style={{ height: '65%', position: 'relative', overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <ThumbnailStrip 
              thumbnailData={thumbnailData as ThumbnailData} 
              width={width} 
              height={(trackHeight - 8) * 0.65} 
              clipStart={clip.timelineStart}
              clipEnd={clip.timelineEnd}
              sourceStart={clip.sourceStart}
              sourceEnd={clip.sourceEnd}
            />
          </div>
        )}
        {(track.type === 'audio' || track.type === 'video') && showWaveform && waveformData && (
          <div style={{ height: track.type === 'video' ? '35%' : '100%', position: 'relative', overflow: 'hidden' }}>
            <WaveformView 
              waveformData={waveformData as WaveformData} 
              width={width} 
              height={track.type === 'video' ? (trackHeight - 8) * 0.35 : (trackHeight - 8)} 
              clipStart={clip.timelineStart}
              clipEnd={clip.timelineEnd}
              sourceStart={clip.sourceStart}
              sourceEnd={clip.sourceEnd}
            />
          </div>
        )}
      </div>


      <div style={{ ...styles.handle, ...styles.handleLeft }} onMouseDown={(e) => { e.stopPropagation(); onTrimLeftStart(e); }} />
      <span style={styles.clipLabel}>{assetName || 'Clip'}</span>
      <div style={{ ...styles.handle, ...styles.handleRight }} onMouseDown={(e) => { e.stopPropagation(); onTrimRightStart(e); }} />
    </div>
  );
}
