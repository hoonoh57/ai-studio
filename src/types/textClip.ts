/* ─── src/types/textClip.ts ─── */
/* B4: 텍스트/자막 타입 정의 */

/** Whisper word_timestamps 출력과 1:1 대응 */
export interface WordTiming {
  word: string;
  startTime: number;    // 클립 내 상대 시간 (초)
  endTime: number;
  confidence?: number;  // Whisper probability — Phase 3에서 자동 채움
}

/** STT 엔진 출력 세그먼트 — Phase 3 aiEngine.ts와 동일 구조 */
export interface SubtitleSegment {
  text: string;
  startTime: number;
  endTime: number;
  words?: WordTiming[];
  language?: string;
}

export type TextAnimation =
  | 'none'
  | 'fade-in' | 'fade-out'
  | 'typewriter'
  | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right'
  | 'scale-in' | 'bounce-in' | 'blur-in'
  | 'rotate-in' | 'glitch-in';

export interface TextStyle {
  fontFamily: string;
  fontSize: number;          // px
  fontWeight: number;        // 400, 700, 900
  fontStyle: 'normal' | 'italic';
  color: string;
  backgroundColor: string;   // 'transparent' 또는 '#000000CC'
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  // 외곽선
  strokeColor: string;
  strokeWidth: number;       // 0 = 없음
  // 그림자
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  // 위치 (캔버스 % 기준, 0~100)
  positionX: number;         // 50 = 가운데
  positionY: number;         // 85 = 하단 자막 위치
  // 애니메이션
  animation: TextAnimation;
  animationDuration: number; // 초
  // B4-7: 워드 하이라이트
  highlightColor?: string;
  highlightScale?: number;   // 1.0 = 기본, 1.3 = 30% 확대
}

export interface TextContent {
  text: string;
  style: TextStyle;
  wordTimings?: WordTiming[];
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Noto Sans KR, sans-serif',
  fontSize: 48,
  fontWeight: 700,
  fontStyle: 'normal',
  color: '#FFFFFF',
  backgroundColor: 'transparent',
  textAlign: 'center',
  verticalAlign: 'bottom',
  strokeColor: '#000000',
  strokeWidth: 2,
  shadowColor: 'rgba(0,0,0,0.5)',
  shadowBlur: 4,
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  positionX: 50,
  positionY: 85,
  animation: 'none',
  animationDuration: 0.3,
  highlightColor: '#FFFF00',
  highlightScale: 1.2,
};

export const TEXT_ANIMATION_LIST: { value: TextAnimation; label: string }[] = [
  { value: 'none', label: '없음' },
  { value: 'fade-in', label: '페이드 인' },
  { value: 'fade-out', label: '페이드 아웃' },
  { value: 'typewriter', label: '타자기' },
  { value: 'slide-up', label: '슬라이드 업' },
  { value: 'slide-down', label: '슬라이드 다운' },
  { value: 'slide-left', label: '슬라이드 좌' },
  { value: 'slide-right', label: '슬라이드 우' },
  { value: 'scale-in', label: '스케일 인' },
  { value: 'bounce-in', label: '바운스 인' },
  { value: 'blur-in', label: '블러 인' },
  { value: 'rotate-in', label: '회전 인' },
  { value: 'glitch-in', label: '글리치 인' },
];
