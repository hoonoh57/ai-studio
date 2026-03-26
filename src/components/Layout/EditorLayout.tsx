import React from 'react';
import TopBar from './TopBar';
import IconBar from './IconBar';
import MediaPanel from '@/components/MediaLibrary/MediaPanel';
import PreviewArea from '@/components/Preview/PreviewArea';
import TimelinePanel from '@/components/Timeline/TimelinePanel';
import PropertiesPanel from '@/components/Properties/PropertiesPanel';

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
};

export default function EditorLayout() {
  return (
    <div style={styles.app}>
      <TopBar />
      <div style={styles.main}>
        <IconBar />
        <MediaPanel />
        <div style={styles.centerWrap}>
          <div style={styles.centerCol}>
            <PreviewArea />
            <TimelinePanel />
          </div>
          <PropertiesPanel />
        </div>
      </div>
    </div>
  );
}
