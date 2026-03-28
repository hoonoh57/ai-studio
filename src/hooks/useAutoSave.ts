/* ─── src/hooks/useAutoSave.ts ─── */
import { useEffect, useRef } from 'react';
import { startAutoSave, stopAutoSave, loadAutoSave, deserializeProject, markSaved } from '@/lib/core/projectStorage';

export function useAutoSave() {
  const prompted = useRef(false);

  useEffect(() => {
    // 시작 시 자동 저장된 프로젝트가 있으면 복구 제안
    if (!prompted.current) {
      prompted.current = true;
      loadAutoSave().then(data => {
        if (data) {
          const savedTime = new Date(data.savedAt).toLocaleString();
          const restore = window.confirm(
            `자동 저장된 프로젝트가 있습니다.\n` +
            `프로젝트: ${data.project.name}\n` +
            `저장 시각: ${savedTime}\n\n` +
            `복구하시겠습니까?`
          );
          if (restore) {
            deserializeProject(data);
            markSaved();
          }
        }
      });
    }

    // 자동 저장 시작
    startAutoSave();
    return () => stopAutoSave();
  }, []);
}
