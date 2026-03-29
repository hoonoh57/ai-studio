# AI-Studio 렌더링 폴백 전략

> 최초 작성: 2026-03-29
> 원칙: 어떤 환경에서든 에러 없이 동작. GPU가 좋을수록 더 빠르고 더 많은 기능 제공.

---

## 1. 왜 이 문서가 필요한가

AI-Studio는 웹 브라우저에서 실행된다. 사용자의 하드웨어는 다음과 같이 다양하다.

- RTX 4090 데스크탑 (최고 성능)
- RTX 4070 노트북 (우리 개발 환경)
- Intel Iris Xe 내장 GPU 노트북 (일반 사용자)
- Intel UHD 630 구형 내장 GPU (저사양)
- WebGPU 미지원 브라우저 (구형 Chrome, Firefox ESR 등)

모든 경우에서 에러 없이 동작해야 하며, 하드웨어가 좋을수록 더 나은 경험을 제공한다.

---

## 2. 점진적 폴백 구조 (4단계)

Tier 1: WebGPU + 외장 GPU (NVIDIA/AMD) ↓ 실패 시 Tier 2: WebGPU + 내장 GPU (Intel/AMD iGPU) ↓ 실패 시 Tier 3: WebGL2 폴백 ↓ 실패 시 Tier 4: Canvas 2D + CPU (최소 보장)


### Tier 1: WebGPU + 외장 GPU
- 대상: RTX 3060 이상, RX 6700 이상
- 프리뷰: WebGPU 컴포지터 60fps
- 이펙트: 전체 GPU 이펙트 (30개+)
- 트랜지션: 전체 GPU 트랜지션 (10개+)
- 스코프: GPU 히스토그램/벡터스코프/웨이브폼
- 내보내기: WebCodecs prefer-hardware (NVENC/AMF)
- 스크러빙 캐시: VRAM 300 텍스처
- AI: ONNX Runtime WebGPU 백엔드

### Tier 2: WebGPU + 내장 GPU
- 대상: Intel Iris Xe, Intel UHD 770, AMD Radeon 680M
- 프리뷰: WebGPU 컴포지터 30~60fps (해상도 자동 조절)
- 이펙트: 경량 이펙트만 (Brightness, Contrast, Saturation, Flip, Crop)
- 트랜지션: 기본 3개 (Cross Dissolve, Dip to Black/White)
- 스코프: GPU 히스토그램만 (벡터스코프/웨이브폼 비활성)
- 내보내기: WebCodecs no-preference (Intel Quick Sync 또는 SW)
- 스크러빙 캐시: VRAM 100 텍스처 (메모리 제한)
- AI: ONNX Runtime WASM 백엔드 (GPU 메모리 부족 시)

### Tier 3: WebGL2 폴백
- 대상: WebGPU 미지원 브라우저, 구형 GPU
- 프리뷰: WebGL2 텍스처 합성 30fps
- 이펙트: fragment shader 기반 5개 (Brightness, Contrast, Saturation, Flip, Crop)
- 트랜지션: Cross Dissolve만
- 스코프: 비활성 (CPU 히스토그램 옵션)
- 내보내기: WebCodecs no-preference → FFmpeg-WASM 폴백
- 스크러빙 캐시: RAM만 (GPU 텍스처 캐시 없음)
- AI: 비활성

### Tier 4: Canvas 2D + CPU (최소 보장)
- 대상: WebGL2도 미지원되는 환경
- 프리뷰: Canvas 2D drawImage 15~30fps
- 이펙트: 없음 (원본만 표시)
- 트랜지션: CSS opacity 기반 크로스페이드만
- 스코프: 비활성
- 내보내기: FFmpeg-WASM만 (소프트웨어 인코딩)
- 스크러빙 캐시: RAM 프레임 캐시만
- AI: 비활성

---

## 3. 런타임 감지 로직

### 3-1. 렌더러 초기화

```typescript
// src/engine/core/RendererFactory.ts

export type RenderTier = 'webgpu-dedicated' | 'webgpu-integrated' | 'webgl2' | 'canvas2d';

export interface RendererCapabilities {
  tier: RenderTier;
  maxTextureSize: number;
  maxEffects: number;
  gpuName: string;
  vramEstimate: number; // MB
  hwEncoding: boolean;
}

export async function detectRenderTier(): Promise<RendererCapabilities> {
  // 1. WebGPU 시도
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (adapter) {
        const info = await adapter.requestAdapterInfo();
        const device = await adapter.requestDevice();
        const isDedicated = /nvidia|radeon|geforce|rtx|gtx|rx /i.test(info.description || info.vendor || '');
        
        return {
          tier: isDedicated ? 'webgpu-dedicated' : 'webgpu-integrated',
          maxTextureSize: device.limits.maxTextureDimension2D,
          maxEffects: isDedicated ? 30 : 5,
          gpuName: info.description || info.vendor || 'Unknown GPU',
          vramEstimate: isDedicated ? 4096 : 1024,
          hwEncoding: isDedicated,
        };
      }
    } catch (e) { /* 폴백 */ }
  }

  // 2. WebGL2 시도
  const testCanvas = document.createElement('canvas');
  const gl = testCanvas.getContext('webgl2');
  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown';
    return {
      tier: 'webgl2',
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxEffects: 5,
      gpuName: renderer,
      vramEstimate: 512,
      hwEncoding: false,
    };
  }

  // 3. Canvas 2D 최소 보장
  return {
    tier: 'canvas2d',
    maxTextureSize: 4096,
    maxEffects: 0,
    gpuName: 'None (CPU)',
    vramEstimate: 0,
    hwEncoding: false,
  };
}
3-2. 내보내기 엔진 폴백
Copy// src/engines/exportFactory.ts

export async function selectExportEngine(tier: RenderTier) {
  if (tier === 'webgpu-dedicated') {
    // NVENC/AMF HW 인코딩
    return { engine: 'webcodecs', hwAccel: 'prefer-hardware' };
  }
  if (tier === 'webgpu-integrated') {
    // Intel Quick Sync 또는 SW
    return { engine: 'webcodecs', hwAccel: 'no-preference' };
  }
  if (tier === 'webgl2') {
    // WebCodecs 시도 → FFmpeg 폴백
    try {
      const sup = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42001e', width: 1280, height: 720,
        bitrate: 4000000, hardwareAcceleration: 'no-preference'
      });
      if (sup.supported) return { engine: 'webcodecs', hwAccel: 'no-preference' };
    } catch {}
    return { engine: 'ffmpeg-wasm', hwAccel: 'none' };
  }
  // Canvas 2D = FFmpeg만
  return { engine: 'ffmpeg-wasm', hwAccel: 'none' };
}
4. UI 표시
사용자에게 현재 감지된 Tier를 설정 화면에서 보여준다.

🟢 GPU: NVIDIA GeForce RTX 4070 Laptop GPU (Tier 1 - 최고 성능)
   프리뷰: WebGPU 60fps | 이펙트: 30개 | 내보내기: NVENC HW 가속

🟡 GPU: Intel Iris Xe (Tier 2 - 표준)
   프리뷰: WebGPU 30fps | 이펙트: 5개 | 내보내기: 소프트웨어

🟠 GPU: WebGL2 (Tier 3 - 제한됨)
   프리뷰: WebGL 30fps | 이펙트: 5개 | 내보내기: 소프트웨어

🔴 GPU: 없음 (Tier 4 - 최소)
   프리뷰: Canvas 2D | 이펙트: 없음 | 내보내기: FFmpeg 소프트웨어
5. 이펙트별 Tier 지원 매트릭스
이펙트	Tier 1	Tier 2	Tier 3	Tier 4
Brightness/Contrast	WGSL compute	WGSL compute	GLSL fragment	없음
Levels	WGSL compute	WGSL compute	없음	없음
Color Balance	WGSL compute	없음	없음	없음
Saturation	WGSL compute	WGSL compute	GLSL fragment	없음
LUT	WGSL compute	없음	없음	없음
Gaussian Blur	WGSL compute	없음	없음	없음
Directional Blur	WGSL compute	없음	없음	없음
Sharpen	WGSL compute	없음	GLSL fragment	없음
Chroma Key	WGSL compute	없음	없음	없음
Lens Distortion	WGSL compute	없음	없음	없음
Mirror/Flip	WGSL compute	WGSL compute	GLSL fragment	없음
Crop	WGSL compute	WGSL compute	GLSL fragment	없음
Noise	WGSL compute	없음	없음	없음
Posterize	WGSL compute	없음	없음	없음
Vignette	WGSL compute	없음	없음	없음
6. 테스트 체크리스트
새 렌더링/이펙트 기능 구현 시 반드시 4개 Tier에서 테스트:

 Tier 1: Chrome + 외장 GPU (개발 PC)
 Tier 2: Chrome + 내장 GPU만 (Windows 설정에서 Chrome을 '절전' GPU로 변경)
 Tier 3: WebGPU 비활성화 (chrome://flags → #enable-unsafe-webgpu → Disabled)
 Tier 4: WebGL도 비활성화 (chrome://flags → #disable-webgl → Enabled)
에러 없이 동작해야 하며, 기능이 제한되더라도 UI에 명확히 표시해야 한다.

7. 참조
GPU_SETUP_GUIDE.md: GPU 하드웨어 설정 가이드
EXPORT_ENGINE_ARCHITECTURE.md: 내보내기 엔진 아키텍처
GPU_ROADMAP.md: GPU 활용 전략 로드맵
MasterSelects: https://github.com/Sportinger/MasterSelects (WebGPU 폴백 참고)
WebGPU 브라우저 지원: Chrome 113+, Firefox 141+, Safari 26+