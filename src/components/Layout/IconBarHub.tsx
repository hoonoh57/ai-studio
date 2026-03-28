/* ─── src/components/Layout/IconBarHub.tsx ─── */
/* 아키텍처 헌법 축1+축3: HubRegistry 기반 IconBar */

import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { hubRegistry } from '@/engines/hubRegistry';
import type { HubModule } from '@/types/hub';
import css from './IconBar.module.css';

/**
 * 레지스트리 기반 IconBar.
 * - defaultFavorite === true인 모듈을 defaultOrder 순으로 표시
 * - 스킬 레벨에 따라 자동 필터링
 * - 기존 IconBar.module.css를 그대로 재사용
 */
export function IconBarHub(): React.ReactElement {
    const skillLevel = useEditorStore(st => st.skillLevel);
    const activeModuleId = useEditorStore(st => st.activeModuleId ?? '');
    const setActiveModuleId = useEditorStore(st => st.setActiveModuleId);

    const favorites: HubModule[] = React.useMemo(() => {
        const entries = hubRegistry.getDefaultFavorites(skillLevel);
        return entries
            .map(e => hubRegistry.get(e.moduleId))
            .filter((m): m is HubModule => m !== undefined);
    }, [skillLevel]);

    return (
        <div className={css.bar}>
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
    );
}

export default IconBarHub;
