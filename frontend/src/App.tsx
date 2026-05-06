import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Component, type ReactNode, Suspense, useEffect } from "react";
import { RouterProvider } from "react-router";
import { FullScreenSpinner } from "@/components/FullScreenSpinner";
import { Toaster } from "@/components/ui/sonner";
import { authApi } from "./api/auth";
import { LiveRegionProvider } from "./context/LiveRegionContext";
import { preloadDashboardRoutes, router } from "./routes";
import { useA11yStore } from "./store/a11yStore";
import { useAuthStore } from "./store/authStore";
import { useThemeStore } from "./store/themeStore";

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

class ErrorBoundary extends Component<
	{ children: ReactNode },
	ErrorBoundaryState
> {
	constructor(props: { children: ReactNode }) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	render() {
		if (this.state.hasError) {
			return (
				<div
					className="min-h-screen flex items-center justify-center p-8"
					style={{
						background: "var(--surface-canvas)",
						color: "var(--text-primary)",
					}}
				>
					<div
						className="relative w-full max-w-md rounded-[6px] p-6 pl-7"
						style={{
							background: "var(--surface-base)",
							border: "1px solid var(--border-subtle)",
						}}
					>
						<span
							aria-hidden="true"
							className="absolute left-0 top-0 bottom-0 w-[2px]"
							style={{ background: "var(--status-down)" }}
						/>
						<p
							className="text-[10px] font-medium uppercase tracking-wider mb-2"
							style={{ color: "var(--status-down-text)" }}
						>
							Hata
						</p>
						<h1
							className="text-[18px] font-semibold mb-2"
							style={{ color: "var(--text-primary)" }}
						>
							Beklenmedik bir hata oluştu
						</h1>
						<p
							className="text-[13px] leading-relaxed mb-5"
							style={{ color: "var(--text-tertiary)" }}
						>
							{this.state.error?.message ?? "Bilinmeyen hata"}
						</p>
						<div className="flex gap-2">
							<button
								type="button"
								className="h-9 px-3 rounded-[6px] text-[13px] font-medium"
								style={{
									background: "var(--brand-primary)",
									color: "var(--brand-on-primary)",
								}}
								onClick={() => window.location.reload()}
							>
								Sayfayı yenile
							</button>
							<button
								type="button"
								className="h-9 px-3 rounded-[6px] text-[13px] font-medium"
								style={{
									background: "transparent",
									color: "var(--text-secondary)",
									border: "1px solid var(--border-default)",
								}}
								onClick={() => {
									window.location.href = "/";
								}}
							>
								Ana sayfaya dön
							</button>
						</div>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 1,
			refetchOnWindowFocus: false,
			staleTime: 30 * 1000,
		},
	},
});

function AppInit() {
	const {
		accessToken,
		setAuth,
		clearAuth,
		setInitializing,
		updateUser,
		user,
		isInitializing,
	} = useAuthStore();

	useEffect(() => {
		// localStorage'da kullanıcı yoksa muhtemelen oturum yoktur — refresh
		// denemeyi atla, hızlıca /login akışını aç. Eğer cookie hâlâ duruyorsa
		// bir sonraki login zaten yenisini set edecek.
		if (!user) {
			setInitializing(false);
			return;
		}

		if (accessToken) {
			setInitializing(false);
			return;
		}

		async function restoreSession() {
			try {
				// Refresh artık HttpOnly cookie üzerinden; gövde geçilmiyor.
				const res = await authApi.refresh();
				setAuth(
					user ?? { id: "", email: "", created_at: "", updated_at: "" },
					res.access_token,
				);
				const fetchedUser = await authApi.me();
				updateUser(fetchedUser);
			} catch {
				clearAuth();
			} finally {
				setInitializing(false);
			}
		}

		restoreSession();
	}, [accessToken, clearAuth, setAuth, setInitializing, updateUser, user]);

	if (isInitializing) {
		return <FullScreenSpinner />;
	}

	return null;
}

function ThemeInit() {
	const { applyTheme } = useThemeStore();
	useEffect(() => {
		applyTheme();
	}, [applyTheme]);
	return null;
}

function A11yInit() {
	const applyPreferences = useA11yStore((state) => state.applyPreferences);
	useEffect(() => {
		applyPreferences();
	}, [applyPreferences]);
	return null;
}

/* RoutePrefetch — once the user is signed in, warm every dashboard chunk in
   the background so navigation never waits on a network round-trip. We defer
   this work to requestIdleCallback so the initial render and first-paint
   network requests aren't starved; the setTimeout fallback covers Safari
   which still lacks rIC. We only kick this off once per session — repeat
   calls to preload are no-ops thanks to dynamic import deduping, but there's
   no point burning the cycles. */
function RoutePrefetch() {
	const isAuthed = useAuthStore((state) => Boolean(state.accessToken));
	useEffect(() => {
		if (!isAuthed) return;
		type IdleHandle = number;
		type IdleCallback = (deadline: { didTimeout: boolean }) => void;
		const win = window as typeof window & {
			requestIdleCallback?: (
				cb: IdleCallback,
				opts?: { timeout: number },
			) => IdleHandle;
			cancelIdleCallback?: (h: IdleHandle) => void;
		};
		const schedule =
			win.requestIdleCallback ??
			((cb: IdleCallback) =>
				window.setTimeout(() => cb({ didTimeout: false }), 1500));
		const cancel = win.cancelIdleCallback ?? window.clearTimeout;
		const handle = schedule(() => preloadDashboardRoutes(), { timeout: 4000 });
		return () => cancel(handle);
	}, [isAuthed]);
	return null;
}

export default function App() {
	return (
		<ErrorBoundary>
			<QueryClientProvider client={queryClient}>
				<LiveRegionProvider>
					<ThemeInit />
					<A11yInit />
					<AppInit />
					<RoutePrefetch />
					<Suspense fallback={<FullScreenSpinner />}>
						<RouterProvider router={router} />
					</Suspense>
					<Toaster
						position="top-right"
						toastOptions={{
							style: {
								borderRadius: "var(--radius)",
								border: "1px solid var(--toast-border)",
								background: "var(--toast-bg)",
								backdropFilter: "blur(8px)",
								fontSize: "12px",
								fontFamily: "var(--font-sans)",
								color: "var(--text-primary)",
							},
						}}
					/>
				</LiveRegionProvider>
			</QueryClientProvider>
		</ErrorBoundary>
	);
}
