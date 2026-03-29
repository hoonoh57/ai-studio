/* ─── src/engine/core/RendererFactory.ts ─── */
/* 렌더러 팩토리 — WebGPU → WebGL2 → Canvas2D 점진적 폴백 */

import {
    initWebGPU,
    detectFallbackTier,
    type RendererCapabilities,
    type WebGPUContextResult,
} from './WebGPUContext';

export interface PreviewRenderer {
    type: 'webgpu' | 'canvas2d';
    capabilities: RendererCapabilities;
    gpu: WebGPUContextResult | null;
    destroy: () => void;
}

/**
 * 최적의 렌더러를 생성한다.
 * WebGPU 초기화 실패 시 Canvas2D로 폴백한다.
 */
export async function createPreviewRenderer(): Promise<PreviewRenderer> {
    /* 1순위: WebGPU */
    const gpu = await initWebGPU();
    if (gpu) {
        console.log(
            `[Renderer] WebGPU 초기화 성공 — ${gpu.capabilities.gpuName} (${gpu.capabilities.tier})`,
        );
        return {
            type: 'webgpu',
            capabilities: gpu.capabilities,
            gpu,
            destroy: () => gpu.device.destroy(),
        };
    }

    /* 2순위: Canvas2D (WebGL2 Tier 감지는 하되, 렌더링은 Canvas2D) */
    const fallback = detectFallbackTier();
    console.log(
        `[Renderer] WebGPU 불가 — ${fallback.tier} 폴백 (${fallback.gpuName})`,
    );
    return {
        type: 'canvas2d',
        capabilities: fallback,
        gpu: null,
        destroy: () => { /* noop */ },
    };
}
