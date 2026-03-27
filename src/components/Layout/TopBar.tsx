// src/components/Layout/TopBar.tsx
import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { SkillLevel, EditorTab } from '@/types/project';
import { SKILL_CONFIGS } from '@/types/project';
import css from './TopBar.module.css';

const TAB_LABELS: Record<EditorTab, string> = {
  'ai-creator': '✨ AI', 'edit': '✂️ Edit', 'color': '🎨 Color',
  'audio': '🎵 Audio', 'ai-workflow': '🤖 AI Flow', 'export': '📦 Export',
};

const LEVEL_ICONS: Record<SkillLevel, string> = {
  beginner: '🌱', intermediate: '🌿', advanced: '🌳', expert: '⚡',
};

function LevelDropdown(props: {
  readonly current: SkillLevel;
  readonly onSelect: (level: SkillLevel) => void;
  readonly onClose: () => void;
}): React.ReactElement {
  return (
    <div className={css.dropdown}>
      {(Object.keys(SKILL_CONFIGS) as SkillLevel[]).map(level => {
        const cfg = SKILL_CONFIGS[level];
        const active = props.current === level;
        return (
          <button
            key={level}
            className={`${css.dropdownItem} ${active ? css.dropdownItemActive : ''}`}
            onClick={() => { props.onSelect(level); props.onClose(); }}
          >
            <div>
              <div>{LEVEL_ICONS[level]} {cfg.label}</div>
              <div className={css.dropdownDesc}>{cfg.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function TopBar(): React.ReactElement {
  const projectName = useEditorStore(st => st.project.name);
  const exportProject = useEditorStore(st => st.exportProject);
  const skillLevel = useEditorStore(st => st.skillLevel);
  const activeTab = useEditorStore(st => st.activeTab);
  const setSkillLevel = useEditorStore(st => st.setSkillLevel);
  const setActiveTab = useEditorStore(st => st.setActiveTab);
  const [showLevelMenu, setShowLevelMenu] = React.useState(false);
  const config = SKILL_CONFIGS[skillLevel];

  const handleExport = React.useCallback(() => {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}.aistudio.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportProject, projectName]);

  return (
    <div className={css.bar}>
      <div className={css.logoSection}>
        <span className={css.logoText}>AI-STUDIO</span>
        <span className={css.version}>v0.35.0327-12</span>
      </div>
      <div className={css.divider} />
      <div className={css.tabGroup}>
        {config.visibleTabs.map(tab => (
          <button
            key={tab}
            className={`${css.tab} ${activeTab === tab ? css.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab as EditorTab]}
          </button>
        ))}
      </div>
      <div className={css.divider} />
      <span className={css.projectName}>{projectName}</span>
      <div className={css.spacer} />
      <span className={css.badge}>🔒 Local</span>
      <div className={css.divider} />
      <div className={css.levelSelector}>
        <button className={css.levelBtn} onClick={() => setShowLevelMenu(prev => !prev)}>
          <span>{LEVEL_ICONS[skillLevel]}</span>
          <span>{config.label}</span>
          <span className={css.levelArrow}>▼</span>
        </button>
        {showLevelMenu && (
          <LevelDropdown current={skillLevel} onSelect={setSkillLevel} onClose={() => setShowLevelMenu(false)} />
        )}
      </div>
      <div className={css.divider} />
      <button className={css.exportBtn} onClick={handleExport}>Export</button>
    </div>
  );
}

export default TopBar;
