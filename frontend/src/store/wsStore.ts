import { create } from 'zustand';

interface WSStore {
  isConnected: boolean;
  ws: WebSocket | null;
  setConnected: (isConnected: boolean) => void;
  setWS: (ws: WebSocket | null) => void;
}

export const useWSStore = create<WSStore>((set) => ({
  isConnected: false,
  ws: null,
  setConnected: (isConnected) => set({ isConnected }),
  setWS: (ws) => set({ ws }),
}));
