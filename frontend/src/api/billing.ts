import apiClient from "./client";

export interface Plan {
	id: string;
	name: string;
	tier: number;
	price_monthly_usd: number;
	max_services: number;
	max_agents: number;
	max_probes: number;
	max_alert_rules: number;
	ai_tokens_monthly: number;
	metric_retention_days: number;
	log_retention_days: number;
	k8s_enabled: boolean;
	slo_enabled: boolean;
	runbooks_enabled: boolean;
	team_members: number;
}

export interface Subscription {
	id: string;
	user_id: string;
	plan_id: string;
	plan: Plan;
	status: "active" | "canceled" | "past_due" | "trialing";
	current_period_start: string;
	current_period_end: string | null;
	cancel_at_period_end: boolean;
	created_at: string;
	updated_at: string;
}

export interface UsageStats {
	services_used: number;
	agents_used: number;
	probes_used: number;
	alert_rules_used: number;
	ai_tokens_used: number;
}

export interface PlanSummary {
	subscription: Subscription;
	usage: UsageStats;
}

export const billingApi = {
	getPlans: async (): Promise<Plan[]> => {
		const r = await apiClient.get("/billing/plans");
		return r.data.data ?? [];
	},

	getSubscription: async (): Promise<PlanSummary> => {
		const r = await apiClient.get("/billing/subscription");
		return r.data.data;
	},

	subscribe: async (planId: string): Promise<Subscription> => {
		const r = await apiClient.post("/billing/subscribe", { plan_id: planId });
		return r.data.data;
	},

	cancel: async (): Promise<void> => {
		await apiClient.post("/billing/cancel");
	},
};
