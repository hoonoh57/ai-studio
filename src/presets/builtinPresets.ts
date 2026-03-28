/* ─── src/presets/builtinPresets.ts ─── */
import type { MotionPreset } from '@/types/preset';

/**
 * 빌트인 모션 프리셋 라이브러리
 * 
 * 분류 체계:
 *   Entrance (8) → 등장 효과
 *   Exit (6)     → 퇴장 효과
 *   Emphasis (8) → 강조 효과
 *   Cinematic (6) → 시네마틱/다큐멘터리
 *   Social (4)   → 소셜 미디어 트렌드
 *   Correction (2) → 보정
 * 
 * 총 34개 프리셋
 */

export const BUILTIN_PRESETS: MotionPreset[] = [

    /* ═══════════════════════════════════
       ENTRANCE — 등장 효과
       ═══════════════════════════════════ */
    {
        id: 'builtin.entrance.fade-in',
        name: '페이드 인',
        description: '투명에서 서서히 나타남. 가장 보편적이고 안전한 등장.',
        category: 'entrance',
        genres: ['vlog', 'interview', 'documentary', 'corporate', 'wedding'],
        difficulty: 'beginner',
        popularity: 95,
        tracks: [
            {
                property: 'opacity', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 1, value: 1, easing: 'ease-out' },
                ]
            },
        ],
        defaultSpan: 0.15,
        anchor: 'start',
        builtin: true,
        createdAt: 0,
        tags: ['기본', '부드러운', '안전한'],
        version: 1,
    },
    {
        id: 'builtin.entrance.slide-left',
        name: '슬라이드 인 (왼쪽)',
        description: '왼쪽에서 미끄러지며 등장. 유튜브 인트로에 자주 사용.',
        category: 'entrance',
        genres: ['tutorial', 'product-review', 'social-short'],
        difficulty: 'beginner',
        popularity: 88,
        tracks: [
            {
                property: 'x', mode: 'absolute', keyframes: [
                    { position: 0, value: -500, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-out-cubic' },
                ]
            },
            {
                property: 'opacity', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 0.3, value: 1, easing: 'ease-out' },
                ]
            },
        ],
        defaultSpan: 0.12,
        anchor: 'start',
        builtin: true,
        createdAt: 0,
        tags: ['슬라이드', '동적', '인트로'],
        version: 1,
    },
    {
        id: 'builtin.entrance.slide-right',
        name: '슬라이드 인 (오른쪽)',
        description: '오른쪽에서 미끄러지며 등장.',
        category: 'entrance',
        genres: ['tutorial', 'product-review', 'social-short'],
        difficulty: 'beginner',
        popularity: 85,
        tracks: [
            {
                property: 'x', mode: 'absolute', keyframes: [
                    { position: 0, value: 500, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-out-cubic' },
                ]
            },
            {
                property: 'opacity', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 0.3, value: 1, easing: 'ease-out' },
                ]
            },
        ],
        defaultSpan: 0.12,
        anchor: 'start',
        builtin: true,
        createdAt: 0,
        tags: ['슬라이드', '동적', '인트로'],
        version: 1,
    },
    {
        id: 'builtin.entrance.slide-up',
        name: '슬라이드 업',
        description: '아래에서 위로 올라오며 등장. 모던한 느낌.',
        category: 'entrance',
        genres: ['corporate', 'tutorial', 'social-short'],
        difficulty: 'beginner',
        popularity: 82,
        tracks: [
            {
                property: 'y', mode: 'absolute', keyframes: [
                    { position: 0, value: 300, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-out-cubic' },
                ]
            },
            {
                property: 'opacity', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 0.4, value: 1, easing: 'ease-out' },
                ]
            },
        ],
        defaultSpan: 0.12,
        anchor: 'start',
        builtin: true,
        createdAt: 0,
        tags: ['슬라이드', '모던', '세로'],
        version: 1,
    },
    {
        id: 'builtin.entrance.zoom-in',
        name: '줌 인 등장',
        description: '작은 상태에서 확대되며 등장. 임팩트 있는 오프닝.',
        category: 'entrance',
        genres: ['music-video', 'gaming', 'social-short'],
        difficulty: 'beginner',
        popularity: 90,
        tracks: [
            {
                property: 'scale', mode: 'absolute', keyframes: [
                    { position: 0, value: 0.3, easing: 'linear' },
                    { position: 1, value: 1, easing: 'ease-out-back' },
                ]
            },
            {
                property: 'opacity', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 0.5, value: 1, easing: 'ease-out' },
                ]
            },
        ],
        defaultSpan: 0.15,
        anchor: 'start',
        builtin: true,
        createdAt: 0,
        tags: ['줌', '임팩트', '오프닝'],
        version: 1,
    },
    {
        id: 'builtin.entrance.pop',
        name: '팝 등장',
        description: '톡 튀어나오는 탄성 효과. 경쾌한 분위기에 적합.',
        category: 'entrance',
        genres: ['social-short', 'tutorial', 'gaming'],
        difficulty: 'intermediate',
        popularity: 78,
        tracks: [
            {
                property: 'scale', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 0.6, value: 1.15, easing: 'ease-out' },
                    { position: 1, value: 1, easing: 'ease-in-out' },
                ]
            },
            {
                property: 'opacity', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 0.3, value: 1, easing: 'ease-out' },
                ]
            },
        ],
        defaultSpan: 0.12,
        anchor: 'start',
        builtin: true,
        createdAt: 0,
        tags: ['탄성', '경쾌한', '바운스'],
        version: 1,
    },
    {
        id: 'builtin.entrance.rotate-in',
        name: '회전 등장',
        description: '회전하면서 등장. 크리에이티브 콘텐츠에 효과적.',
        category: 'entrance',
        genres: ['music-video', 'social-short', 'gaming'],
        difficulty: 'intermediate',
        popularity: 65,
        tracks: [
            {
                property: 'rotation', mode: 'absolute', keyframes: [
                    { position: 0, value: -90, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-out-back' },
                ]
            },
            {
                property: 'scale', mode: 'absolute', keyframes: [
                    { position: 0, value: 0.5, easing: 'linear' },
                    { position: 1, value: 1, easing: 'ease-out' },
                ]
            },
            {
                property: 'opacity', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 0.4, value: 1, easing: 'ease-out' },
                ]
            },
        ],
        defaultSpan: 0.15,
        anchor: 'start',
        builtin: true,
        createdAt: 0,
        tags: ['회전', '크리에이티브', '동적'],
        version: 1,
    },
    {
        id: 'builtin.entrance.blur-in',
        name: '블러 인',
        description: '흐릿한 상태에서 선명해지며 등장. 몽환적 분위기.',
        category: 'entrance',
        genres: ['cinematic', 'wedding', 'music-video'],
        difficulty: 'advanced',
        popularity: 72,
        tracks: [
            {
                property: 'blur', mode: 'absolute', keyframes: [
                    { position: 0, value: 20, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-out' },
                ]
            },
            {
                property: 'opacity', mode: 'absolute', keyframes: [
                    { position: 0, value: 0.3, easing: 'linear' },
                    { position: 1, value: 1, easing: 'ease-out' },
                ]
            },
        ],
        defaultSpan: 0.2,
        anchor: 'start',
        builtin: true,
        createdAt: 0,
        tags: ['블러', '몽환', '시네마틱'],
        version: 1,
    },

    /* ═══════════════════════════════════
       EXIT — 퇴장 효과
       ═══════════════════════════════════ */
    {
        id: 'builtin.exit.fade-out',
        name: '페이드 아웃',
        description: '서서히 사라짐. 가장 보편적인 퇴장.',
        category: 'exit',
        genres: ['vlog', 'interview', 'documentary', 'corporate', 'wedding'],
        difficulty: 'beginner',
        popularity: 95,
        tracks: [
            {
                property: 'opacity', mode: 'absolute', keyframes: [
                    { position: 0, value: 1, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-in' },
                ]
            },
        ],
        defaultSpan: 0.15,
        anchor: 'end',
        builtin: true,
        createdAt: 0,
        tags: ['기본', '부드러운', '안전한'],
        version: 1,
    },
    {
        id: 'builtin.exit.slide-left',
        name: '슬라이드 아웃 (왼쪽)',
        description: '왼쪽으로 밀려 나감.',
        category: 'exit',
        genres: ['tutorial', 'product-review', 'social-short'],
        difficulty: 'beginner',
        popularity: 82,
        tracks: [
            {
                property: 'x', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 1, value: -500, easing: 'ease-in-cubic' },
                ]
            },
            {
                property: 'opacity', mode: 'absolute', keyframes: [
                    { position: 0.7, value: 1, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-in' },
                ]
            },
        ],
        defaultSpan: 0.12,
        anchor: 'end',
        builtin: true,
        createdAt: 0,
        tags: ['슬라이드', '동적'],
        version: 1,
    },
    {
        id: 'builtin.exit.zoom-out',
        name: '줌 아웃 퇴장',
        description: '축소되면서 사라짐.',
        category: 'exit',
        genres: ['music-video', 'gaming', 'social-short'],
        difficulty: 'beginner',
        popularity: 80,
        tracks: [
            {
                property: 'scale', mode: 'absolute', keyframes: [
                    { position: 0, value: 1, easing: 'linear' },
                    { position: 1, value: 0.3, easing: 'ease-in' },
                ]
            },
            {
                property: 'opacity', mode: 'absolute', keyframes: [
                    { position: 0.5, value: 1, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-in' },
                ]
            },
        ],
        defaultSpan: 0.15,
        anchor: 'end',
        builtin: true,
        createdAt: 0,
        tags: ['줌', '축소'],
        version: 1,
    },
    {
        id: 'builtin.exit.blur-out',
        name: '블러 아웃',
        description: '흐려지면서 사라짐. 장면 마무리에 우아함.',
        category: 'exit',
        genres: ['cinematic', 'wedding', 'documentary'],
        difficulty: 'advanced',
        popularity: 70,
        tracks: [
            {
                property: 'blur', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 1, value: 20, easing: 'ease-in' },
                ]
            },
            {
                property: 'opacity', mode: 'absolute', keyframes: [
                    { position: 0.6, value: 1, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-in' },
                ]
            },
        ],
        defaultSpan: 0.2,
        anchor: 'end',
        builtin: true,
        createdAt: 0,
        tags: ['블러', '우아한', '시네마틱'],
        version: 1,
    },
    {
        id: 'builtin.exit.shrink-rotate',
        name: '축소 회전 퇴장',
        description: '작아지면서 회전하며 사라짐.',
        category: 'exit',
        genres: ['social-short', 'gaming', 'music-video'],
        difficulty: 'intermediate',
        popularity: 60,
        tracks: [
            {
                property: 'scale', mode: 'absolute', keyframes: [
                    { position: 0, value: 1, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-in-cubic' },
                ]
            },
            {
                property: 'rotation', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 1, value: 180, easing: 'ease-in' },
                ]
            },
            {
                property: 'opacity', mode: 'absolute', keyframes: [
                    { position: 0.5, value: 1, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-in' },
                ]
            },
        ],
        defaultSpan: 0.15,
        anchor: 'end',
        builtin: true,
        createdAt: 0,
        tags: ['회전', '축소', '동적'],
        version: 1,
    },
    {
        id: 'builtin.exit.drop-down',
        name: '낙하 퇴장',
        description: '아래로 떨어지며 사라짐. 코믹한 연출에 효과적.',
        category: 'exit',
        genres: ['gaming', 'social-short', 'tutorial'],
        difficulty: 'intermediate',
        popularity: 55,
        tracks: [
            {
                property: 'y', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 1, value: 500, easing: 'ease-in-cubic' },
                ]
            },
            {
                property: 'opacity', mode: 'absolute', keyframes: [
                    { position: 0.7, value: 1, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-in' },
                ]
            },
        ],
        defaultSpan: 0.1,
        anchor: 'end',
        builtin: true,
        createdAt: 0,
        tags: ['낙하', '코믹', '빠른'],
        version: 1,
    },

    /* ═══════════════════════════════════
       EMPHASIS — 강조 효과
       ═══════════════════════════════════ */
    {
        id: 'builtin.emphasis.subtle-zoom',
        name: '미세 줌 (강조)',
        description: '1.03~1.05배 미세 확대. 인터뷰 발언 강조 시 프로들이 가장 많이 쓰는 기법.',
        category: 'emphasis',
        genres: ['interview', 'documentary', 'vlog', 'tutorial'],
        difficulty: 'beginner',
        popularity: 98,
        tracks: [
            {
                property: 'scale', mode: 'absolute', keyframes: [
                    { position: 0, value: 1, easing: 'linear' },
                    { position: 0.5, value: 1.05, easing: 'ease-in-out' },
                    { position: 1, value: 1, easing: 'ease-in-out' },
                ]
            },
        ],
        defaultSpan: 0.3,
        anchor: 'full',
        builtin: true,
        createdAt: 0,
        tags: ['미세', '프로', '강조', '인터뷰', '필수'],
        version: 1,
    },
    {
        id: 'builtin.emphasis.pulse',
        name: '펄스',
        description: '심장 박동처럼 한 번 커졌다 돌아옴. 리듬감 있는 강조.',
        category: 'emphasis',
        genres: ['music-video', 'social-short', 'gaming'],
        difficulty: 'beginner',
        popularity: 85,
        tracks: [
            {
                property: 'scale', mode: 'absolute', keyframes: [
                    { position: 0, value: 1, easing: 'linear' },
                    { position: 0.3, value: 1.1, easing: 'ease-out' },
                    { position: 1, value: 1, easing: 'ease-in-out' },
                ]
            },
        ],
        defaultSpan: 0.08,
        anchor: 'full',
        builtin: true,
        createdAt: 0,
        tags: ['펄스', '리듬', '비트'],
        version: 1,
    },
    {
        id: 'builtin.emphasis.flash',
        name: '플래시',
        description: '밝기가 한 번 번쩍. 장면 전환 직전 임팩트.',
        category: 'emphasis',
        genres: ['music-video', 'gaming', 'cinematic'],
        difficulty: 'intermediate',
        popularity: 75,
        tracks: [
            {
                property: 'brightness', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 0.3, value: 80, easing: 'ease-out' },
                    { position: 1, value: 0, easing: 'ease-in' },
                ]
            },
        ],
        defaultSpan: 0.06,
        anchor: 'full',
        builtin: true,
        createdAt: 0,
        tags: ['플래시', '번쩍', '임팩트'],
        version: 1,
    },
    {
        id: 'builtin.emphasis.shake',
        name: '흔들림 (쉐이크)',
        description: 'X/Y 미세 진동. 충격이나 긴장감 표현.',
        category: 'emphasis',
        genres: ['gaming', 'music-video', 'cinematic'],
        difficulty: 'advanced',
        popularity: 70,
        tracks: [
            {
                property: 'x', mode: 'relative', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 0.1, value: 8, easing: 'linear' },
                    { position: 0.2, value: -6, easing: 'linear' },
                    { position: 0.3, value: 5, easing: 'linear' },
                    { position: 0.4, value: -4, easing: 'linear' },
                    { position: 0.6, value: 3, easing: 'linear' },
                    { position: 0.8, value: -1, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-out' },
                ]
            },
            {
                property: 'y', mode: 'relative', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 0.15, value: -5, easing: 'linear' },
                    { position: 0.25, value: 4, easing: 'linear' },
                    { position: 0.35, value: -3, easing: 'linear' },
                    { position: 0.5, value: 2, easing: 'linear' },
                    { position: 0.7, value: -1, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-out' },
                ]
            },
        ],
        defaultSpan: 0.08,
        anchor: 'full',
        builtin: true,
        createdAt: 0,
        tags: ['흔들림', '충격', '긴장'],
        version: 1,
    },
    {
        id: 'builtin.emphasis.breathe',
        name: '호흡 (브리드)',
        description: '부드럽게 확대/축소 반복. 대기 화면이나 배경에 생동감.',
        category: 'emphasis',
        genres: ['corporate', 'wedding', 'documentary'],
        difficulty: 'beginner',
        popularity: 72,
        tracks: [
            {
                property: 'scale', mode: 'absolute', keyframes: [
                    { position: 0, value: 1, easing: 'linear' },
                    { position: 0.5, value: 1.03, easing: 'ease-in-out' },
                    { position: 1, value: 1, easing: 'ease-in-out' },
                ]
            },
        ],
        defaultSpan: 1.0,
        anchor: 'full',
        builtin: true,
        createdAt: 0,
        tags: ['호흡', '부드러운', '배경', '루프'],
        version: 1,
    },
    {
        id: 'builtin.emphasis.dim-focus',
        name: '딤 포커스',
        description: '밝기를 살짝 낮춰 텍스트 오버레이 가독성 확보. 에세이/튜토리얼 필수 기법.',
        category: 'emphasis',
        genres: ['tutorial', 'documentary', 'corporate'],
        difficulty: 'intermediate',
        popularity: 80,
        tracks: [
            {
                property: 'brightness', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 0.2, value: -15, easing: 'ease-out' },
                    { position: 0.8, value: -15, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-in' },
                ]
            },
        ],
        defaultSpan: 0.5,
        anchor: 'full',
        builtin: true,
        createdAt: 0,
        tags: ['딤', '텍스트', '가독성', '프로'],
        version: 1,
    },
    {
        id: 'builtin.emphasis.whip-pan',
        name: '휩 팬',
        description: '빠르게 옆으로 훑는 카메라 움직임 시뮬레이션.',
        category: 'emphasis',
        genres: ['vlog', 'social-short', 'music-video'],
        difficulty: 'advanced',
        popularity: 68,
        tracks: [
            {
                property: 'x', mode: 'relative', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 0.4, value: 200, easing: 'ease-in' },
                    { position: 0.6, value: -200, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-out' },
                ]
            },
            {
                property: 'blur', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 0.4, value: 15, easing: 'ease-in' },
                    { position: 0.6, value: 15, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-out' },
                ]
            },
        ],
        defaultSpan: 0.1,
        anchor: 'full',
        builtin: true,
        createdAt: 0,
        tags: ['휩', '빠른', '카메라워크'],
        version: 1,
    },
    {
        id: 'builtin.emphasis.glitch',
        name: '글리치',
        description: '노이즈/왜곡 느낌의 디지털 글리치. 사이버펑크/게이밍 분위기.',
        category: 'emphasis',
        genres: ['gaming', 'music-video', 'social-short'],
        difficulty: 'expert',
        popularity: 65,
        tracks: [
            {
                property: 'x', mode: 'relative', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 0.05, value: 15, easing: 'linear' },
                    { position: 0.1, value: -10, easing: 'linear' },
                    { position: 0.15, value: 0, easing: 'linear' },
                    { position: 0.3, value: 20, easing: 'linear' },
                    { position: 0.35, value: 0, easing: 'linear' },
                    { position: 0.5, value: -15, easing: 'linear' },
                    { position: 0.55, value: 0, easing: 'linear' },
                    { position: 1, value: 0, easing: 'linear' },
                ]
            },
            {
                property: 'contrast', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 0.1, value: 50, easing: 'linear' },
                    { position: 0.2, value: 0, easing: 'linear' },
                    { position: 0.4, value: -30, easing: 'linear' },
                    { position: 0.5, value: 0, easing: 'linear' },
                    { position: 1, value: 0, easing: 'linear' },
                ]
            },
        ],
        defaultSpan: 0.06,
        anchor: 'full',
        builtin: true,
        createdAt: 0,
        tags: ['글리치', '디지털', '사이버펑크', '게이밍'],
        version: 1,
    },

    /* ═══════════════════════════════════
       CINEMATIC — 시네마틱/다큐멘터리
       ═══════════════════════════════════ */
    {
        id: 'builtin.cinematic.ken-burns-zoom-in',
        name: '켄 번스 (줌 인)',
        description: '사진/정지 영상에 느린 줌으로 생동감. 다큐멘터리의 상징적 기법.',
        category: 'cinematic',
        genres: ['documentary', 'wedding', 'cinematic', 'interview'],
        difficulty: 'beginner',
        popularity: 92,
        tracks: [
            {
                property: 'scale', mode: 'absolute', keyframes: [
                    { position: 0, value: 1, easing: 'linear' },
                    { position: 1, value: 1.15, easing: 'ease-in-out' },
                ]
            },
        ],
        defaultSpan: 1.0,
        anchor: 'full',
        builtin: true,
        createdAt: 0,
        tags: ['켄번스', '다큐', '사진', '느린'],
        version: 1,
    },
    {
        id: 'builtin.cinematic.ken-burns-zoom-out',
        name: '켄 번스 (줌 아웃)',
        description: '확대된 상태에서 서서히 빠짐. 전체 맥락을 드러내는 연출.',
        category: 'cinematic',
        genres: ['documentary', 'wedding', 'cinematic'],
        difficulty: 'beginner',
        popularity: 88,
        tracks: [
            {
                property: 'scale', mode: 'absolute', keyframes: [
                    { position: 0, value: 1.2, easing: 'linear' },
                    { position: 1, value: 1, easing: 'ease-in-out' },
                ]
            },
        ],
        defaultSpan: 1.0,
        anchor: 'full',
        builtin: true,
        createdAt: 0,
        tags: ['켄번스', '리빌', '전체'],
        version: 1,
    },
    {
        id: 'builtin.cinematic.ken-burns-pan-right',
        name: '켄 번스 (우측 팬)',
        description: '왼쪽에서 오른쪽으로 느리게 이동. 풍경 사진에 최적.',
        category: 'cinematic',
        genres: ['documentary', 'cinematic', 'wedding'],
        difficulty: 'intermediate',
        popularity: 75,
        tracks: [
            {
                property: 'x', mode: 'absolute', keyframes: [
                    { position: 0, value: -50, easing: 'linear' },
                    { position: 1, value: 50, easing: 'ease-in-out' },
                ]
            },
            {
                property: 'scale', mode: 'absolute', keyframes: [
                    { position: 0, value: 1.1, easing: 'linear' },
                    { position: 1, value: 1.1, easing: 'linear' },
                ]
            },
        ],
        defaultSpan: 1.0,
        anchor: 'full',
        builtin: true,
        createdAt: 0,
        tags: ['켄번스', '팬', '풍경'],
        version: 1,
    },
    {
        id: 'builtin.cinematic.dolly-in',
        name: '돌리 인',
        description: '카메라가 피사체에 접근하는 느낌. 서서히 줌 + 미세 밝기 변화.',
        category: 'cinematic',
        genres: ['cinematic', 'documentary', 'interview'],
        difficulty: 'advanced',
        popularity: 78,
        tracks: [
            {
                property: 'scale', mode: 'absolute', keyframes: [
                    { position: 0, value: 1, easing: 'linear' },
                    { position: 1, value: 1.08, easing: 'ease-in-out' },
                ]
            },
            {
                property: 'brightness', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 0.5, value: -3, easing: 'ease-in-out' },
                    { position: 1, value: 0, easing: 'ease-in-out' },
                ]
            },
        ],
        defaultSpan: 0.6,
        anchor: 'full',
        builtin: true,
        createdAt: 0,
        tags: ['돌리', '접근', '영화'],
        version: 1,
    },
    {
        id: 'builtin.cinematic.vignette-fade',
        name: '비네팅 페이드',
        description: '밝기와 투명도 동시 변화로 몽환적 시작/종료.',
        category: 'cinematic',
        genres: ['cinematic', 'wedding', 'music-video'],
        difficulty: 'advanced',
        popularity: 68,
        tracks: [
            {
                property: 'brightness', mode: 'absolute', keyframes: [
                    { position: 0, value: -30, easing: 'linear' },
                    { position: 0.4, value: 0, easing: 'ease-out' },
                    { position: 0.6, value: 0, easing: 'linear' },
                    { position: 1, value: -30, easing: 'ease-in' },
                ]
            },
            {
                property: 'opacity', mode: 'absolute', keyframes: [
                    { position: 0, value: 0.7, easing: 'linear' },
                    { position: 0.3, value: 1, easing: 'ease-out' },
                    { position: 0.7, value: 1, easing: 'linear' },
                    { position: 1, value: 0.7, easing: 'ease-in' },
                ]
            },
        ],
        defaultSpan: 1.0,
        anchor: 'full',
        builtin: true,
        createdAt: 0,
        tags: ['비네팅', '몽환', '무드'],
        version: 1,
    },
    {
        id: 'builtin.cinematic.drift',
        name: '드리프트',
        description: '매우 느린 대각선 이동 + 미세 줌. 감성적 B-Roll에 적합.',
        category: 'cinematic',
        genres: ['cinematic', 'wedding', 'vlog', 'music-video'],
        difficulty: 'intermediate',
        popularity: 74,
        tracks: [
            {
                property: 'x', mode: 'absolute', keyframes: [
                    { position: 0, value: -20, easing: 'linear' },
                    { position: 1, value: 20, easing: 'ease-in-out' },
                ]
            },
            {
                property: 'y', mode: 'absolute', keyframes: [
                    { position: 0, value: -10, easing: 'linear' },
                    { position: 1, value: 10, easing: 'ease-in-out' },
                ]
            },
            {
                property: 'scale', mode: 'absolute', keyframes: [
                    { position: 0, value: 1.02, easing: 'linear' },
                    { position: 1, value: 1.06, easing: 'ease-in-out' },
                ]
            },
        ],
        defaultSpan: 1.0,
        anchor: 'full',
        builtin: true,
        createdAt: 0,
        tags: ['드리프트', '감성', 'B-Roll', '느린'],
        version: 1,
    },

    /* ═══════════════════════════════════
       SOCIAL — 소셜 미디어 트렌드
       ═══════════════════════════════════ */
    {
        id: 'builtin.social.tiktok-zoom',
        name: 'TikTok 줌 비트',
        description: '비트에 맞춰 빠른 줌인/아웃. 숏폼 필수 효과.',
        category: 'social',
        genres: ['social-short', 'music-video', 'gaming'],
        difficulty: 'beginner',
        popularity: 90,
        tracks: [
            {
                property: 'scale', mode: 'absolute', keyframes: [
                    { position: 0, value: 1, easing: 'linear' },
                    { position: 0.15, value: 1.3, easing: 'ease-out' },
                    { position: 1, value: 1, easing: 'ease-out-bounce' },
                ]
            },
        ],
        defaultSpan: 0.06,
        anchor: 'full',
        builtin: true,
        createdAt: 0,
        tags: ['틱톡', '비트', '줌', '숏폼'],
        version: 1,
    },
    {
        id: 'builtin.social.reels-bounce',
        name: 'Reels 바운스',
        description: '탄성 있는 바운스 스케일. 인스타 릴스 스타일.',
        category: 'social',
        genres: ['social-short', 'music-video'],
        difficulty: 'beginner',
        popularity: 82,
        tracks: [
            {
                property: 'scale', mode: 'absolute', keyframes: [
                    { position: 0, value: 0.8, easing: 'linear' },
                    { position: 0.4, value: 1.08, easing: 'ease-out' },
                    { position: 0.7, value: 0.97, easing: 'ease-in-out' },
                    { position: 1, value: 1, easing: 'ease-out' },
                ]
            },
        ],
        defaultSpan: 0.1,
        anchor: 'start',
        builtin: true,
        createdAt: 0,
        tags: ['릴스', '바운스', '인스타'],
        version: 1,
    },
    {
        id: 'builtin.social.snap-cut',
        name: '스냅 컷',
        description: '스케일 점프로 빠른 컷 전환 느낌. 유튜브 점프컷 보완.',
        category: 'social',
        genres: ['vlog', 'tutorial', 'social-short'],
        difficulty: 'beginner',
        popularity: 86,
        tracks: [
            {
                property: 'scale', mode: 'absolute', keyframes: [
                    { position: 0, value: 1.08, easing: 'linear' },
                    { position: 0.05, value: 1, easing: 'ease-out' },
                ]
            },
        ],
        defaultSpan: 0.03,
        anchor: 'start',
        builtin: true,
        createdAt: 0,
        tags: ['점프컷', '빠른', '유튜브'],
        version: 1,
    },
    {
        id: 'builtin.social.story-swipe',
        name: '스토리 스와이프',
        description: '인스타 스토리식 세로 스와이프 등장.',
        category: 'social',
        genres: ['social-short'],
        difficulty: 'intermediate',
        popularity: 70,
        tracks: [
            {
                property: 'y', mode: 'absolute', keyframes: [
                    { position: 0, value: 600, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-out-cubic' },
                ]
            },
            {
                property: 'opacity', mode: 'absolute', keyframes: [
                    { position: 0, value: 0.5, easing: 'linear' },
                    { position: 0.5, value: 1, easing: 'ease-out' },
                ]
            },
        ],
        defaultSpan: 0.1,
        anchor: 'start',
        builtin: true,
        createdAt: 0,
        tags: ['스토리', '스와이프', '세로'],
        version: 1,
    },

    /* ═══════════════════════════════════
       CORRECTION — 보정
       ═══════════════════════════════════ */
    {
        id: 'builtin.correction.smooth-brightness',
        name: '부드러운 밝기 전환',
        description: '어두운 장면에서 밝은 장면으로의 부드러운 밝기 보정.',
        category: 'correction',
        genres: ['vlog', 'documentary', 'interview', 'wedding'],
        difficulty: 'beginner',
        popularity: 60,
        tracks: [
            {
                property: 'brightness', mode: 'absolute', keyframes: [
                    { position: 0, value: -20, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-in-out' },
                ]
            },
        ],
        defaultSpan: 0.2,
        anchor: 'start',
        builtin: true,
        createdAt: 0,
        tags: ['밝기', '보정', '부드러운'],
        version: 1,
    },
    {
        id: 'builtin.correction.contrast-punch',
        name: '대비 펀치',
        description: '콘트라스트를 살짝 올려 선명함 강조.',
        category: 'correction',
        genres: ['cinematic', 'product-review', 'music-video'],
        difficulty: 'intermediate',
        popularity: 55,
        tracks: [
            {
                property: 'contrast', mode: 'absolute', keyframes: [
                    { position: 0, value: 0, easing: 'linear' },
                    { position: 0.3, value: 15, easing: 'ease-out' },
                    { position: 0.7, value: 15, easing: 'linear' },
                    { position: 1, value: 0, easing: 'ease-in' },
                ]
            },
        ],
        defaultSpan: 0.5,
        anchor: 'full',
        builtin: true,
        createdAt: 0,
        tags: ['대비', '선명', '펀치'],
        version: 1,
    },
];
