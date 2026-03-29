/* ─── src/components/Preview/usePreviewEngine.ts ─── */
/* Preview 엔진 초기화/관리 React 훅 */

import { useEffect, useRef, useState } from 'react';
import { createPreviewRenderer, type PreviewRenderer } from '@/engine/core/RendererFactory';
import { WebGPUCompositor } from '@/engine/render/WebGPUCompositor';
import { OverlayRenderer, type SafeZoneConfig, type GuideConfig, type TransformState } from '@/engine/render/OverlayRenderer';

export interface PreviewEngineState {
    renderer: PreviewRenderer | null;
    compositor: WebGPUCompositor | null;
    overlay: OverlayRenderer | null;
    isWebGPU: boolean;
    tierLabel: string;
    gpuName: string;
}

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
    });

    const initRef = useRef(false);

    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        let destroyed = false;

        (async () => {
            const renderer = await createPreviewRenderer();
            if (destroyed) {
                renderer.destroy();
                return;
            }

            let compositor: WebGPUCompositor | null = null;

            if (renderer.type === 'webgpu' && renderer.gpu && gpuCanvasRef.current) {
                try {
                    compositor = new WebGPUCompositor({
                        canvas: gpuCanvasRef.current,
                        gpu: renderer.gpu,
                    });
                } catch (e) {
                    console.warn('[PreviewEngine] WebGPU Compositor 생성 실패, Canvas2D 폴백:', e);
                }
            }

            let overlay: OverlayRenderer | null = null;
            if (overlayCanvasRef.current) {
                overlay = new OverlayRenderer(overlayCanvasRef.current);
            }

            const tierLabels: Record<string, string> = {
                'webgpu-dedicated': 'GPU 가속 (최고)',
                'webgpu-integrated': 'GPU 가속 (표준)',
                'webgl2': 'WebGL (제한)',
                'canvas2d': 'CPU (기본)',
            };

            setState({
                renderer,
                compositor,
                overlay,
                isWebGPU: compositor !== null,
                tierLabel: tierLabels[renderer.capabilities.tier] || '알 수 없음',
                gpuName: renderer.capabilities.gpuName,
            });
        })();

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
