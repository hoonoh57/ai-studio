// src/hooks/useAssetVisualization.ts

import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import {
  generateWaveformFromUrl,
  createEmptyWaveform,
} from '@/lib/core/waveformGenerator';
import {
  generateThumbnails,
  createEmptyThumbnails,
} from '@/lib/core/thumbnailGenerator';

/**
 * 에셋의 시각화 데이터(파형, 썸네일)를 자동 생성하는 훅입니다.
 *
 * 동작 방식:
 * 1. 스토어의 assets 목록을 구독합니다.
 * 2. waveformCache/thumbnailCache에 없는 에셋을 감지합니다.
 * 3. 비동기로 파형/썸네일을 생성하고 캐시에 저장합니다.
 * 4. 중복 생성을 방지하기 위해 처리 중인 에셋 ID를 추적합니다.
 *
 * EditorLayout 등 최상위 컴포넌트에서 한 번만 호출합니다.
 */
export function useAssetVisualization(): void {
  const assets = useEditorStore((s) => s.project.assets);
  const waveformCache = useEditorStore((s) => s.waveformCache);
  const thumbnailCache = useEditorStore((s) => s.thumbnailCache);
  const cacheWaveform = useEditorStore((s) => s.cacheWaveform);
  const cacheThumbnail = useEditorStore((s) => s.cacheThumbnail);

  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pending = pendingRef.current;

    for (const asset of assets) {
      if (asset.type === 'image') continue;

      const needsWaveform =
        (asset.type === 'video' || asset.type === 'audio') &&
        !waveformCache.has(asset.id) &&
        !pending.has(`wf_${asset.id}`);

      const needsThumbnail =
        asset.type === 'video' &&
        !thumbnailCache.has(asset.id) &&
        !pending.has(`th_${asset.id}`);

      if (needsWaveform) {
        const wfKey = `wf_${asset.id}`;
        pending.add(wfKey);

        generateWaveformFromUrl(asset.src, asset.id)
          .then((data) => {
            if (data !== null) {
              cacheWaveform(asset.id, data);
            } else {
              cacheWaveform(
                asset.id,
                createEmptyWaveform(asset.id, asset.duration),
              );
            }
          })
          .catch(() => {
            cacheWaveform(
              asset.id,
              createEmptyWaveform(asset.id, asset.duration),
            );
          })
          .finally(() => {
            pending.delete(wfKey);
          });
      }

      if (needsThumbnail) {
        const thKey = `th_${asset.id}`;
        pending.add(thKey);

        generateThumbnails(asset.src, asset.id)
          .then((data) => {
            if (data !== null) {
              cacheThumbnail(asset.id, data);
            } else {
              cacheThumbnail(
                asset.id,
                createEmptyThumbnails(asset.id, asset.duration),
              );
            }
          })
          .catch(() => {
            cacheThumbnail(
              asset.id,
              createEmptyThumbnails(asset.id, asset.duration),
            );
          })
          .finally(() => {
            pending.delete(thKey);
          });
      }
    }
  }, [assets, waveformCache, thumbnailCache, cacheWaveform, cacheThumbnail]);
}
