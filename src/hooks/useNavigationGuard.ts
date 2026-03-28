/* ─── src/hooks/useNavigationGuard.ts ─── */
/**
 * 브라우저 이탈 방지 + 위험한 단축키 차단
 * - Alt+←/→ (브라우저 뒤로/앞으로) 차단
 * - Ctrl+W (탭 닫기) 경고
 * - F5 / Ctrl+R (새로고침) 경고
 * - beforeunload 이벤트로 페이지 이탈 시 경고
 */
import { useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';

export function useNavigationGuard() {
  useEffect(() => {
    /* ── 1. beforeunload: 탭/창 닫기·새로고침 시 경고 ── */
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const state = useEditorStore.getState();
      // 클립이 하나라도 있으면 "작업 중"으로 판단
      const hasWork = state.project.tracks.some(t => t.clips.length > 0);
      if (!hasWork) return;

      e.preventDefault();
      // 최신 브라우저는 커스텀 메시지를 무시하지만 표준상 필요
      e.returnValue = '저장되지 않은 작업이 있습니다. 정말 나가시겠습니까?';
      return e.returnValue;
    };

    /* ── 2. 위험한 단축키 차단 ── */
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + ←/→ : 브라우저 뒤로/앞으로
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Backspace (포커스가 input/textarea 아닐 때) : 일부 브라우저에서 뒤로가기
      if (e.key === 'Backspace') {
        const tag = (e.target as HTMLElement).tagName;
        const isEditable = (e.target as HTMLElement).isContentEditable;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !isEditable) {
          // TimelinePanel의 Delete 핸들러가 처리하므로 여기선 브라우저 뒤로가기만 차단
          // e.preventDefault()는 TimelinePanel에서 이미 하고 있음
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);
}
