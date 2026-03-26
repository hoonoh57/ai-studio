# AI-Studio — Project Context

## What is this?
AI-powered video editor. Web-first (Electron later if needed).
Target: 1-person YouTube/SNS creators who want pro-level editing without learning curve.

## Tech Stack
- TypeScript 5.5+, React 19, Vite 6, Zustand 5
- CSS Modules + CSS custom properties (design tokens)
- Vitest + React Testing Library
- Canvas 2D for timeline, WebGPU for preview (fallback: Canvas 2D)
- Web Audio API
- FFmpeg-WASM for export (native FFmpeg via Electron if performance insufficient)

## Screens
- S00: AI Creator — prompt-based auto video generation
- S01: Home — project list, new/open/template
- S02: Editor — main workspace (5 panels below)
- S03: Color — color grading tab within editor
- S04: Audio — audio mixing tab within editor
- S05: AI Workflow — AI tools tab within editor
- S06: Export — render settings + progress
- S07: Settings — app preferences
- S08: Privacy — data/privacy controls

## Editor Layout (S02) — 1920x1080 reference
┌─────────────────────────────────────────────────┐ │ TabBar (40px) [Edit][Color][Audio][AI][Export] │ ├────────────┬──────────────────┬─────────────────┤ │ MediaLib │ Preview │ Properties │ │ (280px) │ (flex) │ (300px) │ │ │ │ │ ├────────────┴──────────────────┴─────────────────┤ │ Timeline (300px height) │ │ - Track headers (left 200px) + clips (scroll) │ └─────────────────────────────────────────────────┘


## Coding Rules (non-negotiable)
- File ≤ 300 lines, function ≤ 40 lines, component ≤ 200 lines
- Named exports only (no export default)
- PascalCase: components/files, camelCase: functions/utils, UPPER_SNAKE: constants
- No `any`, no `as` type assertion, no `!` non-null assertion
- No console.log in commits, no inline styles, no magic numbers
- CSS Modules only (.module.css), design tokens via CSS custom properties
- Import order: react → external → lib → stores → components → types → relative → styles
- Zustand: single store, slice pattern, immer middleware
- Pure functions in src/lib/core/ — no side effects, no state
- State only in src/stores/ — delegates logic to core functions

## Directory Structure
src/ ├─ components/ # React components by feature │ ├─ common/ # Button, Slider, Icon, etc. │ ├─ Layout/ # EditorShell, TabBar, PanelContainer │ ├─ Timeline/ # Timeline, Track, Clip, Playhead │ ├─ Preview/ # PreviewCanvas, TransportControls │ ├─ MediaLibrary/ # AssetGrid, AssetCard, ImportButton │ ├─ Properties/ # PropertyPanel, PropertyField │ ├─ Home/ # ProjectList, NewProjectDialog │ ├─ AICreator/ # PromptInput, StoryboardView │ └─ Export/ # ExportSettings, ProgressBar ├─ stores/ # Zustand slices ├─ lib/ │ └─ core/ # Pure utility functions ├─ types/ # Shared TypeScript types ├─ styles/ # tokens.css, global.css ├─ hooks/ # Custom React hooks └─ App.tsx


## Current Phase
UI Shell → fill with real functionality one by one.
Types, stores, utils are created as needed during implementation.

## Decision Log
- 2026-03-26: Dropped 6 over-engineered docs. Keep only CLAUDE.md + 3 slim docs.
- 2026-03-26: UI-first approach. No bottom-up type/store/util scaffolding.
- 2026-03-26: WebGPU/FFmpeg issues → decide when we hit them, not now.
- 2026-03-26: Module projects (MP-01~08) deferred. Master builds everything first.