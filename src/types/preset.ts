/* ─── src/types/preset.ts ─── */
import type { KeyframeProperty, EasingType } from './project';

/* ════════════════════════════════════════
   1. 프리셋 키프레임 — 시간을 비율(0~1)로 정의
   ════════════════════════════════════════ */
export interface PresetKeyframe {
    /** 클립 내 위치 비율 (0 = 시작, 1 = 끝) */
    position: number;
    /** 값 (절대값 또는 상대값 — mode에 따라 해석) */
    value: number;
    /** 이징 */
    easing: EasingType;
}

export interface PresetTrack {
    property: KeyframeProperty;
    keyframes: PresetKeyframe[];
    /** 'absolute': value를 그대로 사용, 'relative': 클립 현재값에 더함 */
    mode: 'absolute' | 'relative';
}

/* ════════════════════════════════════════
   2. 프리셋 정의
   ════════════════════════════════════════ */
export type PresetCategory =
    | 'entrance'      // 등장 (Slide In, Fade In, Pop)
    | 'exit'          // 퇴장 (Slide Out, Fade Out, Shrink)
    | 'emphasis'      // 강조 (Pulse, Shake, Flash)
    | 'transition'    // 장면 전환 보조 (Cross Zoom, Whip Pan)
    | 'cinematic'     // 시네마틱 (Ken Burns, Dolly, Parallax)
    | 'social'        // 소셜 미디어 (TikTok Zoom, Reels Bounce)
    | 'correction'    // 보정 (Auto Brightness, Smooth Color)
    | 'custom';       // 사용자 정의

export type PresetDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type ContentGenre =
    | 'vlog' | 'interview' | 'tutorial' | 'cinematic'
    | 'music-video' | 'documentary' | 'social-short'
    | 'product-review' | 'gaming' | 'wedding' | 'corporate';

export interface MotionPreset {
    /** 고유 ID (빌트인: "builtin.entrance.fade-in", 사용자: "user.xxx") */
    id: string;
    /** 표시 이름 */
    name: string;
    /** 설명 */
    description: string;
    /** 카테고리 */
    category: PresetCategory;
    /** 추천 장르 태그 */
    genres: ContentGenre[];
    /** 난이도 — 스킬 레벨 기반 필터링에 사용 */
    difficulty: PresetDifficulty;
    /** 인기도 (0~100, 추천 정렬용) */
    popularity: number;
    /** 키프레임 트랙 배열 */
    tracks: PresetTrack[];
    /** 기본 적용 구간 비율 (0~1, 기본 1 = 클립 전체) */
    defaultSpan: number;
    /** 프리셋 적용 방향: 'start' = 클립 시작부터, 'end' = 클립 끝부터, 'full' = 전체 */
    anchor: 'start' | 'end' | 'full';
    /** 미리보기 썸네일 (선택) */
    thumbnail?: string;
    /** 빌트인 여부 */
    builtin: boolean;
    /** 생성자 (사용자 프리셋일 때) */
    author?: string;
    /** 생성 시각 */
    createdAt: number;
    /** 태그 (검색용) */
    tags: string[];
    /** 버전 */
    version: number;
}

/* ════════════════════════════════════════
   3. 프리셋 컬렉션 (사용자 그룹)
   ════════════════════════════════════════ */
export interface PresetCollection {
    id: string;
    name: string;
    description: string;
    presetIds: string[];
    createdAt: number;
}

/* ════════════════════════════════════════
   4. 프리셋 추천 컨텍스트
   ════════════════════════════════════════ */
export interface PresetRecommendContext {
    /** 현재 선택된 클립의 길이 */
    clipDuration: number;
    /** 클립 위치 (타임라인 전체 대비 비율) */
    clipPosition: number;
    /** 이전 클립 존재 여부 */
    hasPrevClip: boolean;
    /** 다음 클립 존재 여부 */
    hasNextClip: boolean;
    /** 사용자 스킬 레벨 */
    skillLevel: PresetDifficulty;
    /** 프로젝트 장르 (사용자 설정) */
    genre?: ContentGenre;
}
