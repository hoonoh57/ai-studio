/* ─── src/components/Panels/ExportPanel.tsx ─── */
/* B7 v4.0: 하이브리드 엔진 (WebCodecs HW 가속 + FFmpeg SW 폴백) */

import React, { useState, useCallback, useRef } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import {
  createExportEngine,
  EXPORT_PRESETS,
  FONT_FILENAME,
  buildSingleClipArgs,
  buildConcatArgs,
  type ExportPreset,
  type ExportProgress,
  type ExportEngineApi,
} from '@/engines/exportEngine';
import { isWebCodecsSupported, exportWithWebCodecs } from '@/engines/webcodecExportEngine';
import type { Track, Clip, Asset } from '@/types/project';

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
  select: {
    fontSize: 11, background: '#1a1a2e', color: '#ddd',
    border: '1px solid #333', borderRadius: 4, padding: '4px 8px',
    flex: 1,
  },
  link: {
    display: 'block', padding: '10px 16px', borderRadius: 8,
    background: '#1a3a1a', color: '#50c878', textAlign: 'center' as const,
    fontWeight: 700, fontSize: 12, textDecoration: 'none', border: '1px solid #2a5a2a',
  },
  videoPreview: {
    width: '100%', borderRadius: 8, marginTop: 6, background: '#000', maxHeight: 200,
  },
  log: {
    maxHeight: 120, overflowY: 'auto' as const, fontSize: 9,
    color: '#555', fontFamily: 'monospace', padding: 4,
    background: '#0a0a0a', borderRadius: 4, marginTop: 4,
  },
  warn: {
    padding: 8, borderRadius: 6, background: '#332200', border: '1px solid #664400',
    color: '#ffaa44', fontSize: 10, lineHeight: 1.4,
  },
  success: {
    padding: 8, borderRadius: 6, background: '#1a331a', border: '1px solid #2a5a2a',
    color: '#88dd88', fontSize: 10, lineHeight: 1.4,
  },
};

/* ═══ 헬퍼 ═══ */

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  const rgbaMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
    if (rgbaMatch[4] !== undefined) {
      const a = Math.round(parseFloat(rgbaMatch[4]) * 255).toString(16).padStart(2, '0');
      return `#${r}${g}${b}${a}`.toUpperCase();
    }
    return `#${r}${g}${b}`.toUpperCase();
  }
  if (color.includes(',')) return fallback;
  return color;
}

function buildTextFilters(
  textTracks: Track[],
  rangeStart: number,
  rangeEnd: number,
  outW: number,
  outH: number,
  fontFile: string,
): string {
  const parts: string[] = [];
  for (const track of textTracks) {
    for (const clip of track.clips) {
      if (clip.disabled || !clip.textContent) continue;
      if (clip.startTime + clip.duration <= rangeStart || clip.startTime >= rangeEnd) continue;
      const tc = clip.textContent;
      const st = tc.style;
      const safeText = tc.text.replace(/\\/g, '\\\\\\\\').replace(/'/g, '\u2019').replace(/:/g, '\\\\:').replace(/%/g, '%%').replace(/\[/g, '\\\\[').replace(/\]/g, '\\\\]');
      const fontSize = Math.round(st.fontSize * (outH / 1080));
      const x = `(w*${(st.positionX / 100).toFixed(4)}-tw/2)`;
      const y = `(h*${(st.positionY / 100).toFixed(4)}-th/2)`;
      const enableStart = Math.max(0, clip.startTime - rangeStart);
      const enableEnd = Math.min(rangeEnd - rangeStart, clip.startTime + clip.duration - rangeStart);
      let f = `drawtext=fontfile=${fontFile}:text='${safeText}':fontsize=${fontSize}:fontcolor=${safeColor(st.color, '#FFFFFF')}:x=${x}:y=${y}:enable='between(t\\,${enableStart.toFixed(3)}\\,${enableEnd.toFixed(3)})'`;
      if (st.strokeWidth > 0) f += `:borderw=${Math.round(st.strokeWidth * (outH / 1080))}:bordercolor=${safeColor(st.strokeColor, '#000000')}`;
      if (st.shadowBlur > 0) f += `:shadowx=${st.shadowOffsetX || 2}:shadowy=${st.shadowOffsetY || 2}:shadowcolor=${safeColor(st.shadowColor, 'black@0.8')}`;
      if (st.backgroundColor && st.backgroundColor !== 'transparent') f += `:box=1:boxcolor=${safeColor(st.backgroundColor, 'black')}@0.6:boxborderw=6`;
      parts.push(f);
    }
  }
  return parts.join(',');
}

function collectVideoClips(project: { tracks: Track[]; assets: Asset[] }, rangeStart: number, rangeEnd: number) {
  const result: { clip: Clip; asset: Asset; inputFn: string }[] = [];
  let idx = 0;
  for (const track of project.tracks) {
    if (track.type !== 'video') continue;
    for (const clip of [...track.clips].sort((a, b) => a.startTime - b.startTime)) {
      if (clip.disabled) continue;
      if (clip.startTime + clip.duration <= rangeStart || clip.startTime >= rangeEnd) continue;
      const asset = project.assets.find(a => a.id === clip.assetId);
      if (!asset?.src) continue;
      const ext = (asset.name?.split('.').pop() || 'mp4').toLowerCase();
      result.push({ clip, asset, inputFn: `src${idx++}.${ext}` });
    }
  }
  return result;
}

/* ═══ 컴포넌트 ═══ */

export function ExportPanel(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const inOut = useEditorStore(s => s.inOut);
  const isPlaying = useEditorStore(s => s.isPlaying);
  const togglePlay = useEditorStore(s => s.togglePlay);

  const [presetId, setPresetId] = useState('yt-1080');
  const [useInOut, setUseInOut] = useState(false);
  const [engineType, setEngineType] = useState<'auto' | 'webcodecs' | 'ffmpeg'>(isWebCodecsSupported() ? 'auto' : 'ffmpeg');
  
  const [ffmpegReady, setFfmpegReady] = useState(false);
  const [fontReady, setFontReady] = useState(false);
  const [loadingEngine, setLoadingEngine] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const engineRef = useRef<ExportEngineApi | null>(null);
  const preset = EXPORT_PRESETS.find(p => p.id === presetId) ?? EXPORT_PRESETS[0];
  const webCodecsAvailable = isWebCodecsSupported();

  const log = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-100), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  /* ── 엔진 로드 ── */
  const handleLoad = useCallback(async () => {
    const useWC = engineType === 'webcodecs' || (engineType === 'auto' && webCodecsAvailable);
    if (useWC) {
      setFfmpegReady(true);
      setFontReady(true);
      log('🚀 WebCodecs 하드웨어 인코더가 준비되었습니다.');
      return;
    }

    setLoadingEngine(true);
    setLogs([]);
    log('FFmpeg WASM (SW) 로드 시작…');
    try {
      const eng = createExportEngine();
      await eng.init(msg => log(msg));
      engineRef.current = eng;
      setFfmpegReady(true);
      log('✅ FFmpeg 준비 완료');
      log('폰트 로딩 중… (Subset OTF)');
      const fontOk = await eng.loadFont();
      setFontReady(fontOk);
      if (fontOk) log('✅ 폰트 로드 완료');
    } catch (err: any) {
      log(`❌ FFmpeg 로드 실패: ${err.message || err}`);
    }
    setLoadingEngine(false);
  }, [engineType, webCodecsAvailable, log]);

  /* ── FFmpeg 전용 내보내기 로직 (기존 3.1 로직 추출) ── */
  const exportWithFfmpeg = useCallback(async (opts: { rangeStart: number; rangeEnd: number; outFile: string }) => {
    const eng = engineRef.current;
    if (!eng) throw new Error('FFmpeg 엔진이 로드되지 않았습니다.');
    const { rangeStart, rangeEnd, outFile } = opts;
    const rangeDur = rangeEnd - rangeStart;
    const t0 = performance.now();
    const vClips = collectVideoClips(project, rangeStart, rangeEnd);
    
    // 소스 로딩
    for (const vc of vClips) {
      log(`소스 로딩: ${vc.asset.name} → ${vc.inputFn}`);
      await eng.loadSource(vc.inputFn, vc.asset.src);
    }

    const textFilter = fontReady ? buildTextFilters(project.tracks.filter(t => t.type === 'text'), rangeStart, rangeEnd, preset.width, preset.height, FONT_FILENAME) : '';
    eng.setProgressCallback(p => setProgress({ ...p, percent: 20 + Math.round(p.percent * 0.7), elapsedMs: performance.now() - t0, message: p.message, estimatedRemainingMs: 0 }));

    if (vClips.length === 1) {
      const { clip, inputFn } = vClips[0];
      const ss = (clip.inPoint || 0) + Math.max(0, rangeStart - clip.startTime);
      const args = buildSingleClipArgs(inputFn, outFile, preset, { ss: ss > 0.01 ? ss : undefined, duration: Math.min(clip.duration, rangeDur), textFilter: textFilter || undefined });
      await eng.exec(args);
      return await eng.readOutput(outFile);
    } else {
      const savedSegments: Uint8Array[] = [];
      for (let i = 0; i < vClips.length; i++) {
        const { clip, inputFn } = vClips[i];
        const segFn = `seg${i}.mp4`;
        const ss = (clip.inPoint || 0) + Math.max(0, rangeStart - clip.startTime);
        const dur = Math.min(clip.startTime + clip.duration, rangeEnd) - Math.max(clip.startTime, rangeStart);
        await eng.exec(buildSingleClipArgs(inputFn, segFn, preset, { ss: ss > 0.01 ? ss : undefined, duration: dur }));
        const segData = await eng.readFileRaw(segFn);
        if (!segData) throw new Error(`세그먼트 ${i} 생성 실패`);
        savedSegments.push(segData);
      }
      eng.terminate();
      const cEng = createExportEngine();
      await cEng.init(msg => log(msg));
      if (textFilter) await cEng.loadFont();
      for (let i = 0; i < savedSegments.length; i++) await cEng.writeRaw(`seg${i}.mp4`, savedSegments[i]);
      await cEng.writeText('list.txt', savedSegments.map((_, i) => `file 'seg${i}.mp4'`).join('\n'));
      await cEng.exec(buildConcatArgs('list.txt', outFile, { streamCopy: !textFilter, textFilter: textFilter || undefined, preset: textFilter ? preset : undefined }));
      const out = await cEng.readOutput(outFile);
      cEng.terminate();
      return out;
    }
  }, [project, preset, fontReady, log]);

  /* ── 메인 내보내기 핸들러 ── */
  const handleExport = useCallback(async () => {
    if (isPlaying) togglePlay();
    setExporting(true);
    setResultUrl(null);
    setLogs([]);
    const t0 = performance.now();
    const rangeStart = useInOut && inOut.inPoint != null ? inOut.inPoint : 0;
    const rangeEnd = useInOut && inOut.outPoint != null ? inOut.outPoint : project.duration;
    const useWC = engineType === 'webcodecs' || (engineType === 'auto' && webCodecsAvailable);

    try {
      let resultBlob: Blob;
      if (useWC) {
        log('🚀 WebCodecs HW 가속 내보내기 엔진 시작…');
        resultBlob = await exportWithWebCodecs({
          preset, project, rangeStart, rangeEnd,
          onProgress: setProgress,
          onLog: log,
        });
      } else {
        log('⚙️ FFmpeg WASM SW 내보내기 엔진 시작…');
        const data = await exportWithFfmpeg({ rangeStart, rangeEnd, outFile: `output.${preset.format}` });
        resultBlob = new Blob([data as any], { type: `video/${preset.format}` });
      }

      setResultUrl(URL.createObjectURL(resultBlob));
      setResultSize(resultBlob.size);
      setProgress({ phase: 'done', percent: 100, elapsedMs: performance.now() - t0, estimatedRemainingMs: 0, message: `✅ 완료! ${fmtSize(resultBlob.size)}` });
    } catch (err: any) {
      console.error(err);
      log(`❌ 오류: ${err.message || err}`);
      if (useWC) log('💡 FFmpeg(소프트웨어) 엔진으로 변경하여 재시도해보세요.');
      setProgress({ phase: 'error', percent: 0, elapsedMs: 0, estimatedRemainingMs: 0, message: `❌ ${err.message || err}` });
    }
    setExporting(false);
  }, [engineType, webCodecsAvailable, isPlaying, togglePlay, useInOut, inOut, project, preset, exportWithFfmpeg, log]);

  return (
    <div style={S.root}>
      <div style={S.title}>📤 내보내기 (v4.0 WebCodecs)</div>

      <div style={S.section}>인코딩 엔진</div>
      <div style={S.row}>
        <select style={S.select} value={engineType} onChange={e => setEngineType(e.target.value as any)}>
          <option value="auto">자동 {webCodecsAvailable ? '(HW 가속 권장)' : '(SW 폴백)'}</option>
          {webCodecsAvailable && <option value="webcodecs">WebCodecs (하드웨어 가속)</option>}
          <option value="ffmpeg">FFmpeg-WASM (소프트웨어)</option>
        </select>
        {!ffmpegReady && <button style={{ ...S.btn, width: 'auto' }} onClick={handleLoad} disabled={loadingEngine}>{loadingEngine ? '⏳ 로딩…' : '준비'}</button>}
      </div>

      {webCodecsAvailable && (engineType === 'auto' || engineType === 'webcodecs') ? (
        <div style={S.success}>🚀 WebCodecs 활성화. GPU 인코더를 사용하여 10배 이상 빠릅니다. (Canvas 폰트 지원)</div>
      ) : (
        <div style={S.warn}>⚠️ FFmpeg(SW) 모드. CPU를 사용하여 느리며 별도 로딩이 필요합니다.</div>
      )}

      <div style={S.divider} />
      <div style={S.section}>플랫폼 프리셋</div>
      <div style={S.presetGrid}>
        {EXPORT_PRESETS.map(p => (
          <div key={p.id} style={{ ...S.presetCard, ...(p.id === presetId ? S.presetCardSel : {}) }} onClick={() => setPresetId(p.id)}>
            <span style={S.presetIcon}>{p.icon}</span>
            <span style={S.presetName}>{p.name}</span>
            <span style={S.presetDesc}>{p.description}</span>
          </div>
        ))}
      </div>

      <div style={S.divider} />
      <div style={{ ...S.row, marginBottom: 4 }}>
        <input type="checkbox" style={S.checkbox} checked={useInOut} onChange={e => setUseInOut(e.target.checked)} id="exp-io" />
        <label htmlFor="exp-io" style={{ fontSize: 11, cursor: 'pointer' }}>In/Out 범위만 내보내기 ({rangeStart.toFixed(1)}s~{rangeEnd.toFixed(1)}s)</label>
      </div>

      {!exporting ? (
        <button style={ffmpegReady ? S.btn : S.btnOff} onClick={handleExport} disabled={!ffmpegReady}>🎬 내보내기 시작</button>
      ) : (
        <button style={{ ...S.btn, background: '#c0392b' }} onClick={() => { if (engineType === 'ffmpeg') engineRef.current?.terminate(); setExporting(false); }}>⏹ 취소</button>
      )}

      {progress && (
        <div style={S.progressWrap}>
          <div style={S.progressBar}><div style={{ ...S.progressFill, width: `${progress.percent}%` }} /></div>
          <div style={S.progressText}>{progress.message}<br />{progress.phase !== 'done' && progress.phase !== 'error' && `경과: ${fmtTime(progress.elapsedMs)}`}</div>
        </div>
      )}

      {resultUrl && (
        <>
          <a style={S.link} href={resultUrl} download={`${project.name || 'BadaCut'}_export.mp4`}>💾 결과 파일 다운로드 ({fmtSize(resultSize)})</a>
          <video style={S.videoPreview} src={resultUrl} controls />
        </>
      )}

      {logs.length > 0 && <div style={S.log}>{logs.map((l, i) => <div key={i}>{l}</div>)}</div>}
    </div>
  );
}

export default ExportPanel;
