// src/components/Timeline/MarkerTrack.tsx

import React, { useState, useRef } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { Marker } from '@/types/project';

interface MarkerTrackProps {
  markers: readonly Marker[];
  pps: number;
  totalWidth: number;
}

const MARKER_HIT_WIDTH = 22;
const MARKER_HALF_WIDTH = 11;
const MARKER_TRIANGLE_HEIGHT = 16;
const MARKER_LINE_HEIGHT = 5000;
const MARKER_LINE_WIDTH = 1.5;
const MARKER_LINE_OFFSET = 10.25;
const MARKER_LINE_OPACITY = 0.6;
const RULER_HEIGHT = 28;
const DEFAULT_MARKER_COLOR = '#ffcc00';

const EDIT_INPUT_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: 24,
  top: 2,
  fontSize: 11,
  width: 80,
  background: '#1a1a2e',
  color: '#e0e0ff',
  border: `1px solid ${DEFAULT_MARKER_COLOR}`,
  outline: 'none',
  borderRadius: 2,
  padding: '1px 4px',
  zIndex: 100,
};

export function MarkerTrack({
  markers,
  pps,
  totalWidth,
}: MarkerTrackProps): React.ReactElement {
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const updateMarker = useEditorStore((s) => s.updateMarker);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDrag = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const marker = markers.find((m) => m.id === id);
    if (marker === undefined) return;
    const startT = marker.time;

    const onMove = (ev: MouseEvent) => {
      const dt = (ev.clientX - startX) / pps;
      const time = Math.max(0, startT + dt);
      updateMarker(id, { time });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleDoubleClick = (id: string, label: string) => {
    setEditId(id);
    setEditLabel(label);
  };

  const handleEditBlur = () => {
    if (editId !== null) {
      updateMarker(editId, { label: editLabel });
      setEditId(null);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: totalWidth,
        height: RULER_HEIGHT,
        zIndex: 11000,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {markers.map((m) => {
        const markerColor = m.color.length > 0 ? m.color : DEFAULT_MARKER_COLOR;
        const leftPos = m.time * pps - MARKER_HALF_WIDTH;

        return (
          <div
            key={m.id}
            style={{
              position: 'absolute',
              left: leftPos,
              top: 0,
              width: MARKER_HIT_WIDTH,
              height: RULER_HEIGHT,
              pointerEvents: 'auto',
              cursor: 'ew-resize',
            }}
            onMouseDown={(e) => handleDrag(m.id, e)}
          >
            <div
              onDoubleClick={() => handleDoubleClick(m.id, m.label)}
              title={`${m.label} (${m.time.toFixed(2)}s)`}
              style={{
                width: 0,
                height: 0,
                borderLeft: `${MARKER_HALF_WIDTH}px solid transparent`,
                borderRight: `${MARKER_HALF_WIDTH}px solid transparent`,
                borderBottom: `${MARKER_TRIANGLE_HEIGHT}px solid ${markerColor}`,
                transform: 'scaleY(-1)',
                filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: MARKER_LINE_OFFSET,
                top: MARKER_TRIANGLE_HEIGHT,
                width: MARKER_LINE_WIDTH,
                height: MARKER_LINE_HEIGHT,
                background: markerColor,
                opacity: MARKER_LINE_OPACITY,
                pointerEvents: 'none',
                zIndex: -1,
              }}
            />

            {editId === m.id && (
              <input
                autoFocus
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onBlur={handleEditBlur}
                onKeyDown={handleEditKeyDown}
                style={EDIT_INPUT_STYLE}
                onMouseDown={(e) => e.stopPropagation()}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
