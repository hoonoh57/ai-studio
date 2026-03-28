/* ─── src/presets/presetEngine.ts ─── */
import { useEditorStore } from '@/stores/editorStore';
import { BUILTIN_PRESETS } from './builtinPresets';
import type {
    MotionPreset, PresetCategory, ContentGenre,
    PresetRecommendContext, PresetCollection,
} from '@/types/preset';
import type { KeyframeProperty, EasingType, EditorCommand } from '@/types/project';

/* ════════════════════════════════════════
   1. 프리셋 저장소 (빌트인 + 사용자)
   ════════════════════════════════════════ */
const USER_PRESETS_KEY = 'badacut_user_presets';
const USER_COLLECTIONS_KEY = 'badacut_user_collections';

let _allPresets: MotionPreset[] = [...BUILTIN_PRESETS];
let _userCollections: PresetCollection[] = [];

/** localStorage에서 사용자 프리셋 로드 */
export function loadUserPresets(): void {
    try {
        const raw = localStorage.getItem(USER_PRESETS_KEY);
        if (raw) {
            const userPresets: MotionPreset[] = JSON.parse(raw);
            _allPresets = [...BUILTIN_PRESETS, ...userPresets];
        }
        const colRaw = localStorage.getItem(USER_COLLECTIONS_KEY);
        if (colRaw) {
            _userCollections = JSON.parse(colRaw);
        }
    } catch { /* noop */ }
}

function _saveUserPresets(): void {
    const userOnly = _allPresets.filter(p => !p.builtin);
    localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(userOnly));
    localStorage.setItem(USER_COLLECTIONS_KEY, JSON.stringify(_userCollections));
}

/* ════════════════════════════════════════
   2. 프리셋 CRUD
   ════════════════════════════════════════ */
export function getAllPresets(): MotionPreset[] {
    return _allPresets;
}

export function getPresetById(id: string): MotionPreset | undefined {
    return _allPresets.find(p => p.id === id);
}

export function getPresetsByCategory(category: PresetCategory): MotionPreset[] {
    return _allPresets.filter(p => p.category === category).sort((a, b) => b.popularity - a.popularity);
}

export function searchPresets(query: string): MotionPreset[] {
    const q = query.toLowerCase();
    return _allPresets.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
    ).sort((a, b) => b.popularity - a.popularity);
}

/** 사용자 프리셋 등록 */
export function registerPreset(preset: Omit<MotionPreset, 'id' | 'createdAt' | 'builtin'>): MotionPreset {
    const newPreset: MotionPreset = {
        ...preset,
        id: `user.${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        builtin: false,
        createdAt: Date.now(),
    };
    _allPresets.push(newPreset);
    _saveUserPresets();
    return newPreset;
}

/** 현재 클립의 키프레임을 프리셋으로 캡처 */
export function capturePresetFromClip(
    clipId: string,
    meta: { name: string; description: string; category: PresetCategory; genres: ContentGenre[]; tags: string[] },
): MotionPreset | null {
    const state = useEditorStore.getState();
    let clip = null;
    for (const t of state.project.tracks) {
        clip = t.clips.find(c => c.id === clipId);
        if (clip) break;
    }
    if (!clip || !clip.keyframeTracks || clip.keyframeTracks.length === 0) return null;

    const tracks = clip.keyframeTracks
        .filter(kt => kt.enabled && kt.keyframes.length > 0)
        .map(kt => ({
            property: kt.property,
            mode: 'absolute' as const,
            keyframes: kt.keyframes.map(kf => ({
                position: clip!.duration > 0 ? kf.time / clip!.duration : 0,
                value: kf.value,
                easing: kf.easing,
            })),
        }));

    return registerPreset({
        ...meta,
        difficulty: 'intermediate',
        popularity: 50,
        tracks,
        defaultSpan: 1.0,
        anchor: 'full',
        tags: meta.tags,
        version: 1,
    });
}

/** 사용자 프리셋 수정 */
export function updatePreset(id: string, patch: Partial<MotionPreset>): boolean {
    const idx = _allPresets.findIndex(p => p.id === id && !p.builtin);
    if (idx < 0) return false;
    _allPresets[idx] = { ..._allPresets[idx], ...patch, version: (_allPresets[idx].version || 1) + 1 };
    _saveUserPresets();
    return true;
}

/** 사용자 프리셋 삭제 */
export function deletePreset(id: string): boolean {
    const idx = _allPresets.findIndex(p => p.id === id && !p.builtin);
    if (idx < 0) return false;
    _allPresets.splice(idx, 1);
    _saveUserPresets();
    return true;
}

/** 빌트인 프리셋을 복제하여 사용자 프리셋으로 */
export function duplicatePreset(id: string, newName?: string): MotionPreset | null {
    const source = _allPresets.find(p => p.id === id);
    if (!source) return null;
    return registerPreset({
        ...source,
        name: newName || `${source.name} (복사)`,
        tracks: JSON.parse(JSON.stringify(source.tracks)),
        genres: [...source.genres],
        tags: [...source.tags],
    });
}

/* ════════════════════════════════════════
   3. 프리셋 → 키프레임 적용
   ════════════════════════════════════════ */
export function applyPresetToClip(presetId: string, clipId: string): boolean {
    const preset = getPresetById(presetId);
    if (!preset) return false;

    const state = useEditorStore.getState();
    let clip = null;
    for (const t of state.project.tracks) {
        clip = t.clips.find(c => c.id === clipId);
        if (clip) break;
    }
    if (!clip) return false;

    const duration = clip.duration;
    const span = preset.defaultSpan * duration;

    state.pushUndo(`프리셋 적용: ${preset.name}`);

    for (const track of preset.tracks) {
        for (const kf of track.keyframes) {
            let time: number;
            if (preset.anchor === 'end') {
                time = duration - span + kf.position * span;
            } else if (preset.anchor === 'start') {
                time = kf.position * span;
            } else {
                time = kf.position * duration;
            }
            time = Math.max(0, Math.min(duration, time));

            state.addKeyframe(clipId, track.property, time, kf.value, kf.easing);
        }
    }

    return true;
}

/* ════════════════════════════════════════
   4. 프리셋 → EditorCommand 배열 변환 (스크립트 자동화)
   ════════════════════════════════════════ */
export function presetToCommands(presetId: string, clipId: string): EditorCommand[] {
    const preset = getPresetById(presetId);
    if (!preset) return [];

    const state = useEditorStore.getState();
    let clip = null;
    for (const t of state.project.tracks) {
        clip = t.clips.find(c => c.id === clipId);
        if (clip) break;
    }
    if (!clip) return [];

    const duration = clip.duration;
    const span = preset.defaultSpan * duration;
    const commands: EditorCommand[] = [];

    for (const track of preset.tracks) {
        for (const kf of track.keyframes) {
            let time: number;
            if (preset.anchor === 'end') {
                time = duration - span + kf.position * span;
            } else if (preset.anchor === 'start') {
                time = kf.position * span;
            } else {
                time = kf.position * duration;
            }

            commands.push({
                id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                type: 'addKeyframe',
                category: 'keyframe',
                params: {
                    clipId,
                    property: track.property,
                    time: Math.max(0, Math.min(duration, time)),
                    value: kf.value,
                    easing: kf.easing,
                },
                timestamp: Date.now(),
                label: `키프레임: ${track.property} @ ${time.toFixed(2)}s`,
            });
        }
    }

    return commands;
}

/* ════════════════════════════════════════
   5. 프리셋 내보내기/가져오기 (JSON)
   ════════════════════════════════════════ */
export function exportPreset(id: string): string | null {
    const preset = getPresetById(id);
    if (!preset) return null;
    return JSON.stringify(preset, null, 2);
}

export function exportAllUserPresets(): string {
    const userOnly = _allPresets.filter(p => !p.builtin);
    return JSON.stringify(userOnly, null, 2);
}

export function importPresets(json: string): number {
    try {
        const data = JSON.parse(json);
        const presets: MotionPreset[] = Array.isArray(data) ? data : [data];
        let count = 0;
        for (const p of presets) {
            if (p.id && p.name && p.tracks) {
                const imported: MotionPreset = {
                    ...p,
                    id: `user.imported_${Date.now()}_${count}`,
                    builtin: false,
                    createdAt: Date.now(),
                };
                _allPresets.push(imported);
                count++;
            }
        }
        if (count > 0) _saveUserPresets();
        return count;
    } catch {
        return 0;
    }
}

/* ════════════════════════════════════════
   6. 상황별 프리셋 추천
   ════════════════════════════════════════ */
export function recommendPresets(context: PresetRecommendContext): MotionPreset[] {
    const difficultyOrder: Record<string, number> = {
        beginner: 0, intermediate: 1, advanced: 2, expert: 3,
    };
    const userLevel = difficultyOrder[context.skillLevel] ?? 1;

    return _allPresets
        .filter(p => {
            // 스킬 레벨 필터
            if (difficultyOrder[p.difficulty] > userLevel + 1) return false;
            // 장르 필터 (설정된 경우)
            if (context.genre && p.genres.length > 0 && !p.genres.includes(context.genre)) return false;
            return true;
        })
        .map(p => {
            let score = p.popularity;
            // 장르 매칭 보너스
            if (context.genre && p.genres.includes(context.genre)) score += 20;
            // 스킬 레벨 정확 매칭 보너스
            if (p.difficulty === context.skillLevel) score += 10;
            // 클립 위치 기반 보너스
            if (context.clipPosition < 0.1 && p.category === 'entrance') score += 15;
            if (context.clipPosition > 0.9 && p.category === 'exit') score += 15;
            if (!context.hasPrevClip && p.category === 'entrance') score += 10;
            if (!context.hasNextClip && p.category === 'exit') score += 10;
            return { preset: p, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map(item => item.preset);
}

/* 초기화 */
loadUserPresets();
