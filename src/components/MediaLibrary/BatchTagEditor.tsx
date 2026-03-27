// src/components/MediaLibrary/BatchTagEditor.tsx
// 다중 에셋 태그 일괄 편집 (expert)

import React, { useState, useCallback, useMemo } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { AITag } from '@/types/media';

// ── 상수 ──
const EDITOR_PADDING = 8;
const EDITOR_RADIUS = 6;
const INPUT_HEIGHT = 28;
const INPUT_FONT_SIZE = 11;
const TAG_FONT_SIZE = 9;
const TAG_RADIUS = 3;
const TAG_GAP = 3;
const BTN_HEIGHT = 26;
const BTN_FONT_SIZE = 10;
const HEADER_FONT_SIZE = 10;
const COUNT_FONT_SIZE = 9;

// ── 스타일 ──
const S: Record<string, React.CSSProperties> = {
  root: {
    padding: EDITOR_PADDING,
    background: 'var(--bg-surface)',
    borderRadius: EDITOR_RADIUS,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    border: '1px solid var(--border)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: HEADER_FONT_SIZE,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  count: {
    fontSize: COUNT_FONT_SIZE,
    color: 'var(--text-secondary)',
  },
  inputRow: {
    display: 'flex',
    gap: 4,
  },
  input: {
    flex: 1,
    height: INPUT_HEIGHT,
    padding: '0 8px',
    fontSize: INPUT_FONT_SIZE,
    background: 'var(--bg-deep)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    outline: 'none',
  },
  addBtn: {
    height: BTN_HEIGHT,
    padding: '0 10px',
    fontSize: BTN_FONT_SIZE,
    fontWeight: 600,
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    flexShrink: 0,
  },
  removeBtn: {
    height: BTN_HEIGHT,
    padding: '0 10px',
    fontSize: BTN_FONT_SIZE,
    background: 'var(--bg-deep)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    cursor: 'pointer',
    flexShrink: 0,
  },
  tagSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  tagLabel: {
    fontSize: TAG_FONT_SIZE,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
  },
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: TAG_GAP,
  },
  tag: {
    fontSize: TAG_FONT_SIZE,
    padding: '2px 6px',
    borderRadius: TAG_RADIUS,
    background: 'rgba(100, 150, 255, 0.12)',
    color: 'var(--accent)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  },
  tagRemove: {
    fontSize: 8,
    opacity: 0.6,
    cursor: 'pointer',
  },
  noSelection: {
    fontSize: INPUT_FONT_SIZE,
    color: 'var(--text-secondary)',
    textAlign: 'center',
    padding: 12,
    fontStyle: 'italic',
  },
};

// ── 메인 ──
interface BatchTagEditorProps {
  readonly selectedAssetIds: readonly string[];
}

export function BatchTagEditor(props: BatchTagEditorProps): React.ReactElement {
  const { selectedAssetIds } = props;
  const [newTag, setNewTag] = useState('');

  const assetMeta = useEditorStore(s => s.assetMeta);
  const batchAddTag = useEditorStore(s => s.batchAddTag);
  const batchRemoveTag = useEditorStore(s => s.batchRemoveTag);

  // 선택된 에셋들의 공통 태그
  const commonTags: readonly AITag[] = useMemo(() => {
    if (selectedAssetIds.length === 0) return [];

    const tagCounts = new Map<string, { tag: AITag; count: number }>();
    for (const id of selectedAssetIds) {
      const meta = assetMeta.get(id);
      if (meta === undefined) continue;
      for (const tag of meta.tags) {
        const key = tag.label.toLowerCase();
        const existing = tagCounts.get(key);
        if (existing !== undefined) {
          existing.count++;
        } else {
          tagCounts.set(key, { tag, count: 1 });
        }
      }
    }

    return Array.from(tagCounts.values())
      .filter(item => item.count === selectedAssetIds.length)
      .map(item => item.tag);
  }, [selectedAssetIds, assetMeta]);

  // 일부 에셋에만 있는 태그
  const partialTags: readonly AITag[] = useMemo(() => {
    if (selectedAssetIds.length <= 1) return [];

    const tagCounts = new Map<string, { tag: AITag; count: number }>();
    for (const id of selectedAssetIds) {
      const meta = assetMeta.get(id);
      if (meta === undefined) continue;
      for (const tag of meta.tags) {
        const key = tag.label.toLowerCase();
        const existing = tagCounts.get(key);
        if (existing !== undefined) {
          existing.count++;
        } else {
          tagCounts.set(key, { tag, count: 1 });
        }
      }
    }

    return Array.from(tagCounts.values())
      .filter(item => item.count > 0 && item.count < selectedAssetIds.length)
      .map(item => item.tag);
  }, [selectedAssetIds, assetMeta]);

  const handleAdd = useCallback(() => {
    const label = newTag.trim();
    if (label.length === 0 || selectedAssetIds.length === 0) return;
    const tag: AITag = { label, confidence: 1, source: 'user' };
    batchAddTag(selectedAssetIds, tag);
    setNewTag('');
  }, [newTag, selectedAssetIds, batchAddTag]);

  const handleRemove = useCallback((label: string) => {
    batchRemoveTag(selectedAssetIds, label);
  }, [selectedAssetIds, batchRemoveTag]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  }, [handleAdd]);

  if (selectedAssetIds.length === 0) {
    return <div style={S.noSelection}>에셋을 선택하면 태그를 일괄 편집할 수 있습니다</div>;
  }

  return (
    <div style={S.root}>
      <div style={S.header}>
        <span style={S.title}>배치 태그 편집</span>
        <span style={S.count}>{selectedAssetIds.length}개 선택</span>
      </div>

      {/* 태그 추가 */}
      <div style={S.inputRow}>
        <input
          style={S.input}
          placeholder="새 태그 입력…"
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button style={S.addBtn} onClick={handleAdd}>추가</button>
      </div>

      {/* 공통 태그 */}
      {commonTags.length > 0 && (
        <div style={S.tagSection}>
          <div style={S.tagLabel}>공통 태그</div>
          <div style={S.tagRow}>
            {commonTags.map(tag => (
              <span key={tag.label} style={S.tag}>
                {tag.label}
                <span style={S.tagRemove} onClick={() => handleRemove(tag.label)}>✕</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 부분 태그 */}
      {partialTags.length > 0 && (
        <div style={S.tagSection}>
          <div style={S.tagLabel}>일부 에셋에만 있는 태그</div>
          <div style={S.tagRow}>
            {partialTags.map(tag => (
              <span key={tag.label} style={{ ...S.tag, opacity: 0.6 }}>
                {tag.label}
                <span style={S.tagRemove} onClick={() => handleRemove(tag.label)}>✕</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
