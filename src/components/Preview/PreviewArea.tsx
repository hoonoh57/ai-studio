import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { renderFrame, isVideoReady } from '@/engines/canvasRenderer';

const CANVAS_BG = '#000000';

export function PreviewArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playAnimRef = useRef<number>(0);

  /* ─── 스토어 구독 (실제 존재하는 필드만) ─── */
  const currentTime = useEditorStore(s => s.currentTime);
  const setCurrentTime = useEditorStore(s => s.setCurrentTime);
  const isPlaying = useEditorStore(s => s.isPlaying);
  const togglePlay = useEditorStore(s => s.togglePlay);
  const project = useEditorStore(s => s.project);
  const transitions = useEditorStore(s => s.transitions);

  const fps = project?.fps ?? 30;
  // ★ project.width / project.height 사용 (resolution 아님)
  const projW = project?.width ?? 1920;
  const projH = project?.height ?? 1080;

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
      let clipA: typeof activeClip = null;
      let clipB: typeof activeClip = null;
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
        return { transition: t, clipA, clipB, progress: Math.max(0, Math.min(1, progress)) };
      }
    }
    return null;
  }, [transitions, project?.tracks, currentTime]);

  /* ─── 캔버스 크기: 컨테이너 맞춤 + 비율 유지 ─── */
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
        dh = ch; dw = ch * projAspect;
      } else {
        dw = cw; dh = cw / projAspect;
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

  /* ─── asset src 찾기 헬퍼 ─── */
  const findAssetSrc = useCallback((assetId: string): string => {
    const asset = project?.assets?.find(a => a.id === assetId);
    if (!asset) return '';
    // ★ Asset 인터페이스는 src 필드 사용
    return asset.src || '';
  }, [project?.assets]);

  /* ─── Video A 소스 동기화 ─── */
  useEffect(() => {
    const video = videoARef.current;
    if (!video) return;

    const clip = activeTransition ? activeTransition.clipA : activeClip;
    if (!clip) return;

    const src = findAssetSrc(clip.assetId);
    if (!src) return;

    // src 변경 시에만 로드
    if (!video.src.endsWith(src) && video.src !== src) {
      video.src = src;
      video.load();
    }

    // 탐색 모드: 현재 시간에 맞게 seek
    if (!isPlaying) {
      const localTime = currentTime - clip.startTime + (clip.inPoint || 0);
      if (Math.abs(video.currentTime - localTime) > 0.05) {
        video.currentTime = Math.max(0, localTime);
      }
    }
  }, [activeClip, activeTransition, currentTime, isPlaying, findAssetSrc]);

  /* ─── Video B 소스 동기화 (전환용) ─── */
  useEffect(() => {
    const video = videoBRef.current;
    if (!video || !activeTransition) return;

    const clipB = activeTransition.clipB;
    const src = findAssetSrc(clipB.assetId);
    if (!src) return;

    if (!video.src.endsWith(src) && video.src !== src) {
      video.src = src;
      video.load();
    }

    if (!isPlaying) {
      const localTime = currentTime - clipB.startTime + (clipB.inPoint || 0);
      if (Math.abs(video.currentTime - localTime) > 0.05) {
        video.currentTime = Math.max(0, localTime);
      }
    }
  }, [activeTransition, currentTime, isPlaying, findAssetSrc]);

  /* ─── 재생: video.play() 제어 ─── */
  useEffect(() => {
    const videoA = videoARef.current;
    if (!videoA) return;

    if (isPlaying && videoA.src) {
      const clip = activeClip;
      if (clip) {
        videoA.playbackRate = clip.speed || 1;
        videoA.muted = true;
        videoA.play().catch(() => { });
      }
    } else {
      videoA.pause();
    }
  }, [isPlaying, activeClip]);

  /* ─── 재생 시 currentTime 증가 ─── */
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(playAnimRef.current);
      return;
    }

    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;

      const speed = activeClip?.speed || 1;
      const state = useEditorStore.getState();
      const newTime = state.currentTime + dt * speed;
      const maxTime = project?.duration || 60;

      if (newTime >= maxTime) {
        setCurrentTime(maxTime);
        // ★ togglePlay 대신 직접 setState
        useEditorStore.setState({ isPlaying: false });
        return;
      }

      setCurrentTime(newTime);
      playAnimRef.current = requestAnimationFrame(tick);
    };

    playAnimRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(playAnimRef.current);
  }, [isPlaying]);

  /* ─── drawWithAspect: 비율 보정 그리기 ─── */
  const drawWithAspect = useCallback((
    source: HTMLVideoElement | HTMLImageElement,
    ctx: CanvasRenderingContext2D,
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
      dw = cw; dh = cw / srcAspect; dx = 0; dy = (ch - dh) / 2;
    } else {
      dh = ch; dw = ch * srcAspect; dx = (cw - dw) / 2; dy = 0;
    }
    ctx.drawImage(source, dx, dy, dw, dh);
  }, []);

  /* ─── 캔버스 렌더 루프 ─── */
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

      ctx.clearRect(0, 0, w, h);

      // 현재 스토어 시간 (클로저 말고 최신값)
      const state = useEditorStore.getState();
      const time = state.currentTime;

      if (activeTransition) {
        const srcA = videoA && isVideoReady(videoA) ? videoA : null;
        const srcB = videoB && isVideoReady(videoB) ? videoB : null;

        if (srcA && srcB) {
          // 전환 효과 렌더링 시도
          const defId = `transition-${activeTransition.transition.type}`;
          try {
            renderFrame({
              canvas, ctx, width: w, height: h,
              fps, currentTime: time,
              videoA: srcA, videoB: srcB, imageA: null,
              activeEffects: [],
              transition: {
                definitionId: defId,
                progress: activeTransition.progress,
                duration: activeTransition.transition.duration,
              },
            });
          } catch {
            // 폴백: 수동 dissolve (비율 보정)
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
      } else if (videoA && isVideoReady(videoA)) {
        drawWithAspect(videoA, ctx, w, h);
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [activeClip, activeTransition, fps, drawWithAspect]);

  /* ─── 컨트롤 ─── */
  const stepFrame = useCallback((dir: number) => {
    const frameDur = 1 / fps;
    const state = useEditorStore.getState();
    setCurrentTime(Math.max(0, state.currentTime + dir * frameDur));
  }, [fps, setCurrentTime]);

  const handleTogglePlay = useCallback(() => {
    togglePlay(); // ★ 스토어의 실제 함수
  }, [togglePlay]);

  const resetTime = useCallback(() => {
    useEditorStore.setState({ isPlaying: false });
    setCurrentTime(0);
  }, [setCurrentTime]);

  const formatTimecode = (t: number) => {
    const hrs = Math.floor(t / 3600);
    const min = Math.floor((t % 3600) / 60);
    const sec = Math.floor(t % 60);
    const frm = Math.floor((t % 1) * fps);
    return `${String(hrs).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}:${String(frm).padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a14' }}>
      <div ref={containerRef} style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', background: CANVAS_BG, position: 'relative', minHeight: 200,
      }}>
        <canvas ref={canvasRef} style={{ display: 'block', background: CANVAS_BG }} />
      </div>

      <video ref={videoARef} muted playsInline preload="auto"
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />
      <video ref={videoBRef} muted playsInline preload="auto"
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 12, padding: '8px 0', background: '#0d0d1a',
      }}>
        <button onClick={resetTime} style={btnStyle}>⏮</button>
        <button onClick={() => stepFrame(-1)} style={btnStyle}>⏪</button>
        <button onClick={handleTogglePlay} style={{ ...btnStyle, fontSize: 20 }}>
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
