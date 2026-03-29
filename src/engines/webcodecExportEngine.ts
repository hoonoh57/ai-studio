/* ─── src/engines/webcodecExportEngine.ts ─── */
/* WebCodecs + Mediabunny 기반 하드웨어 가속 내보내기 엔진 */

import {
  Input,
  Output,
  Conversion,
  Mp4OutputFormat,
  BufferTarget,
  BlobSource,
  ALL_FORMATS,
  type VideoSample,
} from 'mediabunny';

import type { ExportPreset, ExportProgress, ProgressCallback } from './exportEngine';
import type { Track, Clip, Asset } from '@/types/project';
import type { TextStyle } from '@/types/textClip';

/* ═══ WebCodecs 지원 검사 ═══ */

export function isWebCodecsSupported(): boolean {
  return (
    typeof globalThis.VideoEncoder !== 'undefined' &&
    typeof globalThis.VideoDecoder !== 'undefined' &&
    typeof globalThis.AudioEncoder !== 'undefined' &&
    typeof globalThis.AudioDecoder !== 'undefined'
  );
}

/* ═══ 비트레이트 매핑 ═══ */

function presetToBitrate(preset: ExportPreset): number {
  // "8M" → 8_000_000
  const match = preset.videoBitrate.match(/^(\d+)([MKk]?)$/);
  if (!match) return 8_000_000;
  const num = parseInt(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'M') return num * 1_000_000;
  if (unit === 'K') return num * 1_000;
  return num;
}

function presetToAudioBitrate(preset: ExportPreset): number {
  const match = preset.audioBitrate.match(/^(\d+)([Kk]?)$/);
  if (!match) return 192_000;
  const num = parseInt(match[1]);
  return match[2] ? num * 1_000 : num;
}

/* ═══ 텍스트 렌더링 (Canvas 네이티브) ═══ */

interface TextOverlay {
  text: string;
  style: TextStyle;
  enableStart: number; // 초
  enableEnd: number;   // 초
}

function collectTextOverlays(
  textTracks: Track[],
  rangeStart: number,
  rangeEnd: number,
): TextOverlay[] {
  const overlays: TextOverlay[] = [];

  for (const track of textTracks) {
    for (const clip of track.clips) {
      if (clip.disabled || !clip.textContent) continue;
      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd <= rangeStart || clip.startTime >= rangeEnd) continue;

      overlays.push({
        text: clip.textContent.text,
        style: clip.textContent.style,
        enableStart: Math.max(0, clip.startTime - rangeStart),
        enableEnd: Math.min(rangeEnd - rangeStart, clipEnd - rangeStart),
      });
    }
  }
  return overlays;
}

function drawTextOverlays(
  ctx: OffscreenCanvasRenderingContext2D,
  overlays: TextOverlay[],
  timestamp: number, // 초
  canvasW: number,
  canvasH: number,
): void {
  for (const ov of overlays) {
    if (timestamp < ov.enableStart || timestamp > ov.enableEnd) continue;

    const st = ov.style;
    const fontSize = Math.round(st.fontSize * (canvasH / 1080));
    const x = (st.positionX / 100) * canvasW;
    const y = (st.positionY / 100) * canvasH;

    ctx.save();
    ctx.textAlign = st.textAlign as CanvasTextAlign;
    ctx.textBaseline = 'middle';

    // 폰트 설정 — 브라우저 네이티브 폰트 사용 (VF/OTF/TTF 모두 지원)
    const fontStyle = st.fontStyle === 'italic' ? 'italic ' : '';
    ctx.font = `${fontStyle}${st.fontWeight} ${fontSize}px ${st.fontFamily || 'Noto Sans KR, sans-serif'}`;

    // 배경 박스
    if (st.backgroundColor && st.backgroundColor !== 'transparent') {
      const metrics = ctx.measureText(ov.text);
      const pad = 6;
      const bx = x - metrics.actualBoundingBoxLeft - pad;
      const by = y - fontSize / 2 - pad;
      const bw = metrics.width + pad * 2;
      const bh = fontSize + pad * 2;
      ctx.fillStyle = st.backgroundColor;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(bx, by, bw, bh);
      ctx.globalAlpha = 1;
    }

    // 그림자
    if (st.shadowBlur > 0) {
      ctx.shadowColor = st.shadowColor || 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = st.shadowBlur;
      ctx.shadowOffsetX = st.shadowOffsetX || 2;
      ctx.shadowOffsetY = st.shadowOffsetY || 2;
    }

    // 외곽선 (먼저 그림)
    if (st.strokeWidth > 0) {
      ctx.strokeStyle = st.strokeColor || '#000000';
      ctx.lineWidth = st.strokeWidth * (canvasH / 1080);
      ctx.lineJoin = 'round';
      ctx.strokeText(ov.text, x, y);
    }

    // 본문 텍스트
    ctx.fillStyle = st.color || '#FFFFFF';
    ctx.shadowColor = 'transparent'; // 외곽선에만 그림자 적용 후 해제
    if (st.shadowBlur > 0) {
      ctx.shadowColor = st.shadowColor || 'rgba(0,0,0,0.8)';
    }
    ctx.fillText(ov.text, x, y);

    ctx.restore();
  }
}

/* ═══ 단일 클립 내보내기 (Mediabunny Conversion API) ═══ */

export interface WebCodecExportOptions {
  preset: ExportPreset;
  project: {
    tracks: Track[];
    assets: Asset[];
    duration: number;
  };
  rangeStart: number;
  rangeEnd: number;
  onProgress: ProgressCallback;
  onLog: (msg: string) => void;
}

export async function exportWithWebCodecs(
  opts: WebCodecExportOptions,
): Promise<Blob> {
  const { preset, project, rangeStart, rangeEnd, onProgress, onLog } = opts;
  const t0 = performance.now();

  /* ── 1. 비디오 클립 수집 ── */
  const videoClips: { clip: Clip; asset: Asset }[] = [];
  for (const track of project.tracks) {
    if (track.type !== 'video') continue;
    const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime);
    for (const clip of sorted) {
      if (clip.disabled) continue;
      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd <= rangeStart || clip.startTime >= rangeEnd) continue;
      const asset = project.assets.find(a => a.id === clip.assetId);
      if (!asset?.src) continue;
      videoClips.push({ clip, asset });
    }
  }

  if (videoClips.length === 0) {
    throw new Error('내보낼 비디오 클립이 없습니다.');
  }

  /* ── 텍스트 오버레이 준비 ── */
  const textTracks = project.tracks.filter(t => t.type === 'text');
  const textOverlays = collectTextOverlays(textTracks, rangeStart, rangeEnd);
  const hasText = textOverlays.length > 0;
  if (hasText) {
    onLog(`텍스트 오버레이 ${textOverlays.length}개 준비 완료`);
  }

  /* ── 2. 단일 클립 처리 (가장 일반적인 경우) ── */
  if (videoClips.length === 1) {
    return exportSingleClip(videoClips[0], opts, textOverlays, t0);
  }

  /* ── 3. 다중 클립: 각각 변환 후 이어붙이기 ── */
  // Mediabunny의 Output에 순차적으로 프레임을 공급
  return exportMultiClip(videoClips, opts, textOverlays, t0);
}

async function exportSingleClip(
  vc: { clip: Clip; asset: Asset },
  opts: WebCodecExportOptions,
  textOverlays: TextOverlay[],
  t0: number,
): Promise<Blob> {
  const { preset, rangeStart, rangeEnd, onProgress, onLog } = opts;
  const { clip, asset } = vc;
  const hasText = textOverlays.length > 0;

  onLog(`🚀 WebCodecs 시작: ${asset.name} (${preset.width}x${preset.height})`);
  onProgress({
    phase: 'loading', percent: 5, elapsedMs: 0,
    estimatedRemainingMs: 0, message: '소스 파일 로딩 중…',
  });

  // asset.src를 Blob으로 변환
  const blob = await fetchAsBlob(asset.src);

  // Mediabunny Input
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(blob),
  });

  // Mediabunny Output
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });

  // 트림 범위 계산
  const clipStart = Math.max(clip.startTime, rangeStart);
  const clipEnd = Math.min(clip.startTime + clip.duration, rangeEnd);
  const ss = (clip.inPoint || 0) + (clipStart - clip.startTime);
  const dur = clipEnd - clipStart;

  // ★ 핵심: 소스 해상도/코덱 확인하여 transmux 가능 여부 판단
  const videoTrack = await input.getPrimaryVideoTrack() as any;
  const srcW = videoTrack?.displayWidth ?? 0;
  const srcH = videoTrack?.displayHeight ?? 0;
  
  const sizesMatch = (
    (Math.abs(srcW - preset.width) <= 2 && Math.abs(srcH - preset.height) <= 2) ||
    (Math.abs(srcW - preset.height) <= 2 && Math.abs(srcH - preset.width) <= 2)
  );
  const needsResize = !sizesMatch;
  onLog(`📐 소스: ${srcW}x${srcH}, 타겟: ${preset.width}x${preset.height}, resize=${needsResize}`);

  const needsTranscode = hasText || needsResize;

  if (needsTranscode) {
    onLog(`트랜스코딩 모드: resize=${needsResize}, text=${hasText}`);
  } else {
    onLog(`⚡ Transmux 모드: 동일 해상도 (${srcW}x${srcH}), 텍스트 없음 → 미디어 직접 복사`);
  }

  onLog(`트림: ss=${ss.toFixed(2)}s, dur=${dur.toFixed(2)}s`);
  onProgress({
    phase: 'encoding', percent: 10, elapsedMs: performance.now() - t0,
    estimatedRemainingMs: 0, message: needsTranscode ? '트랜스코딩 준비…' : 'Transmux 준비…',
  });

  // Canvas for text overlay
  let ctx: OffscreenCanvasRenderingContext2D | null = null;

  const conversionOpts: any = {
    input,
    output,
    trim: { start: ss, end: ss + dur },
    audio: needsTranscode
      ? { codec: 'aac', bitrate: presetToAudioBitrate(preset) }
      : {},  // transmux: 오디오도 직접 복사
  };

  if (needsTranscode) {
    // 재인코딩 필요한 경우만 video 옵션 지정
    conversionOpts.video = {
      width: preset.width,
      height: preset.height,
      fit: 'contain',
      frameRate: preset.fps,
      codec: 'avc',
      bitrate: presetToBitrate(preset),
      hardwareAcceleration: 'prefer-hardware',
      ...(hasText ? {
        process: (sample: VideoSample) => {
          if (!ctx) {
            const canvas = new OffscreenCanvas(preset.width, preset.height);
            ctx = canvas.getContext('2d')!;
          }
          ctx.clearRect(0, 0, preset.width, preset.height);
          sample.draw(ctx, 0, 0, preset.width, preset.height);

          // 텍스트 오버레이 합성
          drawTextOverlays(ctx, textOverlays, sample.timestamp - ss, preset.width, preset.height);

          return ctx.canvas;
        },
      } : {}),
    };
  }
  // needsTranscode === false 이면 video 옵션을 아예 안 줌
  // → Mediabunny가 자동으로 transmux (직접 복사)

  const conversion: any = await Conversion.init(conversionOpts);

  if (conversion.isValid === false) {
    const reasons = (conversion.discardedTracks || [])
      .map((dt: any) => `${dt.track}: ${dt.reason}`)
      .join(', ');
    throw new Error(`변환 불가: ${reasons}`);
  }

  // 진행 상황 모니터링
  conversion.onProgress = (progress: number) => {
    const elapsed = performance.now() - t0;
    const pct = Math.round(10 + progress * 85);
    const remaining = pct > 5 ? (elapsed / pct) * (100 - pct) : 0;
    onProgress({
      phase: 'encoding', percent: pct, elapsedMs: elapsed,
      estimatedRemainingMs: remaining,
      message: needsTranscode
        ? `트랜스코딩 중… ${pct}% (HW 가속)`
        : `Transmux 중… ${pct}% (직접 복사)`,
    });
  };

  await conversion.execute();

  const buffer = (output.target as any).buffer!;
  if (!buffer) throw new Error('출력 버퍼가 비어있습니다.');
  
  const result = new Blob([buffer], { type: 'video/mp4' });

  const elapsed = performance.now() - t0;
  const speed = (dur / (elapsed / 1000)).toFixed(1);
  onLog(`✅ 완료: ${(result.size / 1024 / 1024).toFixed(1)} MB · ${fmtTime(elapsed)} (${speed}x 실시간)`);
  onProgress({
    phase: 'done', percent: 100, elapsedMs: elapsed,
    estimatedRemainingMs: 0,
    message: `✅ 완료! ${(result.size / 1024 / 1024).toFixed(1)} MB · ${fmtTime(elapsed)} (${speed}x)`,
  });

  return result;
}

async function exportMultiClip(
  videoClips: { clip: Clip; asset: Asset }[],
  opts: WebCodecExportOptions,
  textOverlays: TextOverlay[],
  t0: number,
): Promise<Blob> {
  const { preset, rangeStart, rangeEnd, onProgress, onLog } = opts;
  const hasText = textOverlays.length > 0;

  onLog(`🚀 WebCodecs: 다중 클립 (${videoClips.length}개) 인코딩 시작`);

  const {
    Output: MBOutput,
    Mp4OutputFormat: MBMp4,
    BufferTarget: MBBuffer,
    CanvasSource: MBCanvasSource,
    VideoSampleSink,
  } = await import('mediabunny');

  const canvas = new OffscreenCanvas(preset.width, preset.height);
  const ctx = canvas.getContext('2d')!;

  const output = new MBOutput({
    format: new MBMp4({ fastStart: 'in-memory' }),
    target: new MBBuffer(),
  });

  const videoSource = new MBCanvasSource(canvas, {
    codec: 'avc',
    bitrate: presetToBitrate(preset),
    hardwareAcceleration: 'prefer-hardware',
    width: preset.width,
    height: preset.height,
  } as any);
  output.addVideoTrack(videoSource, { frameRate: preset.fps });

  await output.start();

  let globalTime = 0;
  const frameDur = 1 / preset.fps;

  for (let i = 0; i < videoClips.length; i++) {
    const { clip, asset } = videoClips[i];
    const clipStart = Math.max(clip.startTime, rangeStart);
    const clipEnd = Math.min(clip.startTime + clip.duration, rangeEnd);
    const ss = (clip.inPoint || 0) + (clipStart - clip.startTime);
    const dur = clipEnd - clipStart;
    if (dur <= 0.01) continue;

    onLog(`클립 ${i + 1}/${videoClips.length}: ${asset.name} (${dur.toFixed(1)}s)`);
    onProgress({
      phase: 'encoding',
      percent: Math.round(10 + (i / videoClips.length) * 80),
      elapsedMs: performance.now() - t0,
      estimatedRemainingMs: 0,
      message: `세그먼트 ${i + 1}/${videoClips.length} (HW 가속)…`,
    });

    try {
      const blob = await fetchAsBlob(asset.src);
      const clipInput = new Input({
        formats: ALL_FORMATS,
        source: new BlobSource(blob),
      });

      const videoTrack = await clipInput.getPrimaryVideoTrack();
      if (!videoTrack) continue;

      const decodable = await videoTrack.canDecode();
      if (!decodable) {
        onLog(`⚠️ 클립 ${i + 1} 디코딩 불가 — 건너뜀`);
        continue;
      }

      const sink = new VideoSampleSink(videoTrack);

      for await (const sample of sink.samples(ss, ss + dur)) {
        ctx.clearRect(0, 0, preset.width, preset.height);
        sample.draw(ctx, 0, 0, preset.width, preset.height);

        if (hasText) {
          const absoluteTime = clipStart - rangeStart + (sample.timestamp - ss);
          drawTextOverlays(ctx, textOverlays, absoluteTime, preset.width, preset.height);
        }

        await videoSource.add(globalTime, frameDur);
        globalTime += frameDur;
      }
    } catch (err: any) {
      onLog(`⚠️ 클립 ${i + 1} 처리 중 오류: ${err.message}`);
    }
  }

  await output.finalize();

  const buffer = (output.target as any).buffer!;
  if (!buffer) throw new Error('출력 버퍼 생성 실패');
  
  const result = new Blob([buffer], { type: 'video/mp4' });

  onLog(`✅ 완료: ${(result.size / 1024 / 1024).toFixed(1)} MB · ${fmtTime(performance.now() - t0)}`);
  onProgress({
    phase: 'done', percent: 100, elapsedMs: performance.now() - t0,
    estimatedRemainingMs: 0,
    message: `✅ 완료! ${(result.size / 1024 / 1024).toFixed(1)} MB`,
  });

  return result;
}

/* ═══ 유틸리티 ═══ */

async function fetchAsBlob(src: string): Promise<Blob> {
  if (src.startsWith('blob:') || src.startsWith('data:')) {
    const res = await fetch(src);
    return res.blob();
  }
  const res = await fetch(src);
  return res.blob();
}

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
