import React, { useState, useRef } from 'react';
import type { Marker } from '@/types/project';
import { useEditorStore } from '@/stores/editorStore';

interface Props {
  markers: Marker[];
  pps: number;
  totalWidth: number;
}

export default function MarkerTrack({ markers, pps, totalWidth }: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const updateMarker = useEditorStore((s) => s.updateMarker);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDrag = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startT = markers.find(m => m.id === id)?.time || 0;
    
    // Disable native drag selection which causing the "forbidden" cursor
    const onMove = (ev: MouseEvent) => {
      if (!containerRef.current) return;
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

  return (
    <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: totalWidth, height: 28, zIndex: 11000, pointerEvents: 'none', userSelect: 'none' }}>
      {markers.map((m) => (
        <div 
          key={m.id} 
          style={{ position: 'absolute', left: m.time * pps - 11, top: 0, width: 22, height: 28, pointerEvents: 'auto', cursor: 'ew-resize' }}
          onMouseDown={(e) => handleDrag(m.id, e)}
          onDragStart={(e) => e.preventDefault()} // Definitively kills the "forbidden" cursor
        >
          <div
            onDoubleClick={() => { setEditId(m.id); setEditLabel(m.label); }}
            title={`${m.label} (${m.time.toFixed(2)}s)`}
            style={{ width: 0, height: 0, borderLeft: '11px solid transparent', borderRight: '11px solid transparent', borderBottom: '16px solid #ffcc00', transform: 'scaleY(-1)', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))' }}
          />
          {/* Centered Indicator line */}
          <div style={{ position: 'absolute', left: 10.25, top: 16, width: 1.5, height: 5000, background: '#ffcc00', opacity: 0.6, pointerEvents: 'none', zIndex: -1 }} />
          
          {editId === m.id && (
            <input autoFocus value={editLabel} onChange={(e) => setEditLabel(e.target.value)} onBlur={() => { updateMarker(m.id, { label: editLabel }); setEditId(null); }} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} style={{ position: 'absolute', left: 24, top: 2, fontSize: 11, width: 80, background: '#1a1a1a', color: '#fff', border: '1px solid #ffcc00', outline: 'none', borderRadius: 2, padding: '1px 4px', zIndex: 100 }} />
          )}
        </div>
      ))}
    </div>
  );
}
