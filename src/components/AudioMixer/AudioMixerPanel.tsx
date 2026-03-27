/* ─── src/components/AudioMixer/AudioMixerPanel.tsx ─── */
import React, { useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { SKILL_CONFIGS } from '@/types/project';
import type { Track } from '@/types/project';

const CHANNEL_W = 64;
const FADER_H = 160;
const METER_W = 8;
const METER_GAP = 2;
const LABEL_FONT = 10;
const DB_FONT = 9;

const DB_MARKS = [0, -6, -12, -24, -48] as const;

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

function linearToDb(linear: number): number {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

function volumeToFaderPosition(volume: number): number {
  // 0..2 → 0..1 (fader range), 1.0 = unity = 75% position
  if (volume <= 0) return 0;
  if (volume <= 1) return volume * 0.75;
  return 0.75 + ((volume - 1) * 0.25);
}

function faderPositionToVolume(pos: number): number {
  if (pos <= 0) return 0;
  if (pos <= 0.75) return pos / 0.75;
  return 1 + ((pos - 0.75) / 0.25);
}

interface ChannelStripProps {
  track: Track;
  onVolumeChange: (trackId: string, volume: number) => void;
  onMuteToggle: (trackId: string) => void;
  onSoloToggle: (trackId: string) => void;
  isSoloMuted: boolean;
}

function ChannelStrip({
  track, onVolumeChange, onMuteToggle, onSoloToggle, isSoloMuted,
}: ChannelStripProps): React.ReactElement {
  const volume = track.clips.length > 0 ? (track.clips[0].volume ?? 1) : 1;
  const faderPos = volumeToFaderPosition(volume);
  const db = linearToDb(volume);
  const dbDisplay = db === -Infinity ? '-∞' : `${db.toFixed(1)} dB`;
  const trackColor = track.color || '#50C878';

  const handleFaderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const pos = parseFloat(e.target.value);
    const vol = faderPositionToVolume(pos);
    onVolumeChange(track.id, Math.round(vol * 100) / 100);
  }, [track.id, onVolumeChange]);

  return (
    <div style={{
      width: CHANNEL_W, display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 4, padding: '8px 4px',
      background: 'var(--bg-surface, #1a1a2e)',
      borderRadius: 6, border: '1px solid var(--border, #333)',
    }}>
      {/* 트랙 이름 */}
      <div style={{
        fontSize: LABEL_FONT, color: '#aaa', textAlign: 'center',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        width: '100%', fontWeight: 600,
      }}>
        {track.name}
      </div>

      {/* 미터 + 페이더 */}
      <div style={{
        position: 'relative', height: FADER_H, width: 36,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* dB 스케일 마크 */}
        {DB_MARKS.map(mark => {
          const pos = volumeToFaderPosition(dbToLinear(mark));
          return (
            <div key={mark} style={{
              position: 'absolute', right: -16,
              top: `${(1 - pos) * 100}%`, transform: 'translateY(-50%)',
              fontSize: DB_FONT, color: '#555', userSelect: 'none',
            }}>
              {mark}
            </div>
          );
        })}

        {/* 미터 바 (시뮬레이션) */}
        <div style={{
          position: 'absolute', left: 0, width: METER_W,
          height: '100%', background: '#111', borderRadius: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: `${faderPos * 100}%`,
            background: isSoloMuted
              ? '#555'
              : (volume > 1 ? '#ff4444' : trackColor),
            borderRadius: 2,
            transition: 'height 0.1s',
          }} />
        </div>

        {/* 세로 페이더 */}
        <input
          type="range"
          min={0} max={1} step={0.01}
          value={faderPos}
          onChange={handleFaderChange}
          style={{
            writingMode: 'vertical-lr' as any,
            direction: 'rtl',
            width: 20, height: FADER_H,
            cursor: 'pointer',
            accentColor: trackColor,
            marginLeft: METER_W + METER_GAP,
          }}
        />
      </div>

      {/* dB 표시 */}
      <div style={{ fontSize: DB_FONT, color: '#888', fontFamily: 'monospace' }}>
        {dbDisplay}
      </div>

      {/* 뮤트 / 솔로 */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          style={{
            width: 24, height: 20, fontSize: 10, border: 'none', borderRadius: 3,
            background: track.muted ? '#e74c3c' : '#333',
            color: track.muted ? '#fff' : '#888', cursor: 'pointer',
          }}
          onClick={() => onMuteToggle(track.id)}
          title="Mute"
        >
          M
        </button>
        <button
          style={{
            width: 24, height: 20, fontSize: 10, border: 'none', borderRadius: 3,
            background: track.solo ? '#f1c40f' : '#333',
            color: track.solo ? '#000' : '#888', cursor: 'pointer',
          }}
          onClick={() => onSoloToggle(track.id)}
          title="Solo"
        >
          S
        </button>
      </div>

      {/* 컬러 인디케이터 */}
      <div style={{
        width: '80%', height: 3, borderRadius: 2, background: trackColor,
      }} />
    </div>
  );
}

export function AudioMixerPanel(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const skillLevel = useEditorStore(s => s.skillLevel);
  const updateTrack = useEditorStore(s => s.updateTrack);
  const toggleSolo = useEditorStore(s => s.toggleSolo);
  const getEffectiveMuted = useEditorStore(s => s.getEffectiveMuted);
  const updateClipsBulk = useEditorStore(s => s.updateClipsBulk);
  // const pushUndo = useEditorStore(s => s.pushUndo);

  const config = SKILL_CONFIGS[skillLevel];
  const audioTracks = project.tracks.filter(t => t.type === 'audio');
  const videoTracks = project.tracks.filter(t => t.type === 'video');

  const handleVolumeChange = useCallback((trackId: string, volume: number) => {
    const track = project.tracks.find(t => t.id === trackId);
    if (!track) return;
    const updates = track.clips.map(c => ({
      clipId: c.id,
      patch: { volume } as Partial<typeof c>,
    }));
    if (updates.length > 0) {
      updateClipsBulk(updates);
    }
  }, [project.tracks, updateClipsBulk]);

  const handleMuteToggle = useCallback((trackId: string) => {
    const track = project.tracks.find(t => t.id === trackId);
    if (!track) return;
    updateTrack(trackId, { muted: !track.muted });
  }, [project.tracks, updateTrack]);

  const handleSoloToggle = useCallback((trackId: string) => {
    toggleSolo(trackId);
  }, [toggleSolo]);

  if (!config.showAudioMixer) {
    return (
      <div style={{
        padding: 20, textAlign: 'center', color: '#555', fontSize: 12,
      }}>
        오디오 믹서는 고급 이상에서 사용할 수 있습니다
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-panel, #181825)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 12px', fontSize: 12, fontWeight: 600,
        color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        Audio Mixer
      </div>

      <div style={{
        flex: 1, display: 'flex', gap: 6, padding: 8,
        overflowX: 'auto', overflowY: 'hidden', alignItems: 'flex-start',
      }}>
        {/* 비디오 트랙 (오디오 포함 가능) */}
        {videoTracks.map(t => (
          <ChannelStrip
            key={t.id}
            track={t}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
            onSoloToggle={handleSoloToggle}
            isSoloMuted={getEffectiveMuted(t.id)}
          />
        ))}

        {/* 구분선 */}
        {videoTracks.length > 0 && audioTracks.length > 0 && (
          <div style={{
            width: 1, alignSelf: 'stretch', background: 'var(--border)',
            margin: '0 4px', flexShrink: 0,
          }} />
        )}

        {/* 오디오 트랙 */}
        {audioTracks.map(t => (
          <ChannelStrip
            key={t.id}
            track={t}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
            onSoloToggle={handleSoloToggle}
            isSoloMuted={getEffectiveMuted(t.id)}
          />
        ))}

        {audioTracks.length === 0 && videoTracks.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#555', fontSize: 12,
          }}>
            오디오 트랙이 없습니다
          </div>
        )}
      </div>

      {/* 마스터 출력 */}
      <div style={{
        padding: '6px 12px', borderTop: '1px solid var(--border)',
        fontSize: 10, color: '#666', display: 'flex', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span>Master Out</span>
        <span>0.0 dB</span>
      </div>
    </div>
  );
}
