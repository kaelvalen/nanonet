import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import tr from "./locales/tr.json";

// i18next v23+ prints a "🌐 i18next is made possible by Locize" promo via
// console.log during init. There's no official option to disable it; patch
// console.log for the duration of init, then restore.
const _origLog = console.log;
// biome-ignore lint/suspicious/noExplicitAny: deliberate console patch
console.log = (...args: any[]) => {
	// i18next v23+ prints a promotional "Locize" message during init.
	// Filter by joining all args so multi-arg calls are also caught.
	const joined = args.map((a) => String(a ?? "")).join(" ");
	if (joined.includes("locize.com") || (joined.includes("i18next") && joined.includes("Locize"))) return;
	_origLog(...args);
};

i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources: {
			en: { translation: en },
			tr: { translation: tr },
		},
		fallbackLng: "en",
		defaultNS: "translation",
		interpolation: {
			escapeValue: false,
		},
		detection: {
			order: ["localStorage", "navigator"],
			caches: ["localStorage"],
		},
	});

// Restore original console.log after i18next has flushed all init logs.
// setTimeout(0) ensures async init callbacks also complete before restoring.
setTimeout(() => { console.log = _origLog; }, 0);

export default i18n;
