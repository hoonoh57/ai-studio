// src/components/MediaLibrary/MediaPanel.tsx
import React, { useRef, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { Asset } from '@/types/project';

/* ── 상수 ── */
const DROP_ZONE_HEIGHT = 80;
const DROP_ZONE_BORDER_RADIUS = 8;
const DROP_ZONE_FONT_SIZE = 13;
const ITEM_GAP = 8;
const ITEM_PADDING_V = 8;
const ITEM_PADDING_H = 10;
const ITEM_BORDER_RADIUS = 6;
const THUMB_SIZE = 36;
const THUMB_BORDER_RADIUS = 4;
const THUMB_FONT_SIZE = 18;
const NAME_FONT_SIZE = 12;
const META_FONT_SIZE = 10;
const HEADER_FONT_SIZE = 12;
const HEADER_PADDING_V = 8;
const HEADER_PADDING_H = 12;
const ACCEPTED_TYPES = ['video/', 'audio/', 'image/'];

/* ── 스타일 ── */
const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-panel)',
    color: 'var(--text-primary)',
    overflow: 'hidden',
  },
  header: {
    padding: `${HEADER_PADDING_V}px ${HEADER_PADDING_H}px`,
    fontSize: HEADER_FONT_SIZE,
    fontWeight: 600,
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropZone: {
    margin: ITEM_GAP,
    height: DROP_ZONE_HEIGHT,
    border: '2px dashed var(--border)',
    borderRadius: DROP_ZONE_BORDER_RADIUS,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: DROP_ZONE_FONT_SIZE,
    color: 'var(--text-secondary)',
    transition: 'border-color 0.2s, background 0.2s',
    flexShrink: 0,
  },
  dropZoneActive: {
    borderColor: 'var(--accent)',
    background: 'rgba(100, 150, 255, 0.08)',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: ITEM_GAP,
    display: 'flex',
    flexDirection: 'column',
    gap: ITEM_GAP,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: ITEM_GAP,
    padding: `${ITEM_PADDING_V}px ${ITEM_PADDING_H}px`,
    borderRadius: ITEM_BORDER_RADIUS,
    background: 'var(--bg-surface)',
    cursor: 'grab',
    transition: 'background 0.15s',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_BORDER_RADIUS,
    background: 'var(--bg-deep)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: THUMB_FONT_SIZE,
    overflow: 'hidden',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: NAME_FONT_SIZE,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  meta: {
    fontSize: META_FONT_SIZE,
    color: 'var(--text-secondary)',
    marginTop: 2,
  },
};

/* ── 헬퍼 ── */
const ICON_BY_TYPE: Record<string, string> = {
  video: '🎬',
  audio: '🎵',
  image: '🖼️',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(sec: number): string {
  if (isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function isAcceptedFile(file: File): boolean {
  return ACCEPTED_TYPES.some(t => file.type.startsWith(t));
}

function getAssetType(file: File): 'video' | 'audio' | 'image' {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'image';
}

function loadMediaMetadata(
  file: File,
  url: string,
): Promise<{ duration: number; width?: number; height?: number }> {
  return new Promise((resolve) => {
    const type = getAssetType(file);

    if (type === 'video') {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        });
      };
      video.onerror = () => resolve({ duration: 5 });
      video.src = url;
      return;
    }

    if (type === 'audio') {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        resolve({ duration: audio.duration });
      };
      audio.onerror = () => resolve({ duration: 5 });
      audio.src = url;
      return;
    }

    // image
    resolve({ duration: 5 });
  });
}

/* ── 컴포넌트 ── */
export function MediaPanel(): React.ReactElement {
  const assets = useEditorStore(s => s.project.assets);
  const addAsset = useEditorStore(s => s.addAsset);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(isAcceptedFile);

    for (const file of fileArray) {
      const url = URL.createObjectURL(file);
      const type = getAssetType(file);
      const meta = await loadMediaMetadata(file, url);

      const asset: Omit<Asset, 'id'> = {
        name: file.name,
        type,
        src: url,
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        fileSize: file.size,
      };
      addAsset(asset);
    }
  }, [addAsset]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  }, [processFiles]);

  const handleDragStart = useCallback((assetId: string, e: React.DragEvent) => {
    e.dataTransfer.setData('assetId', assetId);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  return (
    <div style={styles.panel}>
      {/* 헤더 */}
      <div style={styles.header}>
        <span>Media Library</span>
        <span style={{ opacity: 0.5 }}>{assets.length} items</span>
      </div>

      {/* 드롭존 */}
      <div
        style={{
          ...styles.dropZone,
          ...(isDragOver ? styles.dropZoneActive : {}),
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        Drop files or Click to Upload
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />

      {/* 에셋 목록 */}
      <div style={styles.list}>
        {assets.map((asset) => (
          <div
            key={asset.id}
            style={styles.item}
            draggable
            onDragStart={(e) => handleDragStart(asset.id, e)}
          >
            <div style={styles.thumb}>
              {asset.thumbnail ? (
                <img
                  src={asset.thumbnail}
                  alt={asset.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                ICON_BY_TYPE[asset.type] ?? '📁'
              )}
            </div>
            <div style={styles.info}>
              <div style={styles.name}>{asset.name}</div>
              <div style={styles.meta}>
                {formatDuration(asset.duration)}
                {asset.fileSize !== undefined && ` · ${formatFileSize(asset.fileSize)}`}
                {asset.width !== undefined && asset.height !== undefined &&
                  ` · ${asset.width}×${asset.height}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
