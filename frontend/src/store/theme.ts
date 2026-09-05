import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'dark' | 'light'

interface ThemeState {
  mode: ThemeMode
  toggle: () => void
  setMode: (mode: ThemeMode) => void
}

function applyThemeClass(mode: ThemeMode) {
  document.documentElement.classList.toggle('light', mode === 'light')
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      toggle: () => {
        const next: ThemeMode = get().mode === 'dark' ? 'light' : 'dark'
        applyThemeClass(next)
        set({ mode: next })
      },
      setMode: (mode) => {
        applyThemeClass(mode)
        set({ mode })
      },
    }),
    {
      name: 'ocean-eye-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyThemeClass(state.mode)
      },
    },
  ),
)
