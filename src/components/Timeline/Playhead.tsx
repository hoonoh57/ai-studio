import React from 'react';
import { useEditorStore } from '@/stores/editorStore';

interface Props {
  pps: number;
}

export default function Playhead({ pps }: Props) {
  const currentTime = useEditorStore((s) => s.currentTime);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);

  const onDrag = (e: React.MouseEvent) => {
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

  return (
    <div
      style={{
        position: 'absolute',
        left: currentTime * pps,
        width: 1.5,
        height: '100%',
        zIndex: 10000,
        pointerEvents: 'none',
        willChange: 'left',
      }}
    >
      {/* Playhead handle (sitting on top of the ruler) */}
      <div 
        onMouseDown={onDrag}
        style={{
          position: 'absolute',
          top: 0,
          left: -8.5, // Centered (width 17 / 2)
          width: 17,
          height: 14,
          background: '#ff3b30',
          clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
          pointerEvents: 'auto',
          cursor: 'ew-resize',
        }} 
      />
      {/* Playhead line (Centered on the triangle's tip) */}
      <div style={{
        position: 'absolute',
        top: 14,
        left: -0.75, // Centered on the tip
        width: 1.5,
        height: '100%',
        background: '#ff3b30',
        opacity: 0.8,
        pointerEvents: 'none',
      }} />
    </div>
  );
}
