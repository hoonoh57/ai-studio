// src/components/Timeline/TrackHeader.tsx

import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { SKILL_CONFIGS } from '@/types/project';
import type { Track, TrackType } from '@/types/project';

interface TrackHeaderProps {
  track: Track;
}

const MIN_TRACK_HEIGHT = 30;
const RESIZE_HANDLE_HEIGHT = 4;
const ICON_FONT_SIZE = 13;
const LABEL_FONT_SIZE = 10;
const CONTROL_FONT_SIZE = 12;
const CONTROL_PADDING = 2;
const CONTROL_GAP = 4;
const SECTION_GAP = 6;
const CONTEXT_MENU_WIDTH = 160;

const ICON_BY_TYPE: Record<TrackType, string> = {
  video: '🎬',
  audio: '🎵',
  text: '✏️',
  effect: '✨',
};

const MUTE_ICONS = { on: '🔇', off: '🔊' } as const;
const LOCK_ICONS = { on: '🔒', off: '🔓' } as const;
const VISIBLE_ICONS = { on: '👁️', off: '🚫' } as const;

const controlBtnBase: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: CONTROL_PADDING,
  fontSize: CONTROL_FONT_SIZE,
};

const contextMenuStyle: React.CSSProperties = {
  position: 'absolute',
  top: '80%',
  left: 20,
  width: CONTEXT_MENU_WIDTH,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-light)',
  borderRadius: 6,
  padding: 4,
  zIndex: 1000,
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};

const contextItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '6px 10px',
  fontSize: 11,
  color: 'var(--text-primary)',
  background: 'transparent',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
};

const contextItemDangerStyle: React.CSSProperties = {
  ...contextItemStyle,
  color: 'var(--danger)',
};

export function TrackHeader({ track }: TrackHeaderProps): React.ReactElement {
  const updateTrack = useEditorStore((s) => s.updateTrack);
  const removeTrack = useEditorStore((s) => s.removeTrack);
  const moveTrack = useEditorStore((s) => s.moveTrack);
  const duplicateTrack = useEditorStore((s) => s.duplicateTrack);
  const skillLevel = useEditorStore((s) => s.skillLevel);
  const tracks = useEditorStore((s) => s.project.tracks);
  const pushUndo = useEditorStore((s) => s.pushUndo);

  const [showMenu, setShowMenu] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState(track.name);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const config = SKILL_CONFIGS[skillLevel];

  // 외부 클릭 시 메뉴 닫기
  React.useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current !== null && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    const rafId = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClick);
    });
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [showMenu]);

  const handleResizeStart = (startY: number) => {
    const onMove = (e: MouseEvent) => {
      const newHeight = Math.max(
        MIN_TRACK_HEIGHT,
        track.height + (e.clientY - startY),
      );
      updateTrack(track.id, { height: newHeight });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleDelete = () => {
    setShowMenu(false);
    if (tracks.length <= 1) {
      window.alert('최소 1개 트랙은 유지해야 합니다.');
      return;
    }
    const hasClips = track.clips.length > 0;
    if (hasClips) {
      const ok = window.confirm(
        `"${track.name}" 트랙에 ${track.clips.length}개 클립이 있습니다.\n정말 삭제하시겠습니까?`,
      );
      if (!ok) return;
    }
    pushUndo('Delete track');
    removeTrack(track.id);
  };

  const handleRename = () => {
    setShowMenu(false);
    setIsEditing(true);
    setEditName(track.name);
  };

  const commitRename = () => {
    setIsEditing(false);
    const trimmed = editName.trim();
    if (trimmed.length > 0 && trimmed !== track.name) {
      updateTrack(track.id, { name: trimmed });
    }
  };

  const icon = ICON_BY_TYPE[track.type] ?? '📌';

  return (
    <div
      style={{
        position: 'relative',
        height: track.height,
        borderBottom: '1px solid var(--border)',
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: LABEL_FONT_SIZE,
        color: 'var(--text-secondary)',
      }}
      onContextMenu={e => { e.preventDefault(); setShowMenu(true); }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SECTION_GAP,
          flex: 1,
          overflow: 'hidden',
        }}
      >
        <span style={{ fontSize: ICON_FONT_SIZE }}>{icon}</span>
        {isEditing ? (
          <input
            autoFocus
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            style={{
              flex: 1,
              fontSize: LABEL_FONT_SIZE,
              background: 'var(--bg-deep)',
              border: '1px solid var(--accent)',
              borderRadius: 3,
              color: 'var(--text-primary)',
              padding: '1px 4px',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <span
            style={{
              flex: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              cursor: 'default',
            }}
            onDoubleClick={handleRename}
          >
            {track.name}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: CONTROL_GAP, alignItems: 'center' }}>
        <button
          style={{
            ...controlBtnBase,
            opacity: track.muted ? 0.3 : 1,
            filter: track.muted ? 'grayscale(1)' : 'none',
          }}
          onClick={() => updateTrack(track.id, { muted: !track.muted })}
          title="Mute/Unmute"
        >
          {track.muted ? MUTE_ICONS.on : MUTE_ICONS.off}
        </button>
        <button
          style={{
            ...controlBtnBase,
            opacity: track.locked ? 1 : 0.5,
          }}
          onClick={() => updateTrack(track.id, { locked: !track.locked })}
          title="Lock/Unlock"
        >
          {track.locked ? LOCK_ICONS.on : LOCK_ICONS.off}
        </button>
        <button
          style={{
            ...controlBtnBase,
            opacity: track.visible ? 1 : 0.4,
          }}
          onClick={() => updateTrack(track.id, { visible: !track.visible })}
          title="Show/Hide"
        >
          {track.visible ? VISIBLE_ICONS.on : VISIBLE_ICONS.off}
        </button>
      </div>

      {/* 우클릭 컨텍스트 메뉴 */}
      {showMenu && (
        <div ref={menuRef} style={contextMenuStyle}>
          <button
            style={contextItemStyle}
            onClick={handleRename}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            ✏️ 이름 변경
          </button>
          <button
            style={contextItemStyle}
            onClick={() => {
              setShowMenu(false);
              updateTrack(track.id, { locked: !track.locked });
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            {track.locked ? '🔓 잠금 해제' : '🔒 잠금'}
          </button>
          <button
            style={contextItemStyle}
            onClick={() => {
              setShowMenu(false);
              updateTrack(track.id, { muted: !track.muted });
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            {track.muted ? '🔊 음소거 해제' : '🔇 음소거'}
          </button>
          <button
            style={contextItemStyle}
            onClick={() => {
              setShowMenu(false);
              updateTrack(track.id, { visible: !track.visible });
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            {track.visible ? '🚫 숨기기' : '👁️ 표시'}
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <button
            style={contextItemStyle}
            onClick={() => { setShowMenu(false); moveTrack(track.id, 'up'); }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            ↑ 트랙을 위로 이동
          </button>
          <button
            style={contextItemStyle}
            onClick={() => { setShowMenu(false); moveTrack(track.id, 'down'); }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            ↓ 트랙을 아래로 이동
          </button>
          <button
            style={contextItemStyle}
            onClick={() => { setShowMenu(false); duplicateTrack(track.id); }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            👯 트랙 복제
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <button
            style={contextItemDangerStyle}
            onClick={handleDelete}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,67,54,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            🗑️ 트랙 삭제
          </button>
        </div>
      )}

      {/* 리사이즈 핸들 */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: RESIZE_HANDLE_HEIGHT,
          cursor: 'ns-resize',
          background: 'transparent',
          zIndex: 1,
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleResizeStart(e.clientY);
        }}
      />
    </div>
  );
}
