# BadaCut B4 텍스트/자막 프로젝트 계획
# docs/TEXT_PROJECT.md
# 작성: 2026-03-28
# 이 문서는 B4 자막/텍스트 기능의 경쟁사 분석, 능가 전략, 타입 설계,
# 구현 계획, AI 연동 준비를 포함한 완전한 설계 문서이다.

---

## 문서 목적

B4(자막/텍스트)는 영상 편집기의 핵심 기능이다.
유튜브/쇼츠/릴스 편집에서 자막 없이는 실사용이 불가능하며,
경쟁사 4종 모두 AI 자동화까지 탑재한 상태이다.

이 문서는:
1. 경쟁사 4종의 텍스트 기능을 심층 분석한다.
2. 각 경쟁사의 강점과 약점을 식별한다.
3. BadaCut이 동급을 넘어 능가할 전략을 수립한다.
4. EXPANSION_PLAN.md의 3-Tier AI 엔진과의 연동을 설계한다.
5. 이전 프로젝트(aivideostudio) 자산 활용 방안을 명시한다.
6. 타입 설계, 파일 구조, 구현 순서를 확정한다.

---

## 1. 경쟁사 심층 분석

### 1-1. CapCut Desktop (쇼츠/릴스 시장 1위)

#### 강점
- **AI 자동 자막 (Auto Captions)**: 원클릭으로 음성→자막 변환. 다국어 지원
- **단어별 하이라이트 (Word-by-Word Highlight)**: 말하는 단어에 맞춰 색상/크기/효과가 실시간 변화. 쇼츠 조회수 직접 영향을 주는 킬러 기능
- **동적 자막 (Dynamic Captions)**: 단어가 튀어나오고, 흔들리고, 강조되는 모션 프리셋
- **자막 스타일 프리셋 100종+**: 유튜브/틱톡/인스타 각 플랫폼 최적화
- **노래방 자막**: 가사 자동 싱크 + 단어별 진행 표시

#### 약점 (BadaCut이 파고들 틈)
- 커스텀 폰트 제한 — 시스템 폰트 사용 불가, 내장 폰트만
- 세밀한 타이밍 미세조정 불편 — 단어별 경계를 수동으로 조절하기 어려움
- 프로젝트 복잡도 올라가면 성능 저하
- Pro 구독 없으면 워터마크
- 일괄 스타일 변경 기능 없음 — 자막 100개 스타일을 하나씩 수정해야 함

### 1-2. DaVinci Resolve 20 (전문가 시장)

#### 강점
- **AI Animated Subtitles (Studio)**: STT로 자막 생성 후 Fusion 타이틀 템플릿으로 워드별 애니메이션 자동 적용
- **Text+ / MultiText**: 무한 텍스트 레이어, 개별 스타일 파라미터, 레이아웃(포인트/텍스트박스/원형/패스), 워핑, 키프레임
- **Fusion 통합**: 노드 기반으로 텍스트에 어떤 효과든 적용 가능
- **무료 버전에서도 기본 자막 기능 제공**

#### 약점
- AI Animated Subtitles는 Studio 전용 ($295)
- Fusion 학습 곡선 극심 — 자막 하나 커스텀하는데 노드 그래프 편집 필요
- 자막 애니메이션 커스텀 옵션 아직 제한적 (Reddit 사용자 불만)
- 초보자에게 비친화적

### 1-3. Premiere Pro (구독형 업계 표준)

#### 강점
- **Speech-to-Text**: AI 자동 전사 → 캡션 트랙 자동 생성
- **Essential Graphics Panel**: 체계적 텍스트 스타일링
- **MOGRT 템플릿**: After Effects급 텍스트 애니메이션을 Premiere에서 사용
- **다국어 캡션 워크플로**: 전문 자막 제작 파이프라인

#### 약점
- 월 구독 비용 ($22.99/월)
- 워드별 하이라이트가 네이티브 미지원 — MOGRT를 별도 구매해야 함
- STT 정확도 간혹 불안정
- 캡션 일괄 스타일 변경 번거로움

### 1-4. Descript (텍스트 기반 편집)

#### 강점
- **"텍스트를 편집하면 영상이 편집된다"** — 전사 기반 편집의 원조
- 워드별 타이밍 자동 정렬
- 편집 시간 60~70% 단축 (음성 기반 콘텐츠)
- Studio Sound (AI 노이즈 제거)

#### 약점
- 전통적 타임라인 편집 불편
- 이펙트/색보정 거의 없음
- 자막 디자인 자유도 낮음 — 스타일 프리셋 극히 제한
- 복잡한 영상 편집에는 부적합

### 1-5. 경쟁사 공통 약점 요약

| 약점 | CapCut | DaVinci | Premiere | Descript | BadaCut 전략 |
|------|--------|---------|----------|----------|-------------|
| 워드별 타이밍 미세조정 | 불편 | Fusion 필요 | MOGRT 필요 | 가능 | 타임라인에서 드래그로 단어 경계 조절 |
| 일괄 스타일 변경 | ❌ | ❌ | 번거로움 | ❌ | "전체 적용" 원클릭 버튼 |
| 자막→다국어 번역 | ❌ | ❌ | ❌ | ❌ | AI 번역 연동 (Phase 3/4) |
| 자막 자동 위치 배치 | ❌ | ❌ | ❌ | ❌ | 피사체 감지 기반 (Phase 3) |
| 오프라인 AI 자막 | 서버 의존 | Studio 전용 | 서버 의존 | 서버 의존 | 로컬 Whisper (Tier 1) |
| 무료+고품질 TTS | ❌ | ❌ | ❌ | ❌ | GPT-SoVITS 로컬 (Tier 1) |

---

## 2. BadaCut B4 능가 전략 — 3단계 설계

### 2-1. 1단계: CapCut 동급 (기본기 확보)

| ID | 기능 | 설명 | 완료 기준 |
|----|------|------|----------|
| B4-1 | SRT/VTT 파서 | SRT/VTT 가져오기·내보내기. 파싱 후 텍스트 트랙에 클립 자동 생성. ASS 변환 함수 포함 (B7 Export 대비) | SRT 파일 드래그 → 자막 클립 생성 확인 |
| B4-2 | Canvas 텍스트 렌더링 | 멀티라인, 폰트/크기/색/외곽선/그림자/배경박스를 Canvas 2D로 렌더링 | 프리뷰에서 텍스트 오버레이 표시 확인 |
| B4-3 | 텍스트 스타일 편집기 | 폰트, 크기, 색상, 외곽선(색+두께), 그림자(색+블러+오프셋), 배경박스, 위치(%, 드래그) | 각 속성 변경 시 실시간 프리뷰 반영 |
| B4-4 | 자막 프리셋 20종 | CapCut 인기 스타일 벤치마크 기반 | 프리셋 클릭 → 스타일 즉시 적용 |
| B4-5 | 텍스트 패널 UI | 아이콘바 "T" 클릭 시 전용 패널 | 텍스트 추가/편집/프리셋/SRT 기능 작동 |
| B4-6 | 텍스트 애니메이션 13종 | fade-in/out, typewriter, slide(4방향), scale-in, bounce-in, blur-in, rotate-in, glitch-in | 각 애니메이션 프리뷰에서 동작 확인 |

### 2-2. 2단계: CapCut 능가 (차별화 킬러 기능)

| ID | 기능 | 설명 | 경쟁사 대비 우위 |
|----|------|------|-----------------|
| B4-7 | 워드별 하이라이트 자막 | WordTiming[] 구조로 단어별 시작/끝 타이밍 저장. Canvas에서 현재 시간의 단어만 색상/크기/효과 변경 | CapCut 동급이되 타이밍 미세조정이 타임라인에서 드래그로 가능 |
| B4-8 | 일괄 스타일 변경 | 텍스트 트랙의 모든 자막 클립에 스타일 원클릭 일괄 적용 | 경쟁사 전원 미지원 — BadaCut 독자 기능 |
| B4-9 | 프리뷰 내 텍스트 드래그 배치 | Canvas 프리뷰에서 텍스트를 직접 드래그하여 위치 조절. positionX/Y 실시간 반영 | Premiere Essential Graphics 수준, CapCut보다 직관적 |
| B4-10 | 텍스트 키프레임 애니메이션 | 기존 키프레임 시스템(x, y, scale, rotation, opacity)을 텍스트 클립에도 적용 | DaVinci Fusion급이되 진입 장벽 낮음 |

### 2-3. 3단계: 업계 최초 (AI 자동화 — EXPANSION_PLAN Phase 3/4)

※ 3단계는 Electron 전환 후 구현. 1~2단계에서 데이터 구조와 UI 자리를 미리 설계한다.

| ID | 기능 | 3-Tier 엔진 | 경쟁사 대비 우위 |
|----|------|-------------|-----------------|
| B4-11 | AI 자동 자막 (STT) | Tier 1: Whisper (로컬 GPU, word_timestamps=True) / Tier 2: Web Speech API / Tier 3: OpenAI Whisper API | 오프라인 로컬 처리 가능 (CapCut은 서버 의존) |
| B4-12 | AI 자막 번역 | Tier 2: 무료 번역 API / Tier 3: DeepL, GPT-4 | 업계 어떤 편집기도 네이티브 미내장 |
| B4-13 | AI 자막 위치 자동 배치 | Tier 1: YOLO/SAM 피사체 감지 → 자막 회피 배치 | 업계 전무 |
| B4-14 | 텍스트→음성 (TTS) | Tier 1: GPT-SoVITS (로컬, 음성 클론) / Tier 2: Edge-TTS (무료) / Tier 3: ElevenLabs | CapCut TTS보다 음성 품질 우수 (로컬 GPU) |

---

## 3. 이전 프로젝트 자산 활용 (aivideostudio)

EXPANSION_PLAN.md §2에 명시된 자산 중 B4에 직접 관련된 항목:

### 3-1. subtitle_engine.py (5.4KB)

| 내용 | B4 활용 |
|------|---------|
| FFmpeg 오디오 추출 → Whisper subprocess → JSON segments | Phase 3 B4-11에서 Electron child_process로 동일 흐름 구현 |
| JSON segments → pysubs2 ASS/SRT 변환 | srtParser.ts의 ASS 변환 함수 설계 시 알고리즘 참고 |
| style_to_ass_tags() (ASS 스타일 태그 생성기) | textStyleToAssStyle() 함수의 직접 참고 원본 |

### 3-2. whisper_worker.py (1.0KB)

| 내용 | B4 활용 |
|------|---------|
| CUDA 자동 감지, fp16 가속 | Phase 3에서 Electron child_process로 그대로 호출 |
| word_timestamps=True 출력 포맷 | WordTiming 인터페이스가 이 출력과 1:1 대응하도록 설계 |

### 3-3. tts_engine.py (5.4KB)

| 내용 | B4 활용 |
|------|---------|
| EdgeTTSEngine (edge-tts 비동기) | Phase 4 Tier 2 TTS 구현 시 로직 포팅 |
| SoVITSEngine (localhost:9880 HTTP API) | Phase 3 Tier 1 TTS 구현 시 API 규격 참고 |

### 3-4. Whisper 출력 포맷 (word_timestamps)

WordTiming 인터페이스가 정확히 대응해야 하는 Whisper JSON 구조:

```json
{
  "text": "안녕하세요 반갑습니다",
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 2.5,
      "text": "안녕하세요 반갑습니다",
      "words": [
        { "word": "안녕하세요", "start": 0.0, "end": 1.1, "probability": 0.95 },
        { "word": "반갑습니다", "start": 1.2, "end": 2.5, "probability": 0.92 }
      ]
    }
  ]
}
Copy
4. 타입 설계
4-1. src/types/textClip.ts (신규)
Copy/** Whisper word_timestamps 출력과 1:1 대응 */
export interface WordTiming {
  word: string;
  startTime: number;    // 클립 내 상대 시간 (초)
  endTime: number;
  confidence?: number;  // Whisper probability — Phase 3에서 자동 채움
}

/** STT 엔진 출력 세그먼트 — aiEngine.ts SubtitleSegment와 동일 구조 */
export interface SubtitleSegment {
  text: string;
  startTime: number;
  endTime: number;
  words?: WordTiming[];
  language?: string;
}

export type TextAnimation =
  | 'none'
  | 'fade-in' | 'fade-out'
  | 'typewriter'
  | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right'
  | 'scale-in' | 'bounce-in' | 'blur-in'
  | 'rotate-in' | 'glitch-in';

export interface TextStyle {
  fontFamily: string;        // 'Noto Sans KR', 'Arial', ...
  fontSize: number;          // px 단위
  fontWeight: number;        // 400, 700, 900
  fontStyle: 'normal' | 'italic';
  color: string;             // '#FFFFFF'
  backgroundColor: string;   // 'transparent' 또는 '#000000CC'
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  // 외곽선
  strokeColor: string;       // '#000000'
  strokeWidth: number;       // 0 = 없음
  // 그림자
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  // 위치 (캔버스 % 기준, 0~100)
  positionX: number;         // 50 = 가운데
  positionY: number;         // 85 = 하단 자막 위치
  // 애니메이션
  animation: TextAnimation;
  animationDuration: number; // 초 단위
  // B4-7: 워드 하이라이트 설정
  highlightColor?: string;   // 활성 단어 강조 색상
  highlightScale?: number;   // 1.0 = 기본, 1.3 = 30% 확대
}

export interface TextContent {
  text: string;
  style: TextStyle;
  wordTimings?: WordTiming[];   // B4-7: 단어별 타이밍
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Noto Sans KR, sans-serif',
  fontSize: 48,
  fontWeight: 700,
  fontStyle: 'normal',
  color: '#FFFFFF',
  backgroundColor: 'transparent',
  textAlign: 'center',
  verticalAlign: 'bottom',
  strokeColor: '#000000',
  strokeWidth: 2,
  shadowColor: 'rgba(0,0,0,0.5)',
  shadowBlur: 4,
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  positionX: 50,
  positionY: 85,
  animation: 'none',
  animationDuration: 0.3,
  highlightColor: '#FFFF00',
  highlightScale: 1.2,
};
Copy
4-2. src/types/project.ts (수정)
Clip 인터페이스에 추가:

Copyimport type { TextContent } from './textClip';

export interface Clip {
  // ... 기존 필드 ...

  /** ★ B4: 텍스트 클립 콘텐츠 (text 트랙 전용) */
  textContent?: TextContent;
}
5. 파일 구조
신규 생성 (4개)
파일	용도
src/types/textClip.ts	텍스트 타입 정의 (WordTiming, SubtitleSegment, TextStyle, TextContent, TextAnimation)
src/lib/core/srtParser.ts	SRT/VTT 파싱·생성·다운로드, ASS 변환 함수, SubtitleSegment 변환
src/lib/core/subtitlePresets.ts	자막 스타일 프리셋 20종
src/components/Panels/TextPanel.tsx	텍스트 전용 편집 패널 UI
기존 수정 (3개)
파일	수정 내용
src/types/project.ts	Clip에 textContent?: TextContent 추가
src/stores/editorStore.ts	addTextClip, updateTextContent, updateTextStyle, importSrt, exportSrt, importSubtitleSegments, applyStyleToAllTextClips
src/components/Preview/PreviewArea.tsx	텍스트 오버레이 렌더링 + 워드별 하이라이트 + 애니메이션 13종
6. 핵심 구현 설계
6-1. SRT 파서 (src/lib/core/srtParser.ts)
Copyexport interface SrtEntry {
  index: number;
  startTime: number;   // 초
  endTime: number;      // 초
  text: string;
  words?: WordTiming[]; // Phase 3: Whisper 출력에서 자동 채움
}

// 핵심 함수:
// parseSrt(srtText: string): SrtEntry[]
// generateSrt(entries: SrtEntry[]): string
// downloadSrt(entries: SrtEntry[], filename?: string): void
// toAssEvent(entry: SrtEntry, styleName?: string): string
// textStyleToAssStyle(style: TextStyle, name?: string): string
// segmentsToSrtEntries(segments: SubtitleSegment[]): SrtEntry[]
6-2. 자막 프리셋 20종 (src/lib/core/subtitlePresets.ts)
#	이름	대상 플랫폼	핵심 스타일
1	유튜브 기본	YouTube	흰색, 검정 배경박스, 하단
2	쇼츠 굵은 자막	YouTube Shorts	노란색 64px, 두꺼운 외곽선, 중앙
3	미니멀 화이트	범용	흰색 36px, 효과 없음, 하단
4	네온 글로우	게임/음악	초록 네온, 발광 그림자
5	시네마틱	영화/단편	이탤릭, 연회색, 그림자
6	뉴스 하단바	뉴스/정보	파란 배경, 좌측 정렬
7	코믹 팝	예능/개그	핑크, 두꺼운 흰색 외곽선, 드롭쉐도우
8	노래방	뮤직비디오	금색, 갈색 외곽선, 검정 배경
9	인스타 스토리	Instagram	흰색, 약한 그림자, 중앙
10	레트로 VHS	복고풍	Courier, 초록, 약한 발광
11	틱톡 트렌디	TikTok	노란+흰색, 외곽선, 큰 글씨
12	다큐멘터리	다큐/인터뷰	얇은 흰색, 미니멀, 하단
13	하이라이트 팝	스포츠/하이라이트	빨간 강조, 굵은 외곽선
14	교육 칠판	교육/강의	손글씨 느낌, 노란색
15	글리치 사이버	테크/사이버펑크	시안+마젠타, 글리치 애니메이션
16	일본 애니	애니/서브컬처	흰색+빨간 외곽선, 진한 그림자
17	패션 미니멀	패션/뷰티	흰색, 극세 폰트, 큰 자간
18	공포	공포/미스터리	빨간, 불규칙 그림자, 어두운 배경
19	키즈 컬러풀	아동/가족	무지개색, 둥근 폰트, 큰 글씨
20	브이로그 손글씨	브이로그/일상	손글씨 폰트, 약한 회전, 자연스러운 위치
6-3. Canvas 텍스트 렌더링 (PreviewArea.tsx)
렌더링 파이프라인:

비디오 클립 그리기 (기존)
텍스트 트랙 오버레이 (B4 신규 — 비디오 위에 레이어링) a. 텍스트 트랙 순회 (visible && !muted) b. 현재 시간에 활성인 텍스트 클립 찾기 c. 애니메이션 계산 (진입/퇴장) d. 워드별 하이라이트 처리 (wordTimings 존재 시) e. 폰트/외곽선/그림자/배경박스 Canvas 2D 렌더링
6-4. 워드별 하이라이트 렌더링 로직
wordTimings 존재 시:
  각 단어를 개별 측정 (measureText)
  현재 시간에 해당하는 단어 식별 (startTime ≤ relTime < endTime)
  활성 단어: highlightColor + highlightScale 적용
  비활성 단어: 기본 스타일
  단어 간 간격 유지하며 순차 렌더링
6-5. editorStore 추가 액션
Copy// B4 텍스트 클립 관리
addTextClip: (trackId: string, text: string, startTime: number,
              duration?: number, style?: Partial<TextStyle>) => void;
updateTextContent: (clipId: string, text: string) => void;
updateTextStyle: (clipId: string, stylePatch: Partial<TextStyle>) => void;
importSrt: (entries: SrtEntry[]) => void;
exportSrt: () => SrtEntry[];

// B4-8: 일괄 스타일 변경
applyStyleToAllTextClips: (stylePatch: Partial<TextStyle>) => void;

// Phase 3 준비: STT 엔진 결과 수용
importSubtitleSegments: (segments: SubtitleSegment[]) => void;
6-6. TextPanel UI 구조
┌─────────────────────────────────┐
│ [✚ 텍스트 추가] [📥 SRT] [📤 SRT] │  ← 상단 액션 버튼
├─────────────────────────────────┤
│ 프리셋 그리드 (4열 × 5행 = 20종) │  ← 클릭 시 스타일 적용
│ [📺유튜브][📱쇼츠][⬜미니멀]...   │
├─────────────────────────────────┤
│ ── 텍스트 입력 ──               │
│ [textarea: 텍스트를 입력하세요]    │  ← 선택된 텍스트 클립 편집
├─────────────────────────────────┤
│ ── 스타일 편집 ──               │
│ 폰트: [Noto Sans KR ▼]         │
│ 크기: [48] 굵기: [700]          │
│ 색상: [■ #FFF] 배경: [■ 투명]   │
│ 외곽선: [■ #000] 두께: [2]      │
│ 그림자: [■ 반투명] 블러: [4]    │
│ 위치X: [━━━●━━ 50%]            │
│ 위치Y: [━━━━━●━ 85%]           │
│ 애니메이션: [fade-in ▼]         │
│ [🎨 전체 자막에 적용]           │  ← B4-8 일괄 변경
├─────────────────────────────────┤
│ ── AI 기능 (Phase 3/4) ──      │  ← 비활성 상태 표시
│ [🎤 AI 자동 자막] (준비 중)      │
│ [🌐 AI 번역] (준비 중)          │
│ [🔊 AI 음성 생성] (준비 중)     │
└─────────────────────────────────┘
7. AI 엔진 연동 설계 (Phase 3/4 준비)
7-1. STT → 자막 파이프라인
STTEngine.transcribe(audio, lang)
  ↓ SubtitleSegment[] (words[] 포함)
segmentsToSrtEntries(segments)
  ↓ SrtEntry[] (words → WordTiming[] 매핑)
importSrt(entries)
  ↓ 텍스트 트랙에 자막 클립 생성
  ↓ 각 클립의 textContent.wordTimings 자동 설정
  ↓ 워드별 하이라이트 즉시 동작
7-2. TTS → 오디오 파이프라인
TTSEngine.generate(text, options)
  ↓ AudioBlob (WAV)
URL.createObjectURL(blob)
  ↓ 오디오 에셋으로 addAsset
addClipFromAsset(assetId, audioTrackId, startTime)
  ↓ 오디오 트랙에 클립 생성
7-3. 번역 파이프라인
exportSrt()
  ↓ SrtEntry[] (원문)
TranslateEngine.translate(entries, targetLang)
  ↓ SrtEntry[] (번역문)
importSrt(translatedEntries)  // 별도 텍스트 트랙에 배치
7-4. TextPanel AI 버튼 활성화 조건
Copy// AIEngineManager가 해당 엔진의 isAvailable()을 확인
// true → 버튼 활성화 + 기능 동작
// false → 버튼 비활성(회색) + "AI 엔진 설정 필요" 툴팁
const sttAvailable = await aiEngineManager.stt.isAvailable();
const ttsAvailable = await aiEngineManager.tts.isAvailable();
8. 구현 순서
순서	태스크	파일	규모	의존성
1	textClip.ts 타입 정의	신규	소	없음
2	project.ts Clip 확장	수정	소	순서 1
3	srtParser.ts 파서+ASS 변환	신규	중	순서 1
4	editorStore.ts 액션 추가	수정	중	순서 1, 2
5	PreviewArea.tsx 텍스트 렌더링	수정	대	순서 1, 2
6	subtitlePresets.ts 프리셋 20종	신규	소	순서 1
7	TextPanel.tsx 패널 UI	신규	대	순서 1~6 전체
8	워드별 하이라이트 (B4-7)	PreviewArea + TextPanel 수정	대	순서 5, 7
9	일괄 스타일 변경 (B4-8)	editorStore 수정	소	순서 4
10	프리뷰 드래그 배치 (B4-9)	PreviewArea 수정	중	순서 5
11	텍스트 키프레임 (B4-10)	기존 키프레임 시스템 연결	중	순서 5
9. 완료 기준
각 태스크는 아래 3개를 모두 충족해야 완료:

기능이 실제 동작 — UI + 로직 + Canvas 렌더링
기존 기능과 충돌 없음 — 비디오/오디오 클립, 키프레임, 이펙트 정상 동작
CapCut 사용자가 "이거 되네" 수준의 완성도 — 프리셋 적용, 애니메이션, SRT 임포트 매끄러움
능가 기준 (2단계 완료 시)
CapCut에 없는 일괄 스타일 변경이 동작한다
워드별 하이라이트의 타이밍을 타임라인에서 드래그로 조절할 수 있다
프리뷰에서 텍스트를 직접 드래그하여 위치를 조절할 수 있다
텍스트 클립에 키프레임 애니메이션을 적용할 수 있다
10. B4 완료 후 다음 단계
B4 완료 → B7(내보내기) 착수

B7에서 B4 자산 활용:

srtParser.ts의 toAssEvent() / textStyleToAssStyle() → 자막 번인 (burn-in)
PreviewArea의 텍스트 렌더링 로직 → Export 프레임 캡처 시 텍스트 포함
변경 이력
날짜	내용
2026-03-28	최초 작성. 경쟁사 4종 심층 분석, 3단계 능가 전략, EXPANSION_PLAN 연동, 타입 설계, 구현 순서 확정