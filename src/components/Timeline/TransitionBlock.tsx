/* ─── src/components/Timeline/TransitionBlock.tsx ─── */
import React, { useCallback, useRef } from 'react';
import { useEditorStore } from '@/stores/editorStore';

interface TransitionBlockProps {
  transition: { id: string; type: string; duration: number; clipAId: string; clipBId: string };
  clipAEnd: number;
  pps: number;
  trackHeight: number;
}

const MIN_DURATION = 0.1;  // 최소 0.1초
const MAX_DURATION = 5.0;  // 최대 5초

export const TransitionBlock: React.FC<TransitionBlockProps> = ({
  transition, clipAEnd, pps, trackHeight
}) => {
  const updateTransition = useEditorStore(s => s.updateTransition);
  const dragRef = useRef<{ startX: number; startDur: number; side: 'left' | 'right' | 'move' } | null>(null);

  const width = Math.max(transition.duration * pps, 48);
  const left = clipAEnd - width / 2;

  const handleMouseDown = useCallback((e: React.MouseEvent, side: 'left' | 'right' | 'move') => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startDur: transition.duration, side };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dSec = dx / pps;

      let newDuration = dragRef.current.startDur;
      if (dragRef.current.side === 'right') {
        newDuration = dragRef.current.startDur + dSec;
      } else if (dragRef.current.side === 'left') {
        newDuration = dragRef.current.startDur - dSec;
      }
      // move는 향후 위치 이동용 (지금은 duration만)

      newDuration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, newDuration));

      if (updateTransition) {
        updateTransition(transition.id, { duration: Math.round(newDuration * 10) / 10 });
      }
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [transition.id, transition.duration, pps, updateTransition]);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: 0,
        width: `${width}px`,
        height: `${trackHeight}px`,
        background: 'linear-gradient(135deg, #c026d3dd, #9333eadd)',
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'grab',
        zIndex: 25,
        border: '2px solid #e879f9',
        boxShadow: '0 2px 8px rgba(192,38,211,0.4)',
        userSelect: 'none',
      }}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
    >
      <span style={{ fontSize: 14 }}>⬡</span>
      <span style={{ fontSize: 10, textTransform: 'capitalize' }}>{transition.type}</span>
      <span style={{ fontSize: 9, opacity: 0.7 }}>{transition.duration.toFixed(1)}s</span>

      {/* 왼쪽 리사이즈 핸들 */}
      <div
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 8, cursor: 'w-resize',
          background: 'linear-gradient(90deg, #e879f9aa, transparent)',
          borderRadius: '6px 0 0 6px',
        }}
        onMouseDown={(e) => handleMouseDown(e, 'left')}
      />
      {/* 오른쪽 리사이즈 핸들 */}
      <div
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: 8, cursor: 'e-resize',
          background: 'linear-gradient(270deg, #e879f9aa, transparent)',
          borderRadius: '0 6px 6px 0',
        }}
        onMouseDown={(e) => handleMouseDown(e, 'right')}
      />
    </div>
  );
};
