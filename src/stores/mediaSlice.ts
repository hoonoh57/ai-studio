// src/stores/mediaSlice.ts
// 미디어 허브 상태 슬라이스 — editorStore에 병합하여 사용

import type {
  AssetMetadata,
  SmartCollection,
  MediaPresetPack,
  MediaViewState,
  MediaCategory,
  MediaSourceType,
  MediaSortField,
  MediaViewMode,
  AITag,
  SmartRule,
} from '@/types/media';
import {
  createDefaultCollections,
  createDefaultPresetPacks,
} from '@/lib/core/mediaEngine';

// ── UID 생성 ──
let mediaUidCounter = 0;
const mediaUid = (prefix: string) =>
  `${prefix}_${Date.now()}_${++mediaUidCounter}`;

// ── 기본 뷰 상태 ──
const DEFAULT_VIEW_STATE: MediaViewState = {
  viewMode: 'grid',
  sortField: 'name',
  sortDirection: 'asc',
  filterType: 'all',
  filterSource: 'all',
  searchQuery: '',
  activeCollection: 'sc-all',
  activePresetPack: null,
};

// ── 기본 메타데이터 생성 ──
export function createDefaultMeta(
  assetId: string,
  assetType: 'video' | 'audio' | 'image',
  sourceType: MediaSourceType = 'local',
): AssetMetadata {
  return {
    assetId,
    sourceType,
    category: assetType,
    tags: [],
    favorite: false,
    usageCount: 0,
    lastUsed: null,
    colorProfile: null,
    audioChannels: null,
    sampleRate: null,
    codec: null,
    bitrate: null,
  };
}

// ── 슬라이스 상태 인터페이스 ──
export interface MediaSliceState {
  assetMeta: Map<string, AssetMetadata>;
  collections: SmartCollection[];
  presetPacks: MediaPresetPack[];
  mediaView: MediaViewState;
}

// ── 슬라이스 액션 인터페이스 ──
export interface MediaSliceActions {
  // 메타데이터
  setAssetMeta: (assetId: string, meta: AssetMetadata) => void;
  getOrCreateMeta: (
    assetId: string,
    assetType: 'video' | 'audio' | 'image',
  ) => AssetMetadata;
  toggleFavorite: (assetId: string) => void;
  incrementUsage: (assetId: string) => void;
  addTag: (assetId: string, tag: AITag) => void;
  removeTag: (assetId: string, label: string) => void;
  batchAddTag: (assetIds: readonly string[], tag: AITag) => void;
  batchRemoveTag: (assetIds: readonly string[], label: string) => void;
  setAssetTags: (assetId: string, tags: readonly AITag[]) => void;

  // 스마트 컬렉션
  addCollection: (
    name: string,
    icon: string,
    rules: readonly SmartRule[],
  ) => SmartCollection;
  updateCollection: (
    id: string,
    updates: Partial<Pick<SmartCollection, 'name' | 'icon' | 'rules'>>,
  ) => void;
  removeCollection: (id: string) => void;

  // 프리셋 팩
  addPresetPack: (
    pack: Omit<MediaPresetPack, 'id'>,
  ) => MediaPresetPack;
  removePresetPack: (id: string) => void;

  // 뷰 상태
  setMediaViewMode: (mode: MediaViewMode) => void;
  setMediaSortField: (field: MediaSortField) => void;
  toggleMediaSortDirection: () => void;
  setMediaFilterType: (type: MediaCategory | 'all') => void;
  setMediaFilterSource: (source: MediaSourceType | 'all') => void;
  setMediaSearchQuery: (query: string) => void;
  setActiveCollection: (id: string | null) => void;
  setActivePresetPack: (id: string | null) => void;
}

// ── 전체 슬라이스 타입 ──
export type MediaSlice = MediaSliceState & MediaSliceActions;

// ── 초기 상태 ──
export const MEDIA_INITIAL_STATE: MediaSliceState = {
  assetMeta: new Map(),
  collections: createDefaultCollections(),
  presetPacks: createDefaultPresetPacks(),
  mediaView: DEFAULT_VIEW_STATE,
};

// ── 슬라이스 생성 함수 ──
// Zustand set/get을 받아 액션을 반환
type SetFn = (
  partial:
    | Partial<MediaSliceState>
    | ((state: MediaSliceState) => Partial<MediaSliceState>),
) => void;
type GetFn = () => MediaSliceState;

export function createMediaSlice(
  set: SetFn,
  get: GetFn,
): MediaSliceActions {
  return {
    // ── 메타데이터 관리 ──

    setAssetMeta: (assetId, meta) =>
      set((s) => ({
        assetMeta: new Map(s.assetMeta).set(assetId, meta),
      })),

    getOrCreateMeta: (assetId, assetType) => {
      const existing = get().assetMeta.get(assetId);
      if (existing !== undefined) return existing;
      const meta = createDefaultMeta(assetId, assetType);
      set((s) => ({
        assetMeta: new Map(s.assetMeta).set(assetId, meta),
      }));
      return meta;
    },

    toggleFavorite: (assetId) =>
      set((s) => {
        const current = s.assetMeta.get(assetId);
        if (current === undefined) return {};
        const updated: AssetMetadata = {
          ...current,
          favorite: !current.favorite,
        };
        return { assetMeta: new Map(s.assetMeta).set(assetId, updated) };
      }),

    incrementUsage: (assetId) =>
      set((s) => {
        const current = s.assetMeta.get(assetId);
        if (current === undefined) return {};
        const updated: AssetMetadata = {
          ...current,
          usageCount: current.usageCount + 1,
          lastUsed: Date.now(),
        };
        return { assetMeta: new Map(s.assetMeta).set(assetId, updated) };
      }),

    addTag: (assetId, tag) =>
      set((s) => {
        const current = s.assetMeta.get(assetId);
        if (current === undefined) return {};
        const exists = current.tags.some(
          t => t.label.toLowerCase() === tag.label.toLowerCase(),
        );
        if (exists) return {};
        const updated: AssetMetadata = {
          ...current,
          tags: [...current.tags, tag],
        };
        return { assetMeta: new Map(s.assetMeta).set(assetId, updated) };
      }),

    removeTag: (assetId, label) =>
      set((s) => {
        const current = s.assetMeta.get(assetId);
        if (current === undefined) return {};
        const lower = label.toLowerCase();
        const updated: AssetMetadata = {
          ...current,
          tags: current.tags.filter(
            t => t.label.toLowerCase() !== lower,
          ),
        };
        return { assetMeta: new Map(s.assetMeta).set(assetId, updated) };
      }),

    batchAddTag: (assetIds, tag) =>
      set((s) => {
        const next = new Map(s.assetMeta);
        for (const id of assetIds) {
          const current = next.get(id);
          if (current === undefined) continue;
          const exists = current.tags.some(
            t => t.label.toLowerCase() === tag.label.toLowerCase(),
          );
          if (exists) continue;
          next.set(id, { ...current, tags: [...current.tags, tag] });
        }
        return { assetMeta: next };
      }),

    batchRemoveTag: (assetIds, label) =>
      set((s) => {
        const next = new Map(s.assetMeta);
        const lower = label.toLowerCase();
        for (const id of assetIds) {
          const current = next.get(id);
          if (current === undefined) continue;
          next.set(id, {
            ...current,
            tags: current.tags.filter(
              t => t.label.toLowerCase() !== lower,
            ),
          });
        }
        return { assetMeta: next };
      }),

    setAssetTags: (assetId, tags) =>
      set((s) => {
        const current = s.assetMeta.get(assetId);
        if (current === undefined) return {};
        const updated: AssetMetadata = { ...current, tags: [...tags] };
        return { assetMeta: new Map(s.assetMeta).set(assetId, updated) };
      }),

    // ── 스마트 컬렉션 ──

    addCollection: (name, icon, rules) => {
      const collection: SmartCollection = {
        id: mediaUid('sc'),
        name,
        icon,
        rules: [...rules],
        isSystem: false,
      };
      set((s) => ({
        collections: [...s.collections, collection],
      }));
      return collection;
    },

    updateCollection: (id, updates) =>
      set((s) => ({
        collections: s.collections.map(c => {
          if (c.id !== id || c.isSystem) return c;
          return { ...c, ...updates };
        }),
      })),

    removeCollection: (id) =>
      set((s) => ({
        collections: s.collections.filter(
          c => c.id !== id || c.isSystem,
        ),
        mediaView: s.mediaView.activeCollection === id
          ? { ...s.mediaView, activeCollection: 'sc-all' }
          : s.mediaView,
      })),

    // ── 프리셋 팩 ──

    addPresetPack: (packData) => {
      const pack: MediaPresetPack = {
        ...packData,
        id: mediaUid('pp'),
      };
      set((s) => ({
        presetPacks: [...s.presetPacks, pack],
      }));
      return pack;
    },

    removePresetPack: (id) =>
      set((s) => ({
        presetPacks: s.presetPacks.filter(p => p.id !== id),
        mediaView: s.mediaView.activePresetPack === id
          ? { ...s.mediaView, activePresetPack: null }
          : s.mediaView,
      })),

    // ── 뷰 상태 ──

    setMediaViewMode: (mode) =>
      set((s) => ({
        mediaView: { ...s.mediaView, viewMode: mode },
      })),

    setMediaSortField: (field) =>
      set((s) => ({
        mediaView: { ...s.mediaView, sortField: field },
      })),

    toggleMediaSortDirection: () =>
      set((s) => ({
        mediaView: {
          ...s.mediaView,
          sortDirection: s.mediaView.sortDirection === 'asc' ? 'desc' : 'asc',
        },
      })),

    setMediaFilterType: (type) =>
      set((s) => ({
        mediaView: { ...s.mediaView, filterType: type },
      })),

    setMediaFilterSource: (source) =>
      set((s) => ({
        mediaView: { ...s.mediaView, filterSource: source },
      })),

    setMediaSearchQuery: (query) =>
      set((s) => ({
        mediaView: { ...s.mediaView, searchQuery: query },
      })),

    setActiveCollection: (id) =>
      set((s) => ({
        mediaView: { ...s.mediaView, activeCollection: id },
      })),

    setActivePresetPack: (id) =>
      set((s) => ({
        mediaView: { ...s.mediaView, activePresetPack: id },
      })),
  };
}
