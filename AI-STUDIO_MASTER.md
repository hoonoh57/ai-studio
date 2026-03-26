AI-STUDIO 완전 설계 문서 v1.0
Master Design Document (MDD)
Part 1. 제품 비전과 포지셔닝
1.1 제품 정의
AI-Studio는 100% 로컬 우선 + AI 통합 + 프로 편집 비디오 에디터입니다. CapCut의 접근성, DaVinci Resolve의 전문성, Descript의 텍스트 기반 편집, Runway의 AI 생성 능력을 하나의 제품에 통합하되, **프라이버시(로컬 처리)**와 ComfyUI 기반 AI 워크플로우라는 고유 차별점을 가집니다.

1.2 타겟 사용자
Primary: 유튜버, 콘텐츠 크리에이터 (중급) — CapCut에서 성장한 사용자, 더 강력한 도구를 원하지만 DaVinci/Premiere는 부담스러운 층.

Secondary: 프로 편집자 — DaVinci/Premiere를 쓰지만 AI 기능 통합이 부족하다고 느끼는 층.

Tertiary: AI 아티스트 — ComfyUI를 쓰지만 비디오 편집 도구가 없는 층.

1.3 핵심 차별점 (경쟁사와 비교)
차별점	CapCut	DaVinci	Premiere	Descript	Runway	AI-Studio
가격	무료/구독	무료/$295	구독 $22/월	구독 $24/월	구독 $12/월	무료 코어 + 프로 일회성
프라이버시	클라우드	로컬	클라우드	클라우드	클라우드	100% 로컬 기본
AI 편집	내장(제한적)	Neural Engine	Sensei(제한)	핵심 기능	생성 전문	ComfyUI 통합 + 로컬 모델
텍스트 기반 편집	없음	있음(v20)	없음	핵심	없음	있음
노드 기반 AI	없음	Fusion(VFX)	없음	없음	없음	ComfyUI 네이티브
컬러 그레이딩	기초	최고	중상	없음	없음	프로급(DaVinci 수준 목표)
오디오 포스트	기초	최고(Fairlight)	중	중(AI)	없음	프로급
플러그인 생태계	없음	OpenFX	VST/AAX	없음	없음	OpenFX + VST + ComfyUI 노드
Part 2. 전체 기능 명세 (Feature Specification)
2.1 기능 카테고리 및 전체 목록
모든 기능은 7개 대분류 아래 체계적으로 정리합니다. 각 기능에 대해 출처(어느 경쟁사에서 채택/개선), 우선순위(P0=필수, P1=중요, P2=향후), 담당 모듈을 명시합니다.

A. 미디어 관리 (Media Management)
ID	기능명	설명	출처	우선순위
A01	파일 임포트	드래그앤드롭, 파일 피커로 비디오/오디오/이미지 가져오기. HEVC, ProRes, H.264, DNxHR, EXR, RAW 지원	DaVinci+CapCut	P0
A02	미디어 빈(Bin)	폴더 계층 구조로 에셋 정리. 스마트 빈(자동 분류: 해상도, 코덱, 날짜별)	DaVinci	P0
A03	메타데이터 관리	파일 정보(해상도, 코덱, FPS, 컬러스페이스, 길이) 자동 읽기 및 편집	DaVinci	P1
A04	미디어 썸네일	비디오 프레임에서 자동 추출한 썸네일. 호버시 스크럽 프리뷰	CapCut	P0
A05	프록시 생성	고해상도 원본 → 저해상도 프록시 자동/수동 생성. 내보내기시 원본으로 교체	DaVinci+Premiere	P1
A06	AI 미디어 분석	얼굴 인식, 씬 감지, 음성 감지로 자동 태깅 및 분류	DaVinci Neural Engine	P1
A07	클라우드 미디어 브라우저	로컬 네트워크/NAS 탐색. 클라우드 스토리지 연결(선택적, 사용자 동의 후)	DaVinci	P2
A08	에셋 검색	파일명, 메타데이터, AI 태그로 검색. 필터(타입, 해상도, 길이, 사용여부)	DaVinci+CapCut	P0
B. 편집 (Editing)
ID	기능명	설명	출처	우선순위
B01	멀티트랙 타임라인	무제한 비디오/오디오/텍스트/이펙트 트랙. 트랙 높이 조절, 잠금, 뮤트, 솔로, 숨김	DaVinci	P0
B02	기본 편집	트림, 스플릿, 삭제, 복사, 붙여넣기, 실행취소/재실행(무제한 히스토리)	공통	P0
B03	고급 트리밍	리플, 롤, 슬립, 슬라이드, 에지 트림. 트림 에디터 팝업	DaVinci+Premiere	P0
B04	마그네틱 타임라인	클립 간 스냅, 플레이헤드 스냅, 마커 스냅 토글	CapCut+FCPX	P0
B05	멀티캠 편집	여러 카메라 앵글 동기화(오디오/타임코드/마커 기준), 앵글 전환	DaVinci	P1
B06	속도 제어	일정 속도 변경(0.01x~100x), 속도 커브(베지어), 프레임 블렌딩/광학 플로우 리타이밍	CapCut+DaVinci	P0
B07	리버스 재생	클립 역방향 재생	CapCut	P0
B08	프리즈 프레임	현재 프레임을 정지 이미지로 삽입	DaVinci	P1
B09	컴파운드 클립	여러 클립을 하나로 묶어 관리	DaVinci+Premiere	P1
B10	중첩 타임라인	타임라인 안의 타임라인 (계층적 편집)	DaVinci+Premiere	P1
B11	마커 시스템	타임라인/클립 마커(색상, 노트, 카테고리). 마커 내비게이션	DaVinci	P0
B12	텍스트 기반 편집	트랜스크립트에서 텍스트를 선택/삭제하면 해당 비디오 구간이 편집됨	Descript	P1
B13	필러워드 자동 제거	"음", "어" 등 불필요한 음성 자동 감지 및 제거	Descript	P1
B14	키프레임 에디터	모든 속성(위치, 크기, 회전, 불투명도, 컬러 등)에 키프레임 설정. 그래프 에디터(베지어 커브)	DaVinci+CapCut	P0
B15	트랜지션 라이브러리	내장 트랜지션 100종+. 커스텀 트랜지션 제작/저장. 트랜지션 길이 조절	CapCut+DaVinci	P0
B16	이펙트 라이브러리	내장 비디오/오디오 이펙트. OpenFX 플러그인 지원	DaVinci	P0
B17	조정 레이어	여러 클립에 동시에 이펙트 적용하는 투명 레이어	Premiere+DaVinci	P1
B18	크로마키(그린스크린)	색상 기반 배경 제거. 스필 억제, 엣지 블렌딩	CapCut+DaVinci	P0
B19	PIP(화면 속 화면)	오버레이 비디오/이미지 배치, 크기/위치 조절, 마스크 적용	CapCut	P0
B20	클립 교체	클립을 다른 에셋으로 교체하되 길이/이펙트 유지	CapCut	P1
C. 프리뷰 및 렌더링 (Preview & Rendering)
ID	기능명	설명	출처	우선순위
C01	실시간 프리뷰	WebGPU 기반 GPU 가속 합성. 멀티레이어, 이펙트, 트랜지션 실시간 재생	자체	P0
C02	프리뷰 해상도 선택	Full, 1/2, 1/4, 1/8 프리뷰 해상도 전환	DaVinci+Premiere	P0
C03	세이프존 가이드	타이틀/액션 세이프존, 커스텀 가이드라인, 그리드 오버레이	DaVinci	P1
C04	트랜스폼 핸들	프리뷰 위에서 직접 클립 이동/크기/회전 조작 (바운딩 박스, 기즈모)	CapCut+Premiere	P0
C05	전체화면 프리뷰	듀얼 모니터 지원. 전체화면 또는 플로팅 프리뷰 창	DaVinci	P1
C06	스코프 (Scopes)	웨이브폼, 벡터스코프, 히스토그램, 퍼레이드	DaVinci	P1
C07	WebGPU 렌더 엔진	WGSL 셰이더 기반 합성 파이프라인. 블렌드모드, 컬러 변환, LUT 적용	자체	P0
D. 텍스트 및 자막 (Text & Subtitles)
ID	기능명	설명	출처	우선순위
D01	텍스트 추가/편집	폰트, 크기, 색상, 그림자, 외곽선, 배경, 불투명도, 자간, 행간	CapCut+DaVinci	P0
D02	텍스트 애니메이션	글자별/단어별/줄별 등장/퇴장 애니메이션. 프리셋 100종+	CapCut	P0
D03	텍스트 템플릿	미리 디자인된 타이틀 템플릿 (하단3분의1, 인트로, 아웃트로, 콜투액션 등)	CapCut+DaVinci	P0
D04	자동 자막 (ASR)	Whisper 기반 음성→텍스트 변환. 다국어 지원(한/영/일/중 등 50개+)	Descript+CapCut	P0
D05	자막 스타일링	단어별 하이라이트(카라오케 스타일), 이모지 삽입, 배경 박스	CapCut	P0
D06	SRT/VTT 임포트/익스포트	외부 자막 파일 호환	DaVinci+Premiere	P0
D07	텍스트 트래킹	텍스트가 영상 속 특정 객체를 따라 이동	CapCut	P1
D08	이중 자막	원문+번역 동시 표시	CapCut	P1
D09	AI 번역	자막 자동 번역(로컬 모델 또는 외부 API 선택)	Descript+CapCut	P1
E. 오디오 (Audio)
ID	기능명	설명	출처	우선순위
E01	오디오 타임라인	전용 오디오 트랙. 웨이브폼 시각화. 샘플 정확도 편집	DaVinci Fairlight	P0
E02	볼륨 자동화	클립별 볼륨 + 키프레임 볼륨 엔벨로프	DaVinci	P0
E03	오디오 믹서	트랙별 볼륨, 팬, 뮤트, 솔로. 마스터 버스. VU/피크 미터	DaVinci Fairlight	P0
E04	오디오 EQ	파라메트릭 EQ (6밴드+). 프리셋 제공	DaVinci	P1
E05	오디오 컴프레서/리미터	다이나믹 레인지 제어	DaVinci	P1
E06	노이즈 리덕션	AI 기반 배경 소음 제거 (Studio Sound 수준)	Descript	P0
E07	음성 분리	음악/음성/환경음 분리 (AI)	DaVinci+Descript	P1
E08	보이스 이펙트	피치 변경, 로봇, 에코 등 음성 변환	CapCut	P1
E09	TTS (텍스트→음성)	텍스트를 자연스러운 음성으로 변환. 다국어, 다양한 음색	CapCut	P1
E10	비트 감지	음악 비트 자동 감지 → 마커 생성 → 컷 포인트 제안	CapCut	P1
E11	오디오 더킹	음성 구간에서 자동으로 배경음악 볼륨 낮춤	DaVinci	P1
E12	스톡 오디오 라이브러리	로열티프리 음악/효과음 내장	CapCut	P2
F. 컬러 (Color)
ID	기능명	설명	출처	우선순위
F01	프라이머리 컬러 휠	리프트/감마/게인/오프셋 4-way 컬러 휠	DaVinci	P0
F02	HDR 컬러 휠	하이라이트/미드톤/섀도우/블랙/화이트 존별 제어	DaVinci	P1
F03	커브 에디터	RGB 개별/결합 커브, 색상 vs 채도 커브, 색상 vs 루미넌스 커브	DaVinci	P0
F04	LUT 적용	.cube, .3dl LUT 임포트/적용. 강도 조절	DaVinci+Premiere	P0
F05	노드 기반 컬러 파이프라인	시리얼/패러렐/레이어 노드. 노드별 독립적 보정	DaVinci	P1
F06	파워 윈도우 (마스크)	원형/사각형/다각형/커브 마스크. 트래킹 연동	DaVinci	P1
F07	퀄리파이어	HSL 기반 색상 범위 선택 (특정 색만 조정)	DaVinci	P1
F08	컬러 매칭	클립 간 자동 컬러 매칭 (AI)	DaVinci+CapCut	P1
F09	스킨 톤 보정	피부색 감지 및 자동 보정	DaVinci	P2
F10	컬러 프리셋/필터	영화풍, 빈티지, 시네마틱 등 내장 프리셋 50종+	CapCut	P0
G. AI 도구 (AI Tools)
ID	기능명	설명	출처	우선순위
G01	AI 배경 제거	SAM2 기반 자동 배경 분리 (그린스크린 불필요)	CapCut+Runway	P0
G02	AI 객체 추적	지정한 객체를 프레임 단위로 자동 추적	DaVinci	P0
G03	AI 스타일 전환	영상을 특정 아트 스타일로 변환 (수채화, 유화, 애니메 등)	Runway	P1
G04	AI 업스케일	ESRGAN 기반 해상도 향상 (SD→HD, HD→4K)	DaVinci	P1
G05	AI 슬로모션	광학 플로우 기반 프레임 보간 (30fps→60/120fps)	DaVinci	P1
G06	AI 얼굴 인식	클립 내 인물 자동 인식 및 분류	DaVinci	P1
G07	AI 스마트 리프레임	가로→세로, 종횡비 자동 변환시 주 피사체 자동 추적	DaVinci+CapCut	P0
G08	AI 매직 마스크	사람/동물/물체 자동 마스킹 (피사체 선택)	DaVinci	P1
G09	AI 음성 클론	음성 샘플에서 클론 생성. 새로운 텍스트를 해당 음성으로 재생	Descript	P2
G10	AI 텍스트→비디오	텍스트 프롬프트로 비디오 클립 생성 (Seedance/외부 모델)	CapCut+Runway	P1
G11	AI 이미지→비디오	정지 이미지를 비디오로 애니메이션	CapCut+Runway	P1
G12	AI 스크립트→비디오	스크립트를 입력하면 자동으로 씬 분할, 스톡 매칭, 편집	CapCut+Descript	P2
G13	AI 하이라이트 추출	긴 영상에서 하이라이트 자동 감지 → 쇼츠/릴스 자동 편집	CapCut	P1
G14	AI 비디오 안정화	흔들린 영상 자동 안정화	CapCut+DaVinci	P1
G15	ComfyUI 워크플로우	노드 기반 AI 파이프라인 에디터. ComfyUI 서버 연동(WebSocket)	자체 고유	P0
G16	AI 하이브리드 라우터	각 AI 작업을 로컬/클라우드 자동 분배. 프라이버시 레벨 표시	자체 고유	P0
G17	AI 모델 관리자	로컬 AI 모델 다운로드/업데이트/버전 관리 UI	자체 고유	P1
G18	AI 아이 컨택트	영상 속 인물의 시선을 카메라 방향으로 보정	Descript	P2
G19	AI 더빙/번역	영상의 음성을 다른 언어로 자동 번역 및 더빙	Descript+CapCut	P2
H. 내보내기 및 시스템 (Export & System)
ID	기능명	설명	출처	우선순위
H01	비디오 내보내기	H.264, H.265, ProRes, DNxHR, VP9, AV1. GPU 가속 인코딩(NVENC/VideoToolbox/VCE)	DaVinci	P0
H02	해상도/FPS 선택	720p~8K, 24~120fps, 커스텀 해상도	DaVinci	P0
H03	오디오 내보내기	AAC, WAV, FLAC, MP3. 스템 분리 내보내기(음성/음악/효과음)	DaVinci	P0
H04	SNS 프리셋	YouTube, TikTok, Instagram, Twitter 등 플랫폼별 최적 설정 원클릭	CapCut	P0
H05	배치 내보내기	여러 타임라인/프리셋을 큐에 등록하고 순차 내보내기	DaVinci	P1
H06	HDR 내보내기	HDR10, HDR10+, Dolby Vision 지원	DaVinci	P2
H07	프로젝트 저장/열기	.aistudio 형식 (JSON + 참조). 자동저장(30초 간격). IndexedDB/OPFS + 파일시스템	자체	P0
H08	프로젝트 버전 관리	스냅샷 저장, 되돌리기. Git-like 히스토리	자체	P2
H09	키보드 단축키	커스텀 단축키 매핑. DaVinci/Premiere/FCPX 프리셋	DaVinci	P0
H10	테마 시스템	다크(기본)/라이트 테마. 커스텀 색상	자체	P1
H11	플러그인 시스템	OpenFX 비디오 플러그인, VST/AU 오디오 플러그인, ComfyUI 커스텀 노드	DaVinci	P1
H12	성능 설정	GPU VRAM 제한, 동시 AI 작업 수, 캐시 관리, 프록시 설정	자체	P1
H13	프라이버시 대시보드	데이터 흐름 시각화(로컬/클라우드/외부), 감사 로그, 차단 설정	자체 고유	P0
Part 3. 화면 구조 (Screen Architecture)
3.1 전체 화면 목록
번호	화면명	진입점	핵심 기능
S01	Home (프로젝트 허브)	앱 시작	프로젝트 생성/열기/최근목록/템플릿
S02	Editor (메인 편집)	프로젝트 열기	타임라인, 프리뷰, 속성, 미디어
S03	Color (컬러 그레이딩)	에디터 탭 전환	컬러 휠, 커브, LUT, 노드
S04	Audio (오디오 믹싱)	에디터 탭 전환	믹서, EQ, 다이나믹스, 웨이브폼
S05	AI Workflow (ComfyUI)	에디터 탭 전환	노드 편집기, AI 파이프라인
S06	Export (내보내기)	에디터 → Export 버튼	포맷, 해상도, 코덱 선택
S07	Settings (설정)	어디서든 접근	AI 엔진, 프라이버시, 단축키, 성능
S08	Privacy Dashboard	설정 또는 독립 접근	데이터 흐름 시각화, 감사 로그
3.2 화면 간 이동 흐름
[앱 시작]
   │
   ▼
[S01 Home] ──── 새 프로젝트 / 기존 프로젝트 열기 ──── ▶ [S02 Editor]
                                                          │
                                           ┌──────┬──────┼──────┬──────┐
                                           ▼      ▼      ▼      ▼      ▼
                                        [S02]  [S03]  [S04]  [S05]  [S06]
                                        Editor  Color  Audio  AI WF  Export
                                           │
                                           └── 상단 탭 바로 자유 전환 ──┘
                                                          │
                                                   [S07 Settings] (어디서든 기어 아이콘)
                                                   [S08 Privacy] (Settings 내 또는 TopBar 뱃지)
3.3 에디터 화면 (S02) 상세 레이아웃
이것이 전체 제품의 핵심이므로 가장 상세하게 정의합니다.

┌─────────────────────────────────────────────────────────────────────┐
│ [TopBar] 44px                                                       │
│  로고 │ Undo Redo Save │ [Editor][Color][Audio][AI WF] │ 프로젝트명  │
│  │ 프라이버시뱃지 │ Export 버튼 │ Settings                            │
├──┬──────┬─────────────────────────────────────────┬─────────────────┤
│  │      │                                         │                 │
│I │Media │          Preview Area                   │  Properties     │
│c │Panel │    ┌─────────────────────────────┐      │  Panel          │
│o │      │    │                             │      │                 │
│n │260px │    │     16:9 Video Frame        │      │  260px          │
│  │      │    │     (WebGPU Canvas)         │      │                 │
│B │      │    │     + Safe Zone Guide       │      │  [Transform]    │
│a │      │    │     + Transform Handles     │      │  [Appearance]   │
│r │      │    │                             │      │  [Time]         │
│  │      │    └─────────────────────────────┘      │  [Filters]      │
│48│      │     Playback Controls + Timecode        │  [AI Tools]     │
│px│      │     + Resolution + Scopes toggle        │  [Keyframes]    │
│  │      │                                         │                 │
├──┴──────┴─────────────────────────────────────────┴─────────────────┤
│ [Timeline Panel] 280px                                              │
│  Toolbar: Snap│Split│Delete│Ripple│Roll│Zoom│+Track                 │
│  ┌─────────┬────────────────────────────────────────────────────┐   │
│  │Track    │ Ruler (timecode)                                   │   │
│  │Labels   │────────────────────────────────────────────────────│   │
│  │V1  🔇🔒│ [clip][clip]  [clip]                               │   │
│  │V2  🔇🔒│    [clip]        [clip]                            │   │
│  │A1  🔇🔒│ [waveform clip]                                    │   │
│  │A2  🔇🔒│ [waveform clip]     [waveform clip]                │   │
│  │T1  🔇🔒│      [text clip]                                   │   │
│  └─────────┴────────────────────────────────────────────────────┘   │
│                        ▲ Playhead (red line)                        │
└─────────────────────────────────────────────────────────────────────┘
각 패널의 상세 스펙
TopBar (44px)

좌: 로고 + 제품명
좌중: Undo, Redo, Save 아이콘 버튼
중: 페이지 탭(Editor, Color, Audio, AI Workflow) — 활성 탭 하이라이트
중: 프로젝트명 (클릭시 인라인 편집)
우: 프라이버시 뱃지 (100% Local / Mixed / Cloud 상태), Export 버튼 (그라디언트), Settings 기어 아이콘
IconBar (48px)

수직 아이콘 열: Media, Text, Audio, Effects, AI, Sticker, Transition, Template
활성 항목에 좌측 인디케이터 바 + 아이콘 밝기 변경
각 아이콘 클릭시 좌측 패널 콘텐츠 전환
MediaPanel (260px)

상단: "Media Library" 타이틀 + 에셋 카운트 뱃지
검색 바 (아이콘 + 텍스트 입력)
드롭존 (대시 보더, 호버시 보라색 글로우)
에셋 리스트: 썸네일(44×32) + 파일명 + 메타(크기, 해상도, 길이)
에셋 드래그 → 타임라인 드롭
PreviewArea (flex: 1)

캔버스 래퍼: 16:9 프레임, 검정 배경, 그림자
세이프존 가이드 오버레이 (점선)
트랜스폼 핸들 (선택 클립의 바운딩 박스)
플레이백 컨트롤: Home, Prev Frame, Play/Pause(원형 버튼), Next Frame, End
타임코드 디스플레이 (모노 폰트, HH:MM:SS:FF)
해상도 표시 (1920×1080 · 30fps)
Scopes 토글 버튼
PropertiesPanel (260px)

상단: "Properties — [클립명]"
섹션들 (각 섹션은 접기/펼치기 가능):
Transform: Position X/Y (드래그 슬라이더), Scale (슬라이더 + 수치), Rotation (다이얼 + 수치)
Appearance: Opacity (슬라이더 0~100%), Blend Mode (드롭다운), Speed (슬라이더 0.1~4x)
Time: Start, End, Duration (읽기 전용 타임코드)
Filters: 적용된 필터 목록 + 추가 버튼
AI Tools: 아이콘 + 레이블 버튼 (Background Remove, Style Transfer, Smart Crop, Audio Enhance, Auto Subtitle)
Keyframes: 현재 속성의 키프레임 표시 + 추가/삭제 버튼
TimelinePanel (280px, flex-shrink: 0)

툴바 (34px): Snap 토글, Split, Delete, Ripple, Roll, Slip/Slide 도구 선택, Zoom 슬라이더, +Track 버튼
바디: 좌측 트랙 라벨(120px) + 우측 스크롤 영역
트랙 라벨: 아이콘 + 이름 + 뮤트/솔로/잠금/눈 버튼
룰러: 타임코드 눈금 (줌 레벨에 따라 간격 조정)
클립: 타입별 색상 그라디언트, 내부에 파일명 표시, 비디오 클립은 썸네일 스트립, 오디오 클립은 웨이브폼
플레이헤드: 빨간 세로선 + 상단 삼각형 헤드 + 글로우
키보드 단축키: Space(재생), ←→(프레임 이동), C(스플릿), Delete(삭제), Ctrl+Z(실행취소)
Part 4. 사용자 여정 (User Journey)
4.1 기본 워크플로우: "유튜브 영상 편집"
1. 앱 실행 → Home 화면
2. "New Project" 클릭 → 프로젝트 설정(이름, 해상도, FPS)
3. Editor 화면 진입
4. 미디어 패널에 영상/음악 드래그 앤 드롭 → 에셋 자동 분석
5. 에셋을 타임라인 트랙에 드래그 → 클립 생성
6. 클립 트리밍/스플릿으로 불필요한 부분 제거
7. 텍스트 트랙에 타이틀/자막 추가 → 자동 자막(Whisper) 실행
8. 트랜지션 추가 (클립 사이 아이콘 클릭)
9. 컬러 탭에서 LUT 적용 또는 기본 보정
10. 오디오 탭에서 배경음악 볼륨 조절, 노이즈 리덕션
11. 프리뷰로 확인
12. Export → YouTube 프리셋 → 내보내기 시작
4.2 AI 워크플로우: "배경 교체"
1. 에디터에서 클립 선택
2. 속성 패널 → AI Tools → "Background Remove" 클릭
3. 로컬 SAM2 모델이 자동 실행 → 프라이버시 뱃지 "100% Local"
4. 결과 프리뷰 표시
5. 만족 → 적용. 불만족 → AI Workflow 탭으로 이동
6. ComfyUI 노드 에디터에서 세부 조정 (마스크 정밀도, 후처리)
7. 결과를 타임라인에 자동 반영
Part 5. 모듈 분해 및 부품 제작 지시서 (Module Decomposition)
5.1 모듈 아키텍처
ai-studio/
├── packages/
│   ├── design-system/          [M01] 디자인 시스템
│   └── shared/                 [M02] 공유 유틸리티
├── src/
│   ├── types/                  [M03] 타입 정의
│   ├── stores/                 [M04] 상태 관리
│   ├── components/
│   │   ├── Layout/             [M05] 레이아웃 쉘
│   │   ├── MediaLibrary/       [M06] 미디어 라이브러리
│   │   ├── Preview/            [M07] 프리뷰 엔진
│   │   ├── Timeline/           [M08] 타임라인
│   │   ├── Properties/         [M09] 속성 패널
│   │   ├── Text/               [M10] 텍스트/자막 엔진
│   │   ├── Color/              [M11] 컬러 그레이딩
│   │   ├── Audio/              [M12] 오디오 엔진
│   │   ├── AI/                 [M13] AI 도구 UI
│   │   ├── Export/             [M14] 내보내기
│   │   └── Settings/           [M15] 설정
│   ├── lib/
│   │   ├── engine/             [M16] 코어 엔진 (프로젝트 모델, 커맨드)
│   │   ├── renderer/           [M17] WebGPU 렌더러
│   │   ├── audio/              [M18] Web Audio 엔진
│   │   └── ai/                 [M19] AI 라우터 + ComfyUI 브릿지
│   └── styles/                 [M01에 포함]
├── services/
│   ├── media-engine/           [M20] Rust 미디어 엔진 (FFmpeg)
│   └── ai-service/             [M21] Python AI 서비스
└── apps/
    ├── desktop/                [M22] Electron/Tauri 쉘
    └── web/                    [M23] 웹 빌드
5.2 모듈별 부품 제작 지시서 요약
각 모듈은 아래 정보를 포함한 독립적 지시서를 받습니다:

항목	내용
모듈 ID	M01~M23
목적	이 모듈이 하는 일 (한 문장)
담당 기능	Part 2의 기능 ID 목록 (예: A01, A02, A04, A08)
입력 인터페이스	이 모듈이 받는 데이터/이벤트 타입
출력 인터페이스	이 모듈이 내보내는 데이터/이벤트 타입
의존 모듈	어떤 모듈의 출력을 사용하는지
기술 스택	언어, 라이브러리, 프레임워크
파일 목록	정확한 파일 경로와 각 파일의 역할
품질 기준	성능(FPS, 지연시간), 테스트 커버리지, 접근성
납품물	소스코드, 단위테스트, 스토리북(UI), API 문서
5.3 모듈 의존성 그래프
[M03 Types] ◄── 모든 모듈이 참조
     │
     ▼
[M01 Design System] ◄── 모든 UI 모듈(M05~M15)이 참조
     │
     ▼
[M04 Store] ◄── 모든 UI 모듈이 참조
     │
     ├─► [M16 Core Engine] ◄── M04가 호출
     │         │
     │         ├─► [M17 WebGPU Renderer] ◄── M07 Preview가 사용
     │         ├─► [M18 Audio Engine] ◄── M12 Audio가 사용
     │         └─► [M19 AI Router] ◄── M13 AI, M05 ComfyUI가 사용
     │
     ├─► [M05 Layout Shell] ── 모든 패널을 조립
     ├─► [M06 Media Library]
     ├─► [M07 Preview]
     ├─► [M08 Timeline]
     ├─► [M09 Properties]
     ├─► [M10 Text Engine]
     ├─► [M11 Color]
     ├─► [M12 Audio]
     ├─► [M13 AI Tools]
     ├─► [M14 Export]
     └─► [M15 Settings]

[M20 Rust Media Engine] ◄── M16이 Native 호출
[M21 Python AI Service] ◄── M19가 WebSocket/HTTP 호출
[M22 Desktop Shell] ── M05를 호스팅
[M23 Web Build] ── M05를 호스팅
5.4 조립 공정도
Phase 1: 기초 (주 1~2)
  M03(Types) + M01(Design System) + M04(Store) + M16(Core Engine)
  → 이 4개가 확정되면 나머지 모듈에 "표준"으로 배포

Phase 2: UI 쉘 (주 2~3)
  M05(Layout) + M06(Media) + M07(Preview) + M08(Timeline) + M09(Properties)
  → 화면이 보이고 기본 편집 동작

Phase 3: 기능 확장 (주 3~5)
  M10(Text) + M11(Color) + M12(Audio) + M14(Export)
  → 모든 편집 기능 완성

Phase 4: AI 통합 (주 4~6)
  M13(AI UI) + M19(AI Router) + M21(Python AI)
  → AI 기능 동작

Phase 5: 엔진 고도화 (주 5~8)
  M17(WebGPU) + M18(Audio Engine) + M20(Rust Media)
  → 성능 최적화

Phase 6: 패키징 (주 7~8)
  M22(Desktop) + M23(Web)
  → 배포 가능 빌드
Part 6. 인터페이스 표준 (Interface Standards)
6.1 타입 표준 (M03에서 정의, 모든 모듈이 따름)
모든 데이터 구조는 src/types/ 아래에 TypeScript 인터페이스로 정의합니다. 하위 모듈은 이 타입을 읽기만 하고 수정 요청은 M04 Store의 액션을 통해서만 합니다.

6.2 상태 관리 표준
Zustand 단일 스토어. 모든 상태 변경은 정의된 액션 함수를 통해서만 수행합니다. 컴포넌트는 셀렉터로 필요한 상태만 구독합니다.

6.3 컴포넌트 표준
모든 UI 컴포넌트는 React 함수형 컴포넌트 + TypeScript. M01 디자인 시스템의 토큰(CSS 변수)만 사용합니다. 인라인 스타일이 아닌 CSS Modules 또는 토큰 기반 스타일. 모든 아이콘은 SVG 컴포넌트(이모지 사용 금지).

6.4 통신 표준
UI ↔ Core Engine: 동기 함수 호출 (Zustand 액션) Core Engine ↔ Renderer: 비동기 (requestAnimationFrame 루프) Core Engine ↔ AI Router: 비동기 (Promise/WebSocket) AI Router ↔ ComfyUI: WebSocket (ws://localhost:8188) AI Router ↔ 외부 API: HTTPS (사용자 동의 후) Desktop ↔ Native: Electron IPC / Tauri invoke

6.5 품질 표준
프리뷰 FPS: 최소 30fps (1080p 기준), 타임라인 조작 응답: 16ms 이내, AI 도구 시작: 2초 이내 (모델 로드 제외), 내보내기: GPU 가속시 실시간 이상, 메모리: 4K 프로젝트 2GB 이내 (프록시 사용시).

Part 7. 다음 단계
이 문서는 설계도입니다. 이 설계도가 확정되어야 부품 제작 지시서를 내려보낼 수 있습니다.

확인이 필요한 사항:

기능 목록 (Part 2): 빠진 기능이 있는지, 우선순위 조정이 필요한지
화면 구조 (Part 3): 레이아웃, 패널 배치, 흐름에 동의하는지
모듈 분해 (Part 5): 모듈 경계가 적절한지
인터페이스 표준 (Part 6): 모듈 간 통신 방식에 동의하는지



2차 진행

AI-Studio MDD 실현 전략 — 풀 비전
이 제품이 세상에 존재해야 하는 이유
"나는 유튜브 영상을 만들고 싶다"라고 자연어로 말하면, AI가 스크립트를 쓰고, 이미지와 영상을 생성하고, 나레이션을 입히고, 자막을 붙여서, 편집된 타임라인을 만들어주는 제품. 그리고 그 결과물이 마음에 안 드는 부분은 DaVinci 수준의 프로 편집기에서 프레임 단위로 고칠 수 있는 제품. 이 모든 것이 내 컴퓨터 안에서 돌아가서, 내 데이터가 어디에도 나가지 않는 제품.

CapCut은 AI가 약하고 프로 편집이 안 됩니다. DaVinci는 프로 편집은 최고지만 AI 통합이 없습니다. Runway는 AI 생성은 강하지만 편집기가 없습니다. Descript은 텍스트 기반 편집이 혁신적이지만 프로 편집과 AI 생성이 약합니다. AI-Studio는 이 네 제품의 교집합이자, ComfyUI를 통한 로컬 AI 파이프라인이라는 고유 무기를 가집니다.

두 개의 엔진, 하나의 경험
MDD가 그리는 제품은 두 개의 엔진으로 구성됩니다.

엔진 1: AI Creator (자동화) — 자연어 입력 → LLM이 스크립트 작성 → ComfyUI가 이미지/영상 생성 → Whisper가 자막 생성 → TTS가 나레이션 생성 → 자동으로 타임라인에 배치. 초보자는 여기서 끝낼 수 있습니다.

엔진 2: Pro Editor (수동 제어) — DaVinci 수준의 타임라인 편집, 키프레임, 트랜지션, 컬러 그레이딩, 오디오 믹싱, 텍스트 애니메이션. 전문가는 AI Creator의 결과물을 여기서 정밀 편집합니다.

이 두 엔진의 연결점이 핵심입니다. AI Creator가 만든 결과물은 그냥 에셋이 아니라 편집 가능한 타임라인 프로젝트로 나옵니다. 사용자는 AI가 만든 어떤 클립이든 클릭해서 트림하고, 트랜지션을 바꾸고, 색보정을 하고, 자막을 수정할 수 있습니다.

기술 아키텍처 — MDD Part 5 기반
MDD가 제시한 M01~M23 모듈 구조를 그대로 채택하되, 현재 코드에서 자연스럽게 성장하는 경로를 설계합니다.

인프라 레이어 (현재 코드에서 확장)

src/types/ (M03) — 현재 74줄. MDD의 전체 타입 체계로 확장. 프로젝트, 타임라인, 클립, 이펙트, 키프레임, AI 파이프라인 타입 추가.

src/stores/ (M04) — 현재 170줄 단일 파일. 슬라이스 패턴으로 분리: projectSlice, timelineSlice, playbackSlice, selectionSlice, uiSlice, historySlice, aiSlice.

src/lib/core/ (M02+M16) — 아직 없음. 타임라인 연산(클립 충돌 검사, 스냅 계산, 리플 편집), 시간 변환, 컬러 수학 등 순수 함수 레이어.

렌더링 엔진 (신규)

src/lib/renderer/ (M17) — WebGPU 기반 멀티레이어 합성기. 블렌드 모드, 트랜스폼, LUT, 이펙트 셰이더를 GPU에서 실행. Canvas 2D 폴백.

src/lib/audio/ (M18) — Web Audio API 기반. 멀티트랙 믹싱, EQ, 컴프레서, 파형 생성, 비디오와 프레임 동기화.

AI 엔진 (MDD 고유)

src/lib/ai/ (M19) — AI 하이브리드 라우터. 각 AI 작업을 로컬(ComfyUI, Whisper WASM, 로컬 LLM) 또는 클라우드(사용자 동의 후)로 자동 분배. 프라이버시 레벨 표시.

src/lib/ai/comfyui-bridge.ts — ComfyUI 서버와 WebSocket 통신. 워크플로우 JSON 전송, 진행률 수신, 결과 파일 수신.

src/lib/ai/whisper.ts — Whisper WASM/WebGPU로 브라우저 내 음성 인식. 100% 로컬.

src/lib/ai/tts.ts — 로컬 TTS 모델 또는 Web Speech Synthesis.

src/lib/ai/llm.ts — 로컬 LLM(Ollama) 또는 외부 API로 스크립트 생성.

UI 컴포넌트 (현재 코드에서 확장)

현재 6개 컴포넌트 → MDD의 전체 패널 구조로:

Layout/ — EditorLayout을 탭 기반 쉘로 확장 (Editor/Color/Audio/AI WF/Export 탭 전환)
Timeline/ — 310줄 단일 파일을 Timeline, Track, Clip, Ruler, Playhead, Toolbar로 분리
Preview/ — HTML video → WebGPU Canvas 합성기 전환. 트랜스폼 핸들, 세이프존 가이드 추가
Properties/ — 접기/펼치기 섹션, 키프레임 편집기, 필터 스택 추가
MediaLibrary/ — 빈(Bin) 계층 구조, 스마트 분류, 검색, 호버 스크럽 프리뷰
Text/ (신규) — 텍스트/자막 편집기, 애니메이션 프리셋, 카라오케 스타일
Color/ (신규) — 컬러 휠, 커브, LUT, 노드 편집기
Audio/ (신규) — 믹서, EQ, 파형 뷰, 다이나믹스
AI/ (신규) — ComfyUI 노드 에디터, AI Creator 자연어 인터페이스
Export/ (신규) — 포맷/코덱 선택, SNS 프리셋, 진행률
실행 로드맵 — MDD Part 5.4 조립 공정도 기반
MDD가 제시한 6 Phase를 따르되, 각 Phase에서 AI와 편집이 동시에 성장하도록 합니다.

Phase 1 (주 1~2): 기초 인프라 + AI Creator 스켈레톤

타입 시스템 확장(프로젝트, AI 파이프라인 타입), 스토어 슬라이스 분리, 히스토리(Undo/Redo), 탭 기반 레이아웃 쉘(Editor/Color/Audio/AI/Export 탭), AI Creator 화면 껍데기(프롬프트 입력 → 스크립트 표시 → 스토리보드 표시 → 타임라인 생성 버튼). 이 Phase가 끝나면 "AI Creator 탭이 보이고, 프롬프트를 입력하면 더미 스크립트가 표시되며, 에디터 탭에서는 Undo/Redo가 동작하는" 상태.

Phase 2 (주 2~3): 편집 코어 완성

클립 리사이즈(양쪽 끝 드래그), 리플/롤/슬립/슬라이드 트림, 트랜지션(Cross Dissolve + 10종), 텍스트 클립, 키프레임 시스템, 마커, 멀티 클립 선택/이동, 트랙 추가/삭제, 오디오 파형 표시. 이 Phase가 끝나면 "CapCut 수준의 편집이 가능한" 상태.

Phase 3 (주 3~4): 프리뷰 엔진 + 내보내기

WebGPU 멀티레이어 합성기(Canvas 2D 폴백), 트랜스폼 핸들(프리뷰 위 직접 조작), 프리뷰 해상도 선택, Web Audio 멀티트랙 믹싱, FFmpeg-WASM 비디오 내보내기, SNS 프리셋, 프로젝트 저장/열기(IndexedDB + OPFS).

Phase 4 (주 4~5): AI 엔진 통합

ComfyUI WebSocket 브릿지, Whisper WASM 자동 자막, 로컬 TTS, LLM 스크립트 생성(Ollama 연동), AI Creator 전체 파이프라인(프롬프트 → 스크립트 → 이미지/영상 생성 → TTS → 자동 타임라인 배치), AI 하이브리드 라우터(로컬/클라우드 자동 분배), 프라이버시 대시보드.

Phase 5 (주 5~7): 전문가 도구

컬러 그레이딩(컬러 휠, 커브, LUT, 노드 기반 파이프라인), 오디오 포스트(EQ, 컴프레서, 노이즈 리덕션, 오디오 더킹), 텍스트 애니메이션(글자별/단어별 모션 100종+), 이펙트 라이브러리, 크로마키, 속도 커브(베지어), 광학 플로우 리타이밍.

Phase 6 (주 7~8): 패키징 + 고도화

Electron/Tauri 쉘(네이티브 FFmpeg, GPU 인코딩), Rust 미디어 엔진(프록시 생성, 코덱 변환), ComfyUI 커스텀 노드 에디터 UI, 플러그인 시스템(OpenFX, VST), 멀티캠 편집, AI 고급 기능(배경 제거, 객체 추적, 스타일 전환, 업스케일, 슬로모션).

정리: 이것이 MDD가 그리는 제품입니다
이 제품은 "CapCut에 기능 하나씩 추가하는 클론"이 아닙니다. AI가 영상을 만들어주고, 프로가 그걸 다듬는 새로운 카테고리의 도구입니다. MDD의 7개 기능 카테고리(A~H)와 100개+ 기능이 모두 이 비전을 향해 정렬되어 있고, 23개 모듈이 이 비전을 실현하는 부품입니다.

Phase 1부터 시작할까요? 구체적으로 타입 시스템 확장 + 스토어 리팩토링 + 탭 기반 레이아웃 + AI Creator 스켈레톤을 동시에 작업하겠습니다.