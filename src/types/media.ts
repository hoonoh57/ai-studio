// src/types/media.ts
// Media Hub 타입 정의 — project.ts의 Asset과 호환

// ── 미디어 소스 분류 ──
export type MediaSourceType =
  | 'local'
  | 'ai-generated'
  | 'stock'
  | 'recorded'
  | 'linked';

export type MediaCategory = 'video' | 'audio' | 'image';

// ── AI 자동 태그 ──
export interface AITag {
  readonly label: string;
  readonly confidence: number;
  readonly source: 'auto' | 'user';
}

// ── 스마트 컬렉션 규칙 ──
export type SmartRuleField =
  | 'type'
  | 'source'
  | 'tag'
  | 'duration'
  | 'resolution'
  | 'date'
  | 'favorite'
  | 'usageCount';

export type SmartRuleOperator =
  | 'equals'
  | 'contains'
  | 'gt'
  | 'lt'
  | 'between'
  | 'exists';

export interface SmartRule {
  readonly field: SmartRuleField;
  readonly operator: SmartRuleOperator;
  readonly value: string | number | boolean | readonly [number, number];
}

export interface SmartCollection {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly rules: readonly SmartRule[];
  readonly isSystem: boolean;
}

// ── 프리셋 팩 ──
export type PresetCategory =
  | 'vlog'
  | 'review'
  | 'tutorial'
  | 'cinematic'
  | 'shorts'
  | 'podcast'
  | 'custom';

export type PresetAssetRole =
  | 'intro'
  | 'outro'
  | 'bgm'
  | 'sfx'
  | 'overlay'
  | 'lower-third'
  | 'transition'
  | 'lut'
  | 'thumbnail-template';

export interface PresetAssetRef {
  readonly role: PresetAssetRole;
  readonly assetId: string;
  readonly label: string;
}

export interface MediaPresetPack {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly thumbnail: string;
  readonly category: PresetCategory;
  readonly assets: readonly PresetAssetRef[];
  readonly createdBy: 'system' | 'user' | 'ai';
  readonly skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

// ── 에셋 메타데이터 확장 ──
export interface AssetMetadata {
  readonly assetId: string;
  readonly sourceType: MediaSourceType;
  readonly category: MediaCategory;
  readonly tags: readonly AITag[];
  readonly favorite: boolean;
  readonly usageCount: number;
  readonly lastUsed: number | null;
  readonly colorProfile: string | null;
  readonly audioChannels: number | null;
  readonly sampleRate: number | null;
  readonly codec: string | null;
  readonly bitrate: number | null;
}

// ── 뷰 상태 ──
export type MediaViewMode = 'grid' | 'list' | 'filmstrip';

export type MediaSortField =
  | 'name'
  | 'date'
  | 'duration'
  | 'size'
  | 'type'
  | 'usageCount'
  | 'favorite';

export type MediaSortDirection = 'asc' | 'desc';

export interface MediaViewState {
  readonly viewMode: MediaViewMode;
  readonly sortField: MediaSortField;
  readonly sortDirection: MediaSortDirection;
  readonly filterType: MediaCategory | 'all';
  readonly filterSource: MediaSourceType | 'all';
  readonly searchQuery: string;
  readonly activeCollection: string | null;
  readonly activePresetPack: string | null;
}

// ── SkillConfig 미디어 확장 ──
export interface MediaSkillConfig {
  readonly showPresetPacks: boolean;
  readonly showSmartCollections: boolean;
  readonly showAITags: boolean;
  readonly showAISearch: boolean;
  readonly showBatchTagEdit: boolean;
  readonly showFilmstripView: boolean;
  readonly showSourceTabs: boolean;
  readonly showMediaMetadata: boolean;
  readonly allowCustomCollections: boolean;
  readonly allowCustomPresets: boolean;
  readonly mediaViewModes: readonly MediaViewMode[];
  readonly mediaSortFields: readonly MediaSortField[];
}

export const MEDIA_SKILL_CONFIGS: Record<
  'beginner' | 'intermediate' | 'advanced' | 'expert',
  MediaSkillConfig
> = {
  beginner: {
    showPresetPacks: true,
    showSmartCollections: false,
    showAITags: false,
    showAISearch: false,
    showBatchTagEdit: false,
    showFilmstripView: false,
    showSourceTabs: false,
    showMediaMetadata: false,
    allowCustomCollections: false,
    allowCustomPresets: false,
    mediaViewModes: ['grid'],
    mediaSortFields: ['name'],
  },
  intermediate: {
    showPresetPacks: true,
    showSmartCollections: false,
    showAITags: true,
    showAISearch: false,
    showBatchTagEdit: false,
    showFilmstripView: false,
    showSourceTabs: false,
    showMediaMetadata: false,
    allowCustomCollections: false,
    allowCustomPresets: false,
    mediaViewModes: ['grid', 'list'],
    mediaSortFields: ['name', 'date', 'duration', 'size'],
  },
  advanced: {
    showPresetPacks: true,
    showSmartCollections: true,
    showAITags: true,
    showAISearch: true,
    showBatchTagEdit: false,
    showFilmstripView: true,
    showSourceTabs: true,
    showMediaMetadata: true,
    allowCustomCollections: true,
    allowCustomPresets: false,
    mediaViewModes: ['grid', 'list', 'filmstrip'],
    mediaSortFields: ['name', 'date', 'duration', 'size', 'type', 'usageCount', 'favorite'],
  },
  expert: {
    showPresetPacks: true,
    showSmartCollections: true,
    showAITags: true,
    showAISearch: true,
    showBatchTagEdit: true,
    showFilmstripView: true,
    showSourceTabs: true,
    showMediaMetadata: true,
    allowCustomCollections: true,
    allowCustomPresets: true,
    mediaViewModes: ['grid', 'list', 'filmstrip'],
    mediaSortFields: ['name', 'date', 'duration', 'size', 'type', 'usageCount', 'favorite'],
  },
} as const;
