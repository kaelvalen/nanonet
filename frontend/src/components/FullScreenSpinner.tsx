/* FullScreenSpinner — fallback used by App.tsx's outer Suspense for routes
   that mount/unmount the entire layout (landing, auth, error pages). It
   intentionally fills the viewport so it can't be confused with an empty
   page. For transitions WITHIN the dashboard layout, use RouteFallback —
   that one keeps the chrome (rail, topbar) intact. */

export function FullScreenSpinner() {
	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center"
			style={{ background: "var(--surface-canvas)" }}
		>
			<div
				className="h-6 w-6 rounded-full animate-spin"
				style={{
					border: "2px solid var(--border-subtle)",
					borderTopColor: "var(--brand-primary)",
				}}
				role="status"
				aria-label="Yükleniyor"
			/>
		</div>
	);
}

/* RouteFallback — quiet in-layout placeholder for lazy route transitions.
   Renders a small spinner centered in the available area so users see that
   something is happening without the visual noise of a full-screen overlay. */

export function RouteFallback() {
	return (
		<div
			className="flex-1 flex items-center justify-center min-h-[200px]"
			role="status"
			aria-label="Sayfa yükleniyor"
		>
			<div
				className="h-5 w-5 rounded-full animate-spin"
				style={{
					border: "2px solid var(--border-subtle)",
					borderTopColor: "var(--brand-primary)",
				}}
			/>
		</div>
	);
}
