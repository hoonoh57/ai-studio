/* ─── src/components/Layout/LeftPanelHub.tsx ─── */
/* 아키텍처 헌법 축3: HubRegistry 기반 LeftPanel 렌더러 */

import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { hubRegistry } from '@/engines/hubRegistry';
import type { HubRenderProps } from '@/types/hub';

/**
 * activeModuleId에 해당하는 HubModule.render()를 호출.
 * 모듈이 없으면 빌트인 미디어를 폴백으로 표시.
 */
export function LeftPanelHub(): React.ReactElement {
    const activeModuleId = useEditorStore(st => st.activeModuleId ?? 'builtin.media');
    const skillLevel = useEditorStore(st => st.skillLevel);

    const mod = hubRegistry.get(activeModuleId) ?? hubRegistry.get('builtin.media');

    const renderProps: HubRenderProps = React.useMemo(() => ({
        isInsideHub: false,
        skillLevel,
        closeHub: () => { /* 패널 모드에서는 no-op */ },
    }), [skillLevel]);

    if (!mod) {
        return (
            <div style={{ padding: 24, color: '#888', textAlign: 'center' }}>
                모듈을 찾을 수 없습니다
            </div>
        );
    }

    return mod.render(renderProps);
}

export default LeftPanelHub;
