import { create } from "zustand";

interface WSStore {
	isConnected: boolean;
	reconnectCount: number;
	lastMessageTime: number | null;
	lastError: string | null;
	setConnected: (isConnected: boolean) => void;
	incrementReconnect: () => void;
	resetReconnect: () => void;
	setLastMessageTime: (time: number) => void;
	setLastError: (error: string | null) => void;
}

export const useWSStore = create<WSStore>((set) => ({
	isConnected: false,
	reconnectCount: 0,
	lastMessageTime: null,
	lastError: null,
	setConnected: (isConnected) => set({ isConnected }),
	incrementReconnect: () =>
		set((state) => ({ reconnectCount: state.reconnectCount + 1 })),
	resetReconnect: () => set({ reconnectCount: 0 }),
	setLastMessageTime: (time) => set({ lastMessageTime: time }),
	setLastError: (error) => set({ lastError: error }),
}));
