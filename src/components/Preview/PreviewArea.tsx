import React, { useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { isVideoReady } from '@/engines/canvasRenderer';
import { effectRegistry } from '@/engines/effectRegistry';
import type { Clip, KeyframeTrack } from '@/types/project';

const CANVAS_BG = '#000000';
const PRELOAD_AHEAD = 0.5;

/* ★ 이징 함수 (canvasRenderer.ts와 동일) */
function applyEasing(t: number, easing: string): number {
  switch (easing) {
    case 'linear': return t;
    case 'ease-in': return t * t;
    case 'ease-out': return t * (2 - t);
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 'ease-in-cubic': return t * t * t;
    case 'ease-out-cubic': { const u = t - 1; return u * u * u + 1; }
    case 'ease-in-out-cubic':
      return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    case 'ease-in-back': return 2.70158 * t * t * t - 1.70158 * t * t;
    case 'ease-out-back': {
      const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    }
    case 'ease-out-bounce': {
      if (t < 1 / 2.75) return 7.5625 * t * t;
      if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
      if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
    case 'ease-out-elastic': {
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
    }
    case 'spring': {
      return Math.min(1, Math.max(0, Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1));
    }
    default: return t;
  }
}

/* ★ 키프레임 보간 — 클립 내 상대 시간 기준 */
function interpolateKfValue(
  kfTracks: KeyframeTrack[] | undefined,
  property: string,
  relativeTime: number,
  defaultValue: number,
): number {
  if (!kfTracks) return defaultValue;
  const kt = kfTracks.find(t => t.property === property && t.enabled);
  if (!kt || kt.keyframes.length === 0) return defaultValue;

  const kfs = kt.keyframes;
  if (relativeTime <= kfs[0].time) return kfs[0].value;
  if (relativeTime >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;

  for (let i = 0; i < kfs.length - 1; i++) {
    if (relativeTime >= kfs[i].time && relativeTime <= kfs[i + 1].time) {
      const t0 = kfs[i].time, t1 = kfs[i + 1].time;
      const v0 = kfs[i].value, v1 = kfs[i + 1].value;
      const progress = (t1 - t0) > 0 ? (relativeTime - t0) / (t1 - t0) : 0;
      const eased = applyEasing(progress, kfs[i + 1].easing || 'linear');
      return v0 + (v1 - v0) * eased;
    }
  }
  return defaultValue;
}

/* ★ 키프레임 트랙에 특정 속성이 활성화되어 있는지 확인 */
function hasKfProperty(kfTracks: KeyframeTrack[] | undefined, property: string): boolean {
  if (!kfTracks) return false;
  return kfTracks.some(t => t.property === property && t.enabled && t.keyframes.length > 0);
}

export function PreviewArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playAnimRef = useRef<number>(0);

  const loadedA = useRef<{ src: string; clipId: string }>({ src: '', clipId: '' });
  const loadedB = useRef<{ src: string; clipId: string }>({ src: '', clipId: '' });
  const lastFrameData = useRef<ImageData | null>(null);

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
      return false;
    }
    video.src = src;
    video.load();
    ref.current = { src, clipId };
    if (seekTime !== undefined) {
      video.addEventListener('loadeddata', () => {
        video.currentTime = Math.max(0, seekTime);
      }, { once: true });
    }
    return true;
  }

  function ensurePlaying(video: HTMLVideoElement, speed: number) {
    video.muted = true;
    video.playbackRate = speed;
    if (video.paused && video.src) {
      video.play().catch(() => { });
    }
  }

  /* ★ 키프레임 기반 transform + filter 적용 후 비디오 그리기 */
  function drawClipWithKeyframes(
    source: CanvasImageSource,
    ctx: CanvasRenderingContext2D,
    cw: number, ch: number,
    clip: Clip,
    relTime: number,
  ) {
    const kf = clip.keyframeTracks;

    // 1) 키프레임에서 보간된 값 읽기
    const kfX = interpolateKfValue(kf, 'x', relTime, clip.transform?.x ?? 0);
    const kfY = interpolateKfValue(kf, 'y', relTime, clip.transform?.y ?? 0);
    const kfScale = interpolateKfValue(kf, 'scale', relTime, clip.transform?.scale ?? 1);
    const kfRotation = interpolateKfValue(kf, 'rotation', relTime, clip.transform?.rotation ?? 0);
    const kfOpacity = interpolateKfValue(kf, 'opacity', relTime, clip.opacity ?? 1);
    const kfBlur = interpolateKfValue(kf, 'blur', relTime, 0);
    const kfBrightness = interpolateKfValue(kf, 'brightness', relTime, 0);
    const kfContrast = interpolateKfValue(kf, 'contrast', relTime, 0);

    // 2) CSS filter 문자열 생성 (clip.filters + 키프레임 기반 필터)
    const filterParts: string[] = [];

    // clip.filters (이펙트 패널에서 추가한 필터) 적용
    if (clip.filters && clip.filters.length > 0) {
      for (const f of clip.filters) {
        const p = f.params || {};
        switch (f.name) {
          case 'Brightness': filterParts.push(`brightness(${1 + (Number(p.brightness) || 0) / 100})`); break;
          case 'Contrast': filterParts.push(`contrast(${1 + (Number(p.contrast) || 0) / 100})`); break;
          case 'Saturation': filterParts.push(`saturate(${1 + (Number(p.saturation) || 0) / 100})`); break;
          case 'Blur': filterParts.push(`blur(${Math.max(0, Number(p.radius) || 0)}px)`); break;
          case 'Grayscale': filterParts.push(`grayscale(${(Number(p.intensity) || 0) / 100})`); break;
          case 'Sepia': filterParts.push(`sepia(${(Number(p.intensity) || 0) / 100})`); break;
          case 'Hue Shift': filterParts.push(`hue-rotate(${Number(p.degrees) || 0}deg)`); break;
          case 'Invert': filterParts.push(`invert(${(Number(p.intensity) || 100) / 100})`); break;
          case 'Opacity': filterParts.push(`opacity(${(Number(p.opacity) ?? 100) / 100})`); break;
        }
      }
    }

    // 키프레임 기반 필터 (이펙트 패널과 별개)
    if (hasKfProperty(kf, 'blur') && kfBlur > 0) {
      filterParts.push(`blur(${kfBlur}px)`);
    }
    if (hasKfProperty(kf, 'brightness') && kfBrightness !== 0) {
      filterParts.push(`brightness(${1 + kfBrightness / 100})`);
    }
    if (hasKfProperty(kf, 'contrast') && kfContrast !== 0) {
      filterParts.push(`contrast(${1 + kfContrast / 100})`);
    }

    // 3) 소스 원본 크기 → aspect-fit 계산
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
    let dw: number, dh: number, dx: number, dy: number;
    if (srcAspect > dstAspect) {
      dw = cw; dh = cw / srcAspect; dx = 0; dy = (ch - dh) / 2;
    } else {
      dh = ch; dw = ch * srcAspect; dx = (cw - dw) / 2; dy = 0;
    }

    // 4) canvas 상태 저장 → transform + filter 적용 → 그리기 → 복원
    ctx.save();

    // opacity
    ctx.globalAlpha = Math.max(0, Math.min(1, kfOpacity));

    // CSS filter
    if (filterParts.length > 0) {
      ctx.filter = filterParts.join(' ');
    }

    // transform: 중심점 기준 이동/회전/스케일
    const cx = cw / 2 + kfX;
    const cy = ch / 2 + kfY;
    ctx.translate(cx, cy);
    if (kfRotation !== 0) {
      ctx.rotate((kfRotation * Math.PI) / 180);
    }
    if (kfScale !== 1) {
      ctx.scale(kfScale, kfScale);
    }
    ctx.translate(-cw / 2, -ch / 2);

    ctx.drawImage(source, dx, dy, dw, dh);

    ctx.restore();
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

      let mediaEnd = 0;
      for (const track of state.project.tracks) {
        for (const c of track.clips) {
          mediaEnd = Math.max(mediaEnd, c.startTime + c.duration);
        }
      }
      if (mediaEnd <= 0) mediaEnd = state.project?.duration || 60;

      if (newTime >= mediaEnd) {
        setCurrentTime(mediaEnd);
        useEditorStore.setState({ isPlaying: false });
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
              ctx.drawImage(videoA, 0, 0, w, h);
              ctx.globalAlpha = trans.progress;
              ctx.drawImage(videoB, 0, 0, w, h);
              ctx.globalAlpha = 1;
              didDraw = true;
            }
          } else {
            ctx.globalAlpha = 1 - trans.progress;
            ctx.drawImage(videoA, 0, 0, w, h);
            ctx.globalAlpha = trans.progress;
            ctx.drawImage(videoB, 0, 0, w, h);
            ctx.globalAlpha = 1;
            didDraw = true;
          }
        } else if (readyA) {
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(videoA, 0, 0, w, h);
          didDraw = true;
        } else if (readyB) {
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(videoB, 0, 0, w, h);
          didDraw = true;
        }

        // ══════ 일반 재생 — ★ 키프레임 보간 적용 ══════
      } else if (clip) {
        const srcA = getAssetSrc(clip.assetId);
        const localA = time - clip.startTime + (clip.inPoint || 0);
        const relTime = time - clip.startTime; // ★ 클립 내 상대 시간

        if (loadedB.current.clipId === clip.id && loadedB.current.src === srcA) {
          const tempLoaded = { ...loadedA.current };
          loadedA.current = { ...loadedB.current };
          loadedB.current = tempLoaded;

          if (playing) ensurePlaying(videoB, clip.speed || 1);
          if (!playing) {
            if (Math.abs(videoB.currentTime - localA) > 0.05) {
              videoB.currentTime = Math.max(0, localA);
            }
          }

          if (isVideoReady(videoB)) {
            ctx.clearRect(0, 0, w, h);
            drawClipWithKeyframes(videoB, ctx, w, h, clip, relTime);
            didDraw = true;
          }

          ensureVideoLoaded(videoA, loadedA, srcA, clip.id, localA);
        } else {
          ensureVideoLoaded(videoA, loadedA, srcA, clip.id, localA);

          if (playing) ensurePlaying(videoA, clip.speed || 1);

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
            drawClipWithKeyframes(videoA, ctx, w, h, clip, relTime);
            didDraw = true;
          } else if (isVideoReady(videoB) && loadedB.current.clipId === clip.id) {
            ctx.clearRect(0, 0, w, h);
            drawClipWithKeyframes(videoB, ctx, w, h, clip, relTime);
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