/* ─── src/components/Panels/ExportPanel.tsx ─── */
/* B7 v3: 파이썬 aivideostudio 패턴 적용.
 * 원본 파일 직접 트랜스코딩 – 캔버스 캡처 완전 제거.
 */

import React, { useState, useCallback, useRef } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import {
  createExportEngine,
  EXPORT_PRESETS,
  buildSingleClipArgs,
  buildConcatArgs,
  type ExportPreset,
  type ExportProgress,
  type ExportEngineApi,
} from '@/engines/exportEngine';
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

/** 텍스트 클립 → drawtext 필터 문자열 */
function buildTextFilters(
  textTracks: Track[],
  rangeStart: number,
  rangeEnd: number,
  outW: number,
  outH: number,
): string {
  const parts: string[] = [];
  for (const track of textTracks) {
    for (const clip of track.clips) {
      if (clip.disabled || !clip.textContent) continue;
      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd <= rangeStart || clip.startTime >= rangeEnd) continue;

      const tc = clip.textContent;
      const st = tc.style;

      const safeText = tc.text
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "'\\\\\\''")
        .replace(/:/g, '\\:')
        .replace(/%/g, '%%');

      const fontSize = Math.round(st.fontSize * (outH / 1080));
      const x = `(w*${(st.positionX / 100).toFixed(4)}-tw/2)`;
      const y = `(h*${(st.positionY / 100).toFixed(4)}-th/2)`;

      const enableStart = Math.max(0, clip.startTime - rangeStart);
      const enableEnd = Math.min(rangeEnd - rangeStart, clipEnd - rangeStart);

      let f = `drawtext=text='${safeText}'`;
      f += `:fontsize=${fontSize}:fontcolor=${st.color}`;
      f += `:x=${x}:y=${y}`;
      f += `:enable='between(t\\,${enableStart.toFixed(3)}\\,${enableEnd.toFixed(3)})'`;

      if (st.strokeWidth > 0) {
        f += `:borderw=${Math.round(st.strokeWidth * (outH / 1080))}`;
        f += `:bordercolor=${st.strokeColor}`;
      }
      if (st.shadowBlur > 0) {
        f += `:shadowx=${st.shadowOffsetX || 2}:shadowy=${st.shadowOffsetY || 2}`;
        f += `:shadowcolor=${st.shadowColor || 'black'}`;
      }
      if (st.backgroundColor && st.backgroundColor !== 'transparent') {
        f += `:box=1:boxcolor=${st.backgroundColor}:boxborderw=6`;
      }

      parts.push(f);
    }
  }
  return parts.join(',');
}

/** 내보내기 범위 안에 있는 비디오 클립 수집 */
interface VideoClipInfo {
  clip: Clip;
  asset: Asset;
  inputFn: string;  // FFmpeg 가상 FS 내 파일명
}

function collectVideoClips(
  project: { tracks: Track[]; assets: Asset[] },
  rangeStart: number,
  rangeEnd: number,
): VideoClipInfo[] {
  const result: VideoClipInfo[] = [];
  let idx = 0;

  for (const track of project.tracks) {
    if (track.type !== 'video') continue;
    const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime);

    for (const clip of sorted) {
      if (clip.disabled) continue;
      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd <= rangeStart || clip.startTime >= rangeEnd) continue;

      const asset = project.assets.find(a => a.id === clip.assetId);
      if (!asset?.src) continue;

      const ext = (asset.name?.split('.').pop() || 'mp4').toLowerCase();
      const inputFn = `src${idx}.${ext}`;
      result.push({ clip, asset, inputFn });
      idx++;
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
  const [ffmpegReady, setFfmpegReady] = useState(false);
  const [loadingEngine, setLoadingEngine] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const engineRef = useRef<ExportEngineApi | null>(null);
  const preset = EXPORT_PRESETS.find(p => p.id === presetId) ?? EXPORT_PRESETS[0];

  const log = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-100), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  /* ── FFmpeg 로드 ── */
  const handleLoad = useCallback(async () => {
    setLoadingEngine(true);
    setLogs([]);
    log('FFmpeg WASM 로드 시작…');
    try {
      const eng = createExportEngine();
      await eng.init(msg => log(msg));
      engineRef.current = eng;
      setFfmpegReady(true);
      log('✅ FFmpeg 준비 완료');
    } catch (err: any) {
      log(`❌ 로드 실패: ${err.message || err}`);
    }
    setLoadingEngine(false);
  }, [log]);

  /* ── 내보내기 ── */
  const handleExport = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng) return;
    if (isPlaying) togglePlay();

    setExporting(true);
    setResultUrl(null);
    setResultSize(0);
    setLogs([]);

    const rangeStart = useInOut && inOut.inPoint != null ? inOut.inPoint : 0;
    const rangeEnd = useInOut && inOut.outPoint != null ? inOut.outPoint : project.duration;
    const rangeDur = rangeEnd - rangeStart;
    const t0 = performance.now();
    const outFile = `output.${preset.format}`;
    const filesToClean: string[] = [outFile];

    try {
      /* ── Phase 1: 소스 파일 로딩 ── */
      setProgress({
        phase: 'loading', percent: 5, elapsedMs: 0,
        estimatedRemainingMs: 0, message: '소스 파일 로딩 중…',
      });

      const vClips = collectVideoClips(project, rangeStart, rangeEnd);
      if (vClips.length === 0) throw new Error('내보낼 비디오 클립이 없습니다.');

      // 중복 에셋 방지: 같은 src는 한 번만 로드
      const loadedSrcs = new Set<string>();
      for (let i = 0; i < vClips.length; i++) {
        const { asset, inputFn } = vClips[i];
        if (!loadedSrcs.has(asset.src)) {
          log(`소스 로딩: ${asset.name} → ${inputFn}`);
          await eng.loadSource(inputFn, asset.src);
          loadedSrcs.add(asset.src);
        } else {
          // 같은 소스를 다른 이름으로 복사해야 함 (FFmpeg는 파일명으로 구분)
          await eng.loadSource(inputFn, asset.src);
        }
        filesToClean.push(inputFn);
        setProgress(prev => prev ? {
          ...prev,
          percent: 5 + Math.round(((i + 1) / vClips.length) * 15),
          message: `소스 로딩 ${i + 1}/${vClips.length}…`,
        } : prev);
      }

      // 텍스트 필터
      const textTracks = project.tracks.filter(t => t.type === 'text');
      const textFilter = buildTextFilters(textTracks, rangeStart, rangeEnd, preset.width, preset.height);

      eng.setProgressCallback((p) => {
        // 엔진 진행률을 20~90% 범위로 매핑
        const mapped: ExportProgress = {
          ...p,
          percent: 20 + Math.round(p.percent * 0.7),
          elapsedMs: performance.now() - t0,
        };
        mapped.estimatedRemainingMs =
          mapped.percent > 5
            ? (mapped.elapsedMs / mapped.percent) * (100 - mapped.percent)
            : 0;
        setProgress(mapped);
      });

      /* ── Phase 2: 인코딩 ── */

      if (vClips.length === 1) {
        /* ═══ 단일 클립: 직접 트랜스코딩 (파이썬 버전과 동일) ═══ */
        const { clip, inputFn } = vClips[0];
        const ss = (clip.inPoint || 0) + Math.max(0, rangeStart - clip.startTime);
        const dur = Math.min(clip.duration, rangeDur);

        log(`단일 클립 트랜스코딩: ${inputFn} (${dur.toFixed(1)}s)`);
        setProgress(prev => prev ? {
          ...prev, phase: 'encoding', percent: 20,
          message: '인코딩 중…',
        } : prev);

        const args = buildSingleClipArgs(inputFn, outFile, preset, {
          ss: ss > 0.01 ? ss : undefined,
          duration: dur,
          textFilter: textFilter || undefined,
        });

        log(`FFmpeg args: ${args.join(' ')}`);
        const exitCode = await eng.exec(args);
        if (exitCode !== 0) {
          log(`⚠️ FFmpeg exit code: ${exitCode}`);
        }

      } else {
        /* ═══ 다중 클립: 개별 인코딩 → concat demuxer ═══ */
        log(`다중 클립 (${vClips.length}개) → 개별 인코딩 + concat`);

        const segFiles: string[] = [];

        for (let i = 0; i < vClips.length; i++) {
          const { clip, inputFn } = vClips[i];
          const clipStart = Math.max(clip.startTime, rangeStart);
          const clipEnd = Math.min(clip.startTime + clip.duration, rangeEnd);
          const ss = (clip.inPoint || 0) + (clipStart - clip.startTime);
          const dur = clipEnd - clipStart;
          if (dur <= 0) continue;

          const segFn = `seg${i}.mp4`;

          setProgress(prev => prev ? {
            ...prev, phase: 'encoding',
            percent: 20 + Math.round((i / vClips.length) * 50),
            message: `세그먼트 ${i + 1}/${vClips.length} 인코딩…`,
          } : prev);

          log(`세그먼트 ${i}: ${inputFn} ss=${ss.toFixed(2)} dur=${dur.toFixed(2)}`);

          // 각 세그먼트를 동일한 코덱/해상도/fps로 인코딩
          const segArgs = buildSingleClipArgs(inputFn, segFn, preset, {
            ss: ss > 0.01 ? ss : undefined,
            duration: dur,
            // 텍스트는 concat 후에 적용 (세그먼트 단계에선 미적용)
          });

          await eng.exec(segArgs);
          segFiles.push(segFn);
          filesToClean.push(segFn);
        }

        if (segFiles.length === 0) throw new Error('인코딩된 세그먼트가 없습니다.');

        // concat 리스트 파일 생성
        const listContent = segFiles.map(f => `file '${f}'`).join('\n');
        await eng.writeText('list.txt', listContent);
        filesToClean.push('list.txt');

        log(`concat: ${segFiles.length}개 세그먼트 합치기…`);
        setProgress(prev => prev ? {
          ...prev, phase: 'concat', percent: 75,
          message: '세그먼트 합치기…',
        } : prev);

        // concat: 코덱이 동일하므로 스트림 복사 (재인코딩 불필요 = 매우 빠름)
        // 텍스트 필터가 있으면 재인코딩 필요
        const concatArgs = buildConcatArgs('list.txt', outFile, {
          streamCopy: !textFilter,
          textFilter: textFilter || undefined,
          preset: textFilter ? preset : undefined,
        });

        log(`FFmpeg concat args: ${concatArgs.join(' ')}`);
        await eng.exec(concatArgs);
      }

      /* ── Phase 3: 결과 수집 ── */
      setProgress(prev => prev ? {
        ...prev, phase: 'encoding', percent: 92,
        message: '결과 파일 읽기…',
      } : prev);

      const outputData = await eng.readOutput(outFile);

      if (outputData.length === 0) {
        throw new Error(
          '0바이트 출력 파일. FFmpeg 인코딩 실패 – 로그를 확인하세요.',
        );
      }

      // 정리
      await eng.cleanup(filesToClean);

      const blob = new Blob([outputData], { type: `video/${preset.format}` });
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setResultSize(blob.size);

      const elapsed = performance.now() - t0;
      log(`✅ 완료: ${fmtSize(blob.size)}, ${fmtTime(elapsed)}`);

      setProgress({
        phase: 'done', percent: 100,
        elapsedMs: elapsed, estimatedRemainingMs: 0,
        message: `✅ 완료! ${fmtSize(blob.size)} · ${fmtTime(elapsed)}`,
      });

    } catch (err: any) {
      console.error('[Export]', err);
      log(`❌ 오류: ${err.message || err}`);
      setProgress({
        phase: 'error', percent: 0,
        elapsedMs: performance.now() - t0, estimatedRemainingMs: 0,
        message: `❌ ${err.message || err}`,
      });
      // 에러 시에도 정리 시도
      try { await eng.cleanup(filesToClean); } catch { /* ignore */ }
    }

    eng.setProgressCallback(null);
    setExporting(false);
  }, [isPlaying, togglePlay, useInOut, inOut, project, preset, log]);

  /* ── 다운로드 ── */
  const handleDownload = useCallback(() => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `${project.name || 'BadaCut'}_${preset.id}.${preset.format}`;
    a.click();
  }, [resultUrl, project.name, preset]);

  /* ── 범위 계산 ── */
  const rangeStart = useInOut && inOut.inPoint != null ? inOut.inPoint : 0;
  const rangeEnd = useInOut && inOut.outPoint != null ? inOut.outPoint : project.duration;
  const rangeDur = rangeEnd - rangeStart;

  /* ── COOP/COEP 경고 확인 ── */
  const isCrossOriginIsolated = typeof window !== 'undefined' && window.crossOriginIsolated;

  return (
    <div style={S.root}>
      <div style={S.title}>📤 내보내기 (v3)</div>

      {!isCrossOriginIsolated && (
        <div style={S.warn}>
          ⚠️ Cross-Origin Isolation이 비활성 상태입니다.
          Vite 서버 재시작이 필요할 수 있습니다.
          (vite.config.ts에 COOP/COEP 헤더 추가 확인)
        </div>
      )}

      {!ffmpegReady ? (
        <button style={S.btnLoad} onClick={handleLoad} disabled={loadingEngine}>
          {loadingEngine ? '⏳ FFmpeg WASM 로딩 중… (~31MB)' : '🔄 인코더 로드 (~31MB WASM 다운로드)'}
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
              {p.width}×{p.height} · {p.fps}fps · CRF {p.crf} · {p.preset}
            </span>
          </div>
        ))}
      </div>

      <div style={S.divider} />

      <div style={{ ...S.row, marginBottom: 4 }}>
        <input
          type="checkbox" style={S.checkbox} checked={useInOut}
          onChange={e => setUseInOut(e.target.checked)} id="exp-io"
        />
        <label htmlFor="exp-io" style={{ fontSize: 11, cursor: 'pointer' }}>
          In/Out 범위만 내보내기
        </label>
      </div>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>
        범위: {rangeStart.toFixed(1)}s ~ {rangeEnd.toFixed(1)}s ({rangeDur.toFixed(1)}초)
      </div>

      <div style={S.divider} />

      {!exporting ? (
        <button
          style={ffmpegReady ? S.btn : S.btnOff}
          onClick={handleExport}
          disabled={!ffmpegReady}
        >
          🎬 내보내기 시작
        </button>
      ) : (
        <button
          style={{ ...S.btn, background: '#c0392b' }}
          onClick={() => {
            engineRef.current?.terminate();
            setExporting(false);
            log('⏹ 사용자가 취소했습니다.');
          }}
        >
          ⏹ 취소 (엔진 종료)
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
              <>
                경과: {fmtTime(progress.elapsedMs)}
                {progress.estimatedRemainingMs > 0 &&
                  ` · 남은 시간: ~${fmtTime(progress.estimatedRemainingMs)}`
                }
              </>
            )}
          </div>
        </div>
      )}

      {resultUrl && (
        <>
          <a style={S.link} href="#" onClick={e => { e.preventDefault(); handleDownload(); }}>
            💾 다운로드: {project.name || 'BadaCut'}_{preset.id}.{preset.format}
            ({fmtSize(resultSize)})
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
