// Enriches backend/api/openapi.yaml with:
//   1) Missing endpoints (billing group + security scan trigger)
//   2) A "Front-end kullanımı" note appended to every operation description,
//      mapping each endpoint to the React page/component + api client fn.
//
// Uses the `yaml` package's Document API so comments and hand-formatting in
// the original file are preserved as much as possible.
//
// Run:  node scripts/enrich-openapi-frontend.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import YAML from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC = join(__dirname, "..", "backend", "api", "openapi.yaml");

const doc = YAML.parseDocument(readFileSync(SPEC, "utf8"));

// ── Front-end usage map: "METHOD /path" → note (Turkish) ──────────────────
// Note mentions the api client function and the page/component that calls it.
const FE = {
  // Auth
  "POST /api/v1/auth/register": "`authApi.register()` — **RegisterPage** kayıt formu (useAuth). Access token Zustand store'a yazılır, refresh token HttpOnly cookie ile döner.",
  "POST /api/v1/auth/login": "`authApi.login()` — **LoginPage** giriş formu (useAuth). Başarıda kullanıcı + access token store'a yazılır.",
  "POST /api/v1/auth/logout": "`authApi.logout()` — üst menüdeki \"Çıkış Yap\". Refresh cookie temizlenir, store sıfırlanır.",
  "POST /api/v1/auth/refresh": "`authApi.refresh()` — `client.ts` axios interceptor'ı 401 alınca otomatik çağırır; access token sessizce yenilenir.",
  "POST /api/v1/auth/mobile/refresh": "Yalnızca mobil istemci için (body ile refresh token). Web SPA bunun yerine cookie tabanlı `/auth/refresh` kullanır.",
  "GET /api/v1/auth/me": "`authApi.me()` — uygulama açılışında oturumu doğrulamak için (useAuth bootstrap).",
  "PUT /api/v1/auth/password": "`settingsApi.changePassword()` — **SettingsPage › Güvenlik** parola değiştirme.",
  "POST /api/v1/auth/forgot-password": "`authApi.forgotPassword()` — **ForgotPasswordPage** sıfırlama e-postası talebi.",
  "POST /api/v1/auth/reset-password": "`authApi.resetPassword()` — **ResetPasswordPage** (e-postadaki token ile yeni parola).",
  "POST /api/v1/auth/agent-token": "`authApi.createAgentToken()` — **AgentSetupWizard** / **AgentsPage**, agent kurulumu için tek seferlik token üretir.",
  "GET /api/v1/auth/agent-tokens": "**AgentsPage** — servise bağlı agent token'larını listeler.",
  "DELETE /api/v1/auth/agent-tokens/{token_id}": "**AgentsPage** — token iptal (revoke) butonu.",

  // Services
  "GET /api/v1/services": "`servicesApi.list()` — **ServicesPage**, **DashboardPage**, **CommandPalette** ve `useServices` hook'u (servis kartları/tablosu).",
  "POST /api/v1/services": "`servicesApi.create()` — **ServicesPage** \"Servis Ekle\" sihirbazı.",
  "GET /api/v1/services/{id}": "`servicesApi.get()` — **ServiceDetailPage** açılışında tekil servis detayı.",
  "PUT /api/v1/services/{id}": "`servicesApi.update()` — **ServiceDetailPage** ayar/düzenleme formu.",
  "DELETE /api/v1/services/{id}": "`servicesApi.delete()` — **ServiceDetailPage** / **ServicesPage** silme aksiyonu.",
  "POST /api/v1/services/{id}/ping": "**ServiceDetailPage** — manuel sağlık kontrolü (anlık ping) butonu.",
  "POST /api/v1/services/{id}/restart": "`servicesApi.restart()` — **ServiceDetailPage** aksiyon çubuğu ve **CommandPalette** (agent'a komut kuyruğa alır).",
  "POST /api/v1/services/{id}/stop": "`servicesApi.stop()` — **ServiceDetailPage** \"Durdur\" butonu.",
  "POST /api/v1/services/{id}/start": "`servicesApi.start()` — **ServiceDetailPage** \"Başlat\" butonu.",
  "POST /api/v1/services/{id}/exec": "`servicesApi.exec()` — **ServiceDetailPage › Exec/Terminal** sekmesi (komutu agent'a iletir).",
  "POST /api/v1/services/{id}/scale": "`servicesApi.scale()` — **ServiceDetailPage › Ölçekleme** ve **LoadBalancingTab** (instance sayısı/strateji).",
  "GET /api/v1/services/{id}/commands": "`servicesApi.getCommandHistory()` — **CommandHistoryTab** (sayfalı komut geçmişi).",
  "GET /api/v1/services/map": "`servicesApi.loadMap()` — **ServiceMapPage** (`useMapState`) kayıtlı düğüm/kenar yerleşimini yükler.",
  "PUT /api/v1/services/map": "`servicesApi.saveMap()` — **ServiceMapPage** yerleşimi kaydeder (sürükle-bırak sonrası).",
  "GET /api/v1/services/uptime/summary": "**DashboardPage** / **ServicesPage** — tüm servislerin uptime'ını tek istekte çeker (N+1 önleme).",

  // Metrics
  "GET /api/v1/services/{id}/metrics": "`metricsApi.getHistory()` — **ServiceDetailPage** zaman serisi grafikleri.",
  "GET /api/v1/services/{id}/metrics/aggregated": "`metricsApi.getAggregated()` — **ServiceDetailPage** ve **ComparePage** (bucket'lanmış ortalamalar).",
  "GET /api/v1/services/{id}/metrics/uptime": "`metricsApi.getUptime()` — **ServiceDetailPage** ve **DashboardPage** uptime rozetleri.",
  "GET /api/v1/services/{id}/metrics/rollup": "**ServiceDetailPage** — uzun dönem (günlük/saatlik) rollup grafikleri.",
  "GET /api/v1/services/{id}/metrics/forecast": "`metricsApi.getForecast()` — **ForecastPanel** (CPU/bellek/latency tahmini ve güven aralığı).",
  "GET /api/v1/metrics/summary": "**DashboardPage** — küresel metrik özeti (ort. latency, p95, hata oranı, CPU).",
  "POST /api/v1/metrics": "Agent / harici sistemler tarafından metrik yazımı için. Web SPA bu ucu kullanmaz (veri WebSocket üzerinden akar).",

  // Alerts
  "GET /api/v1/alerts": "**AlertsPage** — tüm aktif uyarılar listesi.",
  "GET /api/v1/services/{id}/alerts": "`metricsApi.getAlerts()` — **ServiceDetailPage** servise özgü uyarılar.",
  "POST /api/v1/alerts/{alertId}/resolve": "`metricsApi.resolveAlert()` — **AlertsPage** \"Çöz\" aksiyonu.",
  "POST /api/v1/alerts/{alertId}/snooze": "**AlertsPage** — uyarıyı belirli süre erteleme.",
  "GET /api/v1/services/{id}/alert-rules": "**AlertRulesPanel** / **AlertRulesTab** — eşik kurallarını yükler.",
  "PUT /api/v1/services/{id}/alert-rules": "**AlertRulesPanel** — eşik kurallarını kaydeder (CPU/bellek/latency limitleri).",

  // AI
  "POST /api/v1/ai/chat": "**AIAssistant** bileşeni — kullanıcı sohbet mesajını Claude'a iletir (servis bağlamıyla).",
  "POST /api/v1/ai/report": "**ReportPDF** bileşeni — SSE akışıyla AI rapor üretir (PDF/özet).",
  "GET /api/v1/ai/usage": "`aiUsageApi.summary()` — **AIUsagePage** aylık harcama/token özeti ve bütçe.",
  "GET /api/v1/ai/usage/recent": "`aiUsageApi.recent()` — **AIUsagePage** son AI çağrıları tablosu.",
  "GET /api/v1/services/{id}/insights": "**ServiceDetailPage** — servise ait AI içgörüleri (önbellekli).",
  "POST /api/v1/services/{id}/analyze": "**ServiceDetailPage** — \"Analiz Et\" butonu, anlık anomali analizi tetikler.",
  "GET /api/v1/insights": "**AIInsightsPage** — tüm servislerin AI içgörülerini bir arada gösterir.",

  // Settings / Audit
  "GET /api/v1/settings": "`settingsApi.get()` — **SettingsPage** açılışında kullanıcı tercihleri.",
  "PUT /api/v1/settings": "`settingsApi.update()` — **SettingsPage** bildirim/poll/AI/webhook ayarlarını kaydeder.",
  "GET /api/v1/audit": "`settingsApi.getAuditLogs()` — **SettingsPage › Denetim Günlüğü** (sayfalı).",

  // Dependencies
  "GET /api/v1/services/{id}/dependencies": "`dependenciesApi.list()` — **DependenciesPanel** (agent'ın keşfettiği bağımlılıklar).",
  "PATCH /api/v1/services/{id}/dependencies/{dep_id}": "`dependenciesApi.promote()` — **DependenciesPanel** bağımlılığı kalıcı (promoted) işaretler.",
  "DELETE /api/v1/services/{id}/dependencies/{dep_id}": "`dependenciesApi.remove()` — **DependenciesPanel** bağımlılığı siler.",

  // Grants
  "GET /api/v1/services/{id}/grants": "`grantsApi.list()` — **SharingPanel** servis paylaşım yetkileri.",
  "POST /api/v1/services/{id}/grants": "`grantsApi.create()` — **SharingPanel** kullanıcıya rol (viewer/operator/admin) verir.",
  "PATCH /api/v1/services/{id}/grants/{grant_id}": "`grantsApi.update()` — **SharingPanel** rol değiştirir.",
  "DELETE /api/v1/services/{id}/grants/{grant_id}": "`grantsApi.remove()` — **SharingPanel** paylaşımı kaldırır.",

  // Maintenance
  "GET /api/v1/services/{id}/maintenance": "`maintenanceApi.list()` — **MaintenanceTab** bakım pencereleri.",
  "POST /api/v1/services/{id}/maintenance": "`maintenanceApi.create()` — **MaintenanceTab** yeni bakım penceresi (uyarılar susturulur).",
  "DELETE /api/v1/services/{id}/maintenance/{windowId}": "`maintenanceApi.delete()` — **MaintenanceTab** bakım penceresini siler.",

  // Logs
  "GET /api/v1/logs": "**LogsPage** / **LogViewer** — merkezi log arama (servis/seviye/metin filtresi).",
  "GET /api/v1/logs/stats": "**LogsPage** — log seviye dağılımı/istatistikleri.",
  "GET /api/v1/services/{id}/logs": "**ServiceDetailPage › Loglar** sekmesi (servise özgü loglar).",

  // Security
  "GET /api/v1/security/overview": "`securityApi.getOverview()` — **SecurityPage** güvenlik skoru ve servis özetleri.",
  "GET /api/v1/services/{id}/security/scans": "`securityApi.getServiceScans()` — **SecurityPage** / **ServiceDetailPage** tarama geçmişi.",
  "POST /api/v1/services/{id}/security/scan": "`securityApi.triggerScan()` — **SecurityPage** \"Tara\" butonu (TLS/başlık taraması tetikler).",

  // Demo / Agents
  "POST /api/v1/demo/seed": "`demoApi.seed()` — **ServicesPage** boş durumdaki \"Demo verisi yükle\" butonu.",
  "GET /api/v1/agents/release": "**AgentsPage** — \"güncelleme mevcut\" rozeti için en güncel agent sürümü.",

  // API Tokens
  "GET /api/v1/api-tokens": "`apiTokensApi.list()` — **ApiTokensPage** kişisel token listesi + kullanılabilir scope'lar.",
  "POST /api/v1/api-tokens": "`apiTokensApi.create()` — **ApiTokensPage** yeni token (gizli değer tek sefer gösterilir).",
  "DELETE /api/v1/api-tokens/{id}": "`apiTokensApi.revoke()` — **ApiTokensPage** token iptali.",

  // Incidents
  "GET /api/v1/incidents": "`incidentsApi.list()` — **IncidentsPage** incident listesi.",
  "GET /api/v1/incidents/{id}": "`incidentsApi.get()` — **IncidentsPage** detay + zaman çizelgesi (timeline).",
  "PATCH /api/v1/incidents/{id}": "`incidentsApi.update()` — **IncidentsPage** başlık/özet/postmortem düzenleme.",
  "POST /api/v1/incidents/{id}/resolve": "`incidentsApi.resolve()` — **IncidentsPage** incident'ı çözer.",
  "DELETE /api/v1/incidents/{id}": "`incidentsApi.remove()` — **IncidentsPage** incident siler.",

  // Status Pages
  "GET /api/v1/status-pages": "`statusPageApi.list()` — **StatusPagesAdmin** durum sayfası listesi.",
  "POST /api/v1/status-pages": "`statusPageApi.create()` — **StatusPagesAdmin** yeni herkese açık durum sayfası.",
  "PUT /api/v1/status-pages/{id}": "`statusPageApi.update()` — **StatusPagesAdmin** düzenleme.",
  "DELETE /api/v1/status-pages/{id}": "`statusPageApi.remove()` — **StatusPagesAdmin** silme.",
  "GET /api/v1/public/status/{slug}": "`statusPageApi.getPublic()` — **PublicStatusPage** (kimlik doğrulamasız, anonim ziyaretçi).",

  // SLO
  "GET /api/v1/slos": "`sloApi.list()` — **SLOPage** SLO listesi.",
  "POST /api/v1/slos": "`sloApi.create()` — **SLOPage** yeni SLO (availability/latency/error_rate).",
  "PUT /api/v1/slos/{id}": "`sloApi.update()` — **SLOPage** düzenleme.",
  "DELETE /api/v1/slos/{id}": "`sloApi.remove()` — **SLOPage** silme.",
  "GET /api/v1/slos/{id}/compliance": "`sloApi.compliance()` — **SLOPage** error budget / burndown grafiği.",

  // Probes
  "GET /api/v1/probes": "`probesApi.list()` — **ProbesPage** synthetic probe listesi.",
  "POST /api/v1/probes": "`probesApi.create()` — **ProbesPage** yeni HTTP/TCP probe.",
  "PUT /api/v1/probes/{id}": "`probesApi.update()` — **ProbesPage** düzenleme.",
  "DELETE /api/v1/probes/{id}": "`probesApi.remove()` — **ProbesPage** silme.",
  "GET /api/v1/probes/{id}/runs": "`probesApi.runs()` — **ProbesPage** probe çalışma geçmişi (latency/durum).",

  // Runbooks
  "GET /api/v1/runbooks": "`runbooksApi.list()` — **RunbooksPage** otomasyon kuralları.",
  "POST /api/v1/runbooks": "`runbooksApi.create()` — **RunbooksPage** yeni runbook (alert → aksiyon).",
  "PUT /api/v1/runbooks/{id}": "`runbooksApi.update()` — **RunbooksPage** düzenleme.",
  "DELETE /api/v1/runbooks/{id}": "`runbooksApi.remove()` — **RunbooksPage** silme.",
  "GET /api/v1/runbooks/{id}/fires": "`runbooksApi.fires()` — **RunbooksPage** tetiklenme geçmişi.",

  // Notifications
  "GET /api/v1/notifications/channels": "`notificationsApi.list()` — **NotificationsPage** kanal listesi.",
  "POST /api/v1/notifications/channels": "`notificationsApi.create()` — **NotificationsPage** yeni kanal (slack/discord/webhook/email/pagerduty).",
  "PUT /api/v1/notifications/channels/{id}": "`notificationsApi.update()` — **NotificationsPage** kanal düzenleme.",
  "DELETE /api/v1/notifications/channels/{id}": "`notificationsApi.remove()` — **NotificationsPage** kanal silme.",
  "POST /api/v1/notifications/channels/{id}/test": "`notificationsApi.test()` — **NotificationsPage** \"Test gönder\" butonu.",
  "GET /api/v1/notifications/channels/{id}/deliveries": "`notificationsApi.deliveries()` — **NotificationsPage** teslimat geçmişi.",
  "POST /api/v1/notifications/push-token": "Mobil uygulama — cihaz push token kaydı (web SPA kullanmaz).",
  "DELETE /api/v1/notifications/push-token": "Mobil uygulama — push token silme.",
  "GET /api/v1/notifications/push-preferences": "Mobil uygulama — push tercihleri.",
  "PUT /api/v1/notifications/push-preferences": "Mobil uygulama — push tercihleri güncelleme.",

  // Kubernetes
  "GET /api/v1/k8s/status": "`k8sApi.getStatus()` — **KubernetesPage** K8s entegrasyonunun erişilebilirliğini kontrol eder.",
  "GET /api/v1/k8s/namespaces": "`k8sApi.getNamespaces()` — **KubernetesPage** namespace seçici.",
  "GET /api/v1/k8s/nodes": "`k8sApi.getNodes()` — **KubernetesPage** düğüm listesi.",
  "GET /api/v1/k8s/pods": "`k8sApi.getPods()` — **PodsTab** (label selector ile).",
  "GET /api/v1/k8s/pods/all": "`k8sApi.getAllPods()` — **PodsTab** namespace'teki tüm pod'lar.",
  "GET /api/v1/k8s/pods/{name}/logs": "`k8sApi.getPodLogs()` — **PodsTab** pod log görüntüleyici.",
  "DELETE /api/v1/k8s/pods/{name}": "`k8sApi.deletePod()` — **PodsTab** pod silme (yeniden oluşturulur).",
  "GET /api/v1/k8s/deployments": "`k8sApi.listDeployments()` — **KubernetesPage** deployment listesi.",
  "GET /api/v1/k8s/deployments/{name}": "`k8sApi.getDeployment()` — **KubernetesPage** deployment detayı.",
  "POST /api/v1/k8s/deployments/{name}/scale": "`k8sApi.scaleDeployment()` — **KubernetesPage** replica ölçekleme.",
  "POST /api/v1/k8s/deployments/{name}/restart": "`k8sApi.rolloutRestart()` — **KubernetesPage** rollout restart.",
  "GET /api/v1/k8s/hpa": "`k8sApi.listHPAs()` — **KubernetesPage** HPA listesi.",
  "GET /api/v1/k8s/hpa/{name}": "`k8sApi.getHPA()` — **KubernetesPage** HPA detayı.",
  "POST /api/v1/k8s/hpa": "`k8sApi.createOrUpdateHPA()` — **KubernetesPage** HPA oluştur/güncelle.",
  "DELETE /api/v1/k8s/hpa/{name}": "`k8sApi.deleteHPA()` — **KubernetesPage** HPA silme.",
  "GET /api/v1/k8s/services": "`k8sApi.listServices()` — **ServicesTab** K8s servisleri.",
  "GET /api/v1/k8s/endpoints/{name}": "`k8sApi.getEndpoints()` — **EndpointsTab** servis endpoint'leri.",
  "GET /api/v1/k8s/events": "`k8sApi.getEvents()` — **EventsTab** küme olayları.",
  "GET /api/v1/k8s/top/pods": "`k8sApi.getTopPods()` — **KubernetesPage** pod kaynak kullanımı (metrics-server).",
  "GET /api/v1/k8s/top/nodes": "`k8sApi.getTopNodes()` — **KubernetesPage** düğüm kaynak kullanımı.",
  "POST /api/v1/k8s/deploy": "`k8sApi.deployService()` — **NanonetTab** yeni servisi K8s'e deploy eder.",
  "DELETE /api/v1/k8s/deploy/{name}": "`k8sApi.undeployService()` — **NanonetTab** servisi K8s'ten kaldırır.",

  // Billing
  "GET /api/v1/billing/plans": "`billingApi.getPlans()` — **BillingPage** mevcut plan kartları.",
  "GET /api/v1/billing/subscription": "`billingApi.getSubscription()` — **BillingPage** aktif abonelik + kullanım göstergeleri.",
  "POST /api/v1/billing/subscribe": "`billingApi.subscribe()` — **BillingPage** plan seçme/yükseltme.",
  "POST /api/v1/billing/cancel": "`billingApi.cancel()` — **BillingPage** aboneliği iptal (dönem sonunda).",

  // System / Health
  "GET /health": "Yük dengeleyici / izleme sistemleri için sağlık ucu (bağlı agent/dashboard sayısı). UI kullanmaz.",
  "GET /health/live": "Kubernetes liveness probe.",
  "GET /health/ready": "Kubernetes readiness probe (DB/Redis bağlantısı).",
  "GET /health/details": "Ops için ayrıntılı bağımlılık sağlık raporu.",
};

const FE_HEADING = "**🖥️ Front-end kullanımı:** ";
const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"];

// ── 1) Add missing endpoints ──────────────────────────────────────────────
const paths = doc.get("paths");

function ensurePath(url, node) {
  if (!paths.has(url)) {
    paths.set(url, YAML.createNode(node));
    return true;
  }
  return false;
}

const envelopeNote =
  "Yanıt standart zarf ile sarılır: `{ \"success\": true, \"data\": ... }`.";

ensurePath("/api/v1/billing/plans", {
  get: {
    tags: ["Billing"],
    summary: "Abonelik planları",
    description: `Tüm abonelik planlarını (Free/Pro/Enterprise vb.) limitleri ve fiyatlarıyla döndürür. ${envelopeNote}`,
    security: [{ BearerAuth: [] }],
    responses: {
      "200": {
        description: "Plan listesi",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: { type: "array", items: { $ref: "#/components/schemas/Plan" } },
              },
            },
          },
        },
      },
    },
  },
});

ensurePath("/api/v1/billing/subscription", {
  get: {
    tags: ["Billing"],
    summary: "Mevcut abonelik ve kullanım",
    description: `Oturum açan kullanıcının aktif aboneliğini ve mevcut kullanım sayaçlarını (servis/agent/probe/AI token) döndürür. ${envelopeNote}`,
    security: [{ BearerAuth: [] }],
    responses: {
      "200": {
        description: "Abonelik özeti",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: { $ref: "#/components/schemas/PlanSummary" },
              },
            },
          },
        },
      },
    },
  },
});

ensurePath("/api/v1/billing/subscribe", {
  post: {
    tags: ["Billing"],
    summary: "Plan değiştir / yükselt",
    description: `Kullanıcıyı verilen plana geçirir. ${envelopeNote}`,
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["plan_id"],
            properties: { plan_id: { type: "string", example: "pro" } },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Güncel abonelik",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: { $ref: "#/components/schemas/Subscription" },
              },
            },
          },
        },
      },
      "422": { description: "Geçersiz plan veya geçiş yapılamadı" },
    },
  },
});

ensurePath("/api/v1/billing/cancel", {
  post: {
    tags: ["Billing"],
    summary: "Aboneliği iptal et",
    description: `Aktif aboneliği dönem sonunda iptal olacak şekilde işaretler. ${envelopeNote}`,
    security: [{ BearerAuth: [] }],
    responses: {
      "200": {
        description: "İptal edildi",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: {
                  type: "object",
                  properties: { canceled: { type: "boolean", example: true } },
                },
              },
            },
          },
        },
      },
    },
  },
});

// Security scan trigger uses singular `/scan` (the route in main.go). The spec
// previously attached POST to `/scans` (plural) which doesn't match the router.
const scansNode = paths.get("/api/v1/services/{id}/security/scans");
if (scansNode && scansNode.has && scansNode.has("post")) {
  scansNode.delete("post"); // remove mis-pathed trigger; keep the GET history
}
ensurePath("/api/v1/services/{id}/security/scan", {
  post: {
    tags: ["Security"],
    summary: "Güvenlik taraması başlat",
    description: "Servis için anlık TLS/güvenlik-başlığı taraması çalıştırır ve sonucu döndürür.",
    security: [{ BearerAuth: [] }],
    parameters: [{ $ref: "#/components/parameters/ServiceId" }],
    responses: { "200": { description: "Tarama sonucu" } },
  },
});

// ── 2) Add Billing schemas if absent ──────────────────────────────────────
const schemas = doc.getIn(["components", "schemas"]);
function ensureSchema(name, node) {
  if (schemas && !schemas.has(name)) schemas.set(name, YAML.createNode(node));
}
ensureSchema("Plan", {
  type: "object",
  properties: {
    id: { type: "string", example: "pro" },
    name: { type: "string", example: "Pro" },
    tier: { type: "integer", example: 2 },
    price_monthly_usd: { type: "number", example: 29 },
    max_services: { type: "integer", example: 50 },
    max_agents: { type: "integer", example: 50 },
    max_probes: { type: "integer", example: 100 },
    max_alert_rules: { type: "integer", example: 500 },
    ai_tokens_monthly: { type: "integer", example: 2000000 },
    metric_retention_days: { type: "integer", example: 90 },
    log_retention_days: { type: "integer", example: 30 },
    k8s_enabled: { type: "boolean", example: true },
    slo_enabled: { type: "boolean", example: true },
    runbooks_enabled: { type: "boolean", example: true },
    team_members: { type: "integer", example: 5 },
  },
});
ensureSchema("Subscription", {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    user_id: { type: "string", format: "uuid" },
    plan_id: { type: "string", example: "pro" },
    plan: { $ref: "#/components/schemas/Plan" },
    status: { type: "string", enum: ["active", "canceled", "past_due", "trialing"] },
    current_period_start: { type: "string", format: "date-time" },
    current_period_end: { type: "string", format: "date-time", nullable: true },
    cancel_at_period_end: { type: "boolean" },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
  },
});
ensureSchema("PlanSummary", {
  type: "object",
  properties: {
    subscription: { $ref: "#/components/schemas/Subscription" },
    usage: {
      type: "object",
      properties: {
        services_used: { type: "integer" },
        agents_used: { type: "integer" },
        probes_used: { type: "integer" },
        alert_rules_used: { type: "integer" },
        ai_tokens_used: { type: "integer" },
      },
    },
  },
});

// Add Billing tag if missing
const tags = doc.get("tags");
if (tags && !tags.items.some((t) => String(t.get?.("name")) === "Billing")) {
  tags.add(YAML.createNode({ name: "Billing", description: "Abonelik ve faturalama" }));
}

// ── 3) Append front-end note to every operation description ────────────────
let applied = 0;
const unmatched = [];
for (const pathItem of paths.items) {
  const url = String(pathItem.key);
  const ops = pathItem.value; // YAMLMap of methods
  if (!ops || !ops.items) continue;
  for (const m of HTTP_METHODS) {
    if (!ops.has(m)) continue;
    const key = `${m.toUpperCase()} ${url}`;
    const note = FE[key];
    if (!note) {
      unmatched.push(key);
      continue;
    }
    const op = ops.get(m);
    const existing = op.get("description");
    const feBlock = FE_HEADING + note;
    if (typeof existing === "string" && existing.length) {
      if (!existing.includes(FE_HEADING)) {
        op.set("description", `${existing}\n\n${feBlock}`);
      }
    } else {
      op.set("description", feBlock);
    }
    applied++;
  }
}

writeFileSync(SPEC, doc.toString({ lineWidth: 0 }), "utf8");
console.log(`✓ Front-end notu eklenen operasyon: ${applied}`);
if (unmatched.length) {
  console.log(`⚠ Eşlenmeyen ${unmatched.length} operasyon (front-end notu yok):`);
  for (const u of unmatched) console.log("   - " + u);
}
