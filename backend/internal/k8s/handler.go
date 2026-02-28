package k8s

import (
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

// GetServiceEndpoints — K8s service endpoint'lerini listeler.
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
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"service":   name,
		"endpoints": endpoints,
		"count":     len(endpoints),
	})
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
