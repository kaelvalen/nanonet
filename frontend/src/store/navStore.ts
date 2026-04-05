import { create } from "zustand";

interface NavStore {
	// kept for backwards compat but no longer used
	navMode: "sidebar";
}

export const useNavStore = create<NavStore>()(() => ({
	navMode: "sidebar",
}));
