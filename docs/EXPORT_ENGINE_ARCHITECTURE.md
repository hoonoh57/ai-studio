# Export Engine Architecture — AI-Studio

## 1. 개요
WebCodecs + Mediabunny 기반 하이브리드 내보내기 엔진.
NVENC GPU 가속(기본) + FFmpeg-WASM 소프트웨어 폴백 이중 구조.

## 2. 엔진 구조
| 엔진 | 파일 | 용도 |
|------|------|------|
| WebCodecs HW | webcodecExportEngine.ts | NVENC GPU 가속 인코딩 (기본) |
| FFmpeg-WASM SW | exportEngine.ts | 소프트웨어 폴백 |

## 3. 핵심 설계 원칙
- Mediabunny VideoSampleSource 사용 (직접 VideoEncoder 생성 금지)
- hardwareAcceleration: prefer-hardware (RTX 4070 NVENC 활용)
- passthrough 패킷과 re-encode 패킷 혼합 절대 금지

## 4. 데이터 흐름 (v5 최종)
Input(소스) → VideoSampleSink(디코드) → OffscreenCanvas(프레임+텍스트) → VideoSample → VideoSampleSource(Mediabunny 자동 NVENC 인코딩) → Output(MP4)
오디오: EncodedAudioPacketSource (passthrough 복사)

## 5. 실패 히스토리 (절대 반복 금지)

### v2 실패
- preset을 string으로 전달 → ExportPanel은 ExportPreset 객체 전달, 타입 불일치
- tracks 직접 전달 → project 객체에서 tracks/assets 추출 필요
- mainClip.asset?.src → asset 속성 없음, assetId로 assets.find() 필요

### v3 실패
- vTrack.codecName → undefined, getCodecParameterString() 사용 필요
- prefer-hardware → Chrome이 Intel iGPU 사용중이라 HW 인코더 없음
- EncodedVideoPacketSource passthrough+re-encode 혼합 → 영상 깨짐

### v4 실패
- 직접 VideoEncoder 생성 → Encoder creation error
- isConfigSupported 통과해도 실제 configure 실패

### 핵심 교훈
1. GPU 설정부터 확인 (chrome://gpu)
2. Chrome이 어떤 GPU 쓰는지 확인 (NVIDIA 제어판에서 고성능 지정)
3. Mediabunny API를 추측하지 않고 공식 문서 참조
4. 수동 VideoEncoder 금지 → VideoSampleSource에 위임
5. passthrough/re-encode 혼합 금지

## 6. 성능 기준 (RTX 4070 Laptop)
- 337.5초 영상 → 59초 (5.7x 실시간, 135.8fps)
- NVENC HW 가속 + prefer-hardware
- H.264 High Profile (avc1.64001f)

## 7. 향후 GPU 활용 가이드라인
- 모든 인코딩: hardwareAcceleration prefer-hardware 기본
- WebGPU 컴퓨트 셰이더로 필터/이펙트 가속 검토
- 새 기능 구현 전 GPU_SETUP_GUIDE.md 체크리스트 선행 확인

## 8. 참조
- Mediabunny: https://mediabunny.dev
- WebCodecs: https://www.w3.org/TR/webcodecs/
- GPU 설정: docs/GPU_SETUP_GUIDE.md
