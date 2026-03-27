import React, { useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    height: 32,
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    gap: 8,
    flexShrink: 0,
  },
  toolBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 11,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 3,
  },
  toolBtnActive: {
    background: 'var(--accent)',
    color: '#fff',
  },
  zoomSlider: {
    width: 80,
    height: 4,
    accentColor: 'var(--accent)',
  },
  select: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    color: 'var(--text-primary)',
    fontSize: 11,
    padding: '2px 6px',
  },
};

export default function TimelineToolbar() {
  const trimMode = useEditorStore((s) => s.trimMode);
  const setTrimMode = useEditorStore((s) => s.setTrimMode);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const addMarker = useEditorStore((s) => s.addMarker);
  const setInPoint = useEditorStore((s) => s.setInPoint);
  const setOutPoint = useEditorStore((s) => s.setOutPoint);
  const currentTime = useEditorStore((s) => s.currentTime);
  const skillLevel = useEditorStore((s) => s.skillLevel);
  const expertMode = skillLevel === 'expert';
  const showAdvancedTrim = useEditorStore((s) => s.getSkillConfig().showAdvancedTrim);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const splitClip = useEditorStore((s) => s.splitClip);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyI') {
        e.preventDefault();
        setInPoint(currentTime);
      }
      if (e.code === 'KeyO') {
        e.preventDefault();
        setOutPoint(currentTime);
      }
      if (e.code === 'KeyM') {
        e.preventDefault();
        addMarker(currentTime, `Marker ${new Date().toISOString().slice(11, 19)}`, '#ffcc00');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentTime, setInPoint, setOutPoint, addMarker]);



  return (
    <div style={styles.toolbar}>
      {showAdvancedTrim && (
        <select
          style={styles.select}
          value={trimMode}
          onChange={(e) => setTrimMode(e.target.value as any)}
          title="Trim mode"
        >
          <option value="normal">Normal</option>
          <option value="ripple">Ripple</option>
          <option value="roll">Roll</option>
          <option value="slip">Slip</option>
          <option value="slide">Slide</option>
        </select>
      )}

      {expertMode && (
        <>
          <button style={styles.toolBtn} onClick={() => setInPoint(currentTime)} title="In point (I)">I In</button>
          <button style={styles.toolBtn} onClick={() => setOutPoint(currentTime)} title="Out point (O)">O Out</button>
          <button style={styles.toolBtn} onClick={() => addMarker(currentTime, 'Marker', '#ffcc00')} title="Add Marker (M)">M Marker</button>
        </>
      )}

      <button style={{ ...styles.toolBtn, ...(snapEnabled ? styles.toolBtnActive : {}) }} onClick={toggleSnap}>
        🧲 Snap
      </button>
      <button 
        style={styles.toolBtn} 
        title="Split (C)"
        onClick={() => { if (selectedClipId) splitClip(selectedClipId, currentTime); }}
      >
        ✂ Split
      </button>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Zoom</span>
      <input
        type="range"
        min="0.2"
        max="5"
        step="0.1"
        value={zoom}
        onChange={(e) => setZoom(parseFloat(e.target.value))}
        style={styles.zoomSlider}
      />
    </div>
  );
}
