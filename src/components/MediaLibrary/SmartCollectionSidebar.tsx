// src/components/MediaLibrary/SmartCollectionSidebar.tsx
// 스마트 컬렉션 사이드바 — 규칙 기반 컬렉션 관리 (advanced / expert)

import React, { useState, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { MEDIA_SKILL_CONFIGS } from '@/types/media';
import type { SmartCollection, SmartRuleField, SmartRuleOperator } from '@/types/media';

// ── 상수 ──
const SIDEBAR_PADDING = 8;
const SECTION_FONT_SIZE = 10;
const ITEM_HEIGHT = 28;
const ITEM_FONT_SIZE = 11;
const ITEM_RADIUS = 6;
const ITEM_PADDING_H = 8;
const COUNT_FONT_SIZE = 9;
const ADD_BTN_HEIGHT = 28;
const ADD_BTN_FONT_SIZE = 11;
const FORM_GAP = 4;
const FORM_INPUT_HEIGHT = 24;
const FORM_FONT_SIZE = 10;

const FIELD_LABELS: Record<SmartRuleField, string> = {
  type: '유형', source: '소스', tag: '태그', duration: '길이',
  resolution: '해상도', date: '날짜', favorite: '즐겨찾기', usageCount: '사용횟수',
};

const OPERATOR_LABELS: Record<SmartRuleOperator, string> = {
  equals: '=', contains: '포함', gt: '>', lt: '<', between: '사이', exists: '존재',
};

// ── 스타일 ──
const S: Record<string, React.CSSProperties> = {
  root: {
    padding: SIDEBAR_PADDING,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sectionTitle: {
    fontSize: SECTION_FONT_SIZE,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  item: {
    height: ITEM_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: `0 ${ITEM_PADDING_H}px`,
    borderRadius: ITEM_RADIUS,
    cursor: 'pointer',
    fontSize: ITEM_FONT_SIZE,
    transition: 'background 0.12s',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    width: '100%',
    textAlign: 'left',
  },
  itemActive: {
    background: 'var(--accent)',
    color: '#fff',
  },
  itemIcon: { fontSize: 13, flexShrink: 0 },
  itemName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemCount: { fontSize: COUNT_FONT_SIZE, opacity: 0.6, flexShrink: 0 },
  itemDelete: {
    fontSize: 10, cursor: 'pointer', opacity: 0.5,
    background: 'transparent', border: 'none', color: 'inherit',
    flexShrink: 0, padding: 0,
  },
  addBtn: {
    height: ADD_BTN_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    fontSize: ADD_BTN_FONT_SIZE,
    color: 'var(--accent)',
    background: 'transparent',
    border: '1px dashed var(--border)',
    borderRadius: ITEM_RADIUS,
    cursor: 'pointer',
    width: '100%',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: FORM_GAP,
    padding: SIDEBAR_PADDING,
    background: 'var(--bg-surface)',
    borderRadius: ITEM_RADIUS,
  },
  formRow: { display: 'flex', gap: FORM_GAP },
  formInput: {
    flex: 1,
    height: FORM_INPUT_HEIGHT,
    fontSize: FORM_FONT_SIZE,
    padding: '0 6px',
    background: 'var(--bg-deep)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    outline: 'none',
  },
  formSelect: {
    height: FORM_INPUT_HEIGHT,
    fontSize: FORM_FONT_SIZE,
    padding: '0 4px',
    background: 'var(--bg-deep)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    outline: 'none',
  },
  formBtnRow: { display: 'flex', gap: FORM_GAP, justifyContent: 'flex-end' },
  formBtn: {
    height: FORM_INPUT_HEIGHT,
    padding: '0 10px',
    fontSize: FORM_FONT_SIZE,
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
  },
};

// ── 컬렉션 아이템 ──
interface CollectionItemProps {
  readonly collection: SmartCollection;
  readonly isActive: boolean;
  readonly assetCount: number;
  readonly onSelect: () => void;
  readonly onRemove: () => void;
  readonly canRemove: boolean;
}

function CollectionItem(props: CollectionItemProps): React.ReactElement {
  const { collection, isActive, assetCount, canRemove } = props;
  return (
    <button
      style={{ ...S.item, ...(isActive ? S.itemActive : {}) }}
      onClick={props.onSelect}
      onMouseEnter={e => {
        if (!isActive) e.currentTarget.style.background = 'var(--bg-surface)';
      }}
      onMouseLeave={e => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={S.itemIcon}>{collection.icon}</span>
      <span style={S.itemName}>{collection.name}</span>
      <span style={S.itemCount}>{assetCount}</span>
      {canRemove && !collection.isSystem && (
        <button
          style={S.itemDelete}
          onClick={e => { e.stopPropagation(); props.onRemove(); }}
          title="삭제"
        >
          ✕
        </button>
      )}
    </button>
  );
}

// ── 신규 컬렉션 폼 ──
interface AddFormProps {
  readonly onSubmit: (name: string, icon: string, field: SmartRuleField, op: SmartRuleOperator, value: string) => void;
  readonly onCancel: () => void;
}

function AddCollectionForm(props: AddFormProps): React.ReactElement {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📂');
  const [field, setField] = useState<SmartRuleField>('type');
  const [op, setOp] = useState<SmartRuleOperator>('equals');
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    if (name.trim().length === 0) return;
    props.onSubmit(name.trim(), icon, field, op, value);
  };

  return (
    <div style={S.form}>
      <div style={S.formRow}>
        <input style={{ ...S.formInput, maxWidth: 32 }} value={icon} onChange={e => setIcon(e.target.value)} />
        <input style={S.formInput} placeholder="컬렉션 이름" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div style={S.formRow}>
        <select style={S.formSelect} value={field} onChange={e => setField(e.target.value as SmartRuleField)}>
          {Object.entries(FIELD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select style={S.formSelect} value={op} onChange={e => setOp(e.target.value as SmartRuleOperator)}>
          {Object.entries(OPERATOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input style={S.formInput} placeholder="값" value={value} onChange={e => setValue(e.target.value)} />
      </div>
      <div style={S.formBtnRow}>
        <button style={{ ...S.formBtn, background: 'var(--bg-deep)', color: 'var(--text-secondary)' }} onClick={props.onCancel}>취소</button>
        <button style={{ ...S.formBtn, background: 'var(--accent)', color: '#fff' }} onClick={handleSubmit}>추가</button>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──
export function SmartCollectionSidebar(): React.ReactElement {
  const [showForm, setShowForm] = useState(false);

  const collections = useEditorStore(s => s.collections);
  const activeId = useEditorStore(s => s.mediaView.activeCollection);
  const assets = useEditorStore(s => s.project.assets);
  const assetMeta = useEditorStore(s => s.assetMeta);
  const skillLevel = useEditorStore(s => s.skillLevel);
  const setActiveCollection = useEditorStore(s => s.setActiveCollection);
  const addCollection = useEditorStore(s => s.addCollection);
  const removeCollection = useEditorStore(s => s.removeCollection);

  const skillCfg = MEDIA_SKILL_CONFIGS[skillLevel];

  const getCount = useCallback((col: SmartCollection): number => {
    if (col.rules.length === 0) return assets.length;
    return assets.filter(a => {
      const meta = assetMeta.get(a.id);
      return col.rules.every(rule => {
        if (rule.field === 'favorite') return meta?.favorite === rule.value;
        if (rule.field === 'type') return a.type === rule.value;
        if (rule.field === 'source') return meta?.sourceType === rule.value;
        if (rule.field === 'usageCount' && rule.operator === 'gt') return (meta?.usageCount ?? 0) > (rule.value as number);
        return true;
      });
    }).length;
  }, [assets, assetMeta]);

  const handleAdd = useCallback((name: string, icon: string, field: SmartRuleField, op: SmartRuleOperator, value: string) => {
    const parsedValue: string | number | boolean = field === 'favorite' ? value === 'true' : isNaN(Number(value)) ? value : Number(value);
    addCollection(name, icon, [{ field, operator: op, value: parsedValue }]);
    setShowForm(false);
  }, [addCollection]);

  const systemCollections = collections.filter(c => c.isSystem);
  const userCollections = collections.filter(c => !c.isSystem);

  return (
    <div style={S.root}>
      <div style={S.sectionTitle}>시스템 컬렉션</div>
      {systemCollections.map(c => (
        <CollectionItem
          key={c.id}
          collection={c}
          isActive={activeId === c.id}
          assetCount={getCount(c)}
          onSelect={() => setActiveCollection(c.id)}
          onRemove={() => {}}
          canRemove={false}
        />
      ))}

      {userCollections.length > 0 && (
        <>
          <div style={{ ...S.sectionTitle, marginTop: 8 }}>사용자 컬렉션</div>
          {userCollections.map(c => (
            <CollectionItem
              key={c.id}
              collection={c}
              isActive={activeId === c.id}
              assetCount={getCount(c)}
              onSelect={() => setActiveCollection(c.id)}
              onRemove={() => removeCollection(c.id)}
              canRemove={skillCfg.allowCustomCollections}
            />
          ))}
        </>
      )}

      {skillCfg.allowCustomCollections && !showForm && (
        <button style={S.addBtn} onClick={() => setShowForm(true)}>
          + 새 컬렉션
        </button>
      )}

      {showForm && (
        <AddCollectionForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
      )}
    </div>
  );
}
