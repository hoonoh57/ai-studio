/* ─── src/components/Layout/TopBar.tsx ─── */
import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { SkillLevel, EditorTab } from '@/types/project';
import { SKILL_CONFIGS } from '@/types/project';
import css from './TopBar.module.css';

const TAB_LABELS: Record<EditorTab, string> = {
  'ai-creator': '✨ AI',
  'edit': '✂️ Edit',
  'cut': '🎬 Cut',
  'color': '🎨 Color',
  'audio': '🎵 Audio',
  'effects': '✨ FX',
  'ai-workflow': '🤖 AI Flow',
  'export': '📦 Export',
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
              <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>{cfg.maxTracks} Tracks Support</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function TopBar(): React.ReactElement {
  const projectName = useEditorStore(st => st.project.name);
  const skillLevel = useEditorStore(st => st.skillLevel);
  const activeTab = useEditorStore(st => st.activeTab);
  const setSkillLevel = useEditorStore(st => st.setSkillLevel);
  const setActiveTab = useEditorStore(st => st.setActiveTab);
  const [showLevelMenu, setShowLevelMenu] = React.useState(false);
  const levelRef = React.useRef<HTMLDivElement>(null);
  
  const config = SKILL_CONFIGS[skillLevel] ?? SKILL_CONFIGS.beginner;

  React.useEffect(() => {
    if (!showLevelMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (levelRef.current !== null && !levelRef.current.contains(e.target as Node)) {
        setShowLevelMenu(false);
      }
    };
    const rafId = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClickOutside);
    });
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLevelMenu]);

  return (
    <div className={css.bar}>
      <div className={css.logoSection}>
        <span className={css.logoText}>AI-STUDIO</span>
        <span className={css.version}>v0.39.0327-21</span>
      </div>
      <div className={css.divider} />
      
      <div className={css.tabGroup}>
        {config.enabledTabs.map(tab => (
          <button
            key={tab}
            className={`${css.tab} ${activeTab === tab ? css.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
      
      <div className={css.divider} />
      <span className={css.projectName}>{projectName}</span>
      <div className={css.spacer} />
      <span className={css.badge}>🔒 Local</span>
      <div className={css.divider} />
      
      <div className={css.levelSelector} ref={levelRef}>
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
      <button className={css.exportBtn}>Export</button>
    </div>
  );
}

export default TopBar;
