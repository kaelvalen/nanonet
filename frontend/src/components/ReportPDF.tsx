import { PageSizes, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { ReportResult } from "@/api/metrics";

// pdf-lib StandardFonts Helvetica WinAnsi encoding — Türkçe özel karakterleri ASCII'ye map et
function enc(v: string | undefined | null): string {
	if (!v) return "";
	return v
		.replace(/ş/g, "s")
		.replace(/Ş/g, "S")
		.replace(/ğ/g, "g")
		.replace(/Ğ/g, "G")
		.replace(/ü/g, "u")
		.replace(/Ü/g, "U")
		.replace(/ç/g, "c")
		.replace(/Ç/g, "C")
		.replace(/ö/g, "o")
		.replace(/Ö/g, "O")
		.replace(/ı/g, "i")
		.replace(/İ/g, "I");
}

// ── Renk yardımcıları ────────────────────────────────────────────
function hex(h: string) {
	const r = parseInt(h.slice(1, 3), 16) / 255;
	const g = parseInt(h.slice(3, 5), 16) / 255;
	const b = parseInt(h.slice(5, 7), 16) / 255;
	return rgb(r, g, b);
}

const C = {
	dark: hex("#0f172a"),
	teal: hex("#0d9488"),
	white: hex("#ffffff"),
	gray900: hex("#111827"),
	gray600: hex("#4b5563"),
	gray400: hex("#9ca3af"),
	gray100: hex("#f3f4f6"),
	gray50: hex("#f9fafb"),
	green700: hex("#15803d"),
	green100: hex("#dcfce7"),
	red700: hex("#b91c1c"),
	red100: hex("#fee2e2"),
	amber700: hex("#b45309"),
	amber100: hex("#fef3c7"),
	teal700: hex("#0f766e"),
	teal100: hex("#ccfbf1"),
	tealBg: hex("#f0fdfa"),
	tealBorder: hex("#99f6e4"),
};

const CAT_COLORS: Record<
	string,
	{ fg: ReturnType<typeof rgb>; bg: ReturnType<typeof rgb> }
> = {
	tamamlandi: { fg: C.green700, bg: C.green100 },
	mudahale_gerekli: { fg: C.red700, bg: C.red100 },
	izleniyor: { fg: C.amber700, bg: C.amber100 },
	trend: { fg: C.teal700, bg: C.teal100 },
};
const CAT_LABEL: Record<string, string> = {
	tamamlandi: "Tamamlandı",
	mudahale_gerekli: "Müdahale Gerekli",
	izleniyor: "İzleniyor",
	trend: "Trend",
};
const PRI_COLORS: Record<
	string,
	{ fg: ReturnType<typeof rgb>; bg: ReturnType<typeof rgb> }
> = {
	high: { fg: C.red700, bg: C.red100 },
	medium: { fg: C.amber700, bg: C.amber100 },
	low: { fg: C.green700, bg: C.green100 },
};
const PRI_LABEL: Record<string, string> = {
	high: "Yüksek",
	medium: "Orta",
	low: "Düşük",
};
const SCORE_COLORS: Record<
	string,
	{ fg: ReturnType<typeof rgb>; bg: ReturnType<typeof rgb> }
> = {
	SAĞLIKLI: { fg: C.green700, bg: C.green100 },
	DİKKAT: { fg: C.amber700, bg: C.amber100 },
	KRİTİK: { fg: C.red700, bg: C.red100 },
};

// ── Layout sabitleri (pt) ────────────────────────────────────────
const PW = PageSizes.A4[0]; // 595.28
const PH = PageSizes.A4[1]; // 841.89
const ML = 40;
const MR = 40;
const CW = PW - ML - MR;
const LH = 14;

// ── pdf-lib yardımcıları ─────────────────────────────────────────
function drawRect(
	page: ReturnType<PDFDocument["addPage"]>,
	x: number,
	y: number,
	w: number,
	h: number,
	fillColor?: ReturnType<typeof rgb>,
	borderColor?: ReturnType<typeof rgb>,
	borderWidth = 1,
) {
	if (fillColor)
		page.drawRectangle({ x, y, width: w, height: h, color: fillColor });
	if (borderColor)
		page.drawRectangle({
			x,
			y,
			width: w,
			height: h,
			borderColor,
			borderWidth,
			opacity: 0,
			borderOpacity: 1,
		});
}

function drawText(
	page: ReturnType<PDFDocument["addPage"]>,
	text: string,
	x: number,
	y: number,
	font: import("pdf-lib").PDFFont,
	size: number,
	color: ReturnType<typeof rgb>,
) {
	page.drawText(text, { x, y, font, size, color });
}

function measureText(
	text: string,
	font: import("pdf-lib").PDFFont,
	size: number,
): number {
	return font.widthOfTextAtSize(text, size);
}

// Metni satırlara böl
function splitLines(
	text: string,
	font: import("pdf-lib").PDFFont,
	size: number,
	maxW: number,
): string[] {
	const words = text.split(" ");
	const lines: string[] = [];
	let cur = "";
	for (const w of words) {
		const test = cur ? `${cur} ${w}` : w;
		if (font.widthOfTextAtSize(test, size) <= maxW) {
			cur = test;
		} else {
			if (cur) lines.push(cur);
			cur = w;
		}
	}
	if (cur) lines.push(cur);
	return lines.length ? lines : [""];
}

// Metin bloğu çiz, yeni y döndür (pdf-lib y yukarıdan değil aşağıdan)
function _drawWrapped(
	page: ReturnType<PDFDocument["addPage"]>,
	text: string,
	x: number,
	y: number, // başlangıç baseline (yukarı = büyük y)
	font: import("pdf-lib").PDFFont,
	size: number,
	color: ReturnType<typeof rgb>,
	maxW: number,
	lineH = LH,
): number {
	const lines = splitLines(text, font, size, maxW);
	let cy = y;
	for (const line of lines) {
		drawText(page, line, x, cy, font, size, color);
		cy -= lineH;
	}
	return cy;
}

// ── Ana export ───────────────────────────────────────────────────
export async function downloadReportPDF(report: ReportResult): Promise<void> {
	const pdfDoc = await PDFDocument.create();
	pdfDoc.setTitle(`NanoNet - ${report.period_label}`);
	pdfDoc.setAuthor("NanoNet");

	// Font — pdf-lib'in built-in Helvetica'sı tüm Latin karakterleri destekler
	// Türkçe için WinAnsiEncoding kapsamı yeterlidir (ş,ğ,ü,ç,ö,ı dahil)
	const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

	const now = new Date().toLocaleDateString("tr-TR", {
		day: "2-digit",
		month: "long",
		year: "numeric",
	});

	// Render state
	let page = pdfDoc.addPage(PageSizes.A4);
	let y = PH - 0; // yukarıdan başlar

	function newPageIfNeeded(need: number): void {
		if (y - need < 50) {
			page = pdfDoc.addPage(PageSizes.A4);
			y = PH - drawFooter(page) - 10;
		}
	}

	function drawFooter(p: ReturnType<PDFDocument["addPage"]>): number {
		const fh = 24;
		drawRect(p, 0, 0, PW, fh, C.dark);
		const left = `NanoNet  ·  ${enc(report.period_label)}  ·  ${now}`;
		drawText(p, left, ML, 8, fontRegular, 7, C.gray400);
		return fh;
	}

	// ═══════════════════════════════════════════════════════════
	// HEADER BAND
	// ═══════════════════════════════════════════════════════════
	const HEADER_H = 52;
	drawRect(page, 0, PH - HEADER_H, PW, HEADER_H, C.dark);

	// Logo
	const logoX = ML;
	const logoSize = 28;
	try {
		const logoRes = await fetch("/logo.png");
		const logoBuf = await logoRes.arrayBuffer();
		const logoImg = await pdfDoc.embedPng(logoBuf);
		page.drawImage(logoImg, {
			x: logoX,
			y: PH - HEADER_H + 12,
			width: logoSize,
			height: logoSize,
		});
	} catch {
		// Logo yüklenemezse teal kare
		drawRect(page, logoX, PH - HEADER_H + 12, logoSize, logoSize, C.teal);
		drawText(page, "N", logoX + 8, PH - HEADER_H + 22, fontBold, 12, C.white);
	}

	// Brand
	drawText(
		page,
		"NanoNet",
		ML + logoSize + 8,
		PH - HEADER_H + 32,
		fontBold,
		11,
		C.white,
	);
	drawText(
		page,
		`Operasyonel Rapor  /  ${enc(report.period_label)}  /  ${now}`,
		ML + logoSize + 8,
		PH - HEADER_H + 18,
		fontRegular,
		7.5,
		C.gray400,
	);

	// Score badge
	const scoreColors = SCORE_COLORS[report.system_score] ?? SCORE_COLORS.DIKKAT;
	const scoreText = enc(report.system_score);
	const scoreW = measureText(scoreText, fontBold, 8) + 16;
	const scoreBadgeX = PW - MR - scoreW;
	const scoreBadgeY = PH - HEADER_H + 18;
	drawRect(page, scoreBadgeX, scoreBadgeY, scoreW, 16, scoreColors.bg);
	drawText(
		page,
		scoreText,
		scoreBadgeX + 8,
		scoreBadgeY + 5,
		fontBold,
		8,
		scoreColors.fg,
	);

	y = PH - HEADER_H - 28;

	// ═══════════════════════════════════════════════════════════
	// HEADLINE
	// ═══════════════════════════════════════════════════════════
	const headLines = splitLines(enc(report.headline), fontBold, 14, CW);
	for (const line of headLines) {
		newPageIfNeeded(18);
		drawText(page, line, ML, y, fontBold, 14, C.gray900);
		y -= 18;
	}
	y -= 6;

	// Stat chips
	const chips = [
		{
			text: `${report.critical_events} kritik olay`,
			fg: C.red700,
			bg: C.red100,
		},
		{
			text: `${report.resolved_events} cozuldu`,
			fg: C.green700,
			bg: C.green100,
		},
		{ text: enc(report.period_label), fg: C.gray600, bg: C.gray100 },
	];
	let cx = ML;
	for (const chip of chips) {
		const tw = measureText(chip.text, fontBold, 8);
		const cw2 = tw + 16;
		drawRect(page, cx, y - 4, cw2, 14, chip.bg);
		drawText(page, chip.text, cx + 8, y + 2, fontBold, 8, chip.fg);
		cx += cw2 + 8;
	}
	y -= 22;

	// Divider
	page.drawLine({
		start: { x: ML, y },
		end: { x: ML + CW, y },
		thickness: 0.5,
		color: C.gray100,
	});
	y -= 20;

	// ═══════════════════════════════════════════════════════════
	// EVENTS
	// ═══════════════════════════════════════════════════════════
	if (report.events.length > 0) {
		newPageIfNeeded(30);
		drawText(page, "DONEM OLAYLARI", ML, y, fontBold, 7.5, C.gray400);
		y -= 14;

		for (const ev of report.events) {
			// Estimate card height
			const obsH =
				splitLines(enc(ev.observation), fontBold, 10, CW - 20).length * LH;
			const detailFields = [
				ev.root_cause,
				ev.impact,
				ev.action,
				ev.outcome,
			].filter(Boolean);
			const detailH = detailFields.reduce((acc, val) => {
				return (
					acc + splitLines(enc(val), fontRegular, 8, CW - 90).length * 12 + 2
				);
			}, 0);
			const cardH = 28 + obsH + detailH + 16;

			newPageIfNeeded(cardH + 10);

			const cardX = ML;
			const cardY = y - cardH;

			// Card background + border
			drawRect(page, cardX, cardY, CW, cardH, C.white, hex("#e2e8f0"), 0.8);

			// Left accent bar
			const catKey = ev.category.toLowerCase().replace(/[\s-]/g, "_");
			const catC = CAT_COLORS[catKey] ?? CAT_COLORS.izleniyor;
			drawRect(page, cardX, cardY, 4, cardH, catC.fg);

			// Card head background
			drawRect(page, cardX, cardY + cardH - 24, CW, 24, C.gray50);

			// Category badge
			const catLabel = enc(CAT_LABEL[catKey] ?? ev.category);
			const catW = measureText(catLabel, fontBold, 7) + 12;
			drawRect(page, cardX + 10, cardY + cardH - 19, catW, 13, catC.bg);
			drawText(
				page,
				catLabel,
				cardX + 16,
				cardY + cardH - 13,
				fontBold,
				7,
				catC.fg,
			);

			// Service / time (right)
			const metaText = `${enc(ev.service)}  /  ${enc(ev.time)}`;
			const metaW = measureText(metaText, fontBold, 7.5);
			drawText(
				page,
				metaText,
				cardX + CW - metaW - 8,
				cardY + cardH - 13,
				fontBold,
				7.5,
				C.gray400,
			);

			// Separator
			let iy = cardY + cardH - 25;
			page.drawLine({
				start: { x: cardX + 10, y: iy },
				end: { x: cardX + CW - 8, y: iy },
				thickness: 0.4,
				color: C.gray100,
			});

			// Observation
			iy -= 4;
			const obsLines = splitLines(enc(ev.observation), fontBold, 10, CW - 20);
			for (const line of obsLines) {
				drawText(page, line, cardX + 10, iy, fontBold, 10, C.gray900);
				iy -= LH;
			}
			iy -= 6;

			// Separator
			page.drawLine({
				start: { x: cardX + 10, y: iy },
				end: { x: cardX + CW - 8, y: iy },
				thickness: 0.4,
				color: C.gray100,
			});
			iy -= 10;

			// Detail rows
			const rows: Array<{
				lbl: string;
				val: string;
				valColor?: ReturnType<typeof rgb>;
			}> = [{ lbl: "Neden:", val: enc(ev.root_cause) }];
			if (ev.impact) rows.push({ lbl: "Etki:", val: enc(ev.impact) });
			if (ev.action) rows.push({ lbl: "Aksiyon:", val: enc(ev.action) });
			if (ev.outcome)
				rows.push({
					lbl: "Sonuc:",
					val: enc(ev.outcome),
					valColor: C.green700,
				});

			for (const row of rows) {
				drawText(page, row.lbl, cardX + 10, iy, fontBold, 7.5, C.gray400);
				const valLines = splitLines(row.val, fontRegular, 8, CW - 90);
				for (const vl of valLines) {
					drawText(
						page,
						vl,
						cardX + 80,
						iy,
						fontRegular,
						8,
						row.valColor ?? C.gray600,
					);
					iy -= 12;
				}
				iy -= 2;
			}

			y -= cardH + 8;
		}
		y -= 8;
	}

	// ═══════════════════════════════════════════════════════════
	// ACTIONS
	// ═══════════════════════════════════════════════════════════
	if (report.actions.length > 0) {
		newPageIfNeeded(30);
		page.drawLine({
			start: { x: ML, y },
			end: { x: ML + CW, y },
			thickness: 0.5,
			color: C.gray100,
		});
		y -= 16;
		drawText(page, "ONERILEN AKSIYONLAR", ML, y, fontBold, 7.5, C.gray400);
		y -= 14;

		report.actions.forEach((action, i) => {
			const actionLines = splitLines(enc(action.action), fontBold, 9, CW - 90);
			const impactLines = action.estimated_impact
				? splitLines(enc(action.estimated_impact), fontRegular, 7.5, CW - 90)
				: [];
			const rowH = (actionLines.length + impactLines.length) * 12 + 16;
			newPageIfNeeded(rowH);

			const priC = PRI_COLORS[action.priority] ?? PRI_COLORS.medium;
			const priLabel = enc(PRI_LABEL[action.priority] ?? action.priority);

			// Index
			drawText(page, `${i + 1}.`, ML, y, fontBold, 8, C.gray400);

			// Priority badge
			const priW = measureText(priLabel, fontBold, 7) + 10;
			drawRect(page, ML + 12, y - 4, priW, 13, priC.bg);
			drawText(page, priLabel, ML + 17, y + 1, fontBold, 7, priC.fg);

			// Action text
			const textX = ML + 12 + priW + 8;
			let ay = y;
			for (const line of actionLines) {
				drawText(page, line, textX, ay, fontBold, 9, C.gray900);
				ay -= 12;
			}
			for (const line of impactLines) {
				drawText(page, line, textX, ay, fontRegular, 7.5, C.gray400);
				ay -= 11;
			}

			y = Math.min(y - rowH, ay - 4);
			page.drawLine({
				start: { x: ML, y: y + 2 },
				end: { x: ML + CW, y: y + 2 },
				thickness: 0.4,
				color: C.gray100,
			});
			y -= 8;
		});
	}

	// ═══════════════════════════════════════════════════════════
	// RISK FORECAST
	// ═══════════════════════════════════════════════════════════
	if (report.risk_forecast) {
		const rLines = splitLines(
			enc(report.risk_forecast),
			fontRegular,
			9,
			CW - 20,
		);
		const boxH = rLines.length * LH + 30;
		newPageIfNeeded(boxH + 16);
		y -= 8;

		const boxY = y - boxH;
		drawRect(page, ML, boxY, CW, boxH, C.tealBg, C.tealBorder, 0.8);
		// Teal left accent
		drawRect(page, ML, boxY, 4, boxH, C.teal);

		drawText(
			page,
			"7 GUNLUK RISK TAHMINI",
			ML + 12,
			y - 8,
			fontBold,
			7.5,
			C.teal,
		);
		let ry = y - 22;
		for (const line of rLines) {
			drawText(page, line, ML + 12, ry, fontRegular, 9, C.gray600);
			ry -= LH;
		}
		y = boxY - 10;
	}

	// ═══════════════════════════════════════════════════════════
	// FOOTER (tüm sayfalar)
	// ═══════════════════════════════════════════════════════════
	const pages = pdfDoc.getPages();
	pages.forEach((p, idx) => {
		drawFooter(p);
		const pageNum = `${idx + 1} / ${pages.length}`;
		const pw2 = measureText(pageNum, fontRegular, 7);
		drawText(p, pageNum, PW - MR - pw2, 8, fontRegular, 7, C.gray400);
	});

	// ─── İndir ──────────────────────────────────────────────────
	const bytes = await pdfDoc.save();
	const blob = new Blob([bytes.buffer as ArrayBuffer], {
		type: "application/pdf",
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `nanonet-rapor-${enc(report.period_label).replace(/\s+/g, "-").toLowerCase()}.pdf`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(() => URL.revokeObjectURL(url), 5000);
}
