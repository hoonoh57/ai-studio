/* ─── src/types/hub.ts ─── */
/* 아키텍처 헌법 축2+축3: Studio Hub & HubModule 타입 정의 */

import type { ReactElement } from 'react';
import type { SkillLevel } from './project';

/* ═══════════════════════════════════════════
   1. Hub 카테고리
   ═══════════════════════════════════════════ */

/** 모듈이 속하는 상위 카테고리 */
export type HubCategory =
    | 'media'         // 미디어·소스 관련
    | 'edit'          // 편집 도구
    | 'motion'        // 모션·키프레임·프리셋
    | 'audio'         // 오디오·음악·음향효과
    | 'visual'        // 색보정·필터·이펙트
    | 'content'       // B-roll·스티커·썸네일
    | 'ai'            // AI Director·자동화
    | 'system';       // 설정·워크스페이스·단축키

/** 카테고리 메타 정보 (UI 표시용) */
export interface HubCategoryMeta {
    id: HubCategory;
    label: string;
    icon: string;
    order: number;
}

export const HUB_CATEGORIES: readonly HubCategoryMeta[] = [
    { id: 'media', label: '미디어', icon: '📁', order: 0 },
    { id: 'edit', label: '편집', icon: '✂️', order: 1 },
    { id: 'motion', label: '모션', icon: '🎬', order: 2 },
    { id: 'audio', label: '오디오', icon: '🎵', order: 3 },
    { id: 'visual', label: '비주얼', icon: '🎨', order: 4 },
    { id: 'content', label: '콘텐츠', icon: '🎞️', order: 5 },
    { id: 'ai', label: 'AI', icon: '🤖', order: 6 },
    { id: 'system', label: '설정', icon: '⚙️', order: 7 },
] as const;

/* ═══════════════════════════════════════════
   2. HubModule — 핵심 인터페이스
   ═══════════════════════════════════════════ */

/** Hub 모듈 렌더링 시 전달되는 props */
export interface HubRenderProps {
    /** Hub 모달 내부에서 렌더링 중인지 여부 */
    isInsideHub: boolean;
    /** 현재 사용자 스킬 레벨 */
    skillLevel: SkillLevel;
    /** Hub 닫기 콜백 */
    closeHub: () => void;
}

/**
 * 모든 확장 기능의 최소 단위.
 * 헌법 R1: EditorLayout.tsx를 수정하지 않고 기능을 추가하는 유일한 방법.
 */
export interface HubModule {
    /** 고유 ID (예: 'builtin.media', 'builtin.preset', 'user.comfyui') */
    id: string;
    /** 표시 이름 */
    name: string;
    /** 아이콘 (이모지 또는 SVG 컴포넌트 경로) */
    icon: string;
    /** 소속 카테고리 */
    category: HubCategory;
    /** 이 모듈을 볼 수 있는 최소 스킬 레벨 */
    minSkillLevel: SkillLevel;
    /** 모듈 UI 렌더 함수 */
    render: (props: HubRenderProps) => ReactElement;
    /** 통합 검색에 사용할 키워드 */
    searchKeywords: string[];
    /** 모듈 설명 (검색 결과·툴팁에 표시) */
    description?: string;
    /** 기본 즐겨찾기 여부 — true면 해당 스킬 레벨에서 IconBar에 기본 표시 */
    defaultFavorite?: boolean;
    /** 즐겨찾기 기본 순서 (낮을수록 위쪽) */
    defaultOrder?: number;
    /** 빌트인 모듈 여부 (삭제 불가) */
    builtin?: boolean;
    /** 모듈 버전 */
    version?: number;
}

/* ═══════════════════════════════════════════
   3. Workspace — 사용자 가변 구조 (축1)
   ═══════════════════════════════════════════ */

/** 즐겨찾기된 모듈 하나의 설정 */
export interface FavoriteEntry {
    moduleId: string;
    order: number;
}

/** 사용자 정의 작업공간 */
export interface Workspace {
    id: string;
    name: string;
    /** 이 작업공간에서 IconBar에 표시할 모듈 목록 */
    favorites: FavoriteEntry[];
    /** 패널 크기 오버라이드 (px) */
    panelSizes?: {
        left?: number;
        right?: number;
        timeline?: number;
    };
    /** 스킬 레벨 (이 Workspace에 연결된 레벨) */
    skillLevel: SkillLevel;
    /** 생성 시각 */
    createdAt: number;
    /** 마지막 사용 시각 */
    lastUsedAt: number;
}

/* ═══════════════════════════════════════════
   4. Hub Registry 인터페이스
   ═══════════════════════════════════════════ */

/** hubRegistry가 구현해야 할 계약 */
export interface IHubRegistry {
    /** 모듈 등록 */
    register(module: HubModule): void;
    /** ID로 모듈 조회 */
    get(id: string): HubModule | undefined;
    /** 전체 또는 카테고리별 목록 */
    list(category?: HubCategory): HubModule[];
    /** 스킬 레벨 필터링된 목록 */
    listForSkill(skillLevel: SkillLevel, category?: HubCategory): HubModule[];
    /** 통합 검색 */
    search(query: string, skillLevel?: SkillLevel): HubModule[];
    /** 등록된 카테고리 목록 */
    categories(): HubCategory[];
    /** 특정 스킬 레벨의 기본 즐겨찾기 목록 */
    getDefaultFavorites(skillLevel: SkillLevel): FavoriteEntry[];
}
