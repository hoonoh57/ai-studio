타임라인 트랙 시스템 — 현황 분석 및 벤치마킹 개선 계획
1. 현재 문제점 (스크린샷 기반)
스크린샷을 보면 다음 문제가 명확합니다.

V.2, A.2 — 고정 4트랙만 존재하며 트랙 추가가 불가능합니다. 이미지 트랙, 자막 트랙, 이펙트 트랙을 넣을 곳이 없습니다. 하단 스크롤바가 잘려서 타임라인 하단 UI가 일부만 표시되고 있습니다. 전문적인 트랙 관리 기능(추가, 삭제, 복제, 재정렬, 컬러링, 그룹핑 등)이 전혀 없습니다.

2. 3대 NLE 벤치마킹 결과
CapCut Desktop
CapCut은 컨슈머용이지만 실전에서 유용한 트랙 관리 기능을 갖추고 있습니다. 드래그로 자동 트랙 생성(클립을 빈 영역에 놓으면 트랙이 자동 추가), Hide/Lock/Mute 3종 컨트롤, Compound Clip(여러 클립을 하나로 묶어 타임라인 정리), 클립 그룹 선택(Shift+클릭 후 우클릭→Group), 자동 트랙 타입 분리(미디어, 텍스트, 스티커, 오디오가 각각 별도 섹션), Main Track Magnet(자석 편집), Auto Snapping, 그리고 Linkage(비디오-오디오 연결/해제)를 제공합니다.

DaVinci Resolve (Edit Page)
DaVinci는 업계 최고 수준의 트랙 시스템을 제공합니다. 무제한 비디오/오디오 트랙, 우클릭으로 "Add Track" (위, 아래, 맨 위, 맨 아래 삽입 가능), Track Targeting / Source Patching(소스 뷰어에서 어느 트랙에 편집할지 지정), Context-Sensitive 자동 트림(마우스 위치에 따라 Roll/Ripple/Slip/Slide 자동 전환), 7가지 편집 유형(Insert, Overwrite, Replace, Fit to Fill, Place on Top, Append at End, Ripple Overwrite), Adjustment Clip(여러 클립 위에 효과 일괄 적용), Stacked & Tabbed Timeline(다중 타임라인 동시 열기), Compound Clip, Speed Ramp(가변 속도), 키프레임 커브 에디터, Multicam 편집, 그리고 다중 사용자 협업을 모두 지원합니다.

Adobe Premiere Pro
Premiere는 전문 방송 편집의 표준입니다. Track Targeting 시스템(V1, V2, A1, A2 등을 소스 패칭으로 연결), Track Header Customization(표시할 컨트롤 버튼 선택 가능), Track Height Preset(S/M/L/XL 크기 프리셋), Nested Sequence(DaVinci의 Compound Clip에 해당), Free-form & Track 기반 하이브리드 타임라인, Sync Lock(특정 트랙 동기화 유지), Track Lock(편집 방지), Solo(오디오 트랙 단독 청취), 그리고 Track Targeting 키보드 단축키를 지원합니다.

3. 벤치마킹 비교표 — 현재 수준 vs 목표
기능 영역	CapCut	DaVinci	Premiere	현재 AI-Studio	목표
트랙 추가/삭제	자동생성	우클릭 메뉴	우클릭 메뉴	❌ 없음	Phase T-1
트랙 유형	미디어/텍스트/스티커/오디오	V/A/Subtitle 무제한	V/A/Subtitle	4종(video/audio/text/effect) 타입만 정의, 4트랙 고정	Phase T-1
트랙 최대 수	~20+	무제한	무제한	스킬별 2~99 (설정만 존재, 추가 UI 없음)	Phase T-1
Hide/Lock/Mute	✅ 3종	✅ 3종	✅ 3종 + Solo	✅ 3종 (있으나 Lock이 split 차단 안 됨 — 이번에 수정)	완료
트랙 높이 조절	✅	✅ 프리셋	✅ S/M/L/XL	✅ 드래그 리사이즈	Phase T-2에서 프리셋 추가
트랙 컬러	❌	✅ 커스텀	✅	❌	Phase T-2
트랙 재정렬	❌	✅ 드래그	✅ 드래그	❌	Phase T-2
트랙 복제	❌	✅	✅	❌	Phase T-2
Source Patching	❌	✅	✅	❌	Phase T-4 (고급)
Track Targeting	❌	✅	✅	❌	Phase T-4
Compound Clip	✅	✅	✅ (Nested)	❌	Phase T-3
클립 그룹	✅	✅	✅	❌	Phase T-3
Adjustment Layer	❌	✅	✅	❌	Phase T-4
Linked Selection	✅	✅	✅	❌	Phase T-2
다중 타임라인	❌	✅ Stacked/Tabbed	✅ Tabbed	❌	Phase T-5 (전문가)
7가지 편집 유형	기본	✅ 전체	✅ 전체	overwrite만	Phase T-3
Multicam	❌	✅	✅	❌	Phase T-5
자동 트랙 생성	✅ 드래그 시 자동	❌	❌	❌	Phase T-1
AI 편집 보조	일부	일부 (Neural Engine)	Sensei	❌	전 Phase에 AI 통합
4. 단계별 구현 로드맵
Phase T-1: 트랙 추가/삭제 + 스크롤 수정 (즉시 착수)
수정 대상 파일은 TimelinePanel.tsx, TrackHeader.tsx, TimelineToolbar.tsx, editorStore.ts이며 핵심 기능은 다음과 같습니다.

TimelineToolbar에 "트랙 추가" 버튼 + 드롭다운 메뉴 추가 — Video, Audio, Text, Effect 4종 선택 가능하며, 스킬 레벨의 maxTracks 제한을 반영합니다. TrackHeader에 "트랙 삭제" 버튼 추가 — 클립이 있으면 확인 대화 표시 후 removeTrack 호출합니다. 드롭 시 자동 트랙 생성 (CapCut 방식) — 빈 영역에 클립을 드롭하면 자동으로 적합한 타입의 트랙이 추가됩니다. 타임라인 하단 스크롤 수정 — overflow: hidden을 overflow-y: auto로 변경하여 트랙이 많아져도 스크롤 가능하도록 합니다.

Phase T-2: 트랙 관리 고도화
트랙 컬러 지정(Track 타입에 color 필드 추가, TrackHeader에 컬러 피커), 트랙 높이 프리셋(S=30/M=48/L=72/XL=120 + 우클릭 메뉴), 트랙 드래그 재정렬(react-dnd 또는 자체 구현), 트랙 복제(빈 복사 + 클립 딥카피), 트랙 이름 인라인 편집(더블클릭 → input), Solo 모드(오디오 트랙 단독 청취), Linked Selection(비디오-오디오 클립 연결/해제)을 구현합니다.

Phase T-3: 편집 워크플로우 확장
Compound Clip 생성/해제(여러 클립을 가상 단일 클립으로 병합), 클립 그룹/언그룹(Ctrl+G / Ctrl+Shift+G), Insert 편집(기존 클립을 밀면서 삽입), Ripple Delete(클립 삭제 후 뒤 클립들 자동 당김), Replace 편집, Fit to Fill, Append at End를 구현합니다.

Phase T-4: 프로급 기능
Source Patching & Track Targeting, Adjustment Layer 트랙, Sync Lock(트랙 간 동기화 유지), 오디오 submix 트랙, Subtitle 전용 트랙 + TTML/SRT import를 구현합니다.

Phase T-5: 초고급 기능
Stacked/Tabbed 다중 타임라인, Multicam 편집(다중 카메라 동기 → 라이브 전환), AI 기반 자동 편집 포인트 제안, AI Scene Detection + Auto Split을 구현합니다.