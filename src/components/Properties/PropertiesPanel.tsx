/* ─── src/components/Properties/PropertiesPanel.tsx ─── */
import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { KeyframePanel } from './KeyframePanel';
import { BlendMode } from '@/types/project';

const PANEL_MIN_WIDTH = 220;
const HEADER_PADDING_V = 8;
const HEADER_PADDING_H = 12;
const HEADER_FONT_SIZE = 12;
const CONTENT_PADDING = 12;
const SECTION_MARGIN_BOTTOM = 16;
const SECTION_TITLE_FONT_SIZE = 10;
const SECTION_TITLE_LETTER_SPACING = 1;
const ROW_MARGIN_BOTTOM = 6;
const LABEL_FONT_SIZE = 11;
const INPUT_WIDTH = 64;
const SELECT_WIDTH = 120;
const INPUT_FONT_SIZE = 11;
const EMPTY_PADDING_TOP = 40;
const EMPTY_FONT_SIZE = 12;
const AI_BTN_FONT_SIZE = 11;
const AI_BTN_PADDING_V = 6;

const VALID_BLEND_MODES: readonly BlendMode[] = [
  'normal', 'multiply', 'screen', 'overlay',
  'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion',
];

const AI_TOOLS = [
  { icon: '🤖', label: 'Background Remove' },
  { icon: '🎨', label: 'Style Transfer' },
  { icon: '📐', label: 'Smart Crop' },
  { icon: '🔊', label: 'Audio Enhance' },
  { icon: '📝', label: 'Auto Subtitle' },
] as const;

const styles = {
  panel: {
    width: 'var(--properties-width)',
    minWidth: PANEL_MIN_WIDTH,
    background: 'var(--bg-panel)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as React.CSSProperties,
  header: {
    padding: `${HEADER_PADDING_V}px ${HEADER_PADDING_H}px`,
    fontSize: HEADER_FONT_SIZE,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border)',
  } as React.CSSProperties,
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: CONTENT_PADDING,
  } as React.CSSProperties,
  section: {
    marginBottom: SECTION_MARGIN_BOTTOM,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: SECTION_TITLE_FONT_SIZE,
    fontWeight: 700,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    marginBottom: HEADER_PADDING_V,
    letterSpacing: SECTION_TITLE_LETTER_SPACING,
  } as React.CSSProperties,
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ROW_MARGIN_BOTTOM,
  } as React.CSSProperties,
  label: {
    fontSize: LABEL_FONT_SIZE,
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
  valueLabel: {
    fontSize: LABEL_FONT_SIZE,
    color: 'var(--text-primary)',
  } as React.CSSProperties,
  input: {
    width: INPUT_WIDTH,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    color: 'var(--text-primary)',
    padding: '2px 6px',
    fontSize: INPUT_FONT_SIZE,
    textAlign: 'right',
  } as React.CSSProperties,
  select: {
    width: SELECT_WIDTH,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    color: 'var(--text-primary)',
    padding: '2px 4px',
    fontSize: INPUT_FONT_SIZE,
  } as React.CSSProperties,
  empty: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: EMPTY_FONT_SIZE,
    paddingTop: EMPTY_PADDING_TOP,
  } as React.CSSProperties,
  aiBtn: {
    width: '100%',
    padding: `${AI_BTN_PADDING_V}px 0`,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-secondary)',
    fontSize: AI_BTN_FONT_SIZE,
    cursor: 'pointer',
    marginBottom: 4,
    fontFamily: 'inherit',
  } as React.CSSProperties,
} as const;

export function PropertiesPanel(): React.ReactElement {
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const project = useEditorStore((s) => s.project);
  const updateClip = useEditorStore((s) => s.updateClip);
  const getSkillConfig = useEditorStore((s) => s.getSkillConfig);

  const config = getSkillConfig();

  const clip = selectedClipId !== null
    ? project.tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId)
    : undefined;

  const asset = clip !== undefined
    ? project.assets.find((a) => a.id === clip.assetId)
    : undefined;

  if (clip === undefined) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>Properties</div>
        <div style={styles.empty}>Select a clip to edit</div>
      </div>
    );
  }

  const handleTransformChange = (
    key: keyof typeof clip.transform,
    value: number,
  ) => {
    updateClip(clip.id, {
      transform: { ...clip.transform, [key]: value },
    });
  };

  const handleOpacityChange = (value: number) => {
    updateClip(clip.id, { opacity: value });
  };

  const handleBlendModeChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    updateClip(clip.id, { blendMode: e.target.value as BlendMode });
  };

  const parseNum = (raw: string, fallback: number): number => {
    const parsed = parseFloat(raw);
    return isNaN(parsed) ? fallback : parsed;
  };

  const displayName = asset?.name ?? 'Clip';

  return (
    <div style={styles.panel}>
      <div style={styles.header}>Properties — {displayName}</div>
      <div style={styles.content}>
        {/* Transform */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Transform</div>
          {(['x', 'y'] as const).map((key) => (
            <div style={styles.row} key={key}>
              <span style={styles.label}>
                Position {key.toUpperCase()}
              </span>
              <input
                type="number"
                style={styles.input}
                value={clip.transform[key]}
                onChange={(e) =>
                  handleTransformChange(key, parseNum(e.target.value, 0))
                }
              />
            </div>
          ))}
          <div style={styles.row}>
            <span style={styles.label}>Scale</span>
            <input
              type="number"
              step="0.01"
              style={styles.input}
              value={clip.transform.scale}
              onChange={(e) =>
                handleTransformChange('scale', parseNum(e.target.value, 1))
              }
            />
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Rotation</span>
            <input
              type="number"
              style={styles.input}
              value={clip.transform.rotation}
              onChange={(e) =>
                handleTransformChange('rotation', parseNum(e.target.value, 0))
              }
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
              onChange={(e) =>
                handleOpacityChange(parseNum(e.target.value, 1))
              }
            />
          </div>
          {config.showBlendModes && (
            <div style={styles.row}>
              <span style={styles.label}>Blend</span>
              <select
                style={styles.select}
                value={clip.blendMode}
                onChange={handleBlendModeChange}
              >
                {VALID_BLEND_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div style={styles.row}>
            <span style={styles.label}>Speed</span>
            <input
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              style={styles.input}
              value={clip.speed}
              onChange={(e) =>
                updateClip(clip.id, { speed: parseNum(e.target.value, 1) })
              }
            />
          </div>
        </div>

        {/* Time Info */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Time</div>
          <div style={styles.row}>
            <span style={styles.label}>Start</span>
            <span style={styles.valueLabel}>
              {clip.startTime.toFixed(2)}s
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Duration</span>
            <span style={styles.valueLabel}>
              {clip.duration.toFixed(2)}s
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>In-Point</span>
            <span style={styles.valueLabel}>
              {clip.inPoint.toFixed(2)}s
            </span>
          </div>
        </div>

        {/* AI Tools */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>AI Tools</div>
          {AI_TOOLS.map((tool) => (
            <button key={tool.label} style={styles.aiBtn}>
              {tool.icon} {tool.label}
            </button>
          ))}
        </div>

        <KeyframePanel />
      </div>
    </div>
  );
}
