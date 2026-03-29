/* ─── src/engine/render/OverlayRenderer.ts ─── */
/* 안전구역 / 가이드 / 그리드 / Transform 핸들 오버레이 (Canvas 2D) */
/* projectAspect를 받아 영상 영역 안에서만 오버레이를 그린다 */

export interface SafeZoneConfig {
    actionSafe: boolean;
    titleSafe: boolean;
    center: boolean;
    fourThree: boolean;
    snsPreset: string | null;
}

export interface GuideConfig {
    grid: '3x3' | '4x4' | 'none';
    horizontalGuides: number[];
    verticalGuides: number[];
    snapEnabled: boolean;
}

export interface TransformState {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    selected: boolean;
}

interface SnsZone {
    label: string;
    rects: Array<{ x: number; y: number; w: number; h: number; color: string }>;
}

interface VideoRect {
    ox: number;
    oy: number;
    w: number;
    h: number;
}

const SNS_PRESETS: Record<string, SnsZone> = {
    youtube: {
        label: 'YouTube',
        rects: [
            { x: 0, y: 0.85, w: 1, h: 0.15, color: 'rgba(255, 0, 0, 0.15)' },
            { x: 0.85, y: 0.85, w: 0.15, h: 0.15, color: 'rgba(255, 0, 0, 0.25)' },
            { x: 0.05, y: 0.3, w: 0.9, h: 0.4, color: 'rgba(255, 165, 0, 0.1)' },
        ],
    },
    tiktok: {
        label: 'TikTok',
        rects: [
            { x: 0, y: 0.7, w: 0.75, h: 0.3, color: 'rgba(0, 255, 255, 0.15)' },
            { x: 0.85, y: 0.25, w: 0.15, h: 0.55, color: 'rgba(0, 255, 255, 0.15)' },
            { x: 0, y: 0, w: 1, h: 0.08, color: 'rgba(0, 255, 255, 0.1)' },
        ],
    },
    'instagram-reels': {
        label: 'Instagram Reels',
        rects: [
            { x: 0, y: 0.75, w: 0.8, h: 0.25, color: 'rgba(225, 48, 108, 0.15)' },
            { x: 0.88, y: 0.35, w: 0.12, h: 0.45, color: 'rgba(225, 48, 108, 0.15)' },
        ],
    },
    shorts: {
        label: 'YouTube Shorts',
        rects: [
            { x: 0, y: 0.78, w: 0.85, h: 0.22, color: 'rgba(255, 0, 0, 0.15)' },
            { x: 0.88, y: 0.3, w: 0.12, h: 0.5, color: 'rgba(255, 0, 0, 0.15)' },
        ],
    },
};

export class OverlayRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Overlay canvas context 생성 실패');
        this.ctx = ctx;
    }

    render(
        safeZone: SafeZoneConfig,
        guide: GuideConfig,
        transform: TransformState | null,
        canvasW: number,
        canvasH: number,
        projectAspect?: number,
    ): void {
        this.canvas.width = canvasW;
        this.canvas.height = canvasH;
        this.ctx.clearRect(0, 0, canvasW, canvasH);

        const vr = this.calcVideoRect(canvasW, canvasH, projectAspect);

        this.drawSafeZones(safeZone, vr);
        this.drawGrid(guide, vr);
        this.drawGuides(guide, vr);
        this.drawSnsZones(safeZone, vr);

        if (transform?.selected) {
            this.drawTransformHandles(transform, vr);
        }
    }

    private calcVideoRect(cw: number, ch: number, aspect?: number): VideoRect {
        if (!aspect) return { ox: 0, oy: 0, w: cw, h: ch };
        const canvasAspect = cw / ch;
        if (aspect > canvasAspect) {
            const w = cw;
            const h = cw / aspect;
            return { ox: 0, oy: (ch - h) / 2, w, h };
        }
        const h = ch;
        const w = ch * aspect;
        return { ox: (cw - w) / 2, oy: 0, w, h };
    }

    private drawSafeZones(cfg: SafeZoneConfig, v: VideoRect): void {
        if (cfg.actionSafe) {
            this.drawDashedRect(
                v.ox + v.w * 0.05, v.oy + v.h * 0.05,
                v.w * 0.9, v.h * 0.9,
                'rgba(255, 80, 80, 0.6)', [6, 4],
            );
        }
        if (cfg.titleSafe) {
            this.drawDashedRect(
                v.ox + v.w * 0.1, v.oy + v.h * 0.1,
                v.w * 0.8, v.h * 0.8,
                'rgba(255, 220, 50, 0.6)', [6, 4],
            );
        }
        if (cfg.center) {
            const cx = v.ox + v.w / 2;
            const cy = v.oy + v.h / 2;
            const size = Math.min(v.w, v.h) * 0.03;
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(cx - size, cy);
            this.ctx.lineTo(cx + size, cy);
            this.ctx.moveTo(cx, cy - size);
            this.ctx.lineTo(cx, cy + size);
            this.ctx.stroke();
        }
        if (cfg.fourThree) {
            const safeW = v.h * (4 / 3);
            const offsetX = v.ox + (v.w - safeW) / 2;
            if (safeW < v.w) {
                this.drawDashedRect(
                    offsetX, v.oy, safeW, v.h,
                    'rgba(80, 150, 255, 0.4)', [8, 4],
                );
            }
        }
    }

    private drawSnsZones(cfg: SafeZoneConfig, v: VideoRect): void {
        if (!cfg.snsPreset) return;
        const preset = SNS_PRESETS[cfg.snsPreset];
        if (!preset) return;

        for (const r of preset.rects) {
            this.ctx.fillStyle = r.color;
            this.ctx.fillRect(
                v.ox + r.x * v.w, v.oy + r.y * v.h,
                r.w * v.w, r.h * v.h,
            );
        }

        this.ctx.font = '11px sans-serif';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.fillText(preset.label + ' Safe Zone', v.ox + 8, v.oy + 16);
    }

    private drawGrid(cfg: GuideConfig, v: VideoRect): void {
        if (cfg.grid === 'none') return;
        const divisions = cfg.grid === '3x3' ? 3 : 4;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let i = 1; i < divisions; i++) {
            const x = v.ox + (v.w / divisions) * i;
            const y = v.oy + (v.h / divisions) * i;
            this.ctx.moveTo(x, v.oy);
            this.ctx.lineTo(x, v.oy + v.h);
            this.ctx.moveTo(v.ox, y);
            this.ctx.lineTo(v.ox + v.w, y);
        }
        this.ctx.stroke();
    }

    private drawGuides(cfg: GuideConfig, v: VideoRect): void {
        this.ctx.strokeStyle = 'rgba(0, 200, 255, 0.6)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (const gy of cfg.horizontalGuides) {
            const y = v.oy + gy * v.h;
            this.ctx.moveTo(v.ox, y);
            this.ctx.lineTo(v.ox + v.w, y);
        }
        for (const gx of cfg.verticalGuides) {
            const x = v.ox + gx * v.w;
            this.ctx.moveTo(x, v.oy);
            this.ctx.lineTo(x, v.oy + v.h);
        }
        this.ctx.stroke();
    }

    private drawTransformHandles(t: TransformState, v: VideoRect): void {
        const cx = v.ox + t.x * v.w;
        const cy = v.oy + t.y * v.h;
        const hw = (t.width * v.w) / 2;
        const hh = (t.height * v.h) / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate((t.rotation * Math.PI) / 180);

        this.ctx.strokeStyle = 'rgba(0, 150, 255, 0.9)';
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);

        const handleSize = 6;
        const handles = [
            [-hw, -hh], [0, -hh], [hw, -hh],
            [-hw, 0], [hw, 0],
            [-hw, hh], [0, hh], [hw, hh],
        ];

        for (const [hx, hy] of handles) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.strokeStyle = '#0096ff';
            this.ctx.lineWidth = 1.5;
            this.ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
            this.ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        }

        const rotY = -hh - 25;
        this.ctx.strokeStyle = 'rgba(0, 150, 255, 0.5)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -hh);
        this.ctx.lineTo(0, rotY);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(0, rotY, 5, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fill();
        this.ctx.strokeStyle = '#0096ff';
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(0, 0, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(0, 150, 255, 0.7)';
        this.ctx.fill();

        this.ctx.restore();
    }

    private drawDashedRect(
        x: number, y: number, w: number, h: number,
        color: string, dash: number[],
    ): void {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash(dash);
        this.ctx.strokeRect(x, y, w, h);
        this.ctx.setLineDash([]);
    }

    destroy(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
