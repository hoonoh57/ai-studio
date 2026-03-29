/* ─── src/engine/core/WebGPUContext.ts ─── */
/* WebGPU 디바이스 초기화 + GPU Tier 감지 */

export type RenderTier =
    | 'webgpu-dedicated'
    | 'webgpu-integrated'
    | 'webgl2'
    | 'canvas2d';

export interface RendererCapabilities {
    tier: RenderTier;
    maxTextureSize: number;
    maxEffects: number;
    gpuName: string;
    vramEstimate: number;
    hwEncoding: boolean;
    supportsExternalTexture: boolean;
}

export interface WebGPUContextResult {
    device: GPUDevice;
    adapter: GPUAdapter;
    capabilities: RendererCapabilities;
}

const DEDICATED_GPU_PATTERN =
    /nvidia|geforce|rtx|gtx|radeon|rx\s?\d|arc\s?a/i;

/**
 * WebGPU 디바이스를 초기화하고 GPU Tier를 감지한다.
 * 실패 시 null을 반환하며, 호출자가 WebGL/Canvas2D로 폴백한다.
 */
export async function initWebGPU(): Promise<WebGPUContextResult | null> {
    if (!navigator.gpu) return null;

    try {
        const adapter = await navigator.gpu.requestAdapter({
            powerPreference: 'high-performance',
        });
        if (!adapter) return null;

        const info = await adapter.requestAdapterInfo();
        const device = await adapter.requestDevice({
            requiredLimits: {
                maxTextureDimension2D: Math.min(
                    adapter.limits.maxTextureDimension2D,
                    8192,
                ),
                maxBindGroups: Math.min(adapter.limits.maxBindGroups, 4),
            },
        });

        device.lost.then((lostInfo) => {
            console.error('[WebGPU] Device lost:', lostInfo.message);
        });

        const desc = info.description || info.vendor || '';
        const isDedicated = DEDICATED_GPU_PATTERN.test(desc);

        const supportsExternalTexture = typeof device.importExternalTexture === 'function';

        const capabilities: RendererCapabilities = {
            tier: isDedicated ? 'webgpu-dedicated' : 'webgpu-integrated',
            maxTextureSize: device.limits.maxTextureDimension2D,
            maxEffects: isDedicated ? 30 : 5,
            gpuName: desc || 'Unknown GPU',
            vramEstimate: isDedicated ? 4096 : 1024,
            hwEncoding: isDedicated,
            supportsExternalTexture,
        };

        return { device, adapter, capabilities };
    } catch (e) {
        console.warn('[WebGPU] Init failed:', e);
        return null;
    }
}

/**
 * WebGPU를 사용할 수 없는 환경에서 Tier를 감지한다.
 */
export function detectFallbackTier(): RendererCapabilities {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2');

    if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = debugInfo
            ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
            : 'Unknown';
        return {
            tier: 'webgl2',
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxEffects: 5,
            gpuName: String(renderer),
            vramEstimate: 512,
            hwEncoding: false,
            supportsExternalTexture: false,
        };
    }

    return {
        tier: 'canvas2d',
        maxTextureSize: 4096,
        maxEffects: 0,
        gpuName: 'None (CPU)',
        vramEstimate: 0,
        hwEncoding: false,
        supportsExternalTexture: false,
    };
}
