export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface TimeRange {
  start: number;
  end: number;
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
}
