/* ─── src/components/Layout/IconBarHub.tsx ─── */
/* 아키텍처 헌법 축1+축3: HubRegistry 기반 IconBar + Hub 트리거 */

import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { hubRegistry } from '@/engines/hubRegistry';
import type { HubModule } from '@/types/hub';
import css from './IconBar.module.css';

export function IconBarHub(): React.ReactElement {
    const skillLevel = useEditorStore(st => st.skillLevel);
    const activeModuleId = useEditorStore(st => st.activeModuleId ?? '');
    const setActiveModuleId = useEditorStore(st => st.setActiveModuleId);
    const setHubOpen = useEditorStore(st => st.setHubOpen);

    const favorites: HubModule[] = React.useMemo(() => {
        const entries = hubRegistry.getDefaultFavorites(skillLevel);
        return entries
            .map(e => hubRegistry.get(e.moduleId))
            .filter((m): m is HubModule => m !== undefined);
    }, [skillLevel]);

    return (
        <div className={css.bar} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1 }}>
                {favorites.map(mod => {
                    const isActive = activeModuleId === mod.id;
                    return (
                        <button
                            key={mod.id}
                            className={`${css.btn} ${isActive ? css.btnActive : ''}`}
                            title={mod.description ?? mod.name}
                            onClick={() => setActiveModuleId(mod.id)}
                        >
                            {isActive && <div className={css.indicator} />}
                            <span>{mod.icon}</span>
                            <span className={`${css.label} ${isActive ? css.labelActive : ''}`}>
                                {mod.name}
                            </span>
                        </button>
                    );
                })}
            </div>
            {/* Hub 트리거 버튼 */}
            <button
                className={css.btn}
                style={{ borderTop: '1px solid var(--border)', marginTop: 'auto' }}
                title="Studio Hub — 모든 도구 검색"
                onClick={() => setHubOpen(true)}
            >
                <span>🔍</span>
                <span className={css.label}>Hub</span>
            </button>
        </div>
    );
}

export default IconBarHub;
