import React, { useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';

const styles: Record<string, React.CSSProperties> = {
  area: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#000',
    minHeight: 200,
    position: 'relative',
  },
  canvas: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  video: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain' as const,
  },
  placeholder: {
    color: 'var(--text-muted)',
    fontSize: 13,
  },
  controls: {
    height: 40,
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  controlBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: 16,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 4,
  },
  timecode: {
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    color: 'var(--text-secondary)',
    minWidth: 80,
    textAlign: 'center' as const,
  },
};

function formatTimecode(sec: number, fps: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const f = Math.floor((sec % 1) * fps);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
}

export default function PreviewArea() {
  const currentTime = useEditorStore((s) => s.currentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const project = useEditorStore((s) => s.project);
  const togglePlay = useEditorStore((s) => s.togglePlay);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Find active clip at currentTime (Respecting track.visible)
  const activeData = (() => {
    for (const track of project.tracks) {
      if (!track.visible) continue; // Skip hidden tracks (Issue 1)
      if (track.type !== 'video' && track.type !== 'text' && track.type !== 'audio') continue;
      for (const clip of track.clips) {
        if (currentTime >= clip.timelineStart && currentTime < clip.timelineEnd) {
          const asset = project.assets.find((a) => a.id === clip.assetId);
          if (asset) return { clip, asset, track };
        }
      }
    }
    return null;
  })();
  const activeClip = activeData;

  // Playback loop
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animRef.current);
      return;
    }
    lastTimeRef.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      const state = useEditorStore.getState();
      const next = state.currentTime + dt;
      if (next >= state.project.duration) {
        state.setCurrentTime(0);
        state.setIsPlaying(false);
        return;
      }
      state.setCurrentTime(next);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying]);

  // Sync video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip) return;
    const clipTime = currentTime - activeClip.clip.timelineStart + activeClip.clip.sourceStart;
    if (Math.abs(video.currentTime - clipTime) > 0.1) {
      video.currentTime = clipTime;
    }
    if (isPlaying && video.paused) video.play().catch(() => {});
    if (!isPlaying && !video.paused) video.pause();
  }, [currentTime, isPlaying, activeClip]);

  const stepFrame = useCallback((dir: number) => {
    setCurrentTime(currentTime + dir / project.fps);
  }, [currentTime, project.fps, setCurrentTime]);

  return (
    <div style={styles.area}>
      <div style={styles.canvas}>
        {activeClip ? (
          activeClip.asset.type === 'video' ? (
            <video
              ref={videoRef}
              src={activeClip.asset.src}
              style={{
                ...styles.video,
                opacity: activeClip.clip.opacity,
                transform: `translate(${activeClip.clip.transform.x}px, ${activeClip.clip.transform.y}px) scale(${activeClip.clip.transform.scaleX}) rotate(${activeClip.clip.transform.rotation}deg)`,
              }}
              muted={activeClip.track.muted}
            />
          ) : activeClip.asset.type === 'audio' ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40 }}>🔊</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 10 }}>{activeClip.asset.name}</div>
              <video ref={videoRef} src={activeClip.asset.src} style={{ display: 'none' }} muted={activeClip.track.muted} />
            </div>
          ) : (
            <img
              src={activeClip.asset.src}
              style={{
                ...styles.video,
                opacity: activeClip.clip.opacity,
                transform: `translate(${activeClip.clip.transform.x}px, ${activeClip.clip.transform.y}px) scale(${activeClip.clip.transform.scaleX}) rotate(${activeClip.clip.transform.rotation}deg)`,
              }}
              alt=""
            />
          )

        ) : (
          <span style={styles.placeholder}>No clip at current time</span>
        )}
      </div>
      <div style={styles.controls}>
        <button style={styles.controlBtn} onClick={() => setCurrentTime(0)} title="Home">⏮</button>
        <button style={styles.controlBtn} onClick={() => stepFrame(-1)} title="Previous Frame">⏪</button>
        <button style={styles.controlBtn} onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button style={styles.controlBtn} onClick={() => stepFrame(1)} title="Next Frame">⏩</button>
        <span style={styles.timecode}>{formatTimecode(currentTime, project.fps)}</span>
      </div>
    </div>
  );
}
