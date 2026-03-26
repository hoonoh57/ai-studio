import { create } from 'zustand';
import type { Project, Track, Clip, Asset, TrackType, Transform } from '@/types/project';

let uidCounter = 0;
const uid = (prefix: string) => `${prefix}_${Date.now()}_${++uidCounter}`;

interface EditorState {
  project: Project;
  currentTime: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  zoom: number;
  snapEnabled: boolean;
  snapInterval: number;

  // Actions
  setProjectName: (name: string) => void;
  addAsset: (asset: Omit<Asset, 'id'>) => Asset;
  removeAsset: (id: string) => void;
  addTrack: (type: TrackType, name?: string) => Track;
  removeTrack: (id: string) => void;
  addClip: (trackId: string, clip: Omit<Clip, 'id' | 'trackId'>) => Clip;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
  removeClip: (clipId: string) => void;
  splitClip: (clipId: string, time: number) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  selectClip: (clipId: string | null) => void;
  selectTrack: (trackId: string | null) => void;
  setZoom: (zoom: number) => void;
  toggleSnap: () => void;
  recalcDuration: () => void;
  exportProject: () => string;
}

const defaultProject: Project = {
  id: uid('proj'),
  name: 'Untitled Project',
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 60,
  tracks: [
    { id: uid('trk'), name: 'Video 1', type: 'video', height: 48, muted: false, locked: false, visible: true, clips: [] },
    { id: uid('trk'), name: 'Video 2', type: 'video', height: 48, muted: false, locked: false, visible: true, clips: [] },
    { id: uid('trk'), name: 'Audio 1', type: 'audio', height: 40, muted: false, locked: false, visible: true, clips: [] },
    { id: uid('trk'), name: 'Audio 2', type: 'audio', height: 40, muted: false, locked: false, visible: true, clips: [] },
  ],
  assets: [],
};

export const useEditorStore = create<EditorState>((set, get) => ({
  project: defaultProject,
  currentTime: 0,
  isPlaying: false,
  selectedClipId: null,
  selectedTrackId: null,
  zoom: 1,
  snapEnabled: true,
  snapInterval: 0.5,

  setProjectName: (name) =>
    set((s) => ({ project: { ...s.project, name } })),

  addAsset: (assetData) => {
    const asset: Asset = { ...assetData, id: uid('asset') };
    set((s) => ({ project: { ...s.project, assets: [...s.project.assets, asset] } }));
    return asset;
  },

  removeAsset: (id) =>
    set((s) => ({ project: { ...s.project, assets: s.project.assets.filter((a) => a.id !== id) } })),

  addTrack: (type, name) => {
    const track: Track = {
      id: uid('trk'),
      name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${get().project.tracks.filter((t) => t.type === type).length + 1}`,
      type,
      height: type === 'audio' ? 40 : 48,
      muted: false,
      locked: false,
      visible: true,
      clips: [],
    };
    set((s) => ({ project: { ...s.project, tracks: [...s.project.tracks, track] } }));
    return track;
  },

  removeTrack: (id) =>
    set((s) => ({ project: { ...s.project, tracks: s.project.tracks.filter((t) => t.id !== id) } })),

  addClip: (trackId, clipData) => {
    const clip: Clip = { ...clipData, id: uid('clip'), trackId };
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) =>
          t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
        ),
      },
    }));
    get().recalcDuration();
    return clip;
  },

  updateClip: (clipId, updates) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c)),
        })),
      },
    })),

  removeClip: (clipId) => {
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => ({
          ...t,
          clips: t.clips.filter((c) => c.id !== clipId),
        })),
      },
      selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId,
    }));
    get().recalcDuration();
  },

  splitClip: (clipId, time) => {
    const state = get();
    let targetClip: Clip | undefined;
    let trackId = '';
    for (const t of state.project.tracks) {
      const found = t.clips.find((c) => c.id === clipId);
      if (found) { targetClip = found; trackId = t.id; break; }
    }
    if (!targetClip || time <= targetClip.timelineStart || time >= targetClip.timelineEnd) return;

    const sourceOffset = time - targetClip.timelineStart;
    const rightClip: Clip = {
      ...targetClip,
      id: uid('clip'),
      timelineStart: time,
      sourceStart: targetClip.sourceStart + sourceOffset,
    };

    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => {
          if (t.id !== trackId) return t;
          return {
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId ? { ...c, timelineEnd: time, sourceEnd: c.sourceStart + sourceOffset } : c
            ).concat(rightClip),
          };
        }),
      },
    }));
  },

  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  selectClip: (clipId) => set({ selectedClipId: clipId }),
  selectTrack: (trackId) => set({ selectedTrackId: trackId }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),

  recalcDuration: () => {
    const tracks = get().project.tracks;
    let maxEnd = 60;
    for (const t of tracks) {
      for (const c of t.clips) {
        if (c.timelineEnd > maxEnd) maxEnd = c.timelineEnd;
      }
    }
    set((s) => ({ project: { ...s.project, duration: maxEnd + 10 } }));
  },

  exportProject: () => JSON.stringify(get().project, null, 2),
}));
