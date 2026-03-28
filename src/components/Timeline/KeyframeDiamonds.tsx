/* ─── src/components/Timeline/KeyframeDiamonds.tsx ─── */
import React, { useCallback, useRef, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { Clip, KeyframeProperty } from '@/types/project';

/* ── 속성별 색상 매핑 (Premiere Pro 스타일) ── */
const PROPERTY_COLORS: Record<KeyframeProperty, string> = {
  x:          '#ff6b6b',   // position — 빨강
  y:          '#ff6b6b',
  scale:      '#51cf66',   // scale — 초록
  rotation:   '#ff922b',   // rotation — 주황
  opacity:    '#339af0',   // opacity — 파랑
  volume:     '#20c997',   // audio — 청록
  blur:       '#cc5de8',   // effect — 보라
  brightness: '#fcc419',   // color — 노랑
  contrast:   '#fcc419',
};

const PROPERTY_LABELS: Record<KeyframeProperty, string> = {
  x: 'X', y: 'Y', scale: 'S', rotation: 'R', opacity: 'O',
  volume: 'Vol', blur: 'Blur', brightness: 'Br', contrast: 'Ct',
};

/* ── 상수 ── */
const DIAMOND_SIZE = 8;           // 다이아몬드 한 변의 반쪽 크기 (px)
const LANE_HEIGHT = 12;           // 속성당 레인 높이
const LANE_GAP = 1;               // 레인 간 간격
const MIN_CLIP_WIDTH_FOR_KF = 30; // 이 폭 이하면 표시 안 함

interface KeyframeDiamondsProps {
  clip: Clip;
  pps: number;                     // pixels per second
  clipWidthPx: number;            // 클립 전체 폭 (px)
  maxHeight: number;               // 사용 가능한 높이 (클립 하단 영역)
}

export function KeyframeDiamonds({
  clip,
  pps,
  clipWidthPx,
  maxHeight,
}: KeyframeDiamondsProps): React.ReactElement | null {
  const pushUndo = useEditorStore(s => s.pushUndo);
  const updateKeyframe = useEditorStore(s => s.updateKeyframe);
  const removeKeyframe = useEditorStore(s => s.removeKeyframe);
  const dragRef = useRef<{
    kfId: string;
    property: KeyframeProperty;
    startX: number;
    startTime: number;
  } | null>(null);

  const tracks = clip.keyframeTracks;
  if (!tracks || tracks.length === 0) return null;
  if (clipWidthPx < MIN_CLIP_WIDTH_FOR_KF) return null;

  // 활성화된 트랙만 필터링 (키프레임이 1개 이상)
  const activeTracks = tracks.filter(kt => kt.enabled && kt.keyframes.length > 0);
  if (activeTracks.length === 0) return null;

  // 최대 표시 가능 트랙 수 (높이 제한)
  const maxLanes = Math.floor(maxHeight / (LANE_HEIGHT + LANE_GAP));
  const visibleTracks = activeTracks.slice(0, Math.max(1, maxLanes));
  const totalH = visibleTracks.length * (LANE_HEIGHT + LANE_GAP);

  /* ── 드래그 핸들링 ── */
  const handleDiamondMouseDown = useCallback((
    e: React.MouseEvent,
    kfId: string,
    property: KeyframeProperty,
    kfTime: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    pushUndo('키프레임 이동');
    dragRef.current = {
      kfId,
      property,
      startX: e.clientX,
      startTime: kfTime,
    };

    const onMove = (me: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      me.preventDefault();
      const dx = me.clientX - d.startX;
      const dt = dx / pps;
      const newTime = Math.max(0, Math.min(clip.duration, d.startTime + dt));
      updateKeyframe(clip.id, d.property, d.kfId, { time: newTime });
    };

    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [clip.id, clip.duration, pps, pushUndo, updateKeyframe]);

  /* ── 더블클릭 삭제 ── */
  const handleDiamondDoubleClick = useCallback((
    e: React.MouseEvent,
    kfId: string,
    property: KeyframeProperty,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    pushUndo('키프레임 삭제');
    removeKeyframe(clip.id, property, kfId);
  }, [clip.id, pushUndo, removeKeyframe]);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: totalH,
        pointerEvents: 'none',     // 컨테이너 자체는 통과
        zIndex: 6,
      }}
    >
      {visibleTracks.map((kt, laneIdx) => {
        const color = PROPERTY_COLORS[kt.property] || '#aaa';
        const label = PROPERTY_LABELS[kt.property] || kt.property;
        const laneTop = laneIdx * (LANE_HEIGHT + LANE_GAP);

        return (
          <div
            key={kt.property}
            style={{
              position: 'absolute',
              top: laneTop,
              left: 0,
              right: 0,
              height: LANE_HEIGHT,
            }}
          >
            {/* 레인 배경 (반투명 줄) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `${color}08`,
                borderTop: `1px solid ${color}20`,
              }}
            />

            {/* 속성 레이블 (좌측) */}
            <div
              style={{
                position: 'absolute',
                left: 2,
                top: 0,
                height: LANE_HEIGHT,
                lineHeight: `${LANE_HEIGHT}px`,
                fontSize: 7,
                color: `${color}aa`,
                fontWeight: 700,
                letterSpacing: 0.3,
                pointerEvents: 'none',
                zIndex: 2,
              }}
            >
              {label}
            </div>

            {/* 키프레임 사이 연결선 */}
            {kt.keyframes.length > 1 && (
              <svg
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: LANE_HEIGHT,
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              >
                {kt.keyframes.slice(0, -1).map((kf, i) => {
                  const nextKf = kt.keyframes[i + 1];
                  const x1 = (kf.time / clip.duration) * clipWidthPx;
                  const x2 = (nextKf.time / clip.duration) * clipWidthPx;
                  const cy = LANE_HEIGHT / 2;
                  return (
                    <line
                      key={`${kf.id}-line`}
                      x1={x1}
                      y1={cy}
                      x2={x2}
                      y2={cy}
                      stroke={`${color}60`}
                      strokeWidth={1.5}
                      strokeDasharray={kf.easing === 'linear' ? 'none' : '3 2'}
                    />
                  );
                })}
              </svg>
            )}

            {/* 다이아몬드 마커 */}
            {kt.keyframes.map(kf => {
              const xPos = (kf.time / clip.duration) * clipWidthPx;
              const cy = LANE_HEIGHT / 2;

              return (
                <div
                  key={kf.id}
                  style={{
                    position: 'absolute',
                    left: xPos - DIAMOND_SIZE,
                    top: cy - DIAMOND_SIZE,
                    width: DIAMOND_SIZE * 2,
                    height: DIAMOND_SIZE * 2,
                    pointerEvents: 'auto',       // ★ 다이아몬드만 클릭 가능
                    cursor: 'ew-resize',
                    zIndex: 5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={`${label}: ${kf.value.toFixed(2)} @ ${kf.time.toFixed(2)}s (${kf.easing})`}
                  onMouseDown={e => handleDiamondMouseDown(e, kf.id, kt.property, kf.time)}
                  onDoubleClick={e => handleDiamondDoubleClick(e, kf.id, kt.property)}
                >
                  {/* 다이아몬드 SVG */}
                  <svg
                    width={DIAMOND_SIZE * 2}
                    height={DIAMOND_SIZE * 2}
                    viewBox={`0 0 ${DIAMOND_SIZE * 2} ${DIAMOND_SIZE * 2}`}
                  >
                    <polygon
                      points={`${DIAMOND_SIZE},1 ${DIAMOND_SIZE * 2 - 1},${DIAMOND_SIZE} ${DIAMOND_SIZE},${DIAMOND_SIZE * 2 - 1} 1,${DIAMOND_SIZE}`}
                      fill={color}
                      stroke="#fff"
                      strokeWidth={1}
                      opacity={0.95}
                    />
                  </svg>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* 숨겨진 트랙 표시 (공간 부족 시) */}
      {activeTracks.length > visibleTracks.length && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 4,
            fontSize: 7,
            color: '#888',
            background: 'rgba(0,0,0,0.5)',
            borderRadius: 2,
            padding: '0 3px',
            pointerEvents: 'none',
          }}
        >
          +{activeTracks.length - visibleTracks.length} more
        </div>
      )}
    </div>
  );
}
