/* ─── src/modules/builtinModules.ts ─── */
/* 아키텍처 헌법 축3: 기존 패널 + 모션 프리셋을 HubModule로 래핑 → 레지스트리 등록 */

import React from 'react';
import type { HubModule, HubRenderProps } from '@/types/hub';
import { registerModules } from '@/engines/hubRegistry';

/* ═══════════════════════════════════════════
   래핑 팩토리 — named export도 지원하는 lazy 래퍼
   ═══════════════════════════════════════════ */

function wrapComponent<T extends Record<string, any>>(
    loader: () => Promise<T>,
    namedExport?: keyof T,
): (props: HubRenderProps) => React.ReactElement {
    const LazyComp = React.lazy(() =>
        loader().then(mod => {
            const component = namedExport ? mod[namedExport] : mod.default;
            return { default: component };
        }),
    );
    return (_props: HubRenderProps) =>
        React.createElement(
            React.Suspense,
            { fallback: React.createElement('div', { style: { padding: 16, color: '#888' } }, '로딩 중…') },
            React.createElement(LazyComp),
        );
}

/* ═══════════════════════════════════════════
   빌트인 모듈 정의 (8개)
   ═══════════════════════════════════════════ */

const BUILTIN_MODULES: HubModule[] = [
    {
        id: 'builtin.media',
        name: '미디어 라이브러리',
        icon: '📁',
        category: 'media',
        minSkillLevel: 'beginner',
        render: wrapComponent(() => import('@/components/MediaLibrary/MediaHub'), 'MediaHub'),
        searchKeywords: ['미디어', 'media', '파일', '소스', '라이브러리', '가져오기', 'import'],
        description: '프로젝트 미디어 파일 관리 및 타임라인 추가',
        defaultFavorite: true,
        defaultOrder: 0,
        builtin: true,
        version: 1,
    },
    {
        id: 'builtin.text',
        name: '텍스트',
        icon: '🔤',
        category: 'content',
        minSkillLevel: 'intermediate',
        render: wrapComponent(() => import('@/components/Panels/TextPanel'), 'TextPanel'),
        searchKeywords: ['텍스트', 'text', '자막', '타이틀', 'subtitle', 'caption', 'srt'],
        description: '자막, 타이틀, 텍스트 오버레이 추가 · SRT 가져오기/내보내기',
        defaultFavorite: true,
        defaultOrder: 1,
        builtin: true,
        version: 1,
    },
    {
        id: 'builtin.audio',
        name: '오디오',
        icon: '🎵',
        category: 'audio',
        minSkillLevel: 'intermediate',
        render: wrapComponent(() => import('@/components/AudioMixer/AudioMixerPanel'), 'AudioMixerPanel'),
        searchKeywords: ['오디오', 'audio', '음악', '음향', '사운드', 'bgm', '볼륨'],
        description: '오디오 믹서, 볼륨 조절, 음향 효과',
        defaultFavorite: true,
        defaultOrder: 2,
        builtin: true,
        version: 1,
    },
    {
        id: 'builtin.effects',
        name: '이펙트',
        icon: '✨',
        category: 'visual',
        minSkillLevel: 'intermediate',
        render: wrapComponent(() => import('@/components/Effects/EffectsPanel'), 'EffectsPanel'),
        searchKeywords: ['이펙트', 'effects', '필터', 'filter', '색보정', '블러', 'blur'],
        description: 'CSS 필터, 색보정, 비주얼 이펙트 적용',
        defaultFavorite: true,
        defaultOrder: 3,
        builtin: true,
        version: 1,
    },
    {
        id: 'builtin.preset',
        name: '모션 프리셋',
        icon: '🎬',
        category: 'motion',
        minSkillLevel: 'intermediate',
        render: wrapComponent(() => import('@/components/Presets/PresetPanel'), 'PresetPanel'),
        searchKeywords: ['프리셋', 'preset', '모션', 'motion', '애니메이션', '키프레임', 'entrance', 'exit'],
        description: '34개 빌트인 모션 프리셋 — 등장, 퇴장, 강조, 시네마틱 효과 원클릭 적용',
        defaultFavorite: true,
        defaultOrder: 4,
        builtin: true,
        version: 1,
    },
    {
        id: 'builtin.ai',
        name: 'AI 도구',
        icon: '🤖',
        category: 'ai',
        minSkillLevel: 'advanced',
        render: wrapComponent(() => import('@/components/MediaLibrary/MediaHub'), 'MediaHub'),
        searchKeywords: ['ai', '인공지능', '자동', 'auto', '추천', 'director'],
        description: 'AI 기반 자동 편집, 추천, 태그 분석',
        defaultFavorite: true,
        defaultOrder: 5,
        builtin: true,
        version: 1,
    },
    {
        id: 'builtin.sticker',
        name: '스티커',
        icon: '🎨',
        category: 'content',
        minSkillLevel: 'intermediate',
        render: wrapComponent(() => import('@/components/MediaLibrary/MediaHub'), 'MediaHub'),
        searchKeywords: ['스티커', 'sticker', '이모지', 'emoji', '오버레이', 'overlay'],
        description: '스티커, 이모지, 장식 오버레이 추가',
        defaultFavorite: true,
        defaultOrder: 6,
        builtin: true,
        version: 1,
    },
    {
        id: 'builtin.transition',
        name: '트랜지션',
        icon: '🔀',
        category: 'visual',
        minSkillLevel: 'intermediate',
        render: wrapComponent(() => import('@/components/Effects/TransitionPanel'), 'TransitionPanel'),
        searchKeywords: ['트랜지션', 'transition', '전환', 'dissolve', 'fade', 'wipe'],
        description: '클립 간 전환 효과 적용',
        defaultFavorite: true,
        defaultOrder: 7,
        builtin: true,
        version: 1,
    },
];

/* ═══════════════════════════════════════════
   초기화 함수
   ═══════════════════════════════════════════ */

let initialized = false;

/** 앱 시작 시 한 번 호출 — 빌트인 모듈을 레지스트리에 등록 */
export function initBuiltinModules(): void {
    if (initialized) return;
    registerModules(BUILTIN_MODULES);
    initialized = true;
    console.log(`[BuiltinModules] ${BUILTIN_MODULES.length}개 빌트인 모듈 등록 완료`);
}

export { BUILTIN_MODULES };
export default initBuiltinModules;
