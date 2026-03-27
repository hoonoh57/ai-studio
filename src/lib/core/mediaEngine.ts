// src/lib/core/mediaEngine.ts
// 미디어 필터/정렬/스마트 컬렉션 매칭 — 순수 함수만

import type { Asset } from '@/types/project';
import type {
  AssetMetadata,
  SmartRule,
  SmartCollection,
  MediaSortField,
  MediaSortDirection,
  MediaCategory,
  MediaSourceType,
  MediaPresetPack,
} from '@/types/media';

// ── 숫자 비교 헬퍼 ──
function compareNumber(
  actual: number,
  operator: SmartRule['operator'],
  value: SmartRule['value'],
): boolean {
  const num = typeof value === 'number' ? value : 0;
  switch (operator) {
    case 'equals': return actual === num;
    case 'gt': return actual > num;
    case 'lt': return actual < num;
    case 'between':
      return Array.isArray(value)
        && actual >= (value as [number, number])[0]
        && actual <= (value as [number, number])[1];
    default: return false;
  }
}

// ── 단일 규칙 매칭 ──
export function matchesRule(
  asset: Asset,
  meta: AssetMetadata | undefined,
  rule: SmartRule,
): boolean {
  switch (rule.field) {
    case 'type':
      return rule.operator === 'equals'
        ? asset.type === rule.value
        : false;

    case 'source':
      if (meta === undefined) return false;
      return rule.operator === 'equals'
        ? meta.sourceType === rule.value
        : false;

    case 'tag':
      if (meta === undefined) return false;
      if (rule.operator === 'contains') {
        const target = String(rule.value).toLowerCase();
        return meta.tags.some(t => t.label.toLowerCase() === target);
      }
      if (rule.operator === 'exists') {
        return meta.tags.length > 0;
      }
      return false;

    case 'duration':
      return compareNumber(asset.duration, rule.operator, rule.value);

    case 'resolution':
      if (asset.width === undefined) return false;
      return compareNumber(asset.width, rule.operator, rule.value);

    case 'favorite':
      if (meta === undefined) return false;
      return meta.favorite === rule.value;

    case 'usageCount':
      if (meta === undefined) return false;
      return compareNumber(meta.usageCount, rule.operator, rule.value);

    case 'date':
      if (meta === undefined || meta.lastUsed === null) return false;
      return compareNumber(meta.lastUsed, rule.operator, rule.value);

    default:
      return false;
  }
}

// ── 모든 규칙 AND 매칭 ──
export function matchesAllRules(
  asset: Asset,
  meta: AssetMetadata | undefined,
  rules: readonly SmartRule[],
): boolean {
  if (rules.length === 0) return true;
  return rules.every(rule => matchesRule(asset, meta, rule));
}

// ── 스마트 컬렉션에 속하는 에셋 ID 목록 ──
export function getCollectionAssetIds(
  collection: SmartCollection,
  assets: readonly Asset[],
  metaMap: Map<string, AssetMetadata>,
): string[] {
  if (collection.rules.length === 0) {
    return assets.map(a => a.id);
  }
  return assets
    .filter(asset => matchesAllRules(asset, metaMap.get(asset.id), collection.rules))
    .map(a => a.id);
}

// ── 타입+소스+검색어 필터링 ──
export function filterAssets(
  assets: readonly Asset[],
  metaMap: Map<string, AssetMetadata>,
  filterType: MediaCategory | 'all',
  filterSource: MediaSourceType | 'all',
  searchQuery: string,
): Asset[] {
  const query = searchQuery.trim().toLowerCase();

  return assets.filter(asset => {
    // 타입 필터
    if (filterType !== 'all' && asset.type !== filterType) return false;

    // 소스 필터
    if (filterSource !== 'all') {
      const meta = metaMap.get(asset.id);
      if (meta === undefined || meta.sourceType !== filterSource) return false;
    }

    // 검색어 필터 (이름 + 태그)
    if (query.length > 0) {
      const nameMatch = asset.name.toLowerCase().includes(query);
      const meta = metaMap.get(asset.id);
      const tagMatch = meta !== undefined
        && meta.tags.some(t => t.label.toLowerCase().includes(query));
      if (!nameMatch && !tagMatch) return false;
    }

    return true;
  });
}

// ── 정렬 비교값 추출 ──
function getSortValue(
  asset: Asset,
  meta: AssetMetadata | undefined,
  field: MediaSortField,
): number | string {
  switch (field) {
    case 'name': return asset.name.toLowerCase();
    case 'duration': return asset.duration;
    case 'size': return asset.fileSize ?? 0;
    case 'type': return asset.type;
    case 'favorite': return meta?.favorite ? 1 : 0;
    case 'usageCount': return meta?.usageCount ?? 0;
    case 'date': return meta?.lastUsed ?? 0;
    default: return 0;
  }
}

// ── 정렬 ──
export function sortAssets(
  assets: readonly Asset[],
  metaMap: Map<string, AssetMetadata>,
  field: MediaSortField,
  direction: MediaSortDirection,
): Asset[] {
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...assets].sort((a, b) => {
    const valA = getSortValue(a, metaMap.get(a.id), field);
    const valB = getSortValue(b, metaMap.get(b.id), field);

    if (typeof valA === 'string' && typeof valB === 'string') {
      return valA.localeCompare(valB) * multiplier;
    }
    if (typeof valA === 'number' && typeof valB === 'number') {
      return (valA - valB) * multiplier;
    }
    return 0;
  });
}

// ── AI 태그 기반 시맨틱 검색 ──
export function searchByTags(
  assets: readonly Asset[],
  metaMap: Map<string, AssetMetadata>,
  query: string,
): Asset[] {
  const keywords = query.trim().toLowerCase().split(/\s+/)
    .filter(kw => kw.length > 0);

  if (keywords.length === 0) return [...assets];

  const scored = assets.map(asset => {
    const meta = metaMap.get(asset.id);
    let score = 0;

    // 이름 매칭 (0.5점/키워드)
    const nameLower = asset.name.toLowerCase();
    for (const kw of keywords) {
      if (nameLower.includes(kw)) {
        score += 0.5;
      }
    }

    // 태그 매칭 (confidence 가중)
    if (meta !== undefined) {
      for (const kw of keywords) {
        for (const tag of meta.tags) {
          if (tag.label.toLowerCase().includes(kw)) {
            score += tag.confidence;
          }
        }
      }
    }

    return { asset, score };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.asset);
}

// ── 필터 + 정렬 + 컬렉션 통합 파이프라인 ──
export function getFilteredSortedAssets(
  assets: readonly Asset[],
  metaMap: Map<string, AssetMetadata>,
  collection: SmartCollection | null,
  filterType: MediaCategory | 'all',
  filterSource: MediaSourceType | 'all',
  searchQuery: string,
  sortField: MediaSortField,
  sortDirection: MediaSortDirection,
): Asset[] {
  // 1단계: 컬렉션 필터
  let pool: Asset[];
  if (collection !== null && collection.rules.length > 0) {
    const ids = new Set(getCollectionAssetIds(collection, assets, metaMap));
    pool = assets.filter(a => ids.has(a.id));
  } else {
    pool = [...assets];
  }

  // 2단계: 타입/소스/검색어 필터
  const filtered = filterAssets(pool, metaMap, filterType, filterSource, searchQuery);

  // 3단계: 검색어가 있으면 시맨틱 점수 정렬 우선
  if (searchQuery.trim().length > 0) {
    return searchByTags(filtered, metaMap, searchQuery);
  }

  // 4단계: 일반 정렬
  return sortAssets(filtered, metaMap, sortField, sortDirection);
}

// ── 시스템 기본 스마트 컬렉션 ──
export function createDefaultCollections(): SmartCollection[] {
  return [
    {
      id: 'sc-all', name: '전체', icon: '📌',
      rules: [], isSystem: true,
    },
    {
      id: 'sc-favorites', name: '즐겨찾기', icon: '⭐',
      rules: [{ field: 'favorite', operator: 'equals', value: true }],
      isSystem: true,
    },
    {
      id: 'sc-video', name: '비디오', icon: '🎬',
      rules: [{ field: 'type', operator: 'equals', value: 'video' }],
      isSystem: true,
    },
    {
      id: 'sc-audio', name: '오디오', icon: '🎵',
      rules: [{ field: 'type', operator: 'equals', value: 'audio' }],
      isSystem: true,
    },
    {
      id: 'sc-image', name: '이미지', icon: '🖼️',
      rules: [{ field: 'type', operator: 'equals', value: 'image' }],
      isSystem: true,
    },
    {
      id: 'sc-ai', name: 'AI 생성', icon: '🤖',
      rules: [{ field: 'source', operator: 'equals', value: 'ai-generated' }],
      isSystem: true,
    },
    {
      id: 'sc-frequent', name: '자주 사용', icon: '📊',
      rules: [{ field: 'usageCount', operator: 'gt', value: 3 }],
      isSystem: true,
    },
  ];
}

// ── 시스템 기본 프리셋 팩 ──
export function createDefaultPresetPacks(): MediaPresetPack[] {
  return [
    {
      id: 'pp-vlog', name: '여행 브이로그',
      description: '밝고 경쾌한 여행 영상 세트',
      thumbnail: '', category: 'vlog', assets: [],
      createdBy: 'system', skillLevel: 'beginner',
    },
    {
      id: 'pp-review', name: '제품 리뷰',
      description: '깔끔한 리뷰 영상 세트',
      thumbnail: '', category: 'review', assets: [],
      createdBy: 'system', skillLevel: 'beginner',
    },
    {
      id: 'pp-tutorial', name: '교육/튜토리얼',
      description: '전문적인 교육 영상 세트',
      thumbnail: '', category: 'tutorial', assets: [],
      createdBy: 'system', skillLevel: 'intermediate',
    },
    {
      id: 'pp-cinematic', name: '시네마틱',
      description: '영화같은 색감과 분위기',
      thumbnail: '', category: 'cinematic', assets: [],
      createdBy: 'system', skillLevel: 'advanced',
    },
    {
      id: 'pp-shorts', name: '쇼츠/릴스',
      description: '짧고 임팩트있는 콘텐츠',
      thumbnail: '', category: 'shorts', assets: [],
      createdBy: 'system', skillLevel: 'beginner',
    },
    {
      id: 'pp-podcast', name: '팟캐스트',
      description: '음성 중심 콘텐츠 세트',
      thumbnail: '', category: 'podcast', assets: [],
      createdBy: 'system', skillLevel: 'intermediate',
    },
  ];
}
