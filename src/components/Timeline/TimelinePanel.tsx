// src/components/Timeline/TimelinePanel.tsx

import React, { useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { snapTime } from '@/lib/core/snapEngine';
import { executeTrim } from '@/lib/core/trimEngine';
import { TimelineToolbar } from './TimelineToolbar';
import { TrackHeader } from './TrackHeader';
import { TrackRow } from './TrackRow';
import { TimelineRuler } from './TimelineRuler';
import { Playhead } from './Playhead';
import { MarkerTrack } from './MarkerTrack';
import type { DragType, Clip, Track, TrackType } from '@/types/project';

const PIXELS_PER_SECOND_BASE = 50;
const TRACK_LABEL_WIDTH = 120;
const RULER_HEIGHT = 28;
const MARKER_AREA_HEIGHT = 20;
const AUTO_SCROLL_MARGIN = 100;
const RULER_Z_INDEX = 50;
const OVERLAY_Z_INDEX = 200;
const AUTO_TRACK_ZONE_HEIGHT = 48;
const DEFAULT_IMAGE_DURATION = 5;

interface DragState {
  readonly type: DragType;
  readonly clipId: string;
  readonly trackId: string;
  readonly startX: number;
  readonly origStart: number;
  readonly origEnd: number;
  readonly origSourceStart: number;
  readonly origSourceEnd: number;
}

function isClipOnLockedTrack(clipId: string, tracks: readonly Track[]): boolean {
  for (const t of tracks) {
    const found = t.clips.find((c) => c.id === clipId);
    if (found !== undefined) return t.locked;
  }
  return false;
}

/** 에셋 타입 → 트랙 타입 매핑 (이미지는 video 트랙에) */
function assetTypeToTrackType(assetType: string): TrackType {
  if (assetType === 'audio') return 'audio';
  return 'video'; // video + image 모두 video 트랙
}

export function TimelinePanel(): React.ReactElement {
  const project = useEditorStore((s) => s.project);
  const zoom = useEditorStore((s) => s.zoom);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const markers = useEditorStore((s) => s.markers);
  const inOut = useEditorStore((s) => s.inOut);
  const trimMode = useEditorStore((s) => s.trimMode);

  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const selectClip = useEditorStore((s) => s.selectClip);
  const addClip = useEditorStore((s) => s.addClip);
  const updateClip = useEditorStore((s) => s.updateClip);
  const recalcDuration = useEditorStore((s) => s.recalcDuration);

  /** 좌우 동기 스크롤을 위한 refs */
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const pps = PIXELS_PER_SECOND_BASE * zoom;
  const totalWidth = project.duration * pps;

  // ── 좌우 세로 스크롤 동기화 ──
  useEffect(() => {
    const scrollEl = scrollRef.current;
    const headerEl = headerScrollRef.current;
    if (scrollEl === null || headerEl === null) return;

    let syncing = false;

    const onMainScroll = () => {
      if (syncing) return;
      syncing = true;
      headerEl.scrollTop = scrollEl.scrollTop;
      syncing = false;
    };

    const onHeaderScroll = () => {
      if (syncing) return;
      syncing = true;
      scrollEl.scrollTop = headerEl.scrollTop;
      syncing = false;
    };

    scrollEl.addEventListener('scroll', onMainScroll);
    headerEl.addEventListener('scroll', onHeaderScroll);
    return () => {
      scrollEl.removeEventListener('scroll', onMainScroll);
      headerEl.removeEventListener('scroll', onHeaderScroll);
    };
  }, []);

  // ── Auto-scroll (horizontal, playhead follow) ──
  useEffect(() => {
    const unsub = useEditorStore.subscribe(
      (s) => s.currentTime,
      (t) => {
        const scroll = scrollRef.current;
        if (scroll === null) return;
        const x = t * pps;
        const viewStart = scroll.scrollLeft;
        const viewEnd = scroll.scrollLeft + scroll.offsetWidth;
        if (x > viewEnd - AUTO_SCROLL_MARGIN) {
          scroll.scrollLeft = x - AUTO_SCROLL_MARGIN;
        } else if (x < viewStart + AUTO_SCROLL_MARGIN) {
          scroll.scrollLeft = Math.max(0, x - AUTO_SCROLL_MARGIN);
        }
      },
    );
    return unsub;
  }, [pps]);

  // ── Snap helper ──
  const snap = useCallback(
    (time: number): number =>
      snapTime(
        time,
        project.tracks,
        markers,
        inOut,
        useEditorStore.getState().currentTime,
        project.duration,
        snapEnabled,
        zoom,
      ),
    [project.tracks, markers, inOut, project.duration, snapEnabled, zoom],
  );

  // ── Find clip & track by clipId ──
  const findClipAndTrack = useCallback(
    (clipId: string): { clip: Clip; track: Track } | null => {
      for (const t of project.tracks) {
        const c = t.clips.find((cl) => cl.id === clipId);
        if (c !== undefined) return { clip: c, track: t };
      }
      return null;
    },
    [project.tracks],
  );

  // ── Drag handlers ──
  const startDrag = useCallback(
    (
      e: React.MouseEvent,
      type: DragType,
      clip: Clip,
      trackId: string,
    ) => {
      e.preventDefault();
      e.stopPropagation();
      selectClip(clip.id);

      useEditorStore.getState().pushUndo(
        type === 'move' ? 'Move clip' : 'Trim clip',
      );

      dragRef.current = {
        type,
        clipId: clip.id,
        trackId,
        startX: e.clientX,
        origStart: clip.timelineStart,
        origEnd: clip.timelineEnd,
        origSourceStart: clip.sourceStart,
        origSourceEnd: clip.sourceEnd,
      };

      const onMove = (ev: MouseEvent) => {
        const d = dragRef.current;
        if (d === null) return;
        const dt = (ev.clientX - d.startX) / pps;
        const dur = d.origEnd - d.origStart;

        if (d.type === 'move') {
          const snapped = snap(d.origStart + dt);
          updateClip(d.clipId, {
            timelineStart: snapped,
            timelineEnd: snapped + dur,
          });
          return;
        }

        const found = findClipAndTrack(d.clipId);
        if (found === null) return;

        const asset = project.assets.find(
          (a) => a.id === found.clip.assetId,
        );
        const assetDuration = asset?.duration ?? found.clip.sourceEnd;
        const side = d.type === 'trim-left' ? 'left' : 'right';

        const results = executeTrim(
          found.clip,
          found.track,
          side as 'left' | 'right',
          dt,
          trimMode,
          assetDuration,
        );

        for (const r of results) {
          updateClip(r.clipId, r.updates);
        }
      };

      const onUp = () => {
        dragRef.current = null;
        recalcDuration();
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [pps, selectClip, updateClip, recalcDuration, snap, findClipAndTrack, trimMode, project.assets],
  );

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const state = useEditorStore.getState();
      const step = 1 / (state.project.fps || 30);

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        state.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        state.redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        state.redo();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedClipId !== null) {
          if (!isClipOnLockedTrack(state.selectedClipId, state.project.tracks)) {
            e.preventDefault();
            state.removeClip(state.selectedClipId);
          }
        }
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          e.stopImmediatePropagation();
          state.togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          state.setCurrentTime(state.currentTime + (e.shiftKey ? 1 : step));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          state.setCurrentTime(state.currentTime - (e.shiftKey ? 1 : step));
          break;
        case 'PageDown':
          e.preventDefault();
          state.setCurrentTime(state.currentTime + 5);
          break;
        case 'PageUp':
          e.preventDefault();
          state.setCurrentTime(state.currentTime - 5);
          break;
        case 'Home':
          e.preventDefault();
          state.setCurrentTime(0);
          break;
        case 'End':
          e.preventDefault();
          state.setCurrentTime(state.project.duration);
          break;
        case 'c':
        case 'C':
          if (state.selectedClipId !== null) {
            if (!isClipOnLockedTrack(state.selectedClipId, state.project.tracks)) {
              state.splitClip(state.selectedClipId, state.currentTime);
            }
          }
          break;
        case 'm':
        case 'M':
          state.addMarker(state.currentTime);
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKey, { capture: true });
    return () => {
      document.removeEventListener('keydown', handleKey, { capture: true });
    };
  }, []);

  // ── Drop handler (개선: 에셋타입→트랙 자동 매칭) ──
  const handleDrop = useCallback(
    (e: React.DragEvent, trackId: string) => {
      e.preventDefault();
      const assetId = e.dataTransfer.getData('assetId');
      const asset = project.assets.find((a) => a.id === assetId);
      const scroll = scrollRef.current;
      if (asset === undefined || scroll === null) return;

      const rect = scroll.getBoundingClientRect();
      const x = e.clientX - rect.left + scroll.scrollLeft;
      const startTime = Math.max(0, x / pps);

      // 에셋 기반 트랙 타입 결정
      const neededTrackType = assetTypeToTrackType(asset.type);

      // 실제 드롭할 트랙 결정
      let targetTrackId = trackId;

      if (targetTrackId === '__auto__') {
        // 자동 트랙 생성 존에 드롭
        const newTrack = useEditorStore.getState().addTrack(neededTrackType);
        targetTrackId = newTrack.id;
      } else {
        // 기존 트랙에 드롭 — 트랙 타입이 호환되는지 확인
        const targetTrack = project.tracks.find((t) => t.id === targetTrackId);
        if (targetTrack !== undefined && targetTrack.type !== neededTrackType) {
          // 타입 불일치: 같은 타입의 빈 트랙 찾기, 없으면 자동 생성
          const compatibleTrack = project.tracks.find(
            (t) => t.type === neededTrackType && t.clips.length === 0 && !t.locked,
          );
          if (compatibleTrack !== undefined) {
            targetTrackId = compatibleTrack.id;
          } else {
            const newTrack = useEditorStore.getState().addTrack(neededTrackType);
            targetTrackId = newTrack.id;
          }
        }
      }

      // 이미지의 경우 기본 duration 설정
      const duration = (asset.duration && asset.duration > 0) ? asset.duration : DEFAULT_IMAGE_DURATION;

      addClip(targetTrackId, {
        assetId,
        timelineStart: startTime,
        timelineEnd: startTime + duration,
        sourceStart: 0,
        sourceEnd: duration,
        speed: 1,
        opacity: 1,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        blendMode: 'normal',
        filters: [],
        locked: false,
      });
    },
    [project.assets, project.tracks, pps, addClip],
  );

  // ── Ruler click ──
  const handleRulerClick = useCallback(
    (e: React.MouseEvent) => {
      const scroll = scrollRef.current;
      if (scroll === null) return;
      const rect = scroll.getBoundingClientRect();
      const x = e.clientX - rect.left + scroll.scrollLeft;
      setCurrentTime(x / pps);
    },
    [pps, setCurrentTime],
  );

  // ── 전체 트랙 영역 높이 계산 ──
  const totalTracksHeight = project.tracks.reduce((sum, t) => sum + t.height, 0)
    + MARKER_AREA_HEIGHT + AUTO_TRACK_ZONE_HEIGHT;

  return (
    <div
      style={{
        height: 'var(--timeline-height)',
        background: 'var(--bg-panel)',
        display: 'flex',
        flexDirection: 'column',
        borderTop: '2px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      <TimelineToolbar />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ═══ 좌측: Track Headers ═══ */}
        <div
          style={{
            width: TRACK_LABEL_WIDTH,
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            background: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border)',
          }}
        >
          {/* Ruler 높이 맞춤 빈 공간 (sticky ruler와 동일 높이) */}
          <div
            style={{
              height: RULER_HEIGHT,
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}
          />
          {/* 세로 스크롤되는 헤더 영역 */}
          <div
            ref={headerScrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              /* 스크롤바 숨김 — 우측 스크롤바만 표시 */
              scrollbarWidth: 'none',
            }}
          >
            {/* Marker area 높이 맞춤 */}
            <div style={{ height: MARKER_AREA_HEIGHT, flexShrink: 0 }} />
            {project.tracks.map((t) => (
              <TrackHeader key={t.id} track={t} />
            ))}
            {/* 자동 트랙 생성 존 높이 맞춤 */}
            <div style={{ height: AUTO_TRACK_ZONE_HEIGHT, flexShrink: 0 }} />
          </div>
        </div>

        {/* ═══ 우측: Scroll area (ruler + tracks + overlays) ═══ */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            position: 'relative',
          }}
          ref={scrollRef}
          tabIndex={-1}
          onMouseDown={(e) => {
            const top = e.currentTarget.getBoundingClientRect().top;
            if (e.clientY < top + RULER_HEIGHT) {
              handleRulerClick(e);
            }
          }}
        >
          {/* Ruler (sticky) */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: RULER_Z_INDEX,
              background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <TimelineRuler pps={pps} duration={project.duration} zoom={zoom} />
          </div>

          {/* Tracks content */}
          <div
            style={{
              position: 'relative',
              width: totalWidth,
              minHeight: totalTracksHeight,
              zIndex: 10,
            }}
          >
            {/* Marker area */}
            <div style={{ height: MARKER_AREA_HEIGHT }} />

            {/* Track Rows */}
            {project.tracks.map((t) => (
              <TrackRow
                key={t.id}
                track={t}
                pps={pps}
                projectAssets={project.assets}
                selectedClipId={selectedClipId}
                onSelectClip={selectClip}
                onDropClip={(e) => handleDrop(e, t.id)}
                onDragOverTrack={(e) => e.preventDefault()}
                onMoveStart={(e, clip) =>
                  startDrag(e, 'move', clip, t.id)
                }
                onTrimLeftStart={(e, clip) =>
                  startDrag(e, 'trim-left', clip, t.id)
                }
                onTrimRightStart={(e, clip) =>
                  startDrag(e, 'trim-right', clip, t.id)
                }
              />
            ))}

            {/* 자동 트랙 생성 존 */}
            <div
              style={{
                height: AUTO_TRACK_ZONE_HEIGHT,
                borderTop: '1px dashed var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: 'var(--text-muted)',
                cursor: 'default',
                background: 'rgba(124, 92, 252, 0.03)',
              }}
              onDrop={(e) => handleDrop(e, '__auto__')}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
            >
              ＋ 여기에 드롭하면 새 트랙이 자동 생성됩니다
            </div>
          </div>

          {/* Overlays (Markers + Playhead) */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: totalWidth,
              height: '100%',
              pointerEvents: 'none',
              zIndex: OVERLAY_Z_INDEX,
            }}
          >
            <MarkerTrack
              markers={markers}
              pps={pps}
              totalWidth={totalWidth}
            />
            <Playhead pps={pps} />
          </div>
        </div>
      </div>
    </div>
  );
}
