import React, { useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { isVideoReady } from '@/engines/canvasRenderer';
import { effectRegistry } from '@/engines/effectRegistry';
import { audioEngine } from '@/engines/audioEngine';
import type { Clip, KeyframeTrack } from '@/types/project';
import type { TextContent, TextStyle, TextAnimation } from '@/types/textClip';

const CANVAS_BG = '#000000';
const PRELOAD_AHEAD = 0.5;
const DEBUG_KF = true; // ★ 디버그 플래그 — 검증 완료 후 false로 변경

/* ★ 이징 함수 */
function applyEasing(t: number, easing: string): number {
  const c = Math.max(0, Math.min(1, t));
  switch (easing) {
    case 'linear': return c;
    case 'ease-in': return c * c;
    case 'ease-out': return c * (2 - c);
    case 'ease-in-out': return c < 0.5 ? 2 * c * c : -1 + (4 - 2 * c) * c;
    case 'ease-in-cubic': return c * c * c;
    case 'ease-out-cubic': { const u = c - 1; return u * u * u + 1; }
    case 'ease-in-out-cubic':
      return c < 0.5 ? 4 * c * c * c : (c - 1) * (2 * c - 2) * (2 * c - 2) + 1;
    case 'ease-in-back': return 2.70158 * c * c * c - 1.70158 * c * c;
    case 'ease-out-back': {
      const k = 1.70158; return 1 + (k + 1) * Math.pow(c - 1, 3) + k * Math.pow(c - 1, 2);
    }
    case 'ease-out-bounce': {
      let b = c;
      if (b < 1 / 2.75) return 7.5625 * b * b;
      if (b < 2 / 2.75) return 7.5625 * (b -= 1.5 / 2.75) * b + 0.75;
      if (b < 2.5 / 2.75) return 7.5625 * (b -= 2.25 / 2.75) * b + 0.9375;
      return 7.5625 * (b -= 2.625 / 2.75) * b + 0.984375;
    }
    case 'ease-out-elastic': {
      if (c === 0 || c === 1) return c;
      return Math.pow(2, -10 * c) * Math.sin((c - 0.075) * (2 * Math.PI) / 0.3) + 1;
    }
    case 'spring': {
      return Math.min(1, Math.max(0, Math.pow(2, -10 * c) * Math.sin((c - 0.1) * 5 * Math.PI) + 1));
    }
    default: return c;
  }
}

/* ★ 키프레임 보간 — 클립 내 상대 시간 기준 */
function interpolateKfValue(
  kfTracks: KeyframeTrack[] | undefined,
  property: string,
  relativeTime: number,
  defaultValue: number,
): number {
  if (!kfTracks || kfTracks.length === 0) return defaultValue;
  const kt = kfTracks.find(t => t.property === property && t.enabled);
  if (!kt || kt.keyframes.length === 0) return defaultValue;

  const kfs = [...kt.keyframes].sort((a, b) => a.time - b.time);
  if (kfs.length === 1) return kfs[0].value;
  if (relativeTime <= kfs[0].time) return kfs[0].value;
  if (relativeTime >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;

  for (let i = 0; i < kfs.length - 1; i++) {
    if (relativeTime >= kfs[i].time && relativeTime <= kfs[i + 1].time) {
      const t0 = kfs[i].time, t1 = kfs[i + 1].time;
      const v0 = kfs[i].value, v1 = kfs[i + 1].value;
      const span = t1 - t0;
      if (span <= 0) return v0;
      const progress = (relativeTime - t0) / span;
      const eased = applyEasing(progress, kfs[i + 1].easing || 'linear');
      return v0 + (v1 - v0) * eased;
    }
  }
  return defaultValue;
}

/* ★ 키프레임 트랙에 특정 속성이 활성화+데이터 있는지 */
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

  // 디버그: 마지막 로그 시간
  const lastDebugLog = useRef<number>(0);

  const currentTime = useEditorStore(s => s.currentTime);
  const setCurrentTime = useEditorStore(s => s.setCurrentTime);
  const isPlaying = useEditorStore(s => s.isPlaying);
  const togglePlay = useEditorStore(s => s.togglePlay);

  /* ═══ B4-9: 텍스트 드래그 배치 ═══ */
  const textDragRef = useRef<{
    clipId: string;
    startMouseX: number;
    startMouseY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  const updateTextStyle = useEditorStore(s => s.updateTextStyle);
  const selectedClipId = useEditorStore(s => s.selectedClipId);
  const selectClip = useEditorStore(s => s.selectClip);
  const project = useEditorStore(s => s.project);

  const fps = project?.fps ?? 30;
  const projW = project?.width ?? 1920;
  const projH = project?.height ?? 1080;

  /* ─── B1-1: 오디오 엔진 초기화 ─── */
  useEffect(() => {
    audioEngine.init();
    return () => { /* dispose는 앱 종료 시에만 */ };
  }, []);

  /* ─── B1-1: 사용자 인터랙션 후 AudioContext resume ─── */
  const handleUserGesture = useCallback(() => {
    audioEngine.resume();
  }, []);

  /* ═══ B4-9: 프리뷰 텍스트 드래그 ═══ */
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // 캔버스 좌표를 % 좌표로 변환
    const pctX = (mx / rect.width) * 100;
    const pctY = (my / rect.height) * 100;

    // 현재 시간에 활성인 텍스트 클립 찾기
    const state = useEditorStore.getState();
    const time = state.currentTime;

    for (const track of state.project.tracks) {
      if (track.type !== 'text' || !track.visible || track.muted) continue;
      for (const tClip of track.clips) {
        if (tClip.disabled || !tClip.textContent) continue;
        if (time < tClip.startTime || time >= tClip.startTime + tClip.duration) continue;

        const st = tClip.textContent.style;
        // 히트 테스트: 클릭 위치가 텍스트 근처인지 (±15% 허용)
        const hitRange = 15;
        if (Math.abs(pctX - st.positionX) < hitRange && Math.abs(pctY - st.positionY) < hitRange) {
          textDragRef.current = {
            clipId: tClip.id,
            startMouseX: e.clientX,
            startMouseY: e.clientY,
            startPosX: st.positionX,
            startPosY: st.positionY,
          };
          selectClip(tClip.id);
          e.preventDefault();
          return;
        }
      }
    }
  }, [selectClip]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = textDragRef.current;
      const canvas = canvasRef.current;
      if (!d || !canvas) return;
      const rect = canvas.getBoundingClientRect();

      const dx = e.clientX - d.startMouseX;
      const dy = e.clientY - d.startMouseY;

      // 마우스 이동량을 % 좌표로 변환
      const dpctX = (dx / rect.width) * 100;
      const dpctY = (dy / rect.height) * 100;

      const newX = Math.max(0, Math.min(100, d.startPosX + dpctX));
      const newY = Math.max(0, Math.min(100, d.startPosY + dpctY));

      updateTextStyle(d.clipId, { positionX: Math.round(newX), positionY: Math.round(newY) });
    };

    const onUp = () => {
      textDragRef.current = null;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [updateTextStyle]);

  /* ─── B1-1: 에셋 오디오 버퍼 사전 로딩 ─── */
  const assets = useEditorStore(s => s.project.assets);
  useEffect(() => {
    for (const asset of assets) {
      // 오디오 포함 에셋만 버퍼 로드
      if (asset.hasAudio || asset.type === 'audio') {
        if (!audioEngine.getBuffer(asset.id)) {
          audioEngine.loadBuffer(asset.id, asset.src).catch(() => {
            console.warn(`[AudioEngine] 버퍼 로드 실패: ${asset.name}`);
          });
        }
      }
    }
  }, [assets]);

  /* ─── 헬퍼 함수들 ─── */
  function findClipAt(time: number): Clip | null {
    const state = useEditorStore.getState();
    for (const track of state.project.tracks) {
      if (!track.clips || track.type === 'audio' || track.type === 'text') continue; // 오디오/텍스트 트랙 제외
      for (const clip of track.clips) {
        if (clip.disabled) continue; // ★ B2-5
        if (time >= clip.startTime && time < clip.startTime + clip.duration) return clip;
      }
    }
    return null;
  }

  function findNextClip(currentClip: Clip): Clip | null {
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
      let clipA: Clip | null = null, clipB: Clip | null = null;
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
    video.playbackRate = Math.max(0.1, Math.min(16, speed));
    if (video.paused && video.src) {
      video.play().catch(() => { });
    }
  }

  /* ★ 키프레임 기반 transform + filter 적용 후 소스 그리기 */
  function drawClipWithKeyframes(
    source: CanvasImageSource,
    ctx: CanvasRenderingContext2D,
    cw: number, ch: number,
    clip: Clip,
    relTime: number,
  ) {
    const kf = clip.keyframeTracks;
    const hasAnyKf = kf && kf.length > 0 && kf.some(t => t.enabled && t.keyframes.length > 0);

    // 1) 키프레임에서 보간된 값 읽기
    const kfX = interpolateKfValue(kf, 'x', relTime, 0);
    const kfY = interpolateKfValue(kf, 'y', relTime, 0);
    const kfScale = interpolateKfValue(kf, 'scale', relTime, 1);
    const kfRotation = interpolateKfValue(kf, 'rotation', relTime, 0);
    const kfOpacity = interpolateKfValue(kf, 'opacity', relTime, clip.opacity ?? 1);
    const kfBlur = interpolateKfValue(kf, 'blur', relTime, 0);
    const kfBrightness = interpolateKfValue(kf, 'brightness', relTime, 0);
    const kfContrast = interpolateKfValue(kf, 'contrast', relTime, 0);

    // ★ 디버그 로그 (0.5초 간격)
    if (DEBUG_KF && hasAnyKf) {
      const now = performance.now();
      if (now - lastDebugLog.current > 500) {
        lastDebugLog.current = now;
        console.log('[KF DEBUG]', {
          clipId: clip.id,
          relTime: relTime.toFixed(3),
          tracks: kf?.map(t => `${t.property}(${t.enabled ? 'ON' : 'OFF'}): ${t.keyframes.length}kf`),
          values: { kfX, kfY, kfScale, kfRotation, kfOpacity, kfBlur, kfBrightness, kfContrast },
        });
      }
    }

    // 2) CSS filter 문자열 생성
    const filterParts: string[] = [];

    // clip.filters (이펙트 패널에서 추가한 필터)
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

    // 키프레임 기반 필터
    if (hasKfProperty(kf, 'blur') && kfBlur > 0) filterParts.push(`blur(${kfBlur}px)`);
    if (hasKfProperty(kf, 'brightness') && kfBrightness !== 0) filterParts.push(`brightness(${1 + kfBrightness / 100})`);
    if (hasKfProperty(kf, 'contrast') && kfContrast !== 0) filterParts.push(`contrast(${1 + kfContrast / 100})`);

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

    // opacity — 0~1 클램프
    ctx.globalAlpha = Math.max(0, Math.min(1, kfOpacity));

    // CSS filter
    if (filterParts.length > 0) {
      ctx.filter = filterParts.join(' ');
    } else {
      ctx.filter = 'none';
    }

    // ★ 핵심 수정: 피봇 기준 transform
    // 피봇 = 캔버스 중심 + 키프레임 오프셋
    const pivotX = cw / 2 + kfX;
    const pivotY = ch / 2 + kfY;

    ctx.translate(pivotX, pivotY);
    if (kfRotation !== 0) {
      ctx.rotate((kfRotation * Math.PI) / 180);
    }
    if (kfScale !== 1) {
      ctx.scale(kfScale, kfScale);
    }
    ctx.translate(-pivotX, -pivotY);

    // X, Y 오프셋 적용 (translate 이후 drawImage 좌표에 반영)
    ctx.drawImage(source, dx + kfX, dy + kfY, dw, dh);

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
      audioEngine.syncToTimeline(currentTime, false, project.tracks);
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
      audioEngine.syncToTimeline(
        newTime,
        true,
        useEditorStore.getState().project.tracks,
      );
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
        const relTime = time - clip.startTime; // ★ 클립 내 상대 시간 (키프레임 기준)

        // 비디오 B에 이미 같은 클립이 로드된 경우 (프리로드 스왑)
        if (loadedB.current.clipId === clip.id && loadedB.current.src === srcA) {
          const tempLoaded = { ...loadedA.current };
          loadedA.current = { ...loadedB.current };
          loadedB.current = tempLoaded;

          if (playing) ensurePlaying(videoB, clip.speed || 1);
          if (!playing && Math.abs(videoB.currentTime - localA) > 0.05) {
            videoB.currentTime = Math.max(0, localA);
          }

          if (isVideoReady(videoB)) {
            ctx.clearRect(0, 0, w, h);
            drawClipWithKeyframes(videoB, ctx, w, h, clip, relTime);
            didDraw = true;
          }

          ensureVideoLoaded(videoA, loadedA, srcA, clip.id, localA);
        } else {
          // 일반 경로: videoA에 로드
          ensureVideoLoaded(videoA, loadedA, srcA, clip.id, localA);

          if (playing) ensurePlaying(videoA, clip.speed || 1);

          // 다음 클립 프리로드
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

      // ══════ B4: 텍스트 오버레이 렌더링 ══════
      {
        const textTracks = state.project.tracks.filter(
          t => t.type === 'text' && t.visible && !t.muted
        );
        for (const textTrack of textTracks) {
          for (const tClip of textTrack.clips) {
            if (tClip.disabled) continue;
            if (!tClip.textContent) continue;
            if (time < tClip.startTime || time >= tClip.startTime + tClip.duration) continue;

            const tc = tClip.textContent;
            const st = tc.style;
            const relTime = time - tClip.startTime;
            const clipDur = tClip.duration;

            // ── 애니메이션 계산 ──
            const animDur = st.animationDuration || 0.3;
            let animProgress = 1; // 1 = 완전히 보임
            let animOpacity = 1;
            let animOffsetX = 0;
            let animOffsetY = 0;
            let animScale = 1;
            let animRotation = 0;
            let animBlur = 0;
            let typewriterLen = tc.text.length;

            const entryT = Math.min(1, relTime / animDur);
            const exitT = Math.min(1, (clipDur - relTime) / animDur);

            // B4: 애니메이션 유형별 속성 계산
            switch (st.animation) {
              case 'fade-in': animOpacity = entryT; break;
              case 'fade-out': animOpacity = exitT; break;
              case 'typewriter': typewriterLen = Math.floor(tc.text.length * entryT); break;
              case 'slide-up': animOffsetY = (1 - entryT) * 40; animOpacity = entryT; break;
              case 'slide-down': animOffsetY = -(1 - entryT) * 40; animOpacity = entryT; break;
              case 'slide-left': animOffsetX = (1 - entryT) * 60; animOpacity = entryT; break;
              case 'slide-right': animOffsetX = -(1 - entryT) * 60; animOpacity = entryT; break;
              case 'scale-in': animScale = 0.3 + 0.7 * entryT; animOpacity = entryT; break;
              case 'bounce-in': {
                const bt = entryT;
                animScale = bt < 0.5 ? 0.3 + 1.4 * bt : 1.0 + 0.15 * Math.sin((bt - 0.5) * Math.PI * 4) * (1 - bt);
                animOpacity = Math.min(1, bt * 2);
                break;
              }
              case 'blur-in': animBlur = (1 - entryT) * 10; animOpacity = entryT; break;
              case 'rotate-in': animRotation = (1 - entryT) * -15; animScale = 0.5 + 0.5 * entryT; animOpacity = entryT; break;
              case 'glitch-in': {
                const gt = entryT;
                if (gt < 1) {
                  animOffsetX = (Math.random() - 0.5) * 10 * (1 - gt);
                  animOffsetY = (Math.random() - 0.5) * 6 * (1 - gt);
                }
                animOpacity = gt < 0.3 ? (Math.random() > 0.5 ? 1 : 0.3) : 1;
                break;
              }
              default: break;
            }

            // ── B4-10: 텍스트 클립 키프레임 보간 ──
            const kf = tClip.keyframeTracks;
            const kfX = interpolateKfValue(kf, 'x', relTime, 0);
            const kfY = interpolateKfValue(kf, 'y', relTime, 0);
            const kfScale = interpolateKfValue(kf, 'scale', relTime, 1);
            const kfRotation = interpolateKfValue(kf, 'rotation', relTime, 0);
            const kfOpacity = interpolateKfValue(kf, 'opacity', relTime, 1);

            // ── Canvas 텍스트 렌더링 ──
            ctx.save();
            const combinedOpacity = Math.max(0, Math.min(1, animOpacity * kfOpacity));
            ctx.globalAlpha = combinedOpacity;
            if (animBlur > 0) ctx.filter = `blur(${animBlur}px)`;

            // ★ B4: 캔버스 크기(w, h)에 따른 폰트/라인/외곽선 스케일링 (1920 기준)
            const scale = Math.min(w / 1920, h / 1080);
            const scaledFontSize = Math.max(10, Math.round(st.fontSize * scale));
            const fontStr = `${st.fontStyle} ${st.fontWeight} ${scaledFontSize}px ${st.fontFamily}`;
            ctx.font = fontStr;
            ctx.textAlign = st.textAlign;
            ctx.textBaseline = 'top';

            const posX = (st.positionX / 100) * w + animOffsetX + kfX * scale;
            const posY = (st.positionY / 100) * h + animOffsetY + kfY * scale;

            const totalScale = animScale * kfScale;
            const totalRotation = animRotation + kfRotation;
            if (totalScale !== 1 || totalRotation !== 0) {
              ctx.translate(posX, posY);
              if (totalRotation !== 0) ctx.rotate((totalRotation * Math.PI) / 180);
              if (totalScale !== 1) ctx.scale(totalScale, totalScale);
              ctx.translate(-posX, -posY);
            }

            const displayText = st.animation === 'typewriter' ? tc.text.substring(0, typewriterLen) : tc.text;
            const lines = displayText.split('\n');
            const lineHeight = scaledFontSize * 1.3;
            const totalHeight = lines.length * lineHeight;

            let baseY = posY;
            if (st.verticalAlign === 'middle') baseY = posY - totalHeight / 2;
            else if (st.verticalAlign === 'bottom') baseY = posY - totalHeight;

            // ── B4-7: 워드별 하이라이트 ──
            if (tc.wordTimings && tc.wordTimings.length > 0 && lines.length === 1) {
              const hlColor = st.highlightColor || '#FFFF00';
              const hlScale = st.highlightScale || 1.2;
              let cursorX = posX;
              const fullWidth = ctx.measureText(displayText).width;
              if (st.textAlign === 'center') cursorX -= fullWidth / 2;
              else if (st.textAlign === 'right') cursorX -= fullWidth;

              for (const wt of tc.wordTimings) {
                const isActive = relTime >= wt.startTime && relTime < wt.endTime;
                const wordText = wt.word + ' ';
                const wordW = ctx.measureText(wordText).width;

                ctx.save();
                if (isActive) {
                  ctx.fillStyle = hlColor;
                  const sc = hlScale;
                  const cx = cursorX + wordW / 2;
                  const cy = baseY + lineHeight / 2;
                  ctx.translate(cx, cy);
                  ctx.scale(sc, sc);
                  ctx.translate(-cx, -cy);
                } else {
                  ctx.fillStyle = st.color;
                }
                ctx.shadowColor = st.shadowColor; ctx.shadowBlur = st.shadowBlur;
                ctx.shadowOffsetX = st.shadowOffsetX; ctx.shadowOffsetY = st.shadowOffsetY;
                if (st.strokeWidth > 0) {
                  ctx.strokeStyle = st.strokeColor;
                  ctx.lineWidth = st.strokeWidth * scale * (isActive ? hlScale : 1);
                  ctx.lineJoin = 'round'; ctx.strokeText(wordText, cursorX, baseY);
                }
                ctx.fillText(wordText, cursorX, baseY);
                ctx.restore();
                cursorX += wordW;
              }
            } else {
              // ── 일반 렌더링 (멀티라인) ──
              for (let li = 0; li < lines.length; li++) {
                const lineY = baseY + li * lineHeight;
                const lineText = lines[li];
                if (st.backgroundColor !== 'transparent') {
                  const metrics = ctx.measureText(lineText);
                  const boxPad = 6;
                  let boxX = posX - boxPad;
                  const boxW = metrics.width + boxPad * 2;
                  if (st.textAlign === 'center') boxX = posX - boxW / 2;
                  else if (st.textAlign === 'right') boxX = posX - boxW + boxPad;
                  ctx.fillStyle = st.backgroundColor;
                  ctx.fillRect(boxX, lineY - 2, boxW, lineHeight + 4);
                }
                ctx.shadowColor = st.shadowColor; ctx.shadowBlur = st.shadowBlur;
                ctx.shadowOffsetX = st.shadowOffsetX; ctx.shadowOffsetY = st.shadowOffsetY;
                if (st.strokeWidth > 0) {
                  ctx.strokeStyle = st.strokeColor; ctx.lineWidth = st.strokeWidth * scale;
                  ctx.lineJoin = 'round'; ctx.strokeText(lineText, posX, lineY);
                }
                ctx.fillStyle = st.color; ctx.fillText(lineText, posX, lineY);
                ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
              }
            }
            ctx.restore();
            didDraw = true;
          }
        }
      }

      // 프레임 보존
      if (didDraw) {
        try { lastFrameData.current = ctx.getImageData(0, 0, w, h); } catch { /* noop */ }
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
        <canvas
        ref={canvasRef}
        style={{ display: 'block', background: CANVAS_BG, cursor: textDragRef.current ? 'grabbing' : 'default' }}
        onMouseDown={handleCanvasMouseDown}
      />
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
        <button onClick={() => { handleUserGesture(); handleTogglePlay(); }} style={{ ...btnStyle, fontSize: 20 }}>
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
