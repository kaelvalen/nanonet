import { create } from "zustand";
import type { User } from "../types/auth";

interface AuthStore {
	user: User | null;
	accessToken: string | null;
	isAuthenticated: boolean;
	isInitializing: boolean;
	setAuth: (user: User, accessToken: string) => void;
	clearAuth: () => void;
	updateUser: (user: User) => void;
	setInitializing: (value: boolean) => void;
}

/* Refresh token artık HttpOnly cookie'de — JS hiçbir şekilde okuyamaz, XSS
 * ile çalınamaz. Frontend tarafında tutmamız gereken tek şey UX için
 * minimum kullanıcı (e-mail/id) ve sayfa yenilemesinde refresh denemesi
 * yapmak için bir "muhtemelen oturumu var" sinyali. Bunu yine `auth_user`
 * altında saklayan kullanıcı objesi sağlıyor: localStorage'da varsa
 * AppInit cookie ile refresh deneyecek; yoksa direkt /login akışı.
 */
const AUTH_USER_KEY = "auth_user";
// Eski sürümlerde refresh token localStorage'a yazılıyordu; bunları
// yükseltme sırasında otomatik temizleyerek XSS yüzeyini hemen daraltıyoruz.
const LEGACY_REFRESH_KEY = "refresh_token";

if (typeof localStorage !== "undefined") {
	localStorage.removeItem(LEGACY_REFRESH_KEY);
}

const loadInitialUser = (): User | null => {
	if (typeof localStorage === "undefined") return null;
	const userJson = localStorage.getItem(AUTH_USER_KEY);
	if (!userJson) return null;
	try {
		return JSON.parse(userJson) as User;
	} catch {
		localStorage.removeItem(AUTH_USER_KEY);
		return null;
	}
};

const initialUser = loadInitialUser();

export const useAuthStore = create<AuthStore>((set) => ({
	user: initialUser,
	accessToken: null,
	isAuthenticated: false,
	// Initial restore: kullanıcı localStorage'da varsa cookie ile refresh
	// deneyeceğiz (AppInit). Yoksa hemen /login.
	isInitializing: !!initialUser,

	setAuth: (user, accessToken) => {
		try {
			localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
		} catch {
			/* quota / privacy mode — stored user kayıp olabilir, akışı kesme */
		}
		set({
			user,
			accessToken,
			isAuthenticated: true,
			isInitializing: false,
		});
	},

	clearAuth: () => {
		try {
			localStorage.removeItem(AUTH_USER_KEY);
			localStorage.removeItem(LEGACY_REFRESH_KEY);
		} catch {
			/* ignore */
		}
		set({
			user: null,
			accessToken: null,
			isAuthenticated: false,
			isInitializing: false,
		});
	},

	updateUser: (user) => {
		try {
			localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
		} catch {
			/* ignore */
		}
		set({ user });
	},
	setInitializing: (value) => set({ isInitializing: value }),
}));
