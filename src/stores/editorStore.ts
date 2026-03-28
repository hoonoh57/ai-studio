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
import type { TextContent, TextStyle, WordTiming } from '@/types/textClip';
import { DEFAULT_TEXT_STYLE } from '@/types/textClip';
import type { SrtEntry } from '@/lib/core/srtParser';

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
  /* ★ Phase B1: MP4 드롭 시 비디오+오디오 클립 쌍 생성 */
  addClipFromAsset: (assetId: string, trackId: string, startTime: number) => void;
  /* ★ Phase B1: 오디오 분리 (초급 UI에서 사용) */
  separateAudio: (clipId: string) => void;

  /* ★ Phase B2: 편집 기본 동작 */
  rippleDelete: (clipId: string) => void;
  closeGap: (trackId: string) => void;
  closeAllGaps: () => void;
  clipboard: Clip[] | null;
  copyClip: () => void;
  pasteClip: () => void;
  duplicateClip: (clipId: string, newStartTime?: number) => void;
  toggleClipDisabled: (clipId: string) => void;
  freezeFrame: (clipId: string, time: number, duration?: number) => void;
  shuttleSpeed: number;
  setShuttleSpeed: (speed: number) => void;

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
  /* Hub 상태 */
  activeModuleId: string | null;
  setActiveModuleId: (id: string) => void;
  isHubOpen: boolean;
  setHubOpen: (open: boolean) => void;

  /* ═══ B4: 텍스트/자막 ═══ */
  addTextClip: (trackId: string | null, text: string, startTime: number,
                duration?: number, stylePatch?: Partial<TextStyle>) => void;
  updateTextContent: (clipId: string, text: string) => void;
  updateTextStyle: (clipId: string, stylePatch: Partial<TextStyle>) => void;
  importSrt: (entries: SrtEntry[]) => void;
  exportSrt: () => SrtEntry[];
  applyStyleToAllTextClips: (stylePatch: Partial<TextStyle>) => void;
  /* ═══ B4-7: 워드 타이밍 ═══ */
  updateWordTimings: (clipId: string, wordTimings: WordTiming[]) => void;
  generateEvenWordTimings: (clipId: string) => void;
  clearWordTimings: (clipId: string) => void;
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
  video: ['video', 'effect'],
  audio: ['audio'],
  text: ['text'],
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

  /* ★ Phase B1: MP4 드롭 시 비디오+오디오 클립 쌍 생성 */
  addClipFromAsset: (assetId, trackId, startTime) => {
    const s = get();
    const asset = s.project.assets.find(a => a.id === assetId);
    if (!asset) return;

    const skillConfig = SKILL_CONFIGS[s.skillLevel];

    // ── 비디오 클립 생성 ──
    const videoClipId = uid('clip');
    const videoClip: Clip = {
      id: videoClipId,
      assetId: asset.id,
      startTime,
      duration: asset.duration,
      inPoint: 0,
      outPoint: asset.duration,
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      filters: [],
      blendMode: 'normal',
      opacity: 1,
      volume: 1,
      speed: 1,
    };

    // ── 오디오가 있는 비디오 에셋이면 오디오 클립도 생성 ──
    if (asset.type === 'video' && asset.hasAudio) {
      const audioClipId = uid('clip');
      const audioClip: Clip = {
        id: audioClipId,
        assetId: asset.id,
        startTime,
        duration: asset.duration,
        inPoint: 0,
        outPoint: asset.duration,
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        filters: [],
        blendMode: 'normal',
        opacity: 1,
        volume: 1,
        speed: 1,
        linkedClipId: videoClipId,
      };

      // 비디오 클립에 링크 설정
      videoClip.linkedClipId = audioClipId;

      // 오디오 트랙 찾기 또는 생성
      let audioTrack = s.project.tracks.find(t => t.type === 'audio');
      let newTracks = [...s.project.tracks];

      if (!audioTrack) {
        audioTrack = {
          id: uid('trk'),
          name: 'Audio 1',
          type: 'audio' as const,
          clips: [],
          muted: false,
          locked: false,
          visible: true,
          height: 48,
          heightPreset: 'M' as TrackHeightPreset,
          color: DEFAULT_TRACK_COLORS.audio,
          solo: false,
          order: newTracks.length,
        };
        newTracks = [...newTracks, audioTrack];
      }

      const audioTrackId = audioTrack.id;

      // ★ 스킬 레벨에 따라 오디오 트랙 표시/숨김
      // 초급: 오디오 트랙은 visible=false로 (엔진에는 존재, UI만 숨김)
      if (!skillConfig.showLinkedAudioTrack) {
        newTracks = newTracks.map(t =>
          t.id === audioTrackId && t.type === 'audio'
            ? { ...t, visible: false }
            : t
        );
      }

      s.pushUndo('클립 추가 (비디오+오디오)');
      set((st) => ({
        project: {
          ...st.project,
          tracks: newTracks.map(t => {
            if (t.id === trackId) {
              return { ...t, clips: [...t.clips, videoClip] };
            }
            if (t.id === audioTrackId) {
              return { ...t, clips: [...t.clips, audioClip] };
            }
            return t;
          }),
        },
      }));
    } else {
      // ── 오디오 없는 에셋 또는 오디오 전용 에셋 ──
      s.pushUndo('클립 추가');
      set((st) => ({
        project: {
          ...st.project,
          tracks: st.project.tracks.map(t =>
            t.id === trackId
              ? { ...t, clips: [...t.clips, videoClip] }
              : t
          ),
        },
      }));
    }

    // duration 재계산
    get().recalcDuration();
  },

  /* ★ Phase B1: 오디오 분리 (초급 UI에서 '오디오 분리' 메뉴) */
  separateAudio: (clipId) => {
    const s = get();
    let clip: Clip | undefined;
    for (const t of s.project.tracks) {
      clip = t.clips.find(c => c.id === clipId);
      if (clip) break;
    }
    if (!clip?.linkedClipId) return;

    // 오디오 클립이 있는 트랙을 visible=true로 변경
    s.pushUndo('오디오 분리');
    const linkedId = clip.linkedClipId;
    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t => {
          const hasLinkedClip = t.clips.some(c => c.id === linkedId);
          if (hasLinkedClip && !t.visible) {
            return { ...t, visible: true };
          }
          return t;
        }),
      },
    }));
    // 링크 해제
    get().unlinkClip(clipId);
  },

  /* ═══ Phase B2: 편집 기본 동작 ═══ */

  /* B2-1: 리플 삭제 */
  rippleDelete: (clipId) => {
    const s = get();
    let targetTrack: Track | undefined;
    let targetClip: Clip | undefined;
    for (const t of s.project.tracks) {
      const c = t.clips.find(cl => cl.id === clipId);
      if (c) {
        targetTrack = t;
        targetClip = c;
        break;
      }
    }
    if (!targetTrack || !targetClip || targetTrack.locked) return;

    const clipEnd = targetClip.startTime + targetClip.duration;
    const gap = targetClip.duration;

    // 링크된 클립 정보
    let linkedId: string | undefined;
    let linkedTrackId: string | undefined;
    let linkedClipEnd = 0;
    let linkedGap = 0;
    if (targetClip.linkedClipId) {
      linkedId = targetClip.linkedClipId;
      for (const t of s.project.tracks) {
        const lc = t.clips.find(c => c.id === linkedId);
        if (lc) {
          linkedTrackId = t.id;
          linkedClipEnd = lc.startTime + lc.duration;
          linkedGap = lc.duration;
          break;
        }
      }
    }

    s.pushUndo('리플 삭제');
    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t => {
          if (t.id === targetTrack!.id) {
            return {
              ...t,
              clips: t.clips
                .filter(c => c.id !== clipId)
                .map(c => (c.startTime >= clipEnd ? { ...c, startTime: c.startTime - gap } : c)),
            };
          }
          if (linkedId && linkedTrackId && t.id === linkedTrackId) {
            return {
              ...t,
              clips: t.clips
                .filter(c => c.id !== linkedId)
                .map(c => (c.startTime >= linkedClipEnd ? { ...c, startTime: c.startTime - linkedGap } : c)),
            };
          }
          return t;
        }),
      },
    }));
    get().selectClip(null);
    get().recalcDuration();
  },

  /* B2-2: 갭 닫기 */
  closeGap: (trackId) => {
    const s = get();
    const track = s.project.tracks.find(t => t.id === trackId);
    if (!track || track.locked || track.clips.length === 0) return;

    const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime);
    const newClips: Clip[] = [];
    let cursor = 0;
    for (const clip of sorted) {
      newClips.push({ ...clip, startTime: cursor });
      cursor += clip.duration;
    }

    // 변화가 없으면 스킵
    const changed = sorted.some((c, i) => c.startTime !== newClips[i].startTime);
    if (!changed) return;

    s.pushUndo('갭 닫기');
    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t =>
          (t.id === trackId ? { ...t, clips: newClips } : t)),
      },
    }));
    get().recalcDuration();
  },

  closeAllGaps: () => {
    const s = get();
    s.pushUndo('모든 갭 닫기');
    for (const track of s.project.tracks) {
      if (!track.locked && track.clips.length > 0) {
        get().closeGap(track.id);
      }
    }
  },

  /* B2-3: 클립보드 */
  clipboard: null,

  copyClip: () => {
    const s = get();
    if (!s.selectedClipId) return;

    const clips: Clip[] = [];
    for (const t of s.project.tracks) {
      const c = t.clips.find(cl => cl.id === s.selectedClipId);
      if (c) {
        clips.push(JSON.parse(JSON.stringify(c)));
        if (c.linkedClipId) {
          for (const t2 of s.project.tracks) {
            const linked = t2.clips.find(cl => cl.id === c.linkedClipId);
            if (linked) {
              clips.push(JSON.parse(JSON.stringify(linked)));
              break;
            }
          }
        }
        break;
      }
    }
    if (clips.length > 0) set({ clipboard: clips });
  },

  pasteClip: () => {
    const s = get();
    if (!s.clipboard || s.clipboard.length === 0) return;

    s.pushUndo('클립 붙여넣기');

    const primary = s.clipboard[0];
    const linked = s.clipboard.length > 1 ? s.clipboard[1] : null;

    const newPrimaryId = uid('clip');
    const newLinkedId = linked ? uid('clip') : undefined;

    // 비디오 트랙 찾기
    let videoTrackId: string | undefined;
    for (const t of s.project.tracks) {
      if (t.type === 'video' && !t.locked) {
        videoTrackId = t.id;
        break;
      }
    }

    // 오디오 트랙 찾기
    let audioTrackId: string | undefined;
    if (linked) {
      for (const t of s.project.tracks) {
        if (t.type === 'audio' && !t.locked) {
          audioTrackId = t.id;
          break;
        }
      }
    }

    // 비디오 트랙이 없으면 아무 잠금 안 된 트랙
    if (!videoTrackId) {
      const any = s.project.tracks.find(t => !t.locked);
      videoTrackId = any?.id;
    }
    if (!videoTrackId) return;

    const newPrimary: Clip = {
      ...JSON.parse(JSON.stringify(primary)),
      id: newPrimaryId,
      startTime: s.currentTime,
      linkedClipId: newLinkedId,
    };

    let newLinked: Clip | undefined;
    if (linked && audioTrackId && newLinkedId) {
      newLinked = {
        ...JSON.parse(JSON.stringify(linked)),
        id: newLinkedId,
        startTime: s.currentTime,
        linkedClipId: newPrimaryId,
      };
    } else if (newPrimary.linkedClipId) {
      // 오디오 트랙이 없으면 링크 해제
      newPrimary.linkedClipId = undefined;
    }

    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t => {
          if (t.id === videoTrackId) {
            return { ...t, clips: [...t.clips, newPrimary] };
          }
          if (newLinked && t.id === audioTrackId) {
            return { ...t, clips: [...t.clips, newLinked!] };
          }
          return t;
        }),
      },
    }));
    get().selectClip(newPrimaryId);
    get().recalcDuration();
  },

  /* B2-4: 클립 복제 — 링크된 오디오 포함 */
  duplicateClip: (clipId, newStartTime) => {
    const s = get();
    let targetTrack: Track | undefined;
    let targetClip: Clip | undefined;
    for (const t of s.project.tracks) {
      const c = t.clips.find(cl => cl.id === clipId);
      if (c) {
        targetTrack = t;
        targetClip = c;
        break;
      }
    }
    if (!targetTrack || !targetClip) return;

    s.pushUndo('클립 복제');

    const newPrimaryId = uid('clip');
    const startAt = newStartTime ?? targetClip.startTime + targetClip.duration;

    // 링크된 클립 찾기
    let linkedClip: Clip | undefined;
    let linkedTrack: Track | undefined;
    if (targetClip.linkedClipId) {
      for (const t of s.project.tracks) {
        const lc = t.clips.find(c => c.id === targetClip!.linkedClipId);
        if (lc) {
          linkedClip = lc;
          linkedTrack = t;
          break;
        }
      }
    }

    const newLinkedId = linkedClip ? uid('clip') : undefined;

    const newPrimary: Clip = {
      ...JSON.parse(JSON.stringify(targetClip)),
      id: newPrimaryId,
      startTime: startAt,
      linkedClipId: newLinkedId,
    };

    let newLinked: Clip | undefined;
    if (linkedClip && linkedTrack && newLinkedId) {
      newLinked = {
        ...JSON.parse(JSON.stringify(linkedClip)),
        id: newLinkedId,
        startTime: startAt,
        linkedClipId: newPrimaryId,
      };
    }

    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t => {
          if (t.id === targetTrack!.id) {
            return { ...t, clips: [...t.clips, newPrimary] };
          }
          if (newLinked && linkedTrack && t.id === linkedTrack.id) {
            return { ...t, clips: [...t.clips, newLinked!] };
          }
          return t;
        }),
      },
    }));
    get().selectClip(newPrimaryId);
    get().recalcDuration();
  },

  /* B2-5: 클립 비활성화 토글 */
  toggleClipDisabled: (clipId) => {
    const s = get();
    s.pushUndo('클립 비활성화 토글');
    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => (c.id === clipId ? { ...c, disabled: !c.disabled } : c)),
        })),
      },
    }));
  },

  /* B2-6: 프리즈 프레임 */
  freezeFrame: (clipId, time, duration = 5) => {
    const s = get();
    let targetTrack: Track | undefined;
    let targetClip: Clip | undefined;
    for (const t of s.project.tracks) {
      const c = t.clips.find(cl => cl.id === clipId);
      if (c) {
        targetTrack = t;
        targetClip = c;
        break;
      }
    }
    if (!targetTrack || !targetClip) return;

    const relTime = time - targetClip.startTime;
    if (relTime < 0 || relTime >= targetClip.duration) return;

    const freezeInPoint = targetClip.inPoint + relTime;

    s.pushUndo('프리즈 프레임');
    const freezeClip: Clip = {
      id: uid('clip'),
      assetId: targetClip.assetId,
      startTime: targetClip.startTime + targetClip.duration,
      duration,
      inPoint: freezeInPoint,
      outPoint: freezeInPoint + 0.001,
      transform: { ...targetClip.transform },
      filters: [],
      blendMode: 'normal',
      opacity: 1,
      speed: 0.001,
      disabled: false,
    };

    const newFrame: Clip = {
      ...JSON.parse(JSON.stringify(targetClip)),
      id: uid('clip'),
      startTime: time,
      duration,
      inPoint: time - targetClip.startTime,
      outPoint: time - targetClip.startTime,
      speed: 0, // static frame (hypothetical engine support)
    };

    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t =>
          (t.id === targetTrack!.id ? { ...t, clips: [...t.clips, newFrame] } : t)),
      },
    }));
    get().recalcDuration();
  },

  shuttleSpeed: 0,
  setShuttleSpeed: (speed) => set({ shuttleSpeed: speed }),

  /* ═══ B4: 텍스트/자막 ═══ */

  addTextClip: (trackId, text, startTime, duration = 3, stylePatch) => {
    const s = get();
    const style: TextStyle = { ...DEFAULT_TEXT_STYLE, ...stylePatch };

    // 텍스트 트랙 찾기 또는 생성
    let textTrackId = trackId;
    if (!textTrackId) {
      const existing = s.project.tracks.find(t => t.type === 'text' && !t.locked);
      if (existing) {
        textTrackId = existing.id;
      } else {
        const newTrack = s.addTrack('text', 'Text 1');
        textTrackId = newTrack.id;
      }
    }

    const clipId = uid('clip');
    const clip: Clip = {
      id: clipId,
      assetId: '',          // 텍스트 클립은 에셋 없음
      startTime,
      duration,
      inPoint: 0,
      outPoint: duration,
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      filters: [],
      blendMode: 'normal',
      opacity: 1,
      speed: 1,
      textContent: { text, style },
    };

    s.pushUndo('텍스트 클립 추가');
    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t =>
          t.id === textTrackId ? { ...t, clips: [...t.clips, clip] } : t
        ),
      },
    }));
    get().selectClip(clipId);
    get().recalcDuration();
  },

  updateTextContent: (clipId, text) => {
    const s = get();
    s.pushUndo('텍스트 내용 수정');
    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => {
            if (c.id !== clipId || !c.textContent) return c;
            return { ...c, textContent: { ...c.textContent, text } };
          }),
        })),
      },
    }));
  },

  updateTextStyle: (clipId, stylePatch) => {
    const s = get();
    s.pushUndo('텍스트 스타일 수정');
    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => {
            if (c.id !== clipId || !c.textContent) return c;
            return {
              ...c,
              textContent: {
                ...c.textContent,
                style: { ...c.textContent.style, ...stylePatch },
              },
            };
          }),
        })),
      },
    }));
  },

  importSrt: (entries) => {
    const s = get();
    // 텍스트 트랙 찾기 또는 생성
    let textTrack = s.project.tracks.find(t => t.type === 'text' && !t.locked);
    if (!textTrack) {
      textTrack = s.addTrack('text', 'Subtitles');
    }
    const trackId = textTrack.id;

    s.pushUndo('SRT 가져오기');
    const newClips: Clip[] = entries.map(entry => ({
      id: uid('clip'),
      assetId: '',
      startTime: entry.startTime,
      duration: entry.endTime - entry.startTime,
      inPoint: 0,
      outPoint: entry.endTime - entry.startTime,
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      filters: [],
      blendMode: 'normal' as const,
      opacity: 1,
      speed: 1,
      textContent: {
        text: entry.text,
        style: { ...DEFAULT_TEXT_STYLE },
        wordTimings: entry.words,
      },
    }));

    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t =>
          t.id === trackId ? { ...t, clips: [...t.clips, ...newClips] } : t
        ),
      },
    }));
    get().recalcDuration();
  },

  exportSrt: () => {
    const s = get();
    const entries: SrtEntry[] = [];
    let idx = 1;
    for (const track of s.project.tracks) {
      if (track.type !== 'text') continue;
      const sorted = [...track.clips]
        .filter(c => c.textContent)
        .sort((a, b) => a.startTime - b.startTime);
      for (const clip of sorted) {
        if (!clip.textContent) continue;
        entries.push({
          index: idx++,
          startTime: clip.startTime,
          endTime: clip.startTime + clip.duration,
          text: clip.textContent.text,
          words: clip.textContent.wordTimings,
        });
      }
    }
    return entries;
  },

  applyStyleToAllTextClips: (stylePatch) => {
    const s = get();
    s.pushUndo('전체 자막 스타일 변경');
    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t => {
          if (t.type !== 'text') return t;
          return {
            ...t,
            clips: t.clips.map(c => {
              if (!c.textContent) return c;
              return {
                ...c,
                textContent: {
                  ...c.textContent,
                  style: { ...c.textContent.style, ...stylePatch },
                },
              };
            }),
          };
        }),
      },
    }));
  },

  /* ═══ B4-7: 워드 타이밍 ═══ */

  updateWordTimings: (clipId, wordTimings) => {
    const s = get();
    s.pushUndo('워드 타이밍 수정');
    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => {
            if (c.id !== clipId || !c.textContent) return c;
            return {
              ...c,
              textContent: { ...c.textContent, wordTimings },
            };
          }),
        })),
      },
    }));
  },

  generateEvenWordTimings: (clipId) => {
    const s = get();
    let targetClip: Clip | undefined;
    for (const t of s.project.tracks) {
      const c = t.clips.find(cl => cl.id === clipId);
      if (c) {
        targetClip = c;
        break;
      }
    }
    if (!targetClip?.textContent) return;

    const text = targetClip.textContent.text.trim();
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return;

    const duration = targetClip.duration;
    const wordDur = duration / words.length;
    const timings: WordTiming[] = words.map((word, i) => ({
      word,
      startTime: i * wordDur,
      endTime: (i + 1) * wordDur,
    }));

    s.updateWordTimings(clipId, timings);
  },

  clearWordTimings: (clipId) => {
    const s = get();
    s.pushUndo('워드 타이밍 제거');
    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => {
            if (c.id !== clipId || !c.textContent) return c;
            return {
              ...c,
              textContent: { ...c.textContent, wordTimings: undefined },
            };
          }),
        })),
      },
    }));
  },

  updateClip: (clipId, patch) => set((s) => {
    // ★ 링크된 클립에 전파할 속성 필터
    const LINKED_SYNC_KEYS: (keyof Clip)[] = [
      'startTime', 'duration', 'inPoint', 'outPoint', 'speed',
    ];

    let linkedId: string | undefined;
    for (const t of s.project.tracks) {
      const clip = t.clips.find(c => c.id === clipId);
      if (clip?.linkedClipId) {
        linkedId = clip.linkedClipId;
        break;
      }
    }

    // 링크 전파용 패치 생성
    const linkedPatch: Partial<Clip> = {};
    if (linkedId) {
      for (const key of LINKED_SYNC_KEYS) {
        if (key in patch) {
          (linkedPatch as any)[key] = (patch as any)[key];
        }
      }
    }

    return {
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => {
            if (c.id === clipId) return { ...c, ...patch };
            if (linkedId && c.id === linkedId && Object.keys(linkedPatch).length > 0) {
              return { ...c, ...linkedPatch };
            }
            return c;
          }),
        })),
      },
    };
  }),

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

  removeClip: (clipId) => set((s) => {
    // ★ 링크된 클립 ID 수집
    let linkedId: string | undefined;
    for (const t of s.project.tracks) {
      const clip = t.clips.find(c => c.id === clipId);
      if (clip?.linkedClipId) {
        linkedId = clip.linkedClipId;
        break;
      }
    }

    const idsToRemove = new Set([clipId]);
    if (linkedId) idsToRemove.add(linkedId);

    return {
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t => ({
          ...t,
          clips: t.clips.filter(c => !idsToRemove.has(c.id)),
        })),
      },
    };
  }),

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

    // ── 메인 클립 분할 ──
    const leftId = clipOwner.id;
    const rightId = uid('clip');
    const L: Clip = {
      ...JSON.parse(JSON.stringify(clipOwner)),
      duration: rel,
      outPoint: clipOwner.inPoint + rel,
    };
    const R: Clip = {
      ...JSON.parse(JSON.stringify(clipOwner)),
      id: rightId,
      startTime: time,
      duration: clipOwner.duration - rel,
      inPoint: clipOwner.inPoint + rel,
    };

    // ── 링크된 클립도 분할 ──
    let linkedTrackId: string | undefined;
    let linkedClip: Clip | undefined;
    let linkedLeftId: string | undefined;
    let linkedRightId: string | undefined;
    let linkedL: Clip | undefined;
    let linkedR: Clip | undefined;

    if (clipOwner.linkedClipId) {
      for (const t of s.project.tracks) {
        const lc = t.clips.find(c => c.id === clipOwner!.linkedClipId);
        if (lc) {
          linkedTrackId = t.id;
          linkedClip = lc;
          break;
        }
      }

      if (linkedClip && linkedTrackId) {
        linkedLeftId = linkedClip.id;
        linkedRightId = uid('clip');
        linkedL = {
          ...JSON.parse(JSON.stringify(linkedClip)),
          duration: rel,
          outPoint: linkedClip.inPoint + rel,
        };
        linkedR = {
          ...JSON.parse(JSON.stringify(linkedClip)),
          id: linkedRightId,
          startTime: time,
          duration: linkedClip.duration - rel,
          inPoint: linkedClip.inPoint + rel,
        };

        // 새 링크 설정: L↔linkedL, R↔linkedR
        if (linkedL && linkedR) {
          L.linkedClipId = linkedLeftId;
          linkedL.linkedClipId = leftId;
          R.linkedClipId = linkedRightId;
          linkedR.linkedClipId = rightId;
        }
      }
    } else {
      // 링크 없으면 새 클립도 링크 없음
      R.linkedClipId = undefined;
    }

    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t => {
          // 메인 클립 트랙
          if (t.id === trackOwner!.id) {
            return {
              ...t,
              clips: [...t.clips.filter(c => c.id !== clipId), L, R],
            };
          }
          // 링크된 클립 트랙 (lint fix: use local const for narrowing)
          const _l = linkedL;
          const _r = linkedR;
          if (linkedTrackId && t.id === linkedTrackId && _l && _r && linkedClip) {
            return {
              ...t,
              clips: [...t.clips.filter(c => c.id !== linkedClip.id), _l, _r],
            };
          }
          return t;
        }),
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
    const sourceDuration = (originalClip.outPoint - originalClip.inPoint) / originalClip.speed;
    const newDuration = sourceDuration / clampedSpeed;

    s.pushUndo('속도 변경');

    // ★ 링크된 클립 ID
    const linkedId = originalClip.linkedClipId;

    set((st) => ({
      project: {
        ...st.project,
        tracks: st.project.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => {
            if (c.id === clipId) {
              return {
                ...c,
                speed: clampedSpeed,
                duration: newDuration,
                reverse: reverse ?? c.reverse ?? false,
              };
            }
            // ★ 링크된 클립도 동일 속도/duration 적용
            if (linkedId && c.id === linkedId) {
              return {
                ...c,
                speed: clampedSpeed,
                duration: newDuration,
                reverse: reverse ?? c.reverse ?? false,
              };
            }
            return c;
          }),
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
  effects: [], // ★ ADD
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
  /* ──── Hub 상태 ──── */
  activeModuleId: null,
  setActiveModuleId: (id) => set({ activeModuleId: id }),
  isHubOpen: false,
  setHubOpen: (open) => set({ isHubOpen: open }),

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
