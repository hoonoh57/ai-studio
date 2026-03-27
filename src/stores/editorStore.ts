import { create } from 'zustand';
import type {
  Project,
  Track,
  Clip,
  Asset,
  TrackType,
  Transform,
  TrimMode,
  Marker,
  InOutRange,
  Transition,
  WaveformData,
  ThumbnailData,
} from '@/types/project';
import type { SkillLevel, EditorTab, PanelId, SkillConfig } from '@/types/project';
import { SKILL_CONFIGS } from '@/types/project';
import { generateWaveformFromUrl, createEmptyWaveform } from '@/lib/core/waveformGenerator';
import { generateThumbnails, createEmptyThumbnails } from '@/lib/core/thumbnailGenerator';

let uidCounter = 0;
const uid = (prefix: string) => `${prefix}_${Date.now()}_${++uidCounter}`;

interface EditorState {
  // Project data
  project: Project;
  currentTime: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  trimMode: TrimMode;
  markers: Marker[];
  inOut: InOutRange;
  transitions: Transition[];
  selectedClipIds: string[];
  waveformCache: Map<string, WaveformData>;
  thumbnailCache: Map<string, ThumbnailData>;
  zoom: number;
  snapEnabled: boolean;
  snapInterval: number;

  // Skill level & UI state
  skillLevel: SkillLevel;
  activeTab: EditorTab;
  activePanel: PanelId;

  // Project actions
  setProjectName: (name: string) => void;
  addAsset: (asset: Omit<Asset, 'id'>) => Asset;
  removeAsset: (id: string) => void;
  addTrack: (type: TrackType, name?: string) => Track;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  removeTrack: (id: string) => void;
  addClip: (trackId: string, clip: Omit<Clip, 'id' | 'trackId'>) => Clip;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
  updateClips: (updates: { clipId: string; updates: Partial<Clip> }[]) => void;
  removeClip: (clipId: string) => void;
  splitClip: (clipId: string, time: number) => void;

  // Playback actions
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlay: () => void;

  // Selection actions
  selectClip: (clipId: string | null) => void;
  selectTrack: (trackId: string | null) => void;
  toggleMultiSelect: (clipId: string) => void;
  selectClipRange: (fromId: string, toId: string) => void;
  clearMultiSelect: () => void;

  // Timeline Engine State Extension
  setTrimMode: (mode: TrimMode) => void;
  addMarker: (time: number, label?: string, color?: string) => Marker;
  updateMarker: (id: string, updates: Partial<Marker>) => void;
  removeMarker: (id: string) => void;
  setInPoint: (time: number | null) => void;
  setOutPoint: (time: number | null) => void;
  clearInOut: () => void;
  addTransition: (clipAId: string, clipBId: string, type: string, duration: number) => Transition;
  removeTransition: (id: string) => void;
  cacheWaveform: (assetId: string, data: WaveformData) => void;
  cacheThumbnail: (assetId: string, data: ThumbnailData) => void;

  // Timeline UI actions
  setZoom: (zoom: number) => void;
  toggleSnap: () => void;
  recalcDuration: () => void;

  // Skill level actions
  setSkillLevel: (level: SkillLevel) => void;
  setActiveTab: (tab: EditorTab) => void;
  setActivePanel: (panel: PanelId) => void;
  getSkillConfig: () => SkillConfig;

  // Export
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
  // ── Initial state ──
  project: defaultProject,
  currentTime: 0,
  isPlaying: false,
  selectedClipId: null,
  selectedTrackId: null,
  zoom: 1,
  snapEnabled: true,
  snapInterval: 0.5,
  trimMode: 'normal',
  markers: [],
  inOut: { inPoint: null, outPoint: null },
  transitions: [],
  selectedClipIds: [],
  waveformCache: new Map(),
  thumbnailCache: new Map(),
  skillLevel: 'intermediate',
  activeTab: 'edit',
  activePanel: 'media',

  // ── Project actions ──
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

  updateTrack: (trackId, updates) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) =>
          t.id === trackId
            ? { ...t, ...updates }
            : t
        ),
      },
    })),

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

    // Visualization Generation (Issue: Unified Audio/Video waveforms)
    const asset = get().project.assets.find(a => a.id === clip.assetId);
    if (asset) {
      if (asset.type === 'video') {
        (async () => {
          const thumbs = await generateThumbnails(asset.src, asset.id);
          get().cacheThumbnail(asset.id, thumbs || createEmptyThumbnails(asset.id, asset.duration));
          
          // Real Audio Waveform from video track
          const wf = await generateWaveformFromUrl(asset.src, asset.id);
          get().cacheWaveform(asset.id, wf || createEmptyWaveform(asset.id, asset.duration));
        })();
      } else if (asset.type === 'audio') {
        (async () => {
          const wf = await generateWaveformFromUrl(asset.src, asset.id);
          get().cacheWaveform(asset.id, wf || createEmptyWaveform(asset.id, asset.duration));
        })();
      }
    }

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

  updateClips: (updates) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) => {
            const up = updates.find((u) => u.clipId === c.id);
            return up ? { ...c, ...up.updates } : c;
          }),
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

  // ── Playback actions ──
  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  // ── Selection actions ──
  selectClip: (clipId) => set({ selectedClipId: clipId }),
  selectTrack: (trackId) => set({ selectedTrackId: trackId }),

  // ── Timeline Engine State Extension ──
  setTrimMode: (mode) => set({ trimMode: mode }),
  addMarker: (time, label = 'Marker', color = '#ffffff') => {
    const marker: Marker = { id: uid('mk'), time, label, color };
    set((s) => ({ markers: [...s.markers, marker] }));
    return marker;
  },
  updateMarker: (id, updates) =>
    set((s) => ({
      markers: s.markers.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  removeMarker: (id) => set((s) => ({ markers: s.markers.filter((m) => m.id !== id) })),
  setInPoint: (time) => set((s) => ({ inOut: { ...s.inOut, inPoint: time } })),
  setOutPoint: (time) => set((s) => ({ inOut: { ...s.inOut, outPoint: time } })),
  clearInOut: () => set({ inOut: { inPoint: null, outPoint: null } }),
  addTransition: (clipAId, clipBId, type, duration) => {
    const transition: Transition = { id: uid('tx'), clipAId, clipBId, type, duration };
    set((s) => ({ transitions: [...s.transitions, transition] }));
    return transition;
  },
  removeTransition: (id) => set((s) => ({ transitions: s.transitions.filter((t) => t.id !== id) })),
  toggleMultiSelect: (clipId) => set((s) => ({
    selectedClipIds: s.selectedClipIds.includes(clipId)
      ? s.selectedClipIds.filter((id) => id !== clipId)
      : [...s.selectedClipIds, clipId],
  })),
  selectClipRange: (fromId, toId) => {
    const trackClips = get().project.tracks.flatMap((t) => t.clips);
    const p = trackClips.map((c) => c.id);
    const fromIndex = p.indexOf(fromId);
    const toIndex = p.indexOf(toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const slice = fromIndex <= toIndex ? p.slice(fromIndex, toIndex + 1) : p.slice(toIndex, fromIndex + 1);
    set({ selectedClipIds: slice });
  },
  clearMultiSelect: () => set({ selectedClipIds: [] }),
  cacheWaveform: (assetId, data) => set((s) => ({ waveformCache: new Map(s.waveformCache).set(assetId, data) })),
  cacheThumbnail: (assetId, data) => set((s) => ({ thumbnailCache: new Map(s.thumbnailCache).set(assetId, data) })),

  // ── Timeline UI actions ──
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

  // ── Skill level actions ──
  setSkillLevel: (level) => {
    const config = SKILL_CONFIGS[level];
    const currentTab = get().activeTab;
    const currentPanel = get().activePanel;
    set({
      skillLevel: level,
      activeTab: config.visibleTabs.includes(currentTab)
        ? currentTab
        : config.visibleTabs[0],
      activePanel: config.visiblePanels.includes(currentPanel)
        ? currentPanel
        : config.visiblePanels[0],
    });
  },

  setActiveTab: (tab) => {
    const config = SKILL_CONFIGS[get().skillLevel];
    if (config.visibleTabs.includes(tab)) {
      set({ activeTab: tab });
    }
  },

  setActivePanel: (panel) => {
    const config = SKILL_CONFIGS[get().skillLevel];
    if (config.visiblePanels.includes(panel)) {
      set({ activePanel: panel });
    }
  },

  getSkillConfig: () => SKILL_CONFIGS[get().skillLevel],

  // ── Export ──
  exportProject: () => JSON.stringify(get().project, null, 2),
}));
