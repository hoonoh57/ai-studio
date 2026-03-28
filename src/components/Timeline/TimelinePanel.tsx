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
import { ClipContextMenu } from './ClipContextMenu';
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
    reorderTracks, moveClipToTrack, linkClips, unlinkClip, trimMode, setZoom,
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

  /* ── I-2 FIX: 멀티 셀렉션 상태 ── */
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());

  /* ── T-3.5: 클립 컨텍스트 메뉴 상태 ── */
  const [clipCtxMenu, setClipCtxMenu] = useState<{
    clipId: string; trackId: string; x: number; y: number;
  } | null>(null);

  const pps = PPS_BASE * zoom;
  const totalW = Math.max(project.duration * pps, 800);
  const tracks = project.tracks;
  const totalTrackH = tracks.reduce((sum, t) => sum + t.height, 0);

  /* 선택 동기화: 단일 선택과 멀티 선택 연동 */
  useEffect(() => {
    if (selectedClipId && !selectedClipIds.has(selectedClipId)) {
      setSelectedClipIds(new Set([selectedClipId]));
    }
  }, [selectedClipId]);

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

  /* ── I-4 FIX: 줌 비례 동적 마진 ── */
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const px = currentTime * pps;
    const scrollLeft = el.scrollLeft;
    const w = el.clientWidth;
    const margin = Math.max(40, Math.min(w * 0.15, 200));
    if (px < scrollLeft + margin || px > scrollLeft + w - margin) {
      el.scrollLeft = Math.max(0, px - w / 2);
    }
  }, [currentTime, pps]);

  /* ── Ctrl+Wheel 줌 / Shift+Wheel 가로 스크롤 ── */
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Ctrl(또는 Meta) + 휠 → 줌
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(0.1, Math.min(10, zoom + delta));

        // 줌 시 마우스 위치 기준으로 스크롤 조정
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const scrollRatio = (el.scrollLeft + mouseX) / (totalW || 1);

        setZoom(newZoom);

        // 다음 프레임에 스크롤 위치 보정
        requestAnimationFrame(() => {
          const newTotalW = Math.max(project.duration * PPS_BASE * newZoom, 800);
          el.scrollLeft = scrollRatio * newTotalW - mouseX;
        });
        return;
      }

      // Shift + 휠 → 가로 스크롤
      if (e.shiftKey) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
        return;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [zoom, totalW, project.duration, setZoom]);

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

  const findTrackAtY = useCallback((clientY: number): Track | null => {
    for (const [trackId, el] of trackRowRefs.current.entries()) {
      const rect = el.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return tracks.find(t => t.id === trackId) || null;
      }
    }
    return null;
  }, [tracks]);

  /* ── I-2 FIX: 클립 선택 핸들러 — Shift로 멀티 셀렉션 ── */
  const handleClipSelect = useCallback((clipId: string, shiftKey: boolean) => {
    if (shiftKey && config.showLinkedSelection) {
      setSelectedClipIds(prev => {
        const next = new Set(prev);
        if (next.has(clipId)) {
          next.delete(clipId);
        } else {
          next.add(clipId);
        }
        return next;
      });
      selectClip(clipId);
    } else {
      setSelectedClipIds(new Set([clipId]));
      selectClip(clipId);
    }
  }, [config.showLinkedSelection, selectClip]);

  /* ── I-2 FIX: 링크/언링크 핸들러 ── */
  const handleLinkSelected = useCallback(() => {
    const ids = Array.from(selectedClipIds);
    if (ids.length !== 2) return;
    pushUndo('클립 링크');
    linkClips(ids[0], ids[1]);
    setSelectedClipIds(new Set());
  }, [selectedClipIds, pushUndo, linkClips]);

  const handleUnlinkSelected = useCallback(() => {
    if (!selectedClipId) return;
    const found = findClipAndTrack(selectedClipId);
    if (!found || !found.clip.linkedClipId) return;
    pushUndo('클립 링크 해제');
    unlinkClip(selectedClipId);
  }, [selectedClipId, findClipAndTrack, pushUndo, unlinkClip]);

  /* ── T-3.5: 클립 컨텍스트 메뉴 핸들러 ── */
  const handleClipContextMenu = useCallback((
    e: React.MouseEvent, clipId: string, trackId: string,
  ) => {
    e.preventDefault();
    if (!config.showClipContextMenu) return;
    setClipCtxMenu({ clipId, trackId, x: e.clientX, y: e.clientY });
  }, [config.showClipContextMenu]);

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
    if (!e.shiftKey) {
      handleClipSelect(clipId, false);
    }
  }, [tracks, findClipAndTrack, pushUndo, handleClipSelect]);

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
        /* T-3.4: 트림 모드별 동작 */
        if (trimMode === 'slip') {
           const sourceShift = dt;
           updateClip(d.clipId, {
             inPoint: Math.max(0, d.startTime + sourceShift),
             outPoint: Math.max(0.1, d.startTime + d.originalDuration + sourceShift),
           });
        } else {
           const newStart = snap(Math.max(0, d.startTime + dt));
           const shrink = newStart - d.originalStartTime;
           updateClip(d.clipId, {
             startTime: newStart,
             duration: Math.max(0.1, d.originalDuration - shrink),
           });
        }
      } else if (d.type === 'trim-right') {
        updateClip(d.clipId, {
          duration: snap(Math.max(0.1, d.originalDuration + dt)),
        });
      }
    };

    const onUp = (e: MouseEvent) => {
      const d = dragRef.current;
      if (d && d.type === 'move') {
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
  }, [pps, snap, updateClip, recalcDuration, findTrackAtY, moveClipToTrack, trimMode]);

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
          setSelectedClipIds(new Set());
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l' && !e.shiftKey) {
        e.preventDefault();
        handleLinkSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l' && e.shiftKey) {
        e.preventDefault();
        handleUnlinkSelected();
        return;
      }
      if (e.key === ' ') { e.preventDefault(); togglePlay(); return; }
      if (e.key === 'ArrowLeft') { setCurrentTime(Math.max(0, currentTime - 1 / 30)); return; }
      if (e.key === 'ArrowRight') { setCurrentTime(currentTime + 1 / 30); return; }
      if (e.key === 'Home') { setCurrentTime(0); return; }
      if (e.key === 'End') { setCurrentTime(project.duration); return; }
      if (e.key === 'Escape') {
        selectClip(null);
        setSelectedClipIds(new Set());
        setClipCtxMenu(null);
        return;
      }
      // 줌 단축키: +/= 줌인, -/_ 줌아웃, 0 줌리셋
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setZoom(Math.min(10, zoom + 0.2));
        return;
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom(Math.max(0.1, zoom - 0.2));
        return;
      }
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setZoom(1);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedClipId, selectedClipIds, currentTime, tracks, project.duration,
      canUndo, canRedo, undo, redo, pushUndo, removeClip, selectClip,
      splitClip, addMarker, togglePlay, setCurrentTime,
      handleLinkSelected, handleUnlinkSelected, zoom, setZoom]);

  /* 드롭 처리 */
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

  const handleTrackDragEnd = useCallback(() => {
    if (dragTrackFrom != null && dragTrackTo != null && dragTrackFrom !== dragTrackTo) {
      pushUndo('트랙 재정렬');
      reorderTracks(dragTrackFrom, dragTrackTo);
    }
    setDragTrackFrom(null);
    setDragTrackTo(null);
  }, [dragTrackFrom, dragTrackTo, pushUndo, reorderTracks]);

  const setTrackRowRef = useCallback((trackId: string, el: HTMLDivElement | null) => {
    if (el) {
      trackRowRefs.current.set(trackId, el);
    } else {
      trackRowRefs.current.delete(trackId);
    }
  }, []);

  const canLink = config.showLinkedSelection && selectedClipIds.size === 2;
  const canUnlink = config.showLinkedSelection && selectedClipId != null &&
    (() => { const f = findClipAndTrack(selectedClipId); return !!f?.clip.linkedClipId; })();

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
      <TimelineToolbar selectedClipIds={selectedClipIds} />

      {/* ── I-2 FIX: 멀티 셀렉션 & 링크 바 ── */}
      {config.showLinkedSelection && selectedClipIds.size > 0 && (
        <div style={{
          height: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 8px',
          background: 'var(--bg-tertiary, #2a2a3c)',
          borderBottom: '1px solid var(--border-secondary, #333)',
          fontSize: 11,
          color: '#aaa',
          flexShrink: 0,
        }}>
          <span>선택: {selectedClipIds.size}개 클립</span>
          {selectedClipIds.size > 1 && (
            <span style={{ color: '#888', fontSize: 10 }}>
              (Shift+Click으로 멀티 선택)
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            disabled={!canLink}
            style={{
              padding: '2px 10px',
              fontSize: 11,
              border: 'none',
              borderRadius: 4,
              cursor: canLink ? 'pointer' : 'default',
              background: canLink ? 'var(--accent, #6c5ce7)' : 'var(--bg-secondary, #1e1e2e)',
              color: canLink ? '#fff' : '#555',
              opacity: canLink ? 1 : 0.5,
            }}
            onClick={handleLinkSelected}
            title="두 클립을 링크 (Ctrl+L)"
          >
            🔗 링크
          </button>
          <button
            disabled={!canUnlink}
            style={{
              padding: '2px 10px',
              fontSize: 11,
              border: 'none',
              borderRadius: 4,
              cursor: canUnlink ? 'pointer' : 'default',
              background: canUnlink ? '#e74c3c' : 'var(--bg-secondary, #1e1e2e)',
              color: canUnlink ? '#fff' : '#555',
              opacity: canUnlink ? 1 : 0.5,
            }}
            onClick={handleUnlinkSelected}
            title="링크 해제 (Ctrl+Shift+L)"
          >
            🔓 언링크
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
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

        <div
          ref={mainScrollRef}
          onScroll={() => syncScroll('main')}
          style={{ 
            flex: 1, 
            overflowX: 'scroll',
            overflowY: 'auto',
            position: 'relative' 
          }}
        >
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
            <MarkerTrack markers={markers} pps={pps} totalWidth={totalW} />
          </div>

          <div style={{
            position: 'relative',
            width: totalW,
            minHeight: totalTrackH + AUTO_ZONE_H,
          }}>
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

            {tracks.map(t => (
              <TrackRow
                key={t.id}
                ref={(el: HTMLDivElement | null) => setTrackRowRef(t.id, el)}
                track={t}
                assets={project.assets}
                pps={pps}
                selectedClipId={selectedClipId}
                selectedClipIds={selectedClipIds}
                onSelectClip={(id, e) => handleClipSelect(id, e?.shiftKey ?? false)}
                onMoveClip={(e, clipId) => handleMouseDown(e, clipId, t.id, 'move')}
                onTrimLeft={(e, clipId) => handleMouseDown(e, clipId, t.id, 'trim-left')}
                onTrimRight={(e, clipId) => handleMouseDown(e, clipId, t.id, 'trim-right')}
                onDrop={(e) => handleDrop(e, t.id)}
                onDragOver={handleDragOver}
                onClipContextMenu={handleClipContextMenu}
              />
            ))}

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

      {clipCtxMenu && (() => {
        const found = findClipAndTrack(clipCtxMenu.clipId);
        if (!found) return null;
        return (
          <ClipContextMenu
            clip={found.clip}
            trackId={clipCtxMenu.trackId}
            position={{ x: clipCtxMenu.x, y: clipCtxMenu.y }}
            onClose={() => setClipCtxMenu(null)}
          />
        );
      })()}
    </div>
  );
};

export default TimelinePanel;
