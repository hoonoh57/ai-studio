// src/components/MediaLibrary/AISearchBar.tsx
// AI 자연어 검색 바 — 시맨틱 태그 검색 + 자동완성 (advanced / expert)

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';

// ── 상수 ──
const BAR_HEIGHT = 32;
const BAR_RADIUS = 6;
const BAR_FONT_SIZE = 12;
const BAR_PADDING_H = 10;
const SUGGEST_MAX = 8;
const SUGGEST_ITEM_HEIGHT = 28;
const SUGGEST_FONT_SIZE = 11;
const SUGGEST_RADIUS = 6;
const BADGE_FONT_SIZE = 8;
const BADGE_RADIUS = 8;

// ── 스타일 ──
const S: Record<string, React.CSSProperties> = {
  root: { position: 'relative', padding: '4px 8px' },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: BAR_HEIGHT,
    padding: `0 ${BAR_PADDING_H}px`,
    background: 'var(--bg-deep)',
    border: '1px solid var(--border)',
    borderRadius: BAR_RADIUS,
    transition: 'border-color 0.15s',
  },
  barFocused: { borderColor: 'var(--accent)' },
  icon: { fontSize: 14, flexShrink: 0, color: 'var(--text-secondary)' },
  input: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: BAR_FONT_SIZE,
    color: 'var(--text-primary)',
    outline: 'none',
  },
  clearBtn: {
    fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)',
    background: 'transparent', border: 'none', padding: 0, flexShrink: 0,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 8,
    right: 8,
    marginTop: 2,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: SUGGEST_RADIUS,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    zIndex: 100,
    maxHeight: SUGGEST_ITEM_HEIGHT * SUGGEST_MAX,
    overflowY: 'auto',
  },
  suggestItem: {
    height: SUGGEST_ITEM_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 10px',
    fontSize: SUGGEST_FONT_SIZE,
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  suggestLabel: { flex: 1 },
  suggestBadge: {
    fontSize: BADGE_FONT_SIZE,
    padding: '1px 5px',
    borderRadius: BADGE_RADIUS,
    background: 'rgba(100, 150, 255, 0.15)',
    color: 'var(--accent)',
  },
  hint: {
    padding: '6px 10px',
    fontSize: 10,
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
  },
};

interface TagSuggestion {
  readonly label: string;
  readonly count: number;
  readonly source: 'auto' | 'user';
}

// ── 메인 ──
export function AISearchBar(): React.ReactElement {
  const [focused, setFocused] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const assetMeta = useEditorStore(s => s.assetMeta);
  const setMediaSearchQuery = useEditorStore(s => s.setMediaSearchQuery);
  const searchQuery = useEditorStore(s => s.mediaView.searchQuery);

  // 초기값 동기화
  useEffect(() => { setLocalQuery(searchQuery); }, [searchQuery]);

  // 모든 태그에서 자동완성 후보 추출
  const allSuggestions: readonly TagSuggestion[] = useMemo(() => {
    const tagMap = new Map<string, { count: number; source: 'auto' | 'user' }>();
    assetMeta.forEach(meta => {
      for (const tag of meta.tags) {
        const key = tag.label.toLowerCase();
        const existing = tagMap.get(key);
        if (existing !== undefined) {
          existing.count++;
        } else {
          tagMap.set(key, { count: 1, source: tag.source });
        }
      }
    });
    return Array.from(tagMap.entries())
      .map(([label, data]) => ({ label, count: data.count, source: data.source }))
      .sort((a, b) => b.count - a.count);
  }, [assetMeta]);

  // 필터링된 제안
  const filtered = useMemo(() => {
    if (localQuery.trim().length === 0) return allSuggestions.slice(0, SUGGEST_MAX);
    const q = localQuery.trim().toLowerCase();
    return allSuggestions
      .filter(s => s.label.includes(q))
      .slice(0, SUGGEST_MAX);
  }, [allSuggestions, localQuery]);

  const handleChange = useCallback((value: string) => {
    setLocalQuery(value);
  }, []);

  const handleSubmit = useCallback(() => {
    setMediaSearchQuery(localQuery.trim());
  }, [localQuery, setMediaSearchQuery]);

  const handleSuggestClick = useCallback((label: string) => {
    setLocalQuery(label);
    setMediaSearchQuery(label);
    setFocused(false);
  }, [setMediaSearchQuery]);

  const handleClear = useCallback(() => {
    setLocalQuery('');
    setMediaSearchQuery('');
    inputRef.current?.focus();
  }, [setMediaSearchQuery]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') { setFocused(false); inputRef.current?.blur(); }
  }, [handleSubmit]);

  const showDropdown = focused && (filtered.length > 0 || localQuery.trim().length > 0);

  return (
    <div style={S.root}>
      <div style={{ ...S.bar, ...(focused ? S.barFocused : {}) }}>
        <span style={S.icon}>🔍</span>
        <input
          ref={inputRef}
          style={S.input}
          placeholder="자연어로 미디어 검색… (예: 밝은 야외 영상)"
          value={localQuery}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={handleKeyDown}
        />
        {localQuery.length > 0 && (
          <button style={S.clearBtn} onClick={handleClear}>✕</button>
        )}
      </div>

      {showDropdown && (
        <div style={S.dropdown}>
          {filtered.length > 0 ? (
            filtered.map(s => (
              <div
                key={s.label}
                style={S.suggestItem}
                onMouseDown={() => handleSuggestClick(s.label)}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={S.suggestLabel}>{s.label}</span>
                <span style={S.suggestBadge}>{s.count}개</span>
              </div>
            ))
          ) : (
            <div style={S.hint}>일치하는 태그가 없습니다</div>
          )}
        </div>
      )}
    </div>
  );
}
