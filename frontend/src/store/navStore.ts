import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NavMode = "sidebar" | "floating";

interface NavStore {
  navMode: NavMode;
  setNavMode: (mode: NavMode) => void;
  toggleNavMode: () => void;
}

export const useNavStore = create<NavStore>()(
  persist(
    (set, get) => ({
      navMode: "sidebar",
      setNavMode: (mode) => set({ navMode: mode }),
      toggleNavMode: () =>
        set({ navMode: get().navMode === "sidebar" ? "floating" : "sidebar" }),
    }),
    { name: "nanonet-nav-mode" }
  )
);
