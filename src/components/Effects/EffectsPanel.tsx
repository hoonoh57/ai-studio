/* ─── src/components/Effects/EffectsPanel.tsx ─── */
import React, { useState, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { SKILL_CONFIGS } from '@/types/project';
import type { Filter } from '@/types/project';

const EFFECT_PRESETS: readonly {
  name: string; icon: string; category: string;
  params: Record<string, number>;
}[] = [
  { name: 'Brightness', icon: '☀️', category: 'color', params: { brightness: 0 } },
  { name: 'Contrast', icon: '◐', category: 'color', params: { contrast: 0 } },
  { name: 'Saturation', icon: '🎨', category: 'color', params: { saturation: 0 } },
  { name: 'Blur', icon: '🌫️', category: 'blur', params: { radius: 0 } },
  { name: 'Sharpen', icon: '🔪', category: 'blur', params: { amount: 0 } },
  { name: 'Vignette', icon: '🔲', category: 'lens', params: { intensity: 50, radius: 80 } },
  { name: 'Noise', icon: '📺', category: 'stylize', params: { amount: 10 } },
  { name: 'Sepia', icon: '🟤', category: 'color', params: { intensity: 100 } },
  { name: 'Grayscale', icon: '⬜', category: 'color', params: { intensity: 100 } },
  { name: 'Hue Shift', icon: '🌈', category: 'color', params: { degrees: 0 } },
  { name: 'Temperature', icon: '🌡️', category: 'color', params: { kelvin: 6500 } },
  { name: 'Chromatic', icon: '💎', category: 'lens', params: { offset: 3 } },
];

const CATEGORIES = ['all', 'color', 'blur', 'lens', 'stylize'] as const;
const CAT_LABELS: Record<string, string> = {
  all: '전체', color: '색상', blur: '블러', lens: '렌즈', stylize: '스타일',
};

let _fxUid = 0;
const fxUid = () => `fx_${Date.now()}_${++_fxUid}`;

export function EffectsPanel(): React.ReactElement {
  const selectedClipId = useEditorStore(s => s.selectedClipId);
  const project = useEditorStore(s => s.project);
  const updateClip = useEditorStore(s => s.updateClip);
  const pushUndo = useEditorStore(s => s.pushUndo);
  const skillLevel = useEditorStore(s => s.skillLevel);
  const config = SKILL_CONFIGS[skillLevel];

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expandedFx, setExpandedFx] = useState<string | null>(null);

  const clip = selectedClipId
    ? project.tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId)
    : undefined;

  const filteredPresets = activeCategory === 'all'
    ? EFFECT_PRESETS
    : EFFECT_PRESETS.filter(p => p.category === activeCategory);

  const addEffect = useCallback((preset: typeof EFFECT_PRESETS[number]) => {
    if (!clip) return;
    pushUndo('이펙트 추가');
    const newFilter: Filter = {
      id: fxUid(),
      name: preset.name,
      params: { ...preset.params },
    };
    updateClip(clip.id, {
      filters: [...clip.filters, newFilter],
    });
  }, [clip, pushUndo, updateClip]);

  const removeEffect = useCallback((filterId: string) => {
    if (!clip) return;
    pushUndo('이펙트 제거');
    updateClip(clip.id, {
      filters: clip.filters.filter(f => f.id !== filterId),
    });
  }, [clip, pushUndo, updateClip]);

  const updateEffectParam = useCallback((
    filterId: string, paramKey: string, value: number,
  ) => {
    if (!clip) return;
    updateClip(clip.id, {
      filters: clip.filters.map(f =>
        f.id === filterId
          ? { ...f, params: { ...f.params, [paramKey]: value } }
          : f
      ),
    });
  }, [clip, updateClip]);

  const moveEffect = useCallback((filterId: string, dir: -1 | 1) => {
    if (!clip) return;
    const idx = clip.filters.findIndex(f => f.id === filterId);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= clip.filters.length) return;
    pushUndo('이펙트 순서 변경');
    const next = [...clip.filters];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    updateClip(clip.id, { filters: next });
  }, [clip, pushUndo, updateClip]);

  if (!config.showEffects) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#555', fontSize: 12 }}>
        이펙트는 중급 이상에서 사용할 수 있습니다
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-panel)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 12px', fontSize: 12, fontWeight: 600,
        color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        Effects {clip ? `— ${clip.filters.length} applied` : ''}
      </div>

      {/* 적용된 이펙트 체인 */}
      {clip && clip.filters.length > 0 && (
        <div style={{
          padding: 8, borderBottom: '1px solid var(--border)',
          maxHeight: 200, overflowY: 'auto', flexShrink: 0,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--accent)',
            textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5,
          }}>
            Effect Chain
          </div>
          {clip.filters.map((f, idx) => (
            <div key={f.id} style={{
              padding: '6px 8px', marginBottom: 4, borderRadius: 4,
              background: expandedFx === f.id ? 'var(--bg-surface)' : 'var(--bg-deep, #111)',
              border: `1px solid ${expandedFx === f.id ? 'var(--accent)' : 'var(--border)'}`,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                cursor: 'pointer',
              }} onClick={() => setExpandedFx(expandedFx === f.id ? null : f.id)}>
                <span style={{ fontSize: 12 }}>
                  {EFFECT_PRESETS.find(p => p.name === f.name)?.icon ?? '✨'}
                </span>
                <span style={{ flex: 1, color: '#ccc' }}>
                  {idx + 1}. {f.name}
                </span>
                <button style={{
                  background: 'none', border: 'none', color: '#666', fontSize: 10,
                  cursor: 'pointer', padding: '0 2px',
                }} onClick={(e) => { e.stopPropagation(); moveEffect(f.id, -1); }}
                  disabled={idx === 0}>▲</button>
                <button style={{
                  background: 'none', border: 'none', color: '#666', fontSize: 10,
                  cursor: 'pointer', padding: '0 2px',
                }} onClick={(e) => { e.stopPropagation(); moveEffect(f.id, 1); }}
                  disabled={idx === clip.filters.length - 1}>▼</button>
                <button style={{
                  background: 'none', border: 'none', color: '#e74c3c', fontSize: 11,
                  cursor: 'pointer', padding: '0 2px',
                }} onClick={(e) => { e.stopPropagation(); removeEffect(f.id); }}>✕</button>
              </div>
              {expandedFx === f.id && (
                <div style={{ marginTop: 6, paddingLeft: 4 }}>
                  {Object.entries(f.params).map(([key, val]) => (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
                    }}>
                      <span style={{ fontSize: 10, color: '#888', width: 70, flexShrink: 0 }}>{key}</span>
                      <input
                        type="range"
                        min={-100} max={200} step={1}
                        value={Number(val)}
                        onChange={(e) => updateEffectParam(f.id, key, parseFloat(e.target.value))}
                        style={{ flex: 1, accentColor: 'var(--accent)' }}
                      />
                      <span style={{ fontSize: 10, color: '#aaa', width: 30, textAlign: 'right' }}>
                        {Number(val).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 카테고리 필터 */}
      <div style={{
        display: 'flex', gap: 4, padding: '8px 8px 4px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {CATEGORIES.map(cat => (
          <button key={cat} style={{
            padding: '3px 8px', fontSize: 10, borderRadius: 10,
            border: 'none', cursor: 'pointer',
            background: activeCategory === cat ? 'var(--accent)' : 'var(--bg-surface)',
            color: activeCategory === cat ? '#fff' : '#888',
          }} onClick={() => setActiveCategory(cat)}>
            {CAT_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* 사용 가능한 이펙트 목록 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {!clip ? (
          <div style={{ textAlign: 'center', color: '#555', fontSize: 12, paddingTop: 20 }}>
            클립을 선택하세요
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {filteredPresets.map(preset => (
              <button key={preset.name} style={{
                width: 72, padding: '8px 4px', borderRadius: 6,
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                cursor: 'pointer', textAlign: 'center', color: '#aaa',
                fontSize: 10, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 2,
              }} onClick={() => addEffect(preset)}>
                <span style={{ fontSize: 18 }}>{preset.icon}</span>
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
