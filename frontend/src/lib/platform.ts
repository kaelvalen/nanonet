/* Platform tespiti — klavye kısayolu rozetlerini doğru göstermek için.
 *
 * Komut paleti vb. kısayollar hem Cmd (mac) hem Ctrl (Windows/Linux) ile
 * çalışır (bkz. CommandPalette: e.metaKey || e.ctrlKey). Bu yüzden UI'da
 * gösterilen tuş etiketi platforma göre seçilmelidir; Windows'ta Apple ⌘
 * işareti yanıltıcıdır.
 */

function detectMac(): boolean {
	if (typeof navigator === "undefined") return false;
	// userAgentData modern API; tip tanımlarında olmayabilir, güvenli oku.
	const uaData = (navigator as { userAgentData?: { platform?: string } })
		.userAgentData;
	const platform = uaData?.platform || navigator.platform || navigator.userAgent;
	return /mac|iphone|ipad|ipod/i.test(platform);
}

export const IS_MAC = detectMac();

/** Değiştirici tuş etiketi: mac'te "⌘", diğerlerinde "Ctrl ".
 *  Birleştirildiğinde "⌘K" / "Ctrl K", "⌘\" / "Ctrl \" üretir. */
export const MOD_KEY = IS_MAC ? "⌘" : "Ctrl ";
