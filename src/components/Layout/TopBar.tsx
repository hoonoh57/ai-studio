import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { SkillLevel, EditorTab } from '@/types/project';
import { SKILL_CONFIGS } from '@/types/project';

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

const s = {
  bar: {
    height: 'var(--topbar-height)',
    minHeight: 40,
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    gap: 0,
  } as React.CSSProperties,
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginRight: 16,
    cursor: 'pointer',
  } as React.CSSProperties,
  logoText: {
    fontWeight: 700,
    fontSize: 13,
    color: 'var(--accent)',
    letterSpacing: 0.5,
  } as React.CSSProperties,
  divider: {
    width: 1,
    height: 20,
    background: 'var(--border)',
    margin: '0 8px',
  } as React.CSSProperties,
  tabGroup: {
    display: 'flex',
    gap: 2,
    alignItems: 'center',
  } as React.CSSProperties,
  tab: (active: boolean) => ({
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    color: active ? '#fff' : 'var(--text-secondary)',
    background: active ? 'var(--accent)' : 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    fontFamily: 'inherit',
  } as React.CSSProperties),
  spacer: { flex: 1 } as React.CSSProperties,
  projectName: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    maxWidth: 200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  badge: (color: string) => ({
    fontSize: 10,
    padding: '2px 8px',
    borderRadius: 10,
    fontWeight: 600,
    background: color === 'green' ? 'var(--success)' : 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
  } as React.CSSProperties),
  levelSelector: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
  } as React.CSSProperties,
  levelBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  dropdown: {
    position: 'absolute' as const,
    top: '100%',
    right: 0,
    marginTop: 4,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    padding: 4,
    zIndex: 1000,
    minWidth: 200,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  } as React.CSSProperties,
  dropdownItem: (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    fontSize: 12,
    color: active ? '#fff' : 'var(--text-primary)',
    background: active ? 'var(--accent)' : 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
  } as React.CSSProperties),
  dropdownDesc: {
    fontSize: 10,
    color: 'var(--text-muted)',
    marginTop: 2,
  } as React.CSSProperties,
  exportBtn: {
    padding: '5px 14px',
    fontSize: 11,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
};

export default function TopBar() {
  const projectName = useEditorStore((st) => st.project.name);
  const exportProject = useEditorStore((st) => st.exportProject);
  const skillLevel = useEditorStore((st) => st.skillLevel);
  const activeTab = useEditorStore((st) => st.activeTab);
  const setSkillLevel = useEditorStore((st) => st.setSkillLevel);
  const setActiveTab = useEditorStore((st) => st.setActiveTab);

  const [showLevelMenu, setShowLevelMenu] = React.useState(false);

  const config = SKILL_CONFIGS[skillLevel];

  const handleExport = () => {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}.aistudio.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={s.bar}>
      {/* Logo */}
      <div style={s.logoSection}>
        <span style={s.logoText}>AI-STUDIO</span>
      </div>

      <div style={s.divider} />

      {/* Tabs - filtered by skill level */}
      <div style={s.tabGroup}>
        {config.visibleTabs.map((tab) => (
          <button
            key={tab}
            style={s.tab(activeTab === tab)}
            onClick={() => setActiveTab(tab)}
            onMouseEnter={(e) => {
              if (activeTab !== tab) e.currentTarget.style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab) e.currentTarget.style.background = 'transparent';
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div style={s.divider} />

      {/* Project name */}
      <span style={s.projectName}>{projectName}</span>

      <div style={s.spacer} />

      {/* Privacy badge */}
      <span style={s.badge('green')}>🔒 Local</span>

      <div style={s.divider} />

      {/* Skill level selector */}
      <div style={s.levelSelector}>
        <button
          style={s.levelBtn}
          onClick={() => setShowLevelMenu(!showLevelMenu)}
        >
          <span>{LEVEL_ICONS[skillLevel]}</span>
          <span>{config.label}</span>
          <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>▼</span>
        </button>

        {showLevelMenu && (
          <div style={s.dropdown}>
            {(Object.keys(SKILL_CONFIGS) as SkillLevel[]).map((level) => {
              const cfg = SKILL_CONFIGS[level];
              return (
                <button
                  key={level}
                  style={s.dropdownItem(skillLevel === level)}
                  onClick={() => {
                    setSkillLevel(level);
                    setShowLevelMenu(false);
                  }}
                  onMouseEnter={(e) => {
                    if (skillLevel !== level) e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (skillLevel !== level) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div>
                    <div>{LEVEL_ICONS[level]} {cfg.label}</div>
                    <div style={s.dropdownDesc}>{cfg.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={s.divider} />

      {/* Export */}
      <button style={s.exportBtn} onClick={handleExport}>Export</button>
    </div>
  );
}
