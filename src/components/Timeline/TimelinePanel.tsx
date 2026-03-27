import React, { useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import TimelineToolbar from './TimelineToolbar';
import { TrackHeader } from './TrackHeader';
import TrackRow from './TrackRow';
import { TimelineRuler } from './TimelineRuler';
import { Playhead } from './Playhead';
import { MarkerTrack } from './MarkerTrack';
import { snapTime } from '@/lib/core/snapEngine';
import { executeTrim } from '@/lib/core/trimEngine';

const PIXELS_PER_SECOND_BASE = 50;

export default function TimelinePanel() {
  const project = useEditorStore((s) => s.project);
  const zoom = useEditorStore((s) => s.zoom);
  const currentTime = useEditorStore((s) => s.currentTime);
  const inOut = useEditorStore((s) => s.inOut);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const markers = useEditorStore((s) => s.markers);
  const trimMode = useEditorStore((s) => s.trimMode);

  const {
    setCurrentTime, selectClip, addClip, updateClip, updateClips, splitClip, togglePlay,
  } = useEditorStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const pps = PIXELS_PER_SECOND_BASE * zoom;
  const totalWidth = project.duration * pps;

  // AUTO-SCROLL
  useEffect(() => {
    const unsub = useEditorStore.subscribe(
      (s) => s.currentTime,
      (t) => {
        if (!scrollRef.current) return;
        const scroll = scrollRef.current;
        const x = t * pps;
        const vs = scroll.scrollLeft;
        const ve = scroll.scrollLeft + scroll.offsetWidth;
        if (x > ve - 100) scroll.scrollLeft = x - 100;
        else if (x < vs + 100) scroll.scrollLeft = Math.max(0, x - 100);
      }
    );
    return unsub;
  }, [pps]);

  const dragRef = useRef<any>(null);
  const startDrag = useCallback((e: React.MouseEvent, type: any, clipId: string, trackId: string, origStart: number, origEnd: number) => {
    e.preventDefault();
    e.stopPropagation();
    selectClip(clipId);
    dragRef.current = { type, clipId, trackId, startX: e.clientX, origStart, origEnd };
    
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const d = dragRef.current;
      const dt = (ev.clientX - d.startX) / pps;
      const dur = d.origEnd - d.origStart;
      
      const st = (time: number) => snapTime(time, project.tracks, markers, inOut, currentTime, project.duration, snapEnabled, zoom);

      if (d.type === 'move') {
        const s = st(d.origStart + dt);
        updateClip(d.clipId, { timelineStart: s, timelineEnd: s + dur });
      } else {
        // Advanced Trimming using trimEngine
        const track = project.tracks.find(t => t.id === d.trackId);
        const clip = track?.clips.find(c => c.id === d.clipId);
        const asset = project.assets.find(a => a.id === clip?.assetId);
        if (!clip || !track) return;
        
        const side = d.type === 'trim-left' ? 'left' : 'right';
        const updates = executeTrim(clip, track, side, dt, trimMode, asset?.duration || 0);
        if (updates.length > 0) updateClips([...updates]);
      }
    };
    
    const onUp = () => { 
      dragRef.current = null; 
      window.removeEventListener('mousemove', onMove); 
      window.removeEventListener('mouseup', onUp); 
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pps, selectClip, updateClip, updateClips, snapEnabled, project.tracks, project.duration, project.assets, markers, inOut, currentTime, zoom, trimMode]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as any)?.tagName)) return;
      const { currentTime: ct, project: proj, setCurrentTime: setTime, splitClip: sClip, togglePlay: tPlay, selectedClipId: selId, addMarker: aMarker } = useEditorStore.getState();
      const step = 1 / (proj.fps || 30);

      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'PageDown' || e.key === 'PageUp' || e.key === 'Home' || e.key === 'End' || e.key === ' ') {
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.key === 'ArrowRight') setTime(ct + (e.shiftKey ? 1 : step));
        else if (e.key === 'ArrowLeft') setTime(ct - (e.shiftKey ? 1 : step));
        else if (e.key === 'PageDown') setTime(ct + 5);
        else if (e.key === 'PageUp') setTime(ct - 5);
        else if (e.key === 'Home') setTime(0);
        else if (e.key === 'End') setTime(proj.duration);
        else if (e.key === ' ') tPlay();
      } else if (e.key === 'c' || e.key === 'C') {
        if (selId) sClip(selId, ct);
      } else if (e.key === 'm' || e.key === 'M') {
        aMarker(ct);
      }
    };
    document.addEventListener('keydown', handleKey, { capture: true });
    return () => document.removeEventListener('keydown', handleKey, { capture: true });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    const assetId = e.dataTransfer.getData('assetId');
    const asset = project.assets.find(a => a.id === assetId);
    if (!asset || !scrollRef.current) return;
    const x = e.clientX - scrollRef.current.getBoundingClientRect().left + scrollRef.current.scrollLeft;
    addClip(trackId, { assetId, timelineStart: x / pps, timelineEnd: x / pps + asset.duration, sourceStart: 0, sourceEnd: asset.duration, speed: 1, opacity: 1, transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }, blendMode: 'normal', filters: [], locked: false });
  }, [project.assets, pps, addClip]);

  const handleRulerClick = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
    setCurrentTime(x / pps);
  };

  return (
    <div style={{ height: 'var(--timeline-height)', background: 'var(--bg-panel)', display: 'flex', flexDirection: 'column', borderTop: '2px solid var(--border)', overflow: 'hidden' }}>
      <TimelineToolbar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 120, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
          <div style={{ height: 28, borderBottom: '1px solid var(--border)' }} />
          <div style={{ height: 20 }} />
          {project.tracks.map(t => <TrackHeader key={t.id} track={t} />)}
        </div>

        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', position: 'relative' }} ref={scrollRef} tabIndex={-1} onMouseDown={(e) => { const top = e.currentTarget.getBoundingClientRect().top; if (e.clientY < top + 28) handleRulerClick(e); }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
            <TimelineRuler pps={pps} duration={project.duration} zoom={zoom} />
          </div>

          <div style={{ position: 'relative', width: totalWidth, minHeight: '100%', zIndex: 10 }}>
            <div style={{ height: 20 }} />
            {project.tracks.map(t => (
              <TrackRow 
                key={t.id} track={t} pps={pps} projectAssets={project.assets}
                selectedClipId={selectedClipId} onSelectClip={selectClip}
                onDropClip={(e) => handleDrop(e, t.id)}
                onDragOverTrack={(e) => e.preventDefault()}
                onMoveStart={(e, clip) => startDrag(e, 'move', clip.id, t.id, clip.timelineStart, clip.timelineEnd)}
                onTrimLeftStart={(e, clip) => startDrag(e, 'trim-left', clip.id, t.id, clip.timelineStart, clip.timelineEnd)}
                onTrimRightStart={(e, clip) => startDrag(e, 'trim-right', clip.id, t.id, clip.timelineStart, clip.timelineEnd)}
              />
            ))}
          </div>

          <div style={{ position: 'absolute', top: 0, left: 0, width: totalWidth, height: '100%', pointerEvents: 'none', zIndex: 200 }}>
            <MarkerTrack markers={markers} pps={pps} totalWidth={totalWidth} />
            <Playhead pps={pps} />
          </div>
        </div>
      </div>
    </div>
  );
}
