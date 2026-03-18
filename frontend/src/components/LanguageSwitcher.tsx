import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useA11yStore } from "@/store/a11yStore";

export function LanguageSwitcher() {
	const { i18n } = useTranslation();
	const language = useA11yStore((state) => state.preferences.language);
	const setLanguage = useA11yStore((state) => state.setLanguage);

	const handleLanguageChange = (lang: "en" | "tr") => {
		i18n.changeLanguage(lang);
		setLanguage(lang);
	};

	return (
		<div className="flex items-center justify-between py-3 px-4 border-b border-border">
			<Label htmlFor="language-select" className="text-sm font-medium">
				{i18n.t("settings.language")}
			</Label>
			<Select
				value={language}
				onValueChange={(value) => handleLanguageChange(value as "en" | "tr")}
			>
				<SelectTrigger
					id="language-select"
					className="w-32"
					aria-label={i18n.t("settings.language")}
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="en">English</SelectItem>
					<SelectItem value="tr">Türkçe</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
}
