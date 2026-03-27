/* ─── src/components/Preview/PreviewArea.tsx ─── */
/* Canvas 기반 통합 렌더러 — 검은 프레임 원천 차단 */

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { renderFrame, isVideoReady, preloadVideo, transitionTypeToDefinitionId } from '@/engines/canvasRenderer';
import type { Clip, Asset, Track } from '@/types/project';
import type { EffectInstance } from '@/types/effect';

/* ─── 상수 ─── */
const CONTROLS_HEIGHT = 40;
const MIN_AREA_HEIGHT = 200;
const CONTROL_BTN_FONT_SIZE = 16;
const TIMECODE_FONT_SIZE = 12;
const CANVAS_BG = '#000';

/* ─── 인터페이스 ─── */
interface ActiveClipData {
  readonly clip: Clip;
  readonly asset: Asset;
  readonly track: Track;
}

interface TransitionInfo {
  clipAId: string;
  clipBId: string;
  type: string;
  duration: number;
  progress: number;
}

/* ─── 타임코드 포맷 ─── */
function formatTimecode(sec: number, fps: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const f = Math.floor((sec % 1) * fps);
  return `${h.toString().padStart(2, '0')}:${m
    .toString().padStart(2, '0')}:${s
      .toString().padStart(2, '0')}:${f
        .toString().padStart(2, '0')}`;
}

/* ─── 스타일 ─── */
const styles = {
  area: {
    flex: 1, display: 'flex', flexDirection: 'column' as const,
    background: CANVAS_BG, minHeight: MIN_AREA_HEIGHT, position: 'relative' as const,
  },
  canvasWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    background: '#000',
    position: 'relative' as const,
  },
  canvas: {
    background: CANVAS_BG,
    display: 'block',
  },
  controls: {
    height: CONTROLS_HEIGHT, background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  controlBtn: {
    background: 'transparent', border: 'none', color: 'var(--text-primary)',
    fontSize: CONTROL_BTN_FONT_SIZE, cursor: 'pointer', padding: '4px 8px', borderRadius: 4,
  },
  timecode: {
    fontFamily: 'var(--font-mono)', fontSize: TIMECODE_FONT_SIZE,
    color: 'var(--text-secondary)', minWidth: 80, textAlign: 'center' as const,
  },
  hiddenVideo: {
    position: 'absolute' as const, top: -9999, left: -9999,
    width: 1, height: 1, opacity: 0, pointerEvents: 'none' as const,
  },
};

/* ════════════════════════════════════════
   컴포넌트
   ════════════════════════════════════════ */
export function PreviewArea(): React.ReactElement {
  /* ── Store 구독 ── */
  const currentTime = useEditorStore(s => s.currentTime);
  const isPlaying = useEditorStore(s => s.isPlaying);
  const project = useEditorStore(s => s.project);
  const togglePlay = useEditorStore(s => s.togglePlay);
  const setCurrentTime = useEditorStore(s => s.setCurrentTime);
  const transitions = useEditorStore(s => s.transitions);

  /* ── Refs ── */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const videoARef = useRef<HTMLVideoElement>(null);   // 항상 DOM에 존재
  const videoBRef = useRef<HTMLVideoElement>(null);   // 항상 DOM에 존재
  const lastTimeRef = useRef<number>(0);
  const currentSrcA = useRef<string>('');
  const currentSrcB = useRef<string>('');

  /* ── Canvas 2D context 초기화 ── */
  useEffect(() => {
    if (canvasRef.current && !ctxRef.current) {
      ctxRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
    }
  }, []);

  const resW = project?.width ?? 1920;
  const resH = project?.height ?? 1080;

  /* ── 캔버스 크기 제어 (ResizeObserver) ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    const updateSize = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;

      const projAspect = resW / resH;
      const containerAspect = clientWidth / clientHeight;

      let displayW: number, displayH: number;
      if (containerAspect > projAspect) {
        displayH = clientHeight;
        displayW = clientHeight * projAspect;
      } else {
        displayW = clientWidth;
        displayH = clientWidth / projAspect;
      }

      canvas.style.width = `${Math.floor(displayW)}px`;
      canvas.style.height = `${Math.floor(displayH)}px`;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(displayW * dpr);
      canvas.height = Math.floor(displayH * dpr);
    };

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    updateSize();

    return () => resizeObserver.disconnect();
  }, [resW, resH]);

  /* ── 현재 시간의 활성 클립 찾기 ── */
  const activeClip: ActiveClipData | null = useMemo(() => {
    const sorted = [...project.tracks].sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
    for (const track of sorted) {
      if (!track.visible) continue;
      for (const clip of track.clips) {
        if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
          const asset = project.assets.find(a => a.id === clip.assetId);
          if (asset) return { clip, asset, track };
        }
      }
    }
    return null;
  }, [project.tracks, project.assets, currentTime]);

  /* ── 현재 시간의 활성 전환 찾기 ── */
  const activeTransition: (TransitionInfo & { fromClip: ActiveClipData; toClip: ActiveClipData }) | null =
    useMemo(() => {
      if (!transitions || transitions.length === 0) return null;

      for (const tr of transitions) {
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

        const clipAEnd = fromClip.clip.startTime + fromClip.clip.duration;
        const tStart = clipAEnd - tr.duration;
        const tEnd = clipAEnd;

        if (currentTime >= tStart && currentTime < tEnd) {
          const progress = (currentTime - tStart) / tr.duration;
          return {
            clipAId: tr.clipAId,
            clipBId: tr.clipBId,
            type: tr.type,
            duration: tr.duration,
            progress: Math.max(0, Math.min(1, progress)),
            fromClip,
            toClip,
          };
        }
      }
      return null;
    }, [project.tracks, project.assets, transitions, currentTime]);

  /* ── Video A: src 및 seek 동기화 ── */
  useEffect(() => {
    const video = videoARef.current;
    if (!video) return;

    const data = activeTransition ? activeTransition.fromClip : activeClip;
    if (!data) return;
    if (data.asset.type !== 'video') return;

    // src 변경
    const newSrc = data.asset.src;
    if (currentSrcA.current !== newSrc) {
      video.src = newSrc;
      video.load();
      currentSrcA.current = newSrc;
    }

    // seek
    const relTime = currentTime - data.clip.startTime;
    const seekTime = data.clip.inPoint + relTime;
    video.playbackRate = data.clip.speed;
    if (Math.abs(video.currentTime - seekTime) > 0.05) {
      video.currentTime = seekTime;
    }
    video.muted = data.track.muted;
    if (isPlaying && video.paused) video.play().catch(() => { });
    if (!isPlaying && !video.paused) video.pause();
  }, [currentTime, isPlaying, activeClip, activeTransition]);

  /* ── Video B: 전환용 src 및 seek 동기화 ── */
  useEffect(() => {
    const video = videoBRef.current;
    if (!video || !activeTransition) return;

    const data = activeTransition.toClip;
    if (data.asset.type !== 'video') return;

    const newSrc = data.asset.src;
    if (currentSrcB.current !== newSrc) {
      video.src = newSrc;
      video.load();
      currentSrcB.current = newSrc;
    }

    const relTime = currentTime - data.clip.startTime;
    const seekTime = data.clip.inPoint + relTime;
    video.playbackRate = data.clip.speed;
    if (Math.abs(video.currentTime - seekTime) > 0.05) {
      video.currentTime = seekTime;
    }
    video.muted = data.track.muted;
    if (isPlaying && video.paused) video.play().catch(() => { });
    if (!isPlaying && !video.paused) video.pause();
  }, [currentTime, isPlaying, activeTransition]);

  /* ── Video B 프리로드: 전환 시작 0.5초 전 ── */
  useEffect(() => {
    if (!transitions || transitions.length === 0) return;
    const video = videoBRef.current;
    if (!video) return;

    for (const tr of transitions) {
      let fromClip: Clip | null = null;
      let toClip: Clip | null = null;
      let toAsset: Asset | null = null;

      for (const track of project.tracks) {
        for (const clip of track.clips) {
          if (clip.id === tr.clipAId) fromClip = clip;
          if (clip.id === tr.clipBId) {
            toClip = clip;
            toAsset = project.assets.find(a => a.id === clip.assetId) ?? null;
          }
        }
      }
      if (!fromClip || !toClip || !toAsset) continue;
      if (toAsset.type !== 'video') continue;

      const clipAEnd = fromClip.startTime + fromClip.duration;
      const preloadTime = clipAEnd - tr.duration - 0.5;

      if (currentTime >= preloadTime && currentTime < clipAEnd - tr.duration) {
        if (currentSrcB.current !== toAsset.src) {
          preloadVideo(video, toAsset.src, toClip.inPoint);
          currentSrcB.current = toAsset.src;
        }
      }
    }
  }, [currentTime, transitions, project.tracks, project.assets]);

  /* ── 재생 루프 ── */
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
        const c = t.clips.find(
          cl => state.currentTime >= cl.startTime && state.currentTime < cl.startTime + cl.duration,
        );
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

  /* ── Canvas 렌더 루프 ── */
  useEffect(() => {
    if (!canvasRef.current) return;
    let animId: number;

    const loop = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (!canvas || !ctx) {
        animId = requestAnimationFrame(loop);
        return;
      }

      // 이미지 소스 결정
      let imageA: HTMLImageElement | null = null;
      const clipData = activeTransition ? activeTransition.fromClip : activeClip;
      if (clipData && clipData.asset.type === 'image') {
        const img = new Image();
        img.src = clipData.asset.src;
        if (img.complete) imageA = img;
      }

      // 전환 파라미터 구성
      const transParam = activeTransition ? {
        definitionId: `transition-${activeTransition.type}`, // 'dissolve' → 'transition-dissolve'
        progress: activeTransition.progress,
        duration: activeTransition.duration,
      } : null;

      // TODO: E-3에서 EffectInstance CRUD 구현 후 여기서 활성 효과를 가져옴
      const activeEffects: any[] = [];

      renderFrame({
        canvas,
        ctx,
        width: canvas.width,
        height: canvas.height,
        fps: project.fps,
        currentTime,
        videoA: videoARef.current,
        videoB: videoBRef.current,
        imageA: imageA ?? null,
        activeEffects,
        transition: transParam,
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [currentTime, activeClip, activeTransition, project.fps]);

  /* ── 프레임 스텝 ── */
  const stepFrame = useCallback(
    (dir: number) => setCurrentTime(currentTime + dir / project.fps),
    [currentTime, project.fps, setCurrentTime],
  );

  /* ── 렌더 ── */
  return (
    <div style={styles.area}>
      {/* 항상 DOM에 존재하는 hidden video 요소들 — 마운트/언마운트 없음 */}
      <video
        ref={videoARef}
        style={styles.hiddenVideo}
        playsInline
        preload="auto"
        crossOrigin="anonymous"
      />
      <video
        ref={videoBRef}
        style={styles.hiddenVideo}
        playsInline
        preload="auto"
        crossOrigin="anonymous"
      />

      {/* Canvas — 모든 렌더링은 여기서 발생 */}
      <div style={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          style={styles.canvas}
          width={project.width || 1920}
          height={project.height || 1080}
        />
      </div>

      {/* 컨트롤 */}
      <div style={styles.controls}>
        <button style={styles.controlBtn} onClick={() => setCurrentTime(0)}>⏮</button>
        <button style={styles.controlBtn} onClick={() => stepFrame(-1)}>⏪</button>
        <button style={styles.controlBtn} onClick={togglePlay}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button style={styles.controlBtn} onClick={() => stepFrame(1)}>⏩</button>
        <span style={styles.timecode}>{formatTimecode(currentTime, project.fps)}</span>
      </div>
    </div>
  );
}
