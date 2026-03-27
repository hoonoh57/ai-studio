/* ─── src/engines/canvasRenderer.ts ─── */
/* Canvas 기반 통합 렌더러 — 검은 프레임 원천 차단 */

import type { EffectInstance, EffectRenderContext, EffectRenderResult } from '@/types/effect';
import { effectRegistry } from './effectRegistry';

/* ════════════════════════════════════════
   비디오 프레임 준비 상태 확인
   ════════════════════════════════════════ */
export function isVideoReady(video: HTMLVideoElement | null): boolean {
    if (!video) return false;
    // readyState >= 2 (HAVE_CURRENT_DATA) 이면 현재 프레임 존재
    return video.readyState >= 2;
}

/* ════════════════════════════════════════
   비디오 프리로드 (src 설정 + seek + 준비 대기)
   ════════════════════════════════════════ */
export function preloadVideo(
    video: HTMLVideoElement,
    src: string,
    seekTime: number,
): Promise<void> {
    return new Promise((resolve) => {
        if (video.src !== src && !video.src.endsWith(src)) {
            video.src = src;
            video.load();
        }
        video.currentTime = seekTime;

        if (isVideoReady(video)) {
            resolve();
            return;
        }

        const onReady = () => {
            video.removeEventListener('seeked', onReady);
            video.removeEventListener('canplay', onReady);
            resolve();
        };
        video.addEventListener('seeked', onReady, { once: true });
        video.addEventListener('canplay', onReady, { once: true });

        // 안전장치: 500ms 후 강제 resolve
        setTimeout(resolve, 500);
    });
}

/* ════════════════════════════════════════
   키프레임 보간 함수
   ════════════════════════════════════════ */
export function interpolateKeyframes(
    effect: EffectInstance,
    paramKey: string,
    time: number,
    defaultValue: number,
): number {
    const kfs = effect.keyframes
        .filter(k => k.paramKey === paramKey)
        .sort((a, b) => a.time - b.time);

    if (kfs.length === 0) return defaultValue;
    if (kfs.length === 1) return kfs[0].value;
    if (time <= kfs[0].time) return kfs[0].value;
    if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;

    for (let i = 0; i < kfs.length - 1; i++) {
        if (time >= kfs[i].time && time <= kfs[i + 1].time) {
            const t = (time - kfs[i].time) / (kfs[i + 1].time - kfs[i].time);
            const eased = applyEasing(t, kfs[i + 1].easing);
            return kfs[i].value + (kfs[i + 1].value - kfs[i].value) * eased;
        }
    }
    return defaultValue;
}

function applyEasing(t: number, easing: string): number {
    switch (easing) {
        case 'linear': return t;
        case 'ease-in': return t * t;
        case 'ease-out': return t * (2 - t);
        case 'ease-in-out': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        case 'ease-in-cubic': return t * t * t;
        case 'ease-out-cubic': return (--t) * t * t + 1;
        case 'ease-in-out-cubic':
            return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
        case 'ease-in-back': return 2.70158 * t * t * t - 1.70158 * t * t;
        case 'ease-out-back': {
            const c = 1.70158;
            return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
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
            const s = Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
            return Math.min(1, Math.max(0, s));
        }
        default: return t;
    }
}

/* ════════════════════════════════════════
   메인 렌더 함수 — 매 프레임 호출
   ════════════════════════════════════════ */
export interface RenderFrameParams {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    fps: number;
    currentTime: number;

    // 현재 활성 미디어 소스
    videoA: HTMLVideoElement | null;
    videoB: HTMLVideoElement | null;
    imageA: HTMLImageElement | null;

    // 활성 효과 인스턴스 목록 (order 순 정렬)
    activeEffects: EffectInstance[];

    // 전환 정보 (없으면 null)
    transition: {
        definitionId: string;
        progress: number;
    } | null;
}

export function renderFrame(params: RenderFrameParams): void {
    const { canvas, ctx, width, height, fps, currentTime,
        videoA, videoB, imageA, activeEffects, transition } = params;

    // 1. Canvas 크기 맞추기
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    // 2. 이전 프레임 유지를 위해 clearRect 대신 조건부 클리어
    //    → 비디오 프레임이 준비된 경우에만 새로 그림
    //    → 미준비 시 이전 프레임 유지 = 검은 프레임 방지
    const inputA: CanvasImageSource | null =
        videoA && isVideoReady(videoA) ? videoA :
            imageA ?? null;

    const inputB: CanvasImageSource | null =
        videoB && isVideoReady(videoB) ? videoB : null;

    // 소스가 하나도 없으면 이전 프레임 유지
    if (!inputA && !transition) return;

    // 3. Canvas 클리어
    ctx.clearRect(0, 0, width, height);

    // 4. 전환 모드
    if (transition && transition.progress >= 0) {
        const def = effectRegistry.get(transition.definitionId);
        if (def) {
            const renderCtx: EffectRenderContext = {
                time: 0,
                progress: transition.progress,
                params: {},
                canvas, ctx,
                inputA, inputB,
                width, height, fps,
            };
            const result = def.render(renderCtx);
            if (result.type === 'canvas') {
                result.draw(ctx);
            }
        } else {
            // fallback: dissolve
            ctx.globalAlpha = 1;
            if (inputA) try { ctx.drawImage(inputA, 0, 0, width, height); } catch { }
            if (inputB) {
                ctx.globalAlpha = transition.progress;
                try { ctx.drawImage(inputB, 0, 0, width, height); } catch { }
            }
            ctx.globalAlpha = 1;
        }
    } else {
        // 5. 단일 클립 모드 — 소스 그리기
        if (inputA) {
            try { ctx.drawImage(inputA, 0, 0, width, height); } catch { }
        }
    }

    // 6. 필터/모션 효과 순차 적용
    activeEffects.forEach(effect => {
        if (!effect.enabled) return;

        const def = effectRegistry.get(effect.definitionId);
        if (!def) return;

        // 효과 내 상대 시간 계산
        const relTime = currentTime - effect.startTime;
        const progress = effect.duration > 0 ? relTime / effect.duration : 0;

        // 키프레임 보간으로 파라미터 값 결정
        const resolvedParams: Record<string, unknown> = { ...effect.params };
        def.params.forEach(paramDef => {
            if (paramDef.animatable && effect.keyframes.length > 0) {
                const interpolated = interpolateKeyframes(
                    effect, paramDef.key, relTime, paramDef.defaultValue as number,
                );
                resolvedParams[paramDef.key] = interpolated;
            }
        });

        const renderCtx: EffectRenderContext = {
            time: relTime,
            progress: Math.max(0, Math.min(1, progress)),
            params: resolvedParams,
            canvas, ctx,
            inputA, inputB: null,
            width, height, fps,
        };

        const result = def.render(renderCtx);

        if (result.type === 'canvas') {
            // 현재 캔버스 내용을 임시 저장 후 효과 적용
            const imageData = ctx.getImageData(0, 0, width, height);
            ctx.clearRect(0, 0, width, height);
            ctx.putImageData(imageData, 0, 0);

            // 효과 블렌드 모드 적용
            if (effect.blendMode && effect.blendMode !== 'normal') {
                ctx.globalCompositeOperation = effect.blendMode as GlobalCompositeOperation;
            }
            if (effect.opacity !== undefined && effect.opacity < 1) {
                ctx.globalAlpha = effect.opacity;
            }

            result.draw(ctx);

            // 리셋
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
        }
    });
}

/* ════════════════════════════════════════
   편의 함수: 전환 DefinitionId 매핑
   (기존 Transition.type → EffectDefinition.id)
   ════════════════════════════════════════ */
export function transitionTypeToDefinitionId(type: string): string {
    return `transition.${type}`;
}

/* ════════════════════════════════════════
   편의 함수: requestVideoFrameCallback 래퍼
   ════════════════════════════════════════ */
export function onVideoFrame(
    video: HTMLVideoElement,
    callback: (now: DOMHighResTimeStamp, metadata: { mediaTime: number }) => void,
): number | null {
    if ('requestVideoFrameCallback' in video) {
        return (video as any).requestVideoFrameCallback(callback);
    }
    return null;
}
