# 06_CODING_STANDARD.md — AI‑Studio 코딩 표준서

| 항목 | 값 |
|------|-----|
| 문서 ID | DOC-06 |
| 버전 | 2.0.0 |
| 상태 | APPROVED |
| 작성일 | 2026-03-26 |
| 최종 수정 | 2026-03-26 |
| 승인자 | Project Owner |
| 적용 범위 | 전체 모듈 (M01–M30) |

> **이 문서는 프로젝트 헌법이다.**
> 모든 모듈, 모든 코딩 에이전트, 모든 리뷰어는 이 문서의 규칙을 예외 없이 준수해야 한다.
> 위반 코드는 머지 불가하며, 예외 요청은 반드시 문서화·승인 절차를 거친다.

---

## 목차

1. [기술 스택](#1-기술-스택)
2. [파일·함수 크기 제한](#2-파일함수-크기-제한)
3. [디렉터리 구조 규칙](#3-디렉터리-구조-규칙)
4. [불변·가변 레이어 분리 원칙](#4-불변가변-레이어-분리-원칙)
5. [공통 유틸리티 (Core Functions)](#5-공통-유틸리티-core-functions)
6. [네이밍 규칙](#6-네이밍-규칙)
7. [TypeScript 엄격 규칙](#7-typescript-엄격-규칙)
8. [React 컴포넌트 규칙](#8-react-컴포넌트-규칙)
9. [Zustand 상태 관리 규칙](#9-zustand-상태-관리-규칙)
10. [스타일링 규칙](#10-스타일링-규칙)
11. [import 순서 규칙](#11-import-순서-규칙)
12. [에러 처리 패턴](#12-에러-처리-패턴)
13. [테스트 규칙](#13-테스트-규칙)
14. [성능 규칙](#14-성능-규칙)
15. [Git 규칙](#15-git-규칙)
16. [문서화 규칙](#16-문서화-규칙)
17. [금지 패턴 (Blacklist)](#17-금지-패턴-blacklist)
18. [필수 패턴 (Whitelist)](#18-필수-패턴-whitelist)
19. [코드 리뷰 체크리스트](#19-코드-리뷰-체크리스트)
20. [예외 처리 절차](#20-예외-처리-절차)

---

## 1. 기술 스택

| 분류 | 기술 | 버전 | 비고 |
|------|------|------|------|
| 언어 | TypeScript | ≥ 5.5 | strict 모드 필수 |
| 런타임 | Node.js | ≥ 20 LTS | ESM only |
| 프레임워크 | React | ≥ 19 | 함수 컴포넌트 only |
| 빌드 | Vite | ≥ 6 | SWC 트랜스파일러 |
| 상태 관리 | Zustand | ≥ 5 | Immer 미들웨어 허용 |
| 스타일 | CSS Modules + CSS Variables | — | 인라인 스타일 금지 |
| 테스트 | Vitest + React Testing Library | — | Storybook 연동 |
| 린트 | ESLint (flat config) + Prettier | — | 경고 0 정책 |
| GPU | WebGPU + WGSL | — | WebGL 폴백 |
| 오디오 | Web Audio API | — | AudioWorklet 사용 |
| 데스크톱 | Electron | ≥ 33 | 선택적 |
| AI 런타임 | ONNX Runtime Web / ComfyUI | — | 로컬 우선 |
| 미디어 | FFmpeg (WASM) / Rust (Tauri) | — | 선택적 |

---

## 2. 파일·함수 크기 제한

| 대상 | 상한 | 강도 | 초과 시 조치 |
|------|------|------|-------------|
| 파일당 줄 수 (빈 줄·주석 포함) | **300줄** | HARD | 즉시 분할, 머지 거부 |
| 함수·메서드당 줄 수 | **40줄** | HARD | 헬퍼 함수로 추출 |
| React 컴포넌트당 줄 수 (JSX 포함) | **200줄** | HARD | 하위 컴포넌트 분리 |
| 파일당 named export 수 | **10개** | SOFT | 초과 시 index.ts 배럴 분리 |
| 컴포넌트 props 수 | **8개** | SOFT | 초과 시 합성 객체 또는 분리 |
| 함수 매개변수 수 | **5개** | SOFT | 초과 시 옵션 객체 패턴 |
| 중첩 깊이 (if/for/callback) | **3단계** | HARD | Early return / 함수 추출 |
| 사이클로매틱 복잡도 | **10** | HARD | ESLint complexity 규칙 적용 |

> **근거**: 300줄 = AI 에이전트 컨텍스트 윈도우 최적화 + 인간 코드 리뷰 1회 집중 가능 범위.
> 40줄 함수 = 단일 책임 원칙(SRP) + 테스트 용이성.

---

## 3. 디렉터리 구조 규칙

Copy
C:\ai-studio\src
├── lib/ # 로직 레이어 (UI 무관) │ ├── core/ # ★ 불변 레이어 (순수 함수만) │ │ ├── time.ts # 타임코드 변환, 프레임↔초, 스냅 │ │ ├── math.ts # clamp, lerp, bezier, matrix │ │ ├── format.ts # 파일 크기, 해상도, 코덱 표시 │ │ ├── validation.ts # 프로젝트/클립/트랙 유효성 │ │ ├── id.ts # UID 생성 (nanoid 래퍼) │ │ ├── color.ts # 색상 공간 변환, LUT 계산 │ │ ├── array.ts # 불변 배열 조작 유틸 │ │ ├── string.ts # 문자열 유틸 │ │ ├── errors.ts # 커스텀 에러 클래스 │ │ └── result.ts # Result<T, E> 타입 유틸 │ ├── engine/ # ★ 가변 레이어 (상태 보유) │ │ ├── playback.ts # 재생 엔진 │ │ ├── timeline.ts # 타임라인 연산 엔진 │ │ └── project.ts # 프로젝트 직렬화/역직렬화 │ ├── renderer/ # WebGPU 렌더러 │ ├── audio/ # Web Audio 엔진 │ └── ai/ # AI 라우터, ComfyUI 브릿지 ├── stores/ # ★ 가변 레이어 (Zustand) │ ├── editorStore.ts │ ├── aiCreatorStore.ts │ └── settingsStore.ts ├── types/ # 타입 정의 전용 │ ├── project.types.ts │ ├── timeline.types.ts │ ├── ai.types.ts │ └── index.ts # 배럴 export ├── components/ # UI 컴포넌트 │ ├── common/ # 디자인 시스템 공통 컴포넌트 │ │ ├── Button/ │ │ │ ├── Button.tsx │ │ │ ├── Button.module.css │ │ │ ├── Button.test.tsx │ │ │ └── Button.stories.tsx │ │ └── ... │ ├── Layout/ │ ├── Timeline/ │ ├── Preview/ │ ├── Properties/ │ ├── MediaLibrary/ │ ├── AICreator/ │ └── ... ├── styles/ # 글로벌 스타일 │ ├── tokens.css # 디자인 토큰 (CSS 변수) │ ├── reset.css │ └── global.css ├── hooks/ # 커스텀 훅 ├── constants/ # 프로젝트 상수 ├── App.tsx └── main.tsx


### 디렉터리 규칙

| 규칙 ID | 규칙 | 설명 |
|---------|------|------|
| DIR-01 | 컴포넌트 = 폴더 | 컴포넌트는 반드시 `ComponentName/` 폴더 안에 `.tsx`, `.module.css`, `.test.tsx`, `.stories.tsx` 포함 |
| DIR-02 | 배럴 최소화 | `index.ts` 배럴 파일은 `types/`, `components/common/`에만 허용. 깊은 중첩 re-export 금지 |
| DIR-03 | 타입 분리 | 3개 이상 모듈이 공유하는 타입은 반드시 `src/types/`로 이동 |
| DIR-04 | 테스트 인접 배치 | 테스트 파일은 대상 파일과 같은 폴더에 `*.test.ts(x)` |
| DIR-05 | 순환 참조 금지 | `madge --circular` 검사 통과 필수 |
| DIR-06 | 모듈 경계 | 각 모듈(M01–M30)의 public API는 모듈 루트 `index.ts`를 통해서만 노출 |

---

## 4. 불변·가변 레이어 분리 원칙

이 프로젝트의 **최핵심 아키텍처 규칙**이다.

### 4.1 불변 레이어 (Immutable Layer)

| 속성 | 규칙 |
|------|------|
| 위치 | `src/lib/core/` |
| 허용 | 순수 함수만 (Pure Function) |
| 금지 | 외부 상태 읽기/쓰기, `this`, 클래스, 전역 변수 참조, DOM API, async/await (I/O) |
| 입력 | `Readonly<T>` 타입 또는 원시값 |
| 출력 | 새 객체/배열 반환 (원본 수정 금지) |
| 테스트 | 모든 함수 단위 테스트 필수, 커버리지 **100%** 목표 |

```typescript
// ✅ 올바른 불변 레이어 함수
export function insertClipAt(
  clips: readonly Clip[],
  index: number,
  clip: Clip
): Clip[] {
  return [...clips.slice(0, index), clip, ...clips.slice(index)];
}

// ❌ 잘못된 불변 레이어 함수 (원본 수정)
export function insertClipAt(clips: Clip[], index: number, clip: Clip): void {
  clips.splice(index, 0, clip); // 원본 배열 수정 — 금지
}
4.2 가변 레이어 (Mutable Layer)
속성	규칙
위치	src/stores/, src/lib/engine/, src/lib/renderer/, src/lib/audio/
역할	상태 보유, 외부 리소스 관리 (GPU, Audio, File)
핵심 규칙	데이터 변환 로직을 직접 구현하지 않는다. 반드시 src/lib/core/ 함수를 호출하여 위임한다
테스트	통합 테스트 필수
Copy// ✅ 올바른 가변 레이어 (스토어 액션)
addClip: (trackId, clip) => {
  set((state) => {
    const track = findTrackById(state.project.tracks, trackId);  // core 함수
    if (!track) return state;
    const newClips = insertClipAtTime(track.clips, clip);        // core 함수
    const newTrack = { ...track, clips: newClips };
    const newTracks = replaceItem(state.project.tracks, track, newTrack); // core 함수
    return { project: { ...state.project, tracks: newTracks } };
  });
}

// ❌ 잘못된 가변 레이어 (변환 로직 직접 구현)
addClip: (trackId, clip) => {
  set((state) => {
    const trackIndex = state.project.tracks.findIndex(t => t.id === trackId);
    const newTracks = [...state.project.tracks];
    newTracks[trackIndex] =
요청이 중단되었습니다

계속
계속 작성합니다. 06_CODING_STANDARD.md의 4.2절 코드 예시부터 이어갑니다.

Copy    // ❌ (계속) 잘못된 가변 레이어 — 변환 로직 직접 구현
    const newClips = [...newTracks[trackIndex].clips];
    newClips.push(clip);                                          // 직접 조작 — 금지
    newClips.sort((a, b) => a.startTime - b.startTime);           // 직접 조작 — 금지
    newTracks[trackIndex] = { ...newTracks[trackIndex], clips: newClips };
    return { project: { ...state.project, tracks: newTracks } };
  });
}
4.3 레이어 간 호출 규칙
호출 방향	허용 여부	설명
불변 → 불변	✅ 허용	core 함수 간 합성
가변 → 불변	✅ 허용	데이터 변환 위임 (필수 패턴)
UI → 가변	✅ 허용	스토어 액션 호출, 훅 사용에 한함
UI → 불변	✅ 조건부	표시 포매팅·계산에 한해 직접 호출 허용
불변 → 가변	❌ 금지	순수 함수가 상태에 의존하면 안 됨
가변 → UI	❌ 금지	스토어가 컴포넌트를 import하면 안 됨
UI → UI (교차 모듈)	❌ 금지	반드시 스토어 또는 props를 통해 통신
┌──────────────────────────────────────────────────────┐
│                    UI Components                      │
│  (React, 표시 전용, 액션 호출로 상태 변경 요청)         │
└───────────┬──────────────────┬────────────────────────┘
            │ 액션 호출         │ 포매팅 직접 호출
            ▼                  ▼
┌────────────────────┐  ┌──────────────────────────────┐
│   Mutable Layer    │  │      Immutable Layer         │
│ (Store, Engine,    │──▶ (Core Functions)              │
│  Renderer, Audio)  │  │  순수 함수, 상태 없음          │
│  상태 보유          │  │  테스트 100% 커버리지          │
└────────────────────┘  └──────────────────────────────┘
4.4 이 원칙의 실익
이점	설명
테스트 용이성	불변 함수는 입력→출력만 검증하면 됨. 모킹 불필요
재사용성	어떤 모듈에서든 부작용 없이 import 가능
디버깅	상태 버그 발생 시 가변 레이어만 추적하면 됨
AI 에이전트 호환	에이전트가 300줄 이하 순수 함수를 정확하게 생성할 확률이 높음
향후 확장	불변 함수는 Web Worker, WASM으로 이동 가능
5. 공통 유틸리티 (Core Functions)
5.1 파일 목록 및 책임
파일	책임	예시 함수
time.ts	타임코드 변환, 프레임↔초↔밀리초, 스냅 포인트 계산	framesToTimecode(frames, fps), secondsToFrames(sec, fps), snapToGrid(time, gridSize)
math.ts	수학 유틸, 보간, 행렬	clamp(val, min, max), lerp(a, b, t), cubicBezier(p0,p1,p2,p3,t), mat4Multiply(a,b)
format.ts	사람이 읽을 수 있는 문자열 포매팅	formatFileSize(bytes), formatDuration(seconds), formatResolution(w,h)
validation.ts	데이터 유효성 검증	validateProject(p): Result<Project, ValidationError[]>, validateClip(c), isOverlapping(a,b)
id.ts	고유 ID 생성	generateId(prefix?) — 전체 프로젝트에서 이 함수만 사용
color.ts	색상 공간 변환	rgbToHsl(r,g,b), hslToRgb(h,s,l), applyLut(pixel, lut), hexToRgb(hex)
array.ts	불변 배열 조작	insertAt(arr, idx, item), removeAt(arr, idx), moveItem(arr, from, to), replaceAt(arr, idx, item), reorder(arr, startIdx, endIdx)
string.ts	문자열 유틸	truncate(str, len), sanitizeFileName(name), slugify(str)
errors.ts	커스텀 에러 클래스 정의	AppError, ValidationError, RenderError, MediaError, AIError
result.ts	Result 타입 유틸	ok(data), err(error), isOk(r), isErr(r), unwrap(r), map(r, fn)
5.2 사용 규칙
규칙 ID	규칙
CORE-01	위 파일에 이미 존재하는 기능을 다른 모듈에서 재구현하면 리뷰에서 즉시 거부
CORE-02	새로운 공통 함수 추가 시 docs/modules/M02_SHARED_UTILS.md에 먼저 등록 후 구현
CORE-03	core 함수는 외부 라이브러리 의존 최소화. nanoid(id.ts) 외 외부 의존 금지
CORE-04	모든 core 함수는 JSDoc 주석 필수 (설명, @param, @returns, @example)
CORE-05	core 함수의 시그니처(매개변수 타입, 반환 타입) 변경은 BREAKING CHANGE이며 버전업 + 전체 모듈 영향 분석 필수
6. 네이밍 규칙
6.1 파일 네이밍
파일 종류	규칙	예시	금지 예시
React 컴포넌트	PascalCase.tsx	TimelineTrack.tsx	timeline-track.tsx
유틸/함수	camelCase.ts	timeUtils.ts	TimeUtils.ts
타입 정의	kebab.types.ts	project.types.ts	ProjectTypes.ts
상수	kebab.constants.ts	timeline.constants.ts	TIMELINE_CONSTANTS.ts
테스트	원본명.test.ts(x)	time.test.ts	time.spec.ts
Storybook	원본명.stories.tsx	Button.stories.tsx	button.story.tsx
CSS Module	원본명.module.css	Button.module.css	button.css
훅	use + PascalCase.ts	useTimeline.ts	timeline-hook.ts
6.2 코드 네이밍
대상	규칙	예시	금지 예시
React 컴포넌트	PascalCase	TimelineClip	timelineClip
함수	camelCase + 동사 시작	calculateSnapPoint	snapPoint, SnapPointCalc
상수	UPPER_SNAKE_CASE	MAX_TRACK_COUNT	maxTrackCount
타입/인터페이스	PascalCase (명사)	TimelineTrack	ITimelineTrack, TrackType_T
Enum	PascalCase (단수) + PascalCase 멤버	TrackType.Video	TRACK_TYPE.VIDEO
Zustand 액션	camelCase + 동사	addClipToTrack	clipAdd
이벤트 핸들러 (props)	on + 명사 + 동사	onClipDragStart	handleClipDrag
이벤트 핸들러 (내부)	handle + 명사 + 동사	handleClipDragStart	clipDragStart
boolean 변수/props	is/has/can/should 접두어	isPlaying, hasAudio	playing, audioExists
CSS 변수	--ai-카테고리-이름	--ai-bg-primary	--bgPrimary
CSS Module 클래스	camelCase	styles.trackLabel	styles['track-label']
6.3 금지 네이밍
금지	이유
data, info, item, stuff, temp 단독 사용	의미 없는 이름
약어 (3글자 이하 제외)	btn → button, msg → message, idx/fps/url 허용
숫자 접미사 (handler2, newTrack3)	의미 있는 이름으로 교체
I 접두어 (인터페이스)	TypeScript 커뮤니티 컨벤션 따름
_ 접두어 (private 표시)	TypeScript private 키워드 사용
7. TypeScript 엄격 규칙
7.1 tsconfig.json 필수 옵션
Copy{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,                    // 필수: 모든 strict 계열 활성화
    "noUncheckedIndexedAccess": true,   // 필수: 배열/객체 인덱스 접근 시 undefined 체크
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
7.2 타입 사용 규칙
규칙 ID	규칙	설명
TS-01	any 사용 절대 금지	unknown + 타입 가드 또는 제네릭 사용
TS-02	as 타입 단언 최소화	satisfies 또는 타입 가드 우선
TS-03	! non-null assertion 금지	optional chaining ?. + nullish coalescing ?? 사용
TS-04	enum 대신 const object + as const 권장	tree-shaking 최적화. enum 사용 시 반드시 string enum
TS-05	함수 반환 타입 명시 필수	추론에 의존하지 않음
TS-06	제네릭 타입 변수 이름	단일 문자 T 대신 의미 있는 이름 (TClip, TResult) — 단, 표준 패턴(T, K, V)은 허용
TS-07	Readonly<T> 적극 사용	불변 레이어 함수 매개변수는 반드시 Readonly<> 또는 readonly
TS-08	유니온 타입 분기	switch + exhaustiveCheck 패턴으로 모든 케이스 처리 보장
TS-09	타입 import	import type { X } 사용 필수 (런타임 번들 제외)
8. React 컴포넌트 규칙
규칙 ID	규칙	설명
RC-01	함수 컴포넌트 only	클래스 컴포넌트 금지
RC-02	export default 금지	named export만 사용: export function TimelineTrack()
RC-03	Props 타입은 컴포넌트 파일 상단에 정의	type TimelineTrackProps = { ... }
RC-04	Props 구조분해는 함수 시그니처에서	function Button({ label, onClick }: ButtonProps)
RC-05	조건부 렌더링 패턴	삼항 연산자 (간단한 경우) 또는 early return (복잡한 경우). && 렌더링 시 boolean && 확인 필수
RC-06	이벤트 핸들러	인라인 화살표 함수는 1줄 이하만 허용. 2줄 이상은 handleXxx 함수로 추출
RC-07	useEffect 최소화	데이터 파생은 useMemo, 이벤트 응답은 이벤트 핸들러, 외부 시스템 연동만 useEffect
RC-08	key prop	배열 index를 key로 사용 금지. 고유 식별자 필수
RC-09	React.memo 사용 기준	props가 자주 변하지 않고 렌더링 비용이 높은 컴포넌트만. 무분별한 적용 금지
RC-10	forwardRef 필요 시	ref prop 직접 전달 (React 19). 구버전 패턴 금지
RC-11	컴포넌트 분리 기준	(1) 200줄 초과, (2) 독립적으로 재사용 가능, (3) 독립적으로 테스트 필요 — 하나라도 해당되면 분리
9. Zustand 상태 관리 규칙
규칙 ID	규칙	설명
ZS-01	단일 스토어 원칙	도메인별 스토어 분리 허용 (editor, aiCreator, settings). 교차 참조 시 subscribe 또는 getState()
ZS-02	슬라이스 패턴	스토어가 300줄 초과 시 슬라이스로 분리: createProjectSlice, createPlaybackSlice 등
ZS-03	액션 내 로직	데이터 변환은 반드시 lib/core/ 함수 호출로 위임 (4.2절 참조)
ZS-04	셀렉터 사용 필수	useEditorStore(state => state.project.name) — 전체 스토어 구독 금지
ZS-05	Immer 미들웨어	깊은 중첩 업데이트가 빈번한 스토어에 허용. 사용 시 produce 안에서만 mutation
ZS-06	비동기 액션	async 액션은 로딩/에러/성공 3상태 관리. Result<T,E> 패턴 사용
ZS-07	파생 상태	스토어에 저장하지 않고 셀렉터 또는 useMemo로 계산
ZS-08	구독 (subscribe)	외부 시스템(렌더러, 오디오)과 연동 시 subscribe로 필요한 슬라이스만 감시
10. 스타일링 규칙
규칙 ID	규칙	설명
ST-01	CSS Modules + CSS 변수	모든 컴포넌트 스타일은 *.module.css. 글로벌 스타일은 src/styles/
ST-02	인라인 스타일 금지	style={{ }} 금지. 동적 값은 CSS 변수 (--ai-dynamic-x) 또는 className 조건 분기
ST-03	디자인 토큰 필수	색상, 폰트, 간격, 반경 등 모든 시각 값은 tokens.css의 CSS 변수 사용. 하드코딩 금지
ST-04	매직 넘버 금지	padding: 12px → padding: var(--ai-gap-md)
ST-05	z-index 관리	tokens.css에 z-index 스케일 정의. 임의의 z-index 값 금지
ST-06	다크 모드	모든 색상은 tokens.css의 시맨틱 변수 사용. 라이트/다크 전환은 :root 변수만 교체
ST-07	반응형	패널 크기는 CSS 변수로 정의. 리사이즈 가능 영역은 min-width/max-width 명시
ST-08	애니메이션	prefers-reduced-motion 미디어 쿼리 대응 필수. 트랜지션 시간은 토큰 사용
11. import 순서 규칙
파일 상단의 import문은 아래 7개 그룹 순서를 따르며, 각 그룹 사이에 빈 줄 1개를 삽입한다.

Copy// ① React 및 외부 라이브러리
import { useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

// ② @/lib/core/* 불변 유틸
import { framesToTimecode, snapToGrid } from '@/lib/core/time';
import { clamp } from '@/lib/core/math';

// ③ @/stores/* 스토어
import { useEditorStore } from '@/stores/editorStore';

// ④ @/components/* 컴포넌트
import { IconButton } from '@/components/common/IconButton/IconButton';

// ⑤ @/types/* 타입 (import type 필수)
import type { Clip, Track } from '@/types';

// ⑥ 상대 경로 (같은 모듈 내부)
import { TrackLabel } from './TrackLabel';

// ⑦ 스타일 (항상 마지막)
import styles from './TimelineTrack.module.css';
규칙 ID	규칙
IMP-01	위 순서를 eslint-plugin-import 규칙으로 자동 강제
IMP-02	타입만 import할 때 반드시 import type 사용
IMP-03	와일드카드 import (import * as) 금지 — 유일 예외: 아이콘 네임스페이스
IMP-04	동일 모듈에서 2줄 이상 import 시 import { a, b, c } 병합
12. 에러 처리 패턴
12.1 에러 클래스 체계
Copy// src/lib/core/errors.ts

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class RenderError extends AppError { /* code: 'RENDER_ERROR' */ }
export class MediaError extends AppError { /* code: 'MEDIA_ERROR' */ }
export class AIError extends AppError { /* code: 'AI_ERROR' */ }
export class EngineError extends AppError { /* code: 'ENGINE_ERROR' */ }
12.2 Result 패턴
Copy// src/lib/core/result.ts

export type Result<T, E = AppError> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
12.3 레이어별 에러 처리 규칙
레이어	패턴	설명
불변 (core)	Result<T, E> 반환	예외를 throw하지 않음. 호출자가 결과를 검사
가변 (store/engine)	Result 검사 + 상태 반영	isErr(result) 시 에러 상태 설정
UI (component)	Error Boundary + 토스트	사용자에게 이해 가능한 메시지 표시
엔진 (renderer/audio)	Result + 로깅	GPU/Audio 에러는 폴백 경로 실행
규칙 ID	규칙
ERR-01	불변 레이어에서 throw 금지
ERR-02	try-catch는 함수 최외곽 또는 호출부에서만
ERR-03	catch(e) 시 e를 unknown으로 처리 후 타입 가드
ERR-04	빈 catch 블록 금지 — 최소한 로깅 필수
ERR-05	에러 메시지는 사용자용(한글/영어)과 개발자용(영문 상세) 분리
13. 테스트 규칙
13.1 테스트 도구
도구	용도
Vitest	단위·통합 테스트 러너
React Testing Library	컴포넌트 테스트
Storybook	컴포넌트 시각 카탈로그 + 인터랙션 테스트
Playwright	E2E 테스트 (Phase 4 이후)
MSW (Mock Service Worker)	API 모킹
13.2 커버리지 목표
레이어	커버리지 목표	필수 여부
src/lib/core/*	100%	✅ 필수 — 머지 차단
src/stores/*	90%	✅ 필수 — 머지 차단
src/lib/engine/*	80%	✅ 필수
src/components/*	70%	권장 (Storybook 인터랙션 포함 시)
전체 프로젝트	80%	✅ 필수 — CI 게이트
13.3 테스트 작성 규칙
규칙 ID	규칙
TEST-01	테스트 파일은 대상 파일과 동일 디렉터리에 *.test.ts(x)
TEST-02	describe 블록은 대상 함수/컴포넌트 이름
TEST-03	it 문은 "should + 동사" 형식: it('should return timecode string')
TEST-04	각 테스트는 독립적 — 다른 테스트에 의존 금지
TEST-05	모킹은 최소화 — 불변 레이어는 모킹 불필요
TEST-06	스냅샷 테스트 금지 — 의도가 불명확하고 깨지기 쉬움
TEST-07	컴포넌트 테스트는 사용자 관점 (렌더링 결과, 인터랙션)
TEST-08	매 PR에 대해 vitest run --coverage 통과 필수
13.4 Storybook 규칙
규칙 ID	규칙
SB-01	src/components/common/ 모든 컴포넌트는 .stories.tsx 필수
SB-02	최소 3개 스토리: Default, Disabled/Empty, Edge Case
SB-03	args/argTypes로 props 조작 가능하게
SB-04	스토리 이름은 ComponentName/VariantName 형식
14. 성능 규칙
규칙 ID	규칙	측정 방법	기준
PERF-01	UI 인터랙션 응답	Chrome DevTools Performance	≤ 16ms (60fps)
PERF-02	타임라인 스크롤/줌	requestAnimationFrame 내 측정	≤ 8ms per frame
PERF-03	프리뷰 재생 1080p	FPS 카운터	≥ 30fps (목표 60fps)
PERF-04	프리뷰 재생 4K	FPS 카운터	≥ 24fps
PERF-05	초기 로드 시간	Lighthouse / Web Vitals	≤ 3초
PERF-06	프로젝트 파일 열기 (100 클립)	측정 코드 삽입	≤ 2초
PERF-07	메모리 사용 (1080p 프로젝트)	Chrome Task Manager	≤ 2GB
PERF-08	메모리 사용 (4K 프록시)	Chrome Task Manager	≤ 4GB
PERF-09	번들 크기 (초기 로드)	vite build --report	≤ 500KB gzip
PERF-10	코드 스플리팅	라우트/패널별 lazy load	각 청크 ≤ 200KB gzip
성능 필수 패턴
패턴	적용 위치
React.memo	타임라인 클립, 트랙 컴포넌트
useMemo / useCallback	비용 높은 계산, 자식에 전달하는 핸들러
requestAnimationFrame	타임라인 스크롤, 플레이헤드 이동
Canvas / WebGPU	프리뷰 렌더링 (DOM 렌더링 금지)
Web Worker	미디어 분석, AI 추론 전처리
IntersectionObserver	미디어 라이브러리 가상 스크롤
OffscreenCanvas	썸네일 생성 (메인 스레드 차단 금지)
IndexedDB	프로젝트 저장 (localStorage 금지 — 용량 제한)
15. Git 규칙
15.1 브랜치 전략
브랜치	용도	보호
main	릴리즈 가능 상태	직접 push 금지, PR 필수
develop	통합 개발	PR 필수
feature/M{XX}-{기능명}	모듈별 기능 개발	예: feature/M08-timeline-clip-drag
fix/M{XX}-{버그명}	버그 수정	예: fix/M08-snap-calculation
docs/{문서명}	문서 작업	예: docs/coding-standard
15.2 커밋 메시지
Conventional Commits 형식을 따른다:

<type>(M<XX>): <영문 요약 50자 이내>

[본문: 변경 이유, 상세 설명 (선택)]

[BREAKING CHANGE: 호환 깨지는 변경 설명 (해당 시)]
type	용도
feat	새 기능
fix	버그 수정
refactor	기능 변경 없는 코드 개선
test	테스트 추가/수정
style	포매팅, CSS
docs	문서
perf	성능 개선
chore	빌드, 설정
15.3 PR 규칙
규칙 ID	규칙
PR-01	PR 하나에 하나의 모듈 변경 원칙
PR-02	PR 설명에 관련 문서 ID 명시 (예: "DOC-06, M08")
PR-03	CI 파이프라인 (lint + type-check + test + build) 모두 통과 필수
PR-04	변경된 파일 수 ≤ 20개 (초과 시 분할)
PR-05	새 컴포넌트 PR은 Storybook 스크린샷 첨부
16. 문서화 규칙
규칙 ID	규칙	설명
DOC-01	공개 함수 JSDoc	src/lib/core/*의 모든 export 함수는 JSDoc 필수
DOC-02	JSDoc 형식	@description, @param, @returns, @example, @throws (Result의 경우 에러 타입)
DOC-03	컴포넌트 주석	Props 타입 위에 1–2줄 설명
DOC-04	README	각 모듈 폴더 루트에 README.md (목적, 파일 목록, 사용법)
DOC-05	TODO 금지	// TODO는 커밋하지 않음. 이슈 트래커에 등록
DOC-06	주석 언어	코드 주석은 영문, 문서(md)는 한국어 허용
17. 금지 패턴 (Blacklist)
아래 패턴이 코드에 존재하면 무조건 머지 거부한다.

ID	금지 패턴	대안
BAN-01	any 타입	unknown + 타입 가드, 제네릭
BAN-02	as 타입 단언 (불가피한 경우 제외)	satisfies, 타입 가드
BAN-03	! non-null assertion	?., ??, 조건 분기
BAN-04	console.log / console.warn / console.error	프로젝트 전용 logger 사용
BAN-05	인라인 스타일 style={{ }}	CSS Module + CSS 변수
BAN-06	매직 넘버 (코드 내 리터럴 숫자/색상)	constants.ts 또는 CSS 변수
BAN-07	순환 import	아키텍처 재설계
BAN-08	export default	named export
BAN-09	var 키워드	const (우선), let
BAN-10	eval(), Function()	안전한 대안
BAN-11	document.querySelector in 컴포넌트	useRef
BAN-12	setTimeout/setInterval in 컴포넌트 (정리 없음)	useEffect + cleanup, 또는 requestAnimationFrame
BAN-13	배열 index를 key로 사용	고유 ID
BAN-14	스냅샷 테스트 (toMatchSnapshot)	명시적 assertion
BAN-15	localStorage (대용량 데이터)	IndexedDB
BAN-16	core 함수 재구현 (중복)	@/lib/core/* import
BAN-17	useEffect 내 상태 설정 루프	이벤트 핸들러 또는 useMemo
BAN-18	전역 변수 (window.xxx 할당)	스토어 또는 컨텍스트
18. 필수 패턴 (Whitelist)
아래 패턴이 해당 상황에서 사용되지 않으면 리뷰에서 수정 요청한다.

ID	상황	필수 패턴
REQ-01	불변 레이어 함수	Readonly<T> 매개변수 + 새 객체 반환
REQ-02	불변 레이어 에러	Result<T, E> 반환
REQ-03	스토어 액션 내 데이터 변환	lib/core/* 함수 호출 위임
REQ-04	비동기 작업	로딩/에러/성공 3상태 관리
REQ-05	컴포넌트 렌더링 리스트	key = 고유 ID
REQ-06	외부 리소스 사용	useEffect + cleanup 반환
REQ-07	비용 높은 계산	useMemo + 의존성 배열 명시
REQ-08	자식에 전달하는 핸들러	useCallback + 의존성 배열 명시
REQ-09	boolean props/변수	is/has/can/should 접두어
REQ-10	CSS 시각 값	디자인 토큰 CSS 변수 참조
REQ-11	새 공개 함수	JSDoc 주석
REQ-12	새 core 함수	단위 테스트 100%
REQ-13	새 컴포넌트	Storybook 스토리
19. 코드 리뷰 체크리스트
모든 PR은 아래 체크리스트를 통과해야 한다. 하나라도 미달이면 머지 불가.

[ ] 파일 300줄 제한 준수
[ ] 함수 40줄 제한 준수
[ ] 컴포넌트 200줄 제한 준수
[ ] 중첩 깊이 3단계 이내
[ ] any / as / ! 사용 없음
[ ] console.log 없음
[ ] 인라인 스타일 없음
[ ] 매직 넘버 없음
[ ] 순환 import 없음
[ ] export default 없음
[ ] import 순서 규칙 준수
[ ] 불변·가변 레이어 분리 준수
[ ] core 함수 중복 구현 없음
[ ] 타입 import (import type) 사용
[ ] 함수 반환 타입 명시
[ ] Readonly<T> 매개변수 (core 함수)
[ ] Result<T,E> 패턴 (core 에러)
[ ] JSDoc 주석 (공개 함수)
[ ] 테스트 존재 및 커버리지 기준 충족
[ ] Storybook 스토리 (새 컴포넌트)
[ ] ESLint 경고 0
[ ] TypeScript strict 에러 0
[ ] 빌드 성공
[ ] 커밋 메시지 Conventional Commits 형식
20. 예외 처리 절차
어떤 규칙이든 정당한 사유가 있으면 예외를 신청할 수 있다. 단, 다음 절차를 반드시 따른다.

단계	내용
1. 신청	PR 설명에 EXCEPTION REQUEST: [규칙 ID] 명시
2. 사유	왜 이 규칙을 따를 수 없는지 기술적 근거 작성
3. 범위	예외 적용 범위 (해당 파일/함수만, 또는 모듈 전체)
4. 승인	Project Owner 서면 승인
5. 기록	docs/changelog/EXCEPTIONS.md에 기록
6. 만료	예외는 기본 30일 만료. 연장 시 재승인
부록 A: ESLint Flat Config 핵심 규칙
Copy// eslint.config.js (핵심 규칙 발췌)
export default [
  {
    rules: {
      'no-console': 'error',
      'no-eval': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-nested-ternary': 'error',
      'max-lines': ['error', { max: 300, skipBlankLines: false, skipComments: false }],
      'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', 3],
      'max-params': ['error', 5],
      'complexity': ['error', 10],
      'import/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
        'newlines-between': 'always'
      }],
      'import/no-cycle': 'error',
      'import/no-default-export': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      'react/no-unstable-nested-components': 'error',
      'react/jsx-no-leaked-render': 'error',
    }
  }
];
부록 B: 문서 버전 이력
버전	날짜	변경 내용	작성자
2.0.0	2026-03-26	최초 APPROVED 버전	AI Architect
