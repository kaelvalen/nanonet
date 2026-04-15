import { useEffect, useState } from "react";

export function useOnlineStatus() {
	const [isOnline, setIsOnline] = useState<boolean>(() => {
		if (typeof navigator !== "undefined") {
			return navigator.onLine;
		}
		return true;
	});

	const [since, setSince] = useState<Date | null>(null);

	useEffect(() => {
		const handleOnline = () => {
			setIsOnline(true);
			setSince(new Date());
		};

		const handleOffline = () => {
			setIsOnline(false);
			setSince(new Date());
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	return { isOnline, since };
}
