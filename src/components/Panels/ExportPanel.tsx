/* ─── src/components/Panels/ExportPanel.tsx ─── */
/* B7 v2: 원본 비디오 직접 트랜스코딩 + 텍스트 번인 */

import React, { useState, useCallback, useRef } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import {
  createExportEngine, EXPORT_PRESETS,
  type ExportPreset, type ExportProgress, type ExportEngineApi,
} from '@/engines/exportEngine';
import type { Track, Clip, Asset } from '@/types/project';
// import type { TextContent } from '@/types/textClip'; // Not strictly needed if inferred, but import type { TextContent } is fine

/* ═══ 스타일 ═══ */
const S: Record<string, React.CSSProperties> = {
  root: {
    padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
    height: '100%', overflowY: 'auto', fontSize: 12, color: '#ddd',
  },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  section: { fontSize: 11, fontWeight: 600, color: '#aaa', marginBottom: 4 },
  presetGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  presetCard: {
    padding: '8px 10px', borderRadius: 8,
    border: '2px solid #333', background: '#1a1a2e',
    cursor: 'pointer', transition: 'border-color .15s',
    display: 'flex', flexDirection: 'column' as const, gap: 2,
  },
  presetCardSel: { borderColor: 'var(--accent, #6496ff)', background: '#1a2a4a' },
  presetIcon: { fontSize: 18 },
  presetName: { fontSize: 11, fontWeight: 600, color: '#fff' },
  presetDesc: { fontSize: 9, color: '#888' },
  presetSpec: { fontSize: 9, color: '#666' },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  btn: {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: 'var(--accent, #6496ff)', color: '#fff',
    cursor: 'pointer', fontSize: 12, fontWeight: 700, width: '100%',
  },
  btnOff: {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: '#333', color: '#666',
    cursor: 'not-allowed', fontSize: 12, fontWeight: 700, width: '100%',
  },
  btnLoad: {
    padding: '8px 16px', borderRadius: 8, border: '1px dashed #555',
    background: '#111', color: '#aaa',
    cursor: 'pointer', fontSize: 11, fontWeight: 600,
    width: '100%', textAlign: 'center' as const,
  },
  progressWrap: {
    padding: 12, borderRadius: 8, background: '#111', border: '1px solid #333',
  },
  progressBar: {
    height: 8, borderRadius: 4, background: '#222', overflow: 'hidden', marginBottom: 6,
  },
  progressFill: {
    height: '100%', borderRadius: 4,
    background: 'linear-gradient(90deg, #6496ff, #50c878)', transition: 'width .3s',
  },
  progressText: { fontSize: 10, color: '#888', lineHeight: 1.4 },
  divider: { height: 1, background: '#333', margin: '4px 0' },
  checkbox: { accentColor: 'var(--accent, #6496ff)' },
  link: {
    display: 'block', padding: '10px 16px', borderRadius: 8,
    background: '#1a3a1a', color: '#50c878', textAlign: 'center' as const,
    fontWeight: 700, fontSize: 12, textDecoration: 'none', border: '1px solid #2a5a2a',
  },
  videoPreview: {
    width: '100%', borderRadius: 8, marginTop: 6, background: '#000', maxHeight: 200,
  },
  log: {
    maxHeight: 100, overflowY: 'auto' as const, fontSize: 9,
    color: '#555', fontFamily: 'monospace', padding: 4,
    background: '#0a0a0a', borderRadius: 4, marginTop: 4,
  },
};

/* ═══ 헬퍼 ═══ */
function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 텍스트 클립 → FFmpeg drawtext 필터 문자열 */
function buildTextFilters(
  textTracks: Track[], startT: number, endT: number,
  outW: number, outH: number,
): string {
  const parts: string[] = [];
  for (const track of textTracks) {
    for (const clip of track.clips) {
      if (clip.disabled || !clip.textContent) continue;
      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd <= startT || clip.startTime >= endT) continue;

      const tc = clip.textContent;
      const st = tc.style;

      // 특수문자 이스케이프
      const safeText = tc.text
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "'\\\\\\''")
        .replace(/:/g, '\\:')
        .replace(/%/g, '%%');

      const fontSize = Math.round(st.fontSize * (outH / 1080));
      const x = `(w*${st.positionX / 100}-tw/2)`;
      const y = `(h*${st.positionY / 100}-th/2)`;

      // enable 구간 (export 범위 기준으로 시간 오프셋)
      const enableStart = Math.max(0, clip.startTime - startT);
      const enableEnd = Math.min(endT - startT, clipEnd - startT);

      let filter = `drawtext=text='${safeText}'`;
      filter += `:fontsize=${fontSize}`;
      filter += `:fontcolor=${st.color}`;
      filter += `:x=${x}:y=${y}`;
      filter += `:enable='between(t,${enableStart.toFixed(3)},${enableEnd.toFixed(3)})'`;

      // 외곽선
      if (st.strokeWidth > 0) {
        filter += `:borderw=${Math.round(st.strokeWidth * (outH / 1080))}`;
        filter += `:bordercolor=${st.strokeColor}`;
      }

      // 그림자
      if (st.shadowBlur > 0) {
        filter += `:shadowx=${st.shadowOffsetX || 2}:shadowy=${st.shadowOffsetY || 2}`;
        filter += `:shadowcolor=${st.shadowColor || 'black'}`;
      }

      // 배경 박스
      if (st.backgroundColor && st.backgroundColor !== 'transparent') {
        filter += `:box=1:boxcolor=${st.backgroundColor}:boxborderw=6`;
      }

      parts.push(filter);
    }
  }
  return parts.join(',');
}

/* ═══ 컴포넌트 ═══ */
export function ExportPanel(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const inOut = useEditorStore(s => s.inOut);
  const isPlaying = useEditorStore(s => s.isPlaying);
  const togglePlay = useEditorStore(s => s.togglePlay);

  const [presetId, setPresetId] = useState('yt-1080');
  const [useInOut, setUseInOut] = useState(false);
  const [ffmpegReady, setFfmpegReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const engineRef = useRef<ExportEngineApi | null>(null);
  const abortRef = useRef(false);
  const preset = EXPORT_PRESETS.find(p => p.id === presetId) ?? EXPORT_PRESETS[0];

  /* ── FFmpeg 로드 ── */
  const handleLoad = useCallback(async () => {
    setLoading(true); setLogs([]);
    try {
      const eng = createExportEngine();
      await eng.init(msg => setLogs(prev => [...prev.slice(-80), msg]));
      engineRef.current = eng;
      setFfmpegReady(true);
    } catch (err: any) {
      setLogs(prev => [...prev, `❌ 로드 실패: ${err.message || err}`]);
    }
    setLoading(false);
  }, []);

  /* ── 내보내기 ── */
  const handleExport = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng) return;
    if (isPlaying) togglePlay();
    abortRef.current = false;
    setExporting(true); setResultUrl(null); setLogs([]);

    const startT = useInOut && inOut.inPoint !== null ? inOut.inPoint : 0;
    const endT = useInOut && inOut.outPoint !== null ? inOut.outPoint : project.duration;
    const duration = endT - startT;
    const t0 = performance.now();

    eng.onProgress(setProgress, duration);

    try {
      /* ── 1. 소스 파일 수집 ── */
      setProgress({
        phase: 'loading', percent: 0, elapsedMs: 0,
        estimatedRemainingMs: 0, message: '소스 파일 로딩 중…',
      });

      const videoTracks = project.tracks.filter(t => t.type === 'video');
      const audioTracks = project.tracks.filter(t => t.type === 'audio' && !t.muted);
      const textTracks = project.tracks.filter(t => t.type === 'text');

      // 범위 내 비디오 클립 수집
      interface ClipInfo { clip: Clip; asset: Asset; fn: string }
      const vClips: ClipInfo[] = [];
      let fi = 0;

      for (const trk of videoTracks) {
        for (const clip of [...trk.clips].sort((a, b) => a.startTime - b.startTime)) {
          if (clip.disabled) continue;
          const ce = clip.startTime + clip.duration;
          if (ce <= startT || clip.startTime >= endT) continue;
          const asset = project.assets.find(a => a.id === clip.assetId);
          if (!asset?.src) continue;
          const ext = (asset.name?.split('.').pop() || 'mp4').toLowerCase();
          const fn = `v${fi}.${ext}`;
          await eng.writeFile(fn, asset.src);
          vClips.push({ clip, asset, fn });
          fi++;
          setProgress(prev => prev ? {
            ...prev, percent: Math.min(20, fi * 5),
            message: `소스 로딩 ${fi}개…`,
          } : prev);
        }
      }

      if (vClips.length === 0) {
        throw new Error('내보낼 비디오 클립이 없습니다.');
      }

      /* ── 2. 인코딩 ── */
      setProgress(prev => prev ? {
        ...prev, phase: 'encoding', percent: 25, message: '인코딩 시작…',
      } : prev);

      const outFile = `output.${preset.format}`;

      // 텍스트 필터 생성
      const textFilter = buildTextFilters(textTracks, startT, endT, preset.width, preset.height);

      if (vClips.length === 1) {
        /* ── 단일 클립: 직접 트랜스코딩 ── */
        const { clip, fn } = vClips[0];
        const inPt = (clip.inPoint || 0) + Math.max(0, startT - clip.startTime);
        const dur = Math.min(clip.duration, duration);

        const vf: string[] = [];
        vf.push(`scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease`);
        vf.push(`pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2:black`);
        if (textFilter) vf.push(textFilter);

        const args: string[] = [
          '-ss', inPt.toFixed(3),
          '-i', fn,
          '-t', dur.toFixed(3),
          '-vf', vf.join(','),
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-b:v', preset.videoBitrate,
          '-r', String(preset.fps),
          '-preset', 'fast',
          '-movflags', '+faststart',
          '-c:a', 'aac', '-b:a', preset.audioBitrate,
          '-y', outFile,
        ];
        await eng.exec(args);

      } else {
        /* ── 다중 클립: 각각 트랜스코딩 후 concat ── */
        const segFiles: string[] = [];

        for (let i = 0; i < vClips.length; i++) {
          const { clip, fn } = vClips[i];
          const clipStart = Math.max(clip.startTime, startT);
          const clipEnd = Math.min(clip.startTime + clip.duration, endT);
          const inPt = (clip.inPoint || 0) + (clipStart - clip.startTime);
          const dur = clipEnd - clipStart;
          if (dur <= 0) continue;

          const segFn = `seg${i}.ts`;

          const vf: string[] = [];
          vf.push(`scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease`);
          vf.push(`pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2:black`);

          const segArgs: string[] = [
            '-ss', inPt.toFixed(3),
            '-i', fn,
            '-t', dur.toFixed(3),
            '-vf', vf.join(','),
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
            '-b:v', preset.videoBitrate,
            '-r', String(preset.fps),
            '-preset', 'fast',
            '-c:a', 'aac', '-b:a', preset.audioBitrate,
            '-y', segFn,
          ];
          await eng.exec(segArgs);
          segFiles.push(segFn);

          setProgress(prev => prev ? {
            ...prev, percent: 25 + Math.round(((i + 1) / vClips.length) * 50),
            message: `세그먼트 ${i + 1}/${vClips.length} 인코딩…`,
          } : prev);
        }

        // concat
        const listContent = segFiles.map(f => `file '${f}'`).join('\n');
        await eng.writeText('list.txt', listContent);

        const concatVf: string[] = [];
        if (textFilter) concatVf.push(textFilter);

        const concatArgs: string[] = [
          '-f', 'concat', '-safe', '0',
          '-i', 'list.txt',
          '-c', 'copy',
        ];
        if (concatVf.length > 0) {
          // 텍스트가 있으면 재인코딩 필요
          concatArgs.pop(); // remove '-c copy'의 'copy'
          concatArgs.pop(); // remove '-c'
          concatArgs.push(
            '-vf', concatVf.join(','),
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
            '-b:v', preset.videoBitrate,
            '-preset', 'fast',
            '-c:a', 'aac', '-b:a', preset.audioBitrate,
          );
        }
        concatArgs.push('-movflags', '+faststart', '-y', outFile);
        await eng.exec(concatArgs);

        // 세그먼트 정리
        for (const sf of segFiles) await eng.deleteFile(sf);
        await eng.deleteFile('list.txt');
      }

      /* ── 3. 결과 ── */
      const data = await eng.readFile(outFile);
      // 소스 정리
      for (const vc of vClips) await eng.deleteFile(vc.fn);
      await eng.deleteFile(outFile);

      const blob = new Blob([data], { type: `video/${preset.format}` });
      const url = URL.createObjectURL(blob);
      setResultUrl(url);

      setProgress({
        phase: 'done', percent: 100,
        elapsedMs: performance.now() - t0, estimatedRemainingMs: 0,
        message: `✅ 완료! (${fmtTime(performance.now() - t0)})`,
      });

    } catch (err: any) {
      console.error('[Export]', err);
      setProgress(prev => prev ? {
        ...prev, phase: 'error',
        message: `❌ ${err.message || err}`,
      } : null);
    }
    setExporting(false);
  }, [isPlaying, togglePlay, useInOut, inOut, project, preset]);

  const handleDownload = useCallback(() => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `${project.name || 'BadaCut'}_${preset.id}.${preset.format}`;
    a.click();
  }, [resultUrl, project.name, preset]);

  const rangeStart = useInOut && inOut.inPoint !== null ? inOut.inPoint : 0;
  const rangeEnd = useInOut && inOut.outPoint !== null ? inOut.outPoint : project.duration;
  const rangeDur = rangeEnd - rangeStart;

  return (
    <div style={S.root}>
      <div style={S.title}>📤 내보내기</div>

      {!ffmpegReady ? (
        <button style={S.btnLoad} onClick={handleLoad} disabled={loading}>
          {loading ? '⏳ FFmpeg 로딩 중… (~31MB)' : '🔄 인코더 로드 (~31MB)'}
        </button>
      ) : (
        <div style={{ fontSize: 10, color: '#50c878' }}>✅ FFmpeg 준비 완료</div>
      )}

      <div style={S.divider} />

      <div style={S.section}>플랫폼 프리셋</div>
      <div style={S.presetGrid}>
        {EXPORT_PRESETS.map(p => (
          <div
            key={p.id}
            style={{ ...S.presetCard, ...(p.id === presetId ? S.presetCardSel : {}) }}
            onClick={() => setPresetId(p.id)}
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

      <div style={{ ...S.row, marginBottom: 4 }}>
        <input type="checkbox" style={S.checkbox} checked={useInOut}
          onChange={e => setUseInOut(e.target.checked)} id="exp-io" />
        <label htmlFor="exp-io" style={{ fontSize: 11, cursor: 'pointer' }}>
          In/Out 범위만 내보내기
        </label>
      </div>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>
        범위: {rangeStart.toFixed(1)}s ~ {rangeEnd.toFixed(1)}s ({rangeDur.toFixed(1)}초)
      </div>

      <div style={S.divider} />

      {!exporting ? (
        <button style={ffmpegReady ? S.btn : S.btnOff}
          onClick={handleExport} disabled={!ffmpegReady}>
          🎬 내보내기 시작
        </button>
      ) : (
        <button style={{ ...S.btn, background: '#c0392b' }}
          onClick={() => { abortRef.current = true; }}>
          ⏹ 취소
        </button>
      )}

      {progress && (
        <div style={S.progressWrap}>
          <div style={S.progressBar}>
            <div style={{ ...S.progressFill, width: `${progress.percent}%` }} />
          </div>
          <div style={S.progressText}>
            {progress.message}<br />
            {progress.phase !== 'done' && progress.phase !== 'error' && (
              <>경과: {fmtTime(progress.elapsedMs)} · 남은 시간: ~{fmtTime(progress.estimatedRemainingMs)}</>
            )}
          </div>
        </div>
      )}

      {resultUrl && (
        <>
          <a style={S.link} href="#" onClick={e => { e.preventDefault(); handleDownload(); }}>
            💾 {project.name || 'BadaCut'}_{preset.id}.{preset.format} 다운로드
          </a>
          <video style={S.videoPreview} src={resultUrl} controls />
        </>
      )}

      {logs.length > 0 && (
        <div style={S.log}>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}

export default ExportPanel;
