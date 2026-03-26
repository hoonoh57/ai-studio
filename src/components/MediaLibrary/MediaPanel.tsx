import React, { useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 'var(--media-panel-width)',
    minWidth: 220,
    background: 'var(--bg-panel)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border)',
  },
  dropZone: {
    margin: 8,
    padding: 20,
    border: '2px dashed var(--border-light)',
    borderRadius: 'var(--radius-md)',
    textAlign: 'center' as const,
    fontSize: 11,
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: 8,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'grab',
    fontSize: 11,
    color: 'var(--text-primary)',
    marginBottom: 4,
  },
  thumb: {
    width: 40,
    height: 28,
    borderRadius: 3,
    background: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    flexShrink: 0,
  },
  meta: {
    flex: 1,
    overflow: 'hidden',
  },
  name: {
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: 11,
  },
  size: {
    fontSize: 9,
    color: 'var(--text-muted)',
  },
};

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDur(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MediaPanel() {
  const assets = useEditorStore((s) => s.project.assets);
  const addAsset = useEditorStore((s) => s.addAsset);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('video') ? 'video' as const
        : file.type.startsWith('audio') ? 'audio' as const
        : 'image' as const;

      if (type === 'video') {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          addAsset({
            name: file.name,
            type,
            src: url,
            duration: video.duration || 10,
            width: video.videoWidth,
            height: video.videoHeight,
            fileSize: file.size,
          });
        };
        video.src = url;
      } else if (type === 'audio') {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => {
          addAsset({ name: file.name, type, src: url, duration: audio.duration || 10, fileSize: file.size });
        };
        audio.src = url;
      } else {
        addAsset({ name: file.name, type, src: url, duration: 5, fileSize: file.size });
      }
    });
  }, [addAsset]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div style={styles.panel}>
      <div style={styles.header}>Media Library ({assets.length})</div>
      <div
        style={styles.dropZone}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = 'video/*,audio/*,image/*';
          input.onchange = () => handleFiles(input.files);
          input.click();
        }}
      >
        📂 Drop files here or click to import
      </div>
      <div style={styles.list}>
        {assets.map((asset) => (
          <div
            key={asset.id}
            style={styles.item}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('assetId', asset.id)}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={styles.thumb}>
              {asset.type === 'video' ? '🎬' : asset.type === 'audio' ? '🎵' : '🖼️'}
            </div>
            <div style={styles.meta}>
              <div style={styles.name}>{asset.name}</div>
              <div style={styles.size}>
                {formatDur(asset.duration)} · {formatSize(asset.fileSize)}
                {asset.width ? ` · ${asset.width}×${asset.height}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
