import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { SKILL_CONFIGS } from '@/types/project';
import type { PanelId } from '@/types/project';

const PANEL_ICONS: { id: PanelId; label: string; icon: string }[] = [
  { id: 'media', label: 'Media', icon: '📁' },
  { id: 'text', label: 'Text', icon: '🔤' },
  { id: 'audio', label: 'Audio', icon: '🎵' },
  { id: 'effects', label: 'Effects', icon: '✨' },
  { id: 'ai', label: 'AI', icon: '🤖' },
  { id: 'sticker', label: 'Sticker', icon: '🎨' },
  { id: 'transition', label: 'Transition', icon: '🔀' },
];

const s = {
  bar: {
    width: 'var(--iconbar-width)',
    minWidth: 48,
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    paddingTop: 8,
    gap: 2,
  },
  btn: (active: boolean) => ({
    width: 40,
    height: 40,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    background: active ? 'var(--accent)' : 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 16,
    color: active ? '#fff' : 'var(--text-secondary)',
    gap: 2,
    transition: 'all 150ms ease',
    position: 'relative' as const,
  }),
  label: (active: boolean) => ({
    fontSize: 8,
    color: active ? '#fff' : 'var(--text-muted)',
  }),
  indicator: {
    position: 'absolute' as const,
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 3,
    height: 16,
    borderRadius: '0 3px 3px 0',
    background: 'var(--accent)',
  } as React.CSSProperties,
};

export default function IconBar() {
  const skillLevel = useEditorStore((st) => st.skillLevel);
  const activePanel = useEditorStore((st) => st.activePanel);
  const setActivePanel = useEditorStore((st) => st.setActivePanel);
  const config = SKILL_CONFIGS[skillLevel];

  const visiblePanels = PANEL_ICONS.filter((p) =>
    config.visiblePanels.includes(p.id)
  );

  return (
    <div style={s.bar}>
      {visiblePanels.map((item) => {
        const isActive = activePanel === item.id;
        return (
          <button
            key={item.id}
            style={s.btn(isActive)}
            title={item.label}
            onClick={() => setActivePanel(item.id)}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent';
            }}
          >
            {isActive && <div style={s.indicator} />}
            <span>{item.icon}</span>
            <span style={s.label(isActive)}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
