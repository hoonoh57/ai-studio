/* ─── src/components/Timeline/KeyframeDiamonds.tsx ─── */
import React, { useCallback, useRef } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { Clip, KeyframeProperty } from '@/types/project';

/* ── 속성별 색상 매핑 ── */
const PROPERTY_COLORS: Record<KeyframeProperty, string> = {
  x:          '#ff6b6b',
  y:          '#ff6b6b',
  scale:      '#51cf66',
  rotation:   '#ff922b',
  opacity:    '#339af0',
  volume:     '#20c997',
  blur:       '#cc5de8',
  brightness: '#fcc419',
  contrast:   '#fcc419',
};

const PROPERTY_LABELS: Record<KeyframeProperty, string> = {
  x: 'X', y: 'Y', scale: 'S', rotation: 'R', opacity: 'O',
  volume: 'Vol', blur: 'Blur', brightness: 'Br', contrast: 'Ct',
};

/* hex → rgba 변환 (SVG stroke 호환) */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ── 상수 ── */
const DIAMOND_SIZE = 8;
const LANE_HEIGHT = 14;
const LANE_GAP = 1;
const MIN_CLIP_WIDTH_FOR_KF = 30;
const DRAG_THRESHOLD = 3;        // ★ 이 px 이상 움직여야 드래그로 인식

interface KeyframeDiamondsProps {
  clip: Clip;
  pps: number;
  clipWidthPx: number;
  maxHeight: number;
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
    hasMoved: boolean;          // ★ 실제 이동 여부 추적
    undoPushed: boolean;        // ★ undo 중복 방지
  } | null>(null);

  const tracks = clip.keyframeTracks;
  if (!tracks || tracks.length === 0) return null;
  if (clipWidthPx < MIN_CLIP_WIDTH_FOR_KF) return null;

  const activeTracks = tracks.filter(kt => kt.enabled && kt.keyframes.length > 0);
  if (activeTracks.length === 0) return null;

  const maxLanes = Math.floor(maxHeight / (LANE_HEIGHT + LANE_GAP));
  const visibleTracks = activeTracks.slice(0, Math.max(1, maxLanes));
  const totalH = visibleTracks.length * (LANE_HEIGHT + LANE_GAP);

  /* ── 드래그 핸들링 (threshold 적용) ── */
  const handleDiamondMouseDown = useCallback((
    e: React.MouseEvent,
    kfId: string,
    property: KeyframeProperty,
    kfTime: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();

    dragRef.current = {
      kfId,
      property,
      startX: e.clientX,
      startTime: kfTime,
      hasMoved: false,
      undoPushed: false,
    };

    const onMove = (me: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      me.preventDefault();

      const dx = me.clientX - d.startX;

      // ★ threshold 미달이면 아직 드래그 아님
      if (!d.hasMoved && Math.abs(dx) < DRAG_THRESHOLD) return;

      // ★ 첫 이동 시에만 undo push
      if (!d.hasMoved) {
        d.hasMoved = true;
        if (!d.undoPushed) {
          pushUndo('키프레임 이동');
          d.undoPushed = true;
        }
      }

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

  /* ── 우클릭 삭제 (더블클릭 대신) ── */
  const handleDiamondContextMenu = useCallback((
    e: React.MouseEvent,
    kfId: string,
    property: KeyframeProperty,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    // 드래그 중이면 무시
    if (dragRef.current?.hasMoved) return;
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
        pointerEvents: 'none',
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
            {/* 레인 배경 */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: hexToRgba(color, 0.06),
                borderTop: `1px solid ${hexToRgba(color, 0.15)}`,
              }}
            />

            {/* 속성 레이블 */}
            <div
              style={{
                position: 'absolute',
                left: 2,
                top: 0,
                height: LANE_HEIGHT,
                lineHeight: `${LANE_HEIGHT}px`,
                fontSize: 7,
                color: hexToRgba(color, 0.7),
                fontWeight: 700,
                letterSpacing: 0.3,
                pointerEvents: 'none',
                zIndex: 2,
              }}
            >
              {label}
            </div>

            {/* ★ 연결선 — SVG에 고정 width 사용 */}
            {kt.keyframes.length > 1 && (
              <svg
                width={clipWidthPx}
                height={LANE_HEIGHT}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  pointerEvents: 'none',
                  zIndex: 1,
                  overflow: 'visible',
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
                      stroke={hexToRgba(color, 0.5)}
                      strokeWidth={2}
                      strokeDasharray={kf.easing === 'linear' ? 'none' : '4 3'}
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
                    pointerEvents: 'auto',
                    cursor: 'ew-resize',
                    zIndex: 5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={`${label}: ${kf.value.toFixed(2)} @ ${kf.time.toFixed(2)}s [${kf.easing}]\n우클릭: 삭제`}
                  onMouseDown={e => handleDiamondMouseDown(e, kf.id, kt.property, kf.time)}
                  onContextMenu={e => handleDiamondContextMenu(e, kf.id, kt.property)}
                >
                  <svg
                    width={DIAMOND_SIZE * 2}
                    height={DIAMOND_SIZE * 2}
                    viewBox={`0 0 ${DIAMOND_SIZE * 2} ${DIAMOND_SIZE * 2}`}
                  >
                    <polygon
                      points={`${DIAMOND_SIZE},1 ${DIAMOND_SIZE * 2 - 1},${DIAMOND_SIZE} ${DIAMOND_SIZE},${DIAMOND_SIZE * 2 - 1} 1,${DIAMOND_SIZE}`}
                      fill={color}
                      stroke="#fff"
                      strokeWidth={1.2}
                      opacity={0.95}
                    />
                  </svg>
                </div>
              );
            })}
          </div>
        );
      })}

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
