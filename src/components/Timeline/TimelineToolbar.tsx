/* ─── src/components/Timeline/TimelineToolbar.tsx ─── */
import React, { useState, useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { SKILL_CONFIGS } from '@/types/project';
import type { TrackType } from '@/types/project';

const TOOLBAR_H = 36;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10;
const ZOOM_STEP = 0.1;
const ZOOM_W = 100;
const FONT_SM = 11;
const FONT_XS = 10;
const VALID_TRIM_MODES = ['normal', 'ripple', 'roll', 'slip', 'slide'];

const TRACK_TYPE_MENU: { type: TrackType; label: string; icon: string }[] = [
  { type: 'video', label: 'Video', icon: '🎬' },
  { type: 'audio', label: 'Audio', icon: '🔊' },
  { type: 'text',  label: 'Text',  icon: '🔤' },
  { type: 'effect', label: 'Effect', icon: '✨' },
];

interface TimelineToolbarProps {
  selectedClipIds?: Set<string>;
}

function isClipLocked(clipId: string, tracks: { locked: boolean; clips: { id: string }[] }[]): boolean {
  for (const t of tracks) {
    if (t.locked && t.clips.some(c => c.id === clipId)) return true;
  }
  return false;
}

export const TimelineToolbar: React.FC<TimelineToolbarProps> = ({ selectedClipIds = new Set() }) => {
  const {
    trimMode, setTrimMode, snapEnabled, toggleSnap, zoom, setZoom,
    skillLevel, selectedClipId, currentTime, addTrackChecked,
    setInPoint, setOutPoint, addMarker,
    undo, redo, canUndo, canRedo, project, splitClip, pushUndo,
    groupClips, ungroupClips,
    closeAllGaps,  // ★ 추가
  } = useEditorStore();

  const config = SKILL_CONFIGS[skillLevel] ?? SKILL_CONFIGS.beginner;
  const [showMenu, setShowMenu] = useState(false);

  const trackCount = project.tracks.length;
  const maxTracks = config.maxTracks;
  const maxLabel = maxTracks >= 999 ? '∞' : String(maxTracks);
  const atLimit = trackCount >= maxTracks;

  /* 메뉴 외부 클릭 닫기 */
  useEffect(() => {
    if (!showMenu) return;
    const handler = () => setShowMenu(false);
    setTimeout(() => document.addEventListener('click', handler), 0);
    return () => document.removeEventListener('click', handler);
  }, [showMenu]);

  const btnStyle = (disabled?: boolean): React.CSSProperties => ({
    padding: '3px 10px', fontSize: FONT_SM, border: 'none', borderRadius: 4,
    cursor: disabled ? 'default' : 'pointer',
    background: 'var(--bg-tertiary, #2a2a3c)',
    color: disabled ? '#555' : '#ccc',
    opacity: disabled ? 0.5 : 1,
  });

  const btnActive: React.CSSProperties = {
    background: 'var(--accent, #6c5ce7)', color: '#fff',
  };

  return (
    <div style={{
      height: TOOLBAR_H, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px',
      background: 'var(--bg-secondary, #1e1e2e)', borderBottom: '1px solid var(--border-secondary, #333)',
      flexShrink: 0, position: 'relative',
    }}>
      <button style={btnStyle(!canUndo())} onClick={() => { if (canUndo()) undo(); }} title="Undo (Ctrl+Z)">↩</button>
      <button style={btnStyle(!canRedo())} onClick={() => { if (canRedo()) redo(); }} title="Redo (Ctrl+Shift+Z)">↪</button>
      <div style={{ width: 1, height: 20, background: 'var(--border-secondary, #444)', margin: '0 2px' }} />

      <div style={{ position: 'relative' }}>
        <button
          style={btnStyle(atLimit)}
          onClick={(e) => { e.stopPropagation(); if (!atLimit) setShowMenu(!showMenu); }}
        >
          + Track
        </button>
        <span style={{ fontSize: FONT_XS, color: '#777', marginLeft: 4 }}>{trackCount}/{maxLabel}</span>
        {showMenu && (
          <div style={{
            position: 'absolute', top: TOOLBAR_H + 2, left: 0,
            background: 'var(--bg-tertiary, #2a2a3c)', border: '1px solid var(--border-primary, #444)',
            borderRadius: 6, padding: '4px 0', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,.4)', minWidth: 140,
          }}>
            {TRACK_TYPE_MENU.map(item => (
              <button key={item.type} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', fontSize: FONT_SM, color: '#ccc',
                cursor: 'pointer', background: 'transparent', border: 'none', width: '100%', textAlign: 'left',
              }} onClick={() => { addTrackChecked(item.type); setShowMenu(false); }}>
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ width: 1, height: 20, background: 'var(--border-secondary, #444)', margin: '0 2px' }} />

      {config.showAdvancedTrim && (
        <select
          value={trimMode}
          onChange={e => { if (VALID_TRIM_MODES.includes(e.target.value)) setTrimMode(e.target.value as any); }}
          style={{ fontSize: FONT_SM, background: 'var(--bg-tertiary, #2a2a3c)', color: '#ccc', border: '1px solid var(--border-secondary, #444)', borderRadius: 4, padding: '2px 4px' }}
        >
          {VALID_TRIM_MODES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
        </select>
      )}

      {skillLevel === 'expert' && (
        <>
          <button style={btnStyle()} onClick={() => setInPoint(currentTime)}>In</button>
          <button style={btnStyle()} onClick={() => setOutPoint(currentTime)}>Out</button>
          <button style={btnStyle()} onClick={() => addMarker({ id: `mkr_${Date.now()}`, time: currentTime, label: '', color: '#FFD700' })}>M</button>
        </>
      )}

      <button style={{ ...btnStyle(), ...(snapEnabled ? btnActive : {}) }} onClick={toggleSnap}>🧲</button>
      <button
        style={btnStyle(!selectedClipId)}
        onClick={() => { if (selectedClipId && !isClipLocked(selectedClipId, project.tracks)) { pushUndo('Split Clip'); splitClip(selectedClipId, currentTime); } }}
      >
        ✂
      </button>

      <button
        style={btnStyle()}
        onClick={() => closeAllGaps()}
        title="모든 트랙의 갭 닫기"
      >
        ⊟
      </button>

      {/* T-3.3: 클립 그룹핑 버튼 */}
      {config.showClipGrouping && (
        <>
          <button
            style={btnStyle(selectedClipIds.size < 2)}
            onClick={() => {
              if (selectedClipIds.size >= 2) {
                groupClips(Array.from(selectedClipIds));
              }
            }}
            title="그룹 (Shift+Click 후 선택)"
          >
            📦
          </button>
        </>
      )}

      <div style={{ flex: 1 }} />
      <span style={{ fontSize: FONT_XS, color: '#777' }}>{Math.round(zoom * 100)}%</span>
      <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={ZOOM_STEP} value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} style={{ width: ZOOM_W, accentColor: 'var(--accent, #6c5ce7)' }} />
    </div>
  );
};
