import React, { useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { isVideoReady } from '@/engines/canvasRenderer';
import { effectRegistry } from '@/engines/effectRegistry';

const CANVAS_BG = '#000000';
const PRELOAD_AHEAD = 0.5; // 다음 클립 사전 로드 시간(초)

export function PreviewArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playAnimRef = useRef<number>(0);

  // 현재 각 비디오에 로드된 src + clipId 추적
  const loadedA = useRef<{ src: string; clipId: string }>({ src: '', clipId: '' });
  const loadedB = useRef<{ src: string; clipId: string }>({ src: '', clipId: '' });

  // 마지막으로 성공적으로 그린 프레임 보존 (검은색 방지)
  const lastFrameData = useRef<ImageData | null>(null);

  const currentTime = useEditorStore(s => s.currentTime);
  const setCurrentTime = useEditorStore(s => s.setCurrentTime);
  const isPlaying = useEditorStore(s => s.isPlaying);
  const togglePlay = useEditorStore(s => s.togglePlay);
  const project = useEditorStore(s => s.project);

  const fps = project?.fps ?? 30;
  const projW = project?.width ?? 1920;
  const projH = project?.height ?? 1080;

  /* ─── 헬퍼 함수들 ─── */
  function findClipAt(time: number) {
    const state = useEditorStore.getState();
    for (const track of state.project.tracks) {
      if (!track.clips) continue;
      for (const clip of track.clips) {
        if (time >= clip.startTime && time < clip.startTime + clip.duration) {
          return clip;
        }
      }
    }
    return null;
  }

  function findNextClip(currentClip: any) {
    const state = useEditorStore.getState();
    for (const track of state.project.tracks) {
      if (!track.clips) continue;
      const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime);
      const idx = sorted.findIndex(c => c.id === currentClip.id);
      if (idx >= 0 && idx < sorted.length - 1) {
        return sorted[idx + 1];
      }
    }
    return null;
  }

  function findTransitionAt(time: number) {
    const state = useEditorStore.getState();
    if (!state.transitions || state.transitions.length === 0) return null;
    for (const t of state.transitions) {
      let clipA: any = null, clipB: any = null;
      for (const track of state.project.tracks) {
        for (const clip of track.clips) {
          if (clip.id === t.clipAId) clipA = clip;
          if (clip.id === t.clipBId) clipB = clip;
        }
      }
      if (!clipA || !clipB) continue;
      const tStart = clipA.startTime + clipA.duration - t.duration;
      const tEnd = clipA.startTime + clipA.duration;
      if (time >= tStart && time < tEnd) {
        const progress = (time - tStart) / t.duration;
        return { transition: t, clipA, clipB, progress: Math.max(0, Math.min(1, progress)) };
      }
    }
    return null;
  }

  function getAssetSrc(assetId: string): string {
    const state = useEditorStore.getState();
    return state.project.assets?.find(a => a.id === assetId)?.src || '';
  }

  /* ─── 비디오 로드 (변경 시에만) ─── */
  function ensureVideoLoaded(
    video: HTMLVideoElement,
    ref: React.MutableRefObject<{ src: string; clipId: string }>,
    src: string,
    clipId: string,
    seekTime?: number,
  ) {
    if (ref.current.clipId === clipId && ref.current.src === src) {
      // 이미 같은 소스 로드됨 → seek만
      if (seekTime !== undefined && !useEditorStore.getState().isPlaying) {
        if (Math.abs(video.currentTime - seekTime) > 0.05) {
          video.currentTime = Math.max(0, seekTime);
        }
      }
      return;
    }
    // 새 소스 로드
    video.src = src;
    video.load();
    ref.current = { src, clipId };
    if (seekTime !== undefined) {
      video.addEventListener('loadeddata', () => {
        video.currentTime = Math.max(0, seekTime);
      }, { once: true });
    }
  }

  /* ─── drawWithAspect ─── */
  function drawWithAspect(
    source: CanvasImageSource,
    ctx: CanvasRenderingContext2D,
    cw: number, ch: number,
  ) {
    let sw = cw, sh = ch;
    if (source instanceof HTMLVideoElement) {
      sw = source.videoWidth || cw;
      sh = source.videoHeight || ch;
    } else if (source instanceof HTMLImageElement) {
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
  }

  /* ─── 캔버스 크기 ─── */
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
      if (contAspect > projAspect) { dh = ch; dw = ch * projAspect; }
      else { dw = cw; dh = cw / projAspect; }
      canvas.style.width = `${Math.floor(dw)}px`;
      canvas.style.height = `${Math.floor(dh)}px`;
      canvas.width = Math.floor(dw);
      canvas.height = Math.floor(dh);
    };
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);
    updateSize();
    return () => ro.disconnect();
  }, [projW, projH]);

  /* ─── 재생 루프 ─── */
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(playAnimRef.current);
      videoARef.current?.pause();
      videoBRef.current?.pause();
      return;
    }
    const videoA = videoARef.current;
    if (videoA && videoA.src) {
      videoA.muted = true;
      videoA.play().catch(() => { });
    }
    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      const state = useEditorStore.getState();
      const clip = findClipAt(state.currentTime);
      const speed = clip?.speed || 1;
      const newTime = state.currentTime + dt * speed;
      const maxTime = state.project?.duration || 60;
      if (newTime >= maxTime) {
        setCurrentTime(maxTime);
        useEditorStore.setState({ isPlaying: false });
        return;
      }
      setCurrentTime(newTime);
      playAnimRef.current = requestAnimationFrame(tick);
    };
    playAnimRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(playAnimRef.current);
  }, [isPlaying, setCurrentTime]);

  /* ─── 메인 캔버스 렌더 루프 ─── */
  useEffect(() => {
    let rafId: number;

    const draw = () => {
      const canvas = canvasRef.current;
      const videoA = videoARef.current;
      const videoB = videoBRef.current;
      if (!canvas || !videoA || !videoB) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { rafId = requestAnimationFrame(draw); return; }

      const state = useEditorStore.getState();
      const time = state.currentTime;
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) { rafId = requestAnimationFrame(draw); return; }

      const trans = findTransitionAt(time);
      const clip = findClipAt(time);

      let didDraw = false;

      // ══════ 전환 구간 ══════
      if (trans) {
        const srcA = getAssetSrc(trans.clipA.assetId);
        const srcB = getAssetSrc(trans.clipB.assetId);
        const localA = time - trans.clipA.startTime + (trans.clipA.inPoint || 0);
        const localB = time - trans.clipB.startTime + (trans.clipB.inPoint || 0);

        ensureVideoLoaded(videoA, loadedA, srcA, trans.clipA.id, localA);
        ensureVideoLoaded(videoB, loadedB, srcB, trans.clipB.id, localB);

        const readyA = isVideoReady(videoA);
        const readyB = isVideoReady(videoB);

        if (readyA && readyB) {
          ctx.clearRect(0, 0, w, h);
          const defId = `transition-${trans.transition.type}`;
          const def = effectRegistry.get(defId);
          if (def) {
            try {
              const result = def.render({
                time, progress: trans.progress,
                params: { progress: trans.progress, duration: trans.transition.duration },
                canvas, ctx, inputA: videoA, inputB: videoB,
                width: w, height: h, fps,
              });
              if (result.type === 'canvas') result.draw(ctx);
              didDraw = true;
            } catch {
              ctx.globalAlpha = 1 - trans.progress;
              drawWithAspect(videoA, ctx, w, h);
              ctx.globalAlpha = trans.progress;
              drawWithAspect(videoB, ctx, w, h);
              ctx.globalAlpha = 1;
              didDraw = true;
            }
          } else {
            ctx.globalAlpha = 1 - trans.progress;
            drawWithAspect(videoA, ctx, w, h);
            ctx.globalAlpha = trans.progress;
            drawWithAspect(videoB, ctx, w, h);
            ctx.globalAlpha = 1;
            didDraw = true;
          }
        } else if (readyA) {
          ctx.clearRect(0, 0, w, h);
          drawWithAspect(videoA, ctx, w, h);
          didDraw = true;
        } else if (readyB) {
          ctx.clearRect(0, 0, w, h);
          drawWithAspect(videoB, ctx, w, h);
          didDraw = true;
        }
        // 둘 다 미준비 → didDraw = false → 이전 프레임 유지

        // ══════ 일반 재생 ══════
      } else if (clip) {
        const srcA = getAssetSrc(clip.assetId);
        const localA = time - clip.startTime + (clip.inPoint || 0);
        ensureVideoLoaded(videoA, loadedA, srcA, clip.id, localA);

        // ★ 다음 클립 사전 로드 (클립 끝나기 PRELOAD_AHEAD초 전)
        const clipEnd = clip.startTime + clip.duration;
        const timeToEnd = clipEnd - time;
        if (timeToEnd <= PRELOAD_AHEAD && timeToEnd > 0) {
          const nextClip = findNextClip(clip);
          if (nextClip) {
            const nextSrc = getAssetSrc(nextClip.assetId);
            if (nextSrc) {
              ensureVideoLoaded(videoB, loadedB, nextSrc, nextClip.id, nextClip.inPoint || 0);
            }
          }
        }

        if (isVideoReady(videoA)) {
          ctx.clearRect(0, 0, w, h);
          drawWithAspect(videoA, ctx, w, h);
          didDraw = true;
        } else if (isVideoReady(videoB) && loadedB.current.clipId === clip.id) {
          // videoA가 아직 준비 안됐지만, videoB에 같은 클립이 있으면 그걸 사용
          ctx.clearRect(0, 0, w, h);
          drawWithAspect(videoB, ctx, w, h);
          didDraw = true;
        }
      }

      // ★ 핵심: 그리지 못했으면 이전 프레임 복원 (검은색 방지)
      if (didDraw) {
        // 성공한 프레임 저장
        try {
          lastFrameData.current = ctx.getImageData(0, 0, w, h);
        } catch { /* ignore */ }
      } else if (lastFrameData.current) {
        // 이전 프레임 복원
        if (lastFrameData.current.width === w && lastFrameData.current.height === h) {
          ctx.putImageData(lastFrameData.current, 0, 0);
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [fps]);

  /* ─── 컨트롤 ─── */
  const stepFrame = useCallback((dir: number) => {
    const state = useEditorStore.getState();
    setCurrentTime(Math.max(0, state.currentTime + dir / fps));
  }, [fps, setCurrentTime]);

  const handleTogglePlay = useCallback(() => { togglePlay(); }, [togglePlay]);

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
