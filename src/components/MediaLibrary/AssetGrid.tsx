// src/components/MediaLibrary/AssetGrid.tsx

import React from 'react';
import type { Asset } from '@/types/project';
import type { AssetMetadata } from '@/types/media';
import { AssetCard } from './AssetCard';

const GRID_GAP = 6;
const GRID_PADDING = 8;
const EMPTY_FONT_SIZE = 12;
const EMPTY_PADDING = 32;

const styles: Record<string, React.CSSProperties> = {
  grid: {
    flex: 1,
    overflowY: 'auto',
    padding: GRID_PADDING,
    display: 'flex',
    flexDirection: 'column',
    gap: GRID_GAP,
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    fontSize: EMPTY_FONT_SIZE,
    padding: EMPTY_PADDING,
    textAlign: 'center',
    lineHeight: 1.6,
  },
};

interface AssetGridProps {
  readonly assets: readonly Asset[];
  readonly metaMap: Map<string, AssetMetadata>;
  readonly selectedAssetId: string | null;
  readonly showTags: boolean;
  readonly onSelect: (assetId: string) => void;
}

export function AssetGrid({
  assets,
  metaMap,
  selectedAssetId,
  showTags,
  onSelect,
}: AssetGridProps): React.ReactElement {
  if (assets.length === 0) {
    return (
      <div style={styles.empty}>
        미디어가 없습니다.<br />
        파일을 추가하거나 AI 프리셋을 선택하세요.
      </div>
    );
  }

  return (
    <div style={styles.grid}>
      {assets.map(asset => (
        <AssetCard
          key={asset.id}
          asset={asset}
          meta={metaMap.get(asset.id)}
          isSelected={selectedAssetId === asset.id}
          showTags={showTags}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
