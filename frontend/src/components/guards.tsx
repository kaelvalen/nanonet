import { Navigate, useParams } from "react-router";
import { FullScreenSpinner } from "@/components/FullScreenSpinner";
import { useAuthStore } from "@/store/authStore";

export function AuthGuard({ children }: { children: React.ReactNode }) {
	const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
	const isInitializing = useAuthStore((s) => s.isInitializing);

	if (isInitializing) {
		return <FullScreenSpinner />;
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" replace />;
	}

	return <>{children}</>;
}

export function GuestGuard({ children }: { children: React.ReactNode }) {
	const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
	const isInitializing = useAuthStore((s) => s.isInitializing);

	if (isInitializing) {
		return <FullScreenSpinner />;
	}

	if (isAuthenticated) {
		return <Navigate to="/app" replace />;
	}

	return <>{children}</>;
}

export function ServicesRedirect() {
	const { serviceId } = useParams();
	return <Navigate to={`/app/services/${serviceId}`} replace />;
}
