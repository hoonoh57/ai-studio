// src/components/MediaLibrary/AssetCard.tsx

import React, { useCallback, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { Asset } from '@/types/project';
import type { AssetMetadata } from '@/types/media';

// ── 상수 ──
const CARD_RADIUS = 6;
const CARD_PADDING = 6;
const THUMB_SIZE = 56;
const THUMB_RADIUS = 4;
const THUMB_ICON_SIZE = 22;
const NAME_FONT_SIZE = 11;
const META_FONT_SIZE = 9;
const TAG_FONT_SIZE = 8;
const TAG_PADDING_V = 1;
const TAG_PADDING_H = 4;
const TAG_RADIUS = 3;
const TAG_GAP = 2;
const FAV_BUTTON_SIZE = 18;
const FAV_FONT_SIZE = 12;
const MAX_VISIBLE_TAGS = 3;
const HOVER_BG = 'rgba(255, 255, 255, 0.05)';
const SELECTED_BORDER = 'var(--accent)';

const ICON_BY_TYPE: Record<string, string> = {
  video: '🎬',
  audio: '🎵',
  image: '🖼️',
};

// ── 헬퍼 ──
function formatDuration(sec: number): string {
  if (isNaN(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ── 스타일 ──
const baseCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: CARD_PADDING,
  padding: CARD_PADDING,
  borderRadius: CARD_RADIUS,
  background: 'var(--bg-surface)',
  cursor: 'grab',
  transition: 'background 0.15s, border-color 0.15s',
  border: '1px solid transparent',
  position: 'relative',
};

const thumbStyle: React.CSSProperties = {
  width: THUMB_SIZE,
  height: THUMB_SIZE,
  borderRadius: THUMB_RADIUS,
  background: 'var(--bg-deep)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: THUMB_ICON_SIZE,
  overflow: 'hidden',
  flexShrink: 0,
};

const thumbImgStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const infoStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const nameStyle: React.CSSProperties = {
  fontSize: NAME_FONT_SIZE,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  color: 'var(--text-primary)',
};

const metaStyle: React.CSSProperties = {
  fontSize: META_FONT_SIZE,
  color: 'var(--text-secondary)',
};

const tagRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: TAG_GAP,
  marginTop: 2,
};

const tagStyle: React.CSSProperties = {
  fontSize: TAG_FONT_SIZE,
  padding: `${TAG_PADDING_V}px ${TAG_PADDING_H}px`,
  borderRadius: TAG_RADIUS,
  background: 'rgba(255, 255, 255, 0.1)',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
};

const tagMoreStyle: React.CSSProperties = {
  ...tagStyle,
  color: 'var(--text-muted)',
  fontStyle: 'italic',
};

const favBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 4,
  width: FAV_BUTTON_SIZE,
  height: FAV_BUTTON_SIZE,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: FAV_FONT_SIZE,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: FAV_BUTTON_SIZE,
  padding: 0,
  transition: 'opacity 0.2s',
};

// ── Props ──
interface AssetCardProps {
  readonly asset: Asset;
  readonly meta: AssetMetadata | undefined;
  readonly isSelected: boolean;
  readonly showTags: boolean;
  readonly onSelect: (assetId: string) => void;
}

// ── 컴포넌트 ──
export function AssetCard({
  asset,
  meta,
  isSelected,
  showTags,
  onSelect,
}: AssetCardProps): React.ReactElement {
  const toggleFavorite = useEditorStore(s => s.toggleFavorite);
  const [isHovered, setIsHovered] = useState(false);

  const isFavorite = meta?.favorite === true;

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('assetId', asset.id);
    e.dataTransfer.effectAllowed = 'copy';
  }, [asset.id]);

  const handleFavClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(asset.id);
  }, [asset.id, toggleFavorite]);

  const cardStyle: React.CSSProperties = {
    ...baseCard,
    ...(isHovered ? { background: HOVER_BG } : {}),
    ...(isSelected ? { borderColor: SELECTED_BORDER } : {}),
  };

  const visibleTags = meta?.tags.slice(0, MAX_VISIBLE_TAGS) ?? [];
  const extraTagCount = (meta?.tags.length ?? 0) - MAX_VISIBLE_TAGS;

  // 메타 텍스트 조합
  const metaParts: string[] = [formatDuration(asset.duration)];
  if (asset.fileSize !== undefined) {
    metaParts.push(formatFileSize(asset.fileSize));
  }
  if (asset.width !== undefined && asset.height !== undefined) {
    metaParts.push(`${asset.width}×${asset.height}`);
  }

  return (
    <div
      style={cardStyle}
      draggable
      onDragStart={handleDragStart}
      onClick={() => onSelect(asset.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 썸네일 */}
      <div style={thumbStyle}>
        {asset.thumbnail ? (
          <img src={asset.thumbnail} alt={asset.name} style={thumbImgStyle} />
        ) : (
          ICON_BY_TYPE[asset.type] ?? '📁'
        )}
      </div>

      {/* 정보 */}
      <div style={infoStyle}>
        <div style={nameStyle} title={asset.name}>{asset.name}</div>
        <div style={metaStyle}>{metaParts.join(' · ')}</div>

        {/* 태그 (showTags가 true일 때만) */}
        {showTags && visibleTags.length > 0 && (
          <div style={tagRowStyle}>
            {visibleTags.map(tag => (
              <span key={tag.label} style={tagStyle}>{tag.label}</span>
            ))}
            {extraTagCount > 0 && (
              <span style={tagMoreStyle}>+{extraTagCount}</span>
            )}
          </div>
        )}
      </div>

      {/* 즐겨찾기 버튼 */}
      <button
        style={{
          ...favBtnStyle,
          opacity: isFavorite || isHovered ? 1 : 0,
        }}
        onClick={handleFavClick}
        title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
      >
        {isFavorite ? '⭐' : '☆'}
      </button>
    </div>
  );
}
