// src/components/Timeline/WaveformView.tsx

import React, { useRef, useEffect } from 'react';
import type { WaveformData } from '@/types/project';

type WaveformViewProps = {
  waveformData: WaveformData | null;
  clipStart: number;
  clipEnd: number;
  sourceStart: number;
  sourceEnd: number;
  width: number;
  height: number;
  color?: string;
};

const FALLBACK_COLOR = '#4caf50';
const FALLBACK_TEXT_COLOR = '#6a6a99';

export function WaveformView({
  waveformData,
  clipStart,
  clipEnd,
  sourceStart,
  sourceEnd,
  width,
  height,
  color,
}: WaveformViewProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const ctx = canvas.getContext('2d');
    if (ctx === null) return;

    ctx.clearRect(0, 0, width, height);

    if (waveformData === null || waveformData.peaks.length === 0) {
      ctx.fillStyle = FALLBACK_TEXT_COLOR;
      ctx.font = '10px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('Loading waveform...', 4, height / 2);
      return;
    }

    const { peaks, duration } = waveformData;
    const peakCount = peaks.length;

    const startRatio = sourceStart / duration;
    const endRatio = sourceEnd / duration;
    const startIndex = Math.max(0, Math.floor(startRatio * peakCount));
    const endIndex = Math.min(peakCount, Math.ceil(endRatio * peakCount));
    const segment = peaks.slice(startIndex, endIndex);

    if (segment.length === 0) return;

    const fillColor = color ?? FALLBACK_COLOR;
    const centerY = height / 2;
    const step = Math.max(1, segment.length / width);

    ctx.fillStyle = fillColor;

    for (let i = 0; i < width; i++) {
      const idx = Math.floor(i * step);
      const peak = segment[Math.min(idx, segment.length - 1)] ?? 0;
      const normalized = Math.min(1, Math.max(0, peak));
      const barHeight = normalized * centerY;

      ctx.fillRect(i, centerY - barHeight, 1, barHeight);
      ctx.fillRect(i, centerY, 1, barHeight);
    }
  }, [waveformData, sourceStart, sourceEnd, width, height, color]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, display: 'block' }}
    />
  );
}
