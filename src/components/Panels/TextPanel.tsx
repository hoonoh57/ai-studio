/* ─── src/components/Panels/TextPanel.tsx ─── */
/* B4-5: 텍스트 전용 편집 패널 UI */

import React, { useState, useCallback, useRef } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { DEFAULT_TEXT_STYLE, TEXT_ANIMATION_LIST } from '@/types/textClip';
import type { TextStyle, TextAnimation } from '@/types/textClip';
import { SUBTITLE_PRESETS } from '@/lib/core/subtitlePresets';
import { parseSrt, downloadSrt } from '@/lib/core/srtParser';
import type { Clip } from '@/types/project';

/* ── 스타일 ── */
const P: Record<string, React.CSSProperties> = {
  root: {
    height: '100%', overflowY: 'auto', padding: 12,
    background: 'var(--bg-panel, #181825)', color: '#ddd',
    fontSize: 12, display: 'flex', flexDirection: 'column', gap: 12,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, color: 'var(--accent, #6496ff)',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  btn: {
    padding: '6px 12px', borderRadius: 6, border: '1px solid #444',
    background: '#222', color: '#ccc', cursor: 'pointer', fontSize: 11,
    transition: 'all 0.15s',
  },
  btnPrimary: {
    padding: '6px 12px', borderRadius: 6, border: 'none',
    background: 'var(--accent, #6496ff)', color: '#fff',
    cursor: 'pointer', fontSize: 11, fontWeight: 600,
  },
  textarea: {
    width: '100%', minHeight: 60, padding: 8, borderRadius: 6,
    border: '1px solid #444', background: '#111', color: '#fff',
    fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
  },
  input: {
    width: 60, padding: '4px 6px', borderRadius: 4,
    border: '1px solid #444', background: '#111', color: '#fff',
    fontSize: 11, textAlign: 'center' as const,
  },
  select: {
    flex: 1, padding: '4px 6px', borderRadius: 4,
    border: '1px solid #444', background: '#111', color: '#fff',
    fontSize: 11,
  },
  colorInput: {
    width: 28, height: 28, border: '1px solid #444', borderRadius: 4,
    cursor: 'pointer', padding: 0, background: 'none',
  },
  label: { width: 52, fontSize: 10, color: '#888', flexShrink: 0 },
  slider: { flex: 1, accentColor: 'var(--accent, #6496ff)' },
  presetGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
  },
  presetCard: {
    padding: '8px 4px', borderRadius: 6, border: '1px solid #333',
    background: '#1a1a2e', cursor: 'pointer', textAlign: 'center' as const,
    transition: 'border-color 0.15s',
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2,
  },
  presetIcon: { fontSize: 18 },
  presetName: { fontSize: 9, color: '#aaa', lineHeight: 1.2 },
  divider: { borderBottom: '1px solid #333', margin: '4px 0' },
  aiBtn: {
    padding: '8px 12px', borderRadius: 6, border: '1px dashed #555',
    background: '#1a1a2e', color: '#666', cursor: 'not-allowed',
    fontSize: 11, textAlign: 'center' as const,
  },
};

/* ── 헬퍼 ── */
function getSelectedTextClip(
  tracks: { type: string; clips: Clip[] }[],
  selectedId: string | null,
): Clip | null {
  if (!selectedId) return null;
  for (const t of tracks) {
    if (t.type !== 'text') continue;
    const c = t.clips.find(cl => cl.id === selectedId);
    if (c?.textContent) return c;
  }
  return null;
}

/* ── 컴포넌트 ── */

export function TextPanel(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const selectedClipId = useEditorStore(s => s.selectedClipId);
  const currentTime = useEditorStore(s => s.currentTime);
  const addTextClip = useEditorStore(s => s.addTextClip);
  const updateTextContent = useEditorStore(s => s.updateTextContent);
  const updateTextStyle = useEditorStore(s => s.updateTextStyle);
  const importSrt = useEditorStore(s => s.importSrt);
  const exportSrt = useEditorStore(s => s.exportSrt);
  const applyStyleToAllTextClips = useEditorStore(s => s.applyStyleToAllTextClips);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const clip = getSelectedTextClip(project.tracks, selectedClipId);
  const style = clip?.textContent?.style ?? DEFAULT_TEXT_STYLE;

  /* ── 이벤트 핸들러 ── */

  const handleAddText = useCallback(() => {
    addTextClip(null, '텍스트를 입력하세요', currentTime);
  }, [addTextClip, currentTime]);

  const handleTextChange = useCallback((text: string) => {
    if (!clip) return;
    updateTextContent(clip.id, text);
  }, [clip, updateTextContent]);

  const handleStyleChange = useCallback((patch: Partial<TextStyle>) => {
    if (!clip) return;
    updateTextStyle(clip.id, patch);
  }, [clip, updateTextStyle]);

  const handlePresetClick = useCallback((presetStyle: Partial<TextStyle>) => {
    if (clip) {
      updateTextStyle(clip.id, presetStyle);
    } else {
      addTextClip(null, '텍스트를 입력하세요', currentTime, 3, presetStyle);
    }
  }, [clip, updateTextStyle, addTextClip, currentTime]);

  const handleImportSrt = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        const entries = parseSrt(text);
        if (entries.length > 0) importSrt(entries);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  }, [importSrt]);

  const handleExportSrt = useCallback(() => {
    const entries = exportSrt();
    if (entries.length === 0) {
      alert('내보낼 자막이 없습니다.');
      return;
    }
    downloadSrt(entries);
  }, [exportSrt]);

  const handleApplyAll = useCallback(() => {
    if (!clip?.textContent) return;
    // applyStyleToAllTextClips uses the style patch, so we just pass the current style
    applyStyleToAllTextClips(clip.textContent.style);
  }, [clip, applyStyleToAllTextClips]);

  return (
    <div style={P.root}>
      {/* 상단 액션 */}
      <div style={P.row}>
        <button style={P.btnPrimary} onClick={handleAddText}>✚ 텍스트 추가</button>
        <button style={P.btn} onClick={handleImportSrt}>📥 SRT</button>
        <button style={P.btn} onClick={handleExportSrt}>📤 SRT</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".srt,.vtt,.txt"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>

      {/* 프리셋 그리드 */}
      <div>
        <div style={P.sectionTitle}>프리셋</div>
        <div style={P.presetGrid}>
          {SUBTITLE_PRESETS.map(preset => (
            <div
              key={preset.id}
              style={P.presetCard}
              title={`${preset.name} (${preset.platform})`}
              onClick={() => handlePresetClick(preset.style)}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = '#333';
              }}
            >
              <span style={P.presetIcon}>{preset.icon}</span>
              <span style={P.presetName}>{preset.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={P.divider} />

      {/* 텍스트 입력 */}
      {clip?.textContent ? (
        <>
          <div>
            <div style={P.sectionTitle}>텍스트 입력</div>
            <textarea
              style={P.textarea}
              value={clip.textContent.text}
              onChange={e => handleTextChange(e.target.value)}
              placeholder="텍스트를 입력하세요"
            />
          </div>

          <div style={P.divider} />

          {/* 스타일 편집 */}
          <div>
            <div style={P.sectionTitle}>스타일 편집</div>

            {/* 폰트 */}
            <div style={{ ...P.row, marginBottom: 6 }}>
              <span style={P.label}>폰트</span>
              <select
                style={P.select}
                value={style.fontFamily}
                onChange={e => handleStyleChange({ fontFamily: e.target.value })}
              >
                <option value="Noto Sans KR, sans-serif">Noto Sans KR</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="Courier New, monospace">Courier New</option>
                <option value="Comic Sans MS, cursive, sans-serif">Comic Sans</option>
                <option value="Impact, sans-serif">Impact</option>
              </select>
            </div>

            {/* 크기 & 굵기 */}
            <div style={{ ...P.row, marginBottom: 6 }}>
              <span style={P.label}>크기</span>
              <input
                type="number" style={P.input}
                value={style.fontSize} min={12} max={200}
                onChange={e => handleStyleChange({ fontSize: Number(e.target.value) })}
              />
              <span style={P.label}>굵기</span>
              <select
                style={{ ...P.select, width: 70 }}
                value={style.fontWeight}
                onChange={e => handleStyleChange({ fontWeight: Number(e.target.value) })}
              >
                <option value={200}>Thin</option>
                <option value={300}>Light</option>
                <option value={400}>Regular</option>
                <option value={600}>Semi</option>
                <option value={700}>Bold</option>
                <option value={900}>Black</option>
              </select>
            </div>

            {/* 색상 */}
            <div style={{ ...P.row, marginBottom: 6 }}>
              <span style={P.label}>색상</span>
              <input
                type="color" style={P.colorInput}
                value={style.color}
                onChange={e => handleStyleChange({ color: e.target.value })}
              />
              <span style={P.label}>배경</span>
              <input
                type="color" style={P.colorInput}
                value={style.backgroundColor === 'transparent' ? '#000000' : style.backgroundColor.substring(0, 7)}
                onChange={e => handleStyleChange({ backgroundColor: e.target.value + 'CC' })}
              />
              <button
                style={{ ...P.btn, padding: '3px 6px', fontSize: 9 }}
                onClick={() => handleStyleChange({ backgroundColor: 'transparent' })}
              >투명</button>
            </div>

            {/* 외곽선 */}
            <div style={{ ...P.row, marginBottom: 6 }}>
              <span style={P.label}>외곽선</span>
              <input
                type="color" style={P.colorInput}
                value={style.strokeColor}
                onChange={e => handleStyleChange({ strokeColor: e.target.value })}
              />
              <span style={P.label}>두께</span>
              <input
                type="range" style={P.slider}
                value={style.strokeWidth} min={0} max={10} step={0.5}
                onChange={e => handleStyleChange({ strokeWidth: Number(e.target.value) })}
              />
              <span style={{ fontSize: 10, color: '#888', width: 20 }}>{style.strokeWidth}</span>
            </div>

            {/* 그림자 */}
            <div style={{ ...P.row, marginBottom: 6 }}>
              <span style={P.label}>그림자</span>
              <input
                type="color" style={P.colorInput}
                value={style.shadowColor.startsWith('rgba') ? '#000000' : style.shadowColor}
                onChange={e => handleStyleChange({ shadowColor: e.target.value })}
              />
              <span style={P.label}>블러</span>
              <input
                type="range" style={P.slider}
                value={style.shadowBlur} min={0} max={30} step={1}
                onChange={e => handleStyleChange({ shadowBlur: Number(e.target.value) })}
              />
              <span style={{ fontSize: 10, color: '#888', width: 20 }}>{style.shadowBlur}</span>
            </div>

            {/* 위치 */}
            <div style={{ ...P.row, marginBottom: 6 }}>
              <span style={P.label}>위치X</span>
              <input
                type="range" style={P.slider}
                value={style.positionX} min={0} max={100} step={1}
                onChange={e => handleStyleChange({ positionX: Number(e.target.value) })}
              />
              <span style={{ fontSize: 10, color: '#888', width: 28 }}>{style.positionX}%</span>
            </div>
            <div style={{ ...P.row, marginBottom: 6 }}>
              <span style={P.label}>위치Y</span>
              <input
                type="range" style={P.slider}
                value={style.positionY} min={0} max={100} step={1}
                onChange={e => handleStyleChange({ positionY: Number(e.target.value) })}
              />
              <span style={{ fontSize: 10, color: '#888', width: 28 }}>{style.positionY}%</span>
            </div>

            {/* 애니메이션 */}
            <div style={{ ...P.row, marginBottom: 6 }}>
              <span style={P.label}>애니메이션</span>
              <select
                style={P.select}
                value={style.animation}
                onChange={e => handleStyleChange({ animation: e.target.value as TextAnimation })}
              >
                {TEXT_ANIMATION_LIST.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <input
                type="number" style={{ ...P.input, width: 45 }}
                value={style.animationDuration} min={0.1} max={3} step={0.1}
                onChange={e => handleStyleChange({ animationDuration: Number(e.target.value) })}
              />
              <span style={{ fontSize: 9, color: '#888' }}>초</span>
            </div>

            {/* 일괄 적용 */}
            <div style={{ ...P.row, marginTop: 8 }}>
              <button style={P.btnPrimary} onClick={handleApplyAll}>
                🎨 전체 자막에 이 스타일 적용
              </button>
            </div>
          </div>
        </>
      ) : (
        <div style={{ color: '#666', fontSize: 11, textAlign: 'center', padding: 16 }}>
          텍스트 클립을 선택하거나 새로 추가하세요
        </div>
      )}

      <div style={P.divider} />

      {/* AI 기능 (Phase 3/4) */}
      <div>
        <div style={P.sectionTitle}>AI 기능 (준비 중)</div>
        <div style={P.aiBtn}>🎤 AI 자동 자막 — Electron 전환 후 활성화</div>
        <div style={{ ...P.aiBtn, marginTop: 6 }}>🌐 AI 번역 — Electron 전환 후 활성화</div>
        <div style={{ ...P.aiBtn, marginTop: 6 }}>🔊 AI 음성 생성 — Electron 전환 후 활성화</div>
      </div>
    </div>
  );
}

export default TextPanel;
