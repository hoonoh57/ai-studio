/* ─── src/components/Preview/usePreviewEngine.ts ─── */
/* Preview 엔진 초기화/관리 React 훅 — v2 (초기화 실패 보강) */

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

        const init = async () => {
            try {
                const renderer = await createPreviewRenderer();
                if (destroyed) { renderer.destroy(); return; }

                let compositor: WebGPUCompositor | null = null;

                if (renderer.type === 'webgpu' && renderer.gpu && gpuCanvasRef.current) {
                    try {
                        compositor = new WebGPUCompositor({
                            canvas: gpuCanvasRef.current,
                            gpu: renderer.gpu,
                        });
                        console.log('[PreviewEngine] WebGPU Compositor 생성 성공');
                    } catch (e) {
                        console.warn('[PreviewEngine] WebGPU Compositor 생성 실패, Canvas2D 폴백:', e);
                        compositor = null;
                    }
                }

                let overlay: OverlayRenderer | null = null;
                if (overlayCanvasRef.current) {
                    try {
                        overlay = new OverlayRenderer(overlayCanvasRef.current);
                    } catch (e) {
                        console.warn('[PreviewEngine] OverlayRenderer 생성 실패:', e);
                    }
                }

                const tierLabel = TIER_LABELS[renderer.capabilities.tier] || 'CPU 렌더링';
                const gpuName = renderer.capabilities.gpuName || 'Unknown';

                console.log(`[PreviewEngine] 초기화 완료 — ${tierLabel} (${gpuName})`);

                if (!destroyed) {
                    setState({
                        renderer,
                        compositor,
                        overlay,
                        isWebGPU: compositor !== null,
                        tierLabel,
                        gpuName,
                        ready: true,
                    });
                }
            } catch (e) {
                console.error('[PreviewEngine] 초기화 전체 실패:', e);
                if (!destroyed) {
                    setState({
                        renderer: null,
                        compositor: null,
                        overlay: null,
                        isWebGPU: false,
                        tierLabel: 'CPU 렌더링',
                        gpuName: 'None',
                        ready: true,
                    });
                }
            }
        };

        init();

        return () => {
            destroyed = true;
            setState((prev) => {
                prev.compositor?.destroy();
                prev.overlay?.destroy();
                prev.renderer?.destroy();
                return prev;
            });
        };
    }, [gpuCanvasRef, overlayCanvasRef]);

    return state;
}
