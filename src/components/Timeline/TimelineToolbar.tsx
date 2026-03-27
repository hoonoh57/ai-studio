// src/components/Timeline/TimelineToolbar.tsx

import React, { useEffect, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { SKILL_CONFIGS } from '@/types/project';
import type { TrimMode } from '@/types/project';

const TOOLBAR_HEIGHT = 32;
const ZOOM_SLIDER_WIDTH = 80;
const ZOOM_SLIDER_HEIGHT = 4;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.1;
const FONT_SIZE_TOOL = 11;
const FONT_SIZE_ZOOM_LABEL = 10;

const VALID_TRIM_MODES: readonly TrimMode[] = [
  'normal',
  'ripple',
  'roll',
  'slip',
  'slide',
];

function isValidTrimMode(value: string): value is TrimMode {
  return VALID_TRIM_MODES.includes(value as TrimMode);
}

const styles = {
  toolbar: {
    height: TOOLBAR_HEIGHT,
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    gap: 8,
    flexShrink: 0,
  } as React.CSSProperties,
  toolBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: FONT_SIZE_TOOL,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 3,
    fontFamily: 'inherit',
  } as React.CSSProperties,
  toolBtnActive: {
    background: 'var(--accent)',
    color: '#fff',
  } as React.CSSProperties,
  select: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    color: 'var(--text-primary)',
    fontSize: FONT_SIZE_TOOL,
    padding: '2px 6px',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  zoomSlider: {
    width: ZOOM_SLIDER_WIDTH,
    height: ZOOM_SLIDER_HEIGHT,
    accentColor: 'var(--accent)',
  } as React.CSSProperties,
  spacer: {
    flex: 1,
  } as React.CSSProperties,
  zoomLabel: {
    fontSize: FONT_SIZE_ZOOM_LABEL,
    color: 'var(--text-muted)',
  } as React.CSSProperties,
} as const;

export function TimelineToolbar(): React.ReactElement {
  const trimMode = useEditorStore((s) => s.trimMode);
  const setTrimMode = useEditorStore((s) => s.setTrimMode);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const addMarker = useEditorStore((s) => s.addMarker);
  const setInPoint = useEditorStore((s) => s.setInPoint);
  const setOutPoint = useEditorStore((s) => s.setOutPoint);
  const currentTime = useEditorStore((s) => s.currentTime);
  const skillLevel = useEditorStore((s) => s.skillLevel);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const splitClip = useEditorStore((s) => s.splitClip);

  const config = SKILL_CONFIGS[skillLevel];
  const isExpert = skillLevel === 'expert';
  const showAdvancedTrim = config.showAdvancedTrim;

  const handleTrimModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (isValidTrimMode(value)) {
        setTrimMode(value);
      }
    },
    [setTrimMode],
  );

  const handleSplit = useCallback(() => {
    if (selectedClipId !== null) {
      splitClip(selectedClipId, currentTime);
    }
  }, [selectedClipId, splitClip, currentTime]);

  const handleZoomChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setZoom(parseFloat(e.target.value));
    },
    [setZoom],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const st = useEditorStore.getState();

      if (e.code === 'KeyI') {
        e.preventDefault();
        setInPoint(st.currentTime);
      }

      if (e.code === 'KeyO') {
        e.preventDefault();
        setOutPoint(st.currentTime);
      }

      if (e.code === 'KeyM') {
        e.preventDefault();
        const time = st.currentTime;
        const timestamp = new Date().toISOString().slice(11, 19);
        addMarker(time, `Marker ${timestamp}`, '#ffcc00');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setInPoint, setOutPoint, addMarker]);

  return (
    <div style={styles.toolbar}>
      {showAdvancedTrim && (
        <select
          style={styles.select}
          value={trimMode}
          onChange={handleTrimModeChange}
          title="Trim mode"
        >
          {VALID_TRIM_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </option>
          ))}
        </select>
      )}

      {isExpert && (
        <>
          <button
            style={styles.toolBtn}
            onClick={() => setInPoint(currentTime)}
            title="In point (I)"
          >
            I In
          </button>
          <button
            style={styles.toolBtn}
            onClick={() => setOutPoint(currentTime)}
            title="Out point (O)"
          >
            O Out
          </button>
          <button
            style={styles.toolBtn}
            onClick={() => addMarker(currentTime, 'Marker', '#ffcc00')}
            title="Add Marker (M)"
          >
            M Marker
          </button>
        </>
      )}

      <button
        style={{
          ...styles.toolBtn,
          ...(snapEnabled ? styles.toolBtnActive : {}),
        }}
        onClick={toggleSnap}
      >
        🧲 Snap
      </button>

      <button
        style={styles.toolBtn}
        title="Split (C)"
        onClick={handleSplit}
      >
        ✂ Split
      </button>

      <span style={styles.spacer} />

      <span style={styles.zoomLabel}>Zoom</span>
      <input
        type="range"
        min={ZOOM_MIN}
        max={ZOOM_MAX}
        step={ZOOM_STEP}
        value={zoom}
        onChange={handleZoomChange}
        style={styles.zoomSlider}
      />
    </div>
  );
}
