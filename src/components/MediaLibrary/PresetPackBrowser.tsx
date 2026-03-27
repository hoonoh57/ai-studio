// src/components/MediaLibrary/PresetPackBrowser.tsx
// AI 프리셋 팩 브라우저 — 장르별 미디어 세트 관리

import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { MediaPresetPack, PresetCategory } from '@/types/media';

// ── 상수 ──
const BROWSER_PADDING = 8;
const CARD_WIDTH = 110;
const CARD_HEIGHT = 100;
const CARD_RADIUS = 8;
const CARD_FONT_SIZE = 10;
const DESC_FONT_SIZE = 8;
const TITLE_FONT_SIZE = 10;
const EMOJI_SIZE = 28;
const GRID_GAP = 6;
const BADGE_FONT_SIZE = 8;
const BADGE_RADIUS = 8;

const CATEGORY_EMOJIS: Record<PresetCategory, string> = {
  vlog: '✈️', review: '📦', tutorial: '📚',
  cinematic: '🎥', shorts: '📱', podcast: '🎙️', custom: '⚙️',
};

const CATEGORY_LABELS: Record<PresetCategory, string> = {
  vlog: '브이로그', review: '리뷰', tutorial: '튜토리얼',
  cinematic: '시네마틱', shorts: '쇼츠', podcast: '팟캐스트', custom: '커스텀',
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: '초급', intermediate: '중급', advanced: '고급', expert: '전문가',
};

// ── 스타일 ──
const S: Record<string, React.CSSProperties> = {
  root: {
    padding: BROWSER_PADDING,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  header: {
    fontSize: TITLE_FONT_SIZE,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: CARD_RADIUS,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 6,
    transition: 'border-color 0.15s, transform 0.1s',
    position: 'relative',
  },
  cardActive: {
    borderColor: 'var(--accent)',
    background: 'rgba(100, 150, 255, 0.06)',
  },
  emoji: { fontSize: EMOJI_SIZE },
  name: {
    fontSize: CARD_FONT_SIZE,
    fontWeight: 500,
    color: 'var(--text-primary)',
    textAlign: 'center',
    lineHeight: 1.2,
  },
  desc: {
    fontSize: DESC_FONT_SIZE,
    color: 'var(--text-secondary)',
    textAlign: 'center',
    lineHeight: 1.2,
    overflow: 'hidden',
    maxHeight: 20,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    fontSize: BADGE_FONT_SIZE,
    padding: '1px 5px',
    borderRadius: BADGE_RADIUS,
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 600,
  },
  empty: {
    fontSize: CARD_FONT_SIZE,
    color: 'var(--text-secondary)',
    textAlign: 'center',
    padding: 20,
  },
};

// ── 카드 ──
interface PackCardProps {
  readonly pack: MediaPresetPack;
  readonly isActive: boolean;
  readonly onSelect: () => void;
}

function PackCard(props: PackCardProps): React.ReactElement {
  const { pack, isActive } = props;
  return (
    <div
      style={{ ...S.card, ...(isActive ? S.cardActive : {}) }}
      onClick={props.onSelect}
      onMouseEnter={e => {
        if (!isActive) e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.transform = 'scale(1.02)';
      }}
      onMouseLeave={e => {
        if (!isActive) e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <span style={S.badge}>{LEVEL_LABELS[pack.skillLevel] ?? pack.skillLevel}</span>
      <span style={S.emoji}>{CATEGORY_EMOJIS[pack.category] ?? '📦'}</span>
      <span style={S.name}>{pack.name}</span>
      <span style={S.desc}>{pack.description}</span>
    </div>
  );
}

// ── 메인 ──
export function PresetPackBrowser(): React.ReactElement {
  const packs = useEditorStore(s => s.presetPacks);
  const activePackId = useEditorStore(s => s.mediaView.activePresetPack);
  const setActivePresetPack = useEditorStore(s => s.setActivePresetPack);

  if (packs.length === 0) {
    return <div style={S.empty}>프리셋 팩이 없습니다</div>;
  }

  return (
    <div style={S.root}>
      <div style={S.header}>AI 프리셋 팩</div>
      <div style={S.grid}>
        {packs.map(pack => (
          <PackCard
            key={pack.id}
            pack={pack}
            isActive={activePackId === pack.id}
            onSelect={() => setActivePresetPack(activePackId === pack.id ? null : pack.id)}
          />
        ))}
      </div>
    </div>
  );
}
