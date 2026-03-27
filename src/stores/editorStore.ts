// src/stores/editorStore.ts

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  Project,
  Track,
  Clip,
  Asset,
  TrackType,
  TrimMode,
  Marker,
  InOutRange,
  Transition,
  WaveformData,
  ThumbnailData,
  SkillLevel,
  EditorTab,
  PanelId,
  SkillConfig,
} from '@/types/project';
import { SKILL_CONFIGS } from '@/types/project';
import type { MediaSlice } from '@/stores/mediaSlice';
import {
  MEDIA_INITIAL_STATE,
  createMediaSlice,
  createDefaultMeta,
} from '@/stores/mediaSlice';

let uidCounter = 0;
const uid = (prefix: string) => `${prefix}_${Date.now()}_${++uidCounter}`;

// ── 기존 에디터 상태 (변경 없음) ──
interface EditorCoreState {
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
  skillLevel: SkillLevel;
  activeTab: EditorTab;
  activePanel: PanelId;
}

interface EditorCoreActions {
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
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  selectClip: (clipId: string | null) => void;
  selectTrack: (trackId: string | null) => void;
  toggleMultiSelect: (clipId: string) => void;
  selectClipRange: (fromId: string, toId: string) => void;
  clearMultiSelect: () => void;
  setTrimMode: (mode: TrimMode) => void;
  addMarker: (time: number, label?: string, color?: string) => Marker;
  updateMarker: (id: string, updates: Partial<Marker>) => void;
  removeMarker: (id: string) => void;
  setInPoint: (time: number | null) => void;
  setOutPoint: (time: number | null) => void;
  clearInOut: () => void;
  addTransition: (
    clipAId: string, clipBId: string, type: string, duration: number,
  ) => Transition;
  removeTransition: (id: string) => void;
  cacheWaveform: (assetId: string, data: WaveformData) => void;
  cacheThumbnail: (assetId: string, data: ThumbnailData) => void;
  setZoom: (zoom: number) => void;
  toggleSnap: () => void;
  recalcDuration: () => void;
  setSkillLevel: (level: SkillLevel) => void;
  setActiveTab: (tab: EditorTab) => void;
  setActivePanel: (panel: PanelId) => void;
  getSkillConfig: () => SkillConfig;
  exportProject: () => string;
}

// ── 통합 스토어 타입: 기존 + 미디어 슬라이스 ──
type EditorState = EditorCoreState & EditorCoreActions & MediaSlice;

const defaultProject: Project = {
  id: uid('proj'),
  name: 'Untitled Project',
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 60,
  tracks: [
    {
      id: uid('trk'), name: 'Video 1', type: 'video',
      height: 48, muted: false, locked: false, visible: true, clips: [],
    },
    {
      id: uid('trk'), name: 'Video 2', type: 'video',
      height: 48, muted: false, locked: false, visible: true, clips: [],
    },
    {
      id: uid('trk'), name: 'Audio 1', type: 'audio',
      height: 40, muted: false, locked: false, visible: true, clips: [],
    },
    {
      id: uid('trk'), name: 'Audio 2', type: 'audio',
      height: 40, muted: false, locked: false, visible: true, clips: [],
    },
  ],
  assets: [],
};

export const useEditorStore = create<EditorState>()(
  subscribeWithSelector((set, get) => ({

    // ══════════════════════════════════════
    //  기존 에디터 상태 (변경 없음)
    // ══════════════════════════════════════

    project: defaultProject,
    currentTime: 0,
    isPlaying: false,
    selectedClipId: null,
    selectedTrackId: null,
    zoom: 1,
    snapEnabled: true,
    snapInterval: 0.5,
    trimMode: 'normal' as TrimMode,
    markers: [],
    inOut: { inPoint: null, outPoint: null },
    transitions: [],
    selectedClipIds: [],
    waveformCache: new Map(),
    thumbnailCache: new Map(),
    skillLevel: 'intermediate' as SkillLevel,
    activeTab: 'edit' as EditorTab,
    activePanel: 'media' as PanelId,

    // ══════════════════════════════════════
    //  미디어 슬라이스 초기 상태
    // ══════════════════════════════════════

    ...MEDIA_INITIAL_STATE,

    // ══════════════════════════════════════
    //  미디어 슬라이스 액션
    // ══════════════════════════════════════

    ...createMediaSlice(
      (partial) => {
        if (typeof partial === 'function') {
          set((s) => partial(s as any) as Partial<EditorState>);
        } else {
          set(partial as Partial<EditorState>);
        }
      },
      () => get(),
    ),

    // ══════════════════════════════════════
    //  기존 에디터 액션 (변경 없음)
    // ══════════════════════════════════════

    setProjectName: (name) =>
      set((s) => ({ project: { ...s.project, name } })),

    addAsset: (assetData) => {
      const asset: Asset = { ...assetData, id: uid('asset') };
      set((s) => ({
        project: {
          ...s.project,
          assets: [...s.project.assets, asset],
        },
      }));
      // 미디어 슬라이스: 새 에셋의 기본 메타 자동 생성
      const meta = createDefaultMeta(asset.id, asset.type);
      get().setAssetMeta(asset.id, meta);
      return asset;
    },

    removeAsset: (id) =>
      set((s) => ({
        project: {
          ...s.project,
          assets: s.project.assets.filter((a) => a.id !== id),
        },
        // 미디어 슬라이스: 메타데이터도 함께 제거
        assetMeta: (() => {
          const next = new Map(s.assetMeta);
          next.delete(id);
          return next;
        })(),
      })),

    addTrack: (type, name) => {
      const count = get().project.tracks.filter((t) => t.type === type).length;
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      const track: Track = {
        id: uid('trk'),
        name: name ?? `${label} ${count + 1}`,
        type,
        height: type === 'audio' ? 40 : 48,
        muted: false,
        locked: false,
        visible: true,
        clips: [],
      };
      set((s) => ({
        project: {
          ...s.project,
          tracks: [...s.project.tracks, track],
        },
      }));
      return track;
    },

    updateTrack: (trackId, updates) =>
      set((s) => ({
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) =>
            t.id === trackId ? { ...t, ...updates } : t,
          ),
        },
      })),

    removeTrack: (id) =>
      set((s) => ({
        project: {
          ...s.project,
          tracks: s.project.tracks.filter((t) => t.id !== id),
        },
      })),

    addClip: (trackId, clipData) => {
      const clip: Clip = { ...clipData, id: uid('clip'), trackId };
      set((s) => ({
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) =>
            t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
          ),
        },
      }));
      // 미디어 슬라이스: 사용 횟수 증가
      get().incrementUsage(clip.assetId);
      get().recalcDuration();
      return clip;
    },

    updateClip: (clipId, updates) =>
      set((s) => ({
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId ? { ...c, ...updates } : c,
            ),
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
        selectedClipId:
          s.selectedClipId === clipId ? null : s.selectedClipId,
        selectedClipIds:
          s.selectedClipIds.filter((id) => id !== clipId),
      }));
      get().recalcDuration();
    },

    splitClip: (clipId, time) => {
      const state = get();
      let targetClip: Clip | undefined;
      let trackId = '';

      for (const t of state.project.tracks) {
        const found = t.clips.find((c) => c.id === clipId);
        if (found) {
          targetClip = found;
          trackId = t.id;
          break;
        }
      }

      if (
        targetClip === undefined ||
        time <= targetClip.timelineStart ||
        time >= targetClip.timelineEnd
      ) {
        return;
      }

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
              clips: t.clips
                .map((c) =>
                  c.id === clipId
                    ? {
                        ...c,
                        timelineEnd: time,
                        sourceEnd: c.sourceStart + sourceOffset,
                      }
                    : c,
                )
                .concat(rightClip),
            };
          }),
        },
      }));
    },

    // ── Playback ──
    setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

    // ── Selection ──
    selectClip: (clipId) => set({ selectedClipId: clipId }),
    selectTrack: (trackId) => set({ selectedTrackId: trackId }),

    toggleMultiSelect: (clipId) =>
      set((s) => ({
        selectedClipIds: s.selectedClipIds.includes(clipId)
          ? s.selectedClipIds.filter((id) => id !== clipId)
          : [...s.selectedClipIds, clipId],
      })),

    selectClipRange: (fromId, toId) => {
      const allClipIds = get()
        .project.tracks.flatMap((t) => t.clips)
        .map((c) => c.id);
      const fromIndex = allClipIds.indexOf(fromId);
      const toIndex = allClipIds.indexOf(toId);
      if (fromIndex === -1 || toIndex === -1) return;
      const lo = Math.min(fromIndex, toIndex);
      const hi = Math.max(fromIndex, toIndex);
      set({ selectedClipIds: allClipIds.slice(lo, hi + 1) });
    },

    clearMultiSelect: () => set({ selectedClipIds: [] }),

    // ── Timeline Engine ──
    setTrimMode: (mode) => set({ trimMode: mode }),

    addMarker: (time, label = 'Marker', color = '#ffcc00') => {
      const marker: Marker = { id: uid('mk'), time, label, color };
      set((s) => ({ markers: [...s.markers, marker] }));
      return marker;
    },

    updateMarker: (id, updates) =>
      set((s) => ({
        markers: s.markers.map((m) =>
          m.id === id ? { ...m, ...updates } : m,
        ),
      })),

    removeMarker: (id) =>
      set((s) => ({
        markers: s.markers.filter((m) => m.id !== id),
      })),

    setInPoint: (time) =>
      set((s) => ({ inOut: { ...s.inOut, inPoint: time } })),

    setOutPoint: (time) =>
      set((s) => ({ inOut: { ...s.inOut, outPoint: time } })),

    clearInOut: () =>
      set({ inOut: { inPoint: null, outPoint: null } }),

    addTransition: (clipAId, clipBId, type, duration) => {
      const transition: Transition = {
        id: uid('tx'), clipAId, clipBId, type, duration,
      };
      set((s) => ({ transitions: [...s.transitions, transition] }));
      return transition;
    },

    removeTransition: (id) =>
      set((s) => ({
        transitions: s.transitions.filter((t) => t.id !== id),
      })),

    cacheWaveform: (assetId, data) =>
      set((s) => ({
        waveformCache: new Map(s.waveformCache).set(assetId, data),
      })),

    cacheThumbnail: (assetId, data) =>
      set((s) => ({
        thumbnailCache: new Map(s.thumbnailCache).set(assetId, data),
      })),

    // ── Timeline UI ──
    setZoom: (zoom) =>
      set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),

    toggleSnap: () =>
      set((s) => ({ snapEnabled: !s.snapEnabled })),

    recalcDuration: () => {
      const minDuration = 60;
      const padding = 10;
      const tracks = get().project.tracks;
      let maxEnd = minDuration;
      for (const t of tracks) {
        for (const c of t.clips) {
          if (c.timelineEnd > maxEnd) maxEnd = c.timelineEnd;
        }
      }
      set((s) => ({
        project: { ...s.project, duration: maxEnd + padding },
      }));
    },

    // ── Skill level ──
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
  })),
);
