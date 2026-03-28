// src/App.tsx
import React from 'react';
import { EditorLayout } from '@/components/Layout/EditorLayout';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import { useAutoSave } from '@/hooks/useAutoSave';

export function App(): React.ReactElement {
  useNavigationGuard();
  useAutoSave();
  return <EditorLayout />;
}

export default App;
