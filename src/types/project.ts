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

/* ─── Clip 인터페이스: linked 필드 optional 추가 ─── */
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
  /* Phase T-2: Linked Selection (Optional) */
  linkedClipId?: string;
  groupId?: string;
}

/* ─── 트랙 높이 프리셋 (신규) ─── */
export type TrackHeightPreset = 'S' | 'M' | 'L' | 'XL' | 'custom';

export const TRACK_HEIGHT_PRESETS: Record<Exclude<TrackHeightPreset, 'custom'>, number> = {
  S: 30,
  M: 48,
  L: 72,
  XL: 120,
};

/* ─── 트랙 기본 컬러 (신규) ─── */
export const DEFAULT_TRACK_COLORS: Record<TrackType, string> = {
  video: '#4A90D9',
  audio: '#50C878',
  text: '#FFB347',
  effect: '#DA70D6',
};

export const TRACK_COLOR_PALETTE = [
  '#4A90D9', '#50C878', '#FFB347', '#DA70D6',
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F1948A', '#82E0AA',
];

/* ─── Track 인터페이스: 신규 필드를 optional로 추가 ─── */
export interface Track {
  id: string;
  name: string;
  type: TrackType;
  clips: Clip[];
  muted: boolean;
  locked: boolean;
  visible: boolean;
  height: number;
  /* Phase T-2 신규 (optional — 기존 코드 호환) */
  heightPreset?: TrackHeightPreset;
  color?: string;
  solo?: boolean;
  order?: number;
}

/* ========== Project ========== */
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

/* ========== 스킬 레벨 시스템 ========== */
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type EditorTab =
  | 'ai-creator' | 'edit' | 'cut' | 'color'
  | 'audio' | 'effects' | 'export' | 'ai-workflow';

export type PanelId =
  | 'media' | 'preview' | 'timeline' | 'properties'
  | 'effects' | 'audio-mixer' | 'color-wheels' | 'ai' | 'text' | 'audio' | 'sticker' | 'transition';

/* ─── SkillConfig: 신규 필드 optional 추가 ─── */
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
  /* Phase T-2 (optional) */
  showTrackColor?: boolean;
  showTrackHeightPresets?: boolean;
  showTrackReorder?: boolean;
  showTrackDuplicate?: boolean;
  showSoloMode?: boolean;
  showLinkedSelection?: boolean;
}

/* ─── SKILL_CONFIGS 에 Phase T-2 필드 추가 (Optional 적용) ─── */
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
  },
};

/* ========== 에셋→트랙 타입 매핑 ========== */
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

/* ========== 타임라인 엔진 타입 ========== */
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
