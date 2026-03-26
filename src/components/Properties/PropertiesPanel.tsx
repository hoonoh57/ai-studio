import React from 'react';
import { useEditorStore } from '@/stores/editorStore';

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 'var(--properties-width)',
    minWidth: 220,
    background: 'var(--bg-panel)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border)',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--accent)',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
    letterSpacing: 1,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 11,
    color: 'var(--text-secondary)',
  },
  input: {
    width: 64,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    color: 'var(--text-primary)',
    padding: '2px 6px',
    fontSize: 11,
    textAlign: 'right' as const,
  },
  select: {
    width: 100,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    color: 'var(--text-primary)',
    padding: '2px 4px',
    fontSize: 11,
  },
  empty: {
    textAlign: 'center' as const,
    color: 'var(--text-muted)',
    fontSize: 12,
    paddingTop: 40,
  },
  aiBtn: {
    width: '100%',
    padding: '6px 0',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-secondary)',
    fontSize: 11,
    cursor: 'pointer',
    marginBottom: 4,
  },
};

export default function PropertiesPanel() {
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const project = useEditorStore((s) => s.project);
  const updateClip = useEditorStore((s) => s.updateClip);

  const clip = selectedClipId
    ? project.tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId)
    : null;

  const asset = clip ? project.assets.find((a) => a.id === clip.assetId) : null;

  if (!clip) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>Properties</div>
        <div style={styles.empty}>Select a clip to edit</div>
      </div>
    );
  }

  const updateTransform = (key: keyof typeof clip.transform, value: number) => {
    updateClip(clip.id, { transform: { ...clip.transform, [key]: value } });
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>Properties — {asset?.name || 'Clip'}</div>
      <div style={styles.content}>
        {/* Transform */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Transform</div>
          {(['x', 'y'] as const).map((key) => (
            <div style={styles.row} key={key}>
              <span style={styles.label}>Position {key.toUpperCase()}</span>
              <input
                type="number"
                style={styles.input}
                value={clip.transform[key]}
                onChange={(e) => updateTransform(key, parseFloat(e.target.value) || 0)}
              />
            </div>
          ))}
          <div style={styles.row}>
            <span style={styles.label}>Scale</span>
            <input
              type="number"
              step="0.1"
              style={styles.input}
              value={clip.transform.scaleX}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || 1;
                updateClip(clip.id, { transform: { ...clip.transform, scaleX: v, scaleY: v } });
              }}
            />
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Rotation</span>
            <input
              type="number"
              style={styles.input}
              value={clip.transform.rotation}
              onChange={(e) => updateTransform('rotation', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Appearance */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Appearance</div>
          <div style={styles.row}>
            <span style={styles.label}>Opacity</span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              style={styles.input}
              value={clip.opacity}
              onChange={(e) => updateClip(clip.id, { opacity: parseFloat(e.target.value) || 1 })}
            />
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Blend</span>
            <select
              style={styles.select}
              value={clip.blendMode}
              onChange={(e) => updateClip(clip.id, { blendMode: e.target.value as any })}
            >
              {['normal', 'multiply', 'screen', 'overlay', 'add', 'difference'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Speed</span>
            <input
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              style={styles.input}
              value={clip.speed}
              onChange={(e) => updateClip(clip.id, { speed: parseFloat(e.target.value) || 1 })}
            />
          </div>
        </div>

        {/* Time Info */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Time</div>
          <div style={styles.row}>
            <span style={styles.label}>Start</span>
            <span style={{ ...styles.label, color: 'var(--text-primary)' }}>{clip.timelineStart.toFixed(2)}s</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>End</span>
            <span style={{ ...styles.label, color: 'var(--text-primary)' }}>{clip.timelineEnd.toFixed(2)}s</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Duration</span>
            <span style={{ ...styles.label, color: 'var(--text-primary)' }}>{(clip.timelineEnd - clip.timelineStart).toFixed(2)}s</span>
          </div>
        </div>

        {/* AI Tools */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>AI Tools</div>
          <button style={styles.aiBtn}>🤖 Background Remove</button>
          <button style={styles.aiBtn}>🎨 Style Transfer</button>
          <button style={styles.aiBtn}>📐 Smart Crop</button>
          <button style={styles.aiBtn}>🔊 Audio Enhance</button>
          <button style={styles.aiBtn}>📝 Auto Subtitle</button>
        </div>
      </div>
    </div>
  );
}
