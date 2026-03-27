import React, { useEffect, useRef } from 'react';
import type { ThumbnailData } from '@/types/project';

type ThumbnailStripProps = {
  thumbnailData?: ThumbnailData;
  clipStart: number;
  clipEnd: number;
  sourceStart: number;
  sourceEnd: number;
  width: number;
  height: number;
};

export default function ThumbnailStrip({
  thumbnailData,
  clipStart,
  clipEnd,
  sourceStart,
  sourceEnd,
  width,
  height,
}: ThumbnailStripProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (!thumbnailData || !thumbnailData.frames.length) {
      ctx.fillStyle = 'var(--bg-secondary)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'var(--text-muted)';
      ctx.font = '11px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('Generating...', 8, height / 2);
      return;
    }

    const totalFrames = thumbnailData.frames.length;
    const interval = thumbnailData.interval;
    const clipSourceDuration = sourceEnd - sourceStart;
    
    // Calculate how many thumbnails we can fit in the physical width
    // Each thumbnail is approximately 160px wide at base zoom, 
    // but here we fill the 'width' with frames from the source range.
    const startFrame = Math.max(0, Math.floor(sourceStart / interval));
    const endFrame = Math.min(totalFrames - 1, Math.ceil(sourceEnd / interval));
    const frameRangeCount = Math.max(1, endFrame - startFrame + 1);

    const tileWidth = width / frameRangeCount;

    const drawFrame = (index: number, x: number) => {
      if (!thumbnailData.frames[index]) return;
      const img = new Image();
      img.src = thumbnailData.frames[index];
      img.onload = () => {
        ctx.drawImage(img, x, 0, tileWidth, height);
      };
    };

    for (let i = startFrame; i <= endFrame; i++) {
      drawFrame(i, (i - startFrame) * tileWidth);
    }
  }, [thumbnailData, sourceStart, sourceEnd, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ width, height }} />;
}

