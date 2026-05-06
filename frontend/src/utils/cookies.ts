/** readCookie — `document.cookie` üzerinden bir cookie değerini okur.
 *  Bulunamazsa `null` döner. SSR tarafında çalışırken `document` yoksa
 *  yine `null` (no-op).
 *
 *  HttpOnly cookie'leri okuyamayacağımızı unutma (refresh cookie buradan
 *  çıkmaz, ki amaç da bu). Yalnızca CSRF gibi JS-erişimli cookie'ler için.
 */
export function readCookie(name: string): string | null {
	if (typeof document === "undefined") return null;
	const target = `${encodeURIComponent(name)}=`;
	for (const part of document.cookie.split(";")) {
		const trimmed = part.trim();
		if (trimmed.startsWith(target)) {
			return decodeURIComponent(trimmed.slice(target.length));
		}
	}
	return null;
}
