/* ─── src/lib/core/projectStorage.ts ─── */
/**
 * 프로젝트 저장/불러오기 엔진
 * 
 * - 자동 저장: 30초마다 IndexedDB에 저장
 * - 수동 저장: Ctrl+S → .badacut JSON 파일 다운로드
 * - 불러오기: .badacut 파일 열기
 * - 미디어 파일은 IndexedDB에 Blob으로 캐시
 */

import { useEditorStore } from '@/stores/editorStore';
import type { Project, Track, Asset, Marker, InOutRange, Transition } from '@/types/project';
import type { EffectInstance } from '@/types/effect';

/* ═══════ 상수 ═══════ */
const FORMAT_NAME = 'badacut';
const FORMAT_VERSION = '1.0.0';
const APP_VERSION = '0.1.0';
const AUTOSAVE_INTERVAL = 30_000;  // 30초
const IDB_NAME = 'badacut-studio';
const IDB_VERSION = 1;
const IDB_STORE_PROJECT = 'autosave';
const IDB_STORE_MEDIA = 'media-blobs';
const AUTOSAVE_KEY = 'latest';

/* ═══════ 프로젝트 파일 인터페이스 ═══════ */
export interface BadacutProjectFile {
  format: typeof FORMAT_NAME;
  version: string;
  savedAt: string;
  appVersion: string;
  project: Project;
  transitions: Transition[];
  effects: EffectInstance[];
  markers: Marker[];
  inOut: InOutRange;
  mediaManifest: MediaManifestEntry[];
}

interface MediaManifestEntry {
  assetId: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  idbKey?: string;
}

/* ═══════ IndexedDB 헬퍼 ═══════ */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_PROJECT)) {
        db.createObjectStore(IDB_STORE_PROJECT);
      }
      if (!db.objectStoreNames.contains(IDB_STORE_MEDIA)) {
        db.createObjectStore(IDB_STORE_MEDIA);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(storeName: string, key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

/* ═══════ 직렬화: Store → JSON ═══════ */
export function serializeProject(): BadacutProjectFile {
  const state = useEditorStore.getState();

  // Asset의 src가 Blob URL이면 저장 불가 → 원본 이름만 기록
  const mediaManifest: MediaManifestEntry[] = state.project.assets.map(a => ({
    assetId: a.id,
    originalName: a.name,
    mimeType: guessMediaType(a),
    fileSize: a.fileSize ?? 0,
    idbKey: `media-${a.id}`,
  }));

  return {
    format: FORMAT_NAME,
    version: FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    project: structuredCloneProject(state.project),
    transitions: JSON.parse(JSON.stringify(state.transitions)),
    effects: JSON.parse(JSON.stringify(state.effects)),
    markers: JSON.parse(JSON.stringify(state.markers)),
    inOut: { ...state.inOut },
    mediaManifest,
  };
}

function structuredCloneProject(p: Project): Project {
  return JSON.parse(JSON.stringify(p));
}

function guessMediaType(asset: Asset): string {
  const ext = asset.name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}

/* ═══════ 역직렬화: JSON → Store ═══════ */
export function deserializeProject(file: BadacutProjectFile): boolean {
  if (file.format !== FORMAT_NAME) {
    console.error('[projectStorage] 잘못된 파일 형식:', file.format);
    return false;
  }

  const state = useEditorStore.getState();

  // 프로젝트 복원
  useEditorStore.setState({
    project: file.project,
    transitions: file.transitions || [],
    effects: file.effects || [],
    markers: file.markers || [],
    inOut: file.inOut || { inPoint: null, outPoint: null },
    currentTime: 0,
    isPlaying: false,
    selectedClipId: null,
    undoStack: [],
    redoStack: [],
  });

  console.log('[projectStorage] 프로젝트 로드 완료:', file.project.name);
  return true;
}

/* ═══════ 자동 저장 (IndexedDB) ═══════ */
export async function autoSave(): Promise<void> {
  try {
    const data = serializeProject();
    await idbPut(IDB_STORE_PROJECT, AUTOSAVE_KEY, data);
    console.log('[autoSave] 저장 완료:', data.savedAt);
  } catch (err) {
    console.warn('[autoSave] 저장 실패:', err);
  }
}

export async function loadAutoSave(): Promise<BadacutProjectFile | null> {
  try {
    const data = await idbGet<BadacutProjectFile>(IDB_STORE_PROJECT, AUTOSAVE_KEY);
    if (data && data.format === FORMAT_NAME) {
      return data;
    }
  } catch (err) {
    console.warn('[autoSave] 로드 실패:', err);
  }
  return null;
}

/* ═══════ 미디어 Blob 캐시 (IndexedDB) ═══════ */
export async function saveMediaBlob(assetId: string, blob: Blob): Promise<void> {
  await idbPut(IDB_STORE_MEDIA, `media-${assetId}`, blob);
}

export async function loadMediaBlob(assetId: string): Promise<Blob | null> {
  try {
    const blob = await idbGet<Blob>(IDB_STORE_MEDIA, `media-${assetId}`);
    return blob ?? null;
  } catch {
    return null;
  }
}

/* ═══════ 수동 저장: .badacut 파일 다운로드 ═══════ */
export function saveProjectToFile(): void {
  const data = serializeProject();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.project.name || 'project'}.badacut`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('[projectStorage] 파일 저장:', a.download);
}

/* ═══════ 파일 열기: .badacut 파일 로드 ═══════ */
export function openProjectFile(): Promise<boolean> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.badacut,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { resolve(false); return; }

      try {
        const text = await file.text();
        const data = JSON.parse(text) as BadacutProjectFile;
        const ok = deserializeProject(data);
        resolve(ok);
      } catch (err) {
        console.error('[projectStorage] 파일 파싱 실패:', err);
        alert('프로젝트 파일을 읽을 수 없습니다.');
        resolve(false);
      }
    };
    input.click();
  });
}

/* ═══════ 자동 저장 타이머 ═══════ */
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoSave(): void {
  if (autoSaveTimer) return;
  autoSaveTimer = setInterval(autoSave, AUTOSAVE_INTERVAL);
  console.log(`[autoSave] 시작 (${AUTOSAVE_INTERVAL / 1000}초 간격)`);
}

export function stopAutoSave(): void {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}

/* ═══════ 변경 감지 (dirty flag) ═══════ */
let lastSavedHash = '';

export function markSaved(): void {
  lastSavedHash = computeHash();
}

export function isDirty(): boolean {
  return computeHash() !== lastSavedHash;
}

function computeHash(): string {
  const state = useEditorStore.getState();
  // 간단한 해시: tracks + transitions + effects의 JSON 길이 기반
  const str = JSON.stringify({
    t: state.project.tracks,
    tr: state.transitions,
    e: state.effects,
  });
  // 간단한 해시 (32비트)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return hash.toString(36);
}
