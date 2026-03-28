# BadaCut 확장 계획 (선택지 A 확정)
# docs/EXPANSION_PLAN.md
# 작성: 2026-03-28
# 이 문서는 모든 세션에서 AI 확장 기능의 아키텍처, 자산 위치, 통합 방법을
# 신규 세션 참여자가 리포 탐색 없이 즉시 이해할 수 있도록 작성한다.

---

## 1. 아키텍처 결정 요약

### 배경

BadaCut은 원래 "웹 브라우저만 열면 동작하는 에디터"로 시작했다.
그러나 경쟁사 수준의 AI 기능(고품질 TTS, 이미지/영상 생성, STT 등)은
GPU 연산을 요구하며, 이를 구현하는 방식에 대해 아래 선택지를 검토했다.

| 선택지 | 설명 | 판정 |
|--------|------|------|
| 서버 제공 | 우리 GPU 서버에서 AI 처리, 사용자에게 무료 제공 | ❌ 기각 — RTX 4070 8GB 노트북 1대로 개발+서비스 불가. 동영상 1건 수십 분 소요. 2명 동시 요청 시 서버 정지. 클라우드 GPU 월 수백만 원 비용 비현실적 |
| API 떠넘기기 | 사용자에게 OpenAI/ElevenLabs 등 유료 API 키 입력 요구 | ❌ 기각 — 사용자에게 비용 전가 시 BadaCut 선택 이유 소멸 |
| **선택지 A** | **Electron 데스크톱 앱. 사용자 PC GPU로 로컬 AI 실행 + 외부 무료/유료 API 옵션** | ✅ **확정** |

### 확정 아키텍처: Electron 데스크톱 + 3-Tier AI 엔진

┌─────────────────────────────────────────────────────┐ │ BadaCut Desktop (Electron) │ │ React 19 + TypeScript 5.5 프론트엔드 │ │ 기본 편집 B1~B10 (오프라인 동작) │ ├─────────────────────────────────────────────────────┤ │ AI 엔진 (3-Tier 선택) │ │ │ │ Tier 1: 로컬 GPU 사용자 PC에서 실행 │ │ ─ GPT-SoVITS 최고 품질 TTS 음성 클론 │ │ ─ ComfyUI 이미지/영상 생성 │ │ ─ Whisper STT 자막 생성 │ │ ─ FFmpeg (네이티브) GPU 가속 인코딩 (NVENC) │ │ ─ RMBG/SAM 배경 제거 │ │ 비용: 0원 / 품질: 최고 / 속도: 사용자 GPU 의존 │ │ │ │ Tier 2: 무료 외부 API GPU 없는 사용자용 │ │ ─ Edge-TTS 무료 MS TTS (클라우드) │ │ ─ HuggingFace Inference 무료 티어 AI 모델 │ │ ─ Web Speech API 브라우저 내장 STT │ │ 비용: 0원 / 품질: 중간 / 속도: 보통 │ │ │ │ Tier 3: 유료 외부 API 프로 사용자 선택 │ │ ─ ElevenLabs 고품질 상용 TTS │ │ ─ OpenAI Whisper API 고품질 STT │ │ ─ Runway / Replicate 영상 생성 │ │ ─ Stability AI 이미지 생성 │ │ 비용: 사용자 부담 / 품질: 상~최고 / 속도: 빠름 │ │ ※ 사용자가 자기 API 키를 설정에서 입력 │ └─────────────────────────────────────────────────────┘


### 핵심 원칙

1. **기본 편집은 오프라인 완결** — B1~B10은 인터넷/GPU 없이도 100% 동작
2. **AI 엔진은 플러그인 구조** — 입출력 인터페이스 통일, 뒤의 엔진은 교체 가능
3. **Tier 1(로컬 GPU)이 기본 추천** — 비용 제로 + 최고 품질이므로
4. **GPU 없으면 Tier 2로 자동 폴백** — 무료 API로 기본 AI 기능은 사용 가능
5. **Tier 3은 순수 옵션** — 돈 쓸 의향 있는 사용자만 설정에서 활성화

---

## 2. 이전 프로젝트 자산 안내

### 원본 리포지토리

- **URL**: https://github.com/hoonoh57/aivideostudio
- **언어**: Python 3.12 (99%)
- **프레임워크**: PyQt6, ffmpeg-python, edge-tts, pysubs2, whisper
- **상태**: v0.5.20, Phase 3.5 완료 (Export + PIP + 자막 스타일 관리)
- **GPU 환경**: NVIDIA RTX 4070, CUDA 13.2, NVENC, FFmpeg 8.1

### 재사용 가능 자산 — 파일별 상세

#### engines/ (핵심 엔진)

| 파일 | 크기 | 핵심 내용 | BadaCut 활용 |
|------|------|----------|-------------|
| `engines/tts_engine.py` | 5.4KB | EdgeTTSEngine (edge-tts 비동기), SoVITSEngine (GPT-SoVITS HTTP API 클라이언트 localhost:9880), TTSEngine (통합 매니저) | Tier 1: SoVITSEngine → Electron child_process로 GPT-SoVITS 서버 자동 시작 + HTTP 호출. Tier 2: EdgeTTSEngine 로직을 Node.js edge-tts로 포팅 |
| `engines/ffmpeg_engine.py` | 1.8KB | FFmpeg subprocess 실행, `-progress pipe:1`으로 out_time_ms 실시간 진행률 파싱, cancel() 지원, Windows CREATE_NO_WINDOW | Electron에서 child_process.spawn으로 거의 그대로 사용. TypeScript 래퍼만 작성 |
| `engines/export_engine.py` | 5.3KB | 9개 Export 프리셋 (YouTube 1080p/4K, Shorts, Instagram Reels, TikTok, Fast Preview — 각 CPU/NVENC), 자막 번인(ASS), Shorts 자동 crop, scale→pad→fps 필터 체인 | 프리셋 상수 그대로 이전. Electron에서 네이티브 FFmpeg 호출로 B7 Export 구현 시 핵심 참고 |
| `engines/subtitle_engine.py` | 5.4KB | FFmpeg 오디오 추출 → Whisper subprocess → JSON segments → pysubs2 ASS/SRT 변환, style_to_ass_tags() (ASS 스타일 태그 생성기) | SRT 파서 알고리즘을 TypeScript로 포팅 (B4). ASS 태그 변환은 Export 시 참고 |
| `engines/whisper_worker.py` | 1.0KB | 별도 프로세스에서 torch + whisper 모델 로드, CUDA 자동 감지, fp16 가속, word_timestamps=True | Tier 1: Electron에서 python whisper_worker.py 그대로 호출. Tier 3: OpenAI Whisper API로 대체 |
| `engines/waveform_engine.py` | 3.9KB | FFmpeg raw PCM(s16le, 400Hz mono) → struct.unpack → 200 peaks/sec 피크 추출, MD5 기반 디스크 캐시 | 알고리즘 참고하여 Web Audio API decodeAudioData 기반 TypeScript 버전 작성 (B1) |
| `engines/thumbnail_engine.py` | 4.8KB | FFmpeg으로 영상 썸네일 프레임 추출 | Electron에서 FFmpeg 호출로 재사용 |

#### core/ (핵심 로직)

| 파일 | 크기 | 핵심 내용 | BadaCut 활용 |
|------|------|----------|-------------|
| `core/playback_engine.py` | 11.1KB | 타임라인 시간→소스 파일+시간 해석, 멀티트랙 우선순위, PIP 레이어, 비디오/오디오/자막 쿼리, 세그먼트 정렬+오버랩 병합 | 세그먼트 병합 알고리즘을 Export 엔진에 참고 |
| `core/project.py` | 3.8KB | .avs JSON 프로젝트 저장/로드 | BadaCut은 자체 JSON 포맷 사용 중, 호환 불필요 |
| `core/keyframe.py` | 1.8KB | 키프레임 스켈레톤 | BadaCut이 이미 더 발전된 키프레임 시스템 보유 |
| `core/undo_manager.py` | 1.4KB | QUndoStack 래퍼 | BadaCut은 Zustand undo/redo 사용 중 |

#### utils/ (유틸리티)

| 파일 | 크기 | 핵심 내용 | BadaCut 활용 |
|------|------|----------|-------------|
| `utils/ffprobe.py` | 2.7KB | FFprobe subprocess → JSON → ProbeResult dataclass (duration, width, height, fps, codec) | Electron에서 child_process로 거의 그대로 사용 |
| `utils/gpu_detect.py` | 0.7KB | NVIDIA GPU 감지 (nvidia-smi subprocess) | Tier 1 자동 감지에 활용 |
| `utils/time_utils.py` | 0.6KB | 타임코드 변환 유틸 | TypeScript 포팅 간단 |

#### gui/ (PyQt6 UI — 참고만)

| 파일 | 크기 | 비고 |
|------|------|------|
| `gui/main_window.py` | 34.2KB | PyQt6 UI — React로 재사용 불가, UX 흐름만 참고 |
| `gui/panels/` | — | 타임라인/프리뷰/자막/Export 패널 — UX 참고용 |

---

## 3. 통합 계획

### Phase 1: 기본기 완성 (현재 → B1~B10)

이 단계에서는 이전 프로젝트의 **알고리즘만 참고**하고, 코드 이전은 하지 않는다.
모든 구현은 TypeScript + Web API로 진행한다.

| 기본기 | 참고할 aivideostudio 자산 | 구현 기술 |
|--------|--------------------------|----------|
| B1 오디오 재생 | waveform_engine.py 피크 알고리즘 | Web Audio API |
| B4 자막 편집 | subtitle_engine.py SRT 파싱 로직 | TypeScript 순수 구현 |
| B7 Export | export_engine.py 프리셋 상수 | FFmpeg-WASM (브라우저) |
| 기타 B2,B3,B5,B6,B8~B10 | 참고 자산 없음 | TypeScript 순수 구현 |

### Phase 2: Electron 전환

B1~B10 완료 후, 웹 앱을 Electron으로 감싼다.

작업 항목:
- Electron 쉘 구성 (main process + renderer process)
- FFmpeg-WASM → 네이티브 FFmpeg 전환 (child_process.spawn)
- 파일 시스템 직접 접근 (프로젝트 저장, 미디어 로드)
- 로컬 GPU 감지 모듈 (gpu_detect.py 로직 포팅)

### Phase 3: Tier 1 로컬 AI 통합

Electron 환경에서 사용자 PC의 GPU를 활용하는 AI 기능을 추가한다.

#### 3-1. GPT-SoVITS 통합 (TTS 음성 클론)

BadaCut Electron └─ child_process.spawn('python', ['api_v2.py', '-p', '9880']) └─ GPT-SoVITS 서버 자동 시작 (백그라운드) └─ fetch('http://127.0.0.1:9880/tts', { json: payload }) └─ WAV 응답 → 타임라인 오디오 클립으로 추가


- 원본 코드: `aivideostudio/engines/tts_engine.py` SoVITSEngine 클래스
- API 규격: POST /tts, payload = { text, text_lang, ref_audio_path, prompt_text, prompt_lang, speed_factor, media_type: "wav" }
- 사용자 경험: "내 목소리 샘플 등록 → 텍스트 입력 → 생성" 3단계
- 요구 사항: GPT-SoVITS 런타임 번들링 또는 별도 설치 안내

#### 3-2. ComfyUI 통합 (이미지/영상 생성)

BadaCut Electron └─ ComfyUI 서버 자동 감지 또는 시작 (localhost:8188) └─ POST http://127.0.0.1:8188/prompt (워크플로우 JSON) └─ WebSocket ws://127.0.0.1:8188/ws (진행률 + 결과) └─ 생성된 이미지/영상 → 미디어 라이브러리로 자동 추가


- ComfyUI API 규격: POST /prompt → prompt_id → WebSocket 이벤트로 완료 감지
- 프리셋 워크플로우 제공: txt2img, img2img, txt2video(LTX), 배경 제거
- 사용자 경험: "프롬프트 입력 → 생성 → 타임라인에 드롭" 3단계

#### 3-3. Whisper 통합 (STT 자막)

BadaCut Electron └─ child_process.spawn('python', ['whisper_worker.py', audio, 'ko', 'medium']) └─ JSON segments 반환 └─ 자막 트랙에 자동 배치


- 원본 코드: `aivideostudio/engines/whisper_worker.py` 그대로 사용
- CUDA 자동 감지, fp16 가속
- 사용자 경험: "자동 자막 생성" 버튼 클릭 → 완료

#### 3-4. FFmpeg 네이티브 Export

BadaCut Electron └─ child_process.spawn('ffmpeg', [...args]) └─ NVENC 자동 감지 → GPU 인코딩 └─ -progress pipe:1 → 진행률 파싱


- 원본 코드: `aivideostudio/engines/ffmpeg_engine.py` + `export_engine.py`
- 9개 프리셋 상수 그대로 이전
- NVENC 가용 시 자동 전환 (h264_nvenc)

### Phase 4: Tier 2/3 외부 API 통합

로컬 GPU가 없는 사용자를 위한 폴백 옵션.

#### Tier 2 (무료)

| 기능 | API | 비용 | 제한 |
|------|-----|------|------|
| TTS | Edge-TTS (edge-tts npm) | 무료 | 음성 클론 불가, 6개 프리셋 음성 |
| STT | Web Speech API (브라우저) | 무료 | 정확도 중간, 온라인 필요 |
| 이미지 생성 | HuggingFace Inference (무료 티어) | 무료 | 속도 느림, 큐 대기 |

#### Tier 3 (유료 — 사용자 API 키)

| 기능 | API | 비용 | 품질 |
|------|-----|------|------|
| TTS | ElevenLabs | ~$5/월~ | 상용 최고 |
| STT | OpenAI Whisper API | $0.006/분 | 최고 |
| 이미지 | Stability AI / DALL-E | 사용량 비례 | 상 |
| 영상 | Runway Gen-4 / Replicate | 사용량 비례 | 최고 |

사용자가 설정(S07)에서 API 키를 입력하면 해당 Tier 3 엔진이 활성화된다.

---

## 4. AI 엔진 플러그인 인터페이스 (설계 방향)

모든 AI 기능은 통일된 인터페이스를 따른다.
Tier 1/2/3 어디서 처리되든 프론트엔드 코드는 동일하다.

```typescript
// src/types/aiEngine.ts

interface TTSEngine {
  name: string;
  tier: 'local' | 'free' | 'paid';
  isAvailable(): Promise<boolean>;
  generate(text: string, options: TTSOptions): Promise<AudioBlob>;
  getVoices(lang: string): Promise<Voice[]>;
}

interface STTEngine {
  name: string;
  tier: 'local' | 'free' | 'paid';
  isAvailable(): Promise<boolean>;
  transcribe(audio: AudioBlob, lang: string): Promise<SubtitleSegment[]>;
}

interface ImageGenEngine {
  name: string;
  tier: 'local' | 'free' | 'paid';
  isAvailable(): Promise<boolean>;
  generate(prompt: string, options: ImageGenOptions): Promise<ImageBlob>;
}

// 엔진 매니저 — 설정에 따라 최적 Tier 자동 선택
interface AIEngineManager {
  tts: TTSEngine;       // 현재 활성 TTS 엔진
  stt: STTEngine;       // 현재 활성 STT 엔진
  imageGen: ImageGenEngine;
  
  detectLocalGPU(): Promise<GPUInfo | null>;
  selectBestEngine(category: string): void; // GPU 있으면 Tier1, 없으면 Tier2
}
5. 파일 위치 규칙
구분	위치	설명
기본 편집 코드	src/ (ai-studio 리포)	TypeScript, B1~B10
AI 엔진 인터페이스	src/types/aiEngine.ts	위 인터페이스 정의
AI 엔진 구현 (Tier 1)	src/engines/local/	Electron child_process 래퍼
AI 엔진 구현 (Tier 2)	src/engines/free/	Edge-TTS, Web Speech 등
AI 엔진 구현 (Tier 3)	src/engines/paid/	API 키 기반 외부 호출
이전 프로젝트 참고 원본	https://github.com/hoonoh57/aivideostudio	Python, 읽기 전용 참고
GPT-SoVITS 런타임	별도 설치 또는 번들	사용자 PC 로컬
ComfyUI 런타임	별도 설치 또는 번들	사용자 PC 로컬
6. 세션 전환 시 읽어야 할 문서 (우선순위)
새 세션이 시작되면 아래 순서로 읽으면 전체 맥락을 파악할 수 있다.

이 문서 (docs/EXPANSION_PLAN.md) — 아키텍처 결정, 자산 위치, 통합 계획
docs/BASELINE_FEATURES.md — 기본기 B1~B10 상세 스펙 + 경쟁사 비교
docs/ARCHITECTURE_V3.md — 현재 코드 구조, 컴포넌트 트리, 상태 관리
docs/ARCHITECTURE_CONSTITUTION.md — 코딩 규칙, 네이밍, 파일 제한
이전 프로젝트: https://github.com/hoonoh57/aivideostudio — 필요 시에만 참고
7. 현재 상태 및 다음 단계
현재: Phase 1 (기본기 B1~B10) 착수 전
다음: B1 오디오 재생 + B2 편집 기본 동작 병행 코딩 시작
Phase 2~4는 B1~B10 완료 후 순차 진행
변경 이력
날짜	내용
2026-03-28	최초 작성. 선택지 A 확정, 3-Tier AI 엔진 구조, 이전 자산 매핑, Phase 1~4 계획