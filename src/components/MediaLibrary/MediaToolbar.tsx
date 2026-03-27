// src/components/MediaLibrary/MediaToolbar.tsx

import React, { useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { MediaViewMode, MediaSortField, MediaCategory } from '@/types/media';
import { MEDIA_SKILL_CONFIGS } from '@/types/media';

// ── 상수 ──
const TOOLBAR_HEIGHT = 32;
const TOOLBAR_PADDING_H = 8;
const BTN_SIZE = 24;
const BTN_FONT_SIZE = 12;
const BTN_RADIUS = 4;
const SELECT_FONT_SIZE = 10;
const SELECT_HEIGHT = 22;
const SELECT_RADIUS = 4;
const SEARCH_FONT_SIZE = 11;
const SEARCH_HEIGHT = 24;
const SEARCH_RADIUS = 6;
const SEARCH_PADDING_H = 8;
const GAP = 4;

const VIEW_MODE_ICONS: Record<MediaViewMode, string> = {
  grid: '▦',
  list: '☰',
  filmstrip: '🎞',
};

const SORT_LABELS: Record<MediaSortField, string> = {
  name: '이름',
  date: '날짜',
  duration: '길이',
  size: '크기',
  type: '타입',
  usageCount: '사용빈도',
  favorite: '즐겨찾기',
};

const TYPE_FILTER_LABELS: Record<MediaCategory | 'all', string> = {
  all: '전체',
  video: '🎬',
  audio: '🎵',
  image: '🖼️',
};

// ── 스타일 ──
const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: TOOLBAR_HEIGHT,
  padding: `0 ${TOOLBAR_PADDING_H}px`,
  gap: GAP,
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
};

const btnBase: React.CSSProperties = {
  width: BTN_SIZE,
  height: BTN_SIZE,
  border: 'none',
  borderRadius: BTN_RADIUS,
  cursor: 'pointer',
  fontSize: BTN_FONT_SIZE,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition: 'background 0.1s',
};

const selectBase: React.CSSProperties = {
  height: SELECT_HEIGHT,
  fontSize: SELECT_FONT_SIZE,
  borderRadius: SELECT_RADIUS,
  border: '1px solid var(--border)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  padding: '0 4px',
  cursor: 'pointer',
  outline: 'none',
};

const searchStyle: React.CSSProperties = {
  flex: 1,
  height: SEARCH_HEIGHT,
  fontSize: SEARCH_FONT_SIZE,
  borderRadius: SEARCH_RADIUS,
  border: '1px solid var(--border)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  padding: `0 ${SEARCH_PADDING_H}px`,
  outline: 'none',
  minWidth: 0,
};

// ── 컴포넌트 ──
export function MediaToolbar(): React.ReactElement {
  const skillLevel = useEditorStore(s => s.skillLevel);
  const mediaView = useEditorStore(s => s.mediaView);
  const setMediaViewMode = useEditorStore(s => s.setMediaViewMode);
  const setMediaSortField = useEditorStore(s => s.setMediaSortField);
  const toggleMediaSortDirection = useEditorStore(s => s.toggleMediaSortDirection);
  const setMediaFilterType = useEditorStore(s => s.setMediaFilterType);
  const setMediaSearchQuery = useEditorStore(s => s.setMediaSearchQuery);

  const mediaConfig = MEDIA_SKILL_CONFIGS[skillLevel];

  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setMediaSortField(e.target.value as MediaSortField);
  }, [setMediaSortField]);

  const handleFilterChange = useCallback((type: MediaCategory | 'all') => {
    setMediaFilterType(type);
  }, [setMediaFilterType]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMediaSearchQuery(e.target.value);
  }, [setMediaSearchQuery]);

  return (
    <div style={toolbarStyle}>
      {/* 타입 필터 버튼들 */}
      {(Object.keys(TYPE_FILTER_LABELS) as Array<MediaCategory | 'all'>).map(type => {
        const isActive = mediaView.filterType === type;
        return (
          <button
            key={type}
            style={{
              ...btnBase,
              background: isActive ? 'var(--accent)' : 'transparent',
              color: isActive ? '#fff' : 'var(--text-secondary)',
            }}
            onClick={() => handleFilterChange(type)}
            title={type === 'all' ? '전체' : type}
          >
            {TYPE_FILTER_LABELS[type]}
          </button>
        );
      })}

      {/* 검색 */}
      <input
        style={searchStyle}
        type="text"
        placeholder={mediaConfig.showAISearch ? '🔍 자연어 검색...' : '🔍 검색'}
        value={mediaView.searchQuery}
        onChange={handleSearchChange}
      />

      {/* 정렬 */}
      {mediaConfig.mediaSortFields.length > 0 && (
        <>
          <select
            style={selectBase}
            value={mediaView.sortField}
            onChange={handleSortChange}
          >
            {mediaConfig.mediaSortFields.map(field => (
              <option key={field} value={field}>{SORT_LABELS[field]}</option>
            ))}
          </select>
          <button
            style={{
              ...btnBase,
              background: 'transparent',
              color: 'var(--text-secondary)',
            }}
            onClick={toggleMediaSortDirection}
            title={mediaView.sortDirection === 'asc' ? '오름차순' : '내림차순'}
          >
            {mediaView.sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </>
      )}

      {/* 뷰 모드 전환 */}
      {mediaConfig.mediaViewModes.length > 1 && (
        <>
          {mediaConfig.mediaViewModes.map(mode => (
            <button
              key={mode}
              style={{
                ...btnBase,
                background: mediaView.viewMode === mode ? 'var(--accent)' : 'transparent',
                color: mediaView.viewMode === mode ? '#fff' : 'var(--text-secondary)',
              }}
              onClick={() => setMediaViewMode(mode)}
              title={mode}
            >
              {VIEW_MODE_ICONS[mode]}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
