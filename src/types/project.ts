// src/types/project.ts

// === Core Types ===

export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export type TrackType = 'video' | 'audio' | 'text' | 'effect';
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'add' | 'difference';

export interface Asset {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  src: string;
  duration: number;
  width?: number;
  height?: number;
  fileSize?: number;
  thumbnail?: string;
}

export interface Filter {
  id: string;
  type: string;
  enabled: boolean;
  params: Record<string, number | string | boolean>;
}

export interface Clip {
  id: string;
  assetId: string;
  trackId: string;
  timelineStart: number;
  timelineEnd: number;
  sourceStart: number;
  sourceEnd: number;
  transform: Transform;
  opacity: number;
  blendMode: BlendMode;
  speed: number;
  filters: Filter[];
  locked: boolean;
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  height: number;
  muted: boolean;
  locked: boolean;
  visible: boolean;
  clips: Clip[];
}

export interface Project {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  tracks: Track[];
  assets: Asset[];
  markers?: readonly Marker[];
  transitions?: readonly Transition[];
  inOut?: InOutRange;
}

// === Skill Level System ===

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type EditorTab = 'ai-creator' | 'edit' | 'color' | 'audio' | 'ai-workflow' | 'export';

export type PanelId = 'media' | 'text' | 'audio' | 'effects' | 'ai' | 'sticker' | 'transition';

export interface SkillConfig {
  readonly level: SkillLevel;
  readonly label: string;
  readonly description: string;
  readonly visibleTabs: readonly EditorTab[];
  readonly visiblePanels: readonly PanelId[];
  readonly showTimeline: boolean;
  readonly showProperties: boolean;
  readonly showIconBar: boolean;
  readonly maxTracks: number;
  readonly showKeyframes: boolean;
  readonly showEffectsStack: boolean;
  readonly showSafeZone: boolean;
  readonly showWaveform: boolean;
  readonly showThumbnailStrip: boolean;
  readonly showAdvancedTrim: boolean;
  readonly showGraphEditor: boolean;
  readonly showNodeColor: boolean;
  readonly showFFmpegCustom: boolean;
}

export const SKILL_CONFIGS: Record<SkillLevel, SkillConfig> = {
  beginner: {
    level: 'beginner',
    label: '초급',
    description: 'AI가 영상을 만들어줍니다',
    visibleTabs: ['ai-creator'],
    visiblePanels: ['ai'],
    showTimeline: false,
    showProperties: false,
    showIconBar: false,
    maxTracks: 2,
    showKeyframes: false,
    showEffectsStack: false,
    showSafeZone: false,
    showWaveform: false,
    showThumbnailStrip: false,
    showAdvancedTrim: false,
    showGraphEditor: false,
    showNodeColor: false,
    showFFmpegCustom: false,
  },
  intermediate: {
    level: 'intermediate',
    label: '중급',
    description: 'CapCut처럼 쉽게 편집합니다',
    visibleTabs: ['edit', 'ai-creator'],
    visiblePanels: ['media', 'text', 'ai'],
    showTimeline: true,
    showProperties: true,
    showIconBar: true,
    maxTracks: 6,
    showKeyframes: false,
    showEffectsStack: false,
    showSafeZone: false,
    showWaveform: true,
    showThumbnailStrip: true,
    showAdvancedTrim: false,
    showGraphEditor: false,
    showNodeColor: false,
    showFFmpegCustom: false,
  },
  advanced: {
    level: 'advanced',
    label: '고급',
    description: 'Premiere급 전문 편집',
    visibleTabs: ['edit', 'color', 'audio', 'ai-creator', 'export'],
    visiblePanels: ['media', 'text', 'audio', 'effects', 'ai', 'sticker', 'transition'],
    showTimeline: true,
    showProperties: true,
    showIconBar: true,
    maxTracks: 20,
    showKeyframes: true,
    showEffectsStack: true,
    showSafeZone: true,
    showWaveform: true,
    showThumbnailStrip: true,
    showAdvancedTrim: true,
    showGraphEditor: false,
    showNodeColor: false,
    showFFmpegCustom: false,
  },
  expert: {
    level: 'expert',
    label: '초고급',
    description: 'DaVinci급 완전 제어',
    visibleTabs: ['edit', 'color', 'audio', 'ai-workflow', 'ai-creator', 'export'],
    visiblePanels: ['media', 'text', 'audio', 'effects', 'ai', 'sticker', 'transition'],
    showTimeline: true,
    showProperties: true,
    showIconBar: true,
    maxTracks: 99,
    showKeyframes: true,
    showEffectsStack: true,
    showSafeZone: true,
    showWaveform: true,
    showThumbnailStrip: true,
    showAdvancedTrim: true,
    showGraphEditor: true,
    showNodeColor: true,
    showFFmpegCustom: true,
  },
} as const satisfies Record<SkillLevel, SkillConfig>;

// === Timeline Engine Types ===

export type TrimMode = 'normal' | 'ripple' | 'roll' | 'slip' | 'slide';

export type DragType = 'move' | 'trim-left' | 'trim-right';

export interface Marker {
  readonly id: string;
  readonly time: number;
  readonly label: string;
  readonly color: string;
}

export interface InOutRange {
  readonly inPoint: number | null;
  readonly outPoint: number | null;
}

export interface Transition {
  readonly id: string;
  readonly type: string;
  readonly duration: number;
  readonly clipAId: string;
  readonly clipBId: string;
}

export interface SnapPoint {
  readonly time: number;
  readonly source: 'clip-start' | 'clip-end' | 'playhead' | 'marker' | 'in-out';
  readonly trackId?: string;
}

export interface TimelineDragState {
  readonly type: DragType;
  readonly clipId: string;
  readonly startX: number;
  readonly origStart: number;
  readonly origEnd: number;
  readonly origSourceStart: number;
  readonly origSourceEnd: number;
}

export interface WaveformData {
  readonly assetId: string;
  readonly peaks: readonly number[];
  readonly sampleRate: number;
  readonly duration: number;
}

export interface ThumbnailData {
  readonly assetId: string;
  readonly frames: readonly string[];
  readonly interval: number;
}
