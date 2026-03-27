/* ─── src/components/Effects/TransitionPanel.tsx ─── */
import React, { useState, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';

const TRANSITION_PRESETS = [
  { type: 'dissolve', label: 'Dissolve', icon: '🌊', defaultDuration: 0.5 },
  { type: 'fade-black', label: 'Fade to Black', icon: '⬛', defaultDuration: 0.5 },
  { type: 'fade-white', label: 'Fade to White', icon: '⬜', defaultDuration: 0.5 },
  { type: 'wipe-left', label: 'Wipe Left', icon: '◀️', defaultDuration: 0.5 },
  { type: 'wipe-right', label: 'Wipe Right', icon: '▶️', defaultDuration: 0.5 },
  { type: 'wipe-up', label: 'Wipe Up', icon: '🔼', defaultDuration: 0.5 },
  { type: 'wipe-down', label: 'Wipe Down', icon: '🔽', defaultDuration: 0.5 },
  { type: 'slide-left', label: 'Slide Left', icon: '⏪', defaultDuration: 0.4 },
  { type: 'slide-right', label: 'Slide Right', icon: '⏩', defaultDuration: 0.4 },
  { type: 'zoom-in', label: 'Zoom In', icon: '🔍', defaultDuration: 0.6 },
  { type: 'zoom-out', label: 'Zoom Out', icon: '🔎', defaultDuration: 0.6 },
  { type: 'blur', label: 'Blur', icon: '🌫️', defaultDuration: 0.5 },
] as const;

export function TransitionPanel(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const transitions = useEditorStore(s => s.transitions);
  const addTransition = useEditorStore(s => s.addTransition);
  const removeTransition = useEditorStore(s => s.removeTransition);
  const selectedClipId = useEditorStore(s => s.selectedClipId);
  const pushUndo = useEditorStore(s => s.pushUndo);

  const [selectedPreset, setSelectedPreset] = useState<string>('dissolve');
  const [duration, setDuration] = useState(0.5);

  // 선택된 클립과 바로 이전 클립 찾기 (같은 트랙)
  const getAdjacentClipPair = useCallback(() => {
    if (!selectedClipId) return null;
    for (const track of project.tracks) {
      const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
      const idx = sortedClips.findIndex(c => c.id === selectedClipId);
      if (idx > 0) {
        return { clipA: sortedClips[idx - 1], clipB: sortedClips[idx], trackId: track.id };
      }
    }
    return null;
  }, [selectedClipId, project.tracks]);

  const pair = getAdjacentClipPair();

  const handleApply = useCallback(() => {
    if (!pair) return;
    pushUndo('트랜지션 추가');
    addTransition({
      id: `tr_${Date.now()}`,
      type: selectedPreset,
      clipAId: pair.clipA.id,
      clipBId: pair.clipB.id,
      duration,
    });
  }, [pair, selectedPreset, duration, pushUndo, addTransition]);

  const activeTransitions = transitions.filter(t =>
    t.clipBId === selectedClipId || t.clipAId === selectedClipId
  );

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
        Transitions
      </div>

      {/* 적용된 트랜지션 */}
      {activeTransitions.length > 0 && (
        <div style={{ padding: 8, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
            APPLIED
          </div>
          {activeTransitions.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 8px', fontSize: 11, color: '#aaa',
              background: 'var(--bg-deep)', borderRadius: 4, marginBottom: 2,
            }}>
              <span>
                {TRANSITION_PRESETS.find(p => p.type === t.type)?.icon ?? '🔀'} {t.type} ({t.duration}s)
              </span>
              <button style={{
                background: 'none', border: 'none', color: '#e74c3c',
                cursor: 'pointer', fontSize: 11,
              }} onClick={() => {
                pushUndo('트랜지션 제거');
                removeTransition(t.id);
              }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* 적용 대상 안내 */}
      <div style={{ padding: '8px 12px', fontSize: 11, color: '#666', flexShrink: 0 }}>
        {!selectedClipId
          ? '클립을 선택하세요'
          : !pair
            ? '이전 클립이 없어 트랜지션을 적용할 수 없습니다'
            : `${pair.clipA.id.slice(-5)} → ${pair.clipB.id.slice(-5)} 사이에 적용`
        }
      </div>

      {/* 길이 조절 */}
      {pair && (
        <div style={{
          padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, color: '#888', flexShrink: 0,
        }}>
          <span>Duration:</span>
          <input type="range" min={0.1} max={2} step={0.1}
            value={duration} onChange={e => setDuration(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent)' }} />
          <span style={{ fontFamily: 'monospace' }}>{duration.toFixed(1)}s</span>
        </div>
      )}

      {/* 트랜지션 프리셋 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TRANSITION_PRESETS.map(preset => (
            <button
              key={preset.type}
              style={{
                width: 80, padding: '10px 4px', borderRadius: 6,
                background: selectedPreset === preset.type ? 'var(--accent)' : 'var(--bg-surface)',
                border: `1px solid ${selectedPreset === preset.type ? 'var(--accent)' : 'var(--border)'}`,
                cursor: 'pointer', textAlign: 'center',
                color: selectedPreset === preset.type ? '#fff' : '#aaa',
                fontSize: 10, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 4,
              }}
              onClick={() => { setSelectedPreset(preset.type); setDuration(preset.defaultDuration); }}
            >
              <span style={{ fontSize: 20 }}>{preset.icon}</span>
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 적용 버튼 */}
      <div style={{
        padding: 8, borderTop: '1px solid var(--border)', flexShrink: 0,
      }}>
        <button
          disabled={!pair}
          style={{
            width: '100%', padding: '8px 0', borderRadius: 6, border: 'none',
            background: pair ? 'var(--accent)' : '#333',
            color: pair ? '#fff' : '#555',
            cursor: pair ? 'pointer' : 'default',
            fontSize: 12, fontWeight: 600,
          }}
          onClick={handleApply}
        >
          트랜지션 적용
        </button>
      </div>
    </div>
  );
}
