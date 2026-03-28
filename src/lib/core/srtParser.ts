/* ─── src/lib/core/srtParser.ts ─── */
/* B4-1: SRT 파싱·생성·다운로드 + ASS 변환 + SubtitleSegment 변환 */

import type { WordTiming, SubtitleSegment, TextStyle } from '@/types/textClip';

export interface SrtEntry {
  index: number;
  startTime: number;   // 초
  endTime: number;
  text: string;
  words?: WordTiming[];
}

/* ── 타임코드 변환 ── */

function parseSrtTime(timeStr: string): number {
  // 00:01:23,456 → 초
  const parts = timeStr.trim().replace(',', '.').split(':');
  if (parts.length !== 3) return 0;
  const hrs = parseFloat(parts[0]) || 0;
  const min = parseFloat(parts[1]) || 0;
  const sec = parseFloat(parts[2]) || 0;
  return hrs * 3600 + min * 60 + sec;
}

function formatSrtTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  const whole = Math.floor(sec);
  const ms = Math.round((sec - whole) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(whole).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/* ── SRT 파싱 ── */

export function parseSrt(srtText: string): SrtEntry[] {
  const entries: SrtEntry[] = [];
  // 정규화: \r\n → \n
  const normalized = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  // 빈 줄 2개 이상으로 블록 분리
  const blocks = normalized.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    const indexLine = lines[0].trim();
    const index = parseInt(indexLine, 10);
    if (isNaN(index)) continue;

    const timeLine = lines[1].trim();
    const timeMatch = timeLine.match(
      /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/
    );
    if (!timeMatch) continue;

    const startTime = parseSrtTime(timeMatch[1]);
    const endTime = parseSrtTime(timeMatch[2]);
    const text = lines.slice(2).join('\n').trim();

    entries.push({ index, startTime, endTime, text });
  }

  return entries;
}

/* ── SRT 생성 ── */

export function generateSrt(entries: SrtEntry[]): string {
  return entries
    .sort((a, b) => a.startTime - b.startTime)
    .map((entry, i) => {
      const idx = i + 1;
      const start = formatSrtTime(entry.startTime);
      const end = formatSrtTime(entry.endTime);
      return `${idx}\n${start} --> ${end}\n${entry.text}`;
    })
    .join('\n\n') + '\n';
}

/* ── SRT 다운로드 ── */

export function downloadSrt(entries: SrtEntry[], filename = 'subtitles.srt'): void {
  const content = generateSrt(entries);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── ASS 변환 (B7 Export 대비) ── */

export function toAssEvent(entry: SrtEntry, styleName = 'Default'): string {
  const formatAssTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const whole = Math.floor(sec);
    const cs = Math.round((sec - whole) * 100);
    return `${h}:${String(m).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };
  const start = formatAssTime(entry.startTime);
  const end = formatAssTime(entry.endTime);
  const text = entry.text.replace(/\n/g, '\\N');
  return `Dialogue: 0,${start},${end},${styleName},,0,0,0,,${text}`;
}

export function textStyleToAssStyle(style: TextStyle, name = 'Default'): string {
  const fontName = style.fontFamily.split(',')[0].trim().replace(/'/g, '');
  const fontSize = style.fontSize;
  const bold = style.fontWeight >= 700 ? -1 : 0;
  const italic = style.fontStyle === 'italic' ? -1 : 0;

  // ASS 색상 형식: &HAABBGGRR (alpha, blue, green, red)
  const hexToAss = (hex: string): string => {
    const clean = hex.replace('#', '');
    if (clean.length < 6) return '&H00FFFFFF';
    const r = clean.substring(0, 2);
    const g = clean.substring(2, 4);
    const b = clean.substring(4, 6);
    return `&H00${b}${g}${r}`;
  };

  const primaryColor = hexToAss(style.color);
  const outlineColor = hexToAss(style.strokeColor);
  const shadowColor = hexToAss(
    style.shadowColor.startsWith('rgba') ? '#000000' : style.shadowColor
  );

  const outline = style.strokeWidth;
  const shadow = Math.max(style.shadowOffsetX, style.shadowOffsetY);

  // Alignment: ASS 넘패드 방식 (1=좌하, 2=중하, 3=우하, …, 7=좌상, 8=중상, 9=우상)
  let alignment = 2; // 기본: 중앙 하단
  if (style.verticalAlign === 'top') alignment = 8;
  else if (style.verticalAlign === 'middle') alignment = 5;
  if (style.textAlign === 'left') alignment -= 1;
  else if (style.textAlign === 'right') alignment += 1;

  return `Style: ${name},${fontName},${fontSize},${primaryColor},&H000000FF,${outlineColor},${shadowColor},${bold},${italic},0,0,100,100,0,0,1,${outline},${shadow},${alignment},10,10,10,1`;
}

/* ── SubtitleSegment → SrtEntry 변환 (Phase 3 STT 연동) ── */

export function segmentsToSrtEntries(segments: SubtitleSegment[]): SrtEntry[] {
  return segments.map((seg, i) => ({
    index: i + 1,
    startTime: seg.startTime,
    endTime: seg.endTime,
    text: seg.text,
    words: seg.words,
  }));
}
