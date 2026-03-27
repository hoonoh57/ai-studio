/* ─── src/types/project.ts ─── */

/* ========== 기본 인터페이스 ========== */
export interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export type TrackType = 'video' | 'audio' | 'text' | 'effect';
export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay'
  | 'darken' | 'lighten' | 'color-dodge' | 'color-burn'
  | 'hard-light' | 'soft-light' | 'difference' | 'exclusion';

export const BLEND_MODE_LIST: BlendMode[] = [
  'normal', 'multiply', 'screen', 'overlay',
  'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion',
];

/* ── T-3.1: 속도 프리셋 ── */
export const SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

export interface Asset {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image' | 'text' | 'effect';
  src: string;
  duration: number;
  thumbnail?: string;
  metadata?: Record<string, unknown>;
  width?: number;
  height?: number;
  fileSize?: number;
}

export interface Filter {
  id: string;
  name: string;
  params: Record<string, number | string | boolean>;
}

export interface Clip {
  id: string;
  assetId: string;
  startTime: number;
  duration: number;
  inPoint: number;
  outPoint: number;
  transform: Transform;
  filters: Filter[];
  blendMode: BlendMode;
  opacity: number;
  volume?: number;
  speed: number;
  /* Phase T-2 */
  linkedClipId?: string;
  groupId?: string;
  /* Phase T-3: 역재생 */
  reverse?: boolean;
}

export type TrackHeightPreset = 'S' | 'M' | 'L' | 'XL' | 'custom';

export const TRACK_HEIGHT_PRESETS: Record<Exclude<TrackHeightPreset, 'custom'>, number> = {
  S: 30, M: 48, L: 72, XL: 120,
};

export const DEFAULT_TRACK_COLORS: Record<TrackType, string> = {
  video: '#4A90D9', audio: '#50C878', text: '#FFB347', effect: '#DA70D6',
};

export const TRACK_COLOR_PALETTE = [
  '#4A90D9', '#50C878', '#FFB347', '#DA70D6',
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F1948A', '#82E0AA',
];

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  clips: Clip[];
  muted: boolean;
  locked: boolean;
  visible: boolean;
  height: number;
  heightPreset?: TrackHeightPreset;
  color?: string;
  solo?: boolean;
  order?: number;
}

export interface Project {
  id: string;
  name: string;
  tracks: Track[];
  assets: Asset[];
  duration: number;
  fps: number;
  width: number;
  height: number;
  markers?: readonly Marker[];
  transitions?: readonly Transition[];
  inOut?: InOutRange;
}

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type EditorTab =
  | 'ai-creator' | 'edit' | 'cut' | 'color'
  | 'audio' | 'effects' | 'export' | 'ai-workflow';

export type PanelId =
  | 'media' | 'preview' | 'timeline' | 'properties'
  | 'effects' | 'audio-mixer' | 'color-wheels' | 'ai' | 'text' | 'audio' | 'sticker' | 'transition';

export interface SkillConfig {
  label: string;
  maxTracks: number;
  showTimeline: boolean;
  showProperties: boolean;
  showEffects: boolean;
  showColorGrading: boolean;
  showAudioMixer: boolean;
  showKeyframes: boolean;
  showAdvancedTrim: boolean;
  showBlendModes: boolean;
  showMulticam: boolean;
  enabledTabs: EditorTab[];
  enabledPanels: PanelId[];
  /* Phase T-2 */
  showTrackColor?: boolean;
  showTrackHeightPresets?: boolean;
  showTrackReorder?: boolean;
  showTrackDuplicate?: boolean;
  showSoloMode?: boolean;
  showLinkedSelection?: boolean;
  /* Phase T-3 */
  showSpeedControl?: boolean;
  showClipContextMenu?: boolean;
  showClipGrouping?: boolean;
}

export const SKILL_CONFIGS: Record<SkillLevel, SkillConfig> = {
  beginner: {
    label: '초급',
    maxTracks: 4,
    showTimeline: true,
    showProperties: false,
    showEffects: false,
    showColorGrading: false,
    showAudioMixer: false,
    showKeyframes: false,
    showAdvancedTrim: false,
    showBlendModes: false,
    showMulticam: false,
    enabledTabs: ['ai-creator', 'edit', 'export'],
    enabledPanels: ['media', 'preview', 'timeline'],
    showTrackColor: false,
    showTrackHeightPresets: false,
    showTrackReorder: false,
    showTrackDuplicate: false,
    showSoloMode: false,
    showLinkedSelection: false,
    showSpeedControl: false,
    showClipContextMenu: false,
    showClipGrouping: false,
  },
  intermediate: {
    label: '중급',
    maxTracks: 32,
    showTimeline: true,
    showProperties: true,
    showEffects: true,
    showColorGrading: false,
    showAudioMixer: false,
    showKeyframes: false,
    showAdvancedTrim: true,
    showBlendModes: false,
    showMulticam: false,
    enabledTabs: ['edit', 'cut', 'effects', 'export'],
    enabledPanels: ['media', 'preview', 'timeline', 'properties', 'effects'],
    showTrackColor: true,
    showTrackHeightPresets: true,
    showTrackReorder: true,
    showTrackDuplicate: true,
    showSoloMode: true,
    showLinkedSelection: false,
    showSpeedControl: true,
    showClipContextMenu: true,
    showClipGrouping: false,
  },
  advanced: {
    label: '고급',
    maxTracks: 128,
    showTimeline: true,
    showProperties: true,
    showEffects: true,
    showColorGrading: true,
    showAudioMixer: true,
    showKeyframes: true,
    showAdvancedTrim: true,
    showBlendModes: true,
    showMulticam: false,
    enabledTabs: ['edit', 'cut', 'color', 'audio', 'effects', 'export'],
    enabledPanels: ['media', 'preview', 'timeline', 'properties', 'effects', 'audio-mixer', 'color-wheels'],
    showTrackColor: true,
    showTrackHeightPresets: true,
    showTrackReorder: true,
    showTrackDuplicate: true,
    showSoloMode: true,
    showLinkedSelection: true,
    showSpeedControl: true,
    showClipContextMenu: true,
    showClipGrouping: true,
  },
  expert: {
    label: '전문가',
    maxTracks: 999,
    showTimeline: true,
    showProperties: true,
    showEffects: true,
    showColorGrading: true,
    showAudioMixer: true,
    showKeyframes: true,
    showAdvancedTrim: true,
    showBlendModes: true,
    showMulticam: true,
    enabledTabs: ['edit', 'cut', 'color', 'audio', 'effects', 'export'],
    enabledPanels: ['media', 'preview', 'timeline', 'properties', 'effects', 'audio-mixer', 'color-wheels'],
    showTrackColor: true,
    showTrackHeightPresets: true,
    showTrackReorder: true,
    showTrackDuplicate: true,
    showSoloMode: true,
    showLinkedSelection: true,
    showSpeedControl: true,
    showClipContextMenu: true,
    showClipGrouping: true,
  },
};

export function assetTypeToTrackType(assetType: Asset['type']): TrackType {
  switch (assetType) {
    case 'audio': return 'audio';
    case 'text': return 'text';
    case 'effect': return 'effect';
    case 'video':
    case 'image':
    default: return 'video';
  }
}

export type TrimMode = 'normal' | 'ripple' | 'roll' | 'slip' | 'slide';
export type DragType = 'move' | 'trim-left' | 'trim-right';

export interface Marker {
  id: string;
  time: number;
  label: string;
  color: string;
}

export interface InOutRange {
  inPoint: number | null;
  outPoint: number | null;
}

export interface Transition {
  id: string;
  type: string;
  clipAId: string;
  clipBId: string;
  duration: number;
}

export interface SnapPoint {
  time: number;
  source: 'clip-start' | 'clip-end' | 'marker' | 'playhead' | 'in' | 'out';
  trackId?: string;
}

export interface TimelineDragState {
  type: DragType;
  clipId: string;
  trackId: string;
  startX: number;
  startTime: number;
  originalClip: Clip;
}

export interface WaveformData {
  assetId: string;
  peaks: number[];
  sampleRate: number;
  duration?: number;
}

export interface ThumbnailData {
  assetId: string;
  frames: string[];
  interval: number;
}
