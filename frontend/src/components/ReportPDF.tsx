import jsPDF from "jspdf";
import type { ReportResult } from "@/api/metrics";

function tr(s: string): string {
	if (!s) return "";
	return s
		.replace(/ş/g, "s").replace(/Ş/g, "S")
		.replace(/ğ/g, "g").replace(/Ğ/g, "G")
		.replace(/ü/g, "u").replace(/Ü/g, "U")
		.replace(/ç/g, "c").replace(/Ç/g, "C")
		.replace(/ö/g, "o").replace(/Ö/g, "O")
		.replace(/ı/g, "i").replace(/İ/g, "I");
}

const M = 20;
const PW = 210;
const CW = PW - M * 2;
const LINE = 4.8;

const SCORE_RGB: Record<string, [number, number, number]> = {
	SAGLIKLI: [22, 163, 74],
	DIKKAT:   [217, 119, 6],
	KRITIK:   [220, 38, 38],
};

const SCORE_BG_RGB: Record<string, [number, number, number]> = {
	SAGLIKLI: [240, 253, 244],
	DIKKAT:   [255, 251, 235],
	KRITIK:   [254, 242, 242],
};

const CAT_RGB: Record<string, [number, number, number]> = {
	tamamlandi:       [22, 163, 74],
	mudahale_gerekli: [220, 38, 38],
	izleniyor:        [217, 119, 6],
	trend:            [124, 58, 237],
};

const CAT_BG_RGB: Record<string, [number, number, number]> = {
	tamamlandi:       [240, 253, 244],
	mudahale_gerekli: [254, 242, 242],
	izleniyor:        [255, 251, 235],
	trend:            [245, 243, 255],
};

const CAT_LABEL: Record<string, string> = {
	tamamlandi:       "TAMAMLANDI",
	mudahale_gerekli: "MUDAHALE GEREKLI",
	izleniyor:        "IZLENIYOR",
	trend:            "TREND",
};

const PRI_RGB: Record<string, [number, number, number]> = {
	high:   [220, 38, 38],
	medium: [217, 119, 6],
	low:    [22, 163, 74],
};

const PRI_BG_RGB: Record<string, [number, number, number]> = {
	high:   [254, 242, 242],
	medium: [255, 251, 235],
	low:    [240, 253, 244],
};

const PRI_LABEL: Record<string, string> = {
	high:   "YUKSEK",
	medium: "ORTA",
	low:    "DUSUK",
};

function setFont(pdf: jsPDF, bold: boolean) {
	pdf.setFont("helvetica", bold ? "bold" : "normal");
}

function setRGB(pdf: jsPDF, rgb: [number, number, number]) {
	pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function pill(
pdf: jsPDF,
text: string,
x: number,
y: number,
fg: [number, number, number],
bg: [number, number, number],
) {
	pdf.setFontSize(7);
	setFont(pdf, true);
	const tw = pdf.getTextWidth(text);
	const ph = 4.5;
	const pw = tw + 6;
	pdf.setFillColor(bg[0], bg[1], bg[2]);
	pdf.roundedRect(x, y - 3.2, pw, ph, 1, 1, "F");
	setRGB(pdf, fg);
	pdf.text(text, x + 3, y);
	return pw;
}

function multiLine(
pdf: jsPDF,
text: string,
x: number,
y: number,
maxW: number,
): number {
	const lines = pdf.splitTextToSize(text, maxW);
	pdf.text(lines, x, y);
	return y + lines.length * LINE;
}

function checkPage(pdf: jsPDF, y: number, need = 14): number {
	if (y + need > 278) {
		pdf.addPage();
		return 22;
	}
	return y;
}

function divider(pdf: jsPDF, y: number): number {
	pdf.setDrawColor(229, 231, 235);
	pdf.line(M, y, M + CW, y);
	return y + 5;
}

function sectionHeader(pdf: jsPDF, y: number, label: string): number {
	y = checkPage(pdf, y, 14);
	pdf.setFontSize(7.5);
	setFont(pdf, true);
	pdf.setTextColor(156, 163, 175);
	pdf.text(label, M, y);
	y += 1.5;
	pdf.setDrawColor(243, 244, 246);
	pdf.line(M, y, M + CW, y);
	return y + 6;
}

export function downloadReportPDF(report: ReportResult): void {
	const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
	let y = 0;

	// ── HEADER BAND ─────────────────────────────────────────────
	const scoreKey = tr(report.system_score).toUpperCase();
	const scoreRGB = SCORE_RGB[scoreKey] ?? SCORE_RGB["DIKKAT"];
	const scoreBgRGB = SCORE_BG_RGB[scoreKey] ?? SCORE_BG_RGB["DIKKAT"];

	pdf.setFillColor(scoreRGB[0], scoreRGB[1], scoreRGB[2]);
	pdf.rect(0, 0, PW, 12, "F");
	pdf.setFontSize(7.5);
	setFont(pdf, true);
	pdf.setTextColor(255, 255, 255);
	pdf.text("NANONET  /  OPERASYONEL RAPOR", M, 7.5);

	const scoreLabel = tr(report.system_score).toUpperCase();
	const scoreLabelW = pdf.getTextWidth(scoreLabel) + 8;
	pdf.setFillColor(255, 255, 255, 0.25);
	pdf.roundedRect(PW - M - scoreLabelW, 4, scoreLabelW, 5.5, 1, 1, "F");
	setRGB(pdf, scoreRGB);
	pdf.text(scoreLabel, PW - M - scoreLabelW / 2, 7.5, { align: "center" });

	y = 20;

	// ── HEADLINE ────────────────────────────────────────────────
	pdf.setFontSize(15);
	setFont(pdf, true);
	pdf.setTextColor(17, 24, 39);
	y = multiLine(pdf, tr(report.headline), M, y, CW);
	y += 3;

	// Stats row
	pdf.setFontSize(8);
	setFont(pdf, true);
	const now = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

	let sx = M;
	// critical chip
	pdf.setFillColor(254, 242, 242);
	pdf.roundedRect(sx, y - 3.5, 32, 5.5, 1.5, 1.5, "F");
	pdf.setTextColor(220, 38, 38);
	pdf.text(`${report.critical_events} kritik`, sx + 3, y);
	sx += 35;

	// resolved chip
	pdf.setFillColor(240, 253, 244);
	pdf.roundedRect(sx, y - 3.5, 32, 5.5, 1.5, 1.5, "F");
	pdf.setTextColor(22, 163, 74);
	pdf.text(`${report.resolved_events} cozuldu`, sx + 3, y);
	sx += 35;

	// period chip
	pdf.setFillColor(249, 250, 251);
	pdf.roundedRect(sx, y - 3.5, 38, 5.5, 1.5, 1.5, "F");
	pdf.setTextColor(55, 65, 81);
	pdf.text(tr(report.period_label), sx + 3, y);

	y += 10;
	pdf.setDrawColor(229, 231, 235);
	pdf.line(M, y, M + CW, y);
	y += 8;

	// ── EVENTS ──────────────────────────────────────────────────
	if (report.events.length > 0) {
		y = sectionHeader(pdf, y, "DONEM OLAYLARI");

		for (const ev of report.events) {
			// estimate card height
			const obsLines = pdf.splitTextToSize(tr(ev.observation), CW - 8).length;
			const needH = 10 + obsLines * LINE + 4 * LINE + 12;
			y = checkPage(pdf, y, needH);

			const cardX = M;
			const cardStartY = y - 2;

			// category key normalise
			const catRaw = tr(ev.category).toLowerCase().replace(/\s/g, "_");
			const catRGB = CAT_RGB[catRaw] ?? [107, 114, 128];
			const catBgRGB = CAT_BG_RGB[catRaw] ?? [249, 250, 251];
			const catLabel = CAT_LABEL[catRaw] ?? catRaw.toUpperCase();

			// card head background
			pdf.setFillColor(249, 250, 251);
			pdf.roundedRect(cardX, cardStartY, CW, 8, 2, 2, "F");
			pdf.setDrawColor(229, 231, 235);
			pdf.roundedRect(cardX, cardStartY, CW, 8, 2, 2, "S");

			// category pill
			y = cardStartY + 5.5;
			const pillW = pill(pdf, catLabel, cardX + 4, y, catRGB, catBgRGB);

			// service + time (right)
			pdf.setFontSize(7.5);
			setFont(pdf, true);
			pdf.setTextColor(107, 114, 128);
			const metaText = `${tr(ev.service)}  /  ${tr(ev.time)}`;
			pdf.text(metaText, cardX + CW - 4, y, { align: "right" });

			y = cardStartY + 11;

			// card body border
			const bodyStartY = y - 1;

			// observation
			pdf.setFontSize(10);
			setFont(pdf, true);
			pdf.setTextColor(17, 24, 39);
			y = multiLine(pdf, tr(ev.observation), cardX + 4, y, CW - 8);
			y += 2;

			// detail rows
			const rows: Array<{ label: string; value: string; green?: boolean }> = [
				{ label: "Neden:", value: tr(ev.root_cause) },
			];
			if (ev.impact) rows.push({ label: "Etki:", value: tr(ev.impact) });
			if (ev.action) rows.push({ label: "Aksiyon:", value: tr(ev.action) });
			if (ev.outcome) rows.push({ label: "Sonuc:", value: tr(ev.outcome), green: true });

			for (const row of rows) {
				y = checkPage(pdf, y, 8);
				pdf.setFontSize(8);
				setFont(pdf, true);
				pdf.setTextColor(107, 114, 128);
				pdf.text(row.label, cardX + 4, y);

				setFont(pdf, false);
				pdf.setTextColor(row.green ? 22 : 55, row.green ? 163 : 65, row.green ? 74 : 81);
				y = multiLine(pdf, row.value, cardX + 22, y, CW - 26);
			}

			// draw card body border now we know height
			pdf.setDrawColor(229, 231, 235);
			pdf.line(cardX, bodyStartY, cardX, y + 2);
			pdf.line(cardX + CW, bodyStartY, cardX + CW, y + 2);
			pdf.line(cardX, y + 2, cardX + CW, y + 2);

			y += 7;
		}
	}

	// ── ACTIONS ─────────────────────────────────────────────────
	if (report.actions.length > 0) {
		y = sectionHeader(pdf, y, "ONERILEN AKSIYONLAR");

		report.actions.forEach((action, i) => {
			y = checkPage(pdf, y, 12);
			const priRGB = PRI_RGB[action.priority] ?? [107, 114, 128];
			const priBgRGB = PRI_BG_RGB[action.priority] ?? [249, 250, 251];
			const priLabel = PRI_LABEL[action.priority] ?? action.priority.toUpperCase();

			pdf.setFontSize(8);
			setFont(pdf, true);
			pdf.setTextColor(156, 163, 175);
			pdf.text(`${i + 1}.`, M, y);

			pill(pdf, priLabel, M + 6, y, priRGB, priBgRGB);
			const pillW2 = pdf.getTextWidth(priLabel) + 6 + 6;

			pdf.setFontSize(9);
			setFont(pdf, true);
			pdf.setTextColor(17, 24, 39);
			y = multiLine(pdf, tr(action.action), M + 6 + pillW2 + 3, y, CW - 6 - pillW2 - 3);

			if (action.estimated_impact) {
				pdf.setFontSize(8);
				setFont(pdf, false);
				pdf.setTextColor(107, 114, 128);
				y = multiLine(pdf, tr(action.estimated_impact), M + 6 + pillW2 + 3, y, CW - 6 - pillW2 - 3);
			}
			y += 3;
			pdf.setDrawColor(243, 244, 246);
			pdf.line(M, y, M + CW, y);
			y += 4;
		});
	}

	// ── RISK FORECAST ───────────────────────────────────────────
	if (report.risk_forecast) {
		const riskLines = pdf.splitTextToSize(tr(report.risk_forecast), CW - 10).length;
		const boxH = riskLines * LINE + 14;
		y = checkPage(pdf, y, boxH + 6);
		y += 4;

		pdf.setFillColor(245, 243, 255);
		pdf.roundedRect(M, y, CW, boxH, 3, 3, "F");
		pdf.setDrawColor(221, 214, 254);
		pdf.roundedRect(M, y, CW, boxH, 3, 3, "S");

		pdf.setFontSize(7.5);
		setFont(pdf, true);
		pdf.setTextColor(124, 58, 237);
		pdf.text("7 GUNLUK RISK TAHMINI", M + 5, y + 6);

		pdf.setFontSize(9);
		setFont(pdf, false);
		pdf.setTextColor(55, 65, 81);
		multiLine(pdf, tr(report.risk_forecast), M + 5, y + 11, CW - 10);
		y += boxH + 6;
	}

	// ── FOOTER (all pages) ───────────────────────────────────────
	const totalPages = (pdf as unknown as { internal: { getNumberOfPages: () => number } })
		.internal.getNumberOfPages();
	for (let p = 1; p <= totalPages; p++) {
		pdf.setPage(p);
		pdf.setFontSize(7);
		setFont(pdf, false);
		pdf.setTextColor(156, 163, 175);
		pdf.setDrawColor(243, 244, 246);
		pdf.line(M, 287, M + CW, 287);
		pdf.text(`NanoNet  /  ${tr(report.period_label)}  /  ${now}`, M, 291);
		pdf.text(`${p} / ${totalPages}`, M + CW, 291, { align: "right" });
	}

	const slug = tr(report.period_label).replace(/\s+/g, "-").toLowerCase();
	pdf.save(`nanonet-rapor-${slug}.pdf`);
}
