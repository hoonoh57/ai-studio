// src/components/Timeline/TimelineRuler.tsx

import React, { useMemo } from 'react';
import { useEditorStore } from '@/stores/editorStore';

interface TimelineRulerProps {
  pps: number;
  duration: number;
  zoom: number;
}

const RULER_HEIGHT = 28;
const TICK_FONT_SIZE = 9;
const TICK_PADDING_LEFT = 4;
const TICK_PADDING_BOTTOM = 2;
const INOUT_BORDER_WIDTH = 2;
const INOUT_BG_COLOR = 'rgba(100, 150, 255, 0.15)';
const MARKER_TRIANGLE_SIZE = 4;
const MARKER_TRIANGLE_HEIGHT = 6;

const ZOOM_THRESHOLD_FINE = 2;
const ZOOM_THRESHOLD_MED = 0.5;
const TICK_INTERVAL_FINE = 1;
const TICK_INTERVAL_MED = 5;
const TICK_INTERVAL_COARSE = 10;

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 30);
  const prefix = h > 0 ? `${h}:` : '';
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  const ff = f.toString().padStart(2, '0');
  return `${prefix}${mm}:${ss}:${ff}`;
}

function getTickInterval(zoom: number): number {
  if (zoom >= ZOOM_THRESHOLD_FINE) return TICK_INTERVAL_FINE;
  if (zoom >= ZOOM_THRESHOLD_MED) return TICK_INTERVAL_MED;
  return TICK_INTERVAL_COARSE;
}

export function TimelineRuler({
  pps,
  duration,
  zoom,
}: TimelineRulerProps): React.ReactElement {
  const markers = useEditorStore((s) => s.markers);
  const inOut = useEditorStore((s) => s.inOut);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);

  const ticks = useMemo(() => {
    const arr: React.ReactElement[] = [];
    const interval = getTickInterval(zoom);

    for (let t = 0; t <= duration; t += interval) {
      arr.push(
        <div
          key={t}
          style={{
            position: 'absolute',
            left: t * pps,
            top: 0,
            height: '100%',
            borderLeft: '1px solid var(--border)',
            paddingLeft: TICK_PADDING_LEFT,
            display: 'flex',
            alignItems: 'flex-end',
            paddingBottom: TICK_PADDING_BOTTOM,
          }}
        >
          <span
            style={{
              fontSize: TICK_FONT_SIZE,
              color: 'var(--text-muted)',
              userSelect: 'none',
            }}
          >
            {formatTime(t)}
          </span>
        </div>,
      );
    }

    return arr;
  }, [duration, pps, zoom]);

  const handleRulerClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setCurrentTime(Math.max(0, x / pps));
  };

  const hasInOut =
    inOut.inPoint !== null && inOut.outPoint !== null;

  const inOutLeft =
    hasInOut ? (inOut.inPoint ?? 0) * pps : 0;

  const inOutWidth =
    hasInOut
      ? ((inOut.outPoint ?? 0) - (inOut.inPoint ?? 0)) * pps
      : 0;

  return (
    <div
      style={{
        height: RULER_HEIGHT,
        position: 'relative',
        width: duration * pps,
        background: 'var(--bg-secondary)',
        cursor: 'pointer',
        borderBottom: '1px solid var(--border)',
      }}
      onClick={handleRulerClick}
    >
      {hasInOut && (
        <div
          style={{
            position: 'absolute',
            left: inOutLeft,
            width: inOutWidth,
            height: '100%',
            background: INOUT_BG_COLOR,
            borderLeft: `${INOUT_BORDER_WIDTH}px solid var(--accent)`,
            borderRight: `${INOUT_BORDER_WIDTH}px solid var(--accent)`,
            zIndex: 1,
          }}
        />
      )}

      {markers.map((m) => (
        <div
          key={m.id}
          style={{
            position: 'absolute',
            left: m.time * pps - MARKER_TRIANGLE_SIZE,
            bottom: 0,
            width: 0,
            height: 0,
            borderLeft: `${MARKER_TRIANGLE_SIZE}px solid transparent`,
            borderRight: `${MARKER_TRIANGLE_SIZE}px solid transparent`,
            borderBottom: `${MARKER_TRIANGLE_HEIGHT}px solid ${
              m.color.length > 0 ? m.color : '#ffcc00'
            }`,
            zIndex: 10,
          }}
        />
      ))}

      {ticks}
    </div>
  );
}
