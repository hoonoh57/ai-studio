/* ─── src/lib/core/subtitlePresets.ts ─── */
/* B4-4: 자막 스타일 프리셋 20종 */

import type { TextStyle } from '@/types/textClip';
import { DEFAULT_TEXT_STYLE } from '@/types/textClip';

export interface SubtitlePreset {
  id: string;
  name: string;
  icon: string;
  platform: string;
  style: Partial<TextStyle>;
}

const base = DEFAULT_TEXT_STYLE;

export const SUBTITLE_PRESETS: SubtitlePreset[] = [
  {
    id: 'youtube-basic',
    name: '유튜브 기본',
    icon: '📺',
    platform: 'YouTube',
    style: {
      fontSize: 42, fontWeight: 700, color: '#FFFFFF',
      backgroundColor: 'rgba(0,0,0,0.7)', strokeWidth: 0,
      positionX: 50, positionY: 90,
    },
  },
  {
    id: 'shorts-bold',
    name: '쇼츠 굵은',
    icon: '📱',
    platform: 'YouTube Shorts',
    style: {
      fontSize: 64, fontWeight: 900, color: '#FFE500',
      strokeColor: '#000000', strokeWidth: 4,
      shadowBlur: 0, backgroundColor: 'transparent',
      positionX: 50, positionY: 50,
    },
  },
  {
    id: 'minimal-white',
    name: '미니멀 화이트',
    icon: '⬜',
    platform: '범용',
    style: {
      fontSize: 36, fontWeight: 400, color: '#FFFFFF',
      strokeWidth: 0, shadowBlur: 0, backgroundColor: 'transparent',
      positionX: 50, positionY: 88,
    },
  },
  {
    id: 'neon-glow',
    name: '네온 글로우',
    icon: '💚',
    platform: '게임/음악',
    style: {
      fontSize: 48, fontWeight: 700, color: '#39FF14',
      strokeColor: '#00FF00', strokeWidth: 1,
      shadowColor: '#39FF14', shadowBlur: 16, shadowOffsetX: 0, shadowOffsetY: 0,
      backgroundColor: 'transparent',
    },
  },
  {
    id: 'cinematic',
    name: '시네마틱',
    icon: '🎬',
    platform: '영화/단편',
    style: {
      fontSize: 40, fontWeight: 400, fontStyle: 'italic',
      color: '#CCCCCC', strokeWidth: 0,
      shadowColor: 'rgba(0,0,0,0.8)', shadowBlur: 6,
      backgroundColor: 'transparent',
      positionX: 50, positionY: 92,
    },
  },
  {
    id: 'news-bar',
    name: '뉴스 하단바',
    icon: '📰',
    platform: '뉴스/정보',
    style: {
      fontSize: 36, fontWeight: 700, color: '#FFFFFF',
      backgroundColor: 'rgba(0,51,153,0.85)',
      textAlign: 'left', positionX: 5, positionY: 92,
      strokeWidth: 0, shadowBlur: 0,
    },
  },
  {
    id: 'comic-pop',
    name: '코믹 팝',
    icon: '💥',
    platform: '예능/개그',
    style: {
      fontSize: 56, fontWeight: 900, color: '#FF69B4',
      strokeColor: '#FFFFFF', strokeWidth: 4,
      shadowColor: '#000000', shadowBlur: 0, shadowOffsetX: 3, shadowOffsetY: 3,
      backgroundColor: 'transparent',
    },
  },
  {
    id: 'karaoke',
    name: '노래방',
    icon: '🎤',
    platform: '뮤직비디오',
    style: {
      fontSize: 52, fontWeight: 700, color: '#FFD700',
      strokeColor: '#8B4513', strokeWidth: 3,
      backgroundColor: 'rgba(0,0,0,0.6)',
      highlightColor: '#FF4500', highlightScale: 1.3,
    },
  },
  {
    id: 'insta-story',
    name: '인스타 스토리',
    icon: '📷',
    platform: 'Instagram',
    style: {
      fontSize: 44, fontWeight: 600, color: '#FFFFFF',
      strokeWidth: 0,
      shadowColor: 'rgba(0,0,0,0.3)', shadowBlur: 3,
      backgroundColor: 'transparent',
      positionX: 50, positionY: 50,
    },
  },
  {
    id: 'retro-vhs',
    name: '레트로 VHS',
    icon: '📼',
    platform: '복고풍',
    style: {
      fontFamily: 'Courier New, monospace',
      fontSize: 38, fontWeight: 400, color: '#39FF14',
      strokeWidth: 0,
      shadowColor: '#39FF14', shadowBlur: 8,
      backgroundColor: 'transparent',
    },
  },
  {
    id: 'tiktok-trendy',
    name: '틱톡 트렌디',
    icon: '🎵',
    platform: 'TikTok',
    style: {
      fontSize: 58, fontWeight: 900, color: '#FFFFFF',
      strokeColor: '#000000', strokeWidth: 3,
      backgroundColor: 'transparent',
      positionX: 50, positionY: 45,
      animation: 'bounce-in', animationDuration: 0.3,
    },
  },
  {
    id: 'documentary',
    name: '다큐멘터리',
    icon: '🎥',
    platform: '다큐/인터뷰',
    style: {
      fontSize: 34, fontWeight: 300, color: '#EEEEEE',
      strokeWidth: 0, shadowBlur: 2,
      backgroundColor: 'transparent',
      positionX: 50, positionY: 92,
    },
  },
  {
    id: 'highlight-pop',
    name: '하이라이트 팝',
    icon: '🏅',
    platform: '스포츠',
    style: {
      fontSize: 52, fontWeight: 900, color: '#FF0000',
      strokeColor: '#FFFFFF', strokeWidth: 4,
      shadowBlur: 0, backgroundColor: 'transparent',
      animation: 'scale-in', animationDuration: 0.2,
    },
  },
  {
    id: 'edu-board',
    name: '교육 칠판',
    icon: '📝',
    platform: '교육/강의',
    style: {
      fontFamily: 'Comic Sans MS, cursive, sans-serif',
      fontSize: 44, fontWeight: 400, color: '#FFE500',
      strokeWidth: 0,
      shadowColor: 'rgba(0,0,0,0.4)', shadowBlur: 2,
      backgroundColor: 'transparent',
    },
  },
  {
    id: 'glitch-cyber',
    name: '글리치 사이버',
    icon: '🌐',
    platform: '테크/사이버펑크',
    style: {
      fontSize: 46, fontWeight: 700, color: '#00FFFF',
      strokeColor: '#FF00FF', strokeWidth: 2,
      shadowColor: '#FF00FF', shadowBlur: 10,
      backgroundColor: 'transparent',
      animation: 'glitch-in', animationDuration: 0.4,
    },
  },
  {
    id: 'anime-jp',
    name: '일본 애니',
    icon: '🌸',
    platform: '애니/서브컬처',
    style: {
      fontSize: 48, fontWeight: 900, color: '#FFFFFF',
      strokeColor: '#CC0000', strokeWidth: 3,
      shadowColor: '#000000', shadowBlur: 0, shadowOffsetX: 2, shadowOffsetY: 2,
      backgroundColor: 'transparent',
    },
  },
  {
    id: 'fashion-minimal',
    name: '패션 미니멀',
    icon: '👗',
    platform: '패션/뷰티',
    style: {
      fontSize: 36, fontWeight: 200, color: '#FFFFFF',
      strokeWidth: 0, shadowBlur: 0,
      backgroundColor: 'transparent',
      positionX: 50, positionY: 50,
    },
  },
  {
    id: 'horror',
    name: '공포',
    icon: '👻',
    platform: '공포/미스터리',
    style: {
      fontSize: 50, fontWeight: 700, color: '#CC0000',
      strokeColor: '#330000', strokeWidth: 2,
      shadowColor: '#FF0000', shadowBlur: 12, shadowOffsetX: 0, shadowOffsetY: 4,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
  },
  {
    id: 'kids-colorful',
    name: '키즈 컬러풀',
    icon: '🌈',
    platform: '아동/가족',
    style: {
      fontFamily: 'Comic Sans MS, cursive, sans-serif',
      fontSize: 56, fontWeight: 700, color: '#FF6B6B',
      strokeColor: '#FFFFFF', strokeWidth: 4,
      shadowBlur: 0, backgroundColor: 'transparent',
      animation: 'bounce-in', animationDuration: 0.4,
    },
  },
  {
    id: 'vlog-handwrite',
    name: '브이로그 손글씨',
    icon: '✏️',
    platform: '브이로그/일상',
    style: {
      fontFamily: 'Comic Sans MS, cursive, sans-serif',
      fontSize: 40, fontWeight: 400, color: '#FFFFFF',
      strokeWidth: 0,
      shadowColor: 'rgba(0,0,0,0.3)', shadowBlur: 3,
      backgroundColor: 'transparent',
      positionX: 60, positionY: 75,
      animation: 'fade-in', animationDuration: 0.5,
    },
  },
];
