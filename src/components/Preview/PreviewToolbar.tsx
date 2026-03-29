/* ─── src/components/Preview/PreviewToolbar.tsx ─── */
/* 재생 컨트롤 + 타임코드 + 줌 + 해상도 + 안전구역 토글 */

import React, { useCallback, useState } from 'react';

export interface PreviewToolbarProps {
    currentTime: number;
    isPlaying: boolean;
    fps: number;
    duration: number;
    zoom: string;
    playbackRes: string;
    onTogglePlay: () => void;
    onStepFrame: (dir: number) => void;
    onGoToStart: () => void;
    onGoToEnd: () => void;
    onSetTime: (t: number) => void;
    onZoomChange: (z: string) => void;
    onResChange: (r: string) => void;
    onToggleSafeZone: () => void;
    onToggleGrid: () => void;
    onToggleFullscreen: () => void;
    onExportFrame: () => void;
    safeZoneVisible: boolean;
    gridVisible: boolean;
    tierLabel: string;
    gpuName: string;
}

const ZOOM_OPTIONS = ['Fit', '25%', '50%', '75%', '100%', '150%', '200%', '400%'];
const RES_OPTIONS = ['Full', '1/2', '1/4', '1/8'];

function formatTimecode(t: number, fps: number): string {
    const totalFrames = Math.floor(t * fps);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    const f = totalFrames % fps;
    return (
        String(h).padStart(2, '0') + ':' +
        String(m).padStart(2, '0') + ':' +
        String(s).padStart(2, '0') + ':' +
        String(f).padStart(2, '0')
    );
}

export function PreviewToolbar(props: PreviewToolbarProps) {
    const {
        currentTime, isPlaying, fps, duration,
        zoom, playbackRes,
        onTogglePlay, onStepFrame, onGoToStart, onGoToEnd, onSetTime,
        onZoomChange, onResChange,
        onToggleSafeZone, onToggleGrid, onToggleFullscreen, onExportFrame,
        safeZoneVisible, gridVisible,
        tierLabel, gpuName,
    } = props;

    const [editingTc, setEditingTc] = useState(false);
    const [tcInput, setTcInput] = useState('');

    const handleTcSubmit = useCallback(() => {
        const parts = tcInput.split(':').map(Number);
        if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
            const [h, m, s, f] = parts;
            const time = h * 3600 + m * 60 + s + f / fps;
            onSetTime(Math.min(time, duration));
        }
        setEditingTc(false);
    }, [tcInput, fps, duration, onSetTime]);

    const tb: React.CSSProperties = {
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 8px', background: '#0d0d1a',
        borderTop: '1px solid #222', fontSize: 12, color: '#ccc',
        flexWrap: 'wrap',
    };

    const btn: React.CSSProperties = {
        background: 'transparent', border: '1px solid #444', color: '#ccc',
        borderRadius: 3, padding: '3px 8px', cursor: 'pointer', fontSize: 13,
    };

    const btnActive: React.CSSProperties = {
        ...btn, background: '#0066cc', borderColor: '#0088ff', color: '#fff',
    };

    const sel: React.CSSProperties = {
        background: '#1a1a2e', border: '1px solid #444', color: '#ccc',
        borderRadius: 3, padding: '2px 4px', fontSize: 11, cursor: 'pointer',
    };

    return (
        <div style={tb}>
            {/* 재생 컨트롤 */}
            <button style={btn} onClick={onGoToStart} title="처음으로 (Home)">⏮</button>
            <button style={btn} onClick={() => onStepFrame(-1)} title="이전 프레임 (←)">⏪</button>
            <button style={{ ...btn, fontSize: 16, padding: '3px 12px' }} onClick={onTogglePlay} title="재생/정지 (Space)">
                {isPlaying ? '⏸' : '▶'}
            </button>
            <button style={btn} onClick={() => onStepFrame(1)} title="다음 프레임 (→)">⏩</button>
            <button style={btn} onClick={onGoToEnd} title="끝으로 (End)">⏭</button>

            {/* 구분선 */}
            <div style={{ width: 1, height: 20, background: '#333', margin: '0 4px' }} />

            {/* 타임코드 */}
            {editingTc ? (
                <input
                    autoFocus
                    style={{ fontFamily: 'monospace', fontSize: 12, width: 100, background: '#111', color: '#fff', border: '1px solid #0088ff', borderRadius: 2, padding: '1px 4px' }}
                    value={tcInput}
                    onChange={(e) => setTcInput(e.target.value)}
                    onBlur={() => handleTcSubmit()}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleTcSubmit(); if (e.key === 'Escape') setEditingTc(false); }}
                />
            ) : (
                <span
                    style={{ fontFamily: 'monospace', fontSize: 12, cursor: 'pointer', color: '#aaa', padding: '1px 4px', borderRadius: 2, background: '#111' }}
                    onClick={() => { setTcInput(formatTimecode(currentTime, fps)); setEditingTc(true); }}
                    title="클릭하여 타임코드 입력"
                >
                    {formatTimecode(currentTime, fps)}
                </span>
            )}

            <span style={{ fontSize: 10, color: '#555', marginLeft: 2 }}>
                / {formatTimecode(duration, fps)}
            </span>

            {/* 구분선 */}
            <div style={{ width: 1, height: 20, background: '#333', margin: '0 4px' }} />

            {/* 줌 */}
            <select style={sel} value={zoom} onChange={(e) => onZoomChange(e.target.value)} title="줌">
                {ZOOM_OPTIONS.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>

            {/* 재생 해상도 */}
            <select style={sel} value={playbackRes} onChange={(e) => onResChange(e.target.value)} title="재생 해상도">
                {RES_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>

            {/* 구분선 */}
            <div style={{ width: 1, height: 20, background: '#333', margin: '0 4px' }} />

            {/* 오버레이 토글 */}
            <button style={safeZoneVisible ? btnActive : btn} onClick={onToggleSafeZone} title="안전 구역">
                [ ]
            </button>
            <button style={gridVisible ? btnActive : btn} onClick={onToggleGrid} title="그리드">
                #
            </button>
            <button style={btn} onClick={onExportFrame} title="프레임 내보내기">
                📷
            </button>
            <button style={btn} onClick={onToggleFullscreen} title="전체 화면">
                ⛶
            </button>

            {/* GPU 상태 */}
            <div style={{ marginLeft: 'auto', fontSize: 10, color: '#555' }} title={gpuName}>
                {tierLabel}
            </div>
        </div>
    );
}
