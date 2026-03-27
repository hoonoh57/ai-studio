/* ─── src/components/Timeline/TransitionBlock.tsx ─── */
import React from 'react';

interface TransitionBlockProps {
  transition: { id: string; type: string; duration: number };
  clipAEnd: number;   // px position
  pps: number;        // pixels per second
  trackHeight: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  transition: '#c026d3',  // 마젠타
  filter: '#0ea5e9',      // 스카이블루
  motion: '#f59e0b',      // 앰버
  audio: '#10b981',       // 그린
};

export const TransitionBlock: React.FC<TransitionBlockProps> = ({
  transition, clipAEnd, pps, trackHeight
}) => {
  const width = Math.max(transition.duration * pps, 48); // 최소 48px
  const left = clipAEnd - width / 2; // 두 클립 사이 중앙 배치

  return (
    <div style={{
      position: 'absolute',
      left: `${left}px`,
      top: 0,
      width: `${width}px`,
      height: `${trackHeight}px`,
      background: `${CATEGORY_COLORS.transition}dd`,
      borderRadius: 6,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: 11,
      fontWeight: 600,
      cursor: 'ew-resize',
      zIndex: 10,
      border: '2px solid #e879f9',
      boxShadow: '0 2px 8px rgba(192,38,211,0.4)',
      userSelect: 'none',
    }}>
      {/* 아이콘 */}
      <span style={{ fontSize: 16 }}>⬡</span>
      {/* 전환 이름 */}
      <span>{transition.type}</span>
      {/* Duration */}
      <span style={{ fontSize: 9, opacity: 0.8 }}>
        {transition.duration.toFixed(1)}s
      </span>
      {/* 양쪽 드래그 핸들 */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 6, cursor: 'w-resize', background: '#e879f980',
        borderRadius: '6px 0 0 6px',
      }} />
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: 6, cursor: 'e-resize', background: '#e879f980',
        borderRadius: '0 6px 6px 0',
      }} />
    </div>
  );
};
