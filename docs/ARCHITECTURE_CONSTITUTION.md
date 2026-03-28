# BadaCut 아키텍처 헌법
# docs/ARCHITECTURE_CONSTITUTION.md
# 최초 작성: 2026-03-28
# 이 문서는 모든 개발의 최상위 기준이다. 예외 없다.

---

## 한 줄 정의

BadaCut은 "사용자의 의도만으로 영상이 완성되는" AI 네이티브 편집기다.

---

## 4축 구조 — 이것이 전부다

### 축1. 사용자 가변 (Workspace)
- 사용자는 자기 작업에 맞는 패널 조합을 만들고, 이름 붙여 저장한다.
- SKILL_CONFIGS는 "기본 추천 세트"일 뿐, 사용자 커스텀이 항상 우선한다.
- Workspace = { enabledModules, iconOrder, panelSizes, styleProfile }
- 저장: localStorage → 향후 클라우드 동기화.

### 축2. 통합 설정 (Studio Hub)
- 하나의 모달 다이얼로그가 모든 가변 콘텐츠의 탐색·설정·적용 관문이다.
- 스킬 레벨에 따라 보이는 깊이만 다르다. 구조는 하나다.
- 검색 바 하나로 프리셋, 이펙트, 설정, 도구를 모두 찾는다.
- 좌측 패널의 IconBar 아이템은 Hub에서 "즐겨찾기"한 모듈이다.

### 축3. 무한 확장 (HubModule Registry)
- 새 기능 = HubModule 파일 하나 + registry.register() 한 줄.
- EditorLayout.tsx, IconBar.tsx, TopBar.tsx는 절대 수정하지 않는다.
- 모듈 인터페이스:
  ```typescript
  interface HubModule {
    id: string;
    name: string;
    icon: string;
    category: HubCategory;
    minSkillLevel: SkillLevel;
    render: (props: HubRenderProps) => ReactElement;
    searchKeywords: string[];
    defaultFavorite?: boolean;  // 기본 IconBar 포함 여부
  }
Copy
기존 7개 패널(media, text, audio, effects, ai, sticker, transition)을 모두 HubModule로 래핑한다. 특별한 것은 없다. 동등하다.
축4. AI Director — 핵심 차별화 엔진
편집기 내부에 사는 로컬 AI 에이전트다.
사용자의 자연어 → EditorCommand[] → 기존 시스템 조합 실행.
사용자 편집 패턴을 로컬에서 학습한다. 클라우드 전송 없다.
5개 레이어:
대화 UI: Studio Hub 내 AI 탭. 프롬프트 입력 + 대화 이력.
의도 해석: Local LLM (Ollama). 프롬프트 → Function Call.
실행 계획: Command 시퀀스 생성, 충돌 검증, 미리보기.
명령 실행: editorStore 액션을 직접 호출. 새 코드 아님.
학습 기억: 편집 이력 → 패턴 DB (로컬 SQLite/JSON).
절대 규칙 — 어기면 안 되는 것
R1. 메인 레이아웃 불가침
EditorLayout.tsx의 구조(TopBar → IconBar → LeftPanel → CenterCol → PropertiesPanel)는 기능 추가로 인해 절대 변경하지 않는다. 새 기능은 반드시 HubModule로 등록한다.

R2. 모든 편집 동작은 EditorCommand다
UI에서 직접 store를 호출하더라도, 해당 동작은 EditorCommand로 직렬화 가능해야 한다. 이것이 AI Director의 Function Tool이 되고, undo/redo 스택이 되고, 매크로가 되고, 협업 동기화가 된다.

R3. 스킬 레벨은 "보이는 깊이"만 제어한다
기능 자체를 제거하지 않는다. 숨길 뿐이다. beginner가 advanced 기능의 존재를 모르는 것이지, 없는 것이 아니다. 데이터 구조는 항상 expert 수준으로 유지한다.

R4. AI는 새로운 것을 만들지 않는다
AI Director는 기존 시스템(키프레임, 프리셋, 이펙트, 트랜지션)을 조합하여 실행할 뿐이다. AI만을 위한 별도 렌더링 경로는 없다. AI가 할 수 있는 모든 것은 사용자도 수동으로 할 수 있다.

R5. 프라이버시 로컬 우선
학습 데이터, 스타일 프로필, 편집 이력은 전부 로컬이다. 클라우드 기능은 사용자가 명시적으로 켤 때만 작동한다.

R6. 한 파일 300줄, 한 함수 40줄
기존 CLAUDE.md 코딩 규칙을 그대로 지킨다. 이 문서는 CLAUDE.md를 대체하지 않는다. 상위에서 방향을 잡는다.

파일 구조 — 4축이 코드에 반영되는 위치
src/
├─ components/
│  ├─ Layout/          # [불변] EditorLayout, TopBar, IconBar
│  ├─ Hub/             # [축2] StudioHub 모달, HubSearch, HubSidebar
│  ├─ Preview/         # [불변] PreviewArea
│  ├─ Timeline/        # [불변] TimelinePanel, KeyframeDiamonds
│  ├─ Properties/      # [불변] PropertiesPanel, KeyframePanel
│  └─ modules/         # [축3] 각 HubModule의 UI 컴포넌트
│     ├─ MediaModule/
│     ├─ EffectsModule/
│     ├─ PresetModule/
│     ├─ BRollModule/
│     └─ ...확장 자유
├─ stores/
│  ├─ editorStore.ts   # [불변] 핵심 상태. 모든 액션 = Command 가능
│  └─ hubStore.ts      # [축1+2] Workspace, Hub 상태, 즐겨찾기
├─ engines/
│  ├─ effectRegistry.ts    # [기존] 이펙트 정의·실행
│  ├─ canvasRenderer.ts    # [기존] 캔버스 렌더링
│  ├─ hubRegistry.ts       # [축3] HubModule 등록·검색·관리
│  ├─ commandBridge.ts     # [축4] Store 액션 → Function Tool 노출
│  ├─ aiDirector.ts        # [축4] Ollama 연결, 프롬프트 → Command[]
│  └─ styleMemory.ts       # [축4] 편집 패턴 학습·저장·조회
├─ presets/
│  ├─ builtinPresets.ts    # [완료] 34개 빌트인 프리셋
│  └─ presetEngine.ts      # [완료] CRUD + 적용 + 추천
├─ types/
│  ├─ project.ts           # [기존] Clip, Track, Keyframe, Command
│  ├─ preset.ts            # [완료] MotionPreset, PresetTrack
│  └─ hub.ts               # [축2+3] HubModule, Workspace, HubCategory
└─ lib/core/               # 순수 함수만. 부작용 없음.
구현 순서 — 이 순서를 지킨다
Phase	이름	핵심 산출물	의존성
P0	기반 완료	EditorCommand, presetEngine, effectRegistry, 키프레임	완료
P1	Hub 타입 + Registry	hub.ts, hubRegistry.ts, HubModule 인터페이스	없음
P2	기존 패널 모듈화	7개 패널을 HubModule로 래핑, IconBar 동적화	P1
P3	Studio Hub 모달	StudioHub.tsx, 검색, 카테고리 네비게이션	P1
P4	Workspace 저장	hubStore.ts, 즐겨찾기, Workspace CRUD	P2+P3
P5	Command Bridge	commandBridge.ts, Store 액션 → Tool 스키마	P0
P6	AI Director 코어	aiDirector.ts, Ollama 연결, Command 실행	P5
P7	Style Memory	styleMemory.ts, 패턴 수집·학습	P6
P8	Director UI	DirectorPanel as HubModule, 대화형 편집	P3+P6
금지 목록 — 이것을 하면 구조가 무너진다
EditorLayout.tsx에 새 패널 import 추가하지 마라.
IconBar.tsx의 PANEL_ICONS 배열에 하드코딩 항목 추가하지 마라.
AI Director 전용 렌더링 경로를 만들지 마라.
Store 액션을 EditorCommand로 직렬화하지 않고 호출하지 마라.
사용자 데이터를 사용자 동의 없이 로컬 밖으로 보내지 마라.
스킬 레벨로 데이터 구조를 분기하지 마라. UI만 분기한다.
HubModule 없이 새 탭/패널/다이얼로그를 메인에 직접 붙이지 마라.
기존 문서와의 관계
CLAUDE.md: 기술 스택, 코딩 규칙, 디렉터리 구조. → 그대로 유효.
AI-STUDIO_MASTER.md: 전체 프로젝트 스펙. → 그대로 유효.
06_CODING_STANDARD.md: 코딩 표준. → 그대로 유효.
이 문서: 위 문서들의 상위. 구조적 방향과 절대 규칙을 정의. 충돌 시 이 문서가 우선한다.
이 문서의 수정 규칙
4축 구조와 절대 규칙(R1~R6)은 양쪽 합의 없이 변경 불가.
구현 순서(Phase)와 파일 구조는 진행 상황에 따라 갱신 가능.
금지 목록은 추가만 가능. 삭제 불가.
수정 시 날짜와 사유를 하단 변경 이력에 기록.
변경 이력
날짜	내용
2026-03-28	최초 작성. 4축 구조, 절대 규칙, 구현 순서, 금지 목록 확정.