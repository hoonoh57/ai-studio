/* ─── src/engines/commandEngine.ts ─── */
import { useEditorStore } from '@/stores/editorStore';
import type {
  EditorCommand, ScriptMacro, CommandCategory,
  TrackType, BlendMode, KeyframeProperty, EasingType,
} from '@/types/project';

/* UID 유틸 */
let _cuid = Date.now();
const cuid = () => `cmd_${_cuid++}_${Math.random().toString(36).slice(2, 6)}`;

/* ========== 명령 레지스트리 ========== */

type CommandHandler = (params: Record<string, unknown>) => void;

const COMMAND_REGISTRY: Record<string, { handler: CommandHandler; category: CommandCategory; label: string }> = {};

function registerCommand(
  type: string,
  category: CommandCategory,
  label: string,
  handler: CommandHandler,
) {
  COMMAND_REGISTRY[type] = { handler, category, label };
}

/* ========== 명령 실행 / 기록 ========== */

const commandHistory: EditorCommand[] = [];
const macros: Map<string, ScriptMacro> = new Map();
let recording: EditorCommand[] | null = null;

/** 단일 명령 실행 */
export function executeCommand(type: string, params: Record<string, unknown> = {}): boolean {
  const entry = COMMAND_REGISTRY[type];
  if (!entry) {
    console.warn(`[CommandEngine] 알 수 없는 명령: ${type}`);
    return false;
  }

  const command: EditorCommand = {
    id: cuid(),
    type,
    category: entry.category,
    params,
    timestamp: Date.now(),
    label: entry.label,
  };

  try {
    entry.handler(params);
    commandHistory.push(command);
    if (recording) recording.push(command);
    return true;
  } catch (e) {
    console.error(`[CommandEngine] 명령 실행 실패: ${type}`, e);
    return false;
  }
}

/** 여러 명령을 순차 실행 */
export function executeCommands(commands: { type: string; params?: Record<string, unknown> }[]): boolean {
  return commands.every(c => executeCommand(c.type, c.params ?? {}));
}

/** 명령 히스토리 조회 */
export function getCommandHistory(): readonly EditorCommand[] {
  return commandHistory;
}

/** 히스토리 클리어 */
export function clearCommandHistory(): void {
  commandHistory.length = 0;
}

/* ========== 매크로 녹화 / 재생 ========== */

/** 매크로 녹화 시작 */
export function startRecording(): void {
  recording = [];
}

/** 매크로 녹화 종료 → ScriptMacro 반환 */
export function stopRecording(name: string, description = '', tags: string[] = []): ScriptMacro | null {
  if (!recording) return null;
  const macro: ScriptMacro = {
    id: `macro_${Date.now()}`,
    name,
    description,
    commands: [...recording],
    createdAt: Date.now(),
    tags,
  };
  macros.set(macro.id, macro);
  recording = null;
  return macro;
}

/** 녹화 취소 */
export function cancelRecording(): void {
  recording = null;
}

/** 녹화 중인지 */
export function isRecording(): boolean {
  return recording !== null;
}

/** 매크로 재생 */
export function playMacro(macroId: string): boolean {
  const macro = macros.get(macroId);
  if (!macro) return false;
  return macro.commands.every(cmd => executeCommand(cmd.type, cmd.params));
}

/** 매크로 목록 */
export function listMacros(): ScriptMacro[] {
  return Array.from(macros.values());
}

/** 매크로 삭제 */
export function removeMacro(macroId: string): boolean {
  return macros.delete(macroId);
}

/** JSON으로 매크로 내보내기 */
export function exportMacro(macroId: string): string | null {
  const macro = macros.get(macroId);
  return macro ? JSON.stringify(macro, null, 2) : null;
}

/** JSON에서 매크로 가져오기 */
export function importMacro(json: string): ScriptMacro | null {
  try {
    const macro = JSON.parse(json) as ScriptMacro;
    if (!macro.id || !macro.commands) return null;
    macros.set(macro.id, macro);
    return macro;
  } catch { return null; }
}

/* ========== 명령 등록: 모든 store 액션 매핑 ========== */

function getStore() {
  return useEditorStore.getState();
}

// ── 프로젝트 ──
registerCommand('project.setName', 'project', '프로젝트 이름 변경', (p) => {
  getStore().setProjectName(p.name as string);
});

// ── 트랙 ──
registerCommand('track.add', 'track', '트랙 추가', (p) => {
  getStore().addTrackChecked(p.type as TrackType, p.name as string | undefined);
});
registerCommand('track.remove', 'track', '트랙 삭제', (p) => {
  getStore().pushUndo('트랙 삭제');
  getStore().removeTrack(p.trackId as string);
});
registerCommand('track.move', 'track', '트랙 이동', (p) => {
  getStore().pushUndo('트랙 이동');
  getStore().moveTrack(p.trackId as string, p.direction as 'up' | 'down');
});
registerCommand('track.duplicate', 'track', '트랙 복제', (p) => {
  getStore().pushUndo('트랙 복제');
  getStore().duplicateTrack(p.trackId as string);
});
registerCommand('track.setColor', 'track', '트랙 색상 변경', (p) => {
  getStore().setTrackColor(p.trackId as string, p.color as string);
});
registerCommand('track.setHeight', 'track', '트랙 높이 변경', (p) => {
  getStore().setTrackHeightPreset(p.trackId as string, p.preset as string);
});
registerCommand('track.toggleSolo', 'track', '솔로 토글', (p) => {
  getStore().toggleSolo(p.trackId as string);
});
registerCommand('track.mute', 'track', '트랙 뮤트', (p) => {
  getStore().updateTrack(p.trackId as string, { muted: p.muted as boolean });
});
registerCommand('track.lock', 'track', '트랙 잠금', (p) => {
  getStore().updateTrack(p.trackId as string, { locked: p.locked as boolean });
});
registerCommand('track.reorder', 'track', '트랙 순서 변경', (p) => {
  getStore().pushUndo('트랙 순서 변경');
  getStore().reorderTracks(p.from as number, p.to as number);
});

// ── 클립 ──
registerCommand('clip.add', 'clip', '클립 추가', (p) => {
  getStore().pushUndo('클립 추가');
  getStore().addClip(p.trackId as string, p.clip as any);
});
registerCommand('clip.remove', 'clip', '클립 삭제', (p) => {
  getStore().pushUndo('클립 삭제');
  getStore().removeClip(p.clipId as string);
});
registerCommand('clip.split', 'clip', '클립 분할', (p) => {
  getStore().splitClip(p.clipId as string, p.time as number);
});
registerCommand('clip.move', 'clip', '클립 이동', (p) => {
  getStore().pushUndo('클립 이동');
  getStore().updateClip(p.clipId as string, { startTime: p.startTime as number });
});
registerCommand('clip.moveToTrack', 'clip', '클립 트랙 이동', (p) => {
  getStore().pushUndo('클립 트랙 이동');
  getStore().moveClipToTrack(p.clipId as string, p.fromTrackId as string, p.toTrackId as string);
});
registerCommand('clip.setSpeed', 'clip', '클립 속도 변경', (p) => {
  getStore().setClipSpeed(p.clipId as string, p.speed as number, p.reverse as boolean | undefined);
});
registerCommand('clip.setBlendMode', 'clip', '블렌드 모드 변경', (p) => {
  getStore().setClipBlendMode(p.clipId as string, p.mode as BlendMode);
});
registerCommand('clip.setOpacity', 'clip', '투명도 변경', (p) => {
  getStore().pushUndo('투명도 변경');
  getStore().updateClip(p.clipId as string, { opacity: p.opacity as number });
});
registerCommand('clip.setTransform', 'clip', '트랜스폼 변경', (p) => {
  getStore().pushUndo('트랜스폼 변경');
  getStore().updateClip(p.clipId as string, { transform: p.transform as any });
});
registerCommand('clip.link', 'clip', '클립 링크', (p) => {
  getStore().pushUndo('클립 링크');
  getStore().linkClips(p.clipIdA as string, p.clipIdB as string);
});
registerCommand('clip.unlink', 'clip', '클립 링크 해제', (p) => {
  getStore().pushUndo('클립 링크 해제');
  getStore().unlinkClip(p.clipId as string);
});
registerCommand('clip.group', 'clip', '클립 그룹', (p) => {
  getStore().groupClips(p.clipIds as string[]);
});
registerCommand('clip.ungroup', 'clip', '클립 그룹 해제', (p) => {
  getStore().ungroupClips(p.groupId as string);
});
registerCommand('clip.select', 'clip', '클립 선택', (p) => {
  getStore().selectClip(p.clipId as string | null);
});

// ── 키프레임 ──
registerCommand('keyframe.add', 'keyframe', '키프레임 추가', (p) => {
  const store = getStore();
  store.pushUndo('키프레임 추가');
  // 키프레임 store 액션은 3-C에서 구현
  if (typeof (store as any).addKeyframe === 'function') {
    (store as any).addKeyframe(
      p.clipId as string,
      p.property as KeyframeProperty,
      p.time as number,
      p.value as number,
      (p.easing as EasingType) ?? 'linear',
    );
  }
});
registerCommand('keyframe.remove', 'keyframe', '키프레임 삭제', (p) => {
  const store = getStore();
  store.pushUndo('키프레임 삭제');
  if (typeof (store as any).removeKeyframe === 'function') {
    (store as any).removeKeyframe(p.clipId as string, p.property as KeyframeProperty, p.keyframeId as string);
  }
});
registerCommand('keyframe.update', 'keyframe', '키프레임 수정', (p) => {
  const store = getStore();
  store.pushUndo('키프레임 수정');
  if (typeof (store as any).updateKeyframe === 'function') {
    (store as any).updateKeyframe(p.clipId as string, p.property as KeyframeProperty, p.keyframeId as string, p.patch as any);
  }
});

// ── 전환 ──
registerCommand('transition.add', 'transition', '전환 추가', (p) => {
  getStore().pushUndo('전환 추가');
  getStore().addTransition(p.transition as any);
});
registerCommand('transition.remove', 'transition', '전환 삭제', (p) => {
  getStore().pushUndo('전환 삭제');
  getStore().removeTransition(p.transitionId as string);
});

// ── 효과 ──
registerCommand('effect.addFilter', 'effect', '필터 추가', (p) => {
  const store = getStore();
  store.pushUndo('필터 추가');
  const clip = store.project.tracks.flatMap(t => t.clips).find(c => c.id === p.clipId);
  if (clip) {
    store.updateClip(p.clipId as string, {
      filters: [...clip.filters, p.filter as any],
    });
  }
});
registerCommand('effect.removeFilter', 'effect', '필터 삭제', (p) => {
  const store = getStore();
  store.pushUndo('필터 삭제');
  const clip = store.project.tracks.flatMap(t => t.clips).find(c => c.id === p.clipId);
  if (clip) {
    store.updateClip(p.clipId as string, {
      filters: clip.filters.filter(f => f.id !== p.filterId),
    });
  }
});

// ── 재생 ──
registerCommand('playback.play', 'playback', '재생', () => {
  const s = getStore();
  if (!s.isPlaying) s.togglePlay();
});
registerCommand('playback.pause', 'playback', '일시정지', () => {
  const s = getStore();
  if (s.isPlaying) s.togglePlay();
});
registerCommand('playback.toggle', 'playback', '재생/일시정지 토글', () => {
  getStore().togglePlay();
});
registerCommand('playback.seekTo', 'playback', '시간 이동', (p) => {
  getStore().setCurrentTime(p.time as number);
});
registerCommand('playback.seekStart', 'playback', '처음으로', () => {
  getStore().setCurrentTime(0);
});

// ── 마커 ──
registerCommand('marker.add', 'project', '마커 추가', (p) => {
  getStore().addMarker(p.marker as any);
});
registerCommand('marker.remove', 'project', '마커 삭제', (p) => {
  getStore().removeMarker(p.markerId as string);
});

// ── 프로젝트 설정 ──
registerCommand('project.setSkillLevel', 'project', '스킬 레벨 변경', (p) => {
  getStore().setSkillLevel(p.level as any);
});
registerCommand('project.setZoom', 'project', '줌 변경', (p) => {
  getStore().setZoom(p.zoom as number);
});
registerCommand('project.toggleSnap', 'project', '스냅 토글', () => {
  getStore().toggleSnap();
});
registerCommand('project.undo', 'project', '실행 취소', () => {
  getStore().undo();
});
registerCommand('project.redo', 'project', '다시 실행', () => {
  getStore().redo();
});

/* ========== 명령 조회 ========== */

/** 등록된 모든 명령 타입 목록 */
export function listCommands(): { type: string; category: CommandCategory; label: string }[] {
  return Object.entries(COMMAND_REGISTRY).map(([type, entry]) => ({
    type,
    category: entry.category,
    label: entry.label,
  }));
}

/** 카테고리별 명령 조회 */
export function listCommandsByCategory(category: CommandCategory): { type: string; label: string }[] {
  return Object.entries(COMMAND_REGISTRY)
    .filter(([, entry]) => entry.category === category)
    .map(([type, entry]) => ({ type, label: entry.label }));
}

/** 명령 존재 여부 */
export function hasCommand(type: string): boolean {
  return type in COMMAND_REGISTRY;
}
