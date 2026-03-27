// src/components/Preview/PreviewArea.tsx

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { Clip, Asset, Track } from '@/types/project';

const CONTROLS_HEIGHT = 40;
const MIN_AREA_HEIGHT = 200;
const CONTROL_BTN_FONT_SIZE = 16;
const CONTROL_BTN_PADDING_V = 4;
const CONTROL_BTN_PADDING_H = 8;
const CONTROL_BTN_RADIUS = 4;
const CONTROL_GAP = 12;
const TIMECODE_FONT_SIZE = 12;
const TIMECODE_MIN_WIDTH = 80;
const PLACEHOLDER_FONT_SIZE = 13;
const AUDIO_ICON_FONT_SIZE = 40;
const AUDIO_LABEL_FONT_SIZE = 13;
const AUDIO_LABEL_MARGIN_TOP = 10;
const SEEK_TOLERANCE = 0.1;

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
  const hh = h.toString().padStart(2, '0');
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  const ff = f.toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}:${ff}`;
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
  placeholder: {
    color: 'var(--text-muted)',
    fontSize: PLACEHOLDER_FONT_SIZE,
  } as React.CSSProperties,
  controls: {
    height: CONTROLS_HEIGHT,
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: CONTROL_GAP,
  } as React.CSSProperties,
  controlBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: CONTROL_BTN_FONT_SIZE,
    cursor: 'pointer',
    padding: `${CONTROL_BTN_PADDING_V}px ${CONTROL_BTN_PADDING_H}px`,
    borderRadius: CONTROL_BTN_RADIUS,
  } as React.CSSProperties,
  timecode: {
    fontFamily: 'var(--font-mono)',
    fontSize: TIMECODE_FONT_SIZE,
    color: 'var(--text-secondary)',
    minWidth: TIMECODE_MIN_WIDTH,
    textAlign: 'center',
  } as React.CSSProperties,
  audioPreview: {
    textAlign: 'center',
  } as React.CSSProperties,
  audioIcon: {
    fontSize: AUDIO_ICON_FONT_SIZE,
  } as React.CSSProperties,
  audioLabel: {
    fontSize: AUDIO_LABEL_FONT_SIZE,
    color: 'var(--text-secondary)',
    marginTop: AUDIO_LABEL_MARGIN_TOP,
  } as React.CSSProperties,
} as const;

export function PreviewArea(): React.ReactElement {
  const currentTime = useEditorStore((s) => s.currentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const project = useEditorStore((s) => s.project);
  const togglePlay = useEditorStore((s) => s.togglePlay);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);

  const videoRef = useRef<HTMLVideoElement>(null);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // ── Find active clip at currentTime ──
  const activeClip: ActiveClipData | null = useMemo(() => {
    for (const track of project.tracks) {
      if (!track.visible) continue;
      if (
        track.type !== 'video' &&
        track.type !== 'text' &&
        track.type !== 'audio'
      ) {
        continue;
      }
      for (const clip of track.clips) {
        if (
          currentTime >= clip.timelineStart &&
          currentTime < clip.timelineEnd
        ) {
          const asset = project.assets.find((a) => a.id === clip.assetId);
          if (asset !== undefined) {
            return { clip, asset, track };
          }
        }
      }
    }
    return null;
  }, [project.tracks, project.assets, currentTime]);

  // ── Playback loop ──
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

  // ── Sync video element ──
  useEffect(() => {
    const video = videoRef.current;
    if (video === null || activeClip === null) return;

    const clipTime =
      currentTime - activeClip.clip.timelineStart + activeClip.clip.sourceStart;

    if (Math.abs(video.currentTime - clipTime) > SEEK_TOLERANCE) {
      video.currentTime = clipTime;
    }

    if (isPlaying && video.paused) {
      video.play().catch(() => undefined);
    }
    if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [currentTime, isPlaying, activeClip]);

  // ── Frame step ──
  const stepFrame = useCallback(
    (dir: number) => {
      setCurrentTime(currentTime + dir / project.fps);
    },
    [currentTime, project.fps, setCurrentTime],
  );

  // ── Build transform style ──
  const mediaTransform =
    activeClip !== null
      ? `translate(${activeClip.clip.transform.x}px, ${activeClip.clip.transform.y}px) scale(${activeClip.clip.transform.scaleX}) rotate(${activeClip.clip.transform.rotation}deg)`
      : '';

  return (
    <div style={styles.area}>
      <div style={styles.canvas}>
        {activeClip !== null ? (
          activeClip.asset.type === 'video' ? (
            <video
              ref={videoRef}
              src={activeClip.asset.src}
              style={{
                ...styles.media,
                opacity: activeClip.clip.opacity,
                transform: mediaTransform,
              }}
              muted={activeClip.track.muted}
            />
          ) : activeClip.asset.type === 'audio' ? (
            <div style={styles.audioPreview}>
              <div style={styles.audioIcon}>🎵</div>
              <div style={styles.audioLabel}>{activeClip.asset.name}</div>
              <video
                ref={videoRef}
                src={activeClip.asset.src}
                style={{ display: 'none' }}
                muted={activeClip.track.muted}
              />
            </div>
          ) : (
            <img
              src={activeClip.asset.src}
              style={{
                ...styles.media,
                opacity: activeClip.clip.opacity,
                transform: mediaTransform,
              }}
              alt=""
            />
          )
        ) : (
          <span style={styles.placeholder}>No clip at current time</span>
        )}
      </div>

      <div style={styles.controls}>
        <button
          style={styles.controlBtn}
          onClick={() => setCurrentTime(0)}
          title="Home"
        >
          ⏮
        </button>
        <button
          style={styles.controlBtn}
          onClick={() => stepFrame(-1)}
          title="Previous Frame"
        >
          ⏪
        </button>
        <button
          style={styles.controlBtn}
          onClick={togglePlay}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          style={styles.controlBtn}
          onClick={() => stepFrame(1)}
          title="Next Frame"
        >
          ⏩
        </button>
        <span style={styles.timecode}>
          {formatTimecode(currentTime, project.fps)}
        </span>
      </div>
    </div>
  );
}
