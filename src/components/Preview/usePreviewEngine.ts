/* ─── src/components/Preview/usePreviewEngine.ts ─── */
/* Preview 엔진 초기화/관리 React 훅 — v3 (overlay 즉시 생성) */

import { useEffect, useRef, useState } from 'react';
import { createPreviewRenderer, type PreviewRenderer } from '@/engine/core/RendererFactory';
import { WebGPUCompositor } from '@/engine/render/WebGPUCompositor';
import { OverlayRenderer } from '@/engine/render/OverlayRenderer';

export interface PreviewEngineState {
    renderer: PreviewRenderer | null;
    compositor: WebGPUCompositor | null;
    overlay: OverlayRenderer | null;
    isWebGPU: boolean;
    tierLabel: string;
    gpuName: string;
    ready: boolean;
}

const TIER_LABELS: Record<string, string> = {
    'webgpu-dedicated': 'GPU 가속 (외장)',
    'webgpu-integrated': 'GPU 가속 (내장)',
    'webgl2': 'WebGL2 (제한)',
    'canvas2d': 'CPU 렌더링',
};

export function usePreviewEngine(
    gpuCanvasRef: React.RefObject<HTMLCanvasElement | null>,
    overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>,
) {
    const [state, setState] = useState<PreviewEngineState>({
        renderer: null,
        compositor: null,
        overlay: null,
        isWebGPU: false,
        tierLabel: '초기화 중...',
        gpuName: '',
        ready: false,
    });

    const initRef = useRef(false);

    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        let destroyed = false;

        /* ── 1단계: OverlayRenderer 즉시 생성 (GPU 무관) ── */
        let overlay: OverlayRenderer | null = null;
        if (overlayCanvasRef.current) {
            try {
                overlay = new OverlayRenderer(overlayCanvasRef.current);
                console.log('[PreviewEngine] OverlayRenderer 즉시 생성 완료');
            } catch (e) {
                console.warn('[PreviewEngine] OverlayRenderer 생성 실패:', e);
            }
        }

        /* overlay가 있으면 바로 상태 업데이트 (안전구역/그리드 즉시 사용 가능) */
        if (overlay && !destroyed) {
            setState(prev => ({ ...prev, overlay }));
        }

        /* ── 2단계: GPU 렌더러 비동기 초기화 (타임아웃 포함) ── */
        const initGPU = async () => {
            try {
                const timeoutPromise = new Promise<null>((resolve) =>
                    setTimeout(() => resolve(null), 5000)
                );
                const rendererPromise = createPreviewRenderer();
                const renderer = await Promise.race([rendererPromise, timeoutPromise]);

                if (destroyed) {
                    if (renderer) renderer.destroy();
                    return;
                }

                if (!renderer) {
                    console.warn('[PreviewEngine] GPU 초기화 타임아웃 (5초), Canvas2D 폴백');
                    setState(prev => ({
                        ...prev,
                        tierLabel: 'CPU 렌더링',
                        gpuName: 'Timeout',
                        ready: true,
                    }));
                    return;
                }

                let compositor: WebGPUCompositor | null = null;
                if (renderer.type === 'webgpu' && renderer.gpu && gpuCanvasRef.current) {
                    try {
                        compositor = new WebGPUCompositor({
                            canvas: gpuCanvasRef.current,
                            gpu: renderer.gpu,
                        });
                        console.log('[PreviewEngine] WebGPU Compositor 생성 성공');
                    } catch (e) {
                        console.warn('[PreviewEngine] Compositor 실패, Canvas2D 폴백:', e);
                        compositor = null;
                    }
                }

                const tierLabel = TIER_LABELS[renderer.capabilities.tier] || 'CPU 렌더링';
                const gpuName = renderer.capabilities.gpuName || 'Unknown';
                console.log(`[PreviewEngine] 초기화 완료 — ${tierLabel} (${gpuName})`);

                if (!destroyed) {
                    setState(prev => ({
                        ...prev,
                        renderer,
                        compositor,
                        isWebGPU: compositor !== null,
                        tierLabel,
                        gpuName,
                        ready: true,
                    }));
                }
            } catch (e) {
                console.error('[PreviewEngine] 초기화 실패:', e);
                if (!destroyed) {
                    setState(prev => ({
                        ...prev,
                        tierLabel: 'CPU 렌더링',
                        gpuName: 'Error',
                        ready: true,
                    }));
                }
            }
        };

        initGPU();

        return () => {
            destroyed = true;
            setState(prev => {
                prev.compositor?.destroy();
                prev.overlay?.destroy();
                prev.renderer?.destroy();
                return prev;
            });
        };
    }, [gpuCanvasRef, overlayCanvasRef]);

    return state;
}
