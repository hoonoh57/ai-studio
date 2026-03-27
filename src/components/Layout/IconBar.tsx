// src/components/Layout/IconBar.tsx
import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { SKILL_CONFIGS } from '@/types/project';
import type { PanelId } from '@/types/project';

// ── 상수 ──
const BAR_WIDTH = 48;
const BTN_SIZE = 40;
const BTN_FONT_SIZE = 16;
const LABEL_FONT_SIZE = 8;
const INDICATOR_WIDTH = 3;
const INDICATOR_HEIGHT = 16;
const BAR_PADDING_TOP = 8;
const BAR_GAP = 2;

const PANEL_ICONS: readonly { id: PanelId; label: string; icon: string }[] = [
  { id: 'media', label: 'Media', icon: '📁' },
  { id: 'text', label: 'Text', icon: '🔤' },
  { id: 'audio', label: 'Audio', icon: '🎵' },
  { id: 'effects', label: 'Effects', icon: '✨' },
  { id: 'ai', label: 'AI', icon: '🤖' },
  { id: 'sticker', label: 'Sticker', icon: '🎨' },
  { id: 'transition', label: 'Transition', icon: '🔀' },
];

// ── 스타일 ──
const styles: Record<string, React.CSSProperties> = {
  bar: {
    width: BAR_WIDTH,
    minWidth: BAR_WIDTH,
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: BAR_PADDING_TOP,
    gap: BAR_GAP,
    flexShrink: 0,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    borderRadius: '0 3px 3px 0',
    background: 'var(--accent)',
  },
};

function btnStyle(active: boolean): React.CSSProperties {
  return {
    width: BTN_SIZE,
    height: BTN_SIZE,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: active ? 'var(--accent)' : 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: BTN_FONT_SIZE,
    color: active ? '#fff' : 'var(--text-secondary)',
    gap: 2,
    transition: 'all 150ms ease',
    position: 'relative',
  };
}

function labelStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: LABEL_FONT_SIZE,
    color: active ? '#fff' : 'var(--text-muted)',
  };
}

// ── 컴포넌트 ──
export function IconBar(): React.ReactElement {
  const skillLevel = useEditorStore(st => st.skillLevel);
  const activePanel = useEditorStore(st => st.activePanel);
  const setActivePanel = useEditorStore(st => st.setActivePanel);
  const config = SKILL_CONFIGS[skillLevel];

  const visiblePanels = PANEL_ICONS.filter(p =>
    config.visiblePanels.includes(p.id),
  );

  return (
    <div style={styles.bar}>
      {visiblePanels.map(item => {
        const isActive = activePanel === item.id;
        return (
          <button
            key={item.id}
            style={btnStyle(isActive)}
            title={item.label}
            onClick={() => setActivePanel(item.id)}
            onMouseEnter={e => {
              if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={e => {
              if (!isActive) e.currentTarget.style.background = 'transparent';
            }}
          >
            {isActive && <div style={styles.indicator} />}
            <span>{item.icon}</span>
            <span style={labelStyle(isActive)}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// 기존 default import 호환
export default IconBar;
