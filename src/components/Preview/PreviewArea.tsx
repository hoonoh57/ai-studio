import React, { useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { isVideoReady } from '@/engines/canvasRenderer';
import { effectRegistry } from '@/engines/effectRegistry';

const CANVAS_BG = '#000000';
const PRELOAD_AHEAD = 0.5;

export function PreviewArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playAnimRef = useRef<number>(0);

  const loadedA = useRef<{ src: string; clipId: string }>({ src: '', clipId: '' });
  const loadedB = useRef<{ src: string; clipId: string }>({ src: '', clipId: '' });
  const lastFrameData = useRef<ImageData | null>(null);

  // 현재 어떤 비디오가 "주 재생" 역할인지 추적
  const activeVideoRef = useRef<'A' | 'B'>('A');

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
        if (time >= clip.startTime && time < clip.startTime + clip.duration) return clip;
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
      if (idx >= 0 && idx < sorted.length - 1) return sorted[idx + 1];
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

  function ensureVideoLoaded(
    video: HTMLVideoElement,
    ref: React.MutableRefObject<{ src: string; clipId: string }>,
    src: string, clipId: string, seekTime?: number,
  ) {
    if (ref.current.clipId === clipId && ref.current.src === src) {
      if (seekTime !== undefined && !useEditorStore.getState().isPlaying) {
        if (Math.abs(video.currentTime - seekTime) > 0.05) {
          video.currentTime = Math.max(0, seekTime);
        }
      }
      return false; // ★ 소스 변경 없음
    }
    video.src = src;
    video.load();
    ref.current = { src, clipId };
    if (seekTime !== undefined) {
      video.addEventListener('loadeddata', () => {
        video.currentTime = Math.max(0, seekTime);
      }, { once: true });
    }
    return true; // ★ 소스 변경됨
  }

  /* ★ 비디오 재생 보장 — paused 상태면 play() 호출 */
  function ensurePlaying(video: HTMLVideoElement, speed: number) {
    video.muted = true;
    video.playbackRate = speed;
    if (video.paused && video.src) {
      video.play().catch(() => { });
    }
  }

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

    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      const state = useEditorStore.getState();
      const clip = findClipAt(state.currentTime);
      const speed = clip?.speed || 1;
      const newTime = state.currentTime + dt * speed;

      // ★ 실제 마지막 클립 끝 시간 계산 (project.duration이 아닌 미디어 끝)
      let mediaEnd = 0;
      for (const track of state.project.tracks) {
        for (const c of track.clips) {
          mediaEnd = Math.max(mediaEnd, c.startTime + c.duration);
        }
      }
      // 미디어가 없으면 project.duration 사용
      if (mediaEnd <= 0) mediaEnd = state.project?.duration || 60;

      if (newTime >= mediaEnd) {
        setCurrentTime(mediaEnd);
        useEditorStore.setState({ isPlaying: false });
        // 비디오 요소도 정지
        videoARef.current?.pause();
        videoBRef.current?.pause();
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
      const playing = state.isPlaying;
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

        // ★ 전환 중에는 양쪽 다 재생
        if (playing) {
          ensurePlaying(videoA, trans.clipA.speed || 1);
          ensurePlaying(videoB, trans.clipB.speed || 1);
        }

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

        // ══════ 일반 재생 ══════
      } else if (clip) {
        const srcA = getAssetSrc(clip.assetId);
        const localA = time - clip.startTime + (clip.inPoint || 0);

        // ★ 핵심: videoB에 이미 이 클립이 사전 로드되어 있으면 스왑
        if (loadedB.current.clipId === clip.id && loadedB.current.src === srcA) {
          // videoB가 이미 이 클립 → A와 B의 역할 교체
          const tempLoaded = { ...loadedA.current };
          loadedA.current = { ...loadedB.current };
          loadedB.current = tempLoaded;

          // video 요소의 src도 스왑 (실제로는 ref만 교체하면 안 되므로, 논리적 주 비디오를 추적)
          // → 대신 videoB를 주 렌더링 소스로 사용
          if (playing) ensurePlaying(videoB, clip.speed || 1);

          if (!playing) {
            if (Math.abs(videoB.currentTime - localA) > 0.05) {
              videoB.currentTime = Math.max(0, localA);
            }
          }

          if (isVideoReady(videoB)) {
            ctx.clearRect(0, 0, w, h);
            drawWithAspect(videoB, ctx, w, h);
            didDraw = true;
          }

          // videoA에 이 클립을 로드 (백그라운드, 다음 프레임부터 A가 주 역할)
          ensureVideoLoaded(videoA, loadedA, srcA, clip.id, localA);
        } else {
          // 일반: videoA에 현재 클립
          const srcChanged = ensureVideoLoaded(videoA, loadedA, srcA, clip.id, localA);

          // ★ src 변경 후 재생 보장
          if (playing) ensurePlaying(videoA, clip.speed || 1);

          // 다음 클립 사전 로드
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
            ctx.clearRect(0, 0, w, h);
            drawWithAspect(videoB, ctx, w, h);
            didDraw = true;
          }
        }
      }

      // 프레임 보존
      if (didDraw) {
        try { lastFrameData.current = ctx.getImageData(0, 0, w, h); } catch { }
      } else if (lastFrameData.current) {
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
