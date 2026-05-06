import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { authApi } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import type { LoginRequest, RegisterRequest } from "../types/auth";
import { extractApiError } from "../utils/apiError";

export function useAuth() {
	const navigate = useNavigate();
	const { setAuth, clearAuth } = useAuthStore();

	const loginMutation = useMutation({
		mutationFn: (data: LoginRequest) => authApi.login(data),
		onSuccess: (response) => {
			// Refresh token artık HttpOnly cookie içinde; store sadece access
			// token + user'ı tutar.
			setAuth(response.user, response.tokens.access_token);
			toast.success("Giriş başarılı");
			navigate("/");
		},
		onError: (error: unknown) => {
			toast.error(extractApiError(error) || "Giriş başarısız");
		},
	});

	const registerMutation = useMutation({
		mutationFn: (data: RegisterRequest) => authApi.register(data),
		onSuccess: (response) => {
			setAuth(response.user, response.tokens.access_token);
			toast.success("Kayıt başarılı");
			navigate("/");
		},
		onError: (error: unknown) => {
			toast.error(extractApiError(error) || "Kayıt başarısız");
		},
	});

	const logoutMutation = useMutation({
		mutationFn: () => authApi.logout(),
		onSuccess: () => {
			clearAuth();
			toast.success("Çıkış yapıldı");
			navigate("/login");
		},
	});

	return {
		login: loginMutation.mutate,
		register: registerMutation.mutate,
		logout: logoutMutation.mutate,
		isLoggingIn: loginMutation.isPending,
		isRegistering: registerMutation.isPending,
	};
}
