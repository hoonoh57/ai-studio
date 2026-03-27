// src/components/Timeline/Playhead.tsx
import React from 'react';
import { useEditorStore } from '@/stores/editorStore';

interface PlayheadProps { pps: number; }

const COLOR = '#ff3b30';
const HANDLE_W = 15;
const HANDLE_H = 12;
const LINE_W = 1.5;

export function Playhead({ pps }: PlayheadProps): React.ReactElement {
  const currentTime = useEditorStore((s) => s.currentTime);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);

  const handleDrag = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX; const startT = currentTime;
    const onMove = (ev: MouseEvent) => { setCurrentTime(Math.max(0, startT + (ev.clientX - startX) / pps)); };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  };

  return (
    <div style={{
      position: 'absolute',
      left: currentTime * pps,
      top: 0,
      width: LINE_W,
      height: '100%',
      zIndex: 50,
      pointerEvents: 'none',
      willChange: 'left',
    }}>
      {/* 삼각형 핸들 */}
      <div onMouseDown={handleDrag} style={{
        position: 'absolute', top: 0, left: -(HANDLE_W / 2),
        width: HANDLE_W, height: HANDLE_H,
        background: COLOR,
        clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
        pointerEvents: 'auto', cursor: 'ew-resize', zIndex: 51,
      }} />
      {/* 세로 라인 */}
      <div style={{
        position: 'absolute', top: HANDLE_H, left: -(LINE_W / 2),
        width: LINE_W, height: `calc(100% - ${HANDLE_H}px)`,
        background: COLOR, opacity: 0.8, pointerEvents: 'none',
      }} />
    </div>
  );
}
