// src/engines/webcodecExportEngine.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Smart Render Export Engine v2 — 기존 exportWithWebCodecs 시그니처를 유지하면서
// 패킷-레벨 스마트 렌더링을 구현
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

import { analyzeTimeline, type RenderPlan, type RenderSegment } from './renderPlan';

// ─── Public Interface (기존 호출 코드 호환) ──────────────────────────────────

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
  tracks: any[];
  rangeStart: number;
  rangeEnd: number;
  preset: string;
  onProgress?: (p: { phase: string; percent: number; message: string; elapsedMs: number }) => void;
  onLog?: (msg: string) => void;
  abortSignal?: AbortSignal;
}

// ─── Preset Helpers ──────────────────────────────────────────────────────────

function presetToBitrate(preset: string): number {
  const m = preset.match(/(\d+)[MmKk]/);
  if (!m) return 8_000_000;
  const val = parseInt(m[1]);
  return preset.toLowerCase().includes('k') ? val * 1000 : val * 1_000_000;
}

function presetToAudioBitrate(preset: string): number {
  return 192_000;
}

function presetToResolution(preset: string): { width: number; height: number } {
  if (preset.includes('4K') || preset.includes('2160')) return { width: 3840, height: 2160 };
  if (preset.includes('1080')) return { width: 1920, height: 1080 };
  if (preset.includes('720')) return { width: 1280, height: 720 };
  if (preset.includes('480')) return { width: 854, height: 480 };
  return { width: 1920, height: 1080 };
}

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

async function fetchAsBlob(urlOrBlob: string | Blob): Promise<Blob> {
  if (urlOrBlob instanceof Blob) return urlOrBlob;
  const resp = await fetch(urlOrBlob);
  return resp.blob();
}

// ─── Text Overlay ────────────────────────────────────────────────────────────

interface TextOverlay {
  text: string;
  style: any;
  position: { x: number; y: number };
}

function collectTextOverlays(tracks: any[], time: number): TextOverlay[] {
  const overlays: TextOverlay[] = [];
  for (const track of tracks) {
    if (track.type !== 'text' || track.muted) continue;
    for (const clip of (track.clips || [])) {
      if (clip.disabled === true) continue;
      const cs = clip.startTime ?? 0;
      const ce = cs + (clip.duration ?? 0);
      if (time >= cs && time < ce) {
        overlays.push({
          text: clip.textContent || '',
          style: clip.style || {},
          position: clip.position || { x: 0.5, y: 0.8 },
        });
      }
    }
  }
  return overlays;
}

function drawTextOverlays(
  ctx: OffscreenCanvasRenderingContext2D,
  overlays: TextOverlay[],
  w: number,
  h: number,
): void {
  for (const { text, style, position } of overlays) {
    if (!text) continue;

    const fontSize = style.fontSize || Math.round(h * 0.05);
    const fontFamily = style.fontFamily || 'Arial';
    const fontWeight = style.fontWeight || 'bold';
    const color = style.color || '#FFFFFF';
    const bg = style.backgroundColor || 'transparent';
    const strokeColor = style.strokeColor || '#000000';
    const strokeWidth = style.strokeWidth || 2;
    const shadowColor = style.shadowColor || 'rgba(0,0,0,0.7)';
    const shadowBlur = style.shadowBlur || 4;

    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const x = position.x * w;
    const y = position.y * h;

    // Background pill
    if (bg && bg !== 'transparent') {
      const met = ctx.measureText(text);
      const pad = fontSize * 0.3;
      ctx.fillStyle = bg;
      ctx.beginPath();
      const rx = x - met.width / 2 - pad;
      const ry = y - fontSize / 2 - pad;
      const rw = met.width + pad * 2;
      const rh = fontSize + pad * 2;
      ctx.roundRect(rx, ry, rw, rh, pad * 0.5);
      ctx.fill();
    }

    // Shadow
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    // Stroke
    if (strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
    }

    // Fill
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    // Reset
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
}

// ─── Manual Video Encoder (WebCodecs → EncodedPacket) ────────────────────────

class ManualVideoEncoder {
  private encoder: VideoEncoder;
  private queue: Array<{ packet: EncodedPacket; meta?: EncodedVideoChunkMetadata }> = [];
  private waiter: (() => void) | null = null;
  private err: Error | null = null;
  private kfInterval: number;
  private count = 0;

  constructor(cfg: {
    codec: string;
    width: number;
    height: number;
    bitrate: number;
    fps?: number;
    keyFrameIntervalSec?: number;
  }) {
    const fps = cfg.fps || 30;
    this.kfInterval = Math.round((cfg.keyFrameIntervalSec || 5) * fps);

    this.encoder = new VideoEncoder({
      output: (chunk, meta) => {
        const buf = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buf);
        const pkt = new EncodedPacket(
          buf,
          chunk.type as 'key' | 'delta',
          chunk.timestamp / 1e6,
          (chunk.duration || 0) / 1e6,
        );
        this.queue.push({ packet: pkt, meta });
        this.waiter?.();
        this.waiter = null;
      },
      error: (e) => {
        this.err = e;
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

  async encode(frame: VideoFrame): Promise<Array<{ packet: EncodedPacket; meta?: EncodedVideoChunkMetadata }>> {
    if (this.err) throw this.err;

    const kf = this.count % this.kfInterval === 0;
    this.count++;
    this.encoder.encode(frame, { keyFrame: kf });
    frame.close();

    // encoder output 콜백이 비동기이므로 약간 대기
    if (this.queue.length === 0) {
      await new Promise<void>((r) => {
        this.waiter = r;
        setTimeout(r, 50);
      });
    }

    const result = this.queue.splice(0);
    return result;
  }

  async flush(): Promise<Array<{ packet: EncodedPacket; meta?: EncodedVideoChunkMetadata }>> {
    await this.encoder.flush();
    return this.queue.splice(0);
  }

  close() {
    try { this.encoder.close(); } catch {}
  }
}

// ─── Metadata Builders ───────────────────────────────────────────────────────

function buildVideoMeta(dec: VideoDecoderConfig, codec: string): EncodedVideoChunkMetadata {
  return {
    decoderConfig: {
      codec,
      codedWidth: dec.codedWidth,
      codedHeight: dec.codedHeight,
      colorSpace: dec.colorSpace,
      description: dec.description,
    },
  };
}

function buildAudioMeta(dec: AudioDecoderConfig): EncodedAudioChunkMetadata {
  return {
    decoderConfig: {
      codec: dec.codec,
      numberOfChannels: dec.numberOfChannels,
      sampleRate: dec.sampleRate,
      description: dec.description,
    },
  };
}

// ─── MAIN EXPORT FUNCTION ────────────────────────────────────────────────────

export async function exportWithWebCodecs(opts: WebCodecExportOptions): Promise<Blob> {
  const {
    tracks,
    rangeStart,
    rangeEnd,
    preset,
    onProgress = () => {},
    onLog = () => {},
    abortSignal,
  } = opts;

  const t0 = performance.now();
  const totalDur = rangeEnd - rangeStart;
  const videoBitrate = presetToBitrate(preset);
  // @ts-ignore
  const audioBitrate = presetToAudioBitrate(preset);

  onLog('🚀 Smart Render 내보내기 엔진 시작…');

  // ═══ 1. Render Plan ═══════════════════════════════════════════════════════
  const targetRes = presetToResolution(preset);
  // @ts-ignore
  const plan = analyzeTimeline(tracks, [], rangeStart, rangeEnd, targetRes);

  onLog(`📊 Render Plan: ${plan.segments.length}개 구간`);
  for (const seg of plan.segments) {
    const d = (seg.endTime - seg.startTime).toFixed(1);
    onLog(`  [${seg.startTime.toFixed(1)}s~${seg.endTime.toFixed(1)}s] ${seg.type} (${d}s) — ${(seg.reasons || []).join(', ')}`);
  }
  onLog(`⚡ passthrough: ${plan.passthroughDuration.toFixed(1)}s | composite: ${plan.compositeDuration.toFixed(1)}s`);

  // ═══ 2. Open Source File ══════════════════════════════════════════════════
  const vidTrackData = tracks.find((t: any) => t.type === 'video' && !t.muted);
  if (!vidTrackData?.clips?.length) throw new Error('내보낼 비디오 클립이 없습니다');

  const mainClip = vidTrackData.clips[0];
  const srcUrl = mainClip.asset?.src || mainClip.src || mainClip.url;
  if (!srcUrl) throw new Error('소스 비디오 URL을 찾을 수 없습니다');

  const srcBlob = await fetchAsBlob(srcUrl);
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(srcBlob) });
  const vTrack = await input.getPrimaryVideoTrack() as any;
  const aTrack = await input.getPrimaryAudioTrack() as any;
  if (!vTrack) throw new Error('소스에 비디오 트랙이 없습니다');

  const srcW = vTrack.displayWidth;
  const srcH = vTrack.displayHeight;
  const srcVCodec = vTrack.codecName;
  const srcACodec = aTrack?.codecName;

  onLog(`📐 소스: ${srcW}x${srcH} (${srcVCodec}), 오디오: ${srcACodec}`);

  // ═══ 3. Resolution / Codec ════════════════════════════════════════════════
  const target = presetToResolution(preset);
  const srcSmaller = srcW <= target.width && srcH <= target.height;
  const outW = srcSmaller ? srcW : target.width;
  const outH = srcSmaller ? srcH : target.height;

  onLog(`📐 출력: ${outW}x${outH} (${srcSmaller ? '원본 유지' : '다운스케일'})`);

  const codecStr = await vTrack.getCodecParameterString();
  const vDecCfg = await vTrack.getDecoderConfig();
  const aDecCfg = aTrack ? await aTrack.getDecoderConfig() : null;
  if (!codecStr || !vDecCfg) throw new Error('코덱 정보를 가져올 수 없습니다');

  onLog(`🔧 코덱: ${codecStr} | HW: prefer-hardware`);

  // FPS 추정
  const stats = await vTrack.computePacketStats(100);
  const fps = stats.averagePacketRate || 30;
  onLog(`🎬 FPS: ${fps.toFixed(1)}`);

  // ═══ 4. 전체 Passthrough → Transmux Fast Path ════════════════════════════
  const hasComposite = plan.segments.some(
    (s) => s.type === 'composite' || s.type === 'transcode',
  );

  if (!hasComposite && srcSmaller) {
    onLog('⚡ 모든 구간 passthrough → Transmux 모드');
    return transmuxFastPath(input, rangeStart, rangeEnd, onProgress, onLog, t0);
  }

  // ═══ 5. Smart Render: 단일 Output + 혼합 패킷 주입 ═══════════════════════
  onLog('🔧 스마트 렌더링 모드 진입');

  const outFmt = new Mp4OutputFormat({ fastStart: 'in-memory' });
  const bufTarget = new BufferTarget();
  const output = new Output({ format: outFmt, target: bufTarget });

  // Video source — 모든 패킷이 여기로 합류
  const vPktSrc = new EncodedVideoPacketSource(srcVCodec!);
  output.addVideoTrack(vPktSrc);

  // Audio source
  let aPktSrc: EncodedAudioPacketSource | null = null;
  if (aTrack && srcACodec) {
    aPktSrc = new EncodedAudioPacketSource(srcACodec);
    output.addAudioTrack(aPktSrc);
  }

  await output.start();

  // Sinks (소스에서 읽기)
  const vPktSink = new EncodedPacketSink(vTrack);
  const aPktSink = aTrack ? new EncodedPacketSink(aTrack) : null;
  const vSampleSink = new VideoSampleSink(vTrack);

  // Composite 인코더 (lazy)
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

    onLog(`📦 [${i + 1}/${plan.segments.length}] ${seg.type} ${seg.startTime.toFixed(1)}~${seg.endTime.toFixed(1)}s (${segDur.toFixed(1)}s)`);

    // ────── PASSTHROUGH ──────────────────────────────────────────────────
    if (seg.type === 'passthrough') {
      // Video packets
      const startKP = await vPktSink.getKeyPacket(seg.startTime, { verifyKeyPackets: true });
      if (!startKP) {
        onLog(`  ⚠️ 키프레임 없음 @${seg.startTime.toFixed(2)}s — skip`);
        done += segDur;
        continue;
      }

      let vc = 0;
      for await (const pkt of vPktSink.packets(startKP)) {
        if (pkt.timestamp < seg.startTime - 0.001) continue;
        if (pkt.timestamp >= seg.endTime) break;
        await vPktSrc.add(pkt, isFirstV ? buildVideoMeta(vDecCfg, codecStr) : undefined);
        isFirstV = false;
        vc++;
      }
      onLog(`  📹 ${vc} video packets copied`);

      // Audio packets
      if (aPktSink && aPktSrc && aDecCfg) {
        const aStart = await aPktSink.getPacket(seg.startTime);
        let ac = 0;
        if (aStart) {
          for await (const pkt of aPktSink.packets(aStart)) {
            if (pkt.timestamp < seg.startTime - 0.01) continue;
            if (pkt.timestamp >= seg.endTime) break;
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
        // ── Gap: 검은 프레임 ──
        const gapEnc = new ManualVideoEncoder({
          codec: codecStr,
          width: outW,
          height: outH,
          bitrate: videoBitrate,
          fps,
        });
        const fd = 1 / fps;
        let gc = 0;
        for (let t = seg.startTime; t < seg.endTime; t += fd) {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, outW, outH);
          const frame = new VideoFrame(canvas, {
            timestamp: Math.round(t * 1e6),
            duration: Math.round(Math.min(fd, seg.endTime - t) * 1e6),
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
        // ── Composite: 디코드 → Canvas → 인코드 ──
        if (!encoder) {
          encoder = new ManualVideoEncoder({
            codec: codecStr,
            width: outW,
            height: outH,
            bitrate: videoBitrate,
            fps,
            keyFrameIntervalSec: 5,
          });
          onLog(`  🔧 VideoEncoder: ${codecStr} ${outW}x${outH} @${(videoBitrate / 1e6).toFixed(1)}Mbps HW`);
        }

        let fc = 0;
        for await (const sample of vSampleSink.samples(seg.startTime, seg.endTime)) {
          // 원본 프레임 → 캔버스
          ctx.clearRect(0, 0, outW, outH);
          // @ts-ignore
          sample.draw(ctx, 0, 0, outW, outH);

          // 텍스트 오버레이
          const overlays = collectTextOverlays(tracks, sample.timestamp);
          if (overlays.length > 0) {
            drawTextOverlays(ctx, overlays, outW, outH);
          }

          // 캔버스 → VideoFrame → encode
          const frame = new VideoFrame(canvas, {
            timestamp: Math.round(sample.timestamp * 1e6),
            duration: Math.round(sample.duration * 1e6),
          });
          sample.close();

          const pkts = await encoder.encode(frame);
          for (const { packet } of pkts) {
            await vPktSrc.add(
              packet,
              isFirstV ? buildVideoMeta(vDecCfg, codecStr) : undefined,
            );
            isFirstV = false;
          }
          fc++;
        }
        onLog(`  📹 ${fc} frames 인코딩됨 (composite)`);

        // 오디오 — 항상 passthrough
        if (aPktSink && aPktSrc && aDecCfg) {
          const aStart = await aPktSink.getPacket(seg.startTime);
          let ac = 0;
          if (aStart) {
            for await (const pkt of aPktSink.packets(aStart)) {
              if (pkt.timestamp < seg.startTime - 0.01) continue;
              if (pkt.timestamp >= seg.endTime) break;
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
    onProgress({
      phase: 'encoding',
      percent: Math.round(Math.min(99, (done / totalDur) * 100)),
      message: `${Math.round(Math.min(99, (done / totalDur) * 100))}%`,
      elapsedMs: performance.now() - t0,
    });
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
  // @ts-ignore
  const resultBuf = bufTarget.buffer;
  if (!resultBuf) throw new Error('출력 버퍼가 비어있습니다.');
  
  const blob = new Blob([resultBuf], { type: 'video/mp4' });
  const mb = (blob.size / 1048576).toFixed(1);
  const speed = (totalDur / (elapsed / 1000)).toFixed(1);

  onLog(`✅ 완료: ${mb} MB · ${fmtTime(elapsed)} (${speed}x 실시간)`);
  onLog(`📊 Passthrough: ${plan.passthroughDuration.toFixed(1)}s | Re-encoded: ${(plan.compositeDuration + plan.transcodeDuration).toFixed(1)}s`);
  onProgress({
    phase: 'done',
    percent: 100,
    message: '100%',
    elapsedMs: elapsed,
  });

  input.dispose();
  return blob;
}

// ─── Transmux Fast Path ──────────────────────────────────────────────────────

async function transmuxFastPath(
  input: Input,
  rangeStart: number,
  rangeEnd: number,
  onProgress: (p: any) => void,
  onLog: (m: string) => void,
  t0: number,
): Promise<Blob> {
  const outFmt = new Mp4OutputFormat({ fastStart: 'in-memory' });
  const bufTarget = new BufferTarget();
  const output = new Output({ format: outFmt, target: bufTarget });

  const conv = await Conversion.init({
    input,
    output,
    trim: { start: rangeStart, end: rangeEnd },
  });

  if (!(conv as any).isValid) {
    const reasons = (conv as any).discardedTracks.map((t: any) => `${t.track?.type}: ${t.reason}`).join(', ');
    onLog(`⚠️ 트랙 제외: ${reasons}`);
  }

  (conv as any).onProgress = (p: number) => onProgress({
    phase: 'encoding',
    percent: Math.round(p * 100),
    message: `${Math.round(p * 100)}%`,
    elapsedMs: performance.now() - t0,
  });
  await (conv as any).execute();

  const elapsed = performance.now() - t0;
  // @ts-ignore
  const resultBuf = bufTarget.buffer;
  if (!resultBuf) throw new Error('출력 버퍼가 비어있습니다.');
  
  const blob = new Blob([resultBuf], { type: 'video/mp4' });
  onLog(`✅ Transmux 완료: ${(blob.size / 1048576).toFixed(1)} MB · ${fmtTime(elapsed)} (${((rangeEnd - rangeStart) / (elapsed / 1000)).toFixed(1)}x)`);
  onProgress({
    phase: 'done',
    percent: 100,
    message: '100%',
    elapsedMs: elapsed,
  });
  input.dispose();
  return blob;
}
