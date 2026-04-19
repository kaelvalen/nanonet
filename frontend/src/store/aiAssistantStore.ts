import { create } from "zustand";

/* aiAssistantStore — global open/close handle for the slide-in AI panel.

   The panel is rendered once at the layout level. Anything in the app can
   call `open()` (optionally with a seed query) to bring it forward. The
   CommandPalette `?` mode and the TopBar sparkle trigger both use this. */

export type AIAssistantMode = "chat" | "report";

interface AIAssistantStore {
	isOpen: boolean;
	mode: AIAssistantMode;
	seed: string | null;
	open: (opts?: { mode?: AIAssistantMode; seed?: string }) => void;
	close: () => void;
	toggle: () => void;
	setMode: (mode: AIAssistantMode) => void;
	consumeSeed: () => string | null;
}

export const useAIAssistantStore = create<AIAssistantStore>((set, get) => ({
	isOpen: false,
	mode: "chat",
	seed: null,

	open: (opts) =>
		set({
			isOpen: true,
			mode: opts?.mode ?? "chat",
			seed: opts?.seed ?? null,
		}),

	close: () => set({ isOpen: false, seed: null }),

	toggle: () => set((s) => ({ isOpen: !s.isOpen })),

	setMode: (mode) => set({ mode }),

	consumeSeed: () => {
		const seed = get().seed;
		if (seed != null) set({ seed: null });
		return seed;
	},
}));
