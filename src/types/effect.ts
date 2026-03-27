/* ─── src/types/effect.ts ─── */
/* 통합 Effect Block 표준 타입 정의 */

import type { EasingType } from './project';

/* ─── 효과 카테고리 ─── */
export type EffectCategory =
    | 'filter'      // 비디오/이미지 필터 (밝기, 블러 등)
    | 'transition'  // 클립 간 전환 (디졸브, 와이프 등)
    | 'audio'       // 오디오 효과 (EQ, 리버브 등)
    | 'text'        // 텍스트 애니메이션
    | 'motion'      // 키프레임 모션
    | 'color'       // 컬러 그레이딩
    | 'speed'       // 속도 변화
    | 'generator';  // 생성기 (솔리드, 노이즈 등)

/* ─── 효과 적용 대상 ─── */
export type EffectTarget =
    | { type: 'clip'; clipId: string }
    | { type: 'transition'; clipAId: string; clipBId: string }
    | { type: 'track'; trackId: string }
    | { type: 'global' };

/* ─── 파라미터 타입 ─── */
export type ParamType =
    | 'number' | 'range' | 'boolean' | 'select'
    | 'color' | 'point2d' | 'point3d' | 'curve'
    | 'text' | 'font' | 'file';

export interface EffectParam {
    key: string;
    label: string;
    type: ParamType;
    value: unknown;
    defaultValue: unknown;
    min?: number;
    max?: number;
    step?: number;
    options?: { value: unknown; label: string }[];
    unit?: string;
    group?: string;
    visible?: boolean;
    animatable?: boolean;
}

/* ─── 효과 키프레임 ─── */
export interface EffectKeyframe {
    id: string;
    time: number;          // 효과 시작 기준 상대 시간 (초)
    paramKey: string;      // 변화시킬 파라미터 key
    value: number;
    easing: EasingType;
    cubicBezier?: [number, number, number, number];
}

/* ─── 렌더 방식 ─── */
export type RenderMethod = 'css' | 'canvas2d' | 'webgl' | 'webaudio' | 'dom';

/* ─── 렌더 컨텍스트 (렌더 함수에 전달) ─── */
export interface EffectRenderContext {
    time: number;           // 효과 시작 기준 상대 시간
    progress: number;       // 0~1 (효과 구간 내 진행률)
    params: Record<string, unknown>;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    inputA: CanvasImageSource | null;  // 첫 번째 입력 (비디오/이미지)
    inputB: CanvasImageSource | null;  // 두 번째 입력 (전환용)
    width: number;
    height: number;
    fps: number;
}

/* ─── 렌더 결과 타입 ─── */
export type EffectRenderResult =
    | { type: 'css'; from?: React.CSSProperties; to?: React.CSSProperties }
    | { type: 'canvas'; draw: (ctx: CanvasRenderingContext2D) => void }
    | { type: 'audio'; apply: (audioCtx: AudioContext, source: AudioNode) => AudioNode }
    | { type: 'noop' };

/* ─── 렌더 함수 시그니처 ─── */
export type EffectRenderFn = (ctx: EffectRenderContext) => EffectRenderResult;

/* ─── 효과 정의 (설계도 — 레지스트리에 등록) ─── */
export interface EffectDefinition {
    id: string;                    // e.g. 'filter.brightness', 'transition.dissolve'
    name: string;                  // e.g. 'Brightness', 'Dissolve'
    category: EffectCategory;
    icon: string;
    description: string;
    tags: string[];
    inputCount: 1 | 2;            // 1=단일 클립, 2=전환(두 클립)
    params: EffectParam[];
    renderMethod: RenderMethod;
    render: EffectRenderFn;
    thumbnail?: string;
    author?: string;
    version?: string;
}

/* ─── 효과 인스턴스 (실제 적용된 효과) ─── */
export interface EffectInstance {
    id: string;
    definitionId: string;           // EffectDefinition.id 참조
    target: EffectTarget;
    startTime: number;              // 절대 시작 시간 (초)
    duration: number;               // 효과 지속 시간 (초)
    enabled: boolean;
    params: Record<string, unknown>;
    keyframes: EffectKeyframe[];
    order: number;                  // 효과 스택 순서
    blendMode?: string;
    opacity?: number;               // 효과 강도 (0~1 mix)
}

/* ─── Canvas 렌더러 프레임 상태 ─── */
export interface FrameState {
    videoA: HTMLVideoElement | null;
    videoB: HTMLVideoElement | null;
    imageA: HTMLImageElement | null;
    imageB: HTMLImageElement | null;
    videoAReady: boolean;
    videoBReady: boolean;
    lastFrameTime: number;
}

/* ─── 효과 레지스트리 인터페이스 ─── */
export interface IEffectRegistry {
    register(def: EffectDefinition): void;
    get(id: string): EffectDefinition | undefined;
    list(category?: EffectCategory): EffectDefinition[];
    search(query: string): EffectDefinition[];
    categories(): EffectCategory[];
}
