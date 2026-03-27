import React from 'react';
import type { WaveformData } from '@/types/project';

type WaveformViewProps = {
  waveformData?: WaveformData;
  clipStart: number;
  clipEnd: number;
  sourceStart: number;
  sourceEnd: number;
  width: number;
  height: number;
  color?: string;
};

export default function WaveformView({
  waveformData,
  clipStart,
  clipEnd,
  sourceStart,
  sourceEnd,
  width,
  height,
  color = 'var(--clip-audio)',
}: WaveformViewProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (!waveformData || waveformData.peaks.length === 0) {
      ctx.fillStyle = 'var(--text-muted)';
      ctx.font = '11px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('Loading waveform...', 8, height / 2);
      return;
    }

    const { peaks, duration } = waveformData;
    const clipDuration = clipEnd - clipStart;
    const sourceDuration = sourceEnd - sourceStart;

    const startRatio = clipStart / duration;
    const endRatio = clipEnd / duration;
    const startIndex = Math.max(0, Math.floor(startRatio * peaks.length));
    const endIndex = Math.min(peaks.length, Math.ceil(endRatio * peaks.length));

    const segment = peaks.slice(startIndex, endIndex);
    const targetCount = width;
    const step = Math.max(1, segment.length / targetCount);

    ctx.fillStyle = color;

    for (let i = 0; i < targetCount; i += 1) {
      const idx = Math.floor(i * step);
      const peak = segment[Math.min(idx, segment.length - 1)] ?? 0;
      const normalized = Math.min(1, Math.max(0, peak));
      const lineHeight = normalized * (height / 2);
      const x = i;
      ctx.fillRect(x, height / 2 - lineHeight, 1, lineHeight);
      ctx.fillRect(x, height / 2, 1, lineHeight);
    }
  }, [waveformData, clipStart, clipEnd, sourceStart, sourceEnd, width, height, color]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ width, height }} />;
}
