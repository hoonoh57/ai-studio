AI-Studio GPU 활용 전략 — 경쟁 툴 분석 및 적용 계획
1. 경쟁 툴 GPU 활용 현황
Premiere Pro (Mercury Playback Engine)
Premiere Pro는 GPU를 통해 68개 이상의 이펙트를 실시간 재생합니다. GPU가 처리하는 영역은 크게 여섯 가지입니다. 이미지 프로세싱(스케일링, 색공간 변환, 디인터레이스), 컬러 보정(Lumetri Color, ASC CDL, Levels, Brightness & Contrast, Gamma Correction, Tint), 블러/샤픈(Gaussian Blur, Directional Blur, Sharpen, Unsharp Mask), 키잉(Ultra Key, Color Key, Track Matte Key), 왜곡(Lens Distortion, Spherize, Twirl, Wave Warp, Corner Pin, Warp Stabilizer), 트랜지션(Gradient Wipe, Linear Wipe, Block Dissolve). CUDA/OpenCL 기반이며 4GB VRAM이 최소 요구사항입니다. 다중 GPU도 렌더링/내보내기에서 활용합니다.

CapCut Desktop
CapCut은 NVENC 하드웨어 인코딩/디코딩을 활용하며, GPU 가속 프리뷰, 트랜지션, 텍스트 애니메이션, AI 기능(배경 제거, 자동 캡션)을 제공합니다. 프록시 편집 시스템으로 4K 소스도 저사양에서 처리 가능합니다. CapCut Web 버전은 클라이언트 사이드 렌더링을 사용합니다.

DaVinci Resolve
DaVinci Resolve는 GPU 의존도가 가장 높은 편집기입니다. CUDA/OpenCL/Metal을 통해 컬러 그레이딩 전체를 GPU에서 처리하고, Fusion 합성 엔진의 대부분의 노드가 GPU 가속됩니다. Studio 버전은 NVENC/NVDEC 하드웨어 인코딩/디코딩을 지원하며, AI 기능(매직 마스크, DaVinci Neural Engine)도 GPU를 활용합니다. RTX 5090 한 장이 이전 세대 RTX 4090 세 장 성능에 맞먹을 정도로 GPU를 적극 활용합니다.

MasterSelects (브라우저 기반 경쟁자 — 오픈소스)
MasterSelects는 "GPU-first architecture"를 구현한 브라우저 기반 편집기로, 우리에게 가장 직접적인 참고 대상입니다. 핵심 특징은 다음과 같습니다.

WebGPU 핑퐁 컴포지터: 2,500줄 이상의 WGSL 셰이더로 30개 이펙트, 37개 블렌드 모드를 GPU에서 실시간 처리
Zero-copy 비디오 텍스처: importExternalTexture로 비디오 프레임을 CPU 경유 없이 직접 GPU로 전달
Zero-copy 내보내기: new VideoFrame(offscreenCanvas)로 GPU 캔버스에서 직접 WebCodecs 인코딩 (readPixels() 없음)
3단계 스크러빙 캐시: GPU VRAM 300 텍스처 → 비디오별 프레임 캐시 → 900프레임 RAM 프리뷰
GPU 가속 비디오 스코프: 히스토그램, 벡터스코프, 웨이브폼 모니터
SAM2 온디바이스 AI: ONNX Runtime으로 브라우저 내 세그멘테이션
2. 우리 AI-Studio의 현재 상태 vs 경쟁 툴
기능 영역	Premiere Pro	CapCut	MasterSelects	AI-Studio (현재)
프리뷰 렌더링	GPU (Mercury)	GPU	WebGPU	Canvas 2D (CPU)
비디오 이펙트	GPU 68개+	GPU	WebGPU 30개	없음
컬러 보정	GPU (Lumetri)	GPU	WebGPU	없음
트랜지션	GPU	GPU	WebGPU (실험적)	없음
텍스트 렌더링	GPU	GPU	WebGPU	Canvas 2D
디코딩	HW (NVDEC)	HW	WebCodecs HW	WebCodecs HW
인코딩/내보내기	HW (NVENC)	HW (NVENC)	WebCodecs HW	WebCodecs HW (NVENC) ✅
스크러빙 캐시	RAM + GPU	RAM	GPU VRAM 300 텍스처	없음
비디오 스코프	GPU	없음	GPU	없음
AI (세그멘테이션)	있음	있음 (배경 제거)	SAM2 온디바이스	없음
프록시 편집	있음	있음	GPU 가속 프록시	없음
결론: 내보내기(인코딩)만 GPU를 활용하고 있으며, 프리뷰/이펙트/컬러/스크러빙 등 편집 중 실시간 처리는 전부 CPU에 의존하고 있습니다.

3. GPU 활용 대상 영역 (우선순위순)
Phase 1: 프리뷰 렌더링 — WebGPU 컴포지터 (최우선)
현재 문제: Canvas 2D로 프리뷰를 렌더링하면 1080p 다중 레이어에서 프레임 드랍이 발생합니다. 이것은 사용자가 편집 중 가장 많이 체감하는 성능 문제입니다.

구현 방안: WebGPU 렌더 파이프라인을 생성하고 importExternalTexture로 비디오 프레임을 zero-copy로 GPU에 전달합니다. 각 레이어(비디오, 텍스트, 이미지)를 GPU 텍스처로 합성하고 최종 결과를 화면에 출력합니다.

핵심 코드 구조:

src/engine/
  core/WebGPUContext.ts        — GPUDevice, GPUAdapter 초기화
  render/Compositor.ts         — 레이어별 합성, 블렌드 모드
  texture/TextureManager.ts    — 비디오/이미지 텍스처 관리, 캐시
  pipeline/PreviewPipeline.ts  — requestAnimationFrame 루프

src/shaders/
  composite.wgsl               — 레이어 합성 셰이더
  text.wgsl                    — 텍스트 렌더링 셰이더
  blend.wgsl                   — 블렌드 모드 (normal, multiply, screen, overlay 등)
성능 목표: 1080p 3레이어 합성 시 60fps 유지.

경쟁 수준: MasterSelects 수준 (WebGPU 컴포지터)에 도달.

Phase 2: GPU 비디오 이펙트 — WGSL Compute Shader
현재 문제: 이펙트가 아예 없습니다. Premiere Pro는 68개, MasterSelects는 30개를 GPU로 실시간 처리합니다.

1차 구현 대상 (핵심 15개):

컬러 보정: Brightness/Contrast, Levels, Color Balance, Saturation, LUT 적용
블러/샤픈: Gaussian Blur, Sharpen, Directional Blur
키잉: Chroma Key (그린스크린 제거)
왜곡: Lens Distortion, Mirror, Flip
스타일: Noise, Posterize, Vignette
구현 방안: 각 이펙트를 WGSL compute shader로 작성합니다. 비디오 프레임 텍스처를 입력으로 받아 이펙트를 적용한 출력 텍스처를 생성하고, 이를 컴포지터에 전달합니다.

예시 — Gaussian Blur compute shader:

@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: BlurParams;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let dims = textureDimensions(inputTex);
    if (gid.x >= dims.x || gid.y >= dims.y) { return; }
    
    var color = vec4f(0.0);
    var total = 0.0;
    let radius = i32(params.radius);
    
    for (var dy = -radius; dy <= radius; dy++) {
        for (var dx = -radius; dx <= radius; dx++) {
            let coord = vec2i(i32(gid.x) + dx, i32(gid.y) + dy);
            let clamped = clamp(coord, vec2i(0), vec2i(dims) - 1);
            let weight = exp(-f32(dx*dx + dy*dy) / (2.0 * params.sigma * params.sigma));
            color += textureLoad(inputTex, clamped, 0) * weight;
            total += weight;
        }
    }
    textureStore(outputTex, vec2i(gid.xy), color / total);
}
파일 구조:

src/effects/
  color/brightness.wgsl, levels.wgsl, saturation.wgsl, lut.wgsl, colorBalance.wgsl
  blur/gaussian.wgsl, directional.wgsl, sharpen.wgsl
  keying/chromaKey.wgsl
  distort/lensDistortion.wgsl, mirror.wgsl, flip.wgsl
  stylize/noise.wgsl, posterize.wgsl, vignette.wgsl
  EffectRegistry.ts              — 이펙트 등록/관리
  EffectPipeline.ts              — 이펙트 체인 실행
성능 목표: 1080p 프레임에 이펙트 3개 체인 적용 시 16ms 이내 (60fps 유지).

Phase 3: GPU 스크러빙 캐시
현재 문제: 타임라인을 스크러빙할 때마다 비디오를 디코딩해야 하므로 느립니다.

구현 방안: MasterSelects의 3단계 캐시 모델을 참고합니다. Tier 1은 GPU VRAM에 최근 사용 프레임 텍스처 200~300개를 LRU 캐시로 보관하여 즉시 표시합니다. Tier 2는 비디오별 마지막 디코딩 프레임을 유지합니다. Tier 3는 RAM에 최대 900프레임을 저장하는 RAM Preview입니다. 캐시가 따뜻한 상태에서 스크러빙 시 디코딩 없이 즉시 표시됩니다.

핵심: importExternalTexture 대신 디코딩된 VideoFrame을 GPUTexture로 복사하여 VRAM에 보관하면, 동일 프레임 재요청 시 디코딩을 건너뜁니다.

성능 목표: 캐시 히트 시 스크러빙 레이턴시 < 2ms.

Phase 4: GPU 트랜지션
현재 문제: 트랜지션이 없습니다. Premiere Pro는 모든 트랜지션이 GPU 가속이고, CapCut은 30+ 트랜지션을 제공합니다.

1차 구현 대상 (10개):

Cross Dissolve, Dip to Black, Dip to White (기본)
Wipe (Left/Right/Up/Down), Gradient Wipe
Push, Slide
Zoom In/Out
Blur Transition
구현 방안: 두 클립의 프레임을 동시에 GPU 텍스처로 로드하고, 전환 progress(0~1)를 uniform으로 전달하여 WGSL fragment shader에서 합성합니다.

Phase 5: GPU 비디오 스코프
구현 대상: 히스토그램(RGB), 웨이브폼 모니터, 벡터스코프.

구현 방안: compute shader로 프레임의 모든 픽셀을 분석하여 히스토그램 데이터를 GPU storage buffer에 누적하고, 별도의 렌더 패스에서 시각화합니다. DaVinci Resolve와 MasterSelects가 모두 GPU로 처리하는 기능입니다.

Phase 6: 온디바이스 AI — WebGPU + ONNX Runtime
구현 대상: 배경 제거(SAM2/RMBG), 자동 자막(Whisper), 객체 추적.

구현 방안: ONNX Runtime Web의 WebGPU 백엔드를 사용하여 ML 모델을 GPU에서 추론합니다. MasterSelects는 SAM2(~220MB)를 브라우저에서 실행하고, Whisper 트랜스크립션도 온디바이스로 처리하고 있으므로 기술적으로 가능합니다.

Phase 7: 내보내기 최적화 — Zero-copy 파이프라인
현재 상태: VideoSampleSource + NVENC로 5.7x 실시간 달성. 하지만 Canvas 2D drawImage를 거치는 과정에서 CPU-GPU 왕복이 발생합니다.

개선: Phase 1의 WebGPU 컴포지터가 완성되면, 내보내기 시 GPU 캔버스에서 new VideoFrame(offscreenCanvas)로 직접 프레임을 캡처하여 WebCodecs로 인코딩합니다. readPixels()나 getImageData()를 거치지 않으므로 CPU-GPU 왕복이 제거됩니다.

성능 목표: 현재 5.7x → 8~10x 실시간.

4. 구현 우선순위 로드맵
Phase	기능	기간(예상)	경쟁력 효과
1	WebGPU 프리뷰 컴포지터	2~3주	CapCut 수준 실시간 프리뷰
2	GPU 이펙트 15개	3~4주	Premiere Pro 핵심 이펙트 커버
3	GPU 스크러빙 캐시	1~2주	MasterSelects 수준 즉시 스크러빙
4	GPU 트랜지션 10개	2주	CapCut 수준 트랜지션
5	GPU 비디오 스코프	1~2주	DaVinci Resolve 수준 모니터링
6	온디바이스 AI	3~4주	CapCut 수준 AI 기능
7	Zero-copy 내보내기	1주	최적 성능 (Phase 1 이후 자동 적용)
5. 기술 결정 사항
WebGPU vs WebGL: WebGPU를 선택합니다. WebGL에는 compute shader가 없어서 이펙트/스코프 구현에 한계가 있습니다. Chrome 113+, Firefox 141+, Safari 26+에서 모두 지원되며, RTX 4070은 D3D12 백엔드로 완전 호환됩니다.

Zero-copy 비디오 임포트: device.importExternalTexture({ source: videoElement })를 사용하여 비디오 프레임을 CPU 거치지 않고 직접 GPU 텍스처로 가져옵니다. 이것이 MasterSelects가 60fps를 달성하는 핵심 기술입니다.

셰이더 언어: WGSL(WebGPU Shading Language)을 사용합니다. GLSL 변환 레이어 없이 네이티브로 작성합니다.

기존 Mediabunny 유지: 내보내기 엔진은 현재 동작하는 Mediabunny + VideoSampleSource + NVENC 파이프라인을 유지합니다. WebGPU 컴포지터가 완성된 후 Phase 7에서 zero-copy로 연결합니다.

6. 절대 반복하지 않을 원칙
GPU 설정 먼저 확인: 새 기능 개발 전 docs/GPU_SETUP_GUIDE.md 체크리스트 완료.
API 추측 코딩 금지: WebGPU API, Mediabunny API 모두 공식 문서를 참조한 후 코딩.
단계별 검증: 각 Phase의 최소 동작 확인(프리뷰 1프레임 렌더링)을 먼저 하고 확장.
참고 구현 확인: MasterSelects(MIT 라이선스)의 실제 동작 코드를 참조 — 추측이 아닌 검증된 패턴 사용.