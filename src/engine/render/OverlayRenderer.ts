/* ─── src/engine/render/OverlayRenderer.ts ─── */
/* 안전구역 / 가이드 / 그리드 / Transform 핸들 오버레이 (Canvas 2D) */
/* 이유: 오버레이는 가벼운 작업이므로 DOM/Canvas2D로 처리.
   WebGPU 캔버스 위에 투명 Canvas를 올려서 그린다. */

export interface SafeZoneConfig {
    actionSafe: boolean;      /* 90% */
    titleSafe: boolean;       /* 80% */
    center: boolean;          /* 십자선 */
    fourThree: boolean;       /* 4:3 영역 */
    snsPreset: string | null; /* 'youtube' | 'tiktok' | 'instagram-reels' | null */
}

export interface GuideConfig {
    grid: '3x3' | '4x4' | 'none';
    horizontalGuides: number[];  /* 0~1 범위의 Y 위치 */
    verticalGuides: number[];    /* 0~1 범위의 X 위치 */
    snapEnabled: boolean;
}

export interface TransformState {
    x: number;      /* 0~1 (중심 기준) */
    y: number;
    width: number;  /* 0~1 */
    height: number;
    rotation: number; /* degrees */
    selected: boolean;
}

/* ═══ SNS 안전 구역 프리셋 ═══ */

interface SnsZone {
    label: string;
    rects: Array<{ x: number; y: number; w: number; h: number; color: string }>;
}

const SNS_PRESETS: Record<string, SnsZone> = {
    youtube: {
        label: 'YouTube',
        rects: [
            /* 하단 자막 영역 */
            { x: 0, y: 0.85, w: 1, h: 0.15, color: 'rgba(255, 0, 0, 0.15)' },
            /* 우하단 워터마크 */
            { x: 0.85, y: 0.85, w: 0.15, h: 0.15, color: 'rgba(255, 0, 0, 0.25)' },
            /* 종료 화면 영역 (마지막 20초) */
            { x: 0.05, y: 0.3, w: 0.9, h: 0.4, color: 'rgba(255, 165, 0, 0.1)' },
        ],
    },
    tiktok: {
        label: 'TikTok',
        rects: [
            /* 하단 설명 + 음악 */
            { x: 0, y: 0.7, w: 0.75, h: 0.3, color: 'rgba(0, 255, 255, 0.15)' },
            /* 우측 버튼 (좋아요/댓글/공유) */
            { x: 0.85, y: 0.25, w: 0.15, h: 0.55, color: 'rgba(0, 255, 255, 0.15)' },
            /* 상단 검색/라이브 */
            { x: 0, y: 0, w: 1, h: 0.08, color: 'rgba(0, 255, 255, 0.1)' },
        ],
    },
    'instagram-reels': {
        label: 'Instagram Reels',
        rects: [
            /* 하단 캡션 */
            { x: 0, y: 0.75, w: 0.8, h: 0.25, color: 'rgba(225, 48, 108, 0.15)' },
            /* 우측 버튼 */
            { x: 0.88, y: 0.35, w: 0.12, h: 0.45, color: 'rgba(225, 48, 108, 0.15)' },
        ],
    },
    shorts: {
        label: 'YouTube Shorts',
        rects: [
            /* 하단 제목/구독 */
            { x: 0, y: 0.78, w: 0.85, h: 0.22, color: 'rgba(255, 0, 0, 0.15)' },
            /* 우측 버튼 */
            { x: 0.88, y: 0.3, w: 0.12, h: 0.5, color: 'rgba(255, 0, 0, 0.15)' },
        ],
    },
};

/* ═══ OverlayRenderer ═══ */

export class OverlayRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Overlay canvas context 생성 실패');
        this.ctx = ctx;
    }

    /** 매 프레임 호출 — 모든 오버레이 그리기 */
    render(
        safeZone: SafeZoneConfig,
        guide: GuideConfig,
        transform: TransformState | null,
        canvasW: number,
        canvasH: number,
    ): void {
        this.canvas.width = canvasW;
        this.canvas.height = canvasH;
        this.ctx.clearRect(0, 0, canvasW, canvasH);

        this.drawSafeZones(safeZone, canvasW, canvasH);
        this.drawGrid(guide, canvasW, canvasH);
        this.drawGuides(guide, canvasW, canvasH);
        this.drawSnsZones(safeZone, canvasW, canvasH);

        if (transform?.selected) {
            this.drawTransformHandles(transform, canvasW, canvasH);
        }
    }

    /* ── 안전 구역 ── */
    private drawSafeZones(cfg: SafeZoneConfig, w: number, h: number): void {
        if (cfg.actionSafe) {
            this.drawDashedRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9, 'rgba(255, 80, 80, 0.6)', [6, 4]);
        }
        if (cfg.titleSafe) {
            this.drawDashedRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8, 'rgba(255, 220, 50, 0.6)', [6, 4]);
        }
        if (cfg.center) {
            const cx = w / 2;
            const cy = h / 2;
            const size = Math.min(w, h) * 0.03;
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
            const safeW = h * (4 / 3);
            const offsetX = (w - safeW) / 2;
            if (safeW < w) {
                this.drawDashedRect(offsetX, 0, safeW, h, 'rgba(80, 150, 255, 0.4)', [8, 4]);
            }
        }
    }

    /* ── SNS 안전 구역 ── */
    private drawSnsZones(cfg: SafeZoneConfig, w: number, h: number): void {
        if (!cfg.snsPreset) return;
        const preset = SNS_PRESETS[cfg.snsPreset];
        if (!preset) return;

        for (const r of preset.rects) {
            this.ctx.fillStyle = r.color;
            this.ctx.fillRect(r.x * w, r.y * h, r.w * w, r.h * h);
        }

        /* 프리셋 라벨 */
        this.ctx.font = '11px sans-serif';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.fillText(preset.label + ' Safe Zone', 8, 16);
    }

    /* ── 그리드 ── */
    private drawGrid(cfg: GuideConfig, w: number, h: number): void {
        if (cfg.grid === 'none') return;
        const divisions = cfg.grid === '3x3' ? 3 : 4;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let i = 1; i < divisions; i++) {
            const x = (w / divisions) * i;
            const y = (h / divisions) * i;
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, h);
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(w, y);
        }
        this.ctx.stroke();
    }

    /* ── 가이드라인 ── */
    private drawGuides(cfg: GuideConfig, w: number, h: number): void {
        this.ctx.strokeStyle = 'rgba(0, 200, 255, 0.6)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (const gy of cfg.horizontalGuides) {
            const y = gy * h;
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(w, y);
        }
        for (const gx of cfg.verticalGuides) {
            const x = gx * w;
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, h);
        }
        this.ctx.stroke();
    }

    /* ── Transform 핸들 ── */
    private drawTransformHandles(t: TransformState, w: number, h: number): void {
        const cx = t.x * w;
        const cy = t.y * h;
        const hw = (t.width * w) / 2;
        const hh = (t.height * h) / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate((t.rotation * Math.PI) / 180);

        /* 바운딩 박스 */
        this.ctx.strokeStyle = 'rgba(0, 150, 255, 0.9)';
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);

        /* 8점 핸들 */
        const handleSize = 6;
        const handleColor = '#ffffff';
        const handleBorder = '#0096ff';
        const handles = [
            [-hw, -hh], [0, -hh], [hw, -hh],
            [-hw, 0], [hw, 0],
            [-hw, hh], [0, hh], [hw, hh],
        ];

        for (const [hx, hy] of handles) {
            this.ctx.fillStyle = handleColor;
            this.ctx.strokeStyle = handleBorder;
            this.ctx.lineWidth = 1.5;
            this.ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
            this.ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        }

        /* 회전 핸들 (상단 중앙 위) */
        const rotY = -hh - 25;
        this.ctx.strokeStyle = 'rgba(0, 150, 255, 0.5)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -hh);
        this.ctx.lineTo(0, rotY);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(0, rotY, 5, 0, Math.PI * 2);
        this.ctx.fillStyle = handleColor;
        this.ctx.fill();
        this.ctx.strokeStyle = handleBorder;
        this.ctx.stroke();

        /* 중심점 */
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(0, 150, 255, 0.7)';
        this.ctx.fill();

        this.ctx.restore();
    }

    /* ── 유틸 ── */
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
