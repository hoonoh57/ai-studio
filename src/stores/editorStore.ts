/* ─── src/stores/editorStore.ts ─── */
import { create } from 'zustand';
import {
  Project, Track, Clip, Asset, Marker, InOutRange, Transition,
  TrackType, SkillLevel, SkillConfig, SKILL_CONFIGS,
  EditorTab, PanelId, WaveformData, ThumbnailData,
  DEFAULT_TRACK_COLORS, TRACK_HEIGHT_PRESETS, TrackHeightPreset,
  assetTypeToTrackType, TrimMode,
} from '@/types/project';
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
      height: 72,
      heightPreset: 'L' as const,
      color: DEFAULT_TRACK_COLORS.video,
      solo: false,
      order: 0,
    },
    {
      id: uid('trk'), name: 'Video 2', type: 'video' as const,
      clips: [], muted: false, locked: false, visible: true,
      height: 72,
      heightPreset: 'L' as const,
      color: DEFAULT_TRACK_COLORS.video,
      solo: false,
      order: 1,
    },
    {
      id: uid('trk'), name: 'Audio 1', type: 'audio' as const,
      clips: [], muted: false, locked: false, visible: true,
      height: 48,
      heightPreset: 'M' as const,
      color: DEFAULT_TRACK_COLORS.audio,
      solo: false,
      order: 2,
    },
    {
      id: uid('trk'), name: 'Audio 2', type: 'audio' as const,
      clips: [], muted: false, locked: false, visible: true,
      height: 48,
      heightPreset: 'M' as const,
      color: DEFAULT_TRACK_COLORS.audio,
      solo: false,
      order: 3,
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
  addAsset: (asset: Asset) => void;
  removeAsset: (id: string) => void;

  /* 트랙 (Phase T-1) */
  addTrack: (type: TrackType, name?: string) => Track;
  addTrackChecked: (type: TrackType, name?: string) => boolean;
  updateTrack: (id: string, patch: Partial<Track>) => void;
  removeTrack: (id: string) => void;
  moveTrack: (id: string, direction: 'up' | 'down') => void;
  duplicateTrack: (id: string) => void;

  /* ── Phase T-2: Safe Actions ── */
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
  inOut: InOutRange;
  setInPoint: (t: number) => void;
  setOutPoint: (t: number) => void;
  clearInOut: () => void;
  transitions: Transition[];
  addTransition: (t: Transition) => void;
  removeTransition: (id: string) => void;

  /* 캐시 */
  waveformCache: Map<string, WaveformData>;
  thumbnailCache: Map<string, ThumbnailData>;
  setWaveform: (id: string, data: WaveformData) => void;
  setThumbnail: (id: string, data: ThumbnailData) => void;

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

  /* Undo/Redo/Helper */
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
function deepCloneTracks(tracks: Track[]): Track[] { return JSON.parse(JSON.stringify(tracks)); }
function nextTrackName(tracks: Track[], type: TrackType): string {
  const prefix = type.charAt(0).toUpperCase() + type.slice(1);
  const existing = tracks.filter(t => t.type === type).map(t => {
      const m = t.name.match(new RegExp(`^${prefix}\\s+(\\d+)$`));
      return m ? parseInt(m[1], 10) : 0;
  });
  const maxNum = existing.length > 0 ? Math.max(...existing) : 0;
  return `${prefix} ${maxNum + 1}`;
}

export const useEditorStore = create<StoreType>((set, get) => ({
  /* ──── 프로젝트 ──── */
  project: defaultProject,
  setProjectName: (name) => set((s) => ({ project: { ...s.project, name } })),

  /* ──── 에셋 ──── */
  addAsset: (asset) => set((s: any) => ({
    project: { ...s.project, assets: [...s.project.assets, { ...asset, metadata: asset.metadata ?? { addedAt: Date.now(), favorite: false, aiTags: [], collection: 'all' } }] },
  })),
  removeAsset: (id) => set((s: any) => ({
    project: { ...s.project, assets: s.project.assets.filter((a: any) => a.id !== id), tracks: s.project.tracks.map((t: any) => ({ ...t, clips: t.clips.filter((c: any) => c.assetId !== id) })) },
  })),

  /* ──── 트랙 ──── */
  addTrack: (type, name) => {
    let newTrackRef: Track | null = null;
    set((s: any) => {
      const tracks = s.project.tracks;
      const newTrack: Track = {
        id: uid('trk'), name: name || nextTrackName(tracks, type), type, clips: [],
        muted: false, locked: false, visible: true,
        height: type === 'audio' ? 48 : 72,
        heightPreset: type === 'audio' ? 'M' : 'L',
        color: DEFAULT_TRACK_COLORS[type],
        solo: false, order: tracks.length,
      };
      newTrackRef = newTrack;
      return { project: { ...s.project, tracks: [...tracks, newTrack] } };
    });
    return newTrackRef!;
  },
  addTrackChecked: (type, name) => {
    const s = get();
    if (s.project.tracks.length >= (SKILL_CONFIGS[s.skillLevel]?.maxTracks ?? 4)) {
      alert(`최대 트랙 한도에 도달했습니다.`); return false;
    }
    s.pushUndo('트랙 추가'); s.addTrack(type, name); return true;
  },
  updateTrack: (id, patch) => set((s: any) => ({
    project: { ...s.project, tracks: s.project.tracks.map((t: any) => t.id === id ? { ...t, ...patch } : t) },
  })),
  removeTrack: (id) => set((s: any) => ({
    project: { ...s.project, tracks: s.project.tracks.filter((t: any) => t.id !== id).map((t: any, i: any) => ({ ...t, order: i })) },
  })),
  moveTrack: (id, direction) => set((s: any) => {
    const tracks = [...s.project.tracks];
    const idx = tracks.findIndex(t => t.id === id);
    if (idx < 0) return s;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= tracks.length) return s;
    [tracks[idx], tracks[swapIdx]] = [tracks[swapIdx], tracks[idx]];
    return { project: { ...s.project, tracks: tracks.map((t, i) => ({ ...t, order: i })) } };
  }),
  duplicateTrack: (id) => set((s: any) => {
    const src = s.project.tracks.find((t: any) => t.id === id);
    if (!src) return s;
    const newTrack: Track = { ...JSON.parse(JSON.stringify(src)), id: uid('trk'), name: `${src.name} (Duplicate)`, order: s.project.tracks.length, clips: src.clips.map((c: any) => ({ ...JSON.parse(JSON.stringify(c)), id: uid('clip'), linkedClipId: undefined })) };
    return { project: { ...s.project, tracks: [...s.project.tracks, newTrack] } };
  }),

  /* ── Phase T-2: Safe 트랙 액션 ── */
  setTrackColor: (trackId: string, color: string) =>
    set((s: any) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t: any) =>
          t.id === trackId ? { ...t, color } : t
        ),
      },
    })),

  setTrackHeightPreset: (trackId: string, preset: string) => {
    const PRESETS: Record<string, number> = { S: 30, M: 48, L: 72, XL: 120 };
    set((s: any) => {
      const height = PRESETS[preset] ?? s.project.tracks.find((t: any) => t.id === trackId)?.height ?? 48;
      return {
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t: any) =>
            t.id === trackId ? { ...t, height, heightPreset: preset } : t
          ),
        },
      };
    });
  },

  toggleSolo: (trackId: string) =>
    set((s: any) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t: any) =>
          t.id === trackId && t.type === 'audio'
            ? { ...t, solo: !t.solo }
            : t
        ),
      },
    })),

  reorderTracks: (fromIndex, toIndex) =>
    set((s: any) => {
      if (fromIndex === toIndex) return s;
      const tracks = [...s.project.tracks];
      const [moved] = tracks.splice(fromIndex, 1);
      tracks.splice(toIndex, 0, moved);
      return { project: { ...s.project, tracks: tracks.map((t, i) => ({ ...t, order: i })) } };
    }),

  linkClips: (clipIdA, clipIdB) =>
    set((s: any) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t: any) => ({
          ...t,
          clips: t.clips.map((c: any) => {
            if (c.id === clipIdA) return { ...c, linkedClipId: clipIdB };
            if (c.id === clipIdB) return { ...c, linkedClipId: clipIdA };
            return c;
          }),
        })),
      },
    })),

  unlinkClip: (clipId) =>
    set((s: any) => {
      let partnerId: string | undefined;
      for (const t of s.project.tracks) {
        const c = (t as any).clips.find((cl: any) => cl.id === clipId);
        if (c?.linkedClipId) { partnerId = c.linkedClipId; break; }
      }
      return {
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t: any) => ({
            ...t,
            clips: t.clips.map((c: any) => {
              if (c.id === clipId || c.id === partnerId) { return { ...c, linkedClipId: undefined }; }
              return c;
            }),
          })),
        },
      };
    }),

  getEffectiveMuted: (trackId) => {
    const s = get();
    const track = s.project.tracks.find((t: any) => t.id === trackId);
    if (!track) return false;
    if (track.muted) return true;
    const audioTracks = s.project.tracks.filter((t: any) => t.type === 'audio');
    const anySolo = audioTracks.some((t: any) => t.solo);
    if (anySolo && track.type === 'audio' && !track.solo) return true;
    return false;
  },

  /* ──── 클립 ──── */
  addClip: (trackId, clip) => set((s: any) => ({
    project: { ...s.project, tracks: s.project.tracks.map((t: any) => t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t) },
  })),
  updateClip: (clipId, patch) => set((s: any) => ({
    project: { ...s.project, tracks: s.project.tracks.map((t: any) => ({ ...t, clips: t.clips.map((c: any) => c.id === clipId ? { ...c, ...patch } : c) })) },
  })),
  updateClipsBulk: (updates) => set((s: any) => {
    const patchMap = new Map(updates.map(u => [u.clipId, u.patch]));
    return { project: { ...s.project, tracks: s.project.tracks.map((t: any) => ({ ...t, clips: t.clips.map((c: any) => { const p = patchMap.get(c.id); return p ? { ...c, ...p } : c; }) })) } };
  }),
  removeClip: (clipId) => set((s: any) => ({
    project: { ...s.project, tracks: s.project.tracks.map((t: any) => ({ ...t, clips: t.clips.filter((c: any) => c.id !== clipId) })) },
  })),
  splitClip: (clipId, time) => {
    const s = get(); let trackOwner: Track | undefined; let clipOwner: Clip | undefined;
    for (const t of s.project.tracks) { const c = t.clips.find(cl => cl.id === clipId); if (c) { trackOwner = t; clipOwner = c; break; } }
    if (!trackOwner || !clipOwner || trackOwner.locked) return;
    const rel = time - clipOwner.startTime; if (rel <= 0 || rel >= clipOwner.duration) return;
    s.pushUndo('클립 분할');
    const L: Clip = { ...JSON.parse(JSON.stringify(clipOwner)), duration: rel, outPoint: clipOwner.inPoint + rel };
    const R: Clip = { ...JSON.parse(JSON.stringify(clipOwner)), id: uid('clip'), startTime: time, duration: clipOwner.duration - rel, inPoint: clipOwner.inPoint + rel, linkedClipId: undefined };
    set((st: any) => ({ project: { ...st.project, tracks: st.project.tracks.map((t: any) => t.id === trackOwner!.id ? { ...t, clips: [...t.clips.filter((c: any) => c.id !== clipId), L, R] } : t) } }));
  },

  /* ──── 재생/선택 ──── */
  currentTime: 0, isPlaying: false, setCurrentTime: (t) => set({ currentTime: Math.max(0, t) }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  selectedClipId: null, selectClip: (id) => set({ selectedClipId: id }),

  /* ──── 마커/InOut/트랜지션 ──── */
  markers: [], addMarker: (m) => set((s) => ({ markers: [...s.markers, m] })),
  removeMarker: (id) => set((s) => ({ markers: s.markers.filter(m => m.id !== id) })),
  inOut: { inPoint: null, outPoint: null },
  setInPoint: (t) => set((s) => ({ inOut: { ...s.inOut, inPoint: t } })),
  setOutPoint: (t) => set((s) => ({ inOut: { ...s.inOut, outPoint: t } })),
  clearInOut: () => set({ inOut: { inPoint: null, outPoint: null } }),
  transitions: [], addTransition: (t) => set((s) => ({ transitions: [...s.transitions, t] })),
  removeTransition: (id) => set((s) => ({ transitions: s.transitions.filter(t => t.id !== id) })),

  /* ──── 캐시 ──── */
  waveformCache: new Map(), thumbnailCache: new Map(),
  setWaveform: (id, data) => set((s) => ({ waveformCache: new Map(s.waveformCache).set(id, data) })),
  setThumbnail: (id, data) => set((s) => ({ thumbnailCache: new Map(s.thumbnailCache).set(id, data) })),

  /* ──── 타임라인 UI ──── */
  zoom: 1, setZoom: (z) => set({ zoom: Math.max(0.1, Math.min(10, z)) }),
  snapEnabled: true, toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  trimMode: 'normal', setTrimMode: (m) => set({ trimMode: m }),
  recalcDuration: () => set((s) => {
    let max = 10;
    for (const t of s.project.tracks) { for (const c of t.clips) { max = Math.max(max, c.startTime + c.duration); } }
    return { project: { ...s.project, duration: max + 5 } };
  }),

  /* ──── 스킬/탭/패널 ──── */
  skillLevel: 'intermediate',
  setSkillLevel: (level) => set((s) => {
    const config = SKILL_CONFIGS[level];
    const newTab = level === 'beginner' ? 'ai-creator' as EditorTab : (config.enabledTabs.includes(s.activeTab) ? s.activeTab : 'edit' as EditorTab);
    return { skillLevel: level, activeTab: newTab };
  }),
  activeTab: 'edit', setActiveTab: (tab) => set({ activeTab: tab }),
  activePanel: null, setActivePanel: (panel) => set({ activePanel: panel }),

  /* ──── Undo / Helper ──── */
  undoStack: [], redoStack: [],
  pushUndo: (label) => set((s) => ({ undoStack: [...s.undoStack.slice(-49), { label, tracks: deepCloneTracks(s.project.tracks) }], redoStack: [] })),
  undo: () => set((s) => {
    if (s.undoStack.length === 0) return s;
    const stack = [...s.undoStack]; const e = stack.pop()!;
    return { undoStack: stack, redoStack: [...s.redoStack, { label: e.label, tracks: deepCloneTracks(s.project.tracks) }], project: { ...s.project, tracks: e.tracks } };
  }),
  redo: () => set((s) => {
    if (s.redoStack.length === 0) return s;
    const stack = [...s.redoStack]; const e = stack.pop()!;
    return { redoStack: stack, undoStack: [...s.undoStack, { label: e.label, tracks: deepCloneTracks(s.project.tracks) }], project: { ...s.project, tracks: e.tracks } };
  }),
  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,
  getSkillConfig: () => SKILL_CONFIGS[get().skillLevel] || SKILL_CONFIGS.beginner,

  /* ──── 미디어 슬라이스 연동 ──── */
  ...MEDIA_INITIAL_STATE,
  ...createMediaSlice(set as any, get as any),
}));
