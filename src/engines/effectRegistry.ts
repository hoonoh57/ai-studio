/* ─── src/engines/effectRegistry.ts ─── */
/* 통합 효과 레지스트리 + 기본 효과 등록 */

import type {
    EffectDefinition, EffectCategory, IEffectRegistry,
    EffectRenderContext, EffectRenderResult, EffectParam,
} from '@/types/effect';

/* ════════════════════════════════════════
   레지스트리 구현
   ════════════════════════════════════════ */
const registry = new Map<string, EffectDefinition>();

export const effectRegistry: IEffectRegistry = {
    register(def: EffectDefinition) {
        if (registry.has(def.id)) {
            console.warn(`[EffectRegistry] overwriting: ${def.id}`);
        }
        registry.set(def.id, def);
    },

    get(id: string) {
        return registry.get(id);
    },

    list(category?: EffectCategory) {
        const all = Array.from(registry.values());
        return category ? all.filter(d => d.category === category) : all;
    },

    search(query: string) {
        const q = query.toLowerCase();
        return Array.from(registry.values()).filter(d =>
            d.name.toLowerCase().includes(q) ||
            d.tags.some(t => t.toLowerCase().includes(q)) ||
            d.description.toLowerCase().includes(q)
        );
    },

    categories() {
        const cats = new Set<EffectCategory>();
        registry.forEach(d => cats.add(d.category));
        return Array.from(cats);
    },
};

/* ════════════════════════════════════════
   헬퍼: 파라미터 정의 단축 함수
   ════════════════════════════════════════ */
function rangeParam(
    key: string, label: string, defaultValue: number,
    min: number, max: number, step: number, unit = '',
): EffectParam {
    return {
        key, label, type: 'range', value: defaultValue, defaultValue,
        min, max, step, unit, animatable: true,
    };
}

/* ════════════════════════════════════════
   Canvas 헬퍼
   ════════════════════════════════════════ */
/** inputA를 canvas 전체에 그리기 */
function drawFull(ctx: CanvasRenderingContext2D, src: CanvasImageSource | null, w: number, h: number) {
    if (!src) return;
    try { ctx.drawImage(src, 0, 0, w, h); } catch { /* 프레임 미준비 시 무시 */ }
}

/* ════════════════════════════════════════
   ▸ FILTER 효과 등록 (13종)
   ════════════════════════════════════════ */
const FILTERS: Array<{
    id: string; name: string; icon: string; desc: string;
    param: EffectParam; cssFn: (v: number) => string;
}> = [
        {
            id: 'filter.brightness', name: 'Brightness', icon: '☀️', desc: '밝기 조절',
            param: rangeParam('value', 'Brightness', 0, -100, 100, 1, '%'),
            cssFn: v => `brightness(${1 + v / 100})`
        },
        {
            id: 'filter.contrast', name: 'Contrast', icon: '◑', desc: '대비 조절',
            param: rangeParam('value', 'Contrast', 0, -100, 100, 1, '%'),
            cssFn: v => `contrast(${1 + v / 100})`
        },
        {
            id: 'filter.saturate', name: 'Saturation', icon: '🎨', desc: '채도 조절',
            param: rangeParam('value', 'Saturation', 0, -100, 100, 1, '%'),
            cssFn: v => `saturate(${1 + v / 100})`
        },
        {
            id: 'filter.hue-rotate', name: 'Hue Shift', icon: '🌈', desc: '색조 회전',
            param: rangeParam('value', 'Hue', 0, -180, 180, 1, '°'),
            cssFn: v => `hue-rotate(${v}deg)`
        },
        {
            id: 'filter.blur', name: 'Blur', icon: '🌫️', desc: '흐림 효과',
            param: rangeParam('value', 'Radius', 0, 0, 50, 0.5, 'px'),
            cssFn: v => `blur(${v}px)`
        },
        {
            id: 'filter.grayscale', name: 'Grayscale', icon: '🔲', desc: '흑백 변환',
            param: rangeParam('value', 'Amount', 0, 0, 100, 1, '%'),
            cssFn: v => `grayscale(${v / 100})`
        },
        {
            id: 'filter.sepia', name: 'Sepia', icon: '📜', desc: '세피아 톤',
            param: rangeParam('value', 'Amount', 0, 0, 100, 1, '%'),
            cssFn: v => `sepia(${v / 100})`
        },
        {
            id: 'filter.invert', name: 'Invert', icon: '🔄', desc: '색상 반전',
            param: rangeParam('value', 'Amount', 0, 0, 100, 1, '%'),
            cssFn: v => `invert(${v / 100})`
        },
        {
            id: 'filter.opacity', name: 'Opacity', icon: '◐', desc: '불투명도',
            param: rangeParam('value', 'Opacity', 100, 0, 100, 1, '%'),
            cssFn: v => `opacity(${v / 100})`
        },
        {
            id: 'filter.drop-shadow', name: 'Drop Shadow', icon: '🔳', desc: '그림자',
            param: rangeParam('value', 'Size', 0, 0, 50, 1, 'px'),
            cssFn: v => `drop-shadow(${v}px ${v}px ${v}px rgba(0,0,0,0.5))`
        },
        {
            id: 'filter.vignette', name: 'Vignette', icon: '🔅', desc: '비네팅',
            param: rangeParam('value', 'Amount', 0, 0, 100, 1, '%'),
            cssFn: v => `brightness(${1 - v / 200})`
        },
        {
            id: 'filter.sharpen', name: 'Sharpen', icon: '🔍', desc: '선명하게',
            param: rangeParam('value', 'Amount', 0, 0, 100, 1, '%'),
            cssFn: v => `contrast(${1 + v / 200})`
        },
        {
            id: 'filter.noise', name: 'Noise', icon: '📺', desc: '노이즈',
            param: rangeParam('value', 'Amount', 0, 0, 100, 1, '%'),
            cssFn: v => `opacity(${1 - v / 100})`
        },
    ];

FILTERS.forEach(f => {
    effectRegistry.register({
        id: f.id,
        name: f.name,
        category: 'filter',
        icon: f.icon,
        description: f.desc,
        tags: ['filter', f.name.toLowerCase()],
        inputCount: 1,
        params: [f.param],
        renderMethod: 'canvas2d',
        render(rc: EffectRenderContext): EffectRenderResult {
            const v = (rc.params.value as number) ?? 0;
            const filterStr = f.cssFn(v);
            return {
                type: 'canvas',
                draw(ctx) {
                    ctx.save();
                    ctx.filter = filterStr;
                    drawFull(ctx, rc.inputA, rc.width, rc.height);
                    ctx.restore();
                },
            };
        },
    });
});

/* ════════════════════════════════════════
   ▸ TRANSITION 효과 등록 (12종)
   ════════════════════════════════════════ */
interface TransitionDef {
    id: string; name: string; icon: string; desc: string;
    draw: (ctx: CanvasRenderingContext2D, a: CanvasImageSource | null, b: CanvasImageSource | null, p: number, w: number, h: number) => void;
}

const TRANSITIONS: TransitionDef[] = [
    {
        id: 'transition.dissolve', name: 'Dissolve', icon: '🌊', desc: '디졸브',
        draw(ctx, a, b, p, w, h) {
            ctx.globalAlpha = 1;
            drawFull(ctx, a, w, h);
            ctx.globalAlpha = p;
            drawFull(ctx, b, w, h);
            ctx.globalAlpha = 1;
        },
    },
    {
        id: 'transition.fade-black', name: 'Fade Black', icon: '⬛', desc: '페이드 블랙',
        draw(ctx, a, b, p, w, h) {
            if (p < 0.5) {
                ctx.globalAlpha = 1 - p * 2;
                drawFull(ctx, a, w, h);
            } else {
                ctx.globalAlpha = (p - 0.5) * 2;
                drawFull(ctx, b, w, h);
            }
            ctx.globalAlpha = 1;
        },
    },
    {
        id: 'transition.fade-white', name: 'Fade White', icon: '⬜', desc: '페이드 화이트',
        draw(ctx, a, b, p, w, h) {
            if (p < 0.5) {
                drawFull(ctx, a, w, h);
                ctx.globalAlpha = p * 2;
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, w, h);
            } else {
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, w, h);
                ctx.globalAlpha = (p - 0.5) * 2;
                drawFull(ctx, b, w, h);
            }
            ctx.globalAlpha = 1;
        },
    },
    {
        id: 'transition.wipe-left', name: 'Wipe Left', icon: '◀', desc: '왼쪽 와이프',
        draw(ctx, a, b, p, w, h) {
            const split = Math.round(w * (1 - p));
            drawFull(ctx, a, w, h);
            ctx.save();
            ctx.beginPath();
            ctx.rect(split, 0, w - split, h);
            ctx.clip();
            drawFull(ctx, b, w, h);
            ctx.restore();
        },
    },
    {
        id: 'transition.wipe-right', name: 'Wipe Right', icon: '▶', desc: '오른쪽 와이프',
        draw(ctx, a, b, p, w, h) {
            const split = Math.round(w * p);
            drawFull(ctx, a, w, h);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, split, h);
            ctx.clip();
            drawFull(ctx, b, w, h);
            ctx.restore();
        },
    },
    {
        id: 'transition.wipe-up', name: 'Wipe Up', icon: '🔼', desc: '위쪽 와이프',
        draw(ctx, a, b, p, w, h) {
            const split = Math.round(h * (1 - p));
            drawFull(ctx, a, w, h);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, split, w, h - split);
            ctx.clip();
            drawFull(ctx, b, w, h);
            ctx.restore();
        },
    },
    {
        id: 'transition.wipe-down', name: 'Wipe Down', icon: '🔽', desc: '아래쪽 와이프',
        draw(ctx, a, b, p, w, h) {
            const split = Math.round(h * p);
            drawFull(ctx, a, w, h);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, w, split);
            ctx.clip();
            drawFull(ctx, b, w, h);
            ctx.restore();
        },
    },
    {
        id: 'transition.slide-left', name: 'Slide Left', icon: '⏪', desc: '슬라이드 왼쪽',
        draw(ctx, a, b, p, w, h) {
            const offset = Math.round(w * p);
            ctx.save();
            ctx.translate(-offset, 0);
            drawFull(ctx, a, w, h);
            ctx.translate(w, 0);
            drawFull(ctx, b, w, h);
            ctx.restore();
        },
    },
    {
        id: 'transition.slide-right', name: 'Slide Right', icon: '⏩', desc: '슬라이드 오른쪽',
        draw(ctx, a, b, p, w, h) {
            const offset = Math.round(w * p);
            ctx.save();
            ctx.translate(offset, 0);
            drawFull(ctx, a, w, h);
            ctx.translate(-w, 0);
            drawFull(ctx, b, w, h);
            ctx.restore();
        },
    },
    {
        id: 'transition.zoom-in', name: 'Zoom In', icon: '🔍', desc: '줌 인',
        draw(ctx, a, b, p, w, h) {
            ctx.save();
            const s = 1 + p * 0.5;
            ctx.globalAlpha = 1 - p;
            ctx.translate(w / 2, h / 2);
            ctx.scale(s, s);
            ctx.translate(-w / 2, -h / 2);
            drawFull(ctx, a, w, h);
            ctx.restore();
            ctx.save();
            const s2 = 0.5 + p * 0.5;
            ctx.globalAlpha = p;
            ctx.translate(w / 2, h / 2);
            ctx.scale(s2, s2);
            ctx.translate(-w / 2, -h / 2);
            drawFull(ctx, b, w, h);
            ctx.restore();
        },
    },
    {
        id: 'transition.zoom-out', name: 'Zoom Out', icon: '🔎', desc: '줌 아웃',
        draw(ctx, a, b, p, w, h) {
            ctx.save();
            const s = 1 - p * 0.3;
            ctx.globalAlpha = 1 - p;
            ctx.translate(w / 2, h / 2);
            ctx.scale(s, s);
            ctx.translate(-w / 2, -h / 2);
            drawFull(ctx, a, w, h);
            ctx.restore();
            ctx.save();
            const s2 = 1.3 - p * 0.3;
            ctx.globalAlpha = p;
            ctx.translate(w / 2, h / 2);
            ctx.scale(s2, s2);
            ctx.translate(-w / 2, -h / 2);
            drawFull(ctx, b, w, h);
            ctx.restore();
        },
    },
    {
        id: 'transition.blur', name: 'Blur', icon: '🌫', desc: '블러 전환',
        draw(ctx, a, b, p, w, h) {
            ctx.save();
            ctx.filter = `blur(${p * 20}px)`;
            ctx.globalAlpha = 1 - p;
            drawFull(ctx, a, w, h);
            ctx.restore();
            ctx.save();
            ctx.filter = `blur(${(1 - p) * 20}px)`;
            ctx.globalAlpha = p;
            drawFull(ctx, b, w, h);
            ctx.restore();
        },
    },
];

TRANSITIONS.forEach(t => {
    effectRegistry.register({
        id: t.id,
        name: t.name,
        category: 'transition',
        icon: t.icon,
        description: t.desc,
        tags: ['transition', t.name.toLowerCase()],
        inputCount: 2,
        params: [
            rangeParam('duration', 'Duration', 1, 0.1, 5, 0.1, 's'),
        ],
        renderMethod: 'canvas2d',
        render(rc: EffectRenderContext): EffectRenderResult {
            return {
                type: 'canvas',
                draw(ctx) {
                    t.draw(ctx, rc.inputA, rc.inputB, rc.progress, rc.width, rc.height);
                },
            };
        },
    });
});

/* ════════════════════════════════════════
   ▸ MOTION 효과 등록 (5종)
   ════════════════════════════════════════ */
const MOTIONS: Array<{
    id: string; name: string; icon: string; desc: string;
    param: EffectParam;
}> = [
        {
            id: 'motion.x', name: 'Position X', icon: '↔', desc: 'X 이동',
            param: rangeParam('value', 'X', 0, -1920, 1920, 1, 'px')
        },
        {
            id: 'motion.y', name: 'Position Y', icon: '↕', desc: 'Y 이동',
            param: rangeParam('value', 'Y', 0, -1080, 1080, 1, 'px')
        },
        {
            id: 'motion.scale', name: 'Scale', icon: '⊞', desc: '크기',
            param: rangeParam('value', 'Scale', 1, 0, 5, 0.01, '×')
        },
        {
            id: 'motion.rotation', name: 'Rotation', icon: '↻', desc: '회전',
            param: rangeParam('value', 'Angle', 0, -360, 360, 1, '°')
        },
        {
            id: 'motion.opacity', name: 'Opacity', icon: '◐', desc: '투명도',
            param: rangeParam('value', 'Opacity', 1, 0, 1, 0.01, '')
        },
    ];

MOTIONS.forEach(m => {
    effectRegistry.register({
        id: m.id,
        name: m.name,
        category: 'motion',
        icon: m.icon,
        description: m.desc,
        tags: ['motion', 'keyframe', m.name.toLowerCase()],
        inputCount: 1,
        params: [m.param],
        renderMethod: 'canvas2d',
        render(rc: EffectRenderContext): EffectRenderResult {
            const v = (rc.params.value as number) ?? (m.param.defaultValue as number);
            return {
                type: 'canvas',
                draw(ctx) {
                    ctx.save();
                    switch (m.id) {
                        case 'motion.x':
                            ctx.translate(v, 0);
                            break;
                        case 'motion.y':
                            ctx.translate(0, v);
                            break;
                        case 'motion.scale':
                            ctx.translate(rc.width / 2, rc.height / 2);
                            ctx.scale(v, v);
                            ctx.translate(-rc.width / 2, -rc.height / 2);
                            break;
                        case 'motion.rotation':
                            ctx.translate(rc.width / 2, rc.height / 2);
                            ctx.rotate((v * Math.PI) / 180);
                            ctx.translate(-rc.width / 2, -rc.height / 2);
                            break;
                        case 'motion.opacity':
                            ctx.globalAlpha = v;
                            break;
                    }
                    drawFull(ctx, rc.inputA, rc.width, rc.height);
                    ctx.restore();
                },
            };
        },
    });
});

/* ════════════════════════════════════════
   ▸ AUDIO 효과 등록 (2종)
   ════════════════════════════════════════ */
effectRegistry.register({
    id: 'audio.volume',
    name: 'Volume',
    category: 'audio',
    icon: '🔊',
    description: '볼륨 조절',
    tags: ['audio', 'volume'],
    inputCount: 1,
    params: [rangeParam('value', 'Volume', 1, 0, 2, 0.01, '×')],
    renderMethod: 'webaudio',
    render(rc: EffectRenderContext): EffectRenderResult {
        const v = (rc.params.value as number) ?? 1;
        return {
            type: 'audio',
            apply(audioCtx, source) {
                const gain = audioCtx.createGain();
                gain.gain.value = v;
                source.connect(gain);
                return gain;
            },
        };
    },
});

effectRegistry.register({
    id: 'audio.fade',
    name: 'Fade',
    category: 'audio',
    icon: '📈',
    description: '페이드 인/아웃',
    tags: ['audio', 'fade'],
    inputCount: 1,
    params: [
        rangeParam('fadeIn', 'Fade In', 0, 0, 10, 0.1, 's'),
        rangeParam('fadeOut', 'Fade Out', 0, 0, 10, 0.1, 's'),
    ],
    renderMethod: 'webaudio',
    render(rc: EffectRenderContext): EffectRenderResult {
        const fadeIn = (rc.params.fadeIn as number) ?? 0;
        const fadeOut = (rc.params.fadeOut as number) ?? 0;
        const dur = rc.progress; // 0~1 기반
        let vol = 1;
        if (fadeIn > 0 && rc.time < fadeIn) vol = rc.time / fadeIn;
        // fadeOut은 duration 기준이므로 progress로 계산
        if (fadeOut > 0 && rc.progress > 1 - fadeOut) {
            vol = Math.min(vol, (1 - rc.progress) / fadeOut);
        }
        return {
            type: 'audio',
            apply(audioCtx, source) {
                const gain = audioCtx.createGain();
                gain.gain.value = Math.max(0, Math.min(1, vol));
                source.connect(gain);
                return gain;
            },
        };
    },
});

/* ════════════════════════════════════════
   export
   ════════════════════════════════════════ */
export { effectRegistry as default };
