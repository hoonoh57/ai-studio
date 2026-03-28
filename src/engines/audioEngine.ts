// src/engines/audioEngine.ts
// B1-1: Web Audio API 기반 타임라인 오디오 동기 재생 엔진
// B1-2: GainNode 볼륨 실시간 반영
// B1-3: 페이드 인/아웃
// B1-5: AnalyserNode VU 미터링

import type { Clip, Track } from '@/types/project';

/* ─── 상수 ─── */
const FADE_MIN_DURATION = 0.005;
const METER_FFT_SIZE = 256;
const SEEK_TOLERANCE = 0.08;
const PRELOAD_BUFFER_LIMIT = 50;

/* ─── 타입 ─── */
interface AudioClipState {
    clipId: string;
    assetId: string;
    sourceNode: AudioBufferSourceNode | null;
    gainNode: GainNode;
    buffer: AudioBuffer;
    startedAt: number;
    offsetAt: number;
    isPlaying: boolean;
}

interface MeterData {
    peak: number;
    rms: number;
}

export interface AudioEngineApi {
    init(): void;
    dispose(): void;
    resume(): Promise<void>;
    isReady(): boolean;

    loadBuffer(assetId: string, url: string): Promise<AudioBuffer | null>;
    getBuffer(assetId: string): AudioBuffer | null;

    syncToTimeline(
        time: number,
        isPlaying: boolean,
        tracks: Track[],
    ): void;

    setMasterVolume(volume: number): void;
    getMeterData(): MeterData;

    setClipVolume(clipId: string, volume: number): void;
    setClipFade(
        clipId: string,
        fadeIn: number,
        fadeOut: number,
        clipDuration: number,
    ): void;
}

/* ─── 엔진 구현 ─── */
export function createAudioEngine(): AudioEngineApi {
    let ctx: AudioContext | null = null;
    let masterGain: GainNode | null = null;
    let analyser: AnalyserNode | null = null;
    let analyserData: Uint8Array | null = null;

    const bufferCache = new Map<string, AudioBuffer>();
    const activeClips = new Map<string, AudioClipState>();
    let disposed = false;

    /* ── 초기화 ── */
    function init(): void {
        if (ctx) return;
        ctx = new AudioContext({ sampleRate: 44100 });
        masterGain = ctx.createGain();
        masterGain.gain.value = 1.0;

        analyser = ctx.createAnalyser();
        analyser.fftSize = METER_FFT_SIZE;
        analyser.smoothingTimeConstant = 0.8;
        analyserData = new Uint8Array(analyser.frequencyBinCount);

        masterGain.connect(analyser);
        analyser.connect(ctx.destination);
        disposed = false;
    }

    function dispose(): void {
        disposed = true;
        stopAll();
        bufferCache.clear();
        if (ctx && ctx.state !== 'closed') {
            ctx.close().catch(() => { /* noop */ });
        }
        ctx = null;
        masterGain = null;
        analyser = null;
        analyserData = null;
    }

    async function resume(): Promise<void> {
        if (!ctx) init();
        if (ctx && ctx.state === 'suspended') {
            await ctx.resume();
        }
    }

    function isReady(): boolean {
        return ctx !== null && ctx.state === 'running';
    }

    /* ── 버퍼 관리 ── */
    async function loadBuffer(
        assetId: string,
        url: string,
    ): Promise<AudioBuffer | null> {
        if (bufferCache.has(assetId)) return bufferCache.get(assetId)!;
        if (!ctx) init();
        if (!ctx) return null;

        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            if (bufferCache.size >= PRELOAD_BUFFER_LIMIT) {
                const firstKey = bufferCache.keys().next().value;
                if (firstKey !== undefined) bufferCache.delete(firstKey);
            }
            bufferCache.set(assetId, audioBuffer);
            return audioBuffer;
        } catch {
            return null;
        }
    }

    function getBuffer(assetId: string): AudioBuffer | null {
        return bufferCache.get(assetId) ?? null;
    }

    /* ── 클립 재생/정지 ── */
    function playClip(
        clip: Clip,
        buffer: AudioBuffer,
        timelineTime: number,
        volume: number,
        muted: boolean,
    ): void {
        if (!ctx || !masterGain || disposed) return;

        const existing = activeClips.get(clip.id);
        if (existing && existing.isPlaying) {
            const expectedOffset = existing.offsetAt
                + (ctx.currentTime - existing.startedAt);
            const clipLocalTime = timelineTime - clip.startTime + (clip.inPoint || 0);
            if (Math.abs(expectedOffset - clipLocalTime) < SEEK_TOLERANCE) {
                existing.gainNode.gain.value = muted ? 0 : volume;
                return;
            }
            stopClip(clip.id);
        }

        const gainNode = ctx.createGain();
        gainNode.gain.value = muted ? 0 : volume;
        gainNode.connect(masterGain);

        const sourceNode = ctx.createBufferSource();
        sourceNode.buffer = buffer;
        sourceNode.playbackRate.value = clip.speed || 1;
        sourceNode.connect(gainNode);

        const clipOffset = timelineTime - clip.startTime + (clip.inPoint || 0);
        const safeOffset = Math.max(0, Math.min(clipOffset, buffer.duration - 0.01));
        const remaining = buffer.duration - safeOffset;

        sourceNode.start(0, safeOffset, remaining > 0 ? remaining : undefined);

        const state: AudioClipState = {
            clipId: clip.id,
            assetId: clip.assetId,
            sourceNode,
            gainNode,
            buffer,
            startedAt: ctx.currentTime,
            offsetAt: safeOffset,
            isPlaying: true,
        };

        sourceNode.onended = () => {
            state.isPlaying = false;
            gainNode.disconnect();
            activeClips.delete(clip.id);
        };

        activeClips.set(clip.id, state);
    }

    function stopClip(clipId: string): void {
        const state = activeClips.get(clipId);
        if (!state) return;
        try {
            if (state.sourceNode) {
                state.sourceNode.onended = null;
                state.sourceNode.stop();
                state.sourceNode.disconnect();
            }
            state.gainNode.disconnect();
        } catch { /* already stopped */ }
        state.isPlaying = false;
        activeClips.delete(clipId);
    }

    function stopAll(): void {
        for (const [id] of activeClips) {
            stopClip(id);
        }
    }

    /* ── 타임라인 동기화 (매 프레임 호출) ── */
    function syncToTimeline(
        time: number,
        isPlaying: boolean,
        tracks: Track[],
    ): void {
        if (!ctx || !masterGain || disposed) return;

        if (!isPlaying) {
            stopAll();
            return;
        }

        const anySolo = tracks.some(
            t => (t.type === 'audio' || t.type === 'video') && t.solo,
        );

        const shouldPlayClips = new Set<string>();

        for (const track of tracks) {
            if (track.type !== 'audio' && track.type !== 'video') continue;
            if (!track.visible) continue;

            const trackMuted = track.muted
                || (anySolo && !track.solo);

            for (const clip of track.clips) {
                const clipEnd = clip.startTime + clip.duration;
                if (time >= clip.startTime && time < clipEnd) {
                    const buffer = bufferCache.get(clip.assetId);
                    if (!buffer) continue;

                    shouldPlayClips.add(clip.id);
                    const clipVolume = clip.volume ?? 1;
                    playClip(clip, buffer, time, clipVolume, trackMuted);
                }
            }
        }

        for (const [clipId] of activeClips) {
            if (!shouldPlayClips.has(clipId)) {
                stopClip(clipId);
            }
        }
    }

    /* ── 볼륨/페이드 ── */
    function setMasterVolume(volume: number): void {
        if (!masterGain) return;
        masterGain.gain.value = Math.max(0, Math.min(2, volume));
    }

    function setClipVolume(clipId: string, volume: number): void {
        const state = activeClips.get(clipId);
        if (!state) return;
        state.gainNode.gain.value = Math.max(0, Math.min(2, volume));
    }

    function setClipFade(
        clipId: string,
        fadeIn: number,
        fadeOut: number,
        clipDuration: number,
    ): void {
        const state = activeClips.get(clipId);
        if (!state || !ctx) return;
        const gain = state.gainNode.gain;
        const now = ctx.currentTime;
        const elapsed = now - state.startedAt;
        const volume = gain.value || 1;

        gain.cancelScheduledValues(now);

        if (fadeIn > FADE_MIN_DURATION && elapsed < fadeIn) {
            gain.setValueAtTime(0, now);
            gain.linearRampToValueAtTime(
                volume,
                now + (fadeIn - elapsed),
            );
        }

        if (fadeOut > FADE_MIN_DURATION) {
            const fadeOutStart = clipDuration - fadeOut - elapsed;
            if (fadeOutStart > 0) {
                gain.setValueAtTime(volume, now + fadeOutStart);
                gain.linearRampToValueAtTime(0, now + fadeOutStart + fadeOut);
            }
        }
    }

    /* ── 미터링 ── */
    function getMeterData(): MeterData {
        if (!analyser || !analyserData) return { peak: 0, rms: 0 };
        analyser.getByteTimeDomainData(analyserData);

        let peak = 0;
        let sumSq = 0;
        const len = analyserData.length;
        for (let i = 0; i < len; i++) {
            const sample = (analyserData[i] - 128) / 128;
            const abs = Math.abs(sample);
            if (abs > peak) peak = abs;
            sumSq += sample * sample;
        }
        const rms = Math.sqrt(sumSq / len);
        return { peak: Math.min(1, peak), rms: Math.min(1, rms) };
    }

    return {
        init,
        dispose,
        resume,
        isReady,
        loadBuffer,
        getBuffer,
        syncToTimeline,
        setMasterVolume,
        getMeterData,
        setClipVolume,
        setClipFade,
    };
}

/* ─── 싱글턴 인스턴스 ─── */
export const audioEngine = createAudioEngine();
