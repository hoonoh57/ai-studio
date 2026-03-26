import React from 'react';
import { useEditorStore } from '@/stores/editorStore';

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: 'var(--topbar-height)',
    minHeight: 40,
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    gap: 16,
  },
  logo: {
    fontWeight: 700,
    fontSize: 14,
    color: 'var(--accent)',
    letterSpacing: 1,
  },
  projectName: {
    flex: 1,
    fontSize: 13,
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  btn: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 12px',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 600,
  },
  badge: {
    background: 'var(--success)',
    color: '#fff',
    fontSize: 10,
    padding: '2px 8px',
    borderRadius: 10,
    fontWeight: 600,
  },
};

export default function TopBar() {
  const projectName = useEditorStore((s) => s.project.name);
  const exportProject = useEditorStore((s) => s.exportProject);

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
    <div style={styles.bar}>
      <span style={styles.logo}>AI-STUDIO</span>
      <span style={styles.projectName}>{projectName}</span>
      <span style={styles.badge}>100% Local</span>
      <button style={styles.btn} onClick={handleExport}>Export JSON</button>
    </div>
  );
}
