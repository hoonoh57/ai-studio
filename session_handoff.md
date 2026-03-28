AI-Studio 세션 핸드오프 문서
2026-03-27 작성 — 다음 세션에서 이 문서를 첫 메시지로 전달하세요
1. 프로젝트 개요
AI-Studio는 솔로 유튜브/SNS 크리에이터를 위한 프라이버시 중심 웹 기반 AI 영상 편집기입니다.

GitHub: https://github.com/hoonoh57/ai-studio (기본 브랜치: master)

기술 스택: TypeScript 6.0.2, React 19.2.4, Vite 8.0.3, Zustand 5.0.12

API로 파일 읽기: https://raw.githubusercontent.com/hoonoh57/ai-studio/master/src/[경로]

2. 현재 서버 파일 트리 (확인됨)
src/
├── App.tsx                              # export default App → EditorLayout 렌더
├── main.tsx                             # React root 마운트
├── vite-env.d.ts
├── styles/
│   └── tokens.css                       # CSS 변수 (다크 테마, 레이아웃 치수)
├── types/
│   └── project.ts                       # 핵심 타입 (Asset, Clip, Track, Project, SkillConfig 등)
├── stores/
│   └── editorStore.ts                   # Zustand 단일 스토어 (subscribeWithSelector)
├── hooks/
│   └── useAssetVisualization.ts         # 에셋 파형/썸네일 자동 생성
├── lib/core/
│   ├── snapEngine.ts                    # 스냅 포인트 수집/매칭
│   ├── trimEngine.ts                    # 5종 트림 모드 순수 함수
│   ├── waveformGenerator.ts             # Web Audio API 파형 추출
│   └── thumbnailGenerator.ts            # 비디오 썸네일 프레임 추출
├── components/
│   ├── Layout/
│   │   ├── EditorLayout.tsx             # 메인 레이아웃 (수정 완료)
│   │   ├── TopBar.tsx                   # 상단 바 (탭, 스킬레벨, 내보내기)
│   │   └── IconBar.tsx                  # 좌측 아이콘 바 (export default)
│   ├── MediaLibrary/
│   │   └── MediaPanel.tsx               # 미디어 패널 (named export)
│   ├── Preview/
│   │   └── PreviewArea.tsx              # 프리뷰 영역 (named export, speed 반영 완료)
│   ├── Properties/
│   │   └── PropertiesPanel.tsx          # 속성 패널 (named export)
│   └── Timeline/
│       ├── TimelinePanel.tsx            # 타임라인 진입점
│       ├── TimelineToolbar.tsx          # 트림/스냅/줌 도구
│       ├── TrackHeader.tsx              # 트랙 헤더 (뮤트/잠금/표시)
│       ├── TrackRow.tsx                 # 트랙 행
│       ├── ClipBlock.tsx                # 클립 블록
│       ├── TimelineRuler.tsx            # 눈금자
│       ├── Playhead.tsx                 # 플레이헤드
│       ├── MarkerTrack.tsx              # 마커 트랙
│       ├── WaveformView.tsx             # 파형 캔버스
│       └── ThumbnailStrip.tsx           # 썸네일 캔버스
3. 코딩 규칙 (엄수)
파일 ≤300줄, 함수 ≤40줄, 컴포넌트 ≤200줄
Named exports only (export default 금지) ← 아직 IconBar, TopBar, EditorLayout, App이 default
PascalCase: 컴포넌트/파일, camelCase: 함수, UPPER_SNAKE: 상수
any 금지, as 타입 단언 금지, ! non-null 금지
console.log 금지, 인라인 스타일 현재 사용 중 (CSS Modules 전환 예정)
매직 넘버 금지 → 상수 추출
import 순서: react → 외부 → stores → components → types → relative → styles
Zustand: 단일 스토어, slice 패턴, immer (미도입)
순수 함수: src/lib/core/ (부수 효과 없음, 상태 없음)
상태: src/stores/ 에서만
4. 완료된 작업 (이번 세션)
Phase A-1: 타임라인 코어 엔진 ✅
타임라인 컴포넌트 10개 분해 완료 (TimelinePanel → 하위 10개)

코드 규칙 리팩토링 (25개 파일 계획, 20개 완료)
#	파일	상태
①	src/types/project.ts	✅ 서버 반영됨
②	src/lib/core/snapEngine.ts	✅ 서버 반영됨
③	src/lib/core/trimEngine.ts	✅ 서버 반영됨
④	src/lib/core/waveformGenerator.ts	✅ 서버 반영됨
⑤	src/lib/core/thumbnailGenerator.ts	✅ 서버 반영됨
⑥	src/stores/editorStore.ts	✅ 서버 반영됨
⑦	src/hooks/useAssetVisualization.ts	✅ 서버 반영됨
⑧	WaveformView.tsx	✅ 서버 반영됨
⑨	ThumbnailStrip.tsx	✅ 서버 반영됨
⑩	Playhead.tsx	✅ 서버 반영됨
⑪	MarkerTrack.tsx	✅ 서버 반영됨
⑫	TimelineRuler.tsx	✅ 서버 반영됨
⑬	TrackHeader.tsx	✅ 서버 반영됨
⑭	ClipBlock.tsx	✅ 서버 반영됨
⑮	TrackRow.tsx	✅ 서버 반영됨
⑯	TimelineToolbar.tsx	✅ 서버 반영됨
⑰	TimelinePanel.tsx	✅ 서버 반영됨
⑱	PreviewArea.tsx	✅ 서버 반영됨 (speed 반영)
⑲	PropertiesPanel.tsx	✅ 서버 반영됨
⑳	MediaPanel.tsx	✅ 서버 반영됨
㉑	IconBar.tsx	❌ 미수정 (export default 남아있음)
㉒	TopBar.tsx	❌ 미수정 (export default 남아있음)
㉓	EditorLayout.tsx	⚠️ 레이아웃 구조 수정됨, export default 남아있음
㉔	App.tsx	❌ 미수정
㉕	main.tsx	❌ 미수정
EditorLayout 레이아웃 수정 ✅
MediaPanel이 화면 전체를 차지하던 버그를 mediaWrap (width: 260px, flexShrink: 0) 래퍼로 수정. PreviewArea 래퍼에 minHeight: 0, display: flex, flexDirection: column 적용 필요 (사용자에게 안내함).

5. 현재 진행 중: Phase M-1 (미디어 허브 기반)
배경
현재 MediaPanel은 단순 파일 리스트. 캡컷 벤치마킹 후 AI-Native 미디어 허브로 재설계 결정. 캡컷에 없는 차별화: AI 자동 태깅, 자연어 검색, 스킬 적응형 UI, 프리셋 팩 시스템, 스마트 컬렉션, 사용빈도 분석, 필름스트립 뷰, 배치 태그 편집, 프라이버시 퍼스트(100% 브라우저 내 처리).

Phase M-1 파일별 진행 상태
#	파일	상태	설명
M-1 ①	src/types/media.ts	✅ 코드 제공 완료	사용자 저장 필요
M-1 ②	src/lib/core/mediaEngine.ts	⚠️ 절반 제공됨 (끊김)	여기서 재시작
M-1 ③	src/lib/core/aiTagEngine.ts	📋 설계 완료, 코드 미제공	전체 코드 이전 세션에 포함
M-1 ④	src/stores/mediaSlice.ts	📋 인터페이스만 제공	구현 필요
M-1 ⑤	editorStore.ts 통합	📋 미시작	mediaSlice 병합
Phase M-2~M-4 (미착수)
Phase M-2: 핵심 UI (ImportDropZone, AssetCard, AssetGrid, AssetList, MediaToolbar, MediaHub)
Phase M-3: 고급 기능 (SmartCollectionSidebar, PresetPackBrowser, AssetFilmstrip, AISearchBar 등)
Phase M-4: 통합 (SKILL_CONFIGS 확장, useAssetVisualization 확장, EditorLayout 연결, 테스트)
6. M-1 ①에서 제공한 전체 코드: src/types/media.ts
사용자가 저장해야 함 — 내용은 이전 세션 메시지에 전체 포함됨. 핵심 타입: MediaSourceType, MediaCategory, AITag, SmartRule, SmartCollection, MediaPresetPack, AssetMetadata, MediaViewState, MediaSkillConfig, MEDIA_SKILL_CONFIGS

7. M-1 ②에서 제공 중 끊긴 코드: src/lib/core/mediaEngine.ts
다음 세션에서 이 파일을 완전히 다시 작성해야 함. 필요한 함수 목록:

matchesRule(asset, meta, rule) → boolean          # 단일 스마트 규칙 매칭
matchesAllRules(asset, meta, rules) → boolean     # 전체 규칙 AND 매칭
getCollectionAssetIds(collection, assets, metaMap) → string[]  # 컬렉션 에셋 목록
filterAssets(assets, metaMap, filterType, filterSource, searchQuery) → Asset[]
sortAssets(assets, metaMap, field, direction) → Asset[]
searchByTags(assets, metaMap, query) → Asset[]    # AI 태그 유사도 검색
createDefaultCollections() → SmartCollection[]    # 7개 시스템 기본 컬렉션
createDefaultPresetPacks() → MediaPresetPack[]    # 6개 기본 프리셋 팩
8. M-1 ③ 설계: src/lib/core/aiTagEngine.ts
이전 세션에서 전체 코드가 대화에 포함됨. 핵심 함수:

extractTagsFromFilename(filename) → AITag[]
analyzeVideoColorTone(videoUrl) → Promise<AITag[]>   # canvas 프레임 샘플링 → 밝기/색조/채도 태그
analyzeAudioCharacter(audioUrl) → Promise<AITag[]>    # RMS/길이 분석 → 볼륨/효과음/BGM 태그
analyzeImageResolution(width, height) → AITag[]       # 해상도/비율 태그
autoTagAsset(asset) → Promise<AITag[]>                # 통합 자동 태깅
9. M-1 ④ 설계: src/stores/mediaSlice.ts
인터페이스만 제공됨. 구현에 필요한 상태와 액션:

Copy// 상태
assetMeta: Map<string, AssetMetadata>
collections: SmartCollection[]
presetPacks: MediaPresetPack[]
mediaView: MediaViewState

// 액션 (20개)
setAssetMeta, toggleFavorite, incrementUsage,
addTag, removeTag, batchAddTag, batchRemoveTag,
addCollection, updateCollection, removeCollection, getCollectionAssets,
addPresetPack, removePresetPack, applyPresetPack,
setViewMode, setSortField, toggleSortDirection,
setFilterType, setFilterSource, setSearchQuery,
setActiveCollection, setActivePresetPack
10. 남은 코딩 규칙 위반 (미수정 파일)
파일	문제
IconBar.tsx	export default, 인라인 스타일
TopBar.tsx	export default, 인라인 스타일
EditorLayout.tsx	export default, 인라인 스타일
App.tsx	export default
main.tsx	root null 체크 누락
전체 컴포넌트	CSS Modules 미전환 (모두 인라인 스타일)
editorStore.ts	immer 미도입
11. 전체 프로젝트 진행률
인프라 (vite, tsconfig, package.json)     100%
타입 (project.ts)                          100%
타입 (media.ts)                            코드 제공됨, 저장 필요
스토어 (editorStore.ts)                    90% (immer 미도입)
스토어 (mediaSlice.ts)                     0% (설계만 완료)
레이아웃 (EditorLayout, TopBar, IconBar)   85% (export default 남음)
타임라인 엔진 (10개 컴포넌트)               95% (실제 trim 로직 미연결)
프리뷰 (PreviewArea)                       60% (multi-layer 미구현)
속성 (PropertiesPanel)                     40% (AI 도구 플레이스홀더)
미디어 (MediaPanel → MediaHub)             20% (현재 단순 리스트)
코어 라이브러리                             70% (snap/trim/wave/thumb 완료, media/aiTag 미완)
CSS Modules                                 0%
테스트                                      0%
12. 다음 세션 작업 순서
1. 이 핸드오프 문서를 첫 메시지로 전달
2. GitHub에서 실제 코드를 raw URL로 읽어 현재 상태 확인
3. Phase M-1 재개:
   ② mediaEngine.ts 전체 완성
   ③ aiTagEngine.ts 저장 확인 또는 재작성
   ④ mediaSlice.ts 구현
   ⑤ editorStore.ts에 mediaSlice 통합
4. Phase M-2: UI 컴포넌트 (MediaHub 등)
5. 미수정 파일 정리 (IconBar, TopBar, EditorLayout → named export)
13. 핵심 주의사항
• 브랜치는 master (main 아님)
• raw 파일 URL: https://raw.githubusercontent.com/hoonoh57/ai-studio/master/src/...
• API URL: https://api.github.com/repos/hoonoh57/ai-studio/contents/src/...
• EditorLayout에서 MediaPanel을 감싸는 mediaWrap div 필수 (width: 260px, flexShrink: 0)
• PreviewArea 래퍼에 minHeight: 0, display: flex, flexDirection: column 필요
• editorStore의 setIsPlaying이 존재함 (PreviewArea에서 사용)
• SKILL_CONFIGS는 as const satisfies Record<SkillLevel, SkillConfig> 패턴 사용
• media.ts의 MEDIA_SKILL_CONFIGS는 project.ts의 SKILL_CONFIGS와 별도 (병합하지 않음)
• 모든 새 파일은 named export 사용
• 순수 함수는 src/lib/core/ 에만 배치
이 문서를 docs/SESSION_HANDOFF_20260327.md로 저장하거나, 다음 세션의 첫 메시지에 그대로 붙여넣으면 새 AI가 현재 상태에서 정확히 이어서 작업할 수 있습니다. mediaEngine.ts부터 바로 재개됩니다.