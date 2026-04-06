import apiClient from "./client";

export interface SecurityFinding {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
}

export interface SecurityScan {
  id: string;
  service_id: string;
  scanned_at: string;
  tls_enabled: boolean;
  tls_valid: boolean;
  tls_expiry?: string;
  tls_days_left?: number;
  tls_issuer: string;
  tls_version: string;
  missing_headers: string[];
  server_header: string;
  redirect_to_https: boolean;
  risk_score: number;
  findings: SecurityFinding[];
  created_at: string;
}

export interface ServiceScanSummary {
  service_id: string;
  service_name: string;
  service_host: string;
  service_port: number;
  latest_scan?: SecurityScan;
}

export interface SecurityOverview {
  security_score: number;
  tls_warnings: number;
  header_issues: number;
  services: ServiceScanSummary[];
}

export const securityApi = {
  getOverview: async (): Promise<SecurityOverview> => {
    const res = await apiClient.get("/security/overview");
    return res.data.data;
  },

  getServiceScans: async (
    serviceId: string,
    limit = 20,
  ): Promise<SecurityScan[]> => {
    const res = await apiClient.get(`/services/${serviceId}/security/scans`, {
      params: { limit },
    });
    return res.data.data?.scans ?? [];
  },

  triggerScan: async (serviceId: string): Promise<SecurityScan> => {
    const res = await apiClient.post(
      `/services/${serviceId}/security/scan`,
      {},
    );
    return res.data.data?.scan;
  },
};
