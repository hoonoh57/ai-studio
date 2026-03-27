/* ─── src/components/Timeline/TimelinePanel.tsx ─── */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { SKILL_CONFIGS, assetTypeToTrackType } from '@/types/project';
import type { Track } from '@/types/project';
import { TimelineToolbar } from './TimelineToolbar';
import { TrackHeader } from './TrackHeader';
import { TrackRow } from './TrackRow';
import { TimelineRuler } from './TimelineRuler';
import { Playhead } from './Playhead';
import { MarkerTrack } from './MarkerTrack';
import { snapTime } from '@/lib/core/snapEngine';

/* ========== 상수 ========== */
const PPS_BASE = 50;
const TRACK_LABEL_W = 160;
const RULER_H = 28;
const AUTO_ZONE_H = 40;

interface DragState {
  type: 'move' | 'trim-left' | 'trim-right';
  clipId: string;
  trackId: string;
  startX: number;
  startY: number;
  startTime: number;
  originalStartTime: number;
  originalDuration: number;
}

function isClipOnLockedTrack(clipId: string, tracks: Track[]): boolean {
  for (const t of tracks) {
    if (t.locked && t.clips.some(c => c.id === clipId)) return true;
  }
  return false;
}

export const TimelinePanel: React.FC = () => {
  const store = useEditorStore();
  const {
    project, zoom, selectedClipId, snapEnabled, markers, inOut,
    setCurrentTime, selectClip, addClip, updateClip, removeClip,
    recalcDuration, currentTime, pushUndo, undo, redo, canUndo, canRedo,
    splitClip, addMarker, togglePlay, skillLevel, addTrackChecked,
    reorderTracks, moveClipToTrack,
  } = store;

  const config = SKILL_CONFIGS[skillLevel] ?? SKILL_CONFIGS.beginner;

  const labelScrollRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const trackRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const syncingRef = useRef(false);

  const [dragTrackFrom, setDragTrackFrom] = useState<number | null>(null);
  const [dragTrackTo, setDragTrackTo] = useState<number | null>(null);

  const pps = PPS_BASE * zoom;
  const totalW = Math.max(project.duration * pps, 800);
  const tracks = project.tracks;
  const totalTrackH = tracks.reduce((sum, t) => sum + t.height, 0);

  /* ── B7 FIX: 스크롤 동기화 재진입 가드 ── */
  const syncScroll = useCallback((source: 'label' | 'main') => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    const label = labelScrollRef.current;
    const main = mainScrollRef.current;
    if (label && main) {
      if (source === 'main') label.scrollTop = main.scrollTop;
      else main.scrollTop = label.scrollTop;
    }
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, []);

  /* 자동 스크롤: 재생 시 playhead를 따라감 */
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const px = currentTime * pps;
    const scrollLeft = el.scrollLeft;
    const w = el.clientWidth;
    if (px < scrollLeft || px > scrollLeft + w - 60) {
      el.scrollLeft = Math.max(0, px - w / 2);
    }
  }, [currentTime, pps]);

  const snap = useCallback((t: number): number => {
    return snapTime(t, tracks, markers, inOut, currentTime, project.duration, snapEnabled, zoom);
  }, [snapEnabled, tracks, markers, inOut, currentTime, project.duration, zoom]);

  const findClipAndTrack = useCallback((clipId: string) => {
    for (const t of tracks) {
      const c = t.clips.find(cl => cl.id === clipId);
      if (c) return { clip: c, track: t };
    }
    return null;
  }, [tracks]);

  /* ── B5 FIX: Y좌표로 대상 트랙 찾기 ── */
  const findTrackAtY = useCallback((clientY: number): Track | null => {
    for (const [trackId, el] of trackRowRefs.current.entries()) {
      const rect = el.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return tracks.find(t => t.id === trackId) || null;
      }
    }
    return null;
  }, [tracks]);

  /* 클립 마우스 다운 — 이동/트림 시작 */
  const handleMouseDown = useCallback((
    e: React.MouseEvent, clipId: string, trackId: string,
    type: 'move' | 'trim-left' | 'trim-right',
  ) => {
    if (isClipOnLockedTrack(clipId, tracks)) return;
    e.stopPropagation();
    const found = findClipAndTrack(clipId);
    if (!found) return;
    pushUndo('클립 편집');
    dragRef.current = {
      type, clipId, trackId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: found.clip.startTime,
      originalStartTime: found.clip.startTime,
      originalDuration: found.clip.duration,
    };
    selectClip(clipId);
  }, [tracks, findClipAndTrack, pushUndo, selectClip]);

  /* 전역 마우스 이벤트 — 이동/트림 처리 + 트랙 간 이동 */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dt = dx / pps;
      if (d.type === 'move') {
        updateClip(d.clipId, { startTime: snap(Math.max(0, d.startTime + dt)) });
      } else if (d.type === 'trim-left') {
        const newStart = snap(Math.max(0, d.startTime + dt));
        const shrink = newStart - d.originalStartTime;
        updateClip(d.clipId, {
          startTime: newStart,
          duration: Math.max(0.1, d.originalDuration - shrink),
        });
      } else if (d.type === 'trim-right') {
        updateClip(d.clipId, {
          duration: snap(Math.max(0.1, d.originalDuration + dt)),
        });
      }
    };

    const onUp = (e: MouseEvent) => {
      const d = dragRef.current;
      if (d && d.type === 'move') {
        /* B5 FIX: Y축 이동 감지 → 다른 트랙으로 클립 이동 */
        const targetTrack = findTrackAtY(e.clientY);
        if (targetTrack && targetTrack.id !== d.trackId && !targetTrack.locked) {
          moveClipToTrack(d.clipId, d.trackId, targetTrack.id);
        }
      }
      dragRef.current = null;
      recalcDuration();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [pps, snap, updateClip, recalcDuration, findTrackAtY, moveClipToTrack]);

  /* 키보드 단축키 */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); if (canUndo()) undo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault(); if (canRedo()) redo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault(); if (canRedo()) redo(); return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipId && !isClipOnLockedTrack(selectedClipId, tracks)) {
          e.preventDefault();
          pushUndo('클립 삭제');
          removeClip(selectedClipId);
          selectClip(null);
        }
        return;
      }
      if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
        if (selectedClipId && !isClipOnLockedTrack(selectedClipId, tracks)) {
          splitClip(selectedClipId, currentTime);
        }
        return;
      }
      if (e.key.toLowerCase() === 'm' && !e.ctrlKey) {
        addMarker({ id: `mkr_${Date.now()}`, time: currentTime, label: '', color: '#FFD700' });
        return;
      }
      if (e.key === ' ') { e.preventDefault(); togglePlay(); return; }
      if (e.key === 'ArrowLeft') { setCurrentTime(Math.max(0, currentTime - 1 / 30)); return; }
      if (e.key === 'ArrowRight') { setCurrentTime(currentTime + 1 / 30); return; }
      if (e.key === 'Home') { setCurrentTime(0); return; }
      if (e.key === 'End') { setCurrentTime(project.duration); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedClipId, currentTime, tracks, project.duration, canUndo, canRedo,
      undo, redo, pushUndo, removeClip, selectClip, splitClip, addMarker,
      togglePlay, setCurrentTime]);

  /* 드롭 처리 — 에셋을 트랙에 드롭 */
  const handleDrop = useCallback((e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    const assetId = e.dataTransfer.getData('assetId');
    if (!assetId) return;
    const asset = project.assets.find(a => a.id === assetId);
    if (!asset) return;

    let targetTrackId = trackId;
    const neededType = assetTypeToTrackType(asset.type);

    if (trackId === '__auto__') {
      const ok = addTrackChecked(neededType);
      if (!ok) return;
      const newTracks = useEditorStore.getState().project.tracks;
      targetTrackId = newTracks[newTracks.length - 1].id;
    } else {
      const targetTrack = tracks.find(t => t.id === trackId);
      if (targetTrack && targetTrack.type !== neededType) {
        const compatible = tracks.find(t => t.type === neededType && !t.locked);
        if (compatible) {
          targetTrackId = compatible.id;
        } else {
          const ok = addTrackChecked(neededType);
          if (!ok) return;
          const newTracks = useEditorStore.getState().project.tracks;
          targetTrackId = newTracks[newTracks.length - 1].id;
        }
      }
    }

    const rect = mainScrollRef.current?.getBoundingClientRect();
    const scrollLeft = mainScrollRef.current?.scrollLeft ?? 0;
    const x = rect ? e.clientX - rect.left + scrollLeft : 0;
    const startTime = snap(Math.max(0, x / pps));
    const duration = asset.type === 'image' ? 5 : (asset.duration || 5);

    pushUndo('클립 추가');
    addClip(targetTrackId, {
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      assetId: asset.id,
      startTime,
      duration,
      inPoint: 0,
      outPoint: duration,
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      filters: [],
      blendMode: 'normal',
      opacity: 1,
      volume: asset.type === 'audio' ? 1 : undefined,
      speed: 1,
    });
    recalcDuration();
  }, [project.assets, tracks, snap, pps, pushUndo, addClip, addTrackChecked, recalcDuration]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  /* 트랙 재정렬 드래그 종료 */
  const handleTrackDragEnd = useCallback(() => {
    if (dragTrackFrom != null && dragTrackTo != null && dragTrackFrom !== dragTrackTo) {
      pushUndo('트랙 재정렬');
      reorderTracks(dragTrackFrom, dragTrackTo);
    }
    setDragTrackFrom(null);
    setDragTrackTo(null);
  }, [dragTrackFrom, dragTrackTo, pushUndo, reorderTracks]);

  /* TrackRow ref 등록 콜백 */
  const setTrackRowRef = useCallback((trackId: string, el: HTMLDivElement | null) => {
    if (el) {
      trackRowRefs.current.set(trackId, el);
    } else {
      trackRowRefs.current.delete(trackId);
    }
  }, []);

  return (
    <div
      ref={panelRef}
      tabIndex={0}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-primary, #181825)',
        borderTop: '1px solid var(--border-primary, #333)',
        overflow: 'hidden',
      }}
    >
      <TimelineToolbar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ── 좌측: 트랙 헤더 ── */}
        <div style={{
          width: TRACK_LABEL_W,
          minWidth: TRACK_LABEL_W,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border-secondary, #333)',
        }}>
          <div style={{
            height: RULER_H,
            flexShrink: 0,
            borderBottom: '1px solid var(--border-secondary, #333)',
          }} />
          <div
            ref={labelScrollRef}
            onScroll={() => syncScroll('label')}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollbarWidth: 'none',
            }}
          >
            {tracks.map((t, idx) => (
              <TrackHeader
                key={t.id}
                track={t}
                index={idx}
                trackCount={tracks.length}
                onDragStart={setDragTrackFrom}
                onDragEnter={setDragTrackTo}
                onDragEnd={handleTrackDragEnd}
              />
            ))}
            <div
              style={{
                height: AUTO_ZONE_H,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                color: '#555',
                borderBottom: '1px solid var(--border-secondary, #333)',
              }}
            >
              + 드롭하여 트랙 생성
            </div>
          </div>
        </div>

        {/* ── 우측: 타임라인 본체 ── */}
        <div
          ref={mainScrollRef}
          onScroll={() => syncScroll('main')}
          style={{ flex: 1, overflow: 'auto', position: 'relative' }}
        >
          {/* 룰러 — sticky */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 20,
              height: RULER_H,
              cursor: 'pointer',
              background: 'var(--bg-secondary, #1e1e2e)',
            }}
          >
            <TimelineRuler pps={pps} duration={project.duration} zoom={zoom} />
            {/* B2 FIX: MarkerTrack을 룰러 위에 오버레이 */}
            <MarkerTrack markers={markers} pps={pps} totalWidth={totalW} />
          </div>

          {/* 트랙 영역 — relative 컨테이너 */}
          <div style={{
            position: 'relative',
            width: totalW,
            minHeight: totalTrackH + AUTO_ZONE_H,
          }}>
            {/* B2 FIX: Playhead를 트랙 영역 전체에 absolute 오버레이 (top: -RULER_H로 룰러부터) */}
            <div style={{
              position: 'absolute',
              top: -RULER_H,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
              zIndex: 30,
            }}>
              <Playhead pps={pps} />
            </div>

            {/* 트랙 행들 */}
            {tracks.map(t => (
              <TrackRow
                key={t.id}
                ref={(el: HTMLDivElement | null) => setTrackRowRef(t.id, el)}
                track={t}
                assets={project.assets}
                pps={pps}
                selectedClipId={selectedClipId}
                onSelectClip={(id) => selectClip(id)}
                onMoveClip={(e, clipId) => handleMouseDown(e, clipId, t.id, 'move')}
                onTrimLeft={(e, clipId) => handleMouseDown(e, clipId, t.id, 'trim-left')}
                onTrimRight={(e, clipId) => handleMouseDown(e, clipId, t.id, 'trim-right')}
                onDrop={(e) => handleDrop(e, t.id)}
                onDragOver={handleDragOver}
              />
            ))}

            {/* 자동 트랙 생성 드롭존 */}
            <div
              style={{
                height: AUTO_ZONE_H,
                width: totalW,
                borderTop: '1px dashed #444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                color: '#555',
              }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, '__auto__')}
            >
              ⊕ 파일을 여기에 드롭하면 새 트랙이 자동 생성됩니다
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelinePanel;
