import { useEffect } from "react";
import { useA11yStore } from "@/store/a11yStore";

export function useA11y() {
	const preferences = useA11yStore((state) => state.preferences);
	const applyPreferences = useA11yStore((state) => state.applyPreferences);

	// Apply preferences on mount and when they change
	useEffect(() => {
		applyPreferences();
	}, [preferences, applyPreferences]);

	return preferences;
}

// Hook to apply skip link functionality
export function useSkipLink() {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "s" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
				e.preventDefault();
				const mainContent = document.getElementById("main-content");
				if (mainContent) {
					mainContent.focus();
					mainContent.scrollIntoView({ behavior: "smooth" });
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);
}
