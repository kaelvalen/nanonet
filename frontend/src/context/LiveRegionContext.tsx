import { createContext, useCallback, useContext, useState } from "react";

interface Announcement {
	id: string;
	message: string;
	type: "polite" | "assertive";
	timestamp: number;
}

interface LiveRegionContextType {
	announce: (message: string, type?: "polite" | "assertive") => void;
	assertiveAnnounce: (message: string) => void;
}

const LiveRegionContext = createContext<LiveRegionContextType | undefined>(
	undefined,
);

export function LiveRegionProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [announcements, setAnnouncements] = useState<Announcement[]>([]);

	const announce = useCallback(
		(message: string, type: "polite" | "assertive" = "polite") => {
			const id = `announcement-${Date.now()}-${Math.random()}`;
			const announcement: Announcement = {
				id,
				message,
				type,
				timestamp: Date.now(),
			};

			setAnnouncements((prev) => [...prev, announcement]);

			// Remove announcement after it's been announced
			setTimeout(() => {
				setAnnouncements((prev) => prev.filter((a) => a.id !== id));
			}, 6000);
		},
		[],
	);

	const assertiveAnnounce = useCallback(
		(message: string) => {
			announce(message, "assertive");
		},
		[announce],
	);

	return (
		<LiveRegionContext.Provider value={{ announce, assertiveAnnounce }}>
			{children}

			{/* Polite live region - for non-urgent announcements */}
			<div
				role="status"
				aria-live="polite"
				aria-atomic="true"
				className="sr-only"
				id="live-region-polite"
			>
				{announcements
					.filter((a) => a.type === "polite")
					.map((a) => a.message)
					.join(". ")}
			</div>

			{/* Assertive live region - for urgent announcements */}
			<div
				role="alert"
				aria-live="assertive"
				aria-atomic="true"
				className="sr-only"
				id="live-region-assertive"
			>
				{announcements
					.filter((a) => a.type === "assertive")
					.map((a) => a.message)
					.join(". ")}
			</div>
		</LiveRegionContext.Provider>
	);
}

/**
 * Hook to use live region announcements
 * Usage: const { announce } = useLiveRegion();
 *        announce("Settings saved successfully");
 */
export function useLiveRegion() {
	const context = useContext(LiveRegionContext);
	if (!context) {
		throw new Error("useLiveRegion must be used within LiveRegionProvider");
	}
	return context;
}
