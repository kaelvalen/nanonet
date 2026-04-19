import { lazy, Suspense, useEffect, useState } from "react";
import { useAIAssistantStore } from "@/store/aiAssistantStore";

/* AIAssistantHost — keeps the heavy AIAssistant chunk (react-markdown +
   remark-gfm + AnimatePresence) out of the dashboard layout's eager bundle.

   Strategy: subscribe to the global store. The first time `isOpen` flips to
   true we lazy-load the panel and keep it mounted thereafter so subsequent
   open/close cycles run instantly and preserve the slide-in/out animation.

   Trade-off: the very first open shows nothing for ~1 frame while the chunk
   is fetched. We deliberately skip a fallback skeleton — a flash would look
   worse than the brief gap, and the chunk is small enough (gzipped ≈ 30 KB)
   to land within a single RTT for typical connections. */

const AIAssistant = lazy(() =>
	import("./AIAssistant").then((m) => ({ default: m.AIAssistant })),
);

export function AIAssistantHost() {
	const isOpen = useAIAssistantStore((s) => s.isOpen);
	const [hasOpened, setHasOpened] = useState(false);

	useEffect(() => {
		if (isOpen && !hasOpened) setHasOpened(true);
	}, [isOpen, hasOpened]);

	if (!hasOpened) return null;

	return (
		<Suspense fallback={null}>
			<AIAssistant />
		</Suspense>
	);
}
