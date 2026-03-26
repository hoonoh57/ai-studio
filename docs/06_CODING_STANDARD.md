# Coding Standard

## Size Limits
- File ≤ 300 lines | Function ≤ 40 lines | Component ≤ 200 lines
- Named exports ≤ 10 per file | Props ≤ 8 | Params ≤ 5

## Naming
- PascalCase: component files & names
- camelCase: functions, variables, hooks (useXxx)
- UPPER_SNAKE_CASE: constants
- *.module.css for styles, *.test.ts for tests

## Banned
`any`, `as`, `!`, `export default`, `var`, `console.log`, inline styles, magic numbers

## Architecture Layers
1. **Pure (src/lib/core/)** — no side effects, no imports from stores/components
2. **State (src/stores/)** — Zustand slices, calls pure functions for logic
3. **UI (src/components/)** — reads store via hooks, calls actions, renders

Flow: UI → State → Pure. Never reverse.

## Import Order
react → external libs → lib/core → stores → components → types → relative → styles

## Styling
CSS Modules + design tokens in src/styles/tokens.css. No inline, no Tailwind.

## Testing
Core functions: 100% coverage. Stores: integration tests. UI: smoke tests.
