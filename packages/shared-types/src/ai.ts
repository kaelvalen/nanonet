export interface AIInsight {
	id: string;
	alert_id: string;
	model: string;
	summary: string;
	root_cause?: string;
	recommendations?: { action: string; priority: string }[];
	created_at: string;
}

export interface AnalysisResult {
	summary: string;
	root_cause: string;
	recommendations: { action: string; priority: string }[];
	confidence?: number;
}

export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
}

export interface ChatResponse {
	reply: string;
	model: string;
	tokens_used?: number;
}

export type TimeRange = "1h" | "24h" | "7d" | "30d";

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
	"1h": "Son 1 Saat",
	"24h": "Son 24 Saat",
	"7d": "Son 7 Gün",
	"30d": "Son 30 Gün",
};

export interface ReportEvent {
	service: string;
	time: string;
	observation: string;
	root_cause: string;
	impact: string;
	action: string;
	outcome: string;
	category: "tamamlandı" | "müdahale_gerekli" | "izleniyor" | "trend";
}

export interface ReportResult {
	period_label: string;
	system_score: "SAĞLIKLI" | "DİKKAT" | "KRİTİK";
	headline: string;
	total_requests?: string;
	critical_events: number;
	resolved_events: number;
	events: ReportEvent[];
	actions: { action: string; priority: string; estimated_impact?: string }[];
	risk_forecast: string;
	confidence?: number;
}
