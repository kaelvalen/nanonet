import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/* aiAssistantStore — global open/close handle for the slide-in AI panel.

   The panel is rendered once at the layout level. Anything in the app can
   call `open()` (optionally with a seed query) to bring it forward. The
   CommandPalette `?` mode and the TopBar sparkle trigger both use this. */

export type AIAssistantMode = "chat" | "report";

export interface AIChatBubble {
	id: string;
	role: "ai" | "user";
	text: string;
	time: string;
}

export const AI_CHAT_DEFAULT_MESSAGE: AIChatBubble = {
	id: "init",
	role: "ai",
	text: "Selam — neye bakmamı istiyorsun? Sistem durumu, son anomaliler veya bir servis hakkında soru sorabilirsin.",
	time: "Şimdi",
};

const MAX_CHAT_MESSAGES = 120;

interface AIAssistantStore {
	isOpen: boolean;
	mode: AIAssistantMode;
	seed: string | null;
	chatByContext: Record<string, AIChatBubble[]>;
	open: (opts?: { mode?: AIAssistantMode; seed?: string }) => void;
	close: () => void;
	toggle: () => void;
	setMode: (mode: AIAssistantMode) => void;
	consumeSeed: () => string | null;
	getChatMessages: (contextKey: string) => AIChatBubble[];
	appendChatMessage: (contextKey: string, message: AIChatBubble) => void;
	resetChatMessages: (contextKey: string) => void;
}

export const useAIAssistantStore = create<AIAssistantStore>()(
	persist(
		(set, get) => ({
			isOpen: false,
			mode: "chat",
			seed: null,
			chatByContext: {},

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

			getChatMessages: (contextKey) => {
				const messages = get().chatByContext[contextKey];
				if (!messages || messages.length === 0) {
					return [AI_CHAT_DEFAULT_MESSAGE];
				}
				return messages;
			},

			appendChatMessage: (contextKey, message) =>
				set((state) => {
					const current = state.chatByContext[contextKey] ?? [AI_CHAT_DEFAULT_MESSAGE];
					return {
						chatByContext: {
							...state.chatByContext,
							[contextKey]: [...current, message].slice(-MAX_CHAT_MESSAGES),
						},
					};
				}),

			resetChatMessages: (contextKey) =>
				set((state) => ({
					chatByContext: {
						...state.chatByContext,
						[contextKey]: [AI_CHAT_DEFAULT_MESSAGE],
					},
				})),
		}),
		{
			name: "nanonet-ai-chat-session",
			version: 1,
			storage: createJSONStorage(() => sessionStorage),
			partialize: (state) => ({ chatByContext: state.chatByContext }),
		},
	),
);
