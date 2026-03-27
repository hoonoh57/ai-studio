import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { isVideoReady } from '@/engines/canvasRenderer';
import { effectRegistry } from '@/engines/effectRegistry';

const CANVAS_BG = '#000000';

export function PreviewArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playAnimRef = useRef<number>(0);
  // 현재 videoA/B에 로드된 src 추적
  const loadedSrcA = useRef<string>('');
  const loadedSrcB = useRef<string>('');

  const currentTime = useEditorStore(s => s.currentTime);
  const setCurrentTime = useEditorStore(s => s.setCurrentTime);
  const isPlaying = useEditorStore(s => s.isPlaying);
  const togglePlay = useEditorStore(s => s.togglePlay);
  const project = useEditorStore(s => s.project);
  const transitions = useEditorStore(s => s.transitions);

  const fps = project?.fps ?? 30;
  const projW = project?.width ?? 1920;
  const projH = project?.height ?? 1080;

  /* ─── 헬퍼: 클립/전환 찾기 (순수 함수, 스토어 직접 참조) ─── */
  function findActiveClipAt(time: number) {
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

  function findActiveTransitionAt(time: number) {
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

  function findAssetSrc(assetId: string): string {
    const state = useEditorStore.getState();
    const asset = state.project.assets?.find(a => a.id === assetId);
    return asset?.src || '';
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

  /* ─── drawWithAspect ─── */
  function drawWithAspect(
    source: CanvasImageSource,
    ctx: CanvasRenderingContext2D,
    cw: number, ch: number
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

  /* ─── 비디오 소스 로드 헬퍼 ─── */
  function loadVideoSrc(video: HTMLVideoElement, src: string, loadedRef: React.MutableRefObject<string>) {
    if (src && loadedRef.current !== src) {
      video.src = src;
      video.load();
      loadedRef.current = src;
    }
  }

  /* ─── 재생 루프 ─── */
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(playAnimRef.current);
      const videoA = videoARef.current;
      if (videoA) videoA.pause();
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
      const clip = findActiveClipAt(state.currentTime);
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

  /* ─── 메인 캔버스 렌더 루프 (모든 로직을 여기서 처리) ─── */
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

      // ── 매 프레임마다 활성 클립/전환 재계산 ──
      const trans = findActiveTransitionAt(time);
      const clip = findActiveClipAt(time);

      // ── 비디오 소스 동기화 ──
      if (trans) {
        // 전환 모드: A=clipA, B=clipB
        const srcA = findAssetSrc(trans.clipA.assetId);
        const srcB = findAssetSrc(trans.clipB.assetId);
        loadVideoSrc(videoA, srcA, loadedSrcA);
        loadVideoSrc(videoB, srcB, loadedSrcB);

        // seek (탐색 모드일 때)
        if (!state.isPlaying) {
          const localA = time - trans.clipA.startTime + (trans.clipA.inPoint || 0);
          if (Math.abs(videoA.currentTime - localA) > 0.05) videoA.currentTime = Math.max(0, localA);
          const localB = time - trans.clipB.startTime + (trans.clipB.inPoint || 0);
          if (Math.abs(videoB.currentTime - localB) > 0.05) videoB.currentTime = Math.max(0, localB);
        }
      } else if (clip) {
        // 일반 모드: A=현재 클립
        const srcA = findAssetSrc(clip.assetId);
        loadVideoSrc(videoA, srcA, loadedSrcA);

        if (!state.isPlaying) {
          const localA = time - clip.startTime + (clip.inPoint || 0);
          if (Math.abs(videoA.currentTime - localA) > 0.05) videoA.currentTime = Math.max(0, localA);
        }
      }

      // ── 렌더링 ──
      ctx.clearRect(0, 0, w, h);

      if (trans) {
        const readyA = isVideoReady(videoA);
        const readyB = isVideoReady(videoB);

        if (readyA && readyB) {
          // 전환 효과 적용
          const defId = `transition-${trans.transition.type}`;
          const def = effectRegistry.get(defId);

          if (def) {
            try {
              // 효과의 draw 함수 직접 호출
              const result = def.render({
                time,
                progress: trans.progress,
                params: { progress: trans.progress, duration: trans.transition.duration },
                canvas, ctx,
                inputA: videoA,
                inputB: videoB,
                width: w, height: h, fps,
              });
              if (result.type === 'canvas') {
                result.draw(ctx);
              }
            } catch (e) {
              console.warn('[PreviewArea] transition render error:', e);
              // 폴백 dissolve
              ctx.globalAlpha = 1 - trans.progress;
              drawWithAspect(videoA, ctx, w, h);
              ctx.globalAlpha = trans.progress;
              drawWithAspect(videoB, ctx, w, h);
              ctx.globalAlpha = 1;
            }
          } else {
            // 정의 없음 → 수동 dissolve
            ctx.globalAlpha = 1 - trans.progress;
            drawWithAspect(videoA, ctx, w, h);
            ctx.globalAlpha = trans.progress;
            drawWithAspect(videoB, ctx, w, h);
            ctx.globalAlpha = 1;
          }
        } else if (readyA) {
          drawWithAspect(videoA, ctx, w, h);
        } else if (readyB) {
          drawWithAspect(videoB, ctx, w, h);
        }
      } else if (isVideoReady(videoA)) {
        drawWithAspect(videoA, ctx, w, h);
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [fps]);  // ★ 최소 의존성: 모든 state는 getState()로 직접 참조

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
