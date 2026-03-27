// src/components/Timeline/Playhead.tsx

import React from 'react';
import { useEditorStore } from '@/stores/editorStore';

interface PlayheadProps {
  pps: number;
}

const PLAYHEAD_COLOR = '#ff3b30';
const HANDLE_WIDTH = 17;
const HANDLE_HEIGHT = 14;
const LINE_WIDTH = 1.5;

export function Playhead({ pps }: PlayheadProps): React.ReactElement {
  const currentTime = useEditorStore((s) => s.currentTime);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);

  const handleDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startT = currentTime;

    const onMove = (ev: MouseEvent) => {
      const dt = (ev.clientX - startX) / pps;
      setCurrentTime(Math.max(0, startT + dt));
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const leftPosition = currentTime * pps;
  const handleOffsetX = -(HANDLE_WIDTH / 2);

  return (
    <div
      style={{
        position: 'absolute',
        left: leftPosition,
        width: LINE_WIDTH,
        height: '100%',
        zIndex: 10000,
        pointerEvents: 'none',
        willChange: 'left',
      }}
    >
      <div
        onMouseDown={handleDrag}
        style={{
          position: 'absolute',
          top: 0,
          left: handleOffsetX,
          width: HANDLE_WIDTH,
          height: HANDLE_HEIGHT,
          background: PLAYHEAD_COLOR,
          clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
          pointerEvents: 'auto',
          cursor: 'ew-resize',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: HANDLE_HEIGHT,
          left: -(LINE_WIDTH / 2),
          width: LINE_WIDTH,
          height: '100%',
          background: PLAYHEAD_COLOR,
          opacity: 0.8,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
