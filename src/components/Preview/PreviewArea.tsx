import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { renderFrame, isVideoReady, preloadVideo } from '@/engines/canvasRenderer';

/* ─── 상수 ─── */
const CANVAS_BG = '#000000';
const PRELOAD_AHEAD = 0.5; // 전환 전 0.5초 미리 로드

/* ─── 컴포넌트 ─── */
export default function PreviewArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const lastDrawnTimeRef = useRef<number>(-1);

  const currentTime = useEditorStore(s => s.currentTime);
  const setCurrentTime = useEditorStore(s => s.setCurrentTime);
  const isPlaying = useEditorStore(s => s.isPlaying);
  const setIsPlaying = useEditorStore(s => s.setIsPlaying);
  const project = useEditorStore(s => s.project);
  const transitions = useEditorStore(s => s.transitions);

  const fps = project?.fps ?? 30;
  const projW = project?.resolution?.width ?? 1920;
  const projH = project?.resolution?.height ?? 1080;

  /* ─── 현재 활성 클립 ─── */
  const activeClip = useMemo(() => {
    if (!project?.tracks) return null;
    for (const track of project.tracks) {
      if (!track.clips) continue;
      for (const clip of track.clips) {
        const clipEnd = clip.startTime + (clip.duration || 0);
        if (currentTime >= clip.startTime && currentTime < clipEnd) {
          return clip;
        }
      }
    }
    return null;
  }, [project?.tracks, currentTime]);

  /* ─── 활성 전환 ─── */
  const activeTransition = useMemo(() => {
    if (!transitions || transitions.length === 0 || !project?.tracks) return null;
    for (const t of transitions) {
      let clipA: any = null, clipB: any = null;
      for (const track of project.tracks) {
        if (!track.clips) continue;
        for (const clip of track.clips) {
          if (clip.id === t.clipAId) clipA = clip;
          if (clip.id === t.clipBId) clipB = clip;
        }
      }
      if (!clipA || !clipB) continue;

      const tStart = clipA.startTime + clipA.duration - t.duration;
      const tEnd = clipA.startTime + clipA.duration;

      if (currentTime >= tStart && currentTime < tEnd) {
        const progress = (currentTime - tStart) / t.duration;
        return { transition: t, clipA, clipB, progress: Math.max(0, Math.min(1, progress)), tStart, tEnd };
      }
    }
    return null;
  }, [transitions, project?.tracks, currentTime]);

  /* ─── 캔버스 크기: 컨테이너에 맞추되 프로젝트 비율 유지 ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateSize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw === 0 || ch === 0) return;

      const projAspect = projW / projH;
      const contAspect = cw / ch;

      let dw: number, dh: number;
      if (contAspect > projAspect) {
        dh = ch;
        dw = ch * projAspect;
      } else {
        dw = cw;
        dh = cw / projAspect;
      }

      dw = Math.floor(dw);
      dh = Math.floor(dh);

      canvas.style.width = `${dw}px`;
      canvas.style.height = `${dh}px`;
      canvas.width = dw;
      canvas.height = dh;
    };

    const ro = new ResizeObserver(updateSize);
    ro.observe(container);
    updateSize();
    return () => ro.disconnect();
  }, [projW, projH]);

  /* ─── Video A 소스 동기화 ─── */
  useEffect(() => {
    const video = videoARef.current;
    if (!video) return;

    const clip = activeTransition ? activeTransition.clipA : activeClip;
    if (!clip) return;

    const asset = project?.assets?.find((a: any) => a.id === clip.assetId);
    const src = asset?.url || asset?.path || '';

    if (src && video.src !== src && !video.src.endsWith(src)) {
      video.src = src;
      video.load();
    }

    if (!isPlaying) {
      const localTime = currentTime - clip.startTime + (clip.inPoint || 0);
      if (Math.abs(video.currentTime - localTime) > 0.05) {
        video.currentTime = localTime;
      }
    }
  }, [activeClip, activeTransition, currentTime, isPlaying, project?.assets]);

  /* ─── Video B 소스 동기화 (전환용) ─── */
  useEffect(() => {
    const video = videoBRef.current;
    if (!video) return;

    if (!activeTransition) return;

    const clipB = activeTransition.clipB;
    const asset = project?.assets?.find((a: any) => a.id === clipB.assetId);
    const src = asset?.url || asset?.path || '';

    if (src && video.src !== src && !video.src.endsWith(src)) {
      video.src = src;
      video.load();
    }

    if (!isPlaying) {
      const localTime = currentTime - clipB.startTime + (clipB.inPoint || 0);
      if (Math.abs(video.currentTime - localTime) > 0.05) {
        video.currentTime = localTime;
      }
    }
  }, [activeTransition, currentTime, isPlaying, project?.assets]);

  /* ─── 재생 루프: video.play() + currentTime 업데이트 ─── */
  useEffect(() => {
    const videoA = videoARef.current;

    if (isPlaying && videoA && videoA.src) {
      const clip = activeClip;
      if (clip) {
        const localTime = currentTime - clip.startTime + (clip.inPoint || 0);
        videoA.currentTime = localTime;
        videoA.playbackRate = clip.speed || 1;
        videoA.muted = true;
        videoA.play().catch(() => { });
      }
    } else if (!isPlaying && videoA) {
      videoA.pause();
    }
  }, [isPlaying]);

  /* ─── 재생 시 currentTime 동기화 ─── */
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;

      const speed = activeClip?.speed || 1;
      const newTime = currentTime + dt * speed;

      // 프로젝트 끝 체크
      const maxTime = project?.duration || 60;
      if (newTime >= maxTime) {
        setCurrentTime(maxTime);
        setIsPlaying(false);
        return;
      }

      setCurrentTime(newTime);
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, currentTime, activeClip]);

  /* ─── 캔버스 렌더 루프 (매 프레임) ─── */
  useEffect(() => {
    let rafId: number;

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) { rafId = requestAnimationFrame(draw); return; }
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { rafId = requestAnimationFrame(draw); return; }

      const videoA = videoARef.current;
      const videoB = videoBRef.current;
      const w = canvas.width;
      const h = canvas.height;

      // 전환 파라미터
      const transParam = activeTransition ? {
        definitionId: `transition-${activeTransition.transition.type}`,
        progress: activeTransition.progress,
        duration: activeTransition.transition.duration,
      } : undefined;

      // ── drawImage with aspect ratio (letterbox/pillarbox) ──
      const drawWithAspect = (
        source: HTMLVideoElement | HTMLImageElement,
        targetCtx: CanvasRenderingContext2D,
        cw: number, ch: number
      ) => {
        let sw: number, sh: number;
        if (source instanceof HTMLVideoElement) {
          sw = source.videoWidth || cw;
          sh = source.videoHeight || ch;
        } else {
          sw = source.naturalWidth || cw;
          sh = source.naturalHeight || ch;
        }

        const srcAspect = sw / sh;
        const dstAspect = cw / ch;

        let dx: number, dy: number, dw: number, dh: number;
        if (srcAspect > dstAspect) {
          // 소스가 더 넓음 → 위아래 레터박스
          dw = cw;
          dh = cw / srcAspect;
          dx = 0;
          dy = (ch - dh) / 2;
        } else {
          // 소스가 더 좁음 → 좌우 필러박스
          dh = ch;
          dw = ch * srcAspect;
          dx = (cw - dw) / 2;
          dy = 0;
        }

        targetCtx.drawImage(source, dx, dy, dw, dh);
      };

      // ── 렌더링 ──
      ctx.clearRect(0, 0, w, h);

      if (activeTransition) {
        // 전환 구간
        const srcA = videoA && isVideoReady(videoA) ? videoA : null;
        const srcB = videoB && isVideoReady(videoB) ? videoB : null;

        if (srcA && srcB) {
          // 두 소스 모두 준비 → dissolve 등 전환 효과
          try {
            renderFrame({
              canvas, ctx, width: w, height: h,
              fps, currentTime,
              videoA: srcA, videoB: srcB,
              activeEffects: [],
              transition: transParam,
            });
          } catch {
            // 폴백: 수동 dissolve
            ctx.globalAlpha = 1 - activeTransition.progress;
            drawWithAspect(srcA, ctx, w, h);
            ctx.globalAlpha = activeTransition.progress;
            drawWithAspect(srcB, ctx, w, h);
            ctx.globalAlpha = 1;
          }
        } else if (srcA) {
          drawWithAspect(srcA, ctx, w, h);
        } else if (srcB) {
          drawWithAspect(srcB, ctx, w, h);
        }
        // 둘 다 없으면 이전 프레임 유지 (clearRect 이미 했으므로 검은색)

      } else if (videoA && isVideoReady(videoA)) {
        // 일반 재생
        drawWithAspect(videoA, ctx, w, h);
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [activeClip, activeTransition, currentTime, fps]);

  /* ─── 컨트롤 ─── */
  const stepFrame = useCallback((dir: number) => {
    const frameDur = 1 / fps;
    setCurrentTime(Math.max(0, currentTime + dir * frameDur));
  }, [fps, currentTime, setCurrentTime]);

  const togglePlay = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying, setIsPlaying]);

  const resetTime = useCallback(() => {
    setCurrentTime(0);
    setIsPlaying(false);
  }, [setCurrentTime, setIsPlaying]);

  const formatTimecode = (t: number) => {
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    const f = Math.floor((t % 1) * fps);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  };

  /* ─── JSX ─── */
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: '#0a0a14',
    }}>
      {/* 캔버스 컨테이너 */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          background: CANVAS_BG,
          position: 'relative',
          minHeight: 200,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', background: CANVAS_BG }}
        />
      </div>

      {/* 숨겨진 비디오 요소 */}
      <video
        ref={videoARef}
        muted playsInline preload="auto"
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
      />
      <video
        ref={videoBRef}
        muted playsInline preload="auto"
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
      />

      {/* 컨트롤 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 12, padding: '8px 0', background: '#0d0d1a',
      }}>
        <button onClick={resetTime} style={btnStyle}>⏮</button>
        <button onClick={() => stepFrame(-1)} style={btnStyle}>⏪</button>
        <button onClick={togglePlay} style={{ ...btnStyle, fontSize: 20 }}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={() => stepFrame(1)} style={btnStyle}>⏩</button>
        <span style={{ color: '#aaa', fontFamily: 'monospace', fontSize: 13, marginLeft: 8 }}>
          {formatTimecode(currentTime)}
        </span>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid #444',
  color: '#ccc', borderRadius: 4, padding: '4px 10px',
  cursor: 'pointer', fontSize: 14,
};
