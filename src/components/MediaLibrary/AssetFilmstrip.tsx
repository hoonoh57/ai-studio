// src/components/MediaLibrary/AssetFilmstrip.tsx
// 필름스트립 뷰 — 가로 스크롤 + 호버 스크러빙 (advanced / expert)

import React, { useRef, useState, useCallback } from 'react';
import type { Asset } from '@/types/project';
import type { AssetMetadata } from '@/types/media';

// ── 상수 ──
const STRIP_HEIGHT = 72;
const STRIP_GAP = 4;
const STRIP_PADDING = 8;
const FRAME_WIDTH = 80;
const FRAME_HEIGHT = 56;
const FRAME_RADIUS = 4;
const NAME_FONT_SIZE = 9;
const META_FONT_SIZE = 8;
const FAV_SIZE = 14;
const SCRUB_INDICATOR_HEIGHT = 2;

const TYPE_ICONS: Record<string, string> = {
  video: '🎬', audio: '🎵', image: '🖼️',
};

// ── 스타일 ──
const S: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    gap: STRIP_GAP,
    padding: STRIP_PADDING,
    overflowX: 'auto',
    overflowY: 'hidden',
    flexShrink: 0,
  },
  card: {
    width: FRAME_WIDTH,
    flexShrink: 0,
    cursor: 'grab',
    borderRadius: FRAME_RADIUS,
    overflow: 'hidden',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    transition: 'border-color 0.12s',
    position: 'relative',
  },
  cardSelected: { borderColor: 'var(--accent)' },
  frame: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    background: 'var(--bg-deep)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  frameImg: { width: '100%', height: '100%', objectFit: 'cover' as const },
  scrubBar: {
    height: SCRUB_INDICATOR_HEIGHT,
    background: 'var(--accent)',
    transition: 'width 0.05s linear',
  },
  info: {
    padding: '2px 4px',
    fontSize: NAME_FONT_SIZE,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  meta: { fontSize: META_FONT_SIZE, color: 'var(--text-secondary)' },
  fav: {
    position: 'absolute',
    top: 2,
    right: 2,
    fontSize: FAV_SIZE,
    background: 'rgba(0,0,0,0.5)',
    borderRadius: 3,
    border: 'none',
    cursor: 'pointer',
    padding: '0 2px',
    lineHeight: 1,
  },
  empty: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    padding: 20,
    textAlign: 'center',
    width: '100%',
  },
};

function formatDuration(sec: number): string {
  if (isNaN(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── 필름스트립 프레임 ──
interface FrameCardProps {
  readonly asset: Asset;
  readonly meta: AssetMetadata | undefined;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
  readonly onDragStart: (id: string, e: React.DragEvent) => void;
  readonly onToggleFav: (id: string) => void;
}

function FrameCard(props: FrameCardProps): React.ReactElement {
  const { asset, meta, selected } = props;
  const [scrubPercent, setScrubPercent] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (frameRef.current === null) return;
    const rect = frameRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setScrubPercent(pct * 100);
  }, []);

  return (
    <div
      style={{ ...S.card, ...(selected ? S.cardSelected : {}) }}
      draggable
      onDragStart={e => props.onDragStart(asset.id, e)}
      onClick={() => props.onSelect(asset.id)}
    >
      <div
        ref={frameRef}
        style={S.frame}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setScrubPercent(0)}
      >
        {asset.thumbnail
          ? <img src={asset.thumbnail} alt={asset.name} style={S.frameImg} />
          : <span>{TYPE_ICONS[asset.type] ?? '📁'}</span>}
        <button
          style={S.fav}
          onClick={e => { e.stopPropagation(); props.onToggleFav(asset.id); }}
        >
          {meta?.favorite ? '⭐' : '☆'}
        </button>
      </div>
      <div style={{ ...S.scrubBar, width: `${scrubPercent}%` }} />
      <div style={S.info}>
        <div>{asset.name}</div>
        <div style={S.meta}>{formatDuration(asset.duration)}</div>
      </div>
    </div>
  );
}

// ── 메인 ──
interface AssetFilmstripProps {
  readonly assets: readonly Asset[];
  readonly metaMap: Map<string, AssetMetadata>;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onDragStart: (id: string, e: React.DragEvent) => void;
  readonly onToggleFav: (id: string) => void;
}

export function AssetFilmstrip(props: AssetFilmstripProps): React.ReactElement {
  if (props.assets.length === 0) {
    return <div style={S.empty}>항목이 없습니다</div>;
  }

  return (
    <div style={S.root}>
      {props.assets.map(asset => (
        <FrameCard
          key={asset.id}
          asset={asset}
          meta={props.metaMap.get(asset.id)}
          selected={props.selectedId === asset.id}
          onSelect={props.onSelect}
          onDragStart={props.onDragStart}
          onToggleFav={props.onToggleFav}
        />
      ))}
    </div>
  );
}
