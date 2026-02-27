import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "cinnamiku" | "pro";
export type ThemeMode = "light" | "dark";

interface ThemeStore {
  themeName: ThemeName;
  themeMode: ThemeMode;
  setThemeName: (name: ThemeName) => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  applyTheme: () => void;
}

function applyThemeToDom(name: ThemeName, mode: ThemeMode) {
  const root = document.documentElement;
  root.setAttribute("data-theme", name);
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      themeName: "cinnamiku",
      themeMode:
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light",

      setThemeName: (name) => {
        set({ themeName: name });
        applyThemeToDom(name, get().themeMode);
      },

      setThemeMode: (mode) => {
        set({ themeMode: mode });
        applyThemeToDom(get().themeName, mode);
      },

      toggleMode: () => {
        const next = get().themeMode === "dark" ? "light" : "dark";
        set({ themeMode: next });
        applyThemeToDom(get().themeName, next);
      },

      applyTheme: () => {
        applyThemeToDom(get().themeName, get().themeMode);
      },
    }),
    {
      name: "nanonet-theme",
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeToDom(state.themeName, state.themeMode);
        }
      },
    }
  )
);
