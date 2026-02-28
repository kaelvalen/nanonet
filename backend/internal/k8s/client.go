package k8s

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

// ErrNotFound — kaynak K8s'de bulunamadı.
var ErrNotFound = errors.New("not found")

// Client — Kubernetes ile iletişim kuran istemci (kubectl CLI tabanlı).
type Client struct {
	namespace  string
	kubeconfig string
}

// PodInfo — pod bilgisi.
type PodInfo struct {
	Name      string            `json:"name"`
	Status    string            `json:"status"`
	Ready     bool              `json:"ready"`
	Restarts  int32             `json:"restarts"`
	Node      string            `json:"node"`
	IP        string            `json:"ip"`
	StartTime *time.Time        `json:"start_time,omitempty"`
	Labels    map[string]string `json:"labels,omitempty"`
}

// DeploymentInfo — deployment bilgisi.
type DeploymentInfo struct {
	Name              string `json:"name"`
	Namespace         string `json:"namespace"`
	Replicas          int32  `json:"replicas"`
	ReadyReplicas     int32  `json:"ready_replicas"`
	AvailableReplicas int32  `json:"available_replicas"`
	UpdatedReplicas   int32  `json:"updated_replicas"`
	Strategy          string `json:"strategy"`
}

// HPAInfo — HorizontalPodAutoscaler bilgisi.
type HPAInfo struct {
	Name            string `json:"name"`
	MinReplicas     int32  `json:"min_replicas"`
	MaxReplicas     int32  `json:"max_replicas"`
	CurrentReplicas int32  `json:"current_replicas"`
	DesiredReplicas int32  `json:"desired_replicas"`
	CPUTarget       *int32 `json:"cpu_target_percent,omitempty"`
	CPUCurrent      *int32 `json:"cpu_current_percent,omitempty"`
	MemTarget       *int64 `json:"mem_target_mb,omitempty"`
}

// ScaleResult — scale işlemi sonucu.
type ScaleResult struct {
	PreviousReplicas int32  `json:"previous_replicas"`
	DesiredReplicas  int32  `json:"desired_replicas"`
	Message          string `json:"message"`
}

// NewClient — yeni K8s Client oluşturur.
func NewClient(namespace string) (*Client, error) {
	kubeconfig := os.Getenv("KUBECONFIG")
	if kubeconfig == "" {
		home, _ := os.UserHomeDir()
		kubeconfig = fmt.Sprintf("%s/.kube/config", home)
	}

	client := &Client{
		namespace:  namespace,
		kubeconfig: kubeconfig,
	}

	// Test connection
	if !client.IsAvailable(context.Background()) {
		return nil, fmt.Errorf("kubernetes cluster'a erişilemiyor")
	}

	return client, nil
}

// runKubectl — kubectl komutu çalıştırır.
func (c *Client) runKubectl(ctx context.Context, args ...string) ([]byte, error) {
	cmdArgs := []string{}
	if c.kubeconfig != "" {
		cmdArgs = append(cmdArgs, "--kubeconfig", c.kubeconfig)
	}
	if c.namespace != "" && c.namespace != "default" {
		cmdArgs = append(cmdArgs, "-n", c.namespace)
	}
	cmdArgs = append(cmdArgs, args...)

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "kubectl", cmdArgs...)
	out, err := cmd.CombinedOutput()
	if err != nil && strings.Contains(string(out), "not found") {
		return out, ErrNotFound
	}
	return out, err
}

// IsAvailable — K8s cluster'a erişilebilir mi kontrol eder.
func (c *Client) IsAvailable(ctx context.Context) bool {
	_, err := c.runKubectl(ctx, "cluster-info")
	return err == nil
}

// GetNamespaces — erişilebilir namespace'leri listeler.
func (c *Client) GetNamespaces(ctx context.Context) ([]string, error) {
	output, err := c.runKubectl(ctx, "get", "namespaces", "-o", "json")
	if err != nil {
		return nil, fmt.Errorf("namespace'ler alınamadı: %w", err)
	}

	var result struct {
		Items []struct {
			Metadata struct {
				Name string `json:"name"`
			} `json:"metadata"`
		} `json:"items"`
	}

	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("JSON parse hatası: %w", err)
	}

	var namespaces []string
	for _, item := range result.Items {
		namespaces = append(namespaces, item.Metadata.Name)
	}

	return namespaces, nil
}

// GetPods — belirtilen label selector ile pod'ları listeler.
func (c *Client) GetPods(ctx context.Context, selector string) ([]PodInfo, error) {
	args := []string{"get", "pods", "-l", selector, "-o", "json"}
	output, err := c.runKubectl(ctx, args...)
	if err != nil {
		return nil, fmt.Errorf("pod'lar alınamadı: %w", err)
	}

	var result struct {
		Items []struct {
			Metadata struct {
				Name   string            `json:"name"`
				Labels map[string]string `json:"labels"`
			} `json:"metadata"`
			Status struct {
				Phase             string     `json:"phase"`
				PodIP             string     `json:"podIP"`
				StartTime         *time.Time `json:"startTime"`
				ContainerStatuses []struct {
					Ready        bool  `json:"ready"`
					RestartCount int32 `json:"restartCount"`
				} `json:"containerStatuses"`
			} `json:"status"`
			Spec struct {
				NodeName string `json:"nodeName"`
			} `json:"spec"`
		} `json:"items"`
	}

	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("JSON parse hatası: %w", err)
	}

	var pods []PodInfo
	for _, item := range result.Items {
		info := PodInfo{
			Name:   item.Metadata.Name,
			Status: item.Status.Phase,
			Node:   item.Spec.NodeName,
			IP:     item.Status.PodIP,
			Labels: item.Metadata.Labels,
		}

		if item.Status.StartTime != nil {
			info.StartTime = item.Status.StartTime
		}

		for _, cs := range item.Status.ContainerStatuses {
			info.Ready = cs.Ready
			info.Restarts = cs.RestartCount
			break
		}

		pods = append(pods, info)
	}

	return pods, nil
}

// GetDeployment — deployment bilgisini döndürür.
func (c *Client) GetDeployment(ctx context.Context, name string) (*DeploymentInfo, error) {
	output, err := c.runKubectl(ctx, "get", "deployment", name, "-o", "json")
	if err != nil {
		return nil, fmt.Errorf("deployment alınamadı: %w", err)
	}

	var result struct {
		Spec struct {
			Replicas *int32 `json:"replicas"`
			Strategy struct {
				Type string `json:"type"`
			} `json:"strategy"`
		} `json:"spec"`
		Status struct {
			Replicas          int32 `json:"replicas"`
			ReadyReplicas     int32 `json:"readyReplicas"`
			AvailableReplicas int32 `json:"availableReplicas"`
			UpdatedReplicas   int32 `json:"updatedReplicas"`
		} `json:"status"`
		Metadata struct {
			Name      string `json:"name"`
			Namespace string `json:"namespace"`
		} `json:"metadata"`
	}

	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("JSON parse hatası: %w", err)
	}

	replicas := int32(1)
	if result.Spec.Replicas != nil {
		replicas = *result.Spec.Replicas
	}

	return &DeploymentInfo{
		Name:              result.Metadata.Name,
		Namespace:         result.Metadata.Namespace,
		Replicas:          replicas,
		ReadyReplicas:     result.Status.ReadyReplicas,
		AvailableReplicas: result.Status.AvailableReplicas,
		UpdatedReplicas:   result.Status.UpdatedReplicas,
		Strategy:          result.Spec.Strategy.Type,
	}, nil
}

// ScaleDeployment — deployment'ı belirlenen replica sayısına ölçekler.
func (c *Client) ScaleDeployment(ctx context.Context, name string, replicas int32) (*ScaleResult, error) {
	// Mevcut replica sayısını al
	current, err := c.GetDeployment(ctx, name)
	if err != nil {
		return nil, fmt.Errorf("mevcut deployment alınamadı: %w", err)
	}

	// Scale işlemi
	_, err = c.runKubectl(ctx, "scale", "deployment", name, "--replicas", fmt.Sprintf("%d", replicas))
	if err != nil {
		return nil, fmt.Errorf("scale işlemi başarısız: %w", err)
	}

	return &ScaleResult{
		PreviousReplicas: current.Replicas,
		DesiredReplicas:  replicas,
		Message:          fmt.Sprintf("Deployment %s başarıyla %d replica'ya ölçeklendi", name, replicas),
	}, nil
}

// GetHPA — HorizontalPodAutoscaler bilgisini döndürür.
func (c *Client) GetHPA(ctx context.Context, name string) (*HPAInfo, error) {
	output, err := c.runKubectl(ctx, "get", "hpa", name, "-o", "json")
	if err != nil {
		return nil, fmt.Errorf("HPA alınamadı: %w", err)
	}

	var result struct {
		Spec struct {
			MinReplicas int32 `json:"minReplicas"`
			MaxReplicas int32 `json:"maxReplicas"`
			Metrics     []struct {
				Resource struct {
					Name   string `json:"name"`
					Target struct {
						AverageUtilization *int32 `json:"averageUtilization"`
					} `json:"target"`
				} `json:"resource"`
			} `json:"metrics"`
		} `json:"spec"`
		Status struct {
			CurrentReplicas int32 `json:"currentReplicas"`
			DesiredReplicas int32 `json:"desiredReplicas"`
			CurrentMetrics  []struct {
				Resource struct {
					Name    string `json:"name"`
					Current struct {
						AverageUtilization *int32 `json:"averageUtilization"`
					} `json:"current"`
				} `json:"resource"`
			} `json:"currentMetrics"`
		} `json:"status"`
	}

	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("JSON parse hatası: %w", err)
	}

	info := &HPAInfo{
		MinReplicas:     result.Spec.MinReplicas,
		MaxReplicas:     result.Spec.MaxReplicas,
		CurrentReplicas: result.Status.CurrentReplicas,
		DesiredReplicas: result.Status.DesiredReplicas,
	}

	// CPU target
	for _, metric := range result.Spec.Metrics {
		if metric.Resource.Name == "cpu" && metric.Resource.Target.AverageUtilization != nil {
			info.CPUTarget = metric.Resource.Target.AverageUtilization
		}
	}

	// CPU current
	for _, metric := range result.Status.CurrentMetrics {
		if metric.Resource.Name == "cpu" && metric.Resource.Current.AverageUtilization != nil {
			info.CPUCurrent = metric.Resource.Current.AverageUtilization
		}
	}

	return info, nil
}

// CreateOrUpdateHPA — HPA oluşturur veya günceller.
func (c *Client) CreateOrUpdateHPA(ctx context.Context, deploymentName string, minReplicas, maxReplicas, cpuTargetPercent int32) (*HPAInfo, error) {
	hpaName := deploymentName + "-hpa"

	// YAML manifest oluştur
	yaml := fmt.Sprintf(`apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: %s
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: %s
  minReplicas: %d
  maxReplicas: %d
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: %d
`, hpaName, deploymentName, minReplicas, maxReplicas, cpuTargetPercent)

	// Apply
	cmd := exec.CommandContext(ctx, "kubectl", "apply", "-f", "-")
	cmd.Stdin = strings.NewReader(yaml)
	if c.kubeconfig != "" {
		cmd.Args = append(cmd.Args, "--kubeconfig", c.kubeconfig)
	}
	if c.namespace != "" && c.namespace != "default" {
		cmd.Args = append(cmd.Args, "-n", c.namespace)
	}

	if _, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("HPA oluşturulamadı: %w", err)
	}

	return c.GetHPA(ctx, hpaName)
}

// DeleteHPA — HPA'yı siler.
func (c *Client) DeleteHPA(ctx context.Context, name string) error {
	hpaName := name + "-hpa"
	_, err := c.runKubectl(ctx, "delete", "hpa", hpaName)
	if err != nil {
		return fmt.Errorf("HPA silinemedi: %w", err)
	}
	return nil
}

// GetServiceEndpoints — K8s service'in endpoint'lerini döndürür.
func (c *Client) GetServiceEndpoints(ctx context.Context, name string) ([]string, error) {
	output, err := c.runKubectl(ctx, "get", "endpoints", name, "-o", "json")
	if err != nil {
		return nil, fmt.Errorf("endpoint bilgisi alınamadı: %w", err)
	}

	var result struct {
		Subsets []struct {
			Addresses []struct {
				IP string `json:"ip"`
			} `json:"addresses"`
			Ports []struct {
				Port int32 `json:"port"`
			} `json:"ports"`
		} `json:"subsets"`
	}

	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("JSON parse hatası: %w", err)
	}

	var endpoints []string
	for _, subset := range result.Subsets {
		for _, addr := range subset.Addresses {
			for _, port := range subset.Ports {
				endpoints = append(endpoints, fmt.Sprintf("%s:%d", addr.IP, port.Port))
			}
		}
	}

	return endpoints, nil
}

// NodeInfo — node bilgisi.
type NodeInfo struct {
	Name      string            `json:"name"`
	Status    string            `json:"status"`
	Ready     bool              `json:"ready"`
	Roles     []string          `json:"roles"`
	Version   string            `json:"version"`
	OS        string            `json:"os"`
	Arch      string            `json:"arch"`
	CPU       string            `json:"cpu"`
	Memory    string            `json:"memory"`
	Labels    map[string]string `json:"labels,omitempty"`
	CreatedAt *time.Time        `json:"created_at,omitempty"`
}

// GetNodes — cluster node'larını listeler.
func (c *Client) GetNodes(ctx context.Context) ([]NodeInfo, error) {
	output, err := c.runKubectl(ctx, "get", "nodes", "-o", "json")
	if err != nil {
		return nil, fmt.Errorf("node'lar alınamadı: %w", err)
	}

	var result struct {
		Items []struct {
			Metadata struct {
				Name              string            `json:"name"`
				Labels            map[string]string `json:"labels"`
				CreationTimestamp *time.Time        `json:"creationTimestamp"`
			} `json:"metadata"`
			Status struct {
				Conditions []struct {
					Type   string `json:"type"`
					Status string `json:"status"`
				} `json:"conditions"`
				NodeInfo struct {
					KubeletVersion  string `json:"kubeletVersion"`
					OperatingSystem string `json:"operatingSystem"`
					Architecture    string `json:"architecture"`
				} `json:"nodeInfo"`
				Capacity struct {
					CPU    string `json:"cpu"`
					Memory string `json:"memory"`
				} `json:"capacity"`
			} `json:"status"`
		} `json:"items"`
	}

	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("JSON parse hatası: %w", err)
	}

	var nodes []NodeInfo
	for _, item := range result.Items {
		ready := false
		for _, cond := range item.Status.Conditions {
			if cond.Type == "Ready" && cond.Status == "True" {
				ready = true
			}
		}

		var roles []string
		for k := range item.Metadata.Labels {
			if strings.HasPrefix(k, "node-role.kubernetes.io/") {
				role := strings.TrimPrefix(k, "node-role.kubernetes.io/")
				roles = append(roles, role)
			}
		}
		if len(roles) == 0 {
			roles = []string{"worker"}
		}

		status := "NotReady"
		if ready {
			status = "Ready"
		}

		nodes = append(nodes, NodeInfo{
			Name:      item.Metadata.Name,
			Status:    status,
			Ready:     ready,
			Roles:     roles,
			Version:   item.Status.NodeInfo.KubeletVersion,
			OS:        item.Status.NodeInfo.OperatingSystem,
			Arch:      item.Status.NodeInfo.Architecture,
			CPU:       item.Status.Capacity.CPU,
			Memory:    item.Status.Capacity.Memory,
			Labels:    item.Metadata.Labels,
			CreatedAt: item.Metadata.CreationTimestamp,
		})
	}

	return nodes, nil
}

// ListDeployments — namespace'deki tüm deployment'ları listeler.
func (c *Client) ListDeployments(ctx context.Context) ([]DeploymentInfo, error) {
	output, err := c.runKubectl(ctx, "get", "deployments", "-o", "json")
	if err != nil {
		return nil, fmt.Errorf("deployment'lar alınamadı: %w", err)
	}

	var result struct {
		Items []struct {
			Metadata struct {
				Name      string `json:"name"`
				Namespace string `json:"namespace"`
			} `json:"metadata"`
			Spec struct {
				Replicas *int32 `json:"replicas"`
				Strategy struct {
					Type string `json:"type"`
				} `json:"strategy"`
			} `json:"spec"`
			Status struct {
				Replicas          int32 `json:"replicas"`
				ReadyReplicas     int32 `json:"readyReplicas"`
				AvailableReplicas int32 `json:"availableReplicas"`
				UpdatedReplicas   int32 `json:"updatedReplicas"`
			} `json:"status"`
		} `json:"items"`
	}

	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("JSON parse hatası: %w", err)
	}

	var deployments []DeploymentInfo
	for _, item := range result.Items {
		replicas := int32(1)
		if item.Spec.Replicas != nil {
			replicas = *item.Spec.Replicas
		}
		deployments = append(deployments, DeploymentInfo{
			Name:              item.Metadata.Name,
			Namespace:         item.Metadata.Namespace,
			Replicas:          replicas,
			ReadyReplicas:     item.Status.ReadyReplicas,
			AvailableReplicas: item.Status.AvailableReplicas,
			UpdatedReplicas:   item.Status.UpdatedReplicas,
			Strategy:          item.Spec.Strategy.Type,
		})
	}

	return deployments, nil
}

// GetAllPods — namespace'deki tüm pod'ları listeler.
func (c *Client) GetAllPods(ctx context.Context) ([]PodInfo, error) {
	output, err := c.runKubectl(ctx, "get", "pods", "-o", "json")
	if err != nil {
		return nil, fmt.Errorf("pod'lar alınamadı: %w", err)
	}

	var result struct {
		Items []struct {
			Metadata struct {
				Name   string            `json:"name"`
				Labels map[string]string `json:"labels"`
			} `json:"metadata"`
			Status struct {
				Phase             string     `json:"phase"`
				PodIP             string     `json:"podIP"`
				StartTime         *time.Time `json:"startTime"`
				ContainerStatuses []struct {
					Ready        bool  `json:"ready"`
					RestartCount int32 `json:"restartCount"`
				} `json:"containerStatuses"`
			} `json:"status"`
			Spec struct {
				NodeName string `json:"nodeName"`
			} `json:"spec"`
		} `json:"items"`
	}

	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("JSON parse hatası: %w", err)
	}

	var pods []PodInfo
	for _, item := range result.Items {
		info := PodInfo{
			Name:   item.Metadata.Name,
			Status: item.Status.Phase,
			Node:   item.Spec.NodeName,
			IP:     item.Status.PodIP,
			Labels: item.Metadata.Labels,
		}
		if item.Status.StartTime != nil {
			info.StartTime = item.Status.StartTime
		}
		for _, cs := range item.Status.ContainerStatuses {
			info.Ready = cs.Ready
			info.Restarts = cs.RestartCount
			break
		}
		pods = append(pods, info)
	}

	return pods, nil
}
