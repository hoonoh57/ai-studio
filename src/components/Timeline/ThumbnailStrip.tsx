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
    const clipDuration = clipEnd - clipStart;
    const startFrame = Math.max(0, Math.floor((clipStart / interval)));
    const endFrame = Math.min(totalFrames - 1, Math.floor((clipEnd / interval)));
    const count = Math.max(1, endFrame - startFrame + 1);

    const tileWidth = width / count;

    const drawFrame = (index: number, x: number) => {
      const img = new Image();
      img.src = thumbnailData.frames[index];
      img.onload = () => {
        ctx.drawImage(img, x, 0, tileWidth, height);
      };
      img.onerror = () => {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(x, 0, tileWidth, height);
      };
    };

    for (let i = startFrame; i <= endFrame; i += 1) {
      drawFrame(i, (i - startFrame) * tileWidth);
    }
  }, [thumbnailData, clipStart, clipEnd, sourceStart, sourceEnd, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ width, height }} />;
}

