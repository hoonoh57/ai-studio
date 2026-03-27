// src/components/Layout/TopBar.tsx
import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { SkillLevel, EditorTab } from '@/types/project';
import { SKILL_CONFIGS } from '@/types/project';

// ── 상수 ──
const BAR_MIN_HEIGHT = 40;
const LOGO_FONT_SIZE = 13;
const VERSION_FONT_SIZE = 9;
const TAB_FONT_SIZE = 12;
const TAB_PADDING_H = 14;
const TAB_PADDING_V = 6;
const PROJECT_NAME_MAX_WIDTH = 200;
const PROJECT_NAME_FONT_SIZE = 12;
const BADGE_FONT_SIZE = 10;
const BADGE_PADDING_H = 8;
const BADGE_PADDING_V = 2;
const LEVEL_BTN_FONT_SIZE = 11;
const DROPDOWN_MIN_WIDTH = 200;
const DROPDOWN_ITEM_FONT_SIZE = 12;
const DROPDOWN_DESC_FONT_SIZE = 10;
const EXPORT_BTN_FONT_SIZE = 11;
const DIVIDER_HEIGHT = 20;

const TAB_LABELS: Record<EditorTab, string> = {
  'ai-creator': '✨ AI',
  'edit': '✂️ Edit',
  'color': '🎨 Color',
  'audio': '🎵 Audio',
  'ai-workflow': '🤖 AI Flow',
  'export': '📦 Export',
};

const LEVEL_ICONS: Record<SkillLevel, string> = {
  beginner: '🌱',
  intermediate: '🌿',
  advanced: '🌳',
  expert: '⚡',
};

// ── 스타일 ──
const S: Record<string, React.CSSProperties> = {
  bar: {
    height: 'var(--topbar-height)',
    minHeight: BAR_MIN_HEIGHT,
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    gap: 0,
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginRight: 16,
    cursor: 'pointer',
  },
  logoText: {
    fontWeight: 700,
    fontSize: LOGO_FONT_SIZE,
    color: 'var(--accent)',
    letterSpacing: 0.5,
  },
  version: {
    fontSize: VERSION_FONT_SIZE,
    color: 'var(--text-muted)',
    fontWeight: 400,
    opacity: 0.6,
  },
  divider: {
    width: 1,
    height: DIVIDER_HEIGHT,
    background: 'var(--border)',
    margin: '0 8px',
  },
  tabGroup: {
    display: 'flex',
    gap: 2,
    alignItems: 'center',
  },
  spacer: { flex: 1 },
  projectName: {
    fontSize: PROJECT_NAME_FONT_SIZE,
    color: 'var(--text-secondary)',
    maxWidth: PROJECT_NAME_MAX_WIDTH,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  levelSelector: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  levelBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 10px',
    fontSize: LEVEL_BTN_FONT_SIZE,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    padding: 4,
    zIndex: 1000,
    minWidth: DROPDOWN_MIN_WIDTH,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  },
  dropdownDesc: {
    fontSize: DROPDOWN_DESC_FONT_SIZE,
    color: 'var(--text-muted)',
    marginTop: 2,
  },
  exportBtn: {
    padding: '5px 14px',
    fontSize: EXPORT_BTN_FONT_SIZE,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: `${TAB_PADDING_V}px ${TAB_PADDING_H}px`,
    fontSize: TAB_FONT_SIZE,
    fontWeight: active ? 600 : 400,
    color: active ? '#fff' : 'var(--text-secondary)',
    background: active ? 'var(--accent)' : 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    fontFamily: 'inherit',
  };
}

function badgeStyle(color: string): React.CSSProperties {
  return {
    fontSize: BADGE_FONT_SIZE,
    padding: `${BADGE_PADDING_V}px ${BADGE_PADDING_H}px`,
    borderRadius: 10,
    fontWeight: 600,
    background: color === 'green' ? 'var(--success)' : 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
  };
}

function dropdownItemStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    fontSize: DROPDOWN_ITEM_FONT_SIZE,
    color: active ? '#fff' : 'var(--text-primary)',
    background: active ? 'var(--accent)' : 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    fontFamily: 'inherit',
  };
}

// ── 레벨 드롭다운 서브 컴포넌트 ──
interface LevelDropdownProps {
  readonly current: SkillLevel;
  readonly onSelect: (level: SkillLevel) => void;
  readonly onClose: () => void;
}

function LevelDropdown(props: LevelDropdownProps): React.ReactElement {
  return (
    <div style={S.dropdown}>
      {(Object.keys(SKILL_CONFIGS) as SkillLevel[]).map(level => {
        const cfg = SKILL_CONFIGS[level];
        const isActive = props.current === level;
        return (
          <button
            key={level}
            style={dropdownItemStyle(isActive)}
            onClick={() => { props.onSelect(level); props.onClose(); }}
            onMouseEnter={e => {
              if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={e => {
              if (!isActive) e.currentTarget.style.background = 'transparent';
            }}
          >
            <div>
              <div>{LEVEL_ICONS[level]} {cfg.label}</div>
              <div style={S.dropdownDesc}>{cfg.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── 메인 컴포넌트 ──
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
    <div style={S.bar}>
      <div style={S.logoSection}>
        <span style={S.logoText}>AI-STUDIO</span>
        <span style={S.version}>v0.34.0327-11</span>
      </div>

      <div style={S.divider} />

      <div style={S.tabGroup}>
        {config.visibleTabs.map(tab => (
          <button
            key={tab}
            style={tabStyle(activeTab === tab)}
            onClick={() => setActiveTab(tab)}
            onMouseEnter={e => {
              if (activeTab !== tab) e.currentTarget.style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={e => {
              if (activeTab !== tab) e.currentTarget.style.background = 'transparent';
            }}
          >
            {TAB_LABELS[tab as EditorTab]}
          </button>
        ))}
      </div>

      <div style={S.divider} />
      <span style={S.projectName}>{projectName}</span>
      <div style={S.spacer} />
      <span style={badgeStyle('green')}>🔒 Local</span>
      <div style={S.divider} />

      <div style={S.levelSelector as React.CSSProperties}>
        <button
          style={S.levelBtn}
          onClick={() => setShowLevelMenu(prev => !prev)}
        >
          <span>{LEVEL_ICONS[skillLevel]}</span>
          <span>{config.label}</span>
          <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>▼</span>
        </button>
        {showLevelMenu && (
          <LevelDropdown
            current={skillLevel}
            onSelect={setSkillLevel}
            onClose={() => setShowLevelMenu(false)}
          />
        )}
      </div>

      <div style={S.divider} />
      <button style={S.exportBtn} onClick={handleExport}>Export</button>
    </div>
  );
}

// 기존 default import 호환
export default TopBar;
