/* ─── src/components/Preview/PreviewArea.tsx ─── */
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { Clip, Asset, Track, Transition } from '@/types/project';

const CONTROLS_HEIGHT = 40;
const MIN_AREA_HEIGHT = 200;
const CONTROL_BTN_FONT_SIZE = 16;
const TIMECODE_FONT_SIZE = 12;

interface ActiveClipData {
  readonly clip: Clip;
  readonly asset: Asset;
  readonly track: Track;
}

/* ★ NEW: 전환 중인 두 클립 정보 */
interface TransitionState {
  readonly transition: Transition;
  readonly fromClip: ActiveClipData;
  readonly toClip: ActiveClipData;
  readonly progress: number; // 0 → 1 (전환 시작 → 끝)
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
  /* ★ NEW: 전환 레이어 스타일 */
  transitionLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  } as React.CSSProperties,
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
        case 'saturate':    return `saturate(${1 + num / 100})`;
        case 'hue shift':   return `hue-rotate(${num}deg)`;
        case 'hue-rotate':  return `hue-rotate(${num}deg)`;
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

/* ★ NEW: 전환 타입별 CSS 스타일 계산 */
function getTransitionStyles(
  type: string,
  progress: number,
): { from: React.CSSProperties; to: React.CSSProperties } {
  switch (type) {
    case 'dissolve':
      return {
        from: { opacity: 1 - progress },
        to:   { opacity: progress },
      };
    case 'fade-black':
      return {
        from: { opacity: progress < 0.5 ? 1 - progress * 2 : 0 },
        to:   { opacity: progress < 0.5 ? 0 : (progress - 0.5) * 2 },
      };
    case 'fade-white':
      return {
        from: { opacity: progress < 0.5 ? 1 - progress * 2 : 0 },
        to:   { opacity: progress < 0.5 ? 0 : (progress - 0.5) * 2 },
      };
    case 'wipe-left':
      return {
        from: { clipPath: `inset(0 ${progress * 100}% 0 0)` },
        to:   { clipPath: `inset(0 0 0 ${(1 - progress) * 100}%)` },
      };
    case 'wipe-right':
      return {
        from: { clipPath: `inset(0 0 0 ${progress * 100}%)` },
        to:   { clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` },
      };
    case 'wipe-up':
      return {
        from: { clipPath: `inset(${progress * 100}% 0 0 0)` },
        to:   { clipPath: `inset(0 0 ${(1 - progress) * 100}% 0)` },
      };
    case 'wipe-down':
      return {
        from: { clipPath: `inset(0 0 ${progress * 100}% 0)` },
        to:   { clipPath: `inset(${(1 - progress) * 100}% 0 0 0)` },
      };
    case 'slide-left':
      return {
        from: { transform: `translateX(${-progress * 100}%)` },
        to:   { transform: `translateX(${(1 - progress) * 100}%)` },
      };
    case 'slide-right':
      return {
        from: { transform: `translateX(${progress * 100}%)` },
        to:   { transform: `translateX(${-(1 - progress) * 100}%)` },
      };
    case 'zoom-in':
      return {
        from: { opacity: 1 - progress, transform: `scale(${1 + progress * 0.5})` },
        to:   { opacity: progress, transform: `scale(${0.5 + progress * 0.5})` },
      };
    case 'zoom-out':
      return {
        from: { opacity: 1 - progress, transform: `scale(${1 - progress * 0.3})` },
        to:   { opacity: progress, transform: `scale(${1.3 - progress * 0.3})` },
      };
    case 'blur':
      return {
        from: { opacity: 1 - progress, filter: `blur(${progress * 20}px)` },
        to:   { opacity: progress, filter: `blur(${(1 - progress) * 20}px)` },
      };
    default: // fallback: dissolve
      return {
        from: { opacity: 1 - progress },
        to:   { opacity: progress },
      };
  }
}

export function PreviewArea(): React.ReactElement {
  const currentTime = useEditorStore((s) => s.currentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const project = useEditorStore((s) => s.project);
  const togglePlay = useEditorStore((s) => s.togglePlay);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null); /* ★ NEW: 전환용 두 번째 비디오 */
  const lastTimeRef = useRef<number>(0);

  // Active clip: find top-most visible track with a clip at currentTime
  const activeClip: ActiveClipData | null = useMemo(() => {
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

  /* ★ NEW: 현재 시간에 활성화된 전환 효과 감지 */
  const activeTransition: TransitionState | null = useMemo(() => {
    const transitions = project.transitions;
    if (!transitions || transitions.length === 0) return null;

    for (const tr of transitions) {
      // clipA(from)와 clipB(to) 찾기
      let fromClip: ActiveClipData | null = null;
      let toClip: ActiveClipData | null = null;

      for (const track of project.tracks) {
        for (const clip of track.clips) {
          if (clip.id === tr.clipAId) {
            const asset = project.assets.find(a => a.id === clip.assetId);
            if (asset) fromClip = { clip, asset, track };
          }
          if (clip.id === tr.clipBId) {
            const asset = project.assets.find(a => a.id === clip.assetId);
            if (asset) toClip = { clip, asset, track };
          }
        }
      }

      if (!fromClip || !toClip) continue;

      // 전환 구간: clipA 끝 - duration ~ clipA 끝
      const clipAEnd = fromClip.clip.startTime + fromClip.clip.duration;
      const transitionStart = clipAEnd - tr.duration;
      const transitionEnd = clipAEnd;

      if (currentTime >= transitionStart && currentTime < transitionEnd) {
        const progress = (currentTime - transitionStart) / tr.duration;
        return {
          transition: tr,
          fromClip,
          toClip,
          progress: Math.max(0, Math.min(1, progress)),
        };
      }
    }
    return null;
  }, [project.tracks, project.assets, project.transitions, currentTime]);

  // Playback Loop
  useEffect(() => {
    if (!isPlaying) return;
    lastTimeRef.current = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      const state = useEditorStore.getState();
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

  // Sync Video Element A (main)
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

  /* ★ NEW: Sync Video Element B (전환용) */
  useEffect(() => {
    const video = videoRefB.current;
    if (!video || !activeTransition) return;

    const toClip = activeTransition.toClip;
    if (toClip.asset.type !== 'video' && toClip.asset.type !== 'audio') return;

    const relTime = currentTime - toClip.clip.startTime;
    const seekTime = toClip.clip.inPoint + relTime;

    video.playbackRate = toClip.clip.speed;
    if (Math.abs(video.currentTime - seekTime) > 0.05) {
      video.currentTime = seekTime;
    }
    video.muted = toClip.track.muted;
    if (isPlaying && video.paused) video.play().catch(() => {});
    if (!isPlaying && !video.paused) video.pause();
  }, [currentTime, isPlaying, activeTransition]);

  const stepFrame = useCallback((dir: number) => {
    setCurrentTime(currentTime + dir / project.fps);
  }, [currentTime, project.fps, setCurrentTime]);

  const buildClipStyle = (data: ActiveClipData): React.CSSProperties => ({
    opacity: data.clip.opacity,
    transform: `translate(${data.clip.transform.x}px, ${data.clip.transform.y}px) scale(${data.clip.transform.scale}) rotate(${data.clip.transform.rotation}deg)`,
    mixBlendMode: data.clip.blendMode as any,
    filter: buildCssFilter(data.clip.filters),
  });

  /* ★ NEW: 단일 클립 렌더러 (재사용) */
  const renderMedia = (
    data: ActiveClipData,
    ref: React.RefObject<HTMLVideoElement | null>,
    extraStyle: React.CSSProperties = {},
  ) => {
    const clipStyle = { ...buildClipStyle(data), ...extraStyle };

    if (data.asset.type === 'video') {
      return (
        <video
          ref={ref}
          src={data.asset.src}
          style={{ ...styles.media, ...clipStyle }}
          muted={data.track.muted}
        />
      );
    }
    if (data.asset.type === 'audio') {
      return (
        <div style={styles.audioPreview}>
          <div style={styles.audioIcon}>🎵</div>
          <div style={{ fontSize: 13, color: '#aaa', marginTop: 10 }}>{data.asset.name}</div>
          <video ref={ref} src={data.asset.src} style={{ display: 'none' }} muted={data.track.muted} />
        </div>
      );
    }
    return <img src={data.asset.src} style={{ ...styles.media, ...clipStyle }} alt="" />;
  };

  /* ★ NEW: fade-white 배경 */
  const fadeWhiteBg = activeTransition?.transition.type === 'fade-white'
    ? activeTransition.progress < 0.5
      ? activeTransition.progress * 2
      : (1 - activeTransition.progress) * 2
    : 0;

  return (
    <div style={styles.area}>
      <div style={styles.canvas}>
        {/* ★ NEW: 전환 모드 렌더링 */}
        {activeTransition ? (
          <>
            {/* fade-white 배경 */}
            {activeTransition.transition.type === 'fade-white' && (
              <div style={{
                ...styles.transitionLayer,
                background: `rgba(255,255,255,${fadeWhiteBg})`,
                zIndex: 5,
                pointerEvents: 'none',
              }} />
            )}
            {/* fade-black 배경 */}
            {activeTransition.transition.type === 'fade-black' && (
              <div style={{
                ...styles.transitionLayer,
                background: '#000',
                zIndex: 0,
              }} />
            )}
            {/* From 클립 (나가는 클립) */}
            <div style={{
              ...styles.transitionLayer,
              zIndex: 1,
              ...getTransitionStyles(activeTransition.transition.type, activeTransition.progress).from,
            }}>
              {renderMedia(activeTransition.fromClip, videoRef)}
            </div>
            {/* To 클립 (들어오는 클립) */}
            <div style={{
              ...styles.transitionLayer,
              zIndex: 2,
              ...getTransitionStyles(activeTransition.transition.type, activeTransition.progress).to,
            }}>
              {renderMedia(activeTransition.toClip, videoRefB)}
            </div>
          </>
        ) : activeClip ? (
          renderMedia(activeClip, videoRef)
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
