// src/components/MediaLibrary/MediaHub.tsx
// AI-Native Media Hub — MediaPanel 대체
// 스킬 레벨별 적응형 미디어 관리 패널

import React, { useRef, useCallback, useState, useMemo } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { getFilteredSortedAssets } from '@/lib/core/mediaEngine';
import { autoTagAsset } from '@/lib/core/aiTagEngine';
import { MEDIA_SKILL_CONFIGS } from '@/types/media';
import type { Asset } from '@/types/project';
import type {
  SmartCollection,
  MediaCategory,
  MediaSourceType,
  MediaViewMode,
  MediaSortField,
  AssetMetadata,
} from '@/types/media';

// ═══════════════════════════════════════════
//  상수
// ═══════════════════════════════════════════

const ACCEPTED_TYPES = ['video/', 'audio/', 'image/'];
const HEADER_HEIGHT = 36;
const HEADER_FONT_SIZE = 12;
const HEADER_PADDING_H = 12;
const TOOLBAR_GAP = 4;
const TOOLBAR_FONT_SIZE = 11;
const TOOLBAR_INPUT_HEIGHT = 26;
const TOOLBAR_ICON_SIZE = 24;
const COLLECTION_CHIP_HEIGHT = 22;
const COLLECTION_FONT_SIZE = 10;
const DROP_ZONE_HEIGHT = 64;
const DROP_ZONE_RADIUS = 8;
const DROP_ZONE_FONT_SIZE = 12;
const CARD_GAP = 6;
const CARD_PADDING = 6;
const CARD_RADIUS = 6;
const THUMB_SIZE = 48;
const THUMB_RADIUS = 4;
const NAME_FONT_SIZE = 11;
const META_FONT_SIZE = 9;
const TAG_FONT_SIZE = 9;
const TAG_MAX_VISIBLE = 2;
const FAV_ICON_SIZE = 14;
const LIST_ROW_HEIGHT = 36;
const EMPTY_FONT_SIZE = 12;
const SECTION_PADDING = 8;

const TYPE_ICONS: Record<string, string> = {
  video: '🎬',
  audio: '🎵',
  image: '🖼️',
};

const VIEW_MODE_ICONS: Record<MediaViewMode, string> = {
  grid: '⊞',
  list: '≡',
  filmstrip: '🎞️',
};

const SORT_LABELS: Record<MediaSortField, string> = {
  name: '이름',
  date: '날짜',
  duration: '길이',
  size: '크기',
  type: '유형',
  usageCount: '사용',
  favorite: '즐겨찾기',
};

const TYPE_FILTER_LABELS: Record<MediaCategory | 'all', string> = {
  all: '전체',
  video: '비디오',
  audio: '오디오',
  image: '이미지',
};

// ═══════════════════════════════════════════
//  스타일
// ═══════════════════════════════════════════

const S: Record<string, React.CSSProperties> = {
  root: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-panel)',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    userSelect: 'none',
  },
  header: {
    height: HEADER_HEIGHT,
    padding: `0 ${HEADER_PADDING_H}px`,
    fontSize: HEADER_FONT_SIZE,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  headerCount: { opacity: 0.5, fontWeight: 400 },

  /* ── 툴바 ── */
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: TOOLBAR_GAP,
    padding: `4px ${SECTION_PADDING}px`,
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    minWidth: 60,
    height: TOOLBAR_INPUT_HEIGHT,
    padding: '0 8px',
    fontSize: TOOLBAR_FONT_SIZE,
    background: 'var(--bg-deep)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    outline: 'none',
  },
  toolBtn: {
    height: TOOLBAR_ICON_SIZE,
    minWidth: TOOLBAR_ICON_SIZE,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: TOOLBAR_FONT_SIZE,
    color: 'var(--text-secondary)',
    padding: '0 4px',
  },
  toolBtnActive: {
    background: 'var(--accent)',
    color: '#fff',
    borderColor: 'var(--accent)',
  },
  sortSelect: {
    height: TOOLBAR_INPUT_HEIGHT,
    fontSize: TOOLBAR_FONT_SIZE,
    background: 'var(--bg-deep)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    padding: '0 4px',
    outline: 'none',
  },

  /* ── 컬렉션 바 ── */
  collectionBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: `4px ${SECTION_PADDING}px`,
    overflowX: 'auto',
    flexShrink: 0,
    borderBottom: '1px solid var(--border)',
  },
  collectionChip: {
    height: COLLECTION_CHIP_HEIGHT,
    padding: '0 8px',
    fontSize: COLLECTION_FONT_SIZE,
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  collectionChipActive: {
    background: 'var(--accent)',
    color: '#fff',
    borderColor: 'var(--accent)',
  },

  /* ── 드롭존 ── */
  dropZone: {
    margin: SECTION_PADDING,
    height: DROP_ZONE_HEIGHT,
    border: '2px dashed var(--border)',
    borderRadius: DROP_ZONE_RADIUS,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: DROP_ZONE_FONT_SIZE,
    color: 'var(--text-secondary)',
    transition: 'border-color 0.2s, background 0.2s',
    flexShrink: 0,
  },
  dropZoneActive: {
    borderColor: 'var(--accent)',
    background: 'rgba(100, 150, 255, 0.08)',
  },

  /* ── 에셋 리스트 영역 ── */
  assetArea: {
    flex: 1,
    overflowY: 'auto',
    padding: SECTION_PADDING,
  },

  /* ── 그리드 카드 ── */
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: CARD_GAP,
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: CARD_GAP,
    padding: CARD_PADDING,
    borderRadius: CARD_RADIUS,
    background: 'var(--bg-surface)',
    cursor: 'grab',
    transition: 'background 0.15s',
    position: 'relative',
  },
  cardSelected: {
    outline: '2px solid var(--accent)',
    outlineOffset: -1,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_RADIUS,
    background: 'var(--bg-deep)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  info: { flex: 1, minWidth: 0 },
  name: {
    fontSize: NAME_FONT_SIZE,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  meta: {
    fontSize: META_FONT_SIZE,
    color: 'var(--text-secondary)',
    marginTop: 1,
  },
  tagRow: {
    display: 'flex',
    gap: 3,
    marginTop: 2,
    overflow: 'hidden',
  },
  tag: {
    fontSize: TAG_FONT_SIZE,
    padding: '1px 4px',
    borderRadius: 3,
    background: 'rgba(100, 150, 255, 0.12)',
    color: 'var(--accent)',
    whiteSpace: 'nowrap',
  },
  favBtn: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    flexShrink: 0,
    borderRadius: 4,
    transition: 'opacity 0.15s, background 0.15s',
    opacity: 0.7,
  },

  /* ── 리스트 뷰 ── */
  listRow: {
    display: 'flex',
    alignItems: 'center',
    gap: CARD_GAP,
    height: LIST_ROW_HEIGHT,
    padding: `0 ${CARD_PADDING}px`,
    borderRadius: 4,
    cursor: 'grab',
    fontSize: NAME_FONT_SIZE,
    transition: 'background 0.12s',
  },
  listIcon: { fontSize: 14, flexShrink: 0, width: 20, textAlign: 'center' },
  listName: {
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  listMeta: { fontSize: META_FONT_SIZE, color: 'var(--text-secondary)', flexShrink: 0 },
  listFav: {
    fontSize: 12,
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    flexShrink: 0,
    opacity: 0.6,
  },

  /* ── 빈 상태 ── */
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    fontSize: EMPTY_FONT_SIZE,
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },

  /* ── 프리셋 팩 섹션 ── */
  presetSection: {
    padding: SECTION_PADDING,
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  presetTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetGrid: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  },
  presetCard: {
    width: 70,
    padding: '6px 4px',
    borderRadius: 6,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    textAlign: 'center',
    fontSize: 9,
    color: 'var(--text-secondary)',
    transition: 'border-color 0.15s',
  },
  presetCardActive: {
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },
  presetEmoji: { fontSize: 18, display: 'block', marginBottom: 2 },
};

// ═══════════════════════════════════════════
//  헬퍼 함수
// ═══════════════════════════════════════════

function formatDuration(sec: number): string {
  if (isNaN(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedFile(file: File): boolean {
  return ACCEPTED_TYPES.some(t => file.type.startsWith(t));
}

function getAssetType(file: File): 'video' | 'audio' | 'image' {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'image';
}

function loadMediaMetadata(
  file: File,
  url: string,
): Promise<{ duration: number; width?: number; height?: number }> {
  return new Promise(resolve => {
    const type = getAssetType(file);
    if (type === 'video') {
      const el = document.createElement('video');
      el.preload = 'metadata';
      el.onloadedmetadata = () =>
        resolve({ duration: el.duration, width: el.videoWidth, height: el.videoHeight });
      el.onerror = () => resolve({ duration: 5 });
      el.src = url;
      return;
    }
    if (type === 'audio') {
      const el = document.createElement('audio');
      el.preload = 'metadata';
      el.onloadedmetadata = () => resolve({ duration: el.duration });
      el.onerror = () => resolve({ duration: 5 });
      el.src = url;
      return;
    }
    resolve({ duration: 5 });
  });
}

const PRESET_EMOJIS: Record<string, string> = {
  vlog: '✈️', review: '📦', tutorial: '📚',
  cinematic: '🎥', shorts: '📱', podcast: '🎙️', custom: '⚙️',
};

// ═══════════════════════════════════════════
//  서브 컴포넌트: ToolbarRow
// ═══════════════════════════════════════════

interface ToolbarRowProps {
  readonly searchQuery: string;
  readonly onSearch: (q: string) => void;
  readonly filterType: MediaCategory | 'all';
  readonly onFilterType: (t: MediaCategory | 'all') => void;
  readonly sortField: MediaSortField;
  readonly onSortField: (f: MediaSortField) => void;
  readonly sortDirection: 'asc' | 'desc';
  readonly onToggleDirection: () => void;
  readonly viewMode: MediaViewMode;
  readonly onViewMode: (m: MediaViewMode) => void;
  readonly allowedModes: readonly MediaViewMode[];
  readonly allowedSorts: readonly MediaSortField[];
  readonly showSourceTabs: boolean;
  readonly filterSource: MediaSourceType | 'all';
  readonly onFilterSource: (s: MediaSourceType | 'all') => void;
}

function ToolbarRow(props: ToolbarRowProps): React.ReactElement {
  return (
    <div style={S.toolbar}>
      <input
        style={S.searchInput}
        placeholder="검색…"
        value={props.searchQuery}
        onChange={e => props.onSearch(e.target.value)}
      />
      {/* 타입 필터 버튼 */}
      {(['all', 'video', 'audio', 'image'] as const).map(t => (
        <button
          key={t}
          style={{
            ...S.toolBtn,
            ...(props.filterType === t ? S.toolBtnActive : {}),
          }}
          onClick={() => props.onFilterType(t)}
          title={TYPE_FILTER_LABELS[t]}
        >
          {t === 'all' ? '⊕' : TYPE_ICONS[t]}
        </button>
      ))}
      {/* 소스 필터 (고급 이상) */}
      {props.showSourceTabs && (
        <select
          style={S.sortSelect}
          value={props.filterSource}
          onChange={e => props.onFilterSource(e.target.value as MediaSourceType | 'all')}
        >
          <option value="all">전체 소스</option>
          <option value="local">로컬</option>
          <option value="ai-generated">AI생성</option>
          <option value="stock">스톡</option>
          <option value="recorded">녹화</option>
        </select>
      )}
      {/* 정렬 */}
      <select
        style={S.sortSelect}
        value={props.sortField}
        onChange={e => props.onSortField(e.target.value as MediaSortField)}
      >
        {props.allowedSorts.map(f => (
          <option key={f} value={f}>{SORT_LABELS[f]}</option>
        ))}
      </select>
      <button
        style={S.toolBtn}
        onClick={props.onToggleDirection}
        title={props.sortDirection === 'asc' ? '오름차순' : '내림차순'}
      >
        {props.sortDirection === 'asc' ? '↑' : '↓'}
      </button>
      {/* 뷰 모드 */}
      {props.allowedModes.map(m => (
        <button
          key={m}
          style={{
            ...S.toolBtn,
            ...(props.viewMode === m ? S.toolBtnActive : {}),
          }}
          onClick={() => props.onViewMode(m)}
          title={m}
        >
          {VIEW_MODE_ICONS[m]}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════
//  서브 컴포넌트: CollectionBar
// ═══════════════════════════════════════════

interface CollectionBarProps {
  readonly collections: readonly SmartCollection[];
  readonly activeId: string | null;
  readonly onSelect: (id: string) => void;
}

function CollectionBar(props: CollectionBarProps): React.ReactElement {
  return (
    <div style={S.collectionBar}>
      {props.collections.map(c => (
        <button
          key={c.id}
          style={{
            ...S.collectionChip,
            ...(props.activeId === c.id ? S.collectionChipActive : {}),
          }}
          onClick={() => props.onSelect(c.id)}
        >
          {c.icon} {c.name}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════
//  서브 컴포넌트: AssetCardItem (그리드 뷰)
// ═══════════════════════════════════════════

interface AssetCardItemProps {
  readonly asset: Asset;
  readonly meta: AssetMetadata | undefined;
  readonly selected: boolean;
  readonly showTags: boolean;
  readonly onDragStart: (id: string, e: React.DragEvent) => void;
  readonly onSelect: (id: string) => void;
  readonly onToggleFav: (id: string) => void;
}

function AssetCardItem(props: AssetCardItemProps): React.ReactElement {
  const { asset, meta, selected, showTags } = props;
  return (
    <div
      style={{ ...S.card, ...(selected ? S.cardSelected : {}), position: 'relative' }}
      draggable
      onDragStart={e => props.onDragStart(asset.id, e)}
      onClick={() => props.onSelect(asset.id)}
    >
      <div style={S.thumb}>
        {asset.thumbnail
          ? <img src={asset.thumbnail} alt={asset.name} style={S.thumbImg} />
          : (TYPE_ICONS[asset.type] ?? '📁')}
      </div>
      <div style={S.info}>
        <div style={S.name}>{asset.name}</div>
        <div style={S.meta}>
          {formatDuration(asset.duration)}
          {asset.fileSize !== undefined && ` · ${formatFileSize(asset.fileSize)}`}
          {asset.width !== undefined && asset.height !== undefined &&
            ` · ${asset.width}×${asset.height}`}
        </div>
        {showTags && meta !== undefined && meta.tags.length > 0 && (
          <div style={S.tagRow}>
            {meta.tags.slice(0, TAG_MAX_VISIBLE).map(t => (
              <span key={t.label} style={S.tag}>{t.label}</span>
            ))}
            {meta.tags.length > TAG_MAX_VISIBLE && (
              <span style={S.tag}>+{meta.tags.length - TAG_MAX_VISIBLE}</span>
            )}
          </div>
        )}
      </div>
      {/* 즐겨찾기 버튼 — flex 행의 마지막 요소로 배치 */}
      <button
        style={S.favBtn}
        onClick={e => { e.stopPropagation(); props.onToggleFav(asset.id); }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.background = 'transparent'; }}
        title="즐겨찾기"
      >
        {meta?.favorite ? '⭐' : '☆'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════
//  서브 컴포넌트: AssetListItem (리스트 뷰)
// ═══════════════════════════════════════════

interface AssetListItemProps {
  readonly asset: Asset;
  readonly meta: AssetMetadata | undefined;
  readonly onDragStart: (id: string, e: React.DragEvent) => void;
  readonly onToggleFav: (id: string) => void;
}

function AssetListItem(props: AssetListItemProps): React.ReactElement {
  const { asset, meta } = props;
  return (
    <div
      style={S.listRow}
      draggable
      onDragStart={e => props.onDragStart(asset.id, e)}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={S.listIcon as React.CSSProperties}>
        {TYPE_ICONS[asset.type] ?? '📁'}
      </span>
      <span style={S.listName}>{asset.name}</span>
      <span style={S.listMeta}>{formatDuration(asset.duration)}</span>
      <button
        style={S.listFav}
        onClick={e => { e.stopPropagation(); props.onToggleFav(asset.id); }}
      >
        {meta?.favorite ? '★' : '☆'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════
//  메인 컴포넌트: MediaHub
// ═══════════════════════════════════════════

export function MediaHub(): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // ── 스토어 셀렉터 ──
  const assets = useEditorStore(s => s.project.assets);
  const assetMeta = useEditorStore(s => s.assetMeta);
  const collections = useEditorStore(s => s.collections);
  const presetPacks = useEditorStore(s => s.presetPacks);
  const mediaView = useEditorStore(s => s.mediaView);
  const skillLevel = useEditorStore(s => s.skillLevel);

  const addAsset = useEditorStore(s => s.addAsset);
  const setAssetTags = useEditorStore(s => s.setAssetTags);
  const toggleFavorite = useEditorStore(s => s.toggleFavorite);
  const setMediaSearchQuery = useEditorStore(s => s.setMediaSearchQuery);
  const setMediaFilterType = useEditorStore(s => s.setMediaFilterType);
  const setMediaFilterSource = useEditorStore(s => s.setMediaFilterSource);
  const setMediaSortField = useEditorStore(s => s.setMediaSortField);
  const toggleMediaSortDirection = useEditorStore(s => s.toggleMediaSortDirection);
  const setMediaViewMode = useEditorStore(s => s.setMediaViewMode);
  const setActiveCollection = useEditorStore(s => s.setActiveCollection);
  const setActivePresetPack = useEditorStore(s => s.setActivePresetPack);

  // ── 스킬 설정 ──
  const skillCfg = MEDIA_SKILL_CONFIGS[skillLevel];

  // ── 활성 컬렉션 객체 ──
  const activeCollection: SmartCollection | null = useMemo(() => {
    if (mediaView.activeCollection === null) return null;
    return collections.find(c => c.id === mediaView.activeCollection) ?? null;
  }, [collections, mediaView.activeCollection]);

  // ── 필터·정렬 파이프라인 ──
  const displayAssets: readonly Asset[] = useMemo(() => {
    return getFilteredSortedAssets(
      assets,
      assetMeta,
      activeCollection,
      mediaView.filterType,
      mediaView.filterSource,
      mediaView.searchQuery,
      mediaView.sortField,
      mediaView.sortDirection,
    );
  }, [assets, assetMeta, activeCollection, mediaView]);

  // ── 파일 처리 + AI 자동 태깅 ──
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const accepted = Array.from(files).filter(isAcceptedFile);
    for (const file of accepted) {
      const url = URL.createObjectURL(file);
      const type = getAssetType(file);
      const meta = await loadMediaMetadata(file, url);
      const newAsset = addAsset({
        name: file.name,
        type,
        src: url,
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        fileSize: file.size,
      });
      // 백그라운드 AI 태깅 (비동기, non-blocking)
      autoTagAsset({
        name: newAsset.name,
        type: newAsset.type,
        src: newAsset.src,
        width: newAsset.width,
        height: newAsset.height,
      }).then(tags => {
        if (tags.length > 0) {
          setAssetTags(newAsset.id, tags);
        }
      });
    }
  }, [addAsset, setAssetTags]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files !== null && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  }, [processFiles]);

  // ── 드래그 & 드롭 ──
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleDragStart = useCallback((assetId: string, e: React.DragEvent) => {
    e.dataTransfer.setData('assetId', assetId);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // ═══════════════════════════════════════════
  //  렌더링
  // ═══════════════════════════════════════════

  return (
    <div style={S.root}>
      {/* ── 헤더 ── */}
      <div style={S.header}>
        <span>Media Hub</span>
        <span style={S.headerCount}>{displayAssets.length} / {assets.length}</span>
      </div>

      {/* ── 프리셋 팩 (스킬 레벨에 따라 표시) ── */}
      {skillCfg.showPresetPacks && presetPacks.length > 0 && (
        <div style={S.presetSection}>
          <div style={S.presetTitle}>AI 프리셋 팩</div>
          <div style={S.presetGrid}>
            {presetPacks.map(pack => (
              <div
                key={pack.id}
                style={{
                  ...S.presetCard,
                  ...(mediaView.activePresetPack === pack.id
                    ? S.presetCardActive
                    : {}),
                }}
                onClick={() =>
                  setActivePresetPack(
                    mediaView.activePresetPack === pack.id ? null : pack.id,
                  )
                }
              >
                <span style={S.presetEmoji}>
                  {PRESET_EMOJIS[pack.category] ?? '📦'}
                </span>
                {pack.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 툴바 ── */}
      <ToolbarRow
        searchQuery={mediaView.searchQuery}
        onSearch={setMediaSearchQuery}
        filterType={mediaView.filterType}
        onFilterType={setMediaFilterType}
        sortField={mediaView.sortField}
        onSortField={setMediaSortField}
        sortDirection={mediaView.sortDirection}
        onToggleDirection={toggleMediaSortDirection}
        viewMode={mediaView.viewMode}
        onViewMode={setMediaViewMode}
        allowedModes={skillCfg.mediaViewModes}
        allowedSorts={skillCfg.mediaSortFields}
        showSourceTabs={skillCfg.showSourceTabs}
        filterSource={mediaView.filterSource}
        onFilterSource={setMediaFilterSource}
      />

      {/* ── 컬렉션 바 (스마트 컬렉션 활성 시) ── */}
      {skillCfg.showSmartCollections && (
        <CollectionBar
          collections={collections}
          activeId={mediaView.activeCollection}
          onSelect={setActiveCollection}
        />
      )}

      {/* ── 드롭존 ── */}
      <div
        style={{
          ...S.dropZone,
          ...(isDragOver ? S.dropZoneActive : {}),
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        📂 파일을 드래그하거나 클릭하여 업로드
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />

      {/* ── 에셋 목록 ── */}
      <div style={S.assetArea}>
        {displayAssets.length === 0 ? (
          <div style={S.empty}>
            {assets.length === 0
              ? '미디어를 추가하세요'
              : '조건에 맞는 항목이 없습니다'}
          </div>
        ) : mediaView.viewMode === 'list' ? (
          /* 리스트 뷰 */
          displayAssets.map(asset => (
            <AssetListItem
              key={asset.id}
              asset={asset}
              meta={assetMeta.get(asset.id)}
              onDragStart={handleDragStart}
              onToggleFav={toggleFavorite}
            />
          ))
        ) : (
          /* 그리드 뷰 (grid + filmstrip 공용) */
          <div style={S.grid}>
            {displayAssets.map(asset => (
              <AssetCardItem
                key={asset.id}
                asset={asset}
                meta={assetMeta.get(asset.id)}
                selected={selectedAssetId === asset.id}
                showTags={skillCfg.showAITags}
                onDragStart={handleDragStart}
                onSelect={setSelectedAssetId}
                onToggleFav={toggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
