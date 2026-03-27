import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { SKILL_CONFIGS } from '@/types/project';
import TopBar from './TopBar';
import IconBar from './IconBar';
import { MediaPanel } from '@/components/MediaLibrary/MediaPanel';
import { PreviewArea } from '@/components/Preview/PreviewArea';
import { TimelinePanel } from '@/components/Timeline/TimelinePanel';
import { PropertiesPanel } from '@/components/Properties/PropertiesPanel';
import { useAssetVisualization } from '@/hooks/useAssetVisualization';

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--bg-primary)',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  centerWrap: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  centerCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  beginnerMain: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-primary)',
    padding: 40,
  },
  aiPromptBox: {
    maxWidth: 700,
    width: '100%',
    textAlign: 'center' as const,
  },
  aiTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 8,
  },
  aiSubtitle: {
    fontSize: 14,
    color: 'var(--text-muted)',
    marginBottom: 32,
  },
  aiTextarea: {
    width: '100%',
    minHeight: 100,
    padding: 16,
    fontSize: 15,
    lineHeight: 1.6,
    background: 'var(--bg-surface)',
    border: '2px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--text-primary)',
    resize: 'vertical' as const,
    outline: 'none',
    fontFamily: 'inherit',
  },
  aiButton: {
    marginTop: 16,
    padding: '12px 32px',
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  aiPresets: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    marginTop: 24,
    flexWrap: 'wrap' as const,
  },
  aiPresetChip: {
    padding: '6px 14px',
    fontSize: 12,
    color: 'var(--text-secondary)',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

function BeginnerView() {
  const [prompt, setPrompt] = React.useState('');

  const presets = [
    '🎬 여행 브이로그', '📱 제품 리뷰', '📚 교육 영상',
    '🎵 뮤직비디오', '📰 뉴스 요약', '🛍️ 쇼츠 광고',
  ];

  return (
    <div style={styles.beginnerMain}>
      <div style={styles.aiPromptBox}>
        <div style={styles.aiTitle}>✨ 어떤 영상을 만들까요?</div>
        <div style={styles.aiSubtitle}>자연어로 설명하면 AI가 영상을 만들어드립니다</div>
        <textarea
          style={styles.aiTextarea}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="예: 제주도 3박4일 여행 브이로그를 만들어줘. 밝고 경쾌한 느낌으로, 자막과 배경음악을 넣어줘."
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        />
        <button
          style={styles.aiButton}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          🎬 영상 만들기
        </button>
        <div style={styles.aiPresets}>
          {presets.map((p) => (
            <button
              key={p}
              style={styles.aiPresetChip}
              onClick={() => setPrompt(p.slice(2) + ' 영상을 만들어줘')}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EditorLayout() {
  useAssetVisualization(); // Trigger automation
  const skillLevel = useEditorStore((st) => st.skillLevel);
  const activeTab = useEditorStore((st) => st.activeTab);
  const config = SKILL_CONFIGS[skillLevel];

  // Beginner: AI Creator only
  if (activeTab === 'ai-creator') {
    return (
      <div style={styles.app}>
        <TopBar />
        <BeginnerView />
      </div>
    );
  }

  // Intermediate and above: Editor with adaptive panels
  return (
    <div style={styles.app}>
      <TopBar />
      <div style={styles.main}>
        {config.showIconBar && <IconBar />}
        <MediaPanel />
        <div style={styles.centerWrap}>
          <div style={styles.centerCol}>
            <PreviewArea />
            {config.showTimeline && <TimelinePanel />}
          </div>
          {config.showProperties && <PropertiesPanel />}
        </div>
      </div>
    </div>
  );
}
