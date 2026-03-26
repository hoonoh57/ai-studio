import React, { useRef, useCallback, useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';

const PIXELS_PER_SECOND_BASE = 50;

const clipColors: Record<string, string> = {
  video: 'var(--clip-video)',
  audio: 'var(--clip-audio)',
  text: 'var(--clip-text)',
  effect: 'var(--clip-effect)',
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    height: 'var(--timeline-height)',
    minHeight: 200,
    flexShrink: 0,
    background: 'var(--bg-panel)',
    borderTop: '2px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
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
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  trackLabels: {
    width: 100,
    flexShrink: 0,
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    overflow: 'hidden',
  },
  trackLabel: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    fontSize: 10,
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border)',
    gap: 4,
  },
  scrollArea: {
    flex: 1,
    overflowX: 'auto',
    overflowY: 'hidden',
    position: 'relative',
  },
  ruler: {
    height: 24,
    position: 'sticky',
    top: 0,
    zIndex: 5,
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
  },
  tracksContainer: {
    position: 'relative',
  },
  trackRow: {
    position: 'relative',
    borderBottom: '1px solid var(--border)',
    background: 'transparent',
  },
  clip: {
    position: 'absolute',
    top: 4,
    borderRadius: 4,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '0 6px',
    fontSize: 10,
    color: '#fff',
    fontWeight: 500,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    userSelect: 'none',
  },
  playhead: {
    position: 'absolute',
    top: 0,
    width: 2,
    background: 'var(--playhead)',
    zIndex: 10,
    pointerEvents: 'none',
  },
};

export default function TimelinePanel() {
  const project = useEditorStore((s) => s.project);
  const currentTime = useEditorStore((s) => s.currentTime);
  const zoom = useEditorStore((s) => s.zoom);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setZoom = useEditorStore((s) => s.setZoom);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const togglePlay = useEditorStore((s) => s.togglePlay);
  const selectClip = useEditorStore((s) => s.selectClip);
  const addClip = useEditorStore((s) => s.addClip);
  const updateClip = useEditorStore((s) => s.updateClip);
  const removeClip = useEditorStore((s) => s.removeClip);
  const splitClip = useEditorStore((s) => s.splitClip);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ clipId: string; startX: number; origStart: number } | null>(null);

  const pps = PIXELS_PER_SECOND_BASE * zoom;
  const totalWidth = project.duration * pps;

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedClipId) removeClip(selectedClipId);
          break;
        case 'KeyC':
          if (selectedClipId) splitClip(selectedClipId, useEditorStore.getState().currentTime);
          break;
        case 'ArrowLeft':
          setCurrentTime(Math.max(0, currentTime - 1 / project.fps));
          break;
        case 'ArrowRight':
          setCurrentTime(currentTime + 1 / project.fps);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedClipId, currentTime]);

  // Drop handler
  const handleDrop = useCallback((e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    const assetId = e.dataTransfer.getData('assetId');
    if (!assetId) return;
    const asset = project.assets.find((a) => a.id === assetId);
    if (!asset) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = scrollRef.current?.scrollLeft || 0;
    const x = e.clientX - rect.left + scrollLeft;
    const startTime = Math.max(0, x / pps);

    addClip(trackId, {
      assetId,
      timelineStart: startTime,
      timelineEnd: startTime + asset.duration,
      sourceStart: 0,
      sourceEnd: asset.duration,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      opacity: 1,
      blendMode: 'normal',
      speed: 1,
      filters: [],
      locked: false,
    });
  }, [project.assets, pps, addClip]);

  // Clip drag
  const handleClipMouseDown = useCallback((e: React.MouseEvent, clipId: string, origStart: number) => {
    e.stopPropagation();
    selectClip(clipId);
    dragRef.current = { clipId, startX: e.clientX, origStart };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dt = dx / pps;
      const newStart = Math.max(0, dragRef.current.origStart + dt);
      const state = useEditorStore.getState();
      const clip = state.project.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
      if (!clip) return;
      const duration = clip.timelineEnd - clip.timelineStart;
      updateClip(clipId, { timelineStart: newStart, timelineEnd: newStart + duration });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pps, selectClip, updateClip]);

  // Ruler click
  const handleRulerClick = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = scrollRef.current?.scrollLeft || 0;
    const x = e.clientX - rect.left + scrollLeft;
    setCurrentTime(Math.max(0, x / pps));
  }, [pps, setCurrentTime]);

  // Ruler ticks
  const rulerTicks = [];
  const tickInterval = zoom >= 2 ? 1 : zoom >= 0.5 ? 5 : 10;
  for (let t = 0; t <= project.duration; t += tickInterval) {
    rulerTicks.push(
      <div
        key={t}
        style={{
          position: 'absolute',
          left: t * pps,
          top: 0,
          height: '100%',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-end',
          paddingLeft: 3,
          paddingBottom: 2,
          fontSize: 9,
          color: 'var(--text-muted)',
        }}
      >
        {Math.floor(t / 60)}:{(t % 60).toString().padStart(2, '0')}
      </div>
    );
  }

  // Track label top offset
  let labelTop = 24; // after ruler

  return (
    <div style={styles.panel}>
      <div style={styles.toolbar}>
        <button
          style={{ ...styles.toolBtn, ...(snapEnabled ? styles.toolBtnActive : {}) }}
          onClick={toggleSnap}
        >
          🧲 Snap
        </button>
        <button style={styles.toolBtn} title="Split (C)">✂️ Split</button>
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
      <div style={styles.body}>
        {/* Track Labels */}
        <div style={styles.trackLabels}>
          <div style={{ height: 24, borderBottom: '1px solid var(--border)' }} />
          {project.tracks.map((track) => (
            <div
              key={track.id}
              style={{ ...styles.trackLabel, height: track.height }}
            >
              <span>{track.type === 'video' ? '🎬' : track.type === 'audio' ? '🎵' : '📝'}</span>
              <span>{track.name}</span>
            </div>
          ))}
        </div>

        {/* Scrollable Area */}
        <div style={styles.scrollArea} ref={scrollRef}>
          {/* Ruler */}
          <div style={{ ...styles.ruler, width: totalWidth }} onClick={handleRulerClick}>
            {rulerTicks}
          </div>

          {/* Tracks */}
          <div style={{ ...styles.tracksContainer, width: totalWidth, position: 'relative' }}>
            {project.tracks.map((track) => (
              <div
                key={track.id}
                style={{ ...styles.trackRow, height: track.height }}
                onDrop={(e) => handleDrop(e, track.id)}
                onDragOver={(e) => e.preventDefault()}
              >
                {track.clips.map((clip) => {
                  const left = clip.timelineStart * pps;
                  const width = (clip.timelineEnd - clip.timelineStart) * pps;
                  const asset = project.assets.find((a) => a.id === clip.assetId);
                  return (
                    <div
                      key={clip.id}
                      style={{
                        ...styles.clip,
                        left,
                        width,
                        height: track.height - 8,
                        background: selectedClipId === clip.id
                          ? 'var(--accent-hover)'
                          : clipColors[track.type] || 'var(--clip-video)',
                        border: selectedClipId === clip.id ? '2px solid #fff' : '1px solid rgba(255,255,255,0.15)',
                      }}
                      onClick={(e) => { e.stopPropagation(); selectClip(clip.id); }}
                      onMouseDown={(e) => handleClipMouseDown(e, clip.id, clip.timelineStart)}
                    >
                      {asset?.name || 'Clip'}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Playhead */}
            <div
              style={{
                ...styles.playhead,
                left: currentTime * pps,
                height: '100%',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
