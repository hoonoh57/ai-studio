/* ─── src/components/Timeline/ClipContextMenu.tsx ─── */
import React, { useRef, useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import {
  SKILL_CONFIGS, BLEND_MODE_LIST, SPEED_PRESETS,
} from '@/types/project';
import type { Clip, BlendMode } from '@/types/project';

interface ClipContextMenuProps {
  clip: Clip;
  trackId: string;
  position: { x: number; y: number };
  onClose: () => void;
}

const MENU_W = 200;
// const SUB_W = 160;

const menuStyle: React.CSSProperties = {
  position: 'fixed',
  width: MENU_W,
  background: 'var(--bg-tertiary, #2a2a3c)',
  border: '1px solid var(--border-primary, #444)',
  borderRadius: 6,
  padding: '4px 0',
  zIndex: 2000,
  boxShadow: '0 4px 16px rgba(0,0,0,.5)',
};

const itemStyle = (disabled?: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  fontSize: 12,
  color: disabled ? '#555' : '#ddd',
  background: 'transparent',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  cursor: disabled ? 'default' : 'pointer',
});

const divider: React.CSSProperties = {
  height: 1,
  background: 'var(--border-secondary, #333)',
  margin: '4px 0',
};

export const ClipContextMenu: React.FC<ClipContextMenuProps> = ({
  clip, trackId, position, onClose,
}) => {
  const store = useEditorStore();
  const {
    skillLevel, splitClip, removeClip, selectClip, currentTime,
    pushUndo, setClipSpeed, setClipBlendMode, unlinkClip,
    ungroupClips,
  } = store;

  const config = SKILL_CONFIGS[skillLevel] ?? SKILL_CONFIGS.beginner;
  const menuRef = useRef<HTMLDivElement>(null);

  const [showSpeed, setShowSpeed] = React.useState(false);
  const [showBlend, setShowBlend] = React.useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleSplit = () => {
    splitClip(clip.id, currentTime);
    onClose();
  };

  const handleDelete = () => {
    pushUndo('클립 삭제');
    removeClip(clip.id);
    selectClip(null);
    onClose();
  };

  const handleSpeed = (speed: number) => {
    setClipSpeed(clip.id, speed);
    setShowSpeed(false);
    onClose();
  };

  const handleReverse = () => {
    setClipSpeed(clip.id, clip.speed, !clip.reverse);
    onClose();
  };

  const handleBlend = (mode: BlendMode) => {
    setClipBlendMode(clip.id, mode);
    setShowBlend(false);
    onClose();
  };

  const handleUnlink = () => {
    pushUndo('링크 해제');
    unlinkClip(clip.id);
    onClose();
  };

  const handleUngroup = () => {
    if (clip.groupId) {
      ungroupClips(clip.groupId);
    }
    onClose();
  };

  return (
    <div ref={menuRef} style={{ ...menuStyle, left: position.x, top: position.y }}>
      {/* 분할 */}
      <button style={itemStyle()} onClick={handleSplit}>
        ✂️ 분할 (현재 시간)
      </button>

      {/* 속도 */}
      {config.showSpeedControl && (
        <>
          <button style={itemStyle()} onClick={() => { setShowSpeed(!showSpeed); setShowBlend(false); }}>
            ⚡ 속도 ({clip.speed}x{clip.reverse ? ' 역재생' : ''}) {showSpeed ? '▲' : '▼'}
          </button>
          {showSpeed && (
            <div style={{ padding: '4px 12px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                {SPEED_PRESETS.map(s => (
                  <button
                    key={s}
                    style={{
                      padding: '2px 8px', fontSize: 11, borderRadius: 3, border: 'none',
                      background: clip.speed === s ? 'var(--accent, #6c5ce7)' : 'var(--bg-secondary, #1e1e2e)',
                      color: clip.speed === s ? '#fff' : '#aaa',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleSpeed(s)}
                  >
                    {s}x
                  </button>
                ))}
              </div>
              <button style={itemStyle()} onClick={handleReverse}>
                🔄 역재생 {clip.reverse ? '✓' : ''}
              </button>
            </div>
          )}
        </>
      )}

      {/* 블렌드 모드 */}
      {config.showBlendModes && (
        <>
          <button style={itemStyle()} onClick={() => { setShowBlend(!showBlend); setShowSpeed(false); }}>
            🎨 블렌드 ({clip.blendMode}) {showBlend ? '▲' : '▼'}
          </button>
          {showBlend && (
            <div style={{ maxHeight: 180, overflowY: 'auto', padding: '4px 12px' }}>
              {BLEND_MODE_LIST.map(m => (
                <button
                  key={m}
                  style={{
                    ...itemStyle(),
                    color: clip.blendMode === m ? '#fff' : '#aaa',
                    background: clip.blendMode === m ? 'var(--accent, #6c5ce7)' : 'transparent',
                    borderRadius: 3,
                    padding: '3px 8px',
                    fontSize: 11,
                  }}
                  onClick={() => handleBlend(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div style={divider} />

      {/* 링크 */}
      {clip.linkedClipId && (
        <button style={itemStyle()} onClick={handleUnlink}>
          🔓 링크 해제
        </button>
      )}

      {/* 그룹 */}
      {config.showClipGrouping && clip.groupId && (
        <button style={itemStyle()} onClick={handleUngroup}>
          📦 그룹 해제
        </button>
      )}

      <div style={divider} />

      {/* 삭제 */}
      <button style={{ ...itemStyle(), color: '#ff6b6b' }} onClick={handleDelete}>
        🗑️ 삭제
      </button>
    </div>
  );
};
