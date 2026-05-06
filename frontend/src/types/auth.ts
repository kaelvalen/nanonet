export interface User {
	id: string;
	email: string;
	created_at: string;
	updated_at: string;
}

export interface LoginRequest {
	email: string;
	password: string;
}

export interface RegisterRequest {
	email: string;
	password: string;
}

export interface TokenResponse {
	access_token: string;
	expires_in: number;
}

export interface AuthResponse {
	user: User;
	tokens: TokenResponse;
	/** Server CSRF token — frontend bunu cookie'den de okuyabilir; ilk
	 * render'da yine de explicit olarak göndermesi UX kolaylığı. */
	csrf_token?: string;
}
