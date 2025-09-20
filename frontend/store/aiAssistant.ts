import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AIAssistantState {
  isEnabled: boolean;
  toggleEnabled: () => void;
  setEnabled: (enabled: boolean) => void;
}

export const useAIAssistantStore = create<AIAssistantState>()(
  persist(
    (set) => ({
      isEnabled: true, // 默认开启
      toggleEnabled: () => set((state) => ({ isEnabled: !state.isEnabled })),
      setEnabled: (enabled: boolean) => set({ isEnabled: enabled }),
    }),
    {
      name: 'ai-assistant-settings',
    }
  )
);