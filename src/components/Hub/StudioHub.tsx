/* ─── src/components/Hub/StudioHub.tsx ─── */
/* 아키텍처 헌법 축2: Studio Hub — 전체 모듈 검색·카테고리 브라우징 통합 모달 */

import React, { useState, useMemo, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { hubRegistry } from '@/engines/hubRegistry';
import { HUB_CATEGORIES } from '@/types/hub';
import type { HubModule, HubCategory, HubRenderProps } from '@/types/hub';

/* ═══════════════════════════════════════════
   스타일
   ═══════════════════════════════════════════ */

const S: Record<string, React.CSSProperties> = {
    overlay: {
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    modal: {
        width: '80vw', maxWidth: 900, height: '75vh', maxHeight: 640,
        background: 'var(--bg-panel, #181825)',
        border: '1px solid var(--border, #333)',
        borderRadius: 12, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
    },
    header: {
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
    },
    title: { fontSize: 16, fontWeight: 700, color: '#fff', flex: 1 },
    searchInput: {
        width: 260, height: 32, padding: '0 12px', fontSize: 12,
        background: 'var(--bg-deep, #111)', border: '1px solid var(--border)',
        borderRadius: 6, color: '#fff', outline: 'none',
    },
    closeBtn: {
        width: 32, height: 32, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'transparent', border: 'none',
        color: '#888', fontSize: 18, cursor: 'pointer', borderRadius: 6,
    },
    body: { display: 'flex', flex: 1, overflow: 'hidden' },
    sidebar: {
        width: 160, borderRight: '1px solid var(--border)',
        padding: '8px 0', overflowY: 'auto', flexShrink: 0,
    },
    catBtn: {
        width: '100%', padding: '8px 16px', fontSize: 12,
        background: 'transparent', border: 'none', color: '#999',
        cursor: 'pointer', textAlign: 'left', display: 'flex',
        alignItems: 'center', gap: 8, transition: 'all 0.12s',
    },
    catBtnActive: {
        background: 'rgba(100,150,255,0.1)', color: 'var(--accent, #6496ff)',
        fontWeight: 600,
    },
    catIcon: { fontSize: 16, width: 24, textAlign: 'center' },
    catCount: { marginLeft: 'auto', fontSize: 10, opacity: 0.5 },
    content: { flex: 1, overflowY: 'auto', padding: 16 },
    sectionTitle: {
        fontSize: 11, fontWeight: 700, color: 'var(--accent)',
        textTransform: 'uppercase', letterSpacing: 0.5,
        marginBottom: 10, marginTop: 4,
    },
    grid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 10,
    },
    card: {
        padding: '14px 10px', borderRadius: 8,
        background: 'var(--bg-surface, #1a1a2e)',
        border: '1px solid var(--border)',
        cursor: 'pointer', textAlign: 'center',
        transition: 'border-color 0.15s, transform 0.1s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    },
    cardIcon: { fontSize: 28 },
    cardName: { fontSize: 11, fontWeight: 600, color: '#ddd' },
    cardDesc: {
        fontSize: 9, color: '#888', lineHeight: 1.3,
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
    },
    cardBadge: {
        fontSize: 8, padding: '1px 6px', borderRadius: 8,
        background: 'rgba(100,150,255,0.15)', color: 'var(--accent)',
    },
    empty: {
        padding: 40, textAlign: 'center', color: '#555', fontSize: 13,
    },
    footer: {
        padding: '8px 20px', borderTop: '1px solid var(--border)',
        fontSize: 10, color: '#555', display: 'flex',
        justifyContent: 'space-between', flexShrink: 0,
    },
};

/* ═══════════════════════════════════════════
   컴포넌트
   ═══════════════════════════════════════════ */

export function StudioHub(): React.ReactElement | null {
    const isOpen = useEditorStore(s => s.isHubOpen ?? false);
    const setHubOpen = useEditorStore(s => s.setHubOpen);
    const setActiveModuleId = useEditorStore(s => s.setActiveModuleId);
    const skillLevel = useEditorStore(s => s.skillLevel);

    const [query, setQuery] = useState('');
    const [activeCat, setActiveCat] = useState<HubCategory | 'all'>('all');

    const closeHub = useCallback(() => {
        setHubOpen(false);
        setQuery('');
        setActiveCat('all');
    }, [setHubOpen]);

    /* 모듈 필터링 */
    const modules: HubModule[] = useMemo(() => {
        if (query.trim()) return hubRegistry.search(query, skillLevel);
        if (activeCat === 'all') return hubRegistry.listForSkill(skillLevel);
        return hubRegistry.listForSkill(skillLevel, activeCat);
    }, [query, activeCat, skillLevel]);

    /* 카테고리별 개수 */
    const catCounts = useMemo(() => {
        const all = hubRegistry.listForSkill(skillLevel);
        const counts = new Map<HubCategory | 'all', number>();
        counts.set('all', all.length);
        for (const m of all) {
            counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
        }
        return counts;
    }, [skillLevel]);

    /* 모듈 선택 → LeftPanel 전환 + Hub 닫기 */
    const handleSelect = useCallback((mod: HubModule) => {
        setActiveModuleId(mod.id);
        closeHub();
    }, [setActiveModuleId, closeHub]);

    /* ESC 닫기 */
    React.useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeHub();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, closeHub]);

    if (!isOpen) return null;

    /* 카테고리별 그룹핑 (all일 때) */
    const grouped = activeCat === 'all' && !query.trim();

    return (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) closeHub(); }}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
                {/* 헤더 */}
                <div style={S.header}>
                    <span style={S.title}>Studio Hub</span>
                    <input
                        style={S.searchInput}
                        placeholder="모듈 검색… (이름, 키워드, 설명)"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        autoFocus
                    />
                    <button style={S.closeBtn} onClick={closeHub} title="닫기 (ESC)">✕</button>
                </div>

                <div style={S.body}>
                    {/* 사이드바 */}
                    <div style={S.sidebar}>
                        <button
                            style={{ ...S.catBtn, ...(activeCat === 'all' ? S.catBtnActive : {}) }}
                            onClick={() => { setActiveCat('all'); setQuery(''); }}
                        >
                            <span style={S.catIcon as React.CSSProperties}>⊕</span>
                            전체
                            <span style={S.catCount}>{catCounts.get('all') ?? 0}</span>
                        </button>
                        {HUB_CATEGORIES.map(cat => {
                            const count = catCounts.get(cat.id) ?? 0;
                            if (count === 0) return null;
                            return (
                                <button
                                    key={cat.id}
                                    style={{ ...S.catBtn, ...(activeCat === cat.id ? S.catBtnActive : {}) }}
                                    onClick={() => { setActiveCat(cat.id); setQuery(''); }}
                                >
                                    <span style={S.catIcon as React.CSSProperties}>{cat.icon}</span>
                                    {cat.label}
                                    <span style={S.catCount}>{count}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* 콘텐츠 */}
                    <div style={S.content}>
                        {modules.length === 0 ? (
                            <div style={S.empty}>검색 결과가 없습니다</div>
                        ) : grouped ? (
                            /* 카테고리별 그룹 표시 */
                            HUB_CATEGORIES.map(cat => {
                                const catModules = modules.filter(m => m.category === cat.id);
                                if (catModules.length === 0) return null;
                                return (
                                    <React.Fragment key={cat.id}>
                                        <div style={S.sectionTitle}>{cat.icon} {cat.label}</div>
                                        <div style={{ ...S.grid, marginBottom: 20 }}>
                                            {catModules.map(mod => (
                                                <div
                                                    key={mod.id}
                                                    style={S.card}
                                                    onClick={() => handleSelect(mod)}
                                                    onMouseEnter={e => {
                                                        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)';
                                                        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                                                    }}
                                                    onMouseLeave={e => {
                                                        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                                                        (e.currentTarget as HTMLDivElement).style.transform = 'none';
                                                    }}
                                                >
                                                    <span style={S.cardIcon}>{mod.icon}</span>
                                                    <div style={S.cardName}>{mod.name}</div>
                                                    {mod.description && <div style={S.cardDesc}>{mod.description}</div>}
                                                    {mod.builtin && <span style={S.cardBadge}>빌트인</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </React.Fragment>
                                );
                            })
                        ) : (
                            /* 플랫 그리드 */
                            <div style={S.grid}>
                                {modules.map(mod => (
                                    <div
                                        key={mod.id}
                                        style={S.card}
                                        onClick={() => handleSelect(mod)}
                                        onMouseEnter={e => {
                                            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)';
                                            (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                                        }}
                                        onMouseLeave={e => {
                                            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                                            (e.currentTarget as HTMLDivElement).style.transform = 'none';
                                        }}
                                    >
                                        <span style={S.cardIcon}>{mod.icon}</span>
                                        <div style={S.cardName}>{mod.name}</div>
                                        {mod.description && <div style={S.cardDesc}>{mod.description}</div>}
                                        {mod.builtin && <span style={S.cardBadge}>빌트인</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 푸터 */}
                <div style={S.footer}>
                    <span>스킬: {skillLevel} · 모듈 {modules.length}개 표시</span>
                    <span>ESC로 닫기 · 클릭하면 패널 전환</span>
                </div>
            </div>
        </div>
    );
}

export default StudioHub;
