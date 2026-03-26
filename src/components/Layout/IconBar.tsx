import React from 'react';

const icons = [
  { label: 'Media', icon: '📁' },
  { label: 'Text', icon: '🔤' },
  { label: 'Audio', icon: '🎵' },
  { label: 'Effects', icon: '✨' },
  { label: 'AI', icon: '🤖' },
  { label: 'Sticker', icon: '🎨' },
  { label: 'Transition', icon: '🔀' },
];

const styles: Record<string, React.CSSProperties> = {
  bar: {
    width: 'var(--iconbar-width)',
    minWidth: 48,
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 8,
    gap: 4,
  },
  btn: {
    width: 40,
    height: 40,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 16,
    color: 'var(--text-secondary)',
    gap: 2,
  },
  label: {
    fontSize: 8,
    color: 'var(--text-muted)',
  },
};

export default function IconBar() {
  return (
    <div style={styles.bar}>
      {icons.map((item) => (
        <button
          key={item.label}
          style={styles.btn}
          title={item.label}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <span>{item.icon}</span>
          <span style={styles.label}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
