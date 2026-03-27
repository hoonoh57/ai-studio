// src/components/MediaLibrary/AssetList.tsx

import React, { useCallback, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { Asset } from '@/types/project';
import type { AssetMetadata } from '@/types/media';

// ── 상수 ──
const ROW_HEIGHT = 32;
const ROW_PADDING_H = 8;
const ROW_RADIUS = 4;
const ICON_SIZE = 14;
const NAME_FONT_SIZE = 11;
const META_FONT_SIZE = 9;
const FAV_SIZE = 12;
const LIST_PADDING = 8;
const LIST_GAP = 2;
const HEADER_FONT_SIZE = 9;
const HEADER_HEIGHT = 24;
const EMPTY_FONT_SIZE = 12;
const EMPTY_PADDING = 32;

const ICON_BY_TYPE: Record<string, string> = {
  video: '🎬',
  audio: '🎵',
  image: '🖼️',
};

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
const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: LIST_PADDING,
  display: 'flex',
  flexDirection: 'column',
  gap: LIST_GAP,
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: HEADER_HEIGHT,
  padding: `0 ${ROW_PADDING_H}px`,
  fontSize: HEADER_FONT_SIZE,
  color: 'var(--text-muted)',
  fontWeight: 600,
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
};

const emptyStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-muted)',
  fontSize: EMPTY_FONT_SIZE,
  padding: EMPTY_PADDING,
  textAlign: 'center',
  lineHeight: 1.6,
};

// ── Props ──
interface AssetListProps {
  readonly assets: readonly Asset[];
  readonly metaMap: Map<string, AssetMetadata>;
  readonly selectedAssetId: string | null;
  readonly onSelect: (assetId: string) => void;
}

// ── 행 컴포넌트 ──
interface AssetRowProps {
  readonly asset: Asset;
  readonly meta: AssetMetadata | undefined;
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
}

function AssetRow({
  asset, meta, isSelected, onSelect,
}: AssetRowProps): React.ReactElement {
  const toggleFavorite = useEditorStore(s => s.toggleFavorite);
  const [isHovered, setIsHovered] = useState(false);

  const isFav = meta?.favorite === true;

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('assetId', asset.id);
    e.dataTransfer.effectAllowed = 'copy';
  }, [asset.id]);

  const handleFav = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(asset.id);
  }, [asset.id, toggleFavorite]);

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    height: ROW_HEIGHT,
    padding: `0 ${ROW_PADDING_H}px`,
    borderRadius: ROW_RADIUS,
    cursor: 'grab',
    transition: 'background 0.1s',
    background: isSelected
      ? 'rgba(100, 150, 255, 0.15)'
      : isHovered
        ? 'var(--bg-hover)'
        : 'transparent',
    gap: 8,
    flexShrink: 0,
  };

  return (
    <div
      style={rowStyle}
      draggable
      onDragStart={handleDragStart}
      onClick={() => onSelect(asset.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span style={{ fontSize: ICON_SIZE, flexShrink: 0 }}>
        {ICON_BY_TYPE[asset.type] ?? '📁'}
      </span>
      <span style={{
        flex: 1, fontSize: NAME_FONT_SIZE, minWidth: 0,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        color: 'var(--text-primary)',
      }}>
        {asset.name}
      </span>
      <span style={{
        fontSize: META_FONT_SIZE, color: 'var(--text-secondary)',
        flexShrink: 0, minWidth: 36, textAlign: 'right',
      }}>
        {formatDuration(asset.duration)}
      </span>
      <span style={{
        fontSize: META_FONT_SIZE, color: 'var(--text-secondary)',
        flexShrink: 0, minWidth: 48, textAlign: 'right',
      }}>
        {asset.fileSize !== undefined ? formatFileSize(asset.fileSize) : ''}
      </span>
      <button
        style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          fontSize: FAV_SIZE, padding: 0, flexShrink: 0,
          transition: 'opacity 0.2s',
          opacity: isFav || isHovered ? 1 : 0.3,
        }}
        onClick={handleFav}
        title={isFav ? '즐겨찾기 해제' : '즐겨찾기'}
      >
        {isFav ? '⭐' : '☆'}
      </button>
    </div>
  );
}

// ── 메인 컴포넌트 ──
export function AssetList({
  assets, metaMap, selectedAssetId, onSelect,
}: AssetListProps): React.ReactElement {
  if (assets.length === 0) {
    return (
      <div style={emptyStyle}>
        미디어가 없습니다.<br />
        파일을 추가하거나 AI 프리셋을 선택하세요.
      </div>
    );
  }

  return (
    <div style={listStyle}>
      <div style={headerRowStyle}>
        <span style={{ flex: 0, width: ICON_SIZE + 8 }} />
        <span style={{ flex: 1 }}>이름</span>
        <span style={{ minWidth: 36, textAlign: 'right' }}>길이</span>
        <span style={{ minWidth: 48, textAlign: 'right' }}>크기</span>
        <span style={{ minWidth: FAV_SIZE + 4 }} />
      </div>
      {assets.map(asset => (
        <AssetRow
          key={asset.id}
          asset={asset}
          meta={metaMap.get(asset.id)}
          isSelected={selectedAssetId === asset.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
