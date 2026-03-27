// src/components/Timeline/ThumbnailStrip.tsx

import React, { useRef, useEffect } from 'react';
import type { ThumbnailData } from '@/types/project';

type ThumbnailStripProps = {
  thumbnailData: ThumbnailData | null;
  clipStart: number;
  clipEnd: number;
  sourceStart: number;
  sourceEnd: number;
  width: number;
  height: number;
};

const FALLBACK_BG = '#16213e';
const FALLBACK_TEXT = '#6a6a99';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (src.length === 0) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function ThumbnailStrip({
  thumbnailData,
  clipStart,
  clipEnd,
  sourceStart,
  sourceEnd,
  width,
  height,
}: ThumbnailStripProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const ctx = canvas.getContext('2d');
    if (ctx === null) return;

    ctx.clearRect(0, 0, width, height);

    if (
      thumbnailData === null ||
      thumbnailData.frames.length === 0 ||
      thumbnailData.interval <= 0
    ) {
      ctx.fillStyle = FALLBACK_BG;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = FALLBACK_TEXT;
      ctx.font = '10px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('Generating...', 4, height / 2);
      return;
    }

    const { frames, interval } = thumbnailData;
    const totalFrames = frames.length;

    const startFrame = Math.max(
      0,
      Math.floor(sourceStart / interval),
    );
    const endFrame = Math.min(
      totalFrames - 1,
      Math.floor(sourceEnd / interval),
    );
    const count = Math.max(1, endFrame - startFrame + 1);
    const tileWidth = width / count;

    let cancelled = false;

    const drawAll = async () => {
      for (let i = 0; i < count; i++) {
        if (cancelled) return;

        const frameIndex = Math.min(startFrame + i, totalFrames - 1);
        const x = i * tileWidth;
        const img = await loadImage(frames[frameIndex]);

        if (cancelled) return;

        if (img !== null) {
          ctx.drawImage(img, x, 0, tileWidth, height);
        } else {
          ctx.fillStyle = FALLBACK_BG;
          ctx.fillRect(x, 0, tileWidth, height);
        }
      }
    };

    drawAll();

    return () => {
      cancelled = true;
    };
  }, [thumbnailData, sourceStart, sourceEnd, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, display: 'block' }}
    />
  );
}
