/* ─── src/components/Properties/KeyframePanel.tsx ─── */
import React, { useState, useCallback, useMemo } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { SKILL_CONFIGS } from '@/types/project';
import type { KeyframeProperty, EasingType, KeyframeTrack, Keyframe } from '@/types/project';

/* ── 상수 ── */
const PROPERTIES: { key: KeyframeProperty; label: string; icon: string; min: number; max: number; step: number; unit: string; defaultValue: number }[] = [
  { key: 'x', label: 'Position X', icon: '↔', min: -1920, max: 1920, step: 1, unit: 'px', defaultValue: 0 },
  { key: 'y', label: 'Position Y', icon: '↕', min: -1080, max: 1080, step: 1, unit: 'px', defaultValue: 0 },
  { key: 'scale', label: 'Scale', icon: '⊞', min: 0, max: 5, step: 0.01, unit: '×', defaultValue: 1 },
  { key: 'rotation', label: 'Rotation', icon: '↻', min: -360, max: 360, step: 1, unit: '°', defaultValue: 0 },
  { key: 'opacity', label: 'Opacity', icon: '◐', min: 0, max: 1, step: 0.01, unit: '', defaultValue: 1 },
  { key: 'volume', label: 'Volume', icon: '🔊', min: 0, max: 2, step: 0.01, unit: '', defaultValue: 1 },
  { key: 'blur', label: 'Blur', icon: '🌫', min: 0, max: 50, step: 0.5, unit: 'px', defaultValue: 0 },
  { key: 'brightness', label: 'Brightness', icon: '☀', min: -100, max: 100, step: 1, unit: '%', defaultValue: 0 },
  { key: 'contrast', label: 'Contrast', icon: '◑', min: -100, max: 100, step: 1, unit: '%', defaultValue: 0 },
];

const EASING_OPTIONS: { value: EasingType; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In-Out' },
  { value: 'ease-in-cubic', label: 'Cubic In' },
  { value: 'ease-out-cubic', label: 'Cubic Out' },
  { value: 'ease-in-out-cubic', label: 'Cubic In-Out' },
  { value: 'ease-out-bounce', label: 'Bounce' },
  { value: 'ease-out-elastic', label: 'Elastic' },
  { value: 'ease-out-back', label: 'Back' },
  { value: 'spring', label: 'Spring' },
];

export function KeyframePanel(): React.ReactElement | null {
  const project = useEditorStore(s => s.project);
  const selectedClipId = useEditorStore(s => s.selectedClipId);
  const currentTime = useEditorStore(s => s.currentTime);
  const skillLevel = useEditorStore(s => s.skillLevel);
  const addKeyframe = useEditorStore(s => s.addKeyframe);
  const removeKeyframe = useEditorStore(s => s.removeKeyframe);
  const updateKeyframe = useEditorStore(s => s.updateKeyframe);
  const pushUndo = useEditorStore(s => s.pushUndo);

  const [expandedProp, setExpandedProp] = useState<KeyframeProperty | null>(null);
  const [selectedEasing, setSelectedEasing] = useState<EasingType>('ease-out');

  const config = SKILL_CONFIGS[skillLevel];

  // ★ FIX: useMemo를 조건부 return 전에 호출
  const clip = useMemo(() => {
    if (!selectedClipId) return null;
    for (const t of project.tracks) {
      const c = t.clips.find(cl => cl.id === selectedClipId);
      if (c) return c;
    }
    return null;
  }, [project.tracks, selectedClipId]);

  // ★ FIX: 모든 Hook 이후에 조건부 return
  if (!config.showKeyframes) return null;

  if (!clip) {
    return (
      <div style={S.container}>
        <div style={S.header}>Keyframes</div>
        <div style={S.empty}>클립을 선택하세요</div>
      </div>
    );
  }

  const relativeTime = Math.max(0, Math.min(currentTime - clip.startTime, clip.duration));

  const getTrack = (prop: KeyframeProperty): KeyframeTrack | undefined =>
    clip.keyframeTracks?.find(kt => kt.property === prop);

  const getValueAtTime = (prop: KeyframeProperty): number => {
    const kt = getTrack(prop);
    if (!kt || kt.keyframes.length === 0) {
      return PROPERTIES.find(p => p.key === prop)?.defaultValue ?? 0;
    }
    const kfs = kt.keyframes;
    if (relativeTime <= kfs[0].time) return kfs[0].value;
    if (relativeTime >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;
    for (let i = 0; i < kfs.length - 1; i++) {
      if (relativeTime >= kfs[i].time && relativeTime <= kfs[i + 1].time) {
        const progress = (relativeTime - kfs[i].time) / (kfs[i + 1].time - kfs[i].time);
        return kfs[i].value + (kfs[i + 1].value - kfs[i].value) * progress;
      }
    }
    return kfs[0].value;
  };

  const handleAddKeyframe = (prop: KeyframeProperty) => {
    pushUndo('키프레임 추가');
    const currentVal = getValueAtTime(prop);
    addKeyframe(clip.id, prop, relativeTime, currentVal, selectedEasing);
  };

  const handleRemoveKeyframe = (prop: KeyframeProperty, kfId: string) => {
    pushUndo('키프레임 삭제');
    removeKeyframe(clip.id, prop, kfId);
  };

  const handleUpdateValue = (prop: KeyframeProperty, kfId: string, value: number) => {
    updateKeyframe(clip.id, prop, kfId, { value });
  };

  const handleUpdateEasing = (prop: KeyframeProperty, kfId: string, easing: EasingType) => {
    updateKeyframe(clip.id, prop, kfId, { easing });
  };

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span>Keyframes</span>
        <span style={S.timeLabel}>t = {relativeTime.toFixed(2)}s</span>
      </div>

      {/* 이징 선택 */}
      <div style={S.easingRow}>
        <span style={{ fontSize: 10, color: '#888' }}>New KF Easing:</span>
        <select
          value={selectedEasing}
          onChange={e => setSelectedEasing(e.target.value as EasingType)}
          style={S.easingSelect}
        >
          {EASING_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* 속성 목록 */}
      <div style={S.propList}>
        {PROPERTIES.map(prop => {
          const kt = getTrack(prop.key);
          const kfCount = kt?.keyframes.length ?? 0;
          const currentVal = getValueAtTime(prop.key);
          const isExpanded = expandedProp === prop.key;

          return (
            <div key={prop.key} style={S.propItem}>
              {/* 속성 헤더 */}
              <div
                style={{
                  ...S.propHeader,
                  borderLeft: kfCount > 0 ? '3px solid var(--accent)' : '3px solid transparent',
                }}
                onClick={() => setExpandedProp(isExpanded ? null : prop.key)}
              >
                <span style={S.propIcon}>{prop.icon}</span>
                <span style={S.propLabel}>{prop.label}</span>
                <span style={S.propValue}>
                  {currentVal.toFixed(prop.step < 1 ? 2 : 0)}{prop.unit}
                </span>
                <span style={S.kfBadge}>{kfCount > 0 ? `${kfCount} KF` : ''}</span>
                <button
                  style={S.addBtn}
                  onClick={e => { e.stopPropagation(); handleAddKeyframe(prop.key); }}
                  title="현재 시간에 키프레임 추가"
                >
                  ◆+
                </button>
              </div>

              {/* 확장: 키프레임 리스트 */}
              {isExpanded && kt && kt.keyframes.length > 0 && (
                <div style={S.kfList}>
                  {kt.keyframes.map(kf => (
                    <div key={kf.id} style={S.kfRow}>
                      <span style={S.kfTime}>{kf.time.toFixed(2)}s</span>
                      <input
                        type="number"
                        value={kf.value}
                        step={prop.step}
                        min={prop.min}
                        max={prop.max}
                        style={S.kfInput}
                        onChange={e => handleUpdateValue(prop.key, kf.id, parseFloat(e.target.value) || 0)}
                      />
                      <select
                        value={kf.easing}
                        style={S.kfEasingSelect}
                        onChange={e => handleUpdateEasing(prop.key, kf.id, e.target.value as EasingType)}
                      >
                        {EASING_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <button
                        style={S.kfDeleteBtn}
                        onClick={() => handleRemoveKeyframe(prop.key, kf.id)}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 스타일 ── */
const S = {
  container: {
    display: 'flex', flexDirection: 'column', height: '100%',
    background: 'var(--bg-panel)', fontSize: 11, color: '#ccc',
  } as React.CSSProperties,
  header: {
    padding: '8px 12px', fontSize: 12, fontWeight: 600,
    borderBottom: '1px solid var(--border)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  } as React.CSSProperties,
  timeLabel: {
    fontSize: 10, color: 'var(--accent)', fontFamily: 'monospace',
  } as React.CSSProperties,
  empty: {
    padding: 20, textAlign: 'center', color: '#555', fontSize: 12,
  } as React.CSSProperties,
  easingRow: {
    padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8,
    borderBottom: '1px solid var(--border)',
  } as React.CSSProperties,
  easingSelect: {
    flex: 1, background: 'var(--bg-deep)', color: '#ccc', border: '1px solid var(--border)',
    borderRadius: 4, padding: '2px 4px', fontSize: 10,
  } as React.CSSProperties,
  propList: {
    flex: 1, overflowY: 'auto',
  } as React.CSSProperties,
  propItem: {
    borderBottom: '1px solid var(--border)',
  } as React.CSSProperties,
  propHeader: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 8px', cursor: 'pointer',
    transition: 'background 0.1s',
  } as React.CSSProperties,
  propIcon: { fontSize: 13, width: 18, textAlign: 'center' } as React.CSSProperties,
  propLabel: { flex: 1, fontSize: 11 } as React.CSSProperties,
  propValue: { fontSize: 10, color: '#888', fontFamily: 'monospace', minWidth: 50, textAlign: 'right' } as React.CSSProperties,
  kfBadge: { fontSize: 9, color: 'var(--accent)', minWidth: 30, textAlign: 'center' } as React.CSSProperties,
  addBtn: {
    background: 'none', border: '1px solid var(--border)', color: 'var(--accent)',
    borderRadius: 3, padding: '1px 5px', fontSize: 10, cursor: 'pointer',
  } as React.CSSProperties,
  kfList: {
    padding: '4px 8px 8px 28px', background: 'var(--bg-deep)',
  } as React.CSSProperties,
  kfRow: {
    display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3,
  } as React.CSSProperties,
  kfTime: { fontSize: 10, color: '#888', fontFamily: 'monospace', minWidth: 40 } as React.CSSProperties,
  kfInput: {
    width: 60, background: 'var(--bg-surface)', color: '#ccc',
    border: '1px solid var(--border)', borderRadius: 3, padding: '2px 4px', fontSize: 10,
  } as React.CSSProperties,
  kfEasingSelect: {
    flex: 1, background: 'var(--bg-surface)', color: '#ccc',
    border: '1px solid var(--border)', borderRadius: 3, padding: '2px', fontSize: 9,
  } as React.CSSProperties,
  kfDeleteBtn: {
    background: 'none', border: 'none', color: '#e74c3c',
    cursor: 'pointer', fontSize: 11, padding: '0 3px',
  } as React.CSSProperties,
} as const;
