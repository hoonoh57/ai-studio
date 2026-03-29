/* ─── src/components/Preview/PreviewOverlays.tsx ─── */
/* 오버레이 토글 UI — SNS 안전구역 프리셋 선택 패널 */

import React, { useState, useCallback } from 'react';

export interface OverlaySettings {
    actionSafe: boolean;
    titleSafe: boolean;
    center: boolean;
    fourThree: boolean;
    snsPreset: string | null;
    grid: '3x3' | '4x4' | 'none';
}

interface PreviewOverlaysProps {
    settings: OverlaySettings;
    onChange: (patch: Partial<OverlaySettings>) => void;
    visible: boolean;
    onClose: () => void;
}

const SNS_OPTIONS = [
    { value: null, label: '없음' },
    { value: 'youtube', label: 'YouTube (16:9)' },
    { value: 'tiktok', label: 'TikTok (9:16)' },
    { value: 'instagram-reels', label: 'Instagram Reels' },
    { value: 'shorts', label: 'YouTube Shorts' },
];

const GRID_OPTIONS: Array<{ value: OverlaySettings['grid']; label: string }> = [
    { value: 'none', label: '없음' },
    { value: '3x3', label: '3×3 (삼분할)' },
    { value: '4x4', label: '4×4' },
];

export function PreviewOverlays({ settings, onChange, visible, onClose }: PreviewOverlaysProps) {
    if (!visible) return null;

    const panelStyle: React.CSSProperties = {
        position: 'absolute', top: 36, right: 8, zIndex: 100,
        background: '#1a1a2e', border: '1px solid #333', borderRadius: 6,
        padding: 12, minWidth: 220, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        color: '#ccc', fontSize: 12,
    };

    const rowStyle: React.CSSProperties = {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 0', borderBottom: '1px solid #222',
    };

    const sectionTitle: React.CSSProperties = {
        fontSize: 11, color: '#777', fontWeight: 600,
        marginTop: 8, marginBottom: 4, textTransform: 'uppercase',
    };

    return (
        <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>오버레이 설정</span>
                <button onClick={onClose} style={{
                    background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16,
                }}>✕</button>
            </div>

            {/* 안전 구역 */}
            <div style={sectionTitle}>안전 구역</div>
            <label style={rowStyle}>
                <span>Action Safe (90%)</span>
                <input type="checkbox" checked={settings.actionSafe}
                    onChange={e => onChange({ actionSafe: e.target.checked })} />
            </label>
            <label style={rowStyle}>
                <span>Title Safe (80%)</span>
                <input type="checkbox" checked={settings.titleSafe}
                    onChange={e => onChange({ titleSafe: e.target.checked })} />
            </label>
            <label style={rowStyle}>
                <span>중심 십자선</span>
                <input type="checkbox" checked={settings.center}
                    onChange={e => onChange({ center: e.target.checked })} />
            </label>
            <label style={rowStyle}>
                <span>4:3 영역</span>
                <input type="checkbox" checked={settings.fourThree}
                    onChange={e => onChange({ fourThree: e.target.checked })} />
            </label>

            {/* SNS 안전 구역 */}
            <div style={sectionTitle}>SNS 플랫폼 안전 구역</div>
            <select
                value={settings.snsPreset ?? ''}
                onChange={e => onChange({ snsPreset: e.target.value || null })}
                style={{
                    width: '100%', padding: '4px 6px', background: '#111', color: '#ccc',
                    border: '1px solid #444', borderRadius: 3, fontSize: 12,
                }}
            >
                {SNS_OPTIONS.map(o => (
                    <option key={o.value ?? 'none'} value={o.value ?? ''}>{o.label}</option>
                ))}
            </select>

            {/* 그리드 */}
            <div style={sectionTitle}>그리드</div>
            <select
                value={settings.grid}
                onChange={e => onChange({ grid: e.target.value as OverlaySettings['grid'] })}
                style={{
                    width: '100%', padding: '4px 6px', background: '#111', color: '#ccc',
                    border: '1px solid #444', borderRadius: 3, fontSize: 12,
                }}
            >
                {GRID_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </div>
    );
}
