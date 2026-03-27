// src/components/Layout/IconBar.tsx
import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { SKILL_CONFIGS } from '@/types/project';
import type { PanelId } from '@/types/project';
import css from './IconBar.module.css';

const PANEL_ICONS: readonly { id: PanelId; label: string; icon: string }[] = [
  { id: 'media', label: 'Media', icon: '📁' },
  { id: 'text', label: 'Text', icon: '🔤' },
  { id: 'audio', label: 'Audio', icon: '🎵' },
  { id: 'effects', label: 'Effects', icon: '✨' },
  { id: 'ai', label: 'AI', icon: '🤖' },
  { id: 'sticker', label: 'Sticker', icon: '🎨' },
  { id: 'transition', label: 'Transition', icon: '🔀' },
];

export function IconBar(): React.ReactElement {
  const skillLevel = useEditorStore(st => st.skillLevel);
  const activePanel = useEditorStore(st => st.activePanel);
  const setActivePanel = useEditorStore(st => st.setActivePanel);
  const config = SKILL_CONFIGS[skillLevel];

  const visiblePanels = PANEL_ICONS.filter(p =>
    config.enabledPanels.includes(p.id),
  );

  return (
    <div className={css.bar}>
      {visiblePanels.map(item => {
        const isActive = activePanel === item.id;
        return (
          <button
            key={item.id}
            className={`${css.btn} ${isActive ? css.btnActive : ''}`}
            title={item.label}
            onClick={() => setActivePanel(item.id)}
          >
            {isActive && <div className={css.indicator} />}
            <span>{item.icon}</span>
            <span className={`${css.label} ${isActive ? css.labelActive : ''}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default IconBar;
