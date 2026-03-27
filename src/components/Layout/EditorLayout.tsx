// src/components/Layout/EditorLayout.tsx
import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { SKILL_CONFIGS } from '@/types/project';
import { TopBar } from './TopBar';
import { IconBar } from './IconBar';
import { MediaHub } from '@/components/MediaLibrary/MediaHub';
import { PreviewArea } from '@/components/Preview/PreviewArea';
import { TimelinePanel } from '@/components/Timeline/TimelinePanel';
import { PropertiesPanel } from '@/components/Properties/PropertiesPanel';
import { useAssetVisualization } from '@/hooks/useAssetVisualization';
import css from './EditorLayout.module.css';

const BEGINNER_PRESETS = [
  '🎬 여행 브이로그', '📱 제품 리뷰', '📚 교육 영상',
  '🎵 뮤직비디오', '📰 뉴스 요약', '🛍️ 쇼츠 광고',
];

function BeginnerView(): React.ReactElement {
  const [prompt, setPrompt] = React.useState('');

  return (
    <div className={css.beginnerMain}>
      <div className={css.aiPromptBox}>
        <div className={css.aiTitle}>✨ 어떤 영상을 만들까요?</div>
        <div className={css.aiSubtitle}>
          자연어로 설명하면 AI가 영상을 만들어드립니다
        </div>
        <textarea
          className={css.aiTextarea}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="예: 제주도 3박4일 여행 브이로그를 만들어줘. 밝고 경쾌한 느낌으로, 자막과 배경음악을 넣어줘."
        />
        <button className={css.aiButton}>🎬 영상 만들기</button>
        <div className={css.aiPresets}>
          {BEGINNER_PRESETS.map(p => (
            <button
              key={p}
              className={css.aiPresetChip}
              onClick={() => setPrompt(p.slice(2) + ' 영상을 만들어줘')}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EditorLayout(): React.ReactElement {
  useAssetVisualization();
  const skillLevel = useEditorStore(st => st.skillLevel);
  const activeTab = useEditorStore(st => st.activeTab);
  const config = SKILL_CONFIGS[skillLevel];

  if (activeTab === 'ai-creator') {
    return (
      <div className={css.app}>
        <TopBar />
        <BeginnerView />
      </div>
    );
  }

  return (
    <div className={css.app}>
      <TopBar />
      <div className={css.main}>
        {config.showIconBar && <IconBar />}
        <div className={css.mediaWrap}><MediaHub /></div>
        <div className={css.centerCol}>
          <div className={css.previewArea}><PreviewArea /></div>
          {config.showTimeline && (
            <div className={css.timelineArea}><TimelinePanel /></div>
          )}
        </div>
        {config.showProperties && (
          <div className={css.propertiesWrap}><PropertiesPanel /></div>
        )}
      </div>
    </div>
  );
}

export default EditorLayout;
