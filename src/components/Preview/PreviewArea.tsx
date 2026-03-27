/* ─── src/components/Preview/PreviewArea.tsx ─── */
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { Clip, Asset, Track } from '@/types/project';

const CONTROLS_HEIGHT = 40;
const MIN_AREA_HEIGHT = 200;
const CONTROL_BTN_FONT_SIZE = 16;
const TIMECODE_FONT_SIZE = 12;

interface ActiveClipData {
  readonly clip: Clip;
  readonly asset: Asset;
  readonly track: Track;
}

function formatTimecode(sec: number, fps: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const f = Math.floor((sec % 1) * fps);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
}

const styles = {
  area: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#000',
    minHeight: MIN_AREA_HEIGHT,
    position: 'relative',
  } as React.CSSProperties,
  canvas: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  } as React.CSSProperties,
  media: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  } as React.CSSProperties,
  controls: {
    height: CONTROLS_HEIGHT,
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  } as React.CSSProperties,
  controlBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: CONTROL_BTN_FONT_SIZE,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 4,
  } as React.CSSProperties,
  timecode: {
    fontFamily: 'var(--font-mono)',
    fontSize: TIMECODE_FONT_SIZE,
    color: 'var(--text-secondary)',
    minWidth: 80,
    textAlign: 'center',
  } as React.CSSProperties,
  audioPreview: { textAlign: 'center' } as React.CSSProperties,
  audioIcon: { fontSize: 40 } as React.CSSProperties,
} as const;

/** clip.filters 배열 → CSS filter 문자열 변환 */
const buildCssFilter = (filters?: any[]): string => {
  if (!filters || filters.length === 0) return 'none';

  return filters
    .map(f => {
      // T-4: params 사용 또는 기본 value 사용
      const v = f.params ? Object.values(f.params)[0] : (f.value ?? f.defaultValue ?? 0);
      const num = typeof v === 'number' ? v : 0;
      switch (f.name.toLowerCase()) {
        case 'brightness':  return `brightness(${1 + num / 100})`;
        case 'contrast':    return `contrast(${1 + num / 100})`;
        case 'saturation':  return `saturate(${1 + num / 100})`;
        case 'saturate':    return `saturate(${1 + num / 100})`; // Alias
        case 'hue shift':   return `hue-rotate(${num}deg)`;
        case 'hue-rotate':  return `hue-rotate(${num}deg)`; // Alias
        case 'blur':        return `blur(${num}px)`;
        case 'grayscale':   return `grayscale(${num / 100})`;
        case 'sepia':       return `sepia(${num / 100})`;
        case 'invert':      return `invert(${num / 100})`;
        case 'noise':       return `opacity(${1 - num / 100})`;
        case 'vignette':    return `brightness(${1 - num / 200})`;
        case 'sharpen':     return `contrast(${1 + num / 200})`;
        default:            return '';
      }
    })
    .filter(Boolean)
    .join(' ') || 'none';
};

export function PreviewArea(): React.ReactElement {
  const currentTime = useEditorStore((s) => s.currentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const project = useEditorStore((s) => s.project);
  const togglePlay = useEditorStore((s) => s.togglePlay);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTimeRef = useRef<number>(0);

  // Active clip loop: find top-most visible track with a clip at currentTime
  const activeClip: ActiveClipData | null = useMemo(() => {
    // Reverse order to check higher tracks first (layering)
    const sortedTracks = [...project.tracks].sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
    for (const track of sortedTracks) {
      if (!track.visible) continue;
      for (const clip of track.clips) {
        if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
          const asset = project.assets.find((a) => a.id === clip.assetId);
          if (asset) return { clip, asset, track };
        }
      }
    }
    return null;
  }, [project.tracks, project.assets, currentTime]);

  // Playback Loop
  useEffect(() => {
    if (!isPlaying) return;
    lastTimeRef.current = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      const state = useEditorStore.getState();
      // Find current clip speed
      let speed = 1;
      const sorted = [...state.project.tracks].sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
      for (const t of sorted) {
        if (!t.visible) continue;
        const c = t.clips.find(cl => state.currentTime >= cl.startTime && state.currentTime < cl.startTime + cl.duration);
        if (c) { speed = c.speed; break; }
      }

      const next = state.currentTime + dt * speed;
      if (next >= state.project.duration) {
        state.setCurrentTime(0);
        state.togglePlay();
        return;
      }
      state.setCurrentTime(next);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying]);

  // Sync Video Element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip) return;
    if (activeClip.asset.type !== 'video' && activeClip.asset.type !== 'audio') return;

    const relTime = currentTime - activeClip.clip.startTime;
    const seekTime = activeClip.clip.inPoint + relTime;

    video.playbackRate = activeClip.clip.speed;
    if (Math.abs(video.currentTime - seekTime) > 0.05) {
      video.currentTime = seekTime;
    }
    if (isPlaying && video.paused) video.play().catch(() => {});
    if (!isPlaying && !video.paused) video.pause();
  }, [currentTime, isPlaying, activeClip]);

  const stepFrame = useCallback((dir: number) => {
    setCurrentTime(currentTime + dir / project.fps);
  }, [currentTime, project.fps, setCurrentTime]);

  const transformStyle = activeClip ? {
    opacity: activeClip.clip.opacity,
    transform: `translate(${activeClip.clip.transform.x}px, ${activeClip.clip.transform.y}px) scale(${activeClip.clip.transform.scale}) rotate(${activeClip.clip.transform.rotation}deg)`,
    mixBlendMode: activeClip.clip.blendMode as any,
    filter: buildCssFilter(activeClip.clip.filters),
  } : {};

  return (
    <div style={styles.area}>
      <div style={styles.canvas}>
        {activeClip ? (
          activeClip.asset.type === 'video' ? (
            <video
              ref={videoRef}
              src={activeClip.asset.src}
              style={{ ...styles.media, ...transformStyle }}
              muted={activeClip.track.muted}
            />
          ) : activeClip.asset.type === 'audio' ? (
            <div style={styles.audioPreview}>
              <div style={styles.audioIcon}>🎵</div>
              <div style={{ fontSize: 13, color: '#aaa', marginTop: 10 }}>{activeClip.asset.name}</div>
              <video ref={videoRef} src={activeClip.asset.src} style={{ display: 'none' }} muted={activeClip.track.muted} />
            </div>
          ) : (
            <img src={activeClip.asset.src} style={{ ...styles.media, ...transformStyle }} alt="" />
          )
        ) : (
          <span style={{ color: '#555', fontSize: 13 }}>No clip at current time</span>
        )}
      </div>

      <div style={styles.controls}>
        <button style={styles.controlBtn} onClick={() => setCurrentTime(0)}>⏮</button>
        <button style={styles.controlBtn} onClick={() => stepFrame(-1)}>⏪</button>
        <button style={styles.controlBtn} onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
        <button style={styles.controlBtn} onClick={() => stepFrame(1)}>⏩</button>
        <span style={styles.timecode}>{formatTimecode(currentTime, project.fps)}</span>
      </div>
    </div>
  );
}
