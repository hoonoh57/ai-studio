/* ─── src/components/Panels/ExportPanel.tsx ─── */
/* B7-5 + B7-6 + B7-7: 내보내기 패널 UI */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import {
  createExportEngine, EXPORT_PRESETS,
  type ExportPreset, type ExportProgress, type ExportEngineApi,
} from '@/engines/exportEngine';
import { mixdownToWav } from '@/lib/core/offlineAudioMixer';
import type { Clip, Asset } from '@/types/project';

/* ═══ 스타일 ═══ */
const S: Record<string, React.CSSProperties> = {
  root: {
    padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
    height: '100%', overflowY: 'auto', fontSize: 12, color: '#ddd',
  },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  section: { fontSize: 11, fontWeight: 600, color: '#aaa', marginBottom: 4 },
  presetGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
  },
  presetCard: {
    padding: '8px 10px', borderRadius: 8,
    border: '2px solid #333', background: '#1a1a2e',
    cursor: 'pointer', transition: 'border-color .15s',
    display: 'flex', flexDirection: 'column' as const, gap: 2,
  },
  presetCardSelected: {
    borderColor: 'var(--accent, #6496ff)',
    background: '#1a2a4a',
  },
  presetIcon: { fontSize: 18 },
  presetName: { fontSize: 11, fontWeight: 600, color: '#fff' },
  presetDesc: { fontSize: 9, color: '#888' },
  presetSpec: { fontSize: 9, color: '#666' },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  btn: {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: 'var(--accent, #6496ff)', color: '#fff',
    cursor: 'pointer', fontSize: 12, fontWeight: 700,
    width: '100%',
  },
  btnDisabled: {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: '#333', color: '#666',
    cursor: 'not-allowed', fontSize: 12, fontWeight: 700,
    width: '100%',
  },
  btnLoad: {
    padding: '8px 16px', borderRadius: 8, border: '1px dashed #555',
    background: '#111', color: '#aaa',
    cursor: 'pointer', fontSize: 11, fontWeight: 600,
    width: '100%', textAlign: 'center' as const,
  },
  progressWrap: {
    padding: 12, borderRadius: 8, background: '#111',
    border: '1px solid #333',
  },
  progressBar: {
    height: 8, borderRadius: 4, background: '#222',
    overflow: 'hidden', marginBottom: 6,
  },
  progressFill: {
    height: '100%', borderRadius: 4,
    background: 'linear-gradient(90deg, #6496ff, #50c878)',
    transition: 'width .3s',
  },
  progressText: { fontSize: 10, color: '#888', lineHeight: 1.4 },
  divider: { height: 1, background: '#333', margin: '4px 0' },
  checkbox: { accentColor: 'var(--accent, #6496ff)' },
  link: {
    display: 'block', padding: '10px 16px', borderRadius: 8,
    background: '#1a3a1a', color: '#50c878', textAlign: 'center' as const,
    fontWeight: 700, fontSize: 12, textDecoration: 'none',
    border: '1px solid #2a5a2a',
  },
  videoPreview: {
    width: '100%', borderRadius: 8, marginTop: 6,
    background: '#000', maxHeight: 200,
  },
  log: {
    maxHeight: 80, overflowY: 'auto' as const, fontSize: 9,
    color: '#555', fontFamily: 'monospace', padding: 4,
    background: '#0a0a0a', borderRadius: 4, marginTop: 4,
  },
};

/* ═══ 헬퍼 ═══ */
function formatTime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ═══ 컴포넌트 ═══ */
export function ExportPanel(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const inOut = useEditorStore(s => s.inOut);
  const setCurrentTime = useEditorStore(s => s.setCurrentTime);
  const isPlaying = useEditorStore(s => s.isPlaying);
  const togglePlay = useEditorStore(s => s.togglePlay);

  const [selectedPresetId, setSelectedPresetId] = useState('yt-1080');
  const [useInOut, setUseInOut] = useState(false);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const engineRef = useRef<ExportEngineApi | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const abortRef = useRef(false);

  const preset = EXPORT_PRESETS.find(p => p.id === selectedPresetId) ?? EXPORT_PRESETS[0];

  /* 프리뷰 Canvas 찾기 */
  useEffect(() => {
    const el = document.querySelector('canvas') as HTMLCanvasElement | null;
    canvasRef.current = el;
  }, []);

  /* ── FFmpeg 로드 (B7-1) ── */
  const handleLoad = useCallback(async () => {
    setLoading(true);
    setLogs([]);
    try {
      const engine = createExportEngine();
      await engine.init((msg) => {
        setLogs(prev => [...prev.slice(-50), msg]);
      });
      engineRef.current = engine;
      setFfmpegLoaded(true);
    } catch (err) {
      console.error('[ExportPanel] FFmpeg 로드 실패:', err);
      setLogs(prev => [...prev, `❌ 로드 실패: ${err}`]);
    }
    setLoading(false);
  }, []);

  /* ─── 내보내기 캔버스 폴백 (기존 방식) ─── */
  const handleCanvasFallbackExport = useCallback(async (
    engine: ExportEngineApi, startT: number, endT: number, preset: ExportPreset
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const totalFrames = Math.ceil((endT - startT) * preset.fps);
    const exportStart = performance.now();

    try {
      /* ═══ Phase 1: 프레임 캡처 (B7-2) ═══ */
      for (let i = 0; i < totalFrames; i++) {
        if (abortRef.current) throw new Error('사용자 취소');
        const t = startT + i / preset.fps;
        setCurrentTime(t);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(b => { if (b) resolve(b); else reject(new Error('toBlob 실패')); }, 'image/png');
        });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        await engine.writeFrame(bytes, i);

        const elapsed = performance.now() - exportStart;
        const pct = Math.round(((i + 1) / totalFrames) * 70);
        setProgress({
          phase: 'frames', percent: pct, currentFrame: i + 1, totalFrames,
          elapsedMs: elapsed, estimatedRemainingMs: pct > 0 ? (elapsed / pct) * (100 - pct) : 0,
          message: `프레임 캡처 ${i + 1}/${totalFrames}`,
        });
      }

      /* ═══ Phase 2: 오디오 믹스다운 (B7-3) ═══ */
      let hasAudio = false;
      const wavBytes = await mixdownToWav(project.tracks, project.assets, startT, endT);
      if (wavBytes) {
        await engine.writeAudioWav(wavBytes);
        hasAudio = true;
      }

      /* ═══ Phase 3: 인코딩 + 먹싱 (B7-4) ═══ */
      const data = await engine.encode(preset, totalFrames, hasAudio, (p) => {
        setProgress({ ...p, percent: 80 + Math.round(p.percent * 0.19) });
      });

      /* ═══ Phase 4: 완료 ═══ */
      await engine.cleanup(totalFrames);
      const blob = new Blob([data as any], { type: `video/${preset.format}` });
      const url = URL.createObjectURL(blob);
      setResultUrl(url);

      const totalElapsed = performance.now() - exportStart;
      setProgress({
        phase: 'done', percent: 100, currentFrame: totalFrames, totalFrames,
        elapsedMs: totalElapsed, estimatedRemainingMs: 0,
        message: `✅ 완료! (${formatTime(totalElapsed)})`,
      });
    } catch (err: any) {
      throw err;
    }
  }, [setCurrentTime, project, formatTime]);

  /* ── 내보내기 실행 (Direct Path 도입) ── */
  const handleExport = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (isPlaying) togglePlay();
    abortRef.current = false;
    setExporting(true);
    setResultUrl(null);
    setLogs([]);

    const startT = useInOut && inOut.inPoint !== null ? inOut.inPoint : 0;
    const endT = useInOut && inOut.outPoint !== null ? inOut.outPoint : project.duration;
    const exportStart = performance.now();

    try {
      /* ═══ Phase 1: 소스 파일 수집 & FFmpeg FS에 기록 ═══ */
      setProgress({ phase: 'init', percent: 5, currentFrame: 0,
        totalFrames: 0, elapsedMs: 0, estimatedRemainingMs: 0,
        message: '소스 파일 로딩 중…' });

      // 비디오 클립 수집 (가장 위 비디오 트랙의 클립들)
      const videoTracks = project.tracks.filter(t => t.type === 'video');
      const audioTracks = project.tracks.filter(t => t.type === 'audio' && !t.muted);

      // ★ B7 고도화: 캔버스 폴백 조건 체크 (텍스트 클립이나 효과가 있으면 fallback)
      const hasOverlays = project.tracks.some(t => t.type === 'text' && t.clips.length > 0);
      const hasTransitions = project.transitions && project.transitions.length > 0;
      
      if (hasOverlays || hasTransitions) {
        await handleCanvasFallbackExport(engine, startT, endT, preset);
        setExporting(false);
        return;
      }

      const inputFiles: { filename: string; clip: Clip; asset: Asset }[] = [];
      let fileIdx = 0;

      for (const track of videoTracks) {
        for (const clip of track.clips) {
          if (clip.disabled) continue;
          const clipEnd = clip.startTime + clip.duration;
          if (clipEnd <= startT || clip.startTime >= endT) continue;

          const asset = project.assets.find(a => a.id === clip.assetId);
          if (!asset?.src) continue;

          const ext = asset.name?.split('.').pop() || 'mp4';
          const fn = `input_${fileIdx}.${ext}`;
          await engine.writeSourceVideo(fn, asset.src);
          inputFiles.push({ filename: fn, clip, asset });
          fileIdx++;

          setProgress(prev => prev ? {
            ...prev, percent: 10 + Math.round((fileIdx / 5) * 20),
            message: `소스 로딩 ${fileIdx}개…`,
          } : prev);
        }
      }

      /* ═══ Phase 2: 인코딩 플랜 실행 ═══ */
      setProgress(prev => prev ? {
        ...prev, phase: 'muxing', percent: 40, message: '인코딩 중…',
      } : prev);

      let hasAudio = false;

      // 오디오 소스도 로드
      for (const track of audioTracks) {
        for (const clip of track.clips) {
          if (clip.disabled) continue;
          const clipEnd = clip.startTime + clip.duration;
          if (clipEnd <= startT || clip.startTime >= endT) continue;

          const asset = project.assets.find(a => a.id === clip.assetId);
          if (!asset?.src) continue;

          const ext = asset.name?.split('.').pop() || 'mp4';
          const fn = `audio_${fileIdx}.${ext}`;
          await engine.writeSourceVideo(fn, asset.src);
          hasAudio = true;
          fileIdx++;
        }
      }

      // 가장 단순한 케이스: 단일 비디오 클립 → 직접 트랜스코딩
      if (inputFiles.length === 1) {
        const { filename, clip } = inputFiles[0];
        const inPt = clip.inPoint || 0;
        const dur = Math.min(clip.duration, endT - startT);

        const args: string[] = [
          '-ss', String(inPt),
          '-i', filename,
          '-t', String(dur),
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-b:v', preset.videoBitrate,
          '-preset', 'fast',
          '-movflags', '+faststart',
          '-vf', `scale=${preset.width}:${preset.height}`,
        ];

        if (hasAudio) {
          args.push('-c:a', 'aac', '-b:a', preset.audioBitrate);
        } else {
          args.push('-an');
        }

        args.push(`output.${preset.format}`);
        await engine.encodeDirect(args);

      } else if (inputFiles.length > 1) {
        // 다중 클립: concat 방식
        const concatList = inputFiles
          .map(f => `file '${f.filename}'`)
          .join('\n');
        await engine.writeTextFile('concat.txt', concatList);

        const args: string[] = [
          '-f', 'concat', '-safe', '0',
          '-i', 'concat.txt',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-b:v', preset.videoBitrate,
          '-preset', 'fast',
          '-movflags', '+faststart',
          '-vf', `scale=${preset.width}:${preset.height}`,
        ];
        if (hasAudio) {
          args.push('-c:a', 'aac', '-b:a', preset.audioBitrate);
        } else {
          args.push('-an');
        }
        args.push(`output.${preset.format}`);
        await engine.encodeDirect(args);

      } else {
        // 클립 없음 → Canvas fallback
        await handleCanvasFallbackExport(engine, startT, endT, preset);
        setExporting(false);
        return;
      }

      /* ═══ Phase 3: 결과 읽기 ═══ */
      const data = await engine.readOutput(`output.${preset.format}`);
      const blob = new Blob([data as any], { type: `video/${preset.format}` });
      const url = URL.createObjectURL(blob);
      setResultUrl(url);

      const totalElapsed = performance.now() - exportStart;
      setProgress({
        phase: 'done', percent: 100,
        currentFrame: 0, totalFrames: 0,
        elapsedMs: totalElapsed, estimatedRemainingMs: 0,
        message: `✅ 완료! (${formatTime(totalElapsed)})`,
      });

    } catch (err: any) {
      console.error('[ExportPanel] 내보내기 실패:', err);
      setProgress(prev => prev ? {
        ...prev, phase: 'error',
        message: `❌ 오류: ${err.message || err}`,
      } : null);
    }

    setExporting(false);
  }, [isPlaying, togglePlay, setCurrentTime, useInOut, inOut, project, preset, handleCanvasFallbackExport]);

  /* ── 취소 ── */
  const handleAbort = useCallback(() => {
    abortRef.current = true;
  }, []);

  /* ── 다운로드 ── */
  const handleDownload = useCallback(() => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `${project.name || 'BadaCut'}_${preset.id}.${preset.format}`;
    a.click();
  }, [resultUrl, project.name, preset]);

  /* 범위 계산 */
  const rangeStart = useInOut && inOut.inPoint !== null ? inOut.inPoint : 0;
  const rangeEnd = useInOut && inOut.outPoint !== null ? inOut.outPoint : project.duration;
  const rangeDuration = rangeEnd - rangeStart;
  const estFrames = Math.ceil(rangeDuration * preset.fps);

  return (
    <div style={S.root}>
      <div style={S.title}>📤 내보내기</div>

      {/* FFmpeg 로드 */}
      {!ffmpegLoaded && (
        <button
          style={S.btnLoad}
          onClick={handleLoad}
          disabled={loading}
        >
          {loading ? '⏳ FFmpeg 로딩 중… (~31MB)' : '🔄 인코더 로드 (~31MB)'}
        </button>
      )}
      {ffmpegLoaded && (
        <div style={{ fontSize: 10, color: '#50c878' }}>✅ FFmpeg 준비 완료</div>
      )}

      <div style={S.divider} />

      {/* 프리셋 선택 (B7-5) */}
      <div style={S.section}>플랫폼 프리셋</div>
      <div style={S.presetGrid}>
        {EXPORT_PRESETS.map(p => (
          <div
            key={p.id}
            style={{
              ...S.presetCard,
              ...(p.id === selectedPresetId ? S.presetCardSelected : {}),
            }}
            onClick={() => setSelectedPresetId(p.id)}
          >
            <span style={S.presetIcon}>{p.icon}</span>
            <span style={S.presetName}>{p.name}</span>
            <span style={S.presetDesc}>{p.description}</span>
            <span style={S.presetSpec}>
              {p.width}×{p.height} · {p.fps}fps · {p.videoBitrate}
            </span>
          </div>
        ))}
      </div>

      <div style={S.divider} />

      {/* In/Out 범위 (B7-7) */}
      <div style={{ ...S.row, marginBottom: 4 }}>
        <input
          type="checkbox"
          style={S.checkbox}
          checked={useInOut}
          onChange={e => setUseInOut(e.target.checked)}
          id="export-inout"
        />
        <label htmlFor="export-inout" style={{ fontSize: 11, cursor: 'pointer' }}>
          In/Out 범위만 내보내기
        </label>
      </div>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>
        범위: {rangeStart.toFixed(1)}s ~ {rangeEnd.toFixed(1)}s
        ({rangeDuration.toFixed(1)}초, ~{estFrames}프레임)
      </div>

      <div style={S.divider} />

      {/* 내보내기 버튼 */}
      {!exporting ? (
        <button
          style={ffmpegLoaded ? S.btn : S.btnDisabled}
          onClick={handleExport}
          disabled={!ffmpegLoaded}
        >
          🎬 내보내기 시작
        </button>
      ) : (
        <button
          style={{ ...S.btn, background: '#c0392b' }}
          onClick={handleAbort}
        >
          ⏹ 취소
        </button>
      )}

      {/* 진행률 (B7-6) */}
      {progress && (
        <div style={S.progressWrap}>
          <div style={S.progressBar}>
            <div style={{ ...S.progressFill, width: `${progress.percent}%` }} />
          </div>
          <div style={S.progressText}>
            {progress.message}<br />
            {progress.phase !== 'done' && progress.phase !== 'error' && (
              <>
                경과: {formatTime(progress.elapsedMs)}
                {' · '}
                남은 시간: ~{formatTime(progress.estimatedRemainingMs)}
              </>
            )}
          </div>
        </div>
      )}

      {/* 결과 다운로드 */}
      {resultUrl && (
        <>
          <a style={S.link} href="#" onClick={(e) => { e.preventDefault(); handleDownload(); }}>
            💾 {project.name || 'BadaCut'}_{preset.id}.{preset.format} 다운로드
          </a>
          <video style={S.videoPreview} src={resultUrl} controls />
        </>
      )}

      {/* 로그 */}
      {logs.length > 0 && (
        <div style={S.log}>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}

export default ExportPanel;
