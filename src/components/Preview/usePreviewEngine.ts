/* --- src/components/Preview/usePreviewEngine.ts --- */
/* Preview 엔진 — PixiJS 기반 (WebGPU 완전 제거) */

import { useEffect, useRef, useState } from 'react';
import { PixiCompositor } from '@/engine/render/PixiCompositor';
import { OverlayRenderer } from '@/engine/render/OverlayRenderer';

export interface PreviewEngineState {
  compositor: PixiCompositor | null;
  overlay: OverlayRenderer | null;
  isGPU: boolean;
  tierLabel: string;
  gpuName: string;
  ready: boolean;
}

export function usePreviewEngine(
  gpuCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>,
) {
  const [state, setState] = useState<PreviewEngineState>({
    compositor: null,
    overlay: null,
    isGPU: false,
    tierLabel: '초기화 중...',
    gpuName: '',
    ready: false,
  });

  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    let destroyed = false;

    /* 1. OverlayRenderer 즉시 생성 */
    let overlay: OverlayRenderer | null = null;
    if (overlayCanvasRef.current) {
      try {
        overlay = new OverlayRenderer(overlayCanvasRef.current);
        console.log('[PreviewEngine] OverlayRenderer OK');
      } catch (e) {
        console.warn('[PreviewEngine] OverlayRenderer fail:', e);
      }
    }
    if (overlay && !destroyed) {
      setState(prev => ({ ...prev, overlay }));
    }

    /* 2. PixiJS Compositor 비동기 초기화 */
    const initPixi = async () => {
      if (!gpuCanvasRef.current) {
        setState(prev => ({ ...prev, tierLabel: 'CPU 렌더링', gpuName: 'No canvas', ready: true }));
        return;
      }
      try {
        const compositor = new PixiCompositor({ canvas: gpuCanvasRef.current });
        await compositor.init();
        if (destroyed) { compositor.destroy(); return; }
        const backend = compositor.backendName;
        const tierLabel = backend === 'WebGL' ? 'GPU 가속 (WebGL2)' : backend === 'WebGPU' ? 'GPU 가속 (WebGPU)' : 'CPU 렌더링';
        console.log('[PreviewEngine] Compositor OK -', tierLabel);
        setState(prev => ({
          ...prev,
          compositor,
          isGPU: true,
          tierLabel,
          gpuName: backend,
          ready: true,
        }));
      } catch (e) {
        console.error('[PreviewEngine] Compositor fail:', e);
        if (!destroyed) {
          setState(prev => ({ ...prev, tierLabel: 'CPU 렌더링', gpuName: 'Error', ready: true }));
        }
      }
    };
    initPixi();

    return () => {
      destroyed = true;
      setState(prev => {
        prev.compositor?.destroy();
        prev.overlay?.destroy();
        return prev;
      });
    };
  }, [gpuCanvasRef, overlayCanvasRef]);

  return state;
}
