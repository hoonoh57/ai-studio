/* ─── src/components/Presets/PresetPanel.tsx ─── */
/* P2: 모션 프리셋 브라우저 — 카테고리 필터, 검색, 원클릭 적용 */

import React, { useState, useMemo, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import {
    getAllPresets,
    getPresetsByCategory,
    searchPresets,
    applyPresetToClip,
} from '@/presets/presetEngine';
import type { MotionPreset, PresetCategory } from '@/types/preset';

/* ═══════════════════════════════════════════
   상수
   ═══════════════════════════════════════════ */

const CATEGORIES: { id: PresetCategory | 'all'; label: string; icon: string }[] = [
    { id: 'all', label: '전체', icon: '⊕' },
    { id: 'entrance', label: '등장', icon: '➡️' },
    { id: 'exit', label: '퇴장', icon: '⬅️' },
    { id: 'emphasis', label: '강조', icon: '💥' },
    { id: 'cinematic', label: '시네마틱', icon: '🎥' },
    { id: 'social', label: '소셜', icon: '📱' },
    { id: 'correction', label: '보정', icon: '🎛️' },
    { id: 'custom', label: '커스텀', icon: '⚙️' },
];

const DIFFICULTY_COLORS: Record<string, string> = {
    beginner: '#50C878',
    intermediate: '#4A90D9',
    advanced: '#FFB347',
    expert: '#DA70D6',
};

/* ═══════════════════════════════════════════
   스타일
   ═══════════════════════════════════════════ */

const S: Record<string, React.CSSProperties> = {
    root: {
        width: '100%', height: '100%', display: 'flex',
        flexDirection: 'column', background: 'var(--bg-panel)',
        color: 'var(--text-primary)', overflow: 'hidden', userSelect: 'none',
    },
    header: {
        height: 36, padding: '0 12px', fontSize: 12, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
    },
    toolbar: {
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '6px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0,
    },
    searchInput: {
        flex: 1, height: 26, padding: '0 8px', fontSize: 11,
        background: 'var(--bg-deep)', border: '1px solid var(--border)',
        borderRadius: 4, color: 'var(--text-primary)', outline: 'none',
    },
    catBar: {
        display: 'flex', gap: 3, padding: '4px 8px',
        overflowX: 'auto', flexShrink: 0, borderBottom: '1px solid var(--border)',
    },
    catChip: {
        height: 22, padding: '0 8px', fontSize: 10, borderRadius: 11,
        border: '1px solid var(--border)', background: 'transparent',
        color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap',
        flexShrink: 0, transition: 'all 0.15s',
    },
    catChipActive: {
        background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)',
    },
    list: { flex: 1, overflowY: 'auto', padding: 8 },
    grid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
    card: {
        width: 90, padding: '8px 6px', borderRadius: 6,
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        cursor: 'pointer', textAlign: 'center', fontSize: 10,
        color: 'var(--text-secondary)', transition: 'border-color 0.15s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    },
    cardName: {
        fontSize: 10, fontWeight: 500, whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis', width: '100%',
    },
    cardMeta: { fontSize: 8, opacity: 0.6 },
    diffDot: {
        width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
    },
    noClip: {
        padding: 20, textAlign: 'center', color: '#555', fontSize: 12,
    },
    statusBar: {
        padding: '6px 12px', borderTop: '1px solid var(--border)',
        fontSize: 10, color: '#666', flexShrink: 0,
        display: 'flex', justifyContent: 'space-between',
    },
};

/* ═══════════════════════════════════════════
   컴포넌트
   ═══════════════════════════════════════════ */

export function PresetPanel(): React.ReactElement {
    const selectedClipId = useEditorStore(s => s.selectedClipId);
    const [query, setQuery] = useState('');
    const [activeCat, setActiveCat] = useState<PresetCategory | 'all'>('all');
    const [appliedId, setAppliedId] = useState<string | null>(null);

    const presets: MotionPreset[] = useMemo(() => {
        if (query.trim()) return searchPresets(query);
        if (activeCat === 'all') return getAllPresets();
        return getPresetsByCategory(activeCat);
    }, [query, activeCat]);

    const handleApply = useCallback((presetId: string) => {
        if (!selectedClipId) return;
        const ok = applyPresetToClip(presetId, selectedClipId);
        if (ok) {
            setAppliedId(presetId);
            setTimeout(() => setAppliedId(null), 1200);
        }
    }, [selectedClipId]);

    return (
        <div style={S.root}>
            {/* 헤더 */}
            <div style={S.header}>
                <span>Motion Presets</span>
                <span style={{ opacity: 0.5, fontWeight: 400 }}>{presets.length}개</span>
            </div>

            {/* 검색 */}
            <div style={S.toolbar}>
                <input
                    style={S.searchInput}
                    placeholder="프리셋 검색…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
            </div>

            {/* 카테고리 */}
            <div style={S.catBar}>
                {CATEGORIES.map(c => (
                    <button
                        key={c.id}
                        style={{ ...S.catChip, ...(activeCat === c.id ? S.catChipActive : {}) }}
                        onClick={() => { setActiveCat(c.id); setQuery(''); }}
                    >
                        {c.icon} {c.label}
                    </button>
                ))}
            </div>

            {/* 프리셋 목록 */}
            <div style={S.list}>
                {!selectedClipId ? (
                    <div style={S.noClip}>클립을 선택하면 프리셋을 적용할 수 있습니다</div>
                ) : presets.length === 0 ? (
                    <div style={S.noClip}>검색 결과가 없습니다</div>
                ) : (
                    <div style={S.grid}>
                        {presets.map(p => (
                            <div
                                key={p.id}
                                style={{
                                    ...S.card,
                                    borderColor: appliedId === p.id ? '#50C878' : 'var(--border)',
                                }}
                                onClick={() => handleApply(p.id)}
                                title={p.description}
                            >
                                <span style={{ fontSize: 20 }}>
                                    {p.category === 'entrance' ? '➡️' :
                                        p.category === 'exit' ? '⬅️' :
                                            p.category === 'emphasis' ? '💥' :
                                                p.category === 'cinematic' ? '🎥' :
                                                    p.category === 'social' ? '📱' : '🎬'}
                                </span>
                                <div style={S.cardName}>{p.name}</div>
                                <div style={S.cardMeta}>
                                    <span
                                        style={{ ...S.diffDot, background: DIFFICULTY_COLORS[p.difficulty] ?? '#888' }}
                                    />{' '}
                                    {p.tracks.length}트랙
                                </div>
                                {appliedId === p.id && (
                                    <div style={{ fontSize: 9, color: '#50C878', fontWeight: 600 }}>적용됨 ✓</div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 상태바 */}
            <div style={S.statusBar}>
                <span>{selectedClipId ? `클립: ${selectedClipId.slice(-6)}` : '클립 미선택'}</span>
                <span>빌트인 {presets.filter(p => p.builtin).length} + 사용자 {presets.filter(p => !p.builtin).length}</span>
            </div>
        </div>
    );
}

export default PresetPanel;
