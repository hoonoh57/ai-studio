/* ─── src/components/Hub/HubTrigger.tsx ─── */
/* Studio Hub 열기 버튼 — IconBar 하단 또는 독립 사용 */

import React from 'react';
import { useEditorStore } from '@/stores/editorStore';

const btnStyle: React.CSSProperties = {
    width: '100%', padding: '10px 0', background: 'transparent',
    border: 'none', borderTop: '1px solid var(--border)',
    color: 'var(--text-secondary)', cursor: 'pointer',
    fontSize: 11, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 2, transition: 'color 0.15s',
};

export function HubTrigger(): React.ReactElement {
    const setHubOpen = useEditorStore(s => s.setHubOpen);

    return (
        <button
            style={btnStyle}
            onClick={() => setHubOpen(true)}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent, #6496ff)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            title="Studio Hub 열기 (모든 도구)"
        >
            <span style={{ fontSize: 18 }}>🔍</span>
            <span>Hub</span>
        </button>
    );
}

export default HubTrigger;
