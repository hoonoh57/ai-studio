/* ─── src/components/Timeline/TrackHeader.tsx ─── */
import React, { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { Track, SKILL_CONFIGS } from '@/types/project';

/* ========== 상수 ========== */
const RESIZE_HANDLE = 6;
const MIN_TRACK_H = 24;
const MAX_TRACK_H = 200;
const BTN = 20;
const GAP = 2;
const FONT_NAME = 11;
const FONT_BTN = 12;
const MENU_W = 180;
const COLOR_SWATCH = 16;

const TYPE_ICON: Record<string, string> = {
  video: '🎬', audio: '🔊', text: '🔤', effect: '✨',
};

const TRACK_COLOR_PALETTE = [
  '#4A90D9', '#50C878', '#FFB347', '#DA70D6',
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F1948A', '#82E0AA',
];

interface TrackHeaderProps {
  track: Track;
  index?: number;
  trackCount?: number;
  onDragStart?: (idx: number) => void;
  onDragEnter?: (idx: number) => void;
  onDragEnd?: () => void;
}

export const TrackHeader: React.FC<TrackHeaderProps> = ({
  track,
  index = 0,
  trackCount = 1,
  onDragStart,
  onDragEnter,
  onDragEnd,
}) => {
  const store = useEditorStore();
  const { updateTrack, removeTrack, moveTrack, duplicateTrack, pushUndo, skillLevel, project } = store;
  const config = SKILL_CONFIGS[skillLevel] ?? SKILL_CONFIGS.beginner;

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(track.name);
  const [showColors, setShowColors] = useState(false);
  const [showHeights, setShowHeights] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
        setShowColors(false);
        setShowHeights(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ctxMenu]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== track.name) {
      pushUndo('트랙 이름 변경');
      updateTrack(track.id, { name: trimmed });
    }
    setEditing(false);
  };

  const handleDelete = () => {
    setCtxMenu(null);
    const totalTracks = project?.tracks?.length ?? trackCount;
    if (totalTracks <= 1) { alert('최소 1개 트랙이 필요합니다.'); return; }
    if (track.clips.length > 0) {
      if (!confirm(`"${track.name}" 트랙에 ${track.clips.length}개 클립이 있습니다. 삭제하시겠습니까?`)) return;
    }
    pushUndo('트랙 삭제');
    removeTrack(track.id);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = track.height;
    const onMove = (ev: MouseEvent) => {
      const newH = Math.max(MIN_TRACK_H, Math.min(MAX_TRACK_H, startH + ev.clientY - startY));
      updateTrack(track.id, { height: newH, heightPreset: 'custom' as any });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleColorSelect = (color: string) => {
    pushUndo('트랙 컬러 변경');
    store.setTrackColor(track.id, color);
    setCtxMenu(null);
  };

  const handleHeightPreset = (preset: string) => {
    pushUndo('트랙 높이 변경');
    store.setTrackHeightPreset(track.id, preset);
    setCtxMenu(null);
  };

  const handleSoloToggle = () => {
    store.toggleSolo(track.id);
    setCtxMenu(null);
  };

  const trackColor = track.color || '#4A90D9';
  const showSolo = config.showSoloMode && track.type === 'audio';
  const canReorder = config.showTrackReorder;

  /* ── B3 FIX: 단일 행 가로 레이아웃 ── */
  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          height: track.height,
          boxSizing: 'border-box',
          borderBottom: '1px solid var(--border-secondary, #333)',
          background: 'var(--bg-secondary, #1e1e2e)',
          position: 'relative',
          overflow: 'hidden',
          userSelect: 'none',
          gap: GAP,
          padding: '0 4px',
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY });
          setShowColors(false);
          setShowHeights(false);
        }}
        draggable={!!canReorder}
        onDragStart={(e) => {
          if (!canReorder) { e.preventDefault(); return; }
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(index));
          onDragStart?.(index);
        }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
        onDragEnter={() => onDragEnter?.(index)}
        onDragEnd={() => onDragEnd?.()}
      >
        {/* 컬러 바 */}
        {config.showTrackColor && (
          <div style={{
            width: 3,
            alignSelf: 'stretch',
            background: trackColor,
            borderRadius: 2,
            flexShrink: 0,
          }} />
        )}

        {/* 타입 아이콘 */}
        <span style={{ fontSize: 13, flexShrink: 0 }}>{TYPE_ICON[track.type] ?? '🎬'}</span>

        {/* 트랙 이름 */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {editing ? (
            <input
              ref={inputRef}
              style={{
                fontSize: FONT_NAME, color: '#fff',
                background: 'var(--bg-tertiary, #333)',
                border: '1px solid var(--accent, #6c5ce7)',
                borderRadius: 3, padding: '0 2px',
                width: '100%', outline: 'none',
              }}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
          ) : (
            <div
              style={{
                fontSize: FONT_NAME, color: '#ccc',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
              onDoubleClick={() => { setEditName(track.name); setEditing(true); }}
              title={track.name}
            >
              {track.name}
            </div>
          )}
        </div>

        {/* 컨트롤 버튼 — 한 행에 가로로 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: GAP, flexShrink: 0 }}>
          <button
            style={{
              width: BTN, height: BTN, fontSize: FONT_BTN, border: 'none', borderRadius: 3,
              background: track.muted ? 'var(--accent, #6c5ce7)' : 'transparent',
              color: track.muted ? '#fff' : '#999', cursor: 'pointer', padding: 0,
              lineHeight: `${BTN}px`,
            }}
            onClick={() => updateTrack(track.id, { muted: !track.muted })}
            title={track.muted ? 'Unmute' : 'Mute'}
          >
            {track.muted ? '🔇' : '🔊'}
          </button>

          {showSolo && (
            <button
              style={{
                width: BTN, height: BTN, fontSize: FONT_BTN, border: 'none', borderRadius: 3,
                background: track.solo ? 'var(--accent, #6c5ce7)' : 'transparent',
                color: track.solo ? '#fff' : '#999', cursor: 'pointer', padding: 0,
                lineHeight: `${BTN}px`,
              }}
              onClick={handleSoloToggle}
              title="Solo"
            >
              {track.solo ? '🎧' : '🎵'}
            </button>
          )}

          <button
            style={{
              width: BTN, height: BTN, fontSize: FONT_BTN, border: 'none', borderRadius: 3,
              background: track.locked ? 'var(--accent, #6c5ce7)' : 'transparent',
              color: track.locked ? '#fff' : '#999', cursor: 'pointer', padding: 0,
              lineHeight: `${BTN}px`,
            }}
            onClick={() => updateTrack(track.id, { locked: !track.locked })}
            title={track.locked ? 'Unlock' : 'Lock'}
          >
            {track.locked ? '🔒' : '🔓'}
          </button>

          <button
            style={{
              width: BTN, height: BTN, fontSize: FONT_BTN, border: 'none', borderRadius: 3,
              background: !track.visible ? 'var(--accent, #6c5ce7)' : 'transparent',
              color: !track.visible ? '#fff' : '#999', cursor: 'pointer', padding: 0,
              lineHeight: `${BTN}px`,
            }}
            onClick={() => updateTrack(track.id, { visible: !track.visible })}
            title={track.visible ? 'Hide' : 'Show'}
          >
            {track.visible ? '👁' : '👁🗨'}
          </button>
        </div>

        {/* 리사이즈 핸들 */}
        <div
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: RESIZE_HANDLE, cursor: 'row-resize', zIndex: 2,
          }}
          onMouseDown={handleResizeStart}
        />
      </div>

      {/* ── 컨텍스트 메뉴 ── */}
      {ctxMenu && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed', left: ctxMenu.x, top: ctxMenu.y,
            width: MENU_W, background: 'var(--bg-tertiary, #2a2a3c)',
            border: '1px solid var(--border-primary, #444)', borderRadius: 6,
            padding: '4px 0', zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,.5)',
          }}
        >
          <button
            style={menuItemStyle()}
            onClick={() => { setCtxMenu(null); setEditName(track.name); setEditing(true); }}
          >
            ✏️ 이름 변경
          </button>

          {config.showTrackColor && (
            <>
              <button style={menuItemStyle()} onClick={() => setShowColors(!showColors)}>
                🎨 트랙 컬러 {showColors ? '▲' : '▼'}
              </button>
              {showColors && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 12px' }}>
                  {TRACK_COLOR_PALETTE.map(c => (
                    <div
                      key={c}
                      style={{
                        width: COLOR_SWATCH, height: COLOR_SWATCH, borderRadius: 3,
                        background: c,
                        border: c === trackColor ? '2px solid #fff' : '2px solid transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleColorSelect(c)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {config.showTrackHeightPresets && (
            <>
              <button style={menuItemStyle()} onClick={() => setShowHeights(!showHeights)}>
                📏 트랙 높이 {showHeights ? '▲' : '▼'}
              </button>
              {showHeights && (
                <div style={{ display: 'flex', gap: 4, padding: '6px 12px' }}>
                  {['S', 'M', 'L', 'XL'].map(p => (
                    <button
                      key={p}
                      style={{
                        padding: '2px 8px', fontSize: 11, borderRadius: 3, border: 'none',
                        background: track.heightPreset === p
                          ? 'var(--accent, #6c5ce7)' : 'var(--bg-secondary, #1e1e2e)',
                        color: track.heightPreset === p ? '#fff' : '#aaa',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleHeightPreset(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <div style={{ height: 1, background: 'var(--border-secondary, #333)', margin: '4px 0' }} />

          <button
            style={menuItemStyle(index === 0)}
            onClick={() => { if (index > 0) { pushUndo('트랙 위로 이동'); moveTrack(track.id, 'up'); setCtxMenu(null); } }}
          >
            ⬆️ 위로 이동
          </button>
          <button
            style={menuItemStyle(index >= trackCount - 1)}
            onClick={() => { if (index < trackCount - 1) { pushUndo('트랙 아래로 이동'); moveTrack(track.id, 'down'); setCtxMenu(null); } }}
          >
            ⬇️ 아래로 이동
          </button>

          {config.showTrackDuplicate && (
            <button
              style={menuItemStyle()}
              onClick={() => { pushUndo('트랙 복제'); duplicateTrack(track.id); setCtxMenu(null); }}
            >
              📋 트랙 복제
            </button>
          )}

          <div style={{ height: 1, background: 'var(--border-secondary, #333)', margin: '4px 0' }} />

          <button
            style={{ ...menuItemStyle(), color: '#ff6b6b' }}
            onClick={handleDelete}
          >
            🗑️ 트랙 삭제
          </button>
        </div>
      )}
    </>
  );
};

function menuItemStyle(disabled?: boolean): React.CSSProperties {
  return {
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
  };
}
