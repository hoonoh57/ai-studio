/**
 * Smart Render Export Engine
 * 
 * 핵심 전략:
 * 1. renderPlan으로 타임라인을 passthrough/composite 구간으로 분할
 * 2. 단일 Output에 EncodedVideoPacketSource + EncodedAudioPacketSource 사용
 * 3. Passthrough 구간: EncodedPacketSink로 원본 패킷을 직접 복사 (재인코딩 없음)
 * 4. Composite 구간: VideoSampleSink로 디코딩 → Canvas에 텍스트/오버레이 그리기 
 *    → WebCodecs VideoEncoder로 인코딩 → EncodedPacket으로 변환하여 동일 소스에 주입
 * 5. 오디오: 항상 passthrough (텍스트 오버레이는 비디오만 영향)
 */

import {
  Input,
  Output,
  Mp4OutputFormat,
  BufferTarget,
  EncodedVideoPacketSource,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  VideoSampleSink,
  EncodedPacket,
  VideoSample,
  BlobSource,
  ALL_FORMATS,
} from 'mediabunny';

import { analyzeTimeline, type RenderPlan, type RenderSegment } from './renderPlan';
import { type Project, type Track, type Clip, type Asset } from '@/types/project';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SmartExportOptions {
  /** 타임라인의 모든 트랙 정보 */
  tracks: Track[];
  /** 프로젝트의 자산 리스트 */
  assets: Asset[];
  /** 내보내기 범위 */
  rangeStart: number;
  rangeEnd: number;
  /** 프리셋 ("1080p", "720p", "4K" 등) */
  preset: string;
  /** 비디오 비트레이트 (bps) */
  videoBitrate: number;
  /** 오디오 비트레이트 (bps) */
  audioBitrate: number;
  /** 비디오 코덱 ('avc' | 'vp9' | 'av1') */
  videoCodec?: 'avc' | 'vp9' | 'av1';
  /** 오디오 코덱 ('aac' | 'opus') */
  audioCodec?: 'aac' | 'opus';
  /** 프로그레스 콜백 ({phase, percent, message}) */
  onProgress?: (data: { phase: string; percent: number; message: string; elapsedMs: number }) => void;
  /** 로그 콜백 */
  onLog?: (msg: string) => void;
  /** 취소 시그널 */
  abortSignal?: AbortSignal;
}

// ─── Utility Functions ────────────────────────────────────────────────────────

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function presetToResolution(preset: string): { width: number; height: number } {
  if (preset.includes('4K') || preset.includes('2160')) return { width: 3840, height: 2160 };
  if (preset.includes('1080')) return { width: 1920, height: 1080 };
  if (preset.includes('720')) return { width: 1280, height: 720 };
  if (preset.includes('480')) return { width: 854, height: 480 };
  return { width: 1920, height: 1080 };
}

async function fetchAsBlob(urlOrBlob: string | Blob): Promise<Blob> {
  if (urlOrBlob instanceof Blob) return urlOrBlob;
  const resp = await fetch(urlOrBlob);
  return resp.blob();
}

/**
 * 텍스트 오버레이 수집
 */
function collectTextOverlays(tracks: Track[], time: number): Array<{
  text: string;
  style: any;
  position: { x: number; y: number };
}> {
  const overlays: Array<{ text: string; style: any; position: { x: number; y: number } }> = [];
  for (const track of tracks) {
    if (track.type !== 'text' || track.muted) continue;
    for (const clip of track.clips) {
      if (clip.disabled) continue;
      const clipStart = clip.startTime;
      const clipEnd = clipStart + clip.duration;
      if (time >= clipStart && time < clipEnd) {
        overlays.push({
          text: clip.textContent || '',
          style: (clip as any).style || {},
          position: (clip as any).position || { x: 0.5, y: 0.8 },
        });
      }
    }
  }
  return overlays;
}

/**
 * OffscreenCanvas에 텍스트 오버레이를 그림
 */
function drawTextOverlays(
  ctx: OffscreenCanvasRenderingContext2D,
  overlays: Array<{ text: string; style: any; position: { x: number; y: number } }>,
  canvasWidth: number,
  canvasHeight: number,
): void {
  for (const overlay of overlays) {
    const { text, style, position } = overlay;
    if (!text) continue;

    const fontSize = style.fontSize || Math.round(canvasHeight * 0.05);
    const fontFamily = style.fontFamily || 'Arial';
    const fontWeight = style.fontWeight || 'bold';
    const color = style.color || '#FFFFFF';
    const backgroundColor = style.backgroundColor || 'transparent';
    const strokeColor = style.strokeColor || '#000000';
    const strokeWidth = style.strokeWidth || 0;
    const shadowColor = style.shadowColor || 'rgba(0,0,0,0.5)';
    const shadowBlur = style.shadowBlur || 0;

    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const x = position.x * canvasWidth;
    const y = position.y * canvasHeight;

    // Background
    if (backgroundColor && backgroundColor !== 'transparent') {
      const metrics = ctx.measureText(text);
      const padding = fontSize * 0.3;
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(
        x - metrics.width / 2 - padding,
        y - fontSize / 2 - padding,
        metrics.width + padding * 2,
        fontSize + padding * 2,
      );
    }

    // Shadow
    if (shadowBlur > 0) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur;
    }

    // Stroke
    if (strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.strokeText(text, x, y);
    }

    // Fill
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }
}

// ─── Core: WebCodecs Manual Encoder Wrapper ──────────────────────────────────

/**
 * WebCodecs VideoEncoder를 래핑하여 VideoSample → EncodedPacket 변환
 * EncodedVideoPacketSource에 직접 주입할 수 있는 패킷을 생산
 */
class ManualVideoEncoder {
  private encoder: VideoEncoder;
  private packetQueue: Array<{ packet: EncodedPacket; meta?: any }> = [];
  private resolveWaiter: (() => void) | null = null;
  private _error: Error | null = null;
  private keyFrameInterval: number;
  private frameCount = 0;
  private fps: number;

  constructor(config: {
    codec: string;       // e.g. 'avc1.42001f'
    width: number;
    height: number;
    bitrate: number;
    hardwareAcceleration?: HardwareAcceleration;
    fps?: number;
    keyFrameIntervalSeconds?: number;
  }) {
    this.fps = config.fps || 30;
    this.keyFrameInterval = Math.round((config.keyFrameIntervalSeconds || 5) * this.fps);

    this.encoder = new VideoEncoder({
      output: (chunk: EncodedVideoChunk, meta?: any) => {
        // EncodedVideoChunk → Mediabunny EncodedPacket로 변환
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        const packet = new EncodedPacket(
          data,
          chunk.type as 'key' | 'delta',
          chunk.timestamp / 1_000_000,       // μs → s
          (chunk.duration || 0) / 1_000_000, // μs → s
        );
        this.packetQueue.push({ packet, meta });
        if (this.resolveWaiter) {
          this.resolveWaiter();
          this.resolveWaiter = null;
        }
      },
      error: (e: DOMException) => {
        this._error = e as any;
        if (this.resolveWaiter) {
          this.resolveWaiter();
          this.resolveWaiter = null;
        }
      },
    });

    this.encoder.configure({
      codec: config.codec,
      width: config.width,
      height: config.height,
      bitrate: config.bitrate,
      hardwareAcceleration: config.hardwareAcceleration || 'prefer-hardware',
      bitrateMode: 'variable',
    });
  }

  /**
   * VideoSample (또는 VideoFrame)을 인코딩하여 EncodedPacket 배열 반환
   */
  async encode(sample: VideoSample): Promise<Array<{ packet: EncodedPacket; meta?: any }>> {
    if (this._error) throw this._error;

    const frame = sample.toVideoFrame();
    const isKeyFrame = this.frameCount % this.keyFrameInterval === 0;
    this.frameCount++;

    this.encoder.encode(frame, { keyFrame: isKeyFrame });
    frame.close();

    // flush를 기다리지 않고, 현재 큐에 있는 패킷만 반환
    // (encoder는 비동기로 output을 호출함)
    await new Promise<void>((resolve) => {
      // encoder가 이미 output을 호출했으면 즉시 resolve
      if (this.packetQueue.length > 0) {
        resolve();
      } else {
        this.resolveWaiter = resolve;
        // 타임아웃 안전장치 (100ms)
        setTimeout(resolve, 100);
      }
    });

    const packets = [...this.packetQueue];
    this.packetQueue = [];
    return packets;
  }

  /**
   * 남은 프레임 모두 flush
   */
  async flush(): Promise<Array<{ packet: EncodedPacket; meta?: any }>> {
    await this.encoder.flush();
    const packets = [...this.packetQueue];
    this.packetQueue = [];
    return packets;
  }

  close(): void {
    try {
      this.encoder.close();
    } catch { /* ignore */ }
  }
}

// ─── Core: Smart Render Export ───────────────────────────────────────────────

export async function exportWithSmartRender(opts: SmartExportOptions): Promise<Blob> {
  const {
    tracks,
    assets,
    rangeStart,
    rangeEnd,
    preset,
    videoBitrate,
    audioBitrate,
    videoCodec = 'avc',
    audioCodec = 'aac',
    onProgress = () => {},
    onLog = () => {},
    abortSignal,
  } = opts;

  const t0 = performance.now();
  const totalDuration = rangeEnd - rangeStart;

  onLog('🚀 Smart Render 내보내기 엔진 시작…');

  // ─── Step 1: Render Plan 분석 ──────────────────────────────────────────────
  const targetRes = presetToResolution(preset);
  const plan: RenderPlan = analyzeTimeline(tracks, assets, rangeStart, rangeEnd, targetRes);
  
  onLog(`📊 Render Plan: ${plan.segments.length}개 구간`);
  for (const seg of plan.segments) {
    const dur = (seg.endTime - seg.startTime).toFixed(1);
    const reasons = seg.reasons?.join(', ') || '';
    onLog(`  [${seg.startTime.toFixed(1)}s~${seg.endTime.toFixed(1)}s] ${seg.type} (${dur}s) — ${reasons}`);
  }
  onLog(`⚡ passthrough: ${plan.passthroughDuration.toFixed(1)}s | composite: ${plan.compositeDuration.toFixed(1)}s | transcode: ${plan.transcodeDuration.toFixed(1)}s`);

  // ─── Step 2: 소스 영상 파일 열기 ───────────────────────────────────────────
  // 메인 비디오 클립 찾기 (첫 번째 비디오 트랙의 첫 번째 클립)
  const videoTrackData = tracks.find((t: Track) => t.type === 'video' && !t.muted);
  if (!videoTrackData || !videoTrackData.clips?.length) {
    throw new Error('내보낼 비디오 클립이 없습니다');
  }

  const mainClip = videoTrackData.clips[0];
  const asset = assets.find(a => a.id === mainClip.assetId);
  const sourceUrl = asset?.src;
  if (!sourceUrl) throw new Error('소스 비디오 URL을 찾을 수 없습니다');

  const sourceBlob = await fetchAsBlob(sourceUrl);
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(sourceBlob),
  });

  const videoTrack = await input.getPrimaryVideoTrack() as any;
  const audioTrack = await input.getPrimaryAudioTrack() as any;

  if (!videoTrack) throw new Error('소스에 비디오 트랙이 없습니다');

  const sourceWidth = videoTrack.displayWidth;
  const sourceHeight = videoTrack.displayHeight;
  const sourceCodec = videoTrack.codecName;
  const sourceAudioCodec = audioTrack?.codecName;

  onLog(`📐 소스: ${sourceWidth}x${sourceHeight} (${sourceCodec}), 오디오: ${sourceAudioCodec}`);

  // ─── Step 3: 출력 코덱 설정 결정 ───────────────────────────────────────────
  
  // 소스와 동일한 해상도라면 패킷 직접 복사 가능
  const resolutionMatch = sourceWidth === targetRes.width && sourceHeight === targetRes.height;
  // 소스가 타겟보다 작으면 업스케일 불필요 → 원본 해상도로 passthrough
  const sourceSmaller = sourceWidth <= targetRes.width && sourceHeight <= targetRes.height;
  const effectiveWidth = sourceSmaller ? sourceWidth : targetRes.width;
  const effectiveHeight = sourceSmaller ? sourceHeight : targetRes.height;
  
  onLog(`📐 출력: ${effectiveWidth}x${effectiveHeight} (소스${sourceSmaller ? ' ≤ 타겟, 원본 유지' : resolutionMatch ? ' = 타겟' : ' > 타겟, 다운스케일'})`);

  // Passthrough는 소스 코덱 그대로 사용해야 하므로, composite 구간도 같은 코덱으로 인코딩
  const codecString = await videoTrack.getCodecParameterString();
  const decoderConfig = await videoTrack.getDecoderConfig();
  const audioDecoderConfig = audioTrack ? await audioTrack.getDecoderConfig() : null;

  if (!codecString || !decoderConfig) {
    throw new Error('소스 비디오 코덱 정보를 가져올 수 없습니다');
  }

  onLog(`🔧 코덱: ${codecString} | HW 가속: prefer-hardware`);

  // ─── Step 4: 전체가 passthrough인 경우 빠른 경로 ──────────────────────────
  const hasComposite = plan.segments.some(s => s.type === 'composite' || s.type === 'transcode');
  
  if (!hasComposite && sourceSmaller) {
    onLog('⚡ 모든 구간 passthrough → Transmux 모드');
    return await transmuxFastPath(input, videoTrack, audioTrack, rangeStart, rangeEnd, onProgress, onLog, t0);
  }

  // ─── Step 5: 스마트 렌더링 — 단일 Output에 혼합 패킷 주입 ─────────────────
  onLog('🔧 스마트 렌더링 모드: passthrough + composite 혼합');

  // Output 설정
  const outputFormat = new Mp4OutputFormat({ fastStart: 'in-memory' });
  const bufferTarget = new BufferTarget();
  const output = new Output({ format: outputFormat, target: bufferTarget });

  // 비디오: EncodedVideoPacketSource (패킷 직접 주입)
  const videoPacketSource = new EncodedVideoPacketSource(sourceCodec!);
  output.addVideoTrack(videoPacketSource);

  // 오디오: EncodedAudioPacketSource (항상 passthrough)
  let audioPacketSource: EncodedAudioPacketSource | null = null;
  if (audioTrack && sourceAudioCodec) {
    audioPacketSource = new EncodedAudioPacketSource(sourceAudioCodec);
    output.addAudioTrack(audioPacketSource);
  }

  await output.start();

  // Sinks 준비
  const videoPacketSink = new EncodedPacketSink(videoTrack);
  const audioPacketSink = audioTrack ? new EncodedPacketSink(audioTrack) : null;
  const videoSampleSink = new VideoSampleSink(videoTrack);

  // Composite용 인코더 (지연 초기화)
  let manualEncoder: ManualVideoEncoder | null = null;
  const compositeCanvas = new OffscreenCanvas(effectiveWidth, effectiveHeight);
  const compositeCtx = compositeCanvas.getContext('2d')!;

  // 소스 FPS 추정
  const packetStats = await videoTrack.computePacketStats(100);
  const sourceFps = packetStats.averagePacketRate || 30;

  let isFirstVideoPacket = true;
  let isFirstAudioPacket = true;
  let processedDuration = 0;

  // ─── Step 6: 세그먼트 순차 처리 ───────────────────────────────────────────
  for (let segIdx = 0; segIdx < plan.segments.length; segIdx++) {
    if (abortSignal?.aborted) throw new Error('내보내기 취소됨');

    const segment = plan.segments[segIdx];
    const segDuration = segment.endTime - segment.startTime;
    // 소스 내 시간은 renderPlan이 정한 startTime/endTime을 그대로 사용 (상대 시간)

    onLog(`📦 세그먼트 ${segIdx + 1}/${plan.segments.length}: [${segment.startTime.toFixed(1)}s~${segment.endTime.toFixed(1)}s] ${segment.type}`);

    if (segment.type === 'passthrough') {
      // ──── Passthrough: 패킷 직접 복사 ──────────────────────────────────────
      await processPassthroughSegment({
        segment,
        videoPacketSink,
        audioPacketSink,
        videoPacketSource,
        audioPacketSource,
        videoTrack,
        audioTrack,
        isFirstVideoPacket,
        isFirstAudioPacket,
        decoderConfig,
        audioDecoderConfig,
        codecString,
        onLog,
      });
      
      // 첫 패킷 메타는 첫 passthrough에서 전달됨
      isFirstVideoPacket = false;
      isFirstAudioPacket = false;

    } else if (segment.type === 'composite' || segment.type === 'transcode') {
      // ──── Composite: 디코드 → 오버레이 → 인코딩 → 패킷 주입 ───────────────
      
      // 갭 구간 (비디오 없음) 처리
      const hasVideo = segment.videoClips && segment.videoClips.length > 0;
      
      if (!hasVideo) {
        // 검은 프레임 생성
        await processGapSegment({
          segment,
          effectiveWidth,
          effectiveHeight,
          compositeCanvas,
          compositeCtx,
          videoPacketSource,
          audioPacketSource,
          isFirstVideoPacket,
          decoderConfig,
          codecString,
          videoBitrate,
          sourceFps,
          onLog,
        });
      } else {
        // 텍스트 오버레이가 있는 구간
        if (!manualEncoder) {
          manualEncoder = new ManualVideoEncoder({
            codec: codecString,
            width: effectiveWidth,
            height: effectiveHeight,
            bitrate: videoBitrate,
            hardwareAcceleration: 'prefer-hardware',
            fps: sourceFps,
            keyFrameIntervalSeconds: 5,
          });
          onLog(`🔧 VideoEncoder 생성: ${codecString} ${effectiveWidth}x${effectiveHeight} @ ${(videoBitrate / 1e6).toFixed(1)}Mbps HW가속`);
        }

        await processCompositeSegment({
          segment,
          tracks,
          videoSampleSink,
          audioPacketSink,
          videoPacketSource,
          audioPacketSource,
          audioTrack,
          manualEncoder,
          compositeCanvas,
          compositeCtx,
          effectiveWidth,
          effectiveHeight,
          isFirstVideoPacket,
          isFirstAudioPacket,
          decoderConfig,
          audioDecoderConfig,
          codecString,
          onLog,
        });
      }

      isFirstVideoPacket = false;
      isFirstAudioPacket = false;
    }

    // 진행률 업데이트
    processedDuration += segDuration;
    const pct = Math.min(99, (processedDuration / totalDuration) * 100);
    onProgress({
      phase: 'encoding',
      percent: Math.round(pct),
      message: `내보내는 중… ${Math.round(pct)}%`,
      elapsedMs: performance.now() - t0,
    });
  }

  // ─── Step 7: 마무리 ────────────────────────────────────────────────────────
  
  // 인코더 flush
  if (manualEncoder) {
    const remaining = await manualEncoder.flush();
    for (const { packet, meta } of remaining) {
      await videoPacketSource.add(packet, isFirstVideoPacket ? buildVideoMeta(decoderConfig, codecString) : undefined);
      isFirstVideoPacket = false;
    }
    manualEncoder.close();
  }

  // 소스 닫기
  videoPacketSource.close();
  audioPacketSource?.close();

  await output.finalize();

  const elapsed = performance.now() - t0;
  const resultBuffer = (bufferTarget as any).buffer;
  if (!resultBuffer) throw new Error('출력 버퍼가 비어있습니다.');
  
  const blob = new Blob([resultBuffer], { type: 'video/mp4' });
  const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
  const speed = (totalDuration / (elapsed / 1000)).toFixed(1);

  onLog(`✅ 완료: ${sizeMB} MB · ${fmtTime(elapsed)} (${speed}x 실시간)`);
  onLog(`📊 Passthrough: ${plan.passthroughDuration.toFixed(1)}s | Re-encoded: ${(plan.compositeDuration + plan.transcodeDuration).toFixed(1)}s`);
  onProgress({
    phase: 'done',
    percent: 100,
    message: '내보내기 완료!',
    elapsedMs: elapsed,
  });

  // 정리
  input.dispose();

  return blob;
}

// ─── Segment Processors ──────────────────────────────────────────────────────

/**
 * Passthrough 구간: 인코딩된 패킷을 직접 복사
 */
async function processPassthroughSegment(params: {
  segment: RenderSegment;
  videoPacketSink: EncodedPacketSink;
  audioPacketSink: EncodedPacketSink | null;
  videoPacketSource: EncodedVideoPacketSource;
  audioPacketSource: EncodedAudioPacketSource | null;
  videoTrack: any;
  audioTrack: any;
  isFirstVideoPacket: boolean;
  isFirstAudioPacket: boolean;
  decoderConfig: VideoDecoderConfig;
  audioDecoderConfig: AudioDecoderConfig | null;
  codecString: string;
  onLog: (msg: string) => void;
}): Promise<void> {
  const {
    segment, videoPacketSink, audioPacketSink,
    videoPacketSource, audioPacketSource,
    videoTrack, audioTrack,
    isFirstVideoPacket, isFirstAudioPacket,
    decoderConfig, audioDecoderConfig, codecString, onLog,
  } = params;

  // ── 비디오 패킷 복사 ──
  // 구간 시작점의 키프레임을 찾아서 시작
  const startKeyPacket = await videoPacketSink.getKeyPacket(segment.startTime, { verifyKeyPackets: true });
  if (!startKeyPacket) {
    onLog(`⚠️ 키프레임을 찾을 수 없음: ${segment.startTime.toFixed(2)}s`);
    return;
  }

  // 끝 패킷 (경계 역할)
  const endPacket = await videoPacketSink.getPacket(segment.endTime);
  
  let videoCount = 0;
  let isFirst = isFirstVideoPacket;
  
  for await (const packet of videoPacketSink.packets(startKeyPacket, endPacket)) {
    // 세그먼트 범위 내의 패킷만 포함
    if (packet.timestamp < segment.startTime - 0.001) continue;
    if (packet.timestamp >= segment.endTime) break;

    const meta = isFirst ? buildVideoMeta(decoderConfig, codecString) : undefined;
    await videoPacketSource.add(packet, meta);
    isFirst = false;
    videoCount++;
  }
  
  onLog(`  📹 비디오: ${videoCount} packets 복사됨`);

  // ── 오디오 패킷 복사 ──
  if (audioPacketSink && audioPacketSource && audioTrack) {
    let audioCount = 0;
    let isFirstAudio = isFirstAudioPacket;

    const audioStartPacket = await audioPacketSink.getPacket(segment.startTime);
    const audioEndPacket = await audioPacketSink.getPacket(segment.endTime);

    if (audioStartPacket) {
      for await (const packet of audioPacketSink.packets(audioStartPacket, audioEndPacket)) {
        if (packet.timestamp < segment.startTime - 0.01) continue;
        if (packet.timestamp >= segment.endTime) break;

        const meta = isFirstAudio && audioDecoderConfig ? buildAudioMeta(audioDecoderConfig) : undefined;
        await audioPacketSource.add(packet, meta);
        isFirstAudio = false;
        audioCount++;
      }
    }
    
    onLog(`  🔊 오디오: ${audioCount} packets 복사됨`);
  }
}

/**
 * Composite 구간: 디코드 → 캔버스 → 인코드 → 패킷 주입
 */
async function processCompositeSegment(params: {
  segment: RenderSegment;
  tracks: Track[];
  videoSampleSink: VideoSampleSink;
  audioPacketSink: EncodedPacketSink | null;
  videoPacketSource: EncodedVideoPacketSource;
  audioPacketSource: EncodedAudioPacketSource | null;
  audioTrack: any;
  manualEncoder: ManualVideoEncoder;
  compositeCanvas: OffscreenCanvas;
  compositeCtx: OffscreenCanvasRenderingContext2D;
  effectiveWidth: number;
  effectiveHeight: number;
  isFirstVideoPacket: boolean;
  isFirstAudioPacket: boolean;
  decoderConfig: VideoDecoderConfig;
  audioDecoderConfig: AudioDecoderConfig | null;
  codecString: string;
  onLog: (msg: string) => void;
}): Promise<void> {
  const {
    segment, tracks, videoSampleSink, audioPacketSink,
    videoPacketSource, audioPacketSource, audioTrack,
    manualEncoder, compositeCanvas, compositeCtx,
    effectiveWidth, effectiveHeight,
    isFirstVideoPacket, isFirstAudioPacket,
    decoderConfig, audioDecoderConfig, codecString, onLog,
  } = params;

  let frameCount = 0;
  let isFirstVideo = isFirstVideoPacket;

  // 비디오 프레임 순회: 디코드 → 오버레이 → 인코드
  for await (const sample of videoSampleSink.samples(segment.startTime, segment.endTime)) {
    const timestamp = sample.timestamp;
    
    // 캔버스에 원본 프레임 그리기
    compositeCtx.clearRect(0, 0, effectiveWidth, effectiveHeight);
    sample.draw(compositeCtx, 0, 0, effectiveWidth, effectiveHeight);

    // 텍스트 오버레이 그리기
    const overlays = collectTextOverlays(tracks, timestamp);
    if (overlays.length > 0) {
      drawTextOverlays(compositeCtx, overlays, effectiveWidth, effectiveHeight);
    }

    // 캔버스 → VideoFrame → 인코딩
    const frame = new VideoFrame(compositeCanvas, {
      timestamp: Math.round(sample.timestamp * 1_000_000),
      duration: Math.round(sample.duration * 1_000_000),
    });
    // @ts-ignore
    const compositeSample = (await import('mediabunny')).VideoSample.fromVideoFrame(frame);
    frame.close();

    const packets = await manualEncoder.encode(compositeSample);
    compositeSample.close();
    sample.close(); // 원본 프레임 해제

    // 인코딩된 패킷을 Output에 주입
    for (const { packet, meta } of packets) {
      const outputMeta = isFirstVideo ? buildVideoMeta(decoderConfig, codecString) : undefined;
      await videoPacketSource.add(packet, outputMeta);
      isFirstVideo = false;
    }

    frameCount++;
  }

  onLog(`  📹 비디오: ${frameCount} frames 인코딩됨 (composite)`);

  // 오디오: composite 구간에서도 패킷 직접 복사 (텍스트 오버레이는 오디오에 영향 없음)
  if (audioPacketSink && audioPacketSource && audioTrack) {
    let audioCount = 0;
    let isFirstAudio = isFirstAudioPacket;

    const audioStartPacket = await audioPacketSink.getPacket(segment.startTime);
    const audioEndPacket = await audioPacketSink.getPacket(segment.endTime);

    if (audioStartPacket) {
      for await (const packet of audioPacketSink.packets(audioStartPacket, audioEndPacket)) {
        if (packet.timestamp < segment.startTime - 0.01) continue;
        if (packet.timestamp >= segment.endTime) break;

        const meta = isFirstAudio && audioDecoderConfig ? buildAudioMeta(audioDecoderConfig) : undefined;
        await audioPacketSource.add(packet, meta);
        isFirstAudio = false;
        audioCount++;
      }
    }

    onLog(`  🔊 오디오: ${audioCount} packets 복사됨`);
  }
}

/**
 * 갭 구간: 검은 프레임 + 무음 생성
 */
async function processGapSegment(params: {
  segment: RenderSegment;
  effectiveWidth: number;
  effectiveHeight: number;
  compositeCanvas: OffscreenCanvas;
  compositeCtx: OffscreenCanvasRenderingContext2D;
  videoPacketSource: EncodedVideoPacketSource;
  audioPacketSource: EncodedAudioPacketSource | null;
  isFirstVideoPacket: boolean;
  decoderConfig: VideoDecoderConfig;
  codecString: string;
  videoBitrate: number;
  sourceFps: number;
  onLog: (msg: string) => void;
}): Promise<void> {
  const {
    segment, effectiveWidth, effectiveHeight,
    compositeCanvas, compositeCtx,
    videoPacketSource,
    isFirstVideoPacket, decoderConfig, codecString,
    videoBitrate, sourceFps, onLog,
  } = params;

  const gapEncoder = new ManualVideoEncoder({
    codec: codecString,
    width: effectiveWidth,
    height: effectiveHeight,
    bitrate: videoBitrate,
    hardwareAcceleration: 'prefer-hardware',
    fps: sourceFps,
  });

  const frameDuration = 1 / sourceFps;
  let isFirst = isFirstVideoPacket;
  let frameCount = 0;

  for (let t = segment.startTime; t < segment.endTime; t += frameDuration) {
    compositeCtx.fillStyle = '#000000';
    compositeCtx.fillRect(0, 0, effectiveWidth, effectiveHeight);

    // 검은 화면용 VideoFrame
    const frame = new VideoFrame(compositeCanvas, {
      timestamp: Math.round(t * 1_000_000),
      duration: Math.round(Math.min(frameDuration, segment.endTime - t) * 1_000_000),
    });
    // @ts-ignore
    const sample = (await import('mediabunny')).VideoSample.fromVideoFrame(frame);
    frame.close();

    const packets = await gapEncoder.encode(sample);
    sample.close();

    for (const { packet, meta } of packets) {
      const outputMeta = isFirst ? buildVideoMeta(decoderConfig, codecString) : undefined;
      await videoPacketSource.add(packet, outputMeta);
      isFirst = false;
    }
    frameCount++;
  }

  // Flush
  const remaining = await gapEncoder.flush();
  for (const { packet } of remaining) {
    await videoPacketSource.add(packet);
  }
  gapEncoder.close();

  onLog(`  ⬛ 갭: ${frameCount} 검은 프레임 생성`);
}

// ─── Fast Path: Transmux (전체 Passthrough) ──────────────────────────────────

async function transmuxFastPath(
  input: Input,
  videoTrack: any,
  audioTrack: any,
  rangeStart: number,
  rangeEnd: number,
  onProgress: (data: any) => void,
  onLog: (msg: string) => void,
  t0: number,
): Promise<Blob> {
  const { Conversion } = await import('mediabunny');

  const outputFormat = new Mp4OutputFormat({ fastStart: 'in-memory' });
  const bufferTarget = new BufferTarget();
  const output = new Output({ format: outputFormat, target: bufferTarget });

  const conversion = await Conversion.init({
    input,
    output,
    trim: { start: rangeStart, end: rangeEnd },
    // forceTranscode 없음 → 패킷 직접 복사
  });

  if (!(conversion as any).isValid) {
    const reasons = (conversion as any).discardedTracks.map((t: any) => `${t.track.type}: ${t.reason}`).join(', ');
    onLog(`⚠️ 일부 트랙 제외됨: ${reasons}`);
  }

  (conversion as any).onProgress = (p: number) => onProgress({
    phase: 'encoding',
    percent: Math.round(p * 100),
    message: '복사 중…',
    elapsedMs: performance.now() - t0,
  });
  await (conversion as any).execute();

  const elapsed = performance.now() - t0;
  const resultBuffer = (bufferTarget as any).buffer;
  if (!resultBuffer) throw new Error('출력 버퍼가 비어있습니다.');
  
  const blob = new Blob([resultBuffer], { type: 'video/mp4' });
  const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
  const speed = ((rangeEnd - rangeStart) / (elapsed / 1000)).toFixed(1);

  onLog(`✅ Transmux 완료: ${sizeMB} MB · ${fmtTime(elapsed)} (${speed}x 실시간)`);
  onProgress({
    phase: 'done',
    percent: 100,
    message: '내보내기 완료!',
    elapsedMs: elapsed,
  });
  input.dispose();

  return blob;
}

// ─── Helper: 메타데이터 빌더 ─────────────────────────────────────────────────

function buildVideoMeta(
  decoderConfig: VideoDecoderConfig,
  codecString: string,
): any {
  return {
    decoderConfig: {
      codec: codecString,
      codedWidth: decoderConfig.codedWidth,
      codedHeight: decoderConfig.codedHeight,
      colorSpace: decoderConfig.colorSpace,
      description: decoderConfig.description,
    },
  };
}

function buildAudioMeta(
  decoderConfig: AudioDecoderConfig,
): any {
  return {
    decoderConfig: {
      codec: decoderConfig.codec,
      numberOfChannels: decoderConfig.numberOfChannels,
      sampleRate: decoderConfig.sampleRate,
      description: decoderConfig.description,
    },
  };
}

// ─── Export: isWebCodecsSupported ─────────────────────────────────────────────

export function isSmartRenderSupported(): boolean {
  return (
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoDecoder !== 'undefined' &&
    typeof AudioEncoder !== 'undefined' &&
    typeof AudioDecoder !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined'
  );
}
