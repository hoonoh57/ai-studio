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
import type { DragType, Clip, Track } from '@/types/project';

const PIXELS_PER_SECOND_BASE = 50;
const TRACK_LABEL_WIDTH = 120;
const RULER_HEIGHT = 28;
const MARKER_AREA_HEIGHT = 20;
const AUTO_SCROLL_MARGIN = 100;
const RULER_Z_INDEX = 50;
const TRACK_LABEL_Z_INDEX = 100;
const OVERLAY_Z_INDEX = 200;

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

// ── 버그#4 헬퍼: 클립이 locked 트랙에 있는지 확인 ──
function isClipOnLockedTrack(clipId: string, tracks: readonly Track[]): boolean {
  for (const t of tracks) {
    const found = t.clips.find((c) => c.id === clipId);
    if (found !== undefined) return t.locked;
  }
  return false;
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const pps = PIXELS_PER_SECOND_BASE * zoom;
  const totalWidth = project.duration * pps;

  // ── Auto-scroll ──
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

      // 버그#5: 드래그 시작 시 undo 포인트 저장
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

      // ── 버그#5: Undo/Redo 단축키 (Ctrl+Z / Ctrl+Shift+Z) ──
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
      // Ctrl+Y도 redo로
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        state.redo();
        return;
      }

      // ── Delete 키: 선택된 클립 삭제 ──
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedClipId !== null) {
          // 버그#4: locked 트랙 클립은 삭제 불가
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
          state.setCurrentTime(
            state.currentTime + (e.shiftKey ? 1 : step),
          );
          break;
        case 'ArrowLeft':
          e.preventDefault();
          state.setCurrentTime(
            state.currentTime - (e.shiftKey ? 1 : step),
          );
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
          // 버그#4: locked 트랙의 클립은 split 불가
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

  // ── Drop handler ──
  const handleDrop = useCallback(
    (e: React.DragEvent, trackId: string) => {
      e.preventDefault();
      const assetId = e.dataTransfer.getData('assetId');
      const asset = project.assets.find((a) => a.id === assetId);
      const scroll = scrollRef.current;
      if (asset === undefined || scroll === null) return;

      const rect = scroll.getBoundingClientRect();
      const x = e.clientX - rect.left + scroll.scrollLeft;
      const startTime = x / pps;

      addClip(trackId, {
        assetId,
        timelineStart: startTime,
        timelineEnd: startTime + asset.duration,
        sourceStart: 0,
        sourceEnd: asset.duration,
        speed: 1,
        opacity: 1,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        blendMode: 'normal',
        filters: [],
        locked: false,
      });
    },
    [project.assets, pps, addClip],
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
        {/* Track labels */}
        <div
          style={{
            width: TRACK_LABEL_WIDTH,
            background: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: TRACK_LABEL_Z_INDEX,
          }}
        >
          <div
            style={{
              height: RULER_HEIGHT,
              borderBottom: '1px solid var(--border)',
            }}
          />
          <div style={{ height: MARKER_AREA_HEIGHT }} />
          {project.tracks.map((t) => (
            <TrackHeader key={t.id} track={t} />
          ))}
        </div>

        {/* Scroll area */}
        <div
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'hidden',
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
          {/* Ruler */}
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

          {/* Tracks */}
          <div
            style={{
              position: 'relative',
              width: totalWidth,
              minHeight: '100%',
              zIndex: 10,
            }}
          >
            <div style={{ height: MARKER_AREA_HEIGHT }} />
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
          </div>

          {/* Overlays */}
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
