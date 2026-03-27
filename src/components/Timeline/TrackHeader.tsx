// src/components/Timeline/TrackHeader.tsx

import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { Track, TrackType } from '@/types/project';

interface TrackHeaderProps {
  track: Track;
}

const MIN_TRACK_HEIGHT = 30;
const RESIZE_HANDLE_HEIGHT = 4;
const ICON_FONT_SIZE = 13;
const LABEL_FONT_SIZE = 10;
const CONTROL_FONT_SIZE = 12;
const CONTROL_PADDING = 2;
const CONTROL_GAP = 4;
const SECTION_GAP = 6;

const ICON_BY_TYPE: Record<TrackType, string> = {
  video: '🎬',
  audio: '🎵',
  text: '✏️',
  effect: '✨',
};

const MUTE_ICONS = { on: '🔇', off: '🔊' } as const;
const LOCK_ICONS = { on: '🔒', off: '🔓' } as const;
const VISIBLE_ICONS = { on: '👁️', off: '🚫' } as const;

const MUTED_OPACITY = 0.3;
const LOCKED_OPACITY_ON = 1;
const LOCKED_OPACITY_OFF = 0.5;
const VISIBLE_OPACITY_ON = 1;
const VISIBLE_OPACITY_OFF = 0.4;

const controlBtnBase: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: CONTROL_PADDING,
  fontSize: CONTROL_FONT_SIZE,
};

export function TrackHeader({ track }: TrackHeaderProps): React.ReactElement {
  const updateTrack = useEditorStore((s) => s.updateTrack);

  const handleResizeStart = (startY: number) => {
    const onMove = (e: MouseEvent) => {
      const newHeight = Math.max(
        MIN_TRACK_HEIGHT,
        track.height + (e.clientY - startY),
      );
      updateTrack(track.id, { height: newHeight });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const icon = ICON_BY_TYPE[track.type] ?? '📌';

  return (
    <div
      style={{
        position: 'relative',
        height: track.height,
        borderBottom: '1px solid var(--border)',
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: LABEL_FONT_SIZE,
        color: 'var(--text-secondary)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SECTION_GAP,
          flex: 1,
          overflow: 'hidden',
        }}
      >
        <span style={{ fontSize: ICON_FONT_SIZE }}>{icon}</span>
        <span
          style={{
            flex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {track.name}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          gap: CONTROL_GAP,
          alignItems: 'center',
        }}
      >
        <button
          style={{
            ...controlBtnBase,
            opacity: track.muted ? MUTED_OPACITY : 1,
            filter: track.muted ? 'grayscale(1)' : 'none',
          }}
          onClick={() => updateTrack(track.id, { muted: !track.muted })}
          title="Mute/Unmute"
        >
          {track.muted ? MUTE_ICONS.on : MUTE_ICONS.off}
        </button>
        <button
          style={{
            ...controlBtnBase,
            opacity: track.locked ? LOCKED_OPACITY_ON : LOCKED_OPACITY_OFF,
          }}
          onClick={() => updateTrack(track.id, { locked: !track.locked })}
          title="Lock/Unlock"
        >
          {track.locked ? LOCK_ICONS.on : LOCK_ICONS.off}
        </button>
        <button
          style={{
            ...controlBtnBase,
            opacity: track.visible ? VISIBLE_OPACITY_ON : VISIBLE_OPACITY_OFF,
          }}
          onClick={() => updateTrack(track.id, { visible: !track.visible })}
          title="Show/Hide"
        >
          {track.visible ? VISIBLE_ICONS.on : VISIBLE_ICONS.off}
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: RESIZE_HANDLE_HEIGHT,
          cursor: 'ns-resize',
          background: 'transparent',
          zIndex: 1,
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleResizeStart(e.clientY);
        }}
      />
    </div>
  );
}
