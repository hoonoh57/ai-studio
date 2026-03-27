import React, { useMemo } from 'react';
import { useEditorStore } from '@/stores/editorStore';

interface Props {
  pps: number;
  duration: number;
  zoom: number;
}

export default function TimelineRuler({ pps, duration, zoom }: Props) {
  const markers = useEditorStore((s) => s.markers);
  const inOut = useEditorStore((s) => s.inOut);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * 30);
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
  };

  const ticks = useMemo(() => {
    const arr = [];
    const interval = zoom >= 2 ? 1 : zoom >= 0.5 ? 5 : 10;
    for (let t = 0; t <= duration; t += interval) {
      arr.push(
        <div key={t} style={{ position: 'absolute', left: t * pps, top: 0, height: '100%', borderLeft: '1px solid var(--border)', paddingLeft: 4, display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', userSelect: 'none' }}>{formatTime(t)}</span>
        </div>
      );
    }
    return arr;
  }, [duration, pps, zoom]);

  const handleRulerClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setCurrentTime(Math.max(0, x / pps));
  };

  return (
    <div 
      style={{ height: 28, position: 'relative', width: duration * pps, background: 'var(--bg-secondary)', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
      onClick={handleRulerClick}
    >
      {/* In/Out Highlight */}
      {inOut.inPoint !== null && inOut.outPoint !== null && (
        <div style={{
          position: 'absolute',
          left: inOut.inPoint * pps,
          width: (inOut.outPoint - inOut.inPoint) * pps,
          height: '100%',
          background: 'rgba(100, 150, 255, 0.15)',
          borderLeft: '2px solid var(--accent)',
          borderRight: '2px solid var(--accent)',
          zIndex: 1
        }} />
      )}

      {/* Markers (small triangles) */}
      {markers.map(m => (
        <div key={m.id} style={{
          position: 'absolute',
          left: m.time * pps - 4,
          bottom: 0,
          width: 0,
          height: 0,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderBottom: `6px solid ${m.color || '#ff0000'}`,
          zIndex: 10
        }} />
      ))}

      {ticks}
    </div>
  );
}
