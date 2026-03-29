// src/engines/webcodecExportEngine.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Smart Render Export Engine v5 — Mediabunny VideoSampleSource + NVENC HW 인코딩
// 검증된 API만 사용: VideoSampleSink(디코딩), VideoSampleSource(인코딩),
// EncodedAudioPacketSource(오디오 passthrough)
// ═══════════════════════════════════════════════════════════════════════════════

import {
  Input,
  Output,
  Mp4OutputFormat,
  BufferTarget,
  Conversion,
  VideoSampleSource,
  VideoSampleSink,
  VideoSample,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  BlobSource,
  ALL_FORMATS,
} from 'mediabunny';

import { analyzeTimeline } from './renderPlan';
import type { RenderPlan } from './renderPlan';
import type { ExportPreset, ExportProgress } from './exportEngine';
import type { Project, Track, Asset } from '@/types/project';

// ─── Public ──────────────────────────────────────────────────────────────────

export function isWebCodecsSupported(): boolean {
  return (
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoDecoder !== 'undefined' &&
    typeof AudioEncoder !== 'undefined' &&
    typeof AudioDecoder !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined'
  );
}

export interface WebCodecExportOptions {
  preset: ExportPreset;
  project: Project;
  rangeStart: number;
  rangeEnd: number;
  onProgress?: (p: ExportProgress) => void;
  onLog?: (msg: string) => void;
  abortSignal?: AbortSignal;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function parseBitrate(s: string): number {
  if (!s) return 8_000_000;
  const m = s.match(/(\d+)\s*[Mm]/);
  if (m) return parseInt(m[1]) * 1_000_000;
  const k = s.match(/(\d+)\s*[Kk]/);
  if (k) return parseInt(k[1]) * 1_000;
  const n = parseInt(s);
  if (!isNaN(n)) return n;
  return 8_000_000;
}

function makeProgress(
  phase: ExportProgress['phase'], percent: number,
  elapsedMs: number, message: string,
): ExportProgress {
  return {
    phase, percent: Math.round(percent), elapsedMs,
    estimatedRemainingMs: percent > 2 ? (elapsedMs / percent) * (100 - percent) : 0,
    message,
  };
}

async function fetchAsBlob(url: string): Promise<Blob> {
  const resp = await fetch(url);
  return resp.blob();
}

function resolveAudioCodecName(audioTrack: any): string {
  const name = String(audioTrack?.codec?.name || audioTrack?.codec?.id || audioTrack?.codec || '').toLowerCase();
  if (name.includes('aac') || name.includes('mp4a')) return 'aac';
  if (name.includes('opus')) return 'opus';
  if (name.includes('mp3') || name.includes('mpeg')) return 'mp3';
  if (name.includes('flac')) return 'flac';
  return 'aac';
}

// ─── Text Overlay ────────────────────────────────────────────────────────────

interface TextOverlayInfo {
  text: string;
  style: any;
}

function collectTextOverlays(tracks: Track[], time: number): TextOverlayInfo[] {
  const overlays: TextOverlayInfo[] = [];
  for (const track of tracks) {
    if (track.type !== 'text' || track.muted) continue;
    for (const clip of track.clips) {
      if (clip.disabled) continue;
      const tc = clip.textContent;
      if (!tc?.text) continue;
      const cs = clip.startTime;
      const ce = cs + clip.duration;
      if (time >= cs && time < ce) {
        overlays.push({ text: tc.text, style: tc.style });
      }
    }
  }
  return overlays;
}

function drawTextOverlays(
  ctx: OffscreenCanvasRenderingContext2D,
  overlays: TextOverlayInfo[], w: number, h: number,
): void {
  for (const { text, style: st } of overlays) {
    if (!text || !st) continue;
    const fontSize = Math.round((st.fontSize || 48) * (h / 1080));
    ctx.font = `${st.fontWeight || 700} ${fontSize}px ${st.fontFamily || 'Arial'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x = ((st.positionX ?? 50) / 100) * w;
    const y = ((st.positionY ?? 85) / 100) * h;

    // Background
    if (st.backgroundColor && st.backgroundColor !== 'transparent') {
      const met = ctx.measureText(text);
      const pad = fontSize * 0.3;
      ctx.fillStyle = st.backgroundColor;
      ctx.fillRect(x - met.width / 2 - pad, y - fontSize / 2 - pad, met.width + pad * 2, fontSize + pad * 2);
    }

    // Shadow
    ctx.shadowColor = st.shadowColor || 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = st.shadowBlur || 4;
    ctx.shadowOffsetX = st.shadowOffsetX || 2;
    ctx.shadowOffsetY = st.shadowOffsetY || 2;

    // Stroke
    if ((st.strokeWidth || 0) > 0) {
      ctx.strokeStyle = st.strokeColor || '#000';
      ctx.lineWidth = Math.round((st.strokeWidth || 2) * (h / 1080));
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
    }

    // Fill
    ctx.fillStyle = st.color || '#FFF';
    ctx.fillText(text, x, y);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export async function exportWithWebCodecs(opts: WebCodecExportOptions): Promise<Blob> {
  const { preset, project, rangeStart, rangeEnd, onProgress = () => {}, onLog = () => {}, abortSignal } = opts;

  const tracks: Track[] = project.tracks;
  const assets: Asset[] = project.assets;
  const t0 = performance.now();
  const totalDur = rangeEnd - rangeStart;
  const videoBitrate = parseBitrate(preset.videoBitrate);

  onLog('🚀 Smart Render 내보내기 엔진 v5 시작…');
  onLog(`📋 프리셋: ${preset.name} (${preset.width}x${preset.height} @${preset.fps}fps)`);

  // ═══ 1. Render Plan (분석용, 로그만) ═══
  const targetRes = { width: preset.width, height: preset.height };
  const plan = analyzeTimeline(tracks, assets, rangeStart, rangeEnd, targetRes);

  onLog(`📊 Render Plan: ${plan.segments.length}개 구간`);
  for (const seg of plan.segments) {
    onLog(`  [${seg.startTime.toFixed(1)}s~${seg.endTime.toFixed(1)}s] ${seg.type} (${(seg.endTime - seg.startTime).toFixed(1)}s) — ${seg.reasons.join(', ')}`);
  }
  onLog(`⚡ passthrough: ${plan.passthroughDuration.toFixed(1)}s | composite: ${plan.compositeDuration.toFixed(1)}s`);

  // ═══ 2. 소스 열기 ═══
  const vidTrackData = tracks.find(t => t.type === 'video' && !t.muted);
  if (!vidTrackData?.clips?.length) throw new Error('내보낼 비디오 클립이 없습니다');

  const mainClip = vidTrackData.clips[0];
  const mainAsset = assets.find(a => a.id === mainClip.assetId);
  if (!mainAsset?.src) throw new Error('소스 비디오 URL을 찾을 수 없습니다');

  onLog('📂 소스 파일 로딩…');
  const srcBlob = await fetchAsBlob(mainAsset.src);
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(srcBlob) });
  const vTrack = (await input.getPrimaryVideoTrack()) as any;
  const aTrack = (await input.getPrimaryAudioTrack()) as any;
  if (!vTrack) throw new Error('소스에 비디오 트랙이 없습니다');

  const srcW: number = vTrack.displayWidth;
  const srcH: number = vTrack.displayHeight;
  const srcSmaller = srcW <= targetRes.width && srcH <= targetRes.height;
  const outW = srcSmaller ? srcW : targetRes.width;
  const outH = srcSmaller ? srcH : targetRes.height;

  const stats = await vTrack.computePacketStats(100);
  const fps = stats.averagePacketRate || 30;
  const srcACodec = aTrack ? resolveAudioCodecName(aTrack) : null;
  const aDecCfg = aTrack ? await aTrack.getDecoderConfig() : null;

  onLog(`📐 소스: ${srcW}x${srcH} | 출력: ${outW}x${outH} | FPS: ${fps.toFixed(1)} | 오디오: ${srcACodec}`);

  // ═══ 3. 텍스트 없고 전체 passthrough → Transmux Fast Path ═══
  const hasComposite = plan.segments.some(s => s.type === 'composite' || s.type === 'transcode');
  if (!hasComposite && srcSmaller) {
    onLog('⚡ 텍스트/이펙트 없음 → Transmux 모드 (직접 복사)');
    return transmuxFastPath(input, rangeStart, rangeEnd, onProgress, onLog, t0, totalDur);
  }

  // ═══ 4. VideoSampleSource 기반 전체 인코딩 (NVENC HW 가속) ═══
  onLog('🔧 VideoSampleSource + NVENC HW 인코딩 모드');

  // HW 가속 확인
  let hwAccel: 'prefer-hardware' | 'no-preference' = 'no-preference';
  try {
    const r = await (VideoEncoder as any).isConfigSupported({
      codec: 'avc1.64001f', width: outW, height: outH,
      bitrate: videoBitrate, hardwareAcceleration: 'prefer-hardware',
    });
    if (r.supported) hwAccel = 'prefer-hardware';
  } catch {}
  onLog(`🎮 HW 가속: ${hwAccel === 'prefer-hardware' ? 'NVENC GPU ✅' : 'SW 폴백'}`);

  // Output 생성
  const outFmt = new Mp4OutputFormat({ fastStart: 'in-memory' });
  const bufTarget = new BufferTarget();
  const output = new Output({ format: outFmt, target: bufTarget });

  // 비디오: VideoSampleSource (Mediabunny가 인코딩 처리)
  const videoSource = new VideoSampleSource({
    codec: 'avc',
    bitrate: videoBitrate,
    hardwareAcceleration: hwAccel as any,
    keyFrameInterval: 2,
  });
  output.addVideoTrack(videoSource, { frameRate: fps } as any);

  // 오디오: EncodedAudioPacketSource (passthrough)
  let audioSource: EncodedAudioPacketSource | null = null;
  if (aTrack && srcACodec) {
    audioSource = new EncodedAudioPacketSource(srcACodec as any);
    output.addAudioTrack(audioSource);
  }

  await output.start();
  onLog('✅ Output 시작됨');

  // ═══ 5. 비디오: 디코드 → 캔버스(텍스트 합성) → VideoSampleSource ═══
  const vSampleSink = new VideoSampleSink(vTrack);
  const canvas = new OffscreenCanvas(outW, outH);
  const ctx = canvas.getContext('2d')!;

  let frameCount = 0;
  const totalFrames = Math.ceil(totalDur * fps);
  onLog(`🎬 비디오 인코딩 시작: ~${totalFrames} 프레임 (${totalDur.toFixed(1)}s)`);

  for await (const sample of vSampleSink.samples(rangeStart, rangeEnd)) {
    if (abortSignal?.aborted) throw new Error('내보내기 취소됨');

    // 캔버스에 원본 프레임 그리기
    ctx.clearRect(0, 0, outW, outH);
    // @ts-ignore
    sample.draw(ctx, 0, 0, outW, outH);

    // 텍스트 오버레이 합성
    const overlays = collectTextOverlays(tracks, sample.timestamp);
    if (overlays.length > 0) {
      drawTextOverlays(ctx, overlays, outW, outH);
    }

    // 캔버스 → 새 VideoSample → VideoSampleSource에 추가
    const newSample = new VideoSample(canvas, {
      timestamp: sample.timestamp,
      duration: sample.duration,
    });
    sample.close();

    await videoSource.add(newSample);
    newSample.close();

    frameCount++;
    if (frameCount % 60 === 0) {
      const pct = Math.min(95, (frameCount / totalFrames) * 100);
      const elapsed = performance.now() - t0;
      const fpsRate = (frameCount / (elapsed / 1000)).toFixed(1);
      onProgress(makeProgress('encoding', pct, elapsed,
        `비디오 ${frameCount}/${totalFrames} (${Math.round(pct)}%) · ${fpsRate} fps`));
    }
  }

  videoSource.close();
  onLog(`📹 비디오 완료: ${frameCount} 프레임`);

  // ═══ 6. 오디오: passthrough 패킷 복사 ═══
  if (audioSource && aTrack && aDecCfg) {
    onLog('🔊 오디오 패킷 복사 시작…');
    const aPktSink = new EncodedPacketSink(aTrack);
    const aStartPkt = await aPktSink.getPacket(rangeStart);
    let isFirstA = true;
    let ac = 0;

    const audioMeta = {
      decoderConfig: {
        codec: aDecCfg.codec,
        numberOfChannels: aDecCfg.numberOfChannels,
        sampleRate: aDecCfg.sampleRate,
        description: (aDecCfg as any).description,
      },
    };

    if (aStartPkt) {
      for await (const pkt of aPktSink.packets(aStartPkt)) {
        if (pkt.timestamp < rangeStart - 0.01) continue;
        if (pkt.timestamp >= rangeEnd) break;
        await audioSource.add(pkt, isFirstA ? (audioMeta as any) : undefined);
        isFirstA = false;
        ac++;
      }
    }
    audioSource.close();
    onLog(`🔊 오디오 완료: ${ac} packets`);
  }

  // ═══ 7. Finalize ═══
  onProgress(makeProgress('encoding', 98, performance.now() - t0, '파일 마무리 중…'));
  await output.finalize();

  const elapsed = performance.now() - t0;
  const resultBuf = (bufTarget as any).buffer;
  if (!resultBuf) throw new Error('출력 버퍼가 비어있습니다.');

  const blob = new Blob([resultBuf], { type: 'video/mp4' });
  const mb = (blob.size / 1048576).toFixed(1);
  const speed = (totalDur / (elapsed / 1000)).toFixed(1);
  const encFps = (frameCount / (elapsed / 1000)).toFixed(1);

  onLog(`✅ 완료: ${mb} MB · ${fmtTime(elapsed)} (${speed}x 실시간, ${encFps} fps)`);
  onProgress(makeProgress('done', 100, elapsed, `✅ 완료! ${mb} MB`));

  (input as any).dispose?.();
  return blob;
}

// ─── Transmux Fast Path (텍스트 없을 때 직접 복사) ─────────────────────────

async function transmuxFastPath(
  input: Input, start: number, end: number,
  onProgress: (p: ExportProgress) => void, onLog: (m: string) => void,
  t0: number, totalDur: number,
): Promise<Blob> {
  const outFmt = new Mp4OutputFormat({ fastStart: 'in-memory' });
  const bufTarget = new BufferTarget();
  const output = new Output({ format: outFmt, target: bufTarget });

  const conv = await Conversion.init({ input, output, trim: { start, end } });
  (conv as any).onProgress = (p: number) =>
    onProgress(makeProgress('encoding', Math.round(p * 100), performance.now() - t0, `복사 중… ${Math.round(p * 100)}%`));
  await (conv as any).execute();

  const elapsed = performance.now() - t0;
  const resultBuf = (bufTarget as any).buffer;
  if (!resultBuf) throw new Error('출력 버퍼가 비어있습니다.');

  const blob = new Blob([resultBuf], { type: 'video/mp4' });
  onLog(`✅ Transmux 완료: ${(blob.size / 1048576).toFixed(1)} MB · ${fmtTime(elapsed)} (${(totalDur / (elapsed / 1000)).toFixed(1)}x)`);
  onProgress(makeProgress('done', 100, elapsed, `✅ 완료! ${(blob.size / 1048576).toFixed(1)} MB`));
  (input as any).dispose?.();
  return blob;
}
