package k8s

import (
	"errors"
	"net/http"
	"strconv"

	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

// Handler — Kubernetes API endpoint'leri.
type Handler struct {
	client *Client
}

// NewHandler — K8s handler oluşturur. client nil olabilir (K8s devre dışı).
func NewHandler(client *Client) *Handler {
	return &Handler{client: client}
}

// k8sCheck — K8s client'in mevcut olup olmadığını kontrol eder.
func (h *Handler) k8sCheck(c *gin.Context) bool {
	if h.client == nil {
		response.Error(c, http.StatusServiceUnavailable, "Kubernetes entegrasyonu yapılandırılmamış")
		return false
	}
	return true
}

// GetStatus — K8s cluster erişim durumunu kontrol eder.
// GET /k8s/status
func (h *Handler) GetStatus(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}

	available := h.client.IsAvailable(c.Request.Context())
	response.Success(c, gin.H{
		"available": available,
		"namespace": h.client.namespace,
	})
}

// ListNamespaces — erişilebilir namespace'leri listeler.
// GET /k8s/namespaces
func (h *Handler) ListNamespaces(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}

	namespaces, err := h.client.GetNamespaces(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, gin.H{"namespaces": namespaces})
}

// GetPods — pod'ları listeler.
// GET /k8s/pods?selector=app=my-service
func (h *Handler) GetPods(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}

	selector := c.Query("selector")
	if selector == "" {
		response.BadRequest(c, "selector query parametresi gerekli (örn: app=my-service)")
		return
	}

	pods, err := h.client.GetPods(c.Request.Context(), selector)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	if pods == nil {
		pods = []PodInfo{}
	}

	response.Success(c, gin.H{
		"pods":  pods,
		"count": len(pods),
	})
}

// GetDeployment — deployment bilgisini döndürür.
// GET /k8s/deployments/:name
func (h *Handler) GetDeployment(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}

	name := c.Param("name")
	if name == "" {
		response.BadRequest(c, "deployment adı gerekli")
		return
	}

	dep, err := h.client.GetDeployment(c.Request.Context(), name)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Error(c, http.StatusNotFound, "deployment bulunamadı: "+name)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, dep)
}

// ScaleDeployment — deployment'ı ölçekler.
// POST /k8s/deployments/:name/scale
func (h *Handler) ScaleDeployment(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}

	name := c.Param("name")
	if name == "" {
		response.BadRequest(c, "deployment adı gerekli")
		return
	}

	var req struct {
		Replicas int32 `json:"replicas" binding:"required,min=0,max=100"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}

	result, err := h.client.ScaleDeployment(c.Request.Context(), name, req.Replicas)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, result)
}

// GetHPA — HPA bilgisini döndürür.
// GET /k8s/hpa/:name
func (h *Handler) GetHPA(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}

	name := c.Param("name")
	if name == "" {
		response.BadRequest(c, "HPA veya deployment adı gerekli")
		return
	}

	hpa, err := h.client.GetHPA(c.Request.Context(), name)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Error(c, http.StatusNotFound, "HPA bulunamadı: "+name)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, hpa)
}

// CreateOrUpdateHPA — HPA oluşturur veya günceller.
// POST /k8s/hpa
func (h *Handler) CreateOrUpdateHPA(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}

	var req struct {
		DeploymentName   string `json:"deployment_name" binding:"required"`
		MinReplicas      int32  `json:"min_replicas" binding:"required,min=1"`
		MaxReplicas      int32  `json:"max_replicas" binding:"required,min=1"`
		CPUTargetPercent int32  `json:"cpu_target_percent"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}

	if req.CPUTargetPercent <= 0 {
		req.CPUTargetPercent = 70
	}

	hpa, err := h.client.CreateOrUpdateHPA(c.Request.Context(), req.DeploymentName, req.MinReplicas, req.MaxReplicas, req.CPUTargetPercent)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, hpa)
}

// DeleteHPA — HPA'yı siler.
// DELETE /k8s/hpa/:name
func (h *Handler) DeleteHPA(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}

	name := c.Param("name")
	if name == "" {
		response.BadRequest(c, "deployment adı gerekli")
		return
	}

	if err := h.client.DeleteHPA(c.Request.Context(), name); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "HPA başarıyla silindi"})
}

// GetNodes — cluster node'larını listeler.
// GET /k8s/nodes
func (h *Handler) GetNodes(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}

	nodes, err := h.client.GetNodes(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	if nodes == nil {
		nodes = []NodeInfo{}
	}

	response.Success(c, gin.H{
		"nodes": nodes,
		"count": len(nodes),
	})
}

// ListDeployments — namespace'deki tüm deployment'ları listeler.
// GET /k8s/deployments
func (h *Handler) ListDeployments(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}

	deployments, err := h.client.ListDeployments(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	if deployments == nil {
		deployments = []DeploymentInfo{}
	}

	response.Success(c, gin.H{
		"deployments": deployments,
		"count":       len(deployments),
	})
}

// GetAllPods — namespace'deki tüm pod'ları listeler.
// GET /k8s/pods/all
func (h *Handler) GetAllPods(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}

	pods, err := h.client.GetAllPods(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	if pods == nil {
		pods = []PodInfo{}
	}

	response.Success(c, gin.H{
		"pods":  pods,
		"count": len(pods),
	})
}

// GetServiceEndpoints — K8s service'in endpoint'lerini döndürür.
// GET /k8s/endpoints/:name
func (h *Handler) GetServiceEndpoints(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}

	name := c.Param("name")
	if name == "" {
		response.BadRequest(c, "service adı gerekli")
		return
	}

	endpoints, err := h.client.GetServiceEndpoints(c.Request.Context(), name)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Error(c, http.StatusNotFound, "servis endpoint'i bulunamadı: "+name)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"service":   name,
		"endpoints": endpoints,
		"count":     len(endpoints),
	})
}

// GetPodLogs — pod loglarını döndürür.
// GET /k8s/pods/:name/logs?lines=100
func (h *Handler) GetPodLogs(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}

	name := c.Param("name")
	if name == "" {
		response.BadRequest(c, "pod adı gerekli")
		return
	}

	lines := parseIntParam(c, "lines", 100)
	if lines < 1 {
		lines = 100
	}
	if lines > 2000 {
		lines = 2000
	}

	logs, err := h.client.GetPodLogs(c.Request.Context(), name, lines)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Error(c, http.StatusNotFound, "pod bulunamadı: "+name)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, gin.H{"pod": name, "lines": lines, "logs": logs})
}

// DeletePod — pod'u siler (K8s yeniden başlatır).
// DELETE /k8s/pods/:name
func (h *Handler) DeletePod(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}

	name := c.Param("name")
	if name == "" {
		response.BadRequest(c, "pod adı gerekli")
		return
	}

	if err := h.client.DeletePod(c.Request.Context(), name); err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Error(c, http.StatusNotFound, "pod bulunamadı: "+name)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "Pod silindi, K8s yeniden başlatıyor: " + name})
}

// RolloutRestart — deployment'ı rolling restart ile yeniden başlatır.
// POST /k8s/deployments/:name/restart
func (h *Handler) RolloutRestart(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}

	name := c.Param("name")
	if name == "" {
		response.BadRequest(c, "deployment adı gerekli")
		return
	}

	if err := h.client.RolloutRestart(c.Request.Context(), name); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "Rollout restart başlatıldı: " + name})
}

// ListServices — namespace'deki K8s service'lerini listeler.
// GET /k8s/services
func (h *Handler) ListServices(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}

	services, err := h.client.ListServices(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	if services == nil {
		services = []ServiceInfo{}
	}

	response.Success(c, gin.H{"services": services, "count": len(services)})
}

// ListHPAs — namespace'deki tüm HPA'ları listeler.
// GET /k8s/hpa
func (h *Handler) ListHPAs(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}

	hpas, err := h.client.ListHPAs(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	if hpas == nil {
		hpas = []HPAInfo{}
	}

	response.Success(c, gin.H{"hpas": hpas, "count": len(hpas)})
}

// DeployService — NanoNet servisini K8s'e Deployment+Service olarak yayınlar.
// POST /k8s/deploy
func (h *Handler) DeployService(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}
	var req struct {
		Name     string `json:"name" binding:"required"`
		Image    string `json:"image" binding:"required"`
		Port     int32  `json:"port" binding:"required"`
		Replicas int32  `json:"replicas"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if req.Replicas <= 0 {
		req.Replicas = 1
	}
	slug, err := h.client.DeployService(c.Request.Context(), req.Name, req.Image, req.Port, req.Replicas)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, gin.H{
		"message":  req.Name + " başarıyla K8s'e dağıtıldı",
		"k8s_name": slug,
	})
}

// UndeployService — NanoNet servisini K8s'ten kaldırır.
// DELETE /k8s/deploy/:name
func (h *Handler) UndeployService(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}
	name := c.Param("name")
	if name == "" {
		response.BadRequest(c, "servis adı gerekli")
		return
	}
	if err := h.client.UndeployService(c.Request.Context(), name); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, gin.H{"message": name + " K8s'ten kaldırıldı"})
}

// GetEvents — namespace'deki K8s event'lerini listeler.
// GET /k8s/events?kind=Pod
func (h *Handler) GetEvents(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}
	kind := c.Query("kind")
	events, err := h.client.GetEvents(c.Request.Context(), kind)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	if events == nil {
		events = []EventInfo{}
	}
	response.Success(c, gin.H{
		"events": events,
		"count":  len(events),
	})
}

// GetTopPods — kubectl top pods (metrics-server gerektirir).
// GET /k8s/top/pods
func (h *Handler) GetTopPods(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}
	usages, err := h.client.GetTopPods(c.Request.Context())
	if err != nil {
		// metrics-server yoksa 503 ile bildir, 500 değil
		response.Error(c, http.StatusServiceUnavailable, err.Error())
		return
	}
	if usages == nil {
		usages = []ResourceUsage{}
	}
	response.Success(c, gin.H{"pods": usages, "count": len(usages)})
}

// GetTopNodes — kubectl top nodes (metrics-server gerektirir).
// GET /k8s/top/nodes
func (h *Handler) GetTopNodes(c *gin.Context) {
	if !h.k8sCheck(c) {
		return
	}
	usages, err := h.client.GetTopNodes(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, err.Error())
		return
	}
	if usages == nil {
		usages = []ResourceUsage{}
	}
	response.Success(c, gin.H{"nodes": usages, "count": len(usages)})
}

// parseIntParam — query param'ı int'e çevirir.
func parseIntParam(c *gin.Context, key string, defaultVal int) int {
	val := c.Query(key)
	if val == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(val)
	if err != nil {
		return defaultVal
	}
	return v
}
