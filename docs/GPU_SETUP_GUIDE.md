# GPU 하드웨어 가속 설정 가이드

> **최초 작성**: 2026-03-29  
> **교훈**: 이 설정을 확인하지 않고 수십 시간을 소프트웨어 인코딩 디버깅에 낭비함.  
> **원칙**: 코드를 한 줄이라도 작성하기 전에, 반드시 이 문서의 체크리스트를 완료할 것.

---

## 1. 왜 이 문서가 존재하는가

2026-03-29, WebCodecs `VideoEncoder`의 `prefer-hardware` 옵션이 전부 실패하여
소프트웨어(CPU) 인코딩만 가능했고, 인코더 생성 자체가 크래시 나는 문제가 반복되었다.

근본 원인: **Chrome이 Intel 내장 GPU를 Active GPU로 사용**하고 있었고,
NVIDIA RTX 4070 Laptop GPU(NVENC)는 비활성 상태였다.
`chrome://gpu`의 `Video Acceleration Information > Encoding` 항목이 **완전히 비어 있었다.**

GPU 설정 변경 후: Encoding 항목에 H.264/HEVC/AV1 HW 인코더가 모두 등록되었고,
`prefer-hardware`가 정상 동작하여 **135.8 fps, 5.7x 실시간** 인코딩 달성.

**이 설정 확인 없이 코드를 디버깅하는 것은 시간 낭비이다.**

---

## 2. 개발 환경 필수 체크리스트

### 2-1. Windows GPU 설정 (노트북 = 듀얼 GPU 환경)

노트북은 대부분 Intel iGPU + NVIDIA dGPU 구조이다.
Chrome은 기본적으로 Intel iGPU를 사용하므로 **수동으로 변경**해야 한다.

Copy
설정 → 시스템 → 디스플레이 → 그래픽 → "앱 추가" → C:\Program Files\Google\Chrome\Application\chrome.exe → 옵션 → "고성능" (NVIDIA GPU) 선택 → 저장


NVIDIA 제어판이 설치되어 있다면 추가로:

바탕화면 우클릭 → NVIDIA 제어판 → 3D 설정 관리 → 프로그램 설정 → Chrome 추가 → "고성능 NVIDIA 프로세서" 선택


**설정 후 Chrome을 완전히 종료(작업 관리자에서 모든 chrome.exe 종료)한 뒤 재시작.**

### 2-2. Chrome GPU 상태 확인

주소창에 `chrome://gpu` 입력 후 아래 항목들을 확인:

| 확인 항목 | 정상 상태 | 비정상 상태 |
|-----------|-----------|-------------|
| `GPU0` | `NVIDIA ... *ACTIVE*` | `Intel ... *ACTIVE*` |
| `Video Encode` | `Hardware accelerated` | `Software only` 또는 미표시 |
| `Encoding` 섹션 | `Encode h264 baseline/main/high` 목록 존재 | **비어 있음** |
| `GL_RENDERER` | `ANGLE (NVIDIA, ...)` | `ANGLE (Intel, ...)` |
| `WebGPU` | `Hardware accelerated` | `Disabled` |

### 2-3. WebCodecs HW 인코딩 검증 (F12 콘솔)

```javascript
async function verifyHWEncoder() {
  const configs = [
    { codec: 'avc1.64001f', width: 1280, height: 720, bitrate: 8e6, hardwareAcceleration: 'prefer-hardware' },
    { codec: 'avc1.64001f', width: 1920, height: 1080, bitrate: 8e6, hardwareAcceleration: 'prefer-hardware' },
  ];
  for (const c of configs) {
    const r = await VideoEncoder.isConfigSupported(c);
    console.log(`${c.width}x${c.height} HW: ${r.supported ? '✅' : '❌'}`);
  }
  // 실제 생성 테스트
  const enc = new VideoEncoder({ output: () => {}, error: (e) => console.error(e) });
  enc.configure({ codec: 'avc1.64001f', width: 1280, height: 720, bitrate: 8e6, hardwareAcceleration: 'prefer-hardware' });
  await new Promise(r => setTimeout(r, 300));
  console.log(`인코더 상태: ${enc.state === 'configured' ? '✅ HW 인코딩 가능' : '❌ 실패'}`);
  enc.close();
}
verifyHWEncoder();
모두 ✅가 나와야 개발을 시작한다.

2-4. chrome://flags 확인
플래그	값
#enable-accelerated-video-encode	Enabled
#enable-unsafe-webgpu	Enabled (WebGPU 기능 필요 시)
3. 현재 하드웨어 스펙 (참조)
항목	값
GPU (Discrete)	NVIDIA GeForce RTX 4070 Laptop GPU (8GB VRAM)
GPU (Integrated)	Intel UHD Graphics
NVENC 지원 코덱	H.264 (Baseline/Main/High), HEVC (Main), AV1
H.264 최대 해상도	3840×2160 @30fps, 1920×1080 @121fps
RAM	32GB
CPU 코어	32 (논리 프로세서)
Chrome 버전	146.x
WebGPU	D3D12 backend, Available
4. 문제 발생 시 디버깅 순서
절대로 코드를 먼저 수정하지 않는다. 아래 순서를 따른다:

chrome://gpu → GPU0이 NVIDIA ACTIVE인지 확인
Encoding 섹션에 H.264 인코더가 등록되어 있는지 확인
F12 콘솔에서 verifyHWEncoder() 실행
위 3단계가 모두 정상인데 코드에서 에러가 나면, 그때 비로소 코드를 본다
5. 팀원/새 세션 온보딩
새 AI 세션이 시작되거나 새 개발자가 합류하면 반드시 이 문서를 먼저 읽게 할 것. 이전 세션에서 GPU 설정 없이 VideoEncoder 크래시를 코드로 해결하려고 수십 회 반복 실패한 역사를 반복하지 않기 위함이다.


---

**파일 2: `docs/EXPORT_ENGINE_ARCHITECTURE.md`**

```markdown
# Export Engine 아키텍처 문서

> **최초 작성**: 2026-03-29  
> **버전**: v5 (VideoSampleSource + NVENC HW 가속)  
> **상태**: ✅ Production — 337.5초 영상 59초 내보내기 (5.7x 실시간, 135.8 fps)

---

## 1. 아키텍처 개요

┌─ ExportPanel.tsx (UI) ─────────────────────────────────┐ │ exportWithWebCodecs({ preset, project, rangeStart, │ │ rangeEnd, onProgress, onLog }) │ └────────────────────────┬───────────────────────────────┘ ▼ ┌─ webcodecExportEngine.ts (v5) ─────────────────────────┐ │ │ │ 1. analyzeTimeline() → RenderPlan (로그용) │ │ 2. Input → BlobSource로 소스 열기 │ │ 3. 전체 passthrough? → transmuxFastPath() │ │ 4. composite 존재 → 전체 디코드-인코드 모드: │ │ ┌─────────────────────────────────────────────┐ │ │ │ VideoSampleSink → sample.draw(canvas) │ │ │ │ → drawTextOverlays(canvas) │ │ │ │ → new VideoSample(canvas) │ │ │ │ → VideoSampleSource.add() [NVENC HW 인코딩]│ │ │ └─────────────────────────────────────────────┘ │ │ 오디오: EncodedPacketSink → EncodedAudioPacketSource│ │ 5. output.finalize() → Blob │ │ │ │ 폴백: FFmpeg-WASM (exportEngine.ts) │ └─────────────────────────────────────────────────────────┘


---

## 2. 핵심 설계 원칙

### 원칙 1: Mediabunny 공식 API만 사용한다

| 사용하는 것 | 사용하지 않는 것 |
|-------------|-----------------|
| `VideoSampleSource` (인코딩 자동) | 직접 `VideoEncoder` 생성 ❌ |
| `VideoSampleSink` (디코딩 자동) | 직접 `VideoDecoder` 생성 ❌ |
| `EncodedAudioPacketSource` (오디오 passthrough) | `EncodedVideoPacketSource` + 수동 인코딩 ❌ |
| `VideoSample.draw()` (캔버스 렌더링) | `sample.image` / `sample.toVideoFrame()` ❌ |
| `Conversion` (transmux fast path) | passthrough + re-encode 패킷 혼합 ❌ |

### 원칙 2: 패킷 혼합 절대 금지

passthrough 원본 패킷과 re-encode 패킷을 **하나의 트랙에 섞으면 반드시 깨진다**.
SPS/PPS(코덱 파라미터)가 불일치하기 때문이다.

**선택지는 두 가지뿐이다:**
- 전체 passthrough (Conversion/transmux) — 텍스트/이펙트 없을 때
- 전체 디코드-인코드 (VideoSampleSource) — 하나라도 합성이 필요할 때

### 원칙 3: GPU 하드웨어 가속을 반드시 활용한다

```typescript
// VideoSampleSource 생성 시 반드시 HW 가속 시도
const videoSource = new VideoSampleSource({
  codec: 'avc',
  bitrate: videoBitrate,
  hardwareAcceleration: 'prefer-hardware', // NVENC 사용
  keyFrameInterval: 2,
});
prefer-hardware가 실패하면 no-preference로 폴백한다. 실패 원인은 코드가 아니라 GPU 설정이다 → docs/GPU_SETUP_GUIDE.md 참조.

원칙 4: 코덱 이름은 짧은 형태를 사용한다
Mediabunny API	사용하는 값	사용하지 않는 값
VideoSampleSource({ codec })	'avc'	'avc1.64001f' ❌
EncodedAudioPacketSource(codec)	'aac'	'mp4a.40.2' ❌
EncodedVideoPacketSource(codec)	'avc'	'h264' ❌
긴 코덱 문자열(avc1.64001f)은 VideoEncodingConfig.fullCodecString에 넣을 수 있지만, 기본적으로 Mediabunny가 자동 생성하므로 지정하지 않는다.

3. 데이터 흐름
3-1. ExportPanel → webcodecExportEngine 호출 규격
Copy// ExportPanel.tsx에서 호출하는 방식 (변경 금지)
resultBlob = await exportWithWebCodecs({
  preset,      // ExportPreset 객체 (exportEngine.ts에서 정의)
  project,     // Project 객체 (tracks: Track[], assets: Asset[])
  rangeStart,  // 초 단위
  rangeEnd,    // 초 단위
  onProgress,  // (p: ExportProgress) => void
  onLog,       // (msg: string) => void
});
3-2. 소스 URL 조회 방법
Copy// 클립에서 에셋 찾기 (assetId로 조회)
const mainClip = videoTrack.clips[0];
const mainAsset = assets.find(a => a.id === mainClip.assetId);
const srcUrl = mainAsset.src;  // Blob URL 또는 HTTP URL
절대로 clip.asset?.src, clip.src, clip.url 같은 존재하지 않는 속성을 참조하지 않는다.

3-3. 텍스트 클립 구조
Copy// clip.textContent 객체 구조
clip.textContent = {
  text: string,           // 실제 텍스트
  style: {
    fontFamily: string,
    fontSize: number,      // px 단위 (1080p 기준)
    fontWeight: number,
    color: string,
    backgroundColor: string,
    strokeColor: string,
    strokeWidth: number,
    shadowColor: string,
    shadowBlur: number,
    shadowOffsetX: number,
    shadowOffsetY: number,
    positionX: number,     // 0-100 (%)
    positionY: number,     // 0-100 (%)
  }
};
4. 성능 기준
현재 측정값 (RTX 4070 Laptop, 1280×720 소스, AVC 인코딩)
항목	값
영상 길이	337.5초
내보내기 시간	59초
실시간 배속	5.7x
인코딩 FPS	135.8 fps
출력 크기	112.6 MB
텍스트 오버레이	11.1초 구간 (3개 텍스트 클립)
성능 목표
시나리오	목표
텍스트만 있는 10분 영상 (720p)	< 2분
텍스트만 있는 10분 영상 (1080p)	< 3분
텍스트 없는 영상 (transmux)	< 15초
4K 영상 (텍스트 있음)	< 10분
5. 실패 히스토리 (반복 금지)
실패 1: EncodedVideoPacketSource에 수동 인코딩 패킷 주입
시도: WebCodecs VideoEncoder로 직접 인코딩 → EncodedPacket 생성 → EncodedVideoPacketSource.add()
결과: "Encoder creation error" — prefer-hardware 미지원 (GPU 설정 안 됨)
교훈: VideoEncoder를 직접 다루지 말고 VideoSampleSource를 사용할 것
실패 2: passthrough + re-encode 패킷 혼합
시도: passthrough 구간은 원본 패킷 복사, composite 구간은 인코딩된 패킷 주입
결과: 영상 완전히 깨짐 (글리치, 색 왜곡) — SPS/PPS 코덱 파라미터 불일치
교훈: 하나의 트랙에 서로 다른 인코더의 패킷을 혼합하면 반드시 깨진다
실패 3: GPU 설정 미확인 상태에서 코드 디버깅
시도: "Encoder creation error"를 코덱 문자열, 프로파일, 폴백 로직으로 해결 시도
결과: 10회 이상 반복 실패 — no-preference/prefer-software로 우회해도 불안정
교훈: chrome://gpu 확인이 최우선이다. Encoding 섹션이 비어 있으면 코드 문제가 아니다
실패 4: ExportPanel ↔ Engine 인터페이스 불일치
시도: Engine이 preset: string, tracks: any[]를 기대하는데 UI가 preset: ExportPreset, project: Project를 전달
결과: "preset.match is not a function", "tracks is not iterable"
교훈: 반드시 호출측 코드를 먼저 읽고 인터페이스를 맞출 것
6. 향후 개발 시 GPU 활용 지침
6-1. 새 인코딩 기능 추가 시
VideoSampleSource에 코덱 변경만으로 HEVC, AV1도 사용 가능
현재 HW 지원: H.264, HEVC, AV1 (chrome://gpu에서 확인됨)
AV1은 품질이 더 좋고 파일 크기가 작지만 인코딩 속도가 느릴 수 있음
Copy// HEVC 인코딩 예시
new VideoSampleSource({
  codec: 'hevc',
  bitrate: 6_000_000,
  hardwareAcceleration: 'prefer-hardware',
});

// AV1 인코딩 예시
new VideoSampleSource({
  codec: 'av1',
  bitrate: 4_000_000,
  hardwareAcceleration: 'prefer-hardware',
});
6-2. 프리뷰 렌더링
WebGPU가 Available 상태 (RTX 4070 D3D12 backend)
프리뷰 렌더링에 WebGPU Compute Shader 활용 가능
이펙트(블러, 색보정 등)를 GPU에서 실시간 처리
6-3. 디코딩
Video Decode: Hardware accelerated 확인됨
VideoSampleSink가 내부적으로 HW 디코딩 사용
H.264, VP9, HEVC, AV1 모두 HW 디코딩 지원
6-4. 향후 최적화 방향
Phase 1 (현재 완료)

전체 디코드-인코드 + NVENC = 5.7x 실시간
Phase 2 (향후)

텍스트 없는 구간은 Conversion(transmux)으로 직접 복사
텍스트 있는 구간만 별도 MP4로 인코딩
두 MP4를 concat (FFmpeg 또는 Mediabunny)
예상: passthrough 90% + re-encode 10% = 15~20x 실시간
Phase 3 (향후)

WebGPU Compute Shader로 텍스트 렌더링/이펙트 합성을 GPU에서 처리
Canvas 2D drawText 대신 GPU 텍스트 렌더링 → 인코딩 병목 해소
7. 참고 링크
리소스	URL
Mediabunny 문서	https://mediabunny.dev
VideoSampleSource API	https://mediabunny.dev/api/VideoSampleSource
VideoSampleSink API	https://mediabunny.dev/api/VideoSampleSink
VideoSample API	https://mediabunny.dev/api/VideoSample
Media Sources 가이드	https://mediabunny.dev/guide/media-sources
Writing Media Files	https://mediabunny.dev/guide/writing-media-files
Codec Registry	https://mediabunny.dev/codec-registry/overview
Chrome GPU 진단	chrome://gpu
WebCodecs 스펙	https://www.w3.org/TR/webcodecs/