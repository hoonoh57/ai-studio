/* ─── src/engines/hubRegistry.ts ─── */
/* 아키텍처 헌법 축3: HubModule 등록·검색·관리 */

import type {
    HubModule, HubCategory, IHubRegistry, FavoriteEntry,
} from '@/types/hub';
import type { SkillLevel } from '@/types/project';

/* ═══════════════════════════════════════════
   스킬 레벨 순서 (비교용)
   ═══════════════════════════════════════════ */
const SKILL_ORDER: Record<SkillLevel, number> = {
    beginner: 0,
    intermediate: 1,
    advanced: 2,
    expert: 3,
};

function skillAtLeast(current: SkillLevel, minimum: SkillLevel): boolean {
    return SKILL_ORDER[current] >= SKILL_ORDER[minimum];
}

/* ═══════════════════════════════════════════
   Registry 구현
   ═══════════════════════════════════════════ */
const registry = new Map<string, HubModule>();

export const hubRegistry: IHubRegistry = {

    register(module: HubModule): void {
        if (registry.has(module.id)) {
            console.warn(`[HubRegistry] overwriting: ${module.id}`);
        }
        registry.set(module.id, module);
    },

    get(id: string): HubModule | undefined {
        return registry.get(id);
    },

    list(category?: HubCategory): HubModule[] {
        const all = Array.from(registry.values());
        if (!category) return all;
        return all.filter(m => m.category === category);
    },

    listForSkill(skillLevel: SkillLevel, category?: HubCategory): HubModule[] {
        return this.list(category).filter(m =>
            skillAtLeast(skillLevel, m.minSkillLevel),
        );
    },

    search(query: string, skillLevel?: SkillLevel): HubModule[] {
        const q = query.toLowerCase().trim();
        if (!q) return skillLevel ? this.listForSkill(skillLevel) : this.list();

        const base = skillLevel ? this.listForSkill(skillLevel) : this.list();
        return base.filter(m =>
            m.name.toLowerCase().includes(q)
            || m.searchKeywords.some(k => k.toLowerCase().includes(q))
            || (m.description ?? '').toLowerCase().includes(q),
        );
    },

    categories(): HubCategory[] {
        const cats = new Set<HubCategory>();
        registry.forEach(m => cats.add(m.category));
        return Array.from(cats);
    },

    getDefaultFavorites(skillLevel: SkillLevel): FavoriteEntry[] {
        return this.listForSkill(skillLevel)
            .filter(m => m.defaultFavorite === true)
            .sort((a, b) => (a.defaultOrder ?? 99) - (b.defaultOrder ?? 99))
            .map((m, i) => ({ moduleId: m.id, order: m.defaultOrder ?? i }));
    },
};

/* ═══════════════════════════════════════════
   편의 함수
   ═══════════════════════════════════════════ */

/** 여러 모듈을 한 번에 등록 */
export function registerModules(modules: HubModule[]): void {
    modules.forEach(m => hubRegistry.register(m));
}

/** 등록 현황 로깅 (개발용) */
export function logRegistryStatus(): void {
    const all = hubRegistry.list();
    const byCat = new Map<HubCategory, number>();
    all.forEach(m => {
        byCat.set(m.category, (byCat.get(m.category) ?? 0) + 1);
    });
    console.log(
        `[HubRegistry] ${all.length} modules:`,
        Object.fromEntries(byCat),
    );
}

export { hubRegistry as default };
