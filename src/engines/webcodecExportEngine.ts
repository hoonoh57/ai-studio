// src/engines/webcodecExportEngine.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Smart Render Export Engine v3 — ExportPanel.tsx 호출 시그니처에 정확히 맞춤
// 호출: exportWithWebCodecs({ preset, project, rangeStart, rangeEnd, onProgress, onLog })
// ═══════════════════════════════════════════════════════════════════════════════

import {
  Input,
  Output,
  Mp4OutputFormat,
  BufferTarget,
  Conversion,
  EncodedVideoPacketSource,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  VideoSampleSink,
  EncodedPacket,
  BlobSource,
  ALL_FORMATS,
} from 'mediabunny';

import { analyzeTimeline } from './renderPlan';
import type { RenderPlan, RenderSegment } from './renderPlan';
import type { ExportPreset, ExportProgress } from './exportEngine';
import type { Project, Track, Asset } from '@/types/project';

// ─── Public Interface (ExportPanel.tsx 호출 시그니처 일치) ────────────────────

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
  /** ExportPreset 객체 (exportEngine.ts에서 정의) */
  preset: ExportPreset;
  /** 전체 프로젝트 (tracks + assets 포함) */
  project: Project;
  /** 내보내기 시작 시간 (초) */
  rangeStart: number;
  /** 내보내기 끝 시간 (초) */
  rangeEnd: number;
  /** 진행률 콜백 */
  onProgress?: (p: ExportProgress) => void;
  /** 로그 콜백 */
  onLog?: (msg: string) => void;
  /** 취소 시그널 */
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

async function fetchAsBlob(url: string): Promise<Blob> {
  const resp = await fetch(url);
  return resp.blob();
}

function makeProgress(
  phase: ExportProgress['phase'],
  percent: number,
  elapsedMs: number,
  message: string,
): ExportProgress {
  return {
    phase,
    percent: Math.round(percent),
    elapsedMs,
    estimatedRemainingMs: percent > 2 ? (elapsedMs / percent) * (100 - percent) : 0,
    message,
  };
}

// ─── Text Overlay (Canvas 2D로 그리기) ───────────────────────────────────────

interface TextOverlayInfo {
  text: string;
  style: {
    fontFamily: string; fontSize: number; fontWeight: number;
    color: string; backgroundColor: string;
    strokeColor: string; strokeWidth: number;
    shadowColor: string; shadowBlur: number;
    shadowOffsetX: number; shadowOffsetY: number;
    positionX: number; positionY: number;
  };
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
        overlays.push({ text: tc.text, style: tc.style as any });
      }
    }
  }
  return overlays;
}

function drawTextOverlays(
  ctx: OffscreenCanvasRenderingContext2D,
  overlays: TextOverlayInfo[],
  w: number,
  h: number,
): void {
  for (const { text, style: st } of overlays) {
    if (!text) continue;
    const fontSize = Math.round(st.fontSize * (h / 1080));
    ctx.font = `${st.fontWeight} ${fontSize}px ${st.fontFamily || 'Arial'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x = (st.positionX / 100) * w;
    const y = (st.positionY / 100) * h;

    // Background
    if (st.backgroundColor && st.backgroundColor !== 'transparent') {
      const met = ctx.measureText(text);
      const pad = fontSize * 0.3;
      ctx.fillStyle = st.backgroundColor;
      ctx.fillRect(
        x - met.width / 2 - pad,
        y - fontSize / 2 - pad,
        met.width + pad * 2,
        fontSize + pad * 2,
      );
    }

    // Shadow
    ctx.shadowColor = st.shadowColor || 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = st.shadowBlur || 4;
    ctx.shadowOffsetX = st.shadowOffsetX || 2;
    ctx.shadowOffsetY = st.shadowOffsetY || 2;

    // Stroke
    if (st.strokeWidth > 0) {
      ctx.strokeStyle = st.strokeColor || '#000';
      ctx.lineWidth = Math.round(st.strokeWidth * (h / 1080));
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
    }

    // Fill
    ctx.fillStyle = st.color || '#FFF';
    ctx.fillText(text, x, y);

    // Reset
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
}

// ─── Manual Video Encoder ────────────────────────────────────────────────────

class ManualVideoEncoder {
  private encoder: VideoEncoder;
  private queue: Array<{ packet: EncodedPacket; meta?: EncodedVideoChunkMetadata }> = [];
  private waiter: (() => void) | null = null;
  private err: Error | null = null;
  private kfInterval: number;
  private count = 0;

  constructor(cfg: {
    codec: string; width: number; height: number;
    bitrate: number; fps?: number; keyFrameIntervalSec?: number;
  }) {
    const fps = cfg.fps || 30;
    this.kfInterval = Math.round((cfg.keyFrameIntervalSec || 5) * fps);

    this.encoder = new VideoEncoder({
      output: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => {
        const buf = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buf);
        this.queue.push({
          packet: new EncodedPacket(
            buf,
            chunk.type as 'key' | 'delta',
            chunk.timestamp / 1e6,
            (chunk.duration || 0) / 1e6,
          ),
          meta,
        });
        this.waiter?.();
        this.waiter = null;
      },
      error: (e: DOMException) => {
        this.err = e as unknown as Error;
        this.waiter?.();
        this.waiter = null;
      },
    });

    this.encoder.configure({
      codec: cfg.codec,
      width: cfg.width,
      height: cfg.height,
      bitrate: cfg.bitrate,
      hardwareAcceleration: 'prefer-hardware',
      bitrateMode: 'variable',
    });
  }

  async encode(
    frame: VideoFrame,
  ): Promise<Array<{ packet: EncodedPacket; meta?: EncodedVideoChunkMetadata }>> {
    if (this.err) throw this.err;
    const kf = this.count % this.kfInterval === 0;
    this.count++;
    this.encoder.encode(frame, { keyFrame: kf });
    frame.close();

    if (this.queue.length === 0) {
      await new Promise<void>((r) => {
        this.waiter = r;
        setTimeout(r, 50);
      });
    }
    return this.queue.splice(0);
  }

  async flush(): Promise<Array<{ packet: EncodedPacket; meta?: EncodedVideoChunkMetadata }>> {
    await this.encoder.flush();
    return this.queue.splice(0);
  }

  close(): void {
    try { this.encoder.close(); } catch { /* ignore */ }
  }
}

// ─── Metadata Builders ───────────────────────────────────────────────────────

function buildVideoMeta(
  dec: VideoDecoderConfig,
  codec: string,
): EncodedVideoChunkMetadata {
  return {
    decoderConfig: {
      codec,
      codedWidth: dec.codedWidth,
      codedHeight: dec.codedHeight,
      colorSpace: (dec as any).colorSpace,
      description: (dec as any).description,
    },
  } as EncodedVideoChunkMetadata;
}

function buildAudioMeta(dec: AudioDecoderConfig): EncodedAudioChunkMetadata {
  return {
    decoderConfig: {
      codec: dec.codec,
      numberOfChannels: dec.numberOfChannels,
      sampleRate: dec.sampleRate,
      description: (dec as any).description,
    },
  } as EncodedAudioChunkMetadata;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export async function exportWithWebCodecs(opts: WebCodecExportOptions): Promise<Blob> {
  const {
    preset,
    project,
    rangeStart,
    rangeEnd,
    onProgress = () => {},
    onLog = () => {},
    abortSignal,
  } = opts;

  // ── project에서 tracks, assets 추출 ──
  const tracks: Track[] = project.tracks;
  const assets: Asset[] = project.assets;

  const t0 = performance.now();
  const totalDur = rangeEnd - rangeStart;
  const videoBitrate = parseBitrate(preset.videoBitrate);

  onLog('🚀 Smart Render 내보내기 엔진 시작…');
  onLog(`📋 프리셋: ${preset.name} (${preset.width}x${preset.height} @${preset.fps}fps)`);

  // ═══ 1. Render Plan ═══════════════════════════════════════════════════════
  const targetRes = { width: preset.width, height: preset.height };
  const plan: RenderPlan = analyzeTimeline(tracks, assets, rangeStart, rangeEnd, targetRes);

  onLog(`📊 Render Plan: ${plan.segments.length}개 구간`);
  for (const seg of plan.segments) {
    const d = (seg.endTime - seg.startTime).toFixed(1);
    onLog(`  [${seg.startTime.toFixed(1)}s~${seg.endTime.toFixed(1)}s] ${seg.type} (${d}s) — ${seg.reasons.join(', ')}`);
  }
  onLog(`⚡ passthrough: ${plan.passthroughDuration.toFixed(1)}s | composite: ${plan.compositeDuration.toFixed(1)}s | transcode: ${plan.transcodeDuration.toFixed(1)}s`);

  // ═══ 2. 소스 영상 파일 열기 ═══════════════════════════════════════════════
  const vidTrackData = tracks.find(t => t.type === 'video' && !t.muted);
  if (!vidTrackData?.clips?.length) throw new Error('내보낼 비디오 클립이 없습니다');

  const mainClip = vidTrackData.clips[0];
  const mainAsset = assets.find(a => a.id === mainClip.assetId);
  if (!mainAsset?.src) throw new Error('소스 비디오 URL을 찾을 수 없습니다');

  const srcBlob = await fetchAsBlob(mainAsset.src);
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(srcBlob) });
  const vTrack = (await input.getPrimaryVideoTrack()) as any;
  const aTrack = (await input.getPrimaryAudioTrack()) as any;
  if (!vTrack) throw new Error('소스에 비디오 트랙이 없습니다');

  const srcW = vTrack.displayWidth;
  const srcH = vTrack.displayHeight;
  const srcVCodec = vTrack.codecName;
  const srcACodec = aTrack?.codecName;

  onLog(`📐 소스: ${srcW}x${srcH} (${srcVCodec}), 오디오: ${srcACodec}`);

  // ═══ 3. 해상도 / 코덱 결정 ═══════════════════════════════════════════════
  const srcSmaller = srcW <= targetRes.width && srcH <= targetRes.height;
  const outW = srcSmaller ? srcW : targetRes.width;
  const outH = srcSmaller ? srcH : targetRes.height;

  onLog(`📐 출력: ${outW}x${outH} (${srcSmaller ? '원본 유지' : '다운스케일'})`);

  const codecStr = await vTrack.getCodecParameterString();
  const vDecCfg = await vTrack.getDecoderConfig();
  const aDecCfg = aTrack ? await aTrack.getDecoderConfig() : null;
  if (!codecStr || !vDecCfg) throw new Error('코덱 정보를 가져올 수 없습니다');

  const stats = await vTrack.computePacketStats(100);
  const fps = stats.averagePacketRate || 30;
  onLog(`🔧 코덱: ${codecStr} | FPS: ${fps.toFixed(1)} | HW: prefer-hardware`);

  // ═══ 4. 전체 Passthrough → Transmux Fast Path ════════════════════════════
  const hasComposite = plan.segments.some(s => s.type === 'composite' || s.type === 'transcode');

  if (!hasComposite && srcSmaller) {
    onLog('⚡ 모든 구간 passthrough → Transmux 모드');
    return transmuxFastPath(input, rangeStart, rangeEnd, onProgress, onLog, t0, totalDur);
  }

  // ═══ 5. Smart Render ══════════════════════════════════════════════════════
  onLog('🔧 스마트 렌더링 모드 진입');

  const outFmt = new Mp4OutputFormat({ fastStart: 'in-memory' });
  const bufTarget = new BufferTarget();
  const output = new Output({ format: outFmt, target: bufTarget });

  const vPktSrc = new EncodedVideoPacketSource(srcVCodec!);
  output.addVideoTrack(vPktSrc);

  let aPktSrc: EncodedAudioPacketSource | null = null;
  if (aTrack && srcACodec) {
    aPktSrc = new EncodedAudioPacketSource(srcACodec);
    output.addAudioTrack(aPktSrc);
  }

  await output.start();

  const vPktSink = new EncodedPacketSink(vTrack);
  const aPktSink = aTrack ? new EncodedPacketSink(aTrack) : null;
  const vSampleSink = new VideoSampleSink(vTrack);

  let encoder: ManualVideoEncoder | null = null;
  const canvas = new OffscreenCanvas(outW, outH);
  const ctx = canvas.getContext('2d')!;

  let isFirstV = true;
  let isFirstA = true;
  let done = 0;

  // ═══ 6. 세그먼트 순차 처리 ═══════════════════════════════════════════════
  for (let i = 0; i < plan.segments.length; i++) {
    if (abortSignal?.aborted) throw new Error('내보내기 취소됨');

    const seg = plan.segments[i];
    const segDur = seg.endTime - seg.startTime;
    // renderPlan의 startTime/endTime은 rangeStart 기준 상대 시간
    // 소스 파일의 절대 시간 = rangeStart + seg.startTime
    const srcStart = rangeStart + seg.startTime;
    const srcEnd = rangeStart + seg.endTime;

    onLog(`📦 [${i + 1}/${plan.segments.length}] ${seg.type} ${seg.startTime.toFixed(1)}~${seg.endTime.toFixed(1)}s (${segDur.toFixed(1)}s)`);

    // ────── PASSTHROUGH ──────────────────────────────────────────────────
    if (seg.type === 'passthrough') {
      const startKP = await vPktSink.getKeyPacket(srcStart);
      if (!startKP) {
        onLog(`  ⚠️ 키프레임 없음 @${srcStart.toFixed(2)}s — skip`);
        done += segDur;
        continue;
      }

      let vc = 0;
      for await (const pkt of vPktSink.packets(startKP)) {
        if (pkt.timestamp < srcStart - 0.001) continue;
        if (pkt.timestamp >= srcEnd) break;
        await vPktSrc.add(pkt, isFirstV ? buildVideoMeta(vDecCfg, codecStr) : undefined);
        isFirstV = false;
        vc++;
      }
      onLog(`  📹 ${vc} video packets copied`);

      if (aPktSink && aPktSrc && aDecCfg) {
        const aStart = await aPktSink.getPacket(srcStart);
        let ac = 0;
        if (aStart) {
          for await (const pkt of aPktSink.packets(aStart)) {
            if (pkt.timestamp < srcStart - 0.01) continue;
            if (pkt.timestamp >= srcEnd) break;
            await aPktSrc.add(pkt, isFirstA ? buildAudioMeta(aDecCfg) : undefined);
            isFirstA = false;
            ac++;
          }
        }
        onLog(`  🔊 ${ac} audio packets copied`);
      }

    // ────── COMPOSITE / TRANSCODE ────────────────────────────────────────
    } else {
      const hasVideo = seg.videoClips && seg.videoClips.length > 0;

      if (!hasVideo) {
        // Gap: 검은 프레임
        const gapEnc = new ManualVideoEncoder({
          codec: codecStr, width: outW, height: outH,
          bitrate: videoBitrate, fps,
        });
        const fd = 1 / fps;
        let gc = 0;
        for (let t = srcStart; t < srcEnd; t += fd) {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, outW, outH);
          const frame = new VideoFrame(canvas, {
            timestamp: Math.round(t * 1e6),
            duration: Math.round(Math.min(fd, srcEnd - t) * 1e6),
          });
          const pkts = await gapEnc.encode(frame);
          for (const { packet } of pkts) {
            await vPktSrc.add(packet, isFirstV ? buildVideoMeta(vDecCfg, codecStr) : undefined);
            isFirstV = false;
          }
          gc++;
        }
        const rem = await gapEnc.flush();
        for (const { packet } of rem) await vPktSrc.add(packet);
        gapEnc.close();
        onLog(`  ⬛ ${gc} 검은 프레임`);

      } else {
        // Composite: 디코드 → Canvas 텍스트 오버레이 → 인코드
        if (!encoder) {
          encoder = new ManualVideoEncoder({
            codec: codecStr, width: outW, height: outH,
            bitrate: videoBitrate, fps, keyFrameIntervalSec: 5,
          });
          onLog(`  🔧 VideoEncoder: ${codecStr} ${outW}x${outH} @${(videoBitrate / 1e6).toFixed(1)}Mbps HW`);
        }

        let fc = 0;
        for await (const sample of vSampleSink.samples(srcStart, srcEnd)) {
          ctx.clearRect(0, 0, outW, outH);
          // @ts-ignore — Mediabunny VideoSample.draw 오버로드
          sample.draw(ctx, 0, 0, outW, outH);

          // 텍스트 오버레이 — sample.timestamp은 소스 절대 시간
          const overlays = collectTextOverlays(tracks, sample.timestamp);
          if (overlays.length > 0) {
            drawTextOverlays(ctx, overlays, outW, outH);
          }

          const frame = new VideoFrame(canvas, {
            timestamp: Math.round(sample.timestamp * 1e6),
            duration: Math.round(sample.duration * 1e6),
          });
          sample.close();

          const pkts = await encoder.encode(frame);
          for (const { packet } of pkts) {
            await vPktSrc.add(packet, isFirstV ? buildVideoMeta(vDecCfg, codecStr) : undefined);
            isFirstV = false;
          }
          fc++;
        }
        onLog(`  📹 ${fc} frames 인코딩됨 (composite)`);

        // 오디오 passthrough
        if (aPktSink && aPktSrc && aDecCfg) {
          const aStart = await aPktSink.getPacket(srcStart);
          let ac = 0;
          if (aStart) {
            for await (const pkt of aPktSink.packets(aStart)) {
              if (pkt.timestamp < srcStart - 0.01) continue;
              if (pkt.timestamp >= srcEnd) break;
              await aPktSrc.add(pkt, isFirstA ? buildAudioMeta(aDecCfg) : undefined);
              isFirstA = false;
              ac++;
            }
          }
          onLog(`  🔊 ${ac} audio packets copied`);
        }
      }
    }

    done += segDur;
    onProgress(makeProgress('encoding', Math.min(99, (done / totalDur) * 100), performance.now() - t0, `인코딩 중… ${Math.round((done / totalDur) * 100)}%`));
  }

  // ═══ 7. Finalize ═════════════════════════════════════════════════════════
  if (encoder) {
    const rem = await encoder.flush();
    for (const { packet } of rem) await vPktSrc.add(packet);
    encoder.close();
  }

  vPktSrc.close();
  aPktSrc?.close();
  await output.finalize();

  const elapsed = performance.now() - t0;
  const resultBuf = (bufTarget as any).buffer;
  if (!resultBuf) throw new Error('출력 버퍼가 비어있습니다.');

  const blob = new Blob([resultBuf], { type: 'video/mp4' });
  const mb = (blob.size / 1048576).toFixed(1);
  const speed = (totalDur / (elapsed / 1000)).toFixed(1);

  onLog(`✅ 완료: ${mb} MB · ${fmtTime(elapsed)} (${speed}x 실시간)`);
  onLog(`📊 Passthrough: ${plan.passthroughDuration.toFixed(1)}s | Re-encoded: ${(plan.compositeDuration + plan.transcodeDuration).toFixed(1)}s`);
  onProgress(makeProgress('done', 100, elapsed, `✅ 완료! ${mb} MB`));

  (input as any).dispose?.();
  return blob;
}

// ─── Transmux Fast Path ──────────────────────────────────────────────────────

async function transmuxFastPath(
  input: Input,
  start: number,
  end: number,
  onProgress: (p: ExportProgress) => void,
  onLog: (m: string) => void,
  t0: number,
  totalDur: number,
): Promise<Blob> {
  const outFmt = new Mp4OutputFormat({ fastStart: 'in-memory' });
  const bufTarget = new BufferTarget();
  const output = new Output({ format: outFmt, target: bufTarget });

  const conv = await Conversion.init({ input, output, trim: { start, end } });

  if (!(conv as any).isValid) {
    const reasons = ((conv as any).discardedTracks || [])
      .map((t: any) => `${t.track?.type}: ${t.reason}`).join(', ');
    onLog(`⚠️ 트랙 제외: ${reasons}`);
  }

  (conv as any).onProgress = (p: number) =>
    onProgress(makeProgress('encoding', Math.round(p * 100), performance.now() - t0, `복사 중… ${Math.round(p * 100)}%`));

  await (conv as any).execute();

  const elapsed = performance.now() - t0;
  const resultBuf = (bufTarget as any).buffer;
  if (!resultBuf) throw new Error('출력 버퍼가 비어있습니다.');

  const blob = new Blob([resultBuf], { type: 'video/mp4' });
  const mb = (blob.size / 1048576).toFixed(1);
  const speed = (totalDur / (elapsed / 1000)).toFixed(1);
  onLog(`✅ Transmux 완료: ${mb} MB · ${fmtTime(elapsed)} (${speed}x)`);
  onProgress(makeProgress('done', 100, elapsed, `✅ 완료! ${mb} MB`));

  (input as any).dispose?.();
  return blob;
}
