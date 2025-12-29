import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewMode = 'normal' | 'co-create' | 'co-read';

interface ViewModeState {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
}

export const useViewModeStore = create<ViewModeState>()(
  persist(
    (set) => ({
      mode: 'normal',
      setMode: (mode: ViewMode) => set({ mode }),
    }),
    {
      name: 'view-mode-settings',
    }
  )
);
