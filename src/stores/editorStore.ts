/* ─── src/stores/editorStore.ts ─── */
import { create } from 'zustand';
import {
  Project, Track, Clip, Asset, Marker, InOutRange, Transition,
  TrackType, SkillLevel, SkillConfig, SKILL_CONFIGS,
  EditorTab, PanelId, WaveformData, ThumbnailData,
  DEFAULT_TRACK_COLORS, TRACK_HEIGHT_PRESETS, TrackHeightPreset,
  assetTypeToTrackType, TrimMode, BlendMode,
  KeyframeProperty, EasingType, Keyframe, KeyframeTrack,
} from '@/types/project';
import type { EffectInstance, EffectKeyframe } from '@/types/effect';
import { createMediaSlice, MEDIA_INITIAL_STATE, MediaSlice } from './mediaSlice';

/* UID 유틸 */
let _uid = Date.now();
const uid = (prefix = 'id') => `${prefix}_${_uid++}_${Math.random().toString(36).slice(2, 6)}`;

/* ========== Undo/Redo ========== */
const MAX_HISTORY = 50;
interface HistoryEntry { label: string; tracks: Track[]; }

/* ========== Default Project ========== */
const defaultProject: Project = {
  id: uid('proj'),
  name: 'Untitled Project',
  tracks: [
    {
      id: uid('trk'), name: 'Video 1', type: 'video' as const,
      clips: [], muted: false, locked: false, visible: true,
      height: 72, heightPreset: 'L' as const,
      color: DEFAULT_TRACK_COLORS.video, solo: false, order: 0,
    },
    {
      id: uid('trk'), name: 'Video 2', type: 'video' as const,
      clips: [], muted: false, locked: false, visible: true,
      height: 72, heightPreset: 'L' as const,
      color: DEFAULT_TRACK_COLORS.video, solo: false, order: 1,
    },
    {
      id: uid('trk'), name: 'Audio 1', type: 'audio' as const,
      clips: [], muted: false, locked: false, visible: true,
      height: 48, heightPreset: 'M' as const,
      color: DEFAULT_TRACK_COLORS.audio, solo: false, order: 2,
    },
    {
      id: uid('trk'), name: 'Audio 2', type: 'audio' as const,
      clips: [], muted: false, locked: false, visible: true,
      height: 48, heightPreset: 'M' as const,
      color: DEFAULT_TRACK_COLORS.audio, solo: false, order: 3,
    },
  ],
  assets: [],
  duration: 60,
  fps: 30,
  width: 1920,
  height: 1080,
};

/* ========== Store 인터페이스 ========== */
export interface EditorState {
  /* 프로젝트 */
  project: Project;
  setProjectName: (name: string) => void;

  /* 에셋 */
  addAsset: (asset: Omit<Asset, 'id'> & { id?: string }) => Asset;
  removeAsset: (id: string) => void;

  /* 트랙 (Phase T-1) */
  addTrack: (type: TrackType, name?: string) => Track;
  addTrackChecked: (type: TrackType, name?: string) => boolean;
  updateTrack: (id: string, patch: Partial<Track>) => void;
  removeTrack: (id: string) => void;
  moveTrack: (id: string, direction: 'up' | 'down') => void;
  duplicateTrack: (id: string) => void;

  /* Phase T-2: 트랙 고급 액션 */
  setTrackColor: (trackId: string, color: string) => void;
  setTrackHeightPreset: (trackId: string, preset: string) => void;
  toggleSolo: (trackId: string) => void;
  reorderTracks: (fromIndex: number, toIndex: number) => void;
  linkClips: (clipIdA: string, clipIdB: string) => void;
  unlinkClip: (clipId: string) => void;
  getEffectiveMuted: (trackId: string) => boolean;

  /* 클립 */
  addClip: (trackId: string, clip: Clip) => void;
  updateClip: (clipId: string, patch: Partial<Clip>) => void;
  updateClipsBulk: (updates: { clipId: string; patch: Partial<Clip> }[]) => void;
  removeClip: (clipId: string) => void;
  splitClip: (clipId: string, time: number) => void;
  moveClipToTrack: (clipId: string, fromTrackId: string, toTrackId: string) => void;

  /* Phase T-3: 클립 고급 편집 */
  setClipSpeed: (clipId: string, speed: number, reverse?: boolean) => void;
  setClipBlendMode: (clipId: string, mode: BlendMode) => void;
  groupClips: (clipIds: string[]) => void;
  ungroupClips: (groupId: string) => void;
  getClipsInGroup: (groupId: string) => Clip[];

  /* Step 3: 키프레임 */
  addKeyframe: (clipId: string, property: KeyframeProperty, time: number, value: number, easing?: EasingType) => void;
  removeKeyframe: (clipId: string, property: KeyframeProperty, keyframeId: string) => void;
  updateKeyframe: (clipId: string, property: KeyframeProperty, keyframeId: string, patch: Partial<Keyframe>) => void;
  getKeyframeValue: (clipId: string, property: KeyframeProperty, time: number) => number | null;

  // ─── Effect Instance CRUD ───
  effects: EffectInstance[];
  addEffect: (effect: Omit<EffectInstance, 'id'>) => string;
  updateEffect: (effectId: string, patch: Partial<EffectInstance>) => void;
  removeEffect: (effectId: string) => void;
  reorderEffect: (effectId: string, newOrder: number) => void;
  getActiveEffects: (time: number) => EffectInstance[];
  getClipEffects: (clipId: string) => EffectInstance[];

  /* 재생/선택 */
  currentTime: number;
  isPlaying: boolean;
  setCurrentTime: (t: number) => void;
  togglePlay: () => void;
  selectedClipId: string | null;
  selectClip: (id: string | null) => void;

  /* 마커/InOut/트랜지션 */
  markers: Marker[];
  addMarker: (marker: Marker) => void;
  removeMarker: (id: string) => void;
  updateMarker: (id: string, patch: Partial<Marker>) => void;
  inOut: InOutRange;
  setInPoint: (t: number) => void;
  setOutPoint: (t: number) => void;
  clearInOut: () => void;
  transitions: Transition[];
  addTransition: (t: Transition) => void;
  updateTransition: (id: string, patch: Partial<Transition>) => void;
  removeTransition: (id: string) => void;

  /* 캐시 */
  waveformCache: Map<string, WaveformData>;
  thumbnailCache: Map<string, ThumbnailData>;
  setWaveform: (id: string, data: WaveformData) => void;
  setThumbnail: (id: string, data: ThumbnailData) => void;
  cacheWaveform: (id: string, data: WaveformData) => void;
  cacheThumbnail: (id: string, data: ThumbnailData) => void;

  /* 타임라인 UI */
  zoom: number;
  setZoom: (z: number) => void;
  snapEnabled: boolean;
  toggleSnap: () => void;
  trimMode: TrimMode;
  setTrimMode: (m: TrimMode) => void;
  recalcDuration: () => void;

  /* 스킬/탭/패널 */
  skillLevel: SkillLevel;
  setSkillLevel: (level: SkillLevel) => void;
  activeTab: EditorTab;
  setActiveTab: (tab: EditorTab) => void;
  activePanel: PanelId | null;
  setActivePanel: (panel: PanelId | null) => void;

  /* Undo/Redo */
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  pushUndo: (label: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getSkillConfig: () => SkillConfig;
}

export type StoreType = EditorState & MediaSlice;

/* 헬퍼 */
function deepCloneTracks(tracks: Track[]): Track[] {
  return JSON.parse(JSON.stringify(tracks));
}

function nextTrackName(tracks: Track[], type: TrackType): string {
  const prefix = type.charAt(0).toUpperCase() + type.slice(1);
  const existing = tracks.filter(t => t.type === type).map(t => {
    const m = t.name.match(new RegExp(`^${prefix}\\s+(\\d+)$`));
    return m ? parseInt(m[1], 10) : 0;
  });
  const maxNum = existing.length > 0 ? Math.max(...existing) : 0;
  return `${prefix} ${maxNum + 1}`;
}

const TRACK_TYPE_COMPAT: Record<TrackType, readonly TrackType[]> = {
  video:  ['video', 'effect'],
  audio:  ['audio'],
  text:   ['text'],
  effect: ['effect', 'video'],
};

function isClipCompatibleWithTrack(
  clipAssetId: string,
  fromTrack: Track,
  toTrack: Track,
): boolean {
  if (fromTrack.type === toTrack.type) return true;
  const allowed = TRACK_TYPE_COMPAT[fromTrack.type];
  return allowed ? allowed.includes(toTrack.type) : false;
}

export const useEditorStore = create<StoreType>((set, get) => ({
  /* ──── 프로젝트 ──── */
  project: defaultProject,
  setProjectName: (name) => set((s) => ({ project: { ...s.project, name } })),

  /* ──── 에셋 ──── */
  addAsset: (asset) => {
    const newAsset: Asset = {
      ...asset,
      id: asset.id ?? uid('asset'),
      metadata: asset.metadata ?? { addedAt: Date.now(), favorite: false, aiTags: [], collection: 'all' },
    } as Asset;
    set((s) => ({
      project: {
        ...s.project,
        assets: [...s.project.assets, newAsset],
      },
    }));
    return newAsset;
  },
  removeAsset: (id) => set((s) => ({
    project: {
      ...s.project,
      assets: s.project.assets.filter(a => a.id !== id),
      tracks: s.project.tracks.map(t => ({
        ...t,
        clips: t.clips.filter(c => c.assetId !== id),
      })),
    },
  })),

  /* ──── 트랙 ──── */
  addTrack: (type, name) => {
    let newTrackRef: Track | null = null;
    set((s) => {
      const tracks = s.project.tracks;
      const newTrack: Track = {
        id: uid('trk'),
        name: name || nextTrackName(tracks, type),
        type,
        clips: [],
        muted: false,
        locked: false,
        visible: true,
        height: type === 'audio' ? 48 : 72,
        heightPreset: type === 'audio' ? 'M' : 'L',
        color: DEFAULT_TRACK_COLORS[type],
        solo: false,
        order: tracks.length,
      };
      newTrackRef = newTrack;
      return { project: { ...s.project, tracks: [...tracks, newTrack] } };
    });
    return newTrackRef!;
  },

  addTrackChecked: (type, name) => {
    const s = get();
    const maxTracks = SKILL_CONFIGS[s.skillLevel]?.maxTracks ?? 4;
    if (s.project.tracks.length >= maxTracks) {
      alert(`최대 트랙 한도(${maxTracks})에 도달했습니다.`);
      return false;
    }
    s.pushUndo('트랙 추가');
    s.addTrack(type, name);
    return true;
  },

  updateTrack: (id, patch) => set((s) => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map(t => t.id === id ? { ...t, ...patch } : t),
    },
  })),

  removeTrack: (id) => set((s) => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.filter(t => t.id !== id).map((t, i) => ({ ...t, order: i })),
    },
  })),

  moveTrack: (id, direction) => set((s) => {
    const tracks = [...s.project.tracks];
    const idx = tracks.findIndex(t => t.id === id);
    if (idx < 0) return s;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= tracks.length) return s;
    [tracks[idx], tracks[swapIdx]] = [tracks[swapIdx], tracks[idx]];
    return { project: { ...s.project, tracks: tracks.map((t, i) => ({ ...t, order: i })) } };
  }),

  duplicateTrack: (id) => set((s) => {
    const src = s.project.tracks.find(t => t.id === id);
    if (!src) return s;
    const newTrack: Track = {
      ...JSON.parse(JSON.stringify(src)),
      id: uid('trk'),
      name: `${src.name} (Copy)`,
      order: s.project.tracks.length,
      clips: src.clips.map(c => ({
        ...JSON.parse(JSON.stringify(c)),
        id: uid('clip'),
        linkedClipId: undefined,
      })),
    };
    return { project: { ...s.project, tracks: [...s.project.tracks, newTrack] } };
  }),

  /* ── Phase T-2: 트랙 고급 액션 ── */
  setTrackColor: (trackId, color) => set((s) => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map(t => t.id === trackId ? { ...t, color } : t),
    },
  })),

  setTrackHeightPreset: (trackId, preset) => {
    const PRESETS: Record<string, number> = { S: 30, M: 48, L: 72, XL: 120 };
    set((s) => {
      const height = PRESETS[preset] ?? s.project.tracks.find(t => t.id === trackId)?.height ?? 48;
      return {
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t =>
            t.id === trackId ? { ...t, height, heightPreset: preset as TrackHeightPreset } : t
          ),
        },
      };
    });
  },

  toggleSolo: (trackId) => set((s) => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map(t =>
        t.id === trackId && t.type === 'audio' ? { ...t, solo: !t.solo } : t
      ),
    },
  })),

  reorderTracks: (fromIndex, toIndex) => set((s) => {
    if (fromIndex === toIndex) return s;
    const tracks = [...s.project.tracks];
    const [moved] = tracks.splice(fromIndex, 1);
    tracks.splice(toIndex, 0, moved);
    return { project: { ...s.project, tracks: tracks.map((t, i) => ({ ...t, order: i })) } };
  }),

  linkClips: (clipIdA, clipIdB) => set((s) => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c => {
          if (c.id === clipIdA) return { ...c, linkedClipId: clipIdB };
          if (c.id === clipIdB) return { ...c, linkedClipId: clipIdA };
          return c;
        }),
      })),
    },
  })),

  unlinkClip: (clipId) => set((s) => {
    let partnerId: string | undefined;
    for (const t of s.project.tracks) {
      const c = t.clips.find(cl => cl.id === clipId);
      if (c?.linkedClipId) { partnerId = c.linkedClipId; break; }
    }
    return {
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => {
            if (c.id === clipId || c.id === partnerId) return { ...c, linkedClipId: undefined };
            return c;
          }),
        })),
      },
    };
  }),

  getEffectiveMuted: (trackId) => {
    const s = get();
    const track = s.project.tracks.find(t => t.id === trackId);
    if (!track) return false;
    if (track.muted) return true;
    const audioTracks = s.project.tracks.filter(t => t.type === 'audio');
    const anySolo = audioTracks.some(t => t.solo);
    if (anySolo && track.type === 'audio' && !track.solo) return true;
    return false;
  },

  /* ──── 클립 ──── */
  addClip: (trackId, clip) => set((s) => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map(t =>
        t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
      ),
    },
  })),

  updateClip: (clipId, patch) => set((s) => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c => c.id === clipId ? { ...c, ...patch } : c),
      })),
    },
  })),

  updateClipsBulk: (updates) => set((s) => {
    const patchMap = new Map(updates.map(u => [u.clipId, u.patch]));
    return {
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => {
            const p = patchMap.get(c.id);
            return p ? { ...c, ...p } : c;
          }),
        })),
      },
    };
  }),

  removeClip: (clipId) => set((s) => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map(t => ({
        ...t,
        clips: t.clips.filter(c => c.id !== clipId),
      })),
    },
  })),

  splitClip: (clipId, time) => {
    const s = get();
    let trackOwner: Track | undefined;
    let clipOwner: Clip | undefined;
    for (const t of s.project.tracks) {
      const c = t.clips.find(cl => cl.id === clipId);
      if (c) { trackOwner = t; clipOwner = c; break; }
    }
    if (!trackOwner || !clipOwner || trackOwner.locked) return;
    const rel = time - clipOwner.startTime;
    if (rel <= 0 || rel >= clipOwner.duration) return;
    s.pushUndo('클립 분할');
    const L: Clip = {
      ...JSON.parse(JSON.stringify(clipOwner)),
      duration: rel,
      outPoint: clipOwner.inPoint + rel,
    };
    const R: Clip = {
      ...JSON.parse(JSON.stringify(clipOwner)),
      id: uid('clip'),
      startTime: time,
      duration: clipOwner.duration - rel,
      inPoint: clipOwner.inPoint + rel,
      linkedClipId: undefined,
    };
    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t =>
          t.id === trackOwner!.id
            ? { ...t, clips: [...t.clips.filter(c => c.id !== clipId), L, R] }
            : t
        ),
      },
    }));
  },

  moveClipToTrack: (clipId, fromTrackId, toTrackId) => {
    if (fromTrackId === toTrackId) return;
    const s = get();
    const fromTrack = s.project.tracks.find(t => t.id === fromTrackId);
    const toTrack = s.project.tracks.find(t => t.id === toTrackId);
    if (!fromTrack || !toTrack) return;
    if (!isClipCompatibleWithTrack(clipId, fromTrack, toTrack)) {
      console.warn(`[moveClipToTrack] 호환 불가: ${fromTrack.type} 트랙의 클립을 ${toTrack.type} 트랙으로 이동할 수 없습니다.`);
      return;
    }
    set((s) => {
      let movedClip: Clip | undefined;
      const tracksAfterRemove = s.project.tracks.map(t => {
        if (t.id === fromTrackId) {
          const clip = t.clips.find(c => c.id === clipId);
          if (clip) movedClip = { ...clip };
          return { ...t, clips: t.clips.filter(c => c.id !== clipId) };
        }
        return t;
      });
      if (!movedClip) return s;
      const tracksAfterAdd = tracksAfterRemove.map(t => {
        if (t.id === toTrackId) {
          return { ...t, clips: [...t.clips, movedClip!] };
        }
        return t;
      });
      return { project: { ...s.project, tracks: tracksAfterAdd } };
    });
  },

  /* ── Phase T-3: 클립 고급 편집 ── */

  /* T-3.1: 속도 변경 — duration 자동 재계산 */
  setClipSpeed: (clipId, speed, reverse) => {
    const s = get();
    let originalClip: Clip | undefined;
    for (const t of s.project.tracks) {
      const c = t.clips.find(cl => cl.id === clipId);
      if (c) { originalClip = c; break; }
    }
    if (!originalClip) return;

    const clampedSpeed = Math.max(0.1, Math.min(10, speed));
    /* 원본 소스 길이 = (outPoint - inPoint) / 기존 speed */
    const sourceDuration = (originalClip.outPoint - originalClip.inPoint) / originalClip.speed;
    const newDuration = sourceDuration / clampedSpeed;

    s.pushUndo('속도 변경');
    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c =>
            c.id === clipId
              ? {
                  ...c,
                  speed: clampedSpeed,
                  duration: newDuration,
                  reverse: reverse ?? c.reverse ?? false,
                }
              : c
          ),
        })),
      },
    }));
  },

  /* T-3.2: 블렌드 모드 변경 */
  setClipBlendMode: (clipId, mode) => {
    get().pushUndo('블렌드 모드 변경');
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c =>
            c.id === clipId ? { ...c, blendMode: mode } : c
          ),
        })),
      },
    }));
  },

  /* T-3.3: 클립 그룹핑 */
  groupClips: (clipIds) => {
    if (clipIds.length < 2) return;
    const groupId = uid('grp');
    get().pushUndo('클립 그룹');
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c =>
            clipIds.includes(c.id) ? { ...c, groupId } : c
          ),
        })),
      },
    }));
  },

  ungroupClips: (groupId) => {
    get().pushUndo('그룹 해제');
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c =>
            c.groupId === groupId ? { ...c, groupId: undefined } : c
          ),
        })),
      },
    }));
  },

  getClipsInGroup: (groupId) => {
    const clips: Clip[] = [];
    for (const t of get().project.tracks) {
      for (const c of t.clips) {
        if (c.groupId === groupId) clips.push(c);
      }
    }
    return clips;
  },

  /* ── Step 3: 키프레임 ── */
  addKeyframe: (clipId, property, time, value, easing = 'linear') => {
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => {
            if (c.id !== clipId) return c;
            const tracks = c.keyframeTracks ? [...c.keyframeTracks] : [];
            let kfTrack = tracks.find(kt => kt.property === property);
            if (!kfTrack) {
              kfTrack = { property, keyframes: [], enabled: true };
              tracks.push(kfTrack);
            }
            const newKf: Keyframe = {
              id: uid('kf'),
              time,
              value,
              easing,
            };
            kfTrack.keyframes = [...kfTrack.keyframes, newKf].sort((a, b) => a.time - b.time);
            return { ...c, keyframeTracks: tracks.map(kt => kt.property === property ? { ...kfTrack! } : kt) };
          }),
        })),
      },
    }));
  },

  removeKeyframe: (clipId, property, keyframeId) => {
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => {
            if (c.id !== clipId || !c.keyframeTracks) return c;
            return {
              ...c,
              keyframeTracks: c.keyframeTracks.map(kt =>
                kt.property === property
                  ? { ...kt, keyframes: kt.keyframes.filter(kf => kf.id !== keyframeId) }
                  : kt
              ).filter(kt => kt.keyframes.length > 0),
            };
          }),
        })),
      },
    }));
  },

  updateKeyframe: (clipId, property, keyframeId, patch) => {
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => {
            if (c.id !== clipId || !c.keyframeTracks) return c;
            return {
              ...c,
              keyframeTracks: c.keyframeTracks.map(kt =>
                kt.property === property
                  ? {
                      ...kt,
                      keyframes: kt.keyframes
                        .map(kf => kf.id === keyframeId ? { ...kf, ...patch } : kf)
                        .sort((a, b) => a.time - b.time),
                    }
                  : kt
              ),
            };
          }),
        })),
      },
    }));
  },

  getKeyframeValue: (clipId, property, time) => {
    const s = get();
    for (const t of s.project.tracks) {
      const clip = t.clips.find(c => c.id === clipId);
      if (!clip?.keyframeTracks) continue;
      const kfTrack = clip.keyframeTracks.find(kt => kt.property === property && kt.enabled);
      if (!kfTrack || kfTrack.keyframes.length === 0) return null;
      const kfs = kfTrack.keyframes;
      if (time <= kfs[0].time) return kfs[0].value;
      if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;
      for (let i = 0; i < kfs.length - 1; i++) {
        if (time >= kfs[i].time && time <= kfs[i + 1].time) {
          const t0 = kfs[i].time, t1 = kfs[i + 1].time;
          const v0 = kfs[i].value, v1 = kfs[i + 1].value;
          const progress = (time - t0) / (t1 - t0);
          return v0 + (v1 - v0) * progress; // linear interpolation (이징은 3-E에서 확장)
        }
      }
      return null;
    }
    return null;
  },

  // ─── Effect Instance CRUD ───
  effects: [] as EffectInstance[],
  addEffect: (effect) => {
    const id = uid('fx');
    set(state => ({
      effects: [...state.effects, { ...effect, id } as EffectInstance]
        .sort((a, b) => a.order - b.order),
    }));
    return id;
  },

  updateEffect: (effectId, patch) => {
    set(state => ({
      effects: state.effects.map(e =>
        e.id === effectId ? { ...e, ...patch } : e
      ),
    }));
  },

  removeEffect: (effectId) => {
    set(state => ({
      effects: state.effects.filter(e => e.id !== effectId),
    }));
  },

  reorderEffect: (effectId, newOrder) => {
    set(state => ({
      effects: state.effects
        .map(e => e.id === effectId ? { ...e, order: newOrder } : e)
        .sort((a, b) => a.order - b.order),
    }));
  },

  getActiveEffects: (time) => {
    return get().effects.filter(e =>
      e.enabled && time >= e.startTime && time < e.startTime + e.duration
    ).sort((a, b) => a.order - b.order);
  },

  getClipEffects: (clipId) => {
    return get().effects.filter(e =>
      e.target.type === 'clip' && e.target.clipId === clipId
    ).sort((a, b) => a.order - b.order);
  },

  /* ──── 재생/선택 ──── */
  currentTime: 0,
  isPlaying: false,
  setCurrentTime: (t) => set({ currentTime: Math.max(0, t) }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  selectedClipId: null,
  selectClip: (id) => set({ selectedClipId: id }),

  /* ──── 마커/InOut/트랜지션 ──── */
  markers: [],
  addMarker: (m) => set((s) => ({ markers: [...s.markers, m] })),
  removeMarker: (id) => set((s) => ({ markers: s.markers.filter(m => m.id !== id) })),
  updateMarker: (id, patch) => set((s) => ({
    markers: s.markers.map(m => m.id === id ? { ...m, ...patch } : m),
  })),

  inOut: { inPoint: null, outPoint: null },
  setInPoint: (t) => set((s) => ({ inOut: { ...s.inOut, inPoint: t } })),
  setOutPoint: (t) => set((s) => ({ inOut: { ...s.inOut, outPoint: t } })),
  clearInOut: () => set({ inOut: { inPoint: null, outPoint: null } }),
  transitions: [],
  addTransition: (t) => set((s) => ({ transitions: [...s.transitions, t] })),
  updateTransition: (id, patch) => set((s) => ({
    transitions: s.transitions.map(t => t.id === id ? { ...t, ...patch } : t)
  })),
  removeTransition: (id) => set((s) => ({ transitions: s.transitions.filter(t => t.id !== id) })),

  /* ──── 캐시 ──── */
  waveformCache: new Map(),
  thumbnailCache: new Map(),
  setWaveform: (id, data) => set((s) => ({ waveformCache: new Map(s.waveformCache).set(id, data) })),
  setThumbnail: (id, data) => set((s) => ({ thumbnailCache: new Map(s.thumbnailCache).set(id, data) })),
  cacheWaveform: (id, data) => set((s) => ({ waveformCache: new Map(s.waveformCache).set(id, data) })),
  cacheThumbnail: (id, data) => set((s) => ({ thumbnailCache: new Map(s.thumbnailCache).set(id, data) })),

  /* ──── 타임라인 UI ──── */
  zoom: 1,
  setZoom: (z) => set({ zoom: Math.max(0.1, Math.min(10, z)) }),
  snapEnabled: true,
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  trimMode: 'normal',
  setTrimMode: (m) => set({ trimMode: m }),
  recalcDuration: () => set((s) => {
    let max = 0;
    for (const t of s.project.tracks) {
      for (const c of t.clips) {
        max = Math.max(max, c.startTime + c.duration);
      }
    }
    // 타임라인에 약간의 여유(0.5초)만 추가, 빈 화면 최소화
    return { project: { ...s.project, duration: Math.max(10, max + 0.5) } };
  }),

  /* ──── 스킬/탭/패널 ──── */
  skillLevel: 'intermediate',
  setSkillLevel: (level) => set((s) => {
    const config = SKILL_CONFIGS[level];
    const newTab = level === 'beginner'
      ? 'ai-creator' as EditorTab
      : (config.enabledTabs.includes(s.activeTab) ? s.activeTab : 'edit' as EditorTab);
    return { skillLevel: level, activeTab: newTab };
  }),
  activeTab: 'edit',
  setActiveTab: (tab) => set({ activeTab: tab }),
  activePanel: null,
  setActivePanel: (panel) => set({ activePanel: panel }),

  /* ──── Undo/Redo ──── */
  undoStack: [],
  redoStack: [],
  pushUndo: (label) => set((s) => ({
    undoStack: [...s.undoStack.slice(-(MAX_HISTORY - 1)), { label, tracks: deepCloneTracks(s.project.tracks) }],
    redoStack: [],
  })),
  undo: () => set((s) => {
    if (s.undoStack.length === 0) return s;
    const stack = [...s.undoStack];
    const e = stack.pop()!;
    return {
      undoStack: stack,
      redoStack: [...s.redoStack, { label: e.label, tracks: deepCloneTracks(s.project.tracks) }],
      project: { ...s.project, tracks: e.tracks },
    };
  }),
  redo: () => set((s) => {
    if (s.redoStack.length === 0) return s;
    const stack = [...s.redoStack];
    const e = stack.pop()!;
    return {
      redoStack: stack,
      undoStack: [...s.undoStack, { label: e.label, tracks: deepCloneTracks(s.project.tracks) }],
      project: { ...s.project, tracks: e.tracks },
    };
  }),
  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,
  getSkillConfig: () => SKILL_CONFIGS[get().skillLevel] || SKILL_CONFIGS.beginner,

  ...MEDIA_INITIAL_STATE,
  ...createMediaSlice(set, get),
}));
