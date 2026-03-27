import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { Track } from '@/types/project';

interface Props {
  track: Track;
}

const iconByType: Record<string, string> = {
  video: '🎬', audio: '🎵', text: '✏️', effect: '✨',
};

export default function TrackHeader({ track }: Props) {
  const updateTrack = useEditorStore((s) => s.updateTrack);

  const onDragHeight = (startY: number) => {
    const onMove = (e: MouseEvent) => {
      updateTrack(track.id, { height: Math.max(30, track.height + (e.clientY - startY)) });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div style={{ position: 'relative', height: track.height, borderBottom: '1px solid var(--border)', padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, overflow: 'hidden' }}>
        <span style={{ fontSize: 13 }}>{iconByType[track.type] || '📌'}</span>
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.name}</span>
      </div>
      
      {/* Controls: Mute, Lock, Hide (Increased spacing and clarity) */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button 
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 12, opacity: track.muted ? 0.3 : 1, filter: track.muted ? 'grayscale(1)' : 'none' }} 
          onClick={() => updateTrack(track.id, { muted: !track.muted })}
          title="Mute/Unmute"
        >
          {track.muted ? '🔇' : '🔊'}
        </button>
        <button 
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 12, opacity: track.locked ? 1 : 0.5 }} 
          onClick={() => updateTrack(track.id, { locked: !track.locked })}
          title="Lock/Unlock"
        >
          {track.locked ? '🔒' : '🔓'}
        </button>
        <button 
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 12, opacity: track.visible ? 1 : 0.4 }} 
          onClick={() => updateTrack(track.id, { visible: !track.visible })}
          title="Show/Hide"
        >
          {track.visible ? '👁️' : '🚫'}
        </button>
      </div>
      
      <div 
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, cursor: 'ns-resize', background: 'transparent', zIndex: 1 }} 
        onMouseDown={(e) => onDragHeight(e.clientY)} 
      />
    </div>
  );
}
