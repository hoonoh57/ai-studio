// src/components/MediaLibrary/AssetDetailPopover.tsx
// 에셋 상세 팝오버 — 메타데이터, 태그, 기술정보 표시 (advanced / expert)

import React from 'react';
import type { Asset } from '@/types/project';
import type { AssetMetadata } from '@/types/media';

// ── 상수 ──
const POPOVER_WIDTH = 240;
const POPOVER_RADIUS = 8;
const POPOVER_PADDING = 12;
const PREVIEW_HEIGHT = 120;
const TITLE_FONT_SIZE = 12;
const LABEL_FONT_SIZE = 9;
const VALUE_FONT_SIZE = 10;
const TAG_FONT_SIZE = 9;
const TAG_RADIUS = 3;
const TAG_GAP = 3;
const SECTION_GAP = 8;
const ROW_GAP = 4;

// ── 스타일 ──
const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 999,
  },
  popover: {
    position: 'absolute',
    width: POPOVER_WIDTH,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: POPOVER_RADIUS,
    padding: POPOVER_PADDING,
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: SECTION_GAP,
  },
  preview: {
    width: '100%',
    height: PREVIEW_HEIGHT,
    borderRadius: 6,
    background: 'var(--bg-deep)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 32,
    overflow: 'hidden',
  },
  previewImg: { width: '100%', height: '100%', objectFit: 'cover' as const },
  title: {
    fontSize: TITLE_FONT_SIZE,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  section: { display: 'flex', flexDirection: 'column', gap: ROW_GAP },
  sectionLabel: {
    fontSize: LABEL_FONT_SIZE,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: LABEL_FONT_SIZE, color: 'var(--text-secondary)' },
  value: { fontSize: VALUE_FONT_SIZE, color: 'var(--text-primary)', fontWeight: 500 },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: TAG_GAP },
  tag: {
    fontSize: TAG_FONT_SIZE,
    padding: '1px 6px',
    borderRadius: TAG_RADIUS,
    background: 'rgba(100, 150, 255, 0.12)',
    color: 'var(--accent)',
  },
  tagUser: {
    background: 'rgba(100, 255, 150, 0.12)',
    color: 'var(--success, #4f4)',
  },
  noTags: { fontSize: TAG_FONT_SIZE, color: 'var(--text-secondary)', fontStyle: 'italic' },
};

const TYPE_ICONS: Record<string, string> = { video: '🎬', audio: '🎵', image: '🖼️' };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(sec: number): string {
  if (isNaN(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── 메인 ──
interface AssetDetailPopoverProps {
  readonly asset: Asset;
  readonly meta: AssetMetadata | undefined;
  readonly position: { top: number; left: number };
  readonly onClose: () => void;
}

export function AssetDetailPopover(props: AssetDetailPopoverProps): React.ReactElement {
  const { asset, meta, position } = props;

  return (
    <>
      <div style={S.overlay} onClick={props.onClose} />
      <div style={{ ...S.popover, top: position.top, left: position.left }}>
        {/* 프리뷰 */}
        <div style={S.preview}>
          {asset.thumbnail
            ? <img src={asset.thumbnail} alt={asset.name} style={S.previewImg} />
            : <span>{TYPE_ICONS[asset.type] ?? '📁'}</span>}
        </div>

        <div style={S.title}>{asset.name}</div>

        {/* 기본 정보 */}
        <div style={S.section}>
          <div style={S.sectionLabel}>기본 정보</div>
          <div style={S.row}><span style={S.label}>유형</span><span style={S.value}>{asset.type}</span></div>
          <div style={S.row}><span style={S.label}>길이</span><span style={S.value}>{formatDuration(asset.duration)}</span></div>
          {asset.fileSize !== undefined && (
            <div style={S.row}><span style={S.label}>크기</span><span style={S.value}>{formatBytes(asset.fileSize)}</span></div>
          )}
          {asset.width !== undefined && asset.height !== undefined && (
            <div style={S.row}><span style={S.label}>해상도</span><span style={S.value}>{asset.width}×{asset.height}</span></div>
          )}
        </div>

        {/* 메타데이터 (advanced) */}
        {meta !== undefined && (
          <div style={S.section}>
            <div style={S.sectionLabel}>메타데이터</div>
            <div style={S.row}><span style={S.label}>소스</span><span style={S.value}>{meta.sourceType}</span></div>
            <div style={S.row}><span style={S.label}>사용횟수</span><span style={S.value}>{meta.usageCount}회</span></div>
            <div style={S.row}><span style={S.label}>즐겨찾기</span><span style={S.value}>{meta.favorite ? '⭐ 예' : '아니오'}</span></div>
            {meta.codec !== null && (
              <div style={S.row}><span style={S.label}>코덱</span><span style={S.value}>{meta.codec}</span></div>
            )}
            {meta.bitrate !== null && (
              <div style={S.row}><span style={S.label}>비트레이트</span><span style={S.value}>{formatBytes(meta.bitrate)}/s</span></div>
            )}
          </div>
        )}

        {/* AI 태그 */}
        <div style={S.section}>
          <div style={S.sectionLabel}>AI 태그</div>
          {meta !== undefined && meta.tags.length > 0 ? (
            <div style={S.tagRow}>
              {meta.tags.map(tag => (
                <span
                  key={tag.label}
                  style={{ ...S.tag, ...(tag.source === 'user' ? S.tagUser : {}) }}
                  title={`${tag.source} · 신뢰도 ${Math.round(tag.confidence * 100)}%`}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          ) : (
            <span style={S.noTags}>태그 없음</span>
          )}
        </div>
      </div>
    </>
  );
}
