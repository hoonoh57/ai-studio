/* ─── src/engine/render/WebGPUCompositor.ts ─── */
/* WebGPU 비디오 프레임 합성 엔진 — zero-copy importExternalTexture */

import type { WebGPUContextResult } from '../core/WebGPUContext';

/* ═══ 타입 ═══ */

export interface CompositorConfig {
    canvas: HTMLCanvasElement;
    gpu: WebGPUContextResult;
}

export interface RenderInput {
    videoElement: HTMLVideoElement | null;
    opacity: number;
    transform: { x: number; y: number; scale: number; rotation: number };
    flipH: boolean;
    flipV: boolean;
}

/* ═══ 셰이더 인라인 (빌드 호환) ═══ */

const COMPOSITE_WGSL = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) texCoord: vec2f,
};

@group(0) @binding(0) var videoSampler: sampler;
@group(0) @binding(1) var videoTexture: texture_external;

@vertex
fn vertexMain(@builtin(vertex_index) vi: u32) -> VertexOutput {
  var pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f( 3.0, -1.0),
    vec2f(-1.0,  3.0),
  );
  var uv = array<vec2f, 3>(
    vec2f(0.0, 1.0),
    vec2f(2.0, 1.0),
    vec2f(0.0, -1.0),
  );
  var o: VertexOutput;
  o.position = vec4f(pos[vi], 0.0, 1.0);
  o.texCoord = uv[vi];
  return o;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return textureSampleBaseClampToEdge(videoTexture, videoSampler, input.texCoord);
}
`;

/* ═══ Compositor 클래스 ═══ */

export class WebGPUCompositor {
    private device: GPUDevice;
    private context: GPUCanvasContext;
    private pipeline: GPURenderPipeline | null = null;
    private sampler: GPUSampler;
    private format: GPUTextureFormat;
    private ready = false;

    constructor(config: CompositorConfig) {
        this.device = config.gpu.device;

        const ctx = config.canvas.getContext('webgpu');
        if (!ctx) throw new Error('WebGPU canvas context 생성 실패');
        this.context = ctx;

        this.format = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: 'premultiplied',
        });

        this.sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });

        this.initPipeline();
    }

    private initPipeline(): void {
        const module = this.device.createShaderModule({
            label: 'composite-shader',
            code: COMPOSITE_WGSL,
        });

        this.pipeline = this.device.createRenderPipeline({
            label: 'composite-pipeline',
            layout: 'auto',
            vertex: {
                module,
                entryPoint: 'vertexMain',
            },
            fragment: {
                module,
                entryPoint: 'fragmentMain',
                targets: [{ format: this.format }],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });

        this.ready = true;
    }

    /**
     * 프레임 렌더링 — 비디오 요소를 GPU에 zero-copy로 전달하여 화면에 표시
     */
    renderFrame(video: HTMLVideoElement): boolean {
        if (!this.ready || !this.pipeline) return false;
        if (!video || video.readyState < 2) return false;

        try {
            const externalTexture = this.device.importExternalTexture({
                source: video,
            });

            const bindGroup = this.device.createBindGroup({
                layout: this.pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: this.sampler },
                    { binding: 1, resource: externalTexture },
                ],
            });

            const commandEncoder = this.device.createCommandEncoder({
                label: 'composite-frame',
            });

            const textureView = this.context.getCurrentTexture().createView();

            const renderPass = commandEncoder.beginRenderPass({
                colorAttachments: [
                    {
                        view: textureView,
                        clearValue: { r: 0, g: 0, b: 0, a: 1 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            });

            renderPass.setPipeline(this.pipeline);
            renderPass.setBindGroup(0, bindGroup);
            renderPass.draw(3); /* 풀스크린 쿼드 (삼각형 1개) */
            renderPass.end();

            this.device.queue.submit([commandEncoder.finish()]);
            return true;
        } catch (e) {
            console.warn('[Compositor] 렌더 실패:', e);
            return false;
        }
    }

    /**
     * 검은 화면 클리어
     */
    clear(): void {
        if (!this.ready) return;
        try {
            const commandEncoder = this.device.createCommandEncoder();
            const textureView = this.context.getCurrentTexture().createView();
            const renderPass = commandEncoder.beginRenderPass({
                colorAttachments: [
                    {
                        view: textureView,
                        clearValue: { r: 0, g: 0, b: 0, a: 1 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            });
            renderPass.end();
            this.device.queue.submit([commandEncoder.finish()]);
        } catch { /* ignore */ }
    }

    destroy(): void {
        this.ready = false;
        this.pipeline = null;
    }
}
