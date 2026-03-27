// src/components/MediaLibrary/ImportDropZone.tsx

import React, { useRef, useCallback, useState } from 'react';

const DROP_ZONE_HEIGHT = 72;
const DROP_ZONE_RADIUS = 8;
const DROP_ZONE_FONT_SIZE = 12;
const ICON_FONT_SIZE = 20;
const ACCEPTED_TYPES = ['video/', 'audio/', 'image/'];

const styles: Record<string, React.CSSProperties> = {
  zone: {
    margin: 8,
    height: DROP_ZONE_HEIGHT,
    border: '2px dashed var(--border)',
    borderRadius: DROP_ZONE_RADIUS,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: DROP_ZONE_FONT_SIZE,
    color: 'var(--text-secondary)',
    transition: 'border-color 0.2s, background 0.2s',
    flexShrink: 0,
    gap: 4,
  },
  zoneActive: {
    borderColor: 'var(--accent)',
    background: 'rgba(100, 150, 255, 0.08)',
    color: 'var(--text-primary)',
  },
  icon: {
    fontSize: ICON_FONT_SIZE,
  },
};

interface ImportDropZoneProps {
  readonly onFiles: (files: File[]) => void;
}

function isAcceptedFile(file: File): boolean {
  return ACCEPTED_TYPES.some(t => file.type.startsWith(t));
}

export function ImportDropZone({ onFiles }: ImportDropZoneProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const accepted = Array.from(e.dataTransfer.files).filter(isAcceptedFile);
    if (accepted.length > 0) {
      onFiles(accepted);
    }
  }, [onFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const accepted = Array.from(e.target.files).filter(isAcceptedFile);
      if (accepted.length > 0) {
        onFiles(accepted);
      }
      e.target.value = '';
    }
  }, [onFiles]);

  return (
    <>
      <div
        style={{
          ...styles.zone,
          ...(isDragOver ? styles.zoneActive : {}),
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <span style={styles.icon}>📂</span>
        <span>파일 추가 / 드래그 & 드롭</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />
    </>
  );
}
