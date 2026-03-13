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
	Name           string            `json:"name"`
	Status         string            `json:"status"`
	Ready          bool              `json:"ready"`
	Restarts       int32             `json:"restarts"`
	Node           string            `json:"node"`
	IP             string            `json:"ip"`
	StartTime      *time.Time        `json:"start_time,omitempty"`
	Age            string            `json:"age,omitempty"`
	ContainerCount int32             `json:"container_count"`
	ReadyCount     int32             `json:"ready_count"`
	Labels         map[string]string `json:"labels,omitempty"`
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
	DeploymentName  string `json:"deployment_name,omitempty"`
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

// ServiceInfo — Kubernetes service bilgisi.
type ServiceInfo struct {
	Name       string            `json:"name"`
	Namespace  string            `json:"namespace"`
	Type       string            `json:"type"`
	ClusterIP  string            `json:"cluster_ip"`
	ExternalIP string            `json:"external_ip"`
	Ports      []string          `json:"ports"`
	Selector   map[string]string `json:"selector,omitempty"`
	Age        string            `json:"age,omitempty"`
}

// formatAge — zaman farkını okunabilir formata dönüştürür.
func formatAge(t *time.Time) string {
	if t == nil {
		return ""
	}
	d := time.Since(*t)
	switch {
	case d < time.Minute:
		return fmt.Sprintf("%ds", int(d.Seconds()))
	case d < time.Hour:
		return fmt.Sprintf("%dm", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%dh", int(d.Hours()))
	default:
		return fmt.Sprintf("%dd", int(d.Hours()/24))
	}
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

		info.ContainerCount = int32(len(item.Status.ContainerStatuses))
		for _, cs := range item.Status.ContainerStatuses {
			info.Restarts += cs.RestartCount
			if cs.Ready {
				info.ReadyCount++
			}
		}
		if info.ContainerCount > 0 {
			info.Ready = info.ReadyCount == info.ContainerCount
		}
		info.Age = formatAge(info.StartTime)

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

	// Apply (timeout ve namespace yönetimi runKubectlWithStdin içinde)
	if _, err := c.runKubectlWithStdin(ctx, yaml, "apply", "-f", "-"); err != nil {
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
		info.ContainerCount = int32(len(item.Status.ContainerStatuses))
		for _, cs := range item.Status.ContainerStatuses {
			info.Restarts += cs.RestartCount
			if cs.Ready {
				info.ReadyCount++
			}
		}
		if info.ContainerCount > 0 {
			info.Ready = info.ReadyCount == info.ContainerCount
		}
		info.Age = formatAge(info.StartTime)
		pods = append(pods, info)
	}

	return pods, nil
}

// GetPodLogs — pod loglarını döndürür.
func (c *Client) GetPodLogs(ctx context.Context, podName string, lines int) (string, error) {
	args := []string{"logs", podName, fmt.Sprintf("--tail=%d", lines), "--timestamps=false"}
	output, err := c.runKubectl(ctx, args...)
	if err != nil {
		return "", fmt.Errorf("pod logları alınamadı: %w", err)
	}
	return string(output), nil
}

// DeletePod — pod'u siler (K8s otomatik yeniden başlatır).
func (c *Client) DeletePod(ctx context.Context, podName string) error {
	_, err := c.runKubectl(ctx, "delete", "pod", podName, "--grace-period=0")
	if err != nil {
		return fmt.Errorf("pod silinemedi: %w", err)
	}
	return nil
}

// RolloutRestart — deployment'ı sıfırdan başlatır (rolling restart).
func (c *Client) RolloutRestart(ctx context.Context, deploymentName string) error {
	_, err := c.runKubectl(ctx, "rollout", "restart", "deployment", deploymentName)
	if err != nil {
		return fmt.Errorf("rollout restart başarısız: %w", err)
	}
	return nil
}

// ListServices — namespace'deki K8s service'lerini listeler.
func (c *Client) ListServices(ctx context.Context) ([]ServiceInfo, error) {
	output, err := c.runKubectl(ctx, "get", "services", "-o", "json")
	if err != nil {
		return nil, fmt.Errorf("service'ler alınamadı: %w", err)
	}

	var result struct {
		Items []struct {
			Metadata struct {
				Name              string     `json:"name"`
				Namespace         string     `json:"namespace"`
				CreationTimestamp *time.Time `json:"creationTimestamp"`
			} `json:"metadata"`
			Spec struct {
				Type      string `json:"type"`
				ClusterIP string `json:"clusterIP"`
				Ports     []struct {
					Port       int32       `json:"port"`
					TargetPort interface{} `json:"targetPort"`
					Protocol   string      `json:"protocol"`
					NodePort   int32       `json:"nodePort,omitempty"`
				} `json:"ports"`
				Selector map[string]string `json:"selector"`
			} `json:"spec"`
			Status struct {
				LoadBalancer struct {
					Ingress []struct {
						IP       string `json:"ip"`
						Hostname string `json:"hostname"`
					} `json:"ingress"`
				} `json:"loadBalancer"`
			} `json:"status"`
		} `json:"items"`
	}

	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("JSON parse hatası: %w", err)
	}

	var services []ServiceInfo
	for _, item := range result.Items {
		externalIP := ""
		for _, ing := range item.Status.LoadBalancer.Ingress {
			if ing.IP != "" {
				externalIP = ing.IP
				break
			}
			if ing.Hostname != "" {
				externalIP = ing.Hostname
				break
			}
		}

		var ports []string
		for _, p := range item.Spec.Ports {
			entry := fmt.Sprintf("%d/%s", p.Port, p.Protocol)
			if p.NodePort > 0 {
				entry += fmt.Sprintf(":%d", p.NodePort)
			}
			ports = append(ports, entry)
		}

		services = append(services, ServiceInfo{
			Name:       item.Metadata.Name,
			Namespace:  item.Metadata.Namespace,
			Type:       item.Spec.Type,
			ClusterIP:  item.Spec.ClusterIP,
			ExternalIP: externalIP,
			Ports:      ports,
			Selector:   item.Spec.Selector,
			Age:        formatAge(item.Metadata.CreationTimestamp),
		})
	}

	return services, nil
}

// runKubectlWithStdin — kubectl komutunu stdin input ile çalıştırır.
func (c *Client) runKubectlWithStdin(ctx context.Context, input string, args ...string) ([]byte, error) {
	cmdArgs := []string{}
	if c.kubeconfig != "" {
		cmdArgs = append(cmdArgs, "--kubeconfig", c.kubeconfig)
	}
	if c.namespace != "" && c.namespace != "default" {
		cmdArgs = append(cmdArgs, "-n", c.namespace)
	}
	cmdArgs = append(cmdArgs, args...)

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "kubectl", cmdArgs...)
	cmd.Stdin = strings.NewReader(input)
	out, err := cmd.CombinedOutput()
	if err != nil && strings.Contains(string(out), "not found") {
		return out, ErrNotFound
	}
	return out, err
}

// EventInfo — K8s event bilgisi.
type EventInfo struct {
	Name      string     `json:"name"`
	Reason    string     `json:"reason"`
	Message   string     `json:"message"`
	Kind      string     `json:"kind"`
	Object    string     `json:"object"`
	Type      string     `json:"type"` // Normal | Warning
	Count     int32      `json:"count"`
	FirstTime *time.Time `json:"first_time,omitempty"`
	LastTime  *time.Time `json:"last_time,omitempty"`
	Age       string     `json:"age,omitempty"`
}

// GetEvents — namespace'deki K8s event'lerini listeler. kind ile filtreleme opsiyonel ("Pod", "Deployment" vb.).
func (c *Client) GetEvents(ctx context.Context, kind string) ([]EventInfo, error) {
	args := []string{"get", "events", "-o", "json", "--sort-by=.lastTimestamp"}
	if kind != "" {
		args = append(args, "--field-selector", "involvedObject.kind="+kind)
	}
	output, err := c.runKubectl(ctx, args...)
	if err != nil {
		return nil, fmt.Errorf("event'ler alınamadı: %w", err)
	}

	var result struct {
		Items []struct {
			Metadata struct {
				Name string `json:"name"`
			} `json:"metadata"`
			Reason         string `json:"reason"`
			Message        string `json:"message"`
			Type           string `json:"type"`
			Count          int32  `json:"count"`
			InvolvedObject struct {
				Kind string `json:"kind"`
				Name string `json:"name"`
			} `json:"involvedObject"`
			FirstTimestamp *time.Time `json:"firstTimestamp"`
			LastTimestamp  *time.Time `json:"lastTimestamp"`
		} `json:"items"`
	}

	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("JSON parse hatası: %w", err)
	}

	events := make([]EventInfo, 0, len(result.Items))
	for i := len(result.Items) - 1; i >= 0; i-- { // newest first
		item := result.Items[i]
		events = append(events, EventInfo{
			Name:      item.Metadata.Name,
			Reason:    item.Reason,
			Message:   item.Message,
			Type:      item.Type,
			Count:     item.Count,
			Kind:      item.InvolvedObject.Kind,
			Object:    item.InvolvedObject.Name,
			FirstTime: item.FirstTimestamp,
			LastTime:  item.LastTimestamp,
			Age:       formatAge(item.LastTimestamp),
		})
	}

	return events, nil
}

// ResourceUsage — pod kaynak kullanım özeti.
type ResourceUsage struct {
	PodName       string `json:"pod_name"`
	Namespace     string `json:"namespace"`
	CPU           string `json:"cpu"`
	Memory        string `json:"memory"`
	CPUPercent    string `json:"cpu_percent,omitempty"`
	MemoryPercent string `json:"memory_percent,omitempty"`
}

// GetTopPods — kubectl top pods ile anlık CPU/memory kullanımını döndürür.
// metrics-server gerektirir; yoksa hata döner.
func (c *Client) GetTopPods(ctx context.Context) ([]ResourceUsage, error) {
	output, err := c.runKubectl(ctx, "top", "pods", "--no-headers")
	if err != nil {
		return nil, fmt.Errorf("pod metrikleri alınamadı (metrics-server kurulu mu?): %w", err)
	}

	var usages []ResourceUsage
	for _, line := range strings.Split(strings.TrimSpace(string(output)), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		usages = append(usages, ResourceUsage{
			PodName:   fields[0],
			Namespace: c.namespace,
			CPU:       fields[1],
			Memory:    fields[2],
		})
	}
	return usages, nil
}

// GetTopNodes — kubectl top nodes ile node CPU/memory kullanımını döndürür.
func (c *Client) GetTopNodes(ctx context.Context) ([]ResourceUsage, error) {
	output, err := c.runKubectl(ctx, "top", "nodes", "--no-headers")
	if err != nil {
		return nil, fmt.Errorf("node metrikleri alınamadı (metrics-server kurulu mu?): %w", err)
	}

	var usages []ResourceUsage
	for _, line := range strings.Split(strings.TrimSpace(string(output)), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}
		usages = append(usages, ResourceUsage{
			PodName:       fields[0], // node name
			CPU:           fields[1],
			CPUPercent:    fields[2],
			Memory:        fields[3],
			MemoryPercent: fields[4],
		})
	}
	return usages, nil
}

// slugify — Servis adından K8s uyumlu kaynak adı üretir.
func slugify(name string) string {
	lower := strings.ToLower(name)
	var r []rune
	for _, ch := range lower {
		if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') {
			r = append(r, ch)
		} else {
			r = append(r, '-')
		}
	}
	s := strings.Trim(string(r), "-")
	for strings.Contains(s, "--") {
		s = strings.ReplaceAll(s, "--", "-")
	}
	return s
}

// DeployService — NanoNet servisini K8s'e Deployment + Service olarak yayınlar.
func (c *Client) DeployService(ctx context.Context, name, image string, port, replicas int32) (string, error) {
	slug := slugify(name)
	if slug == "" {
		return "", fmt.Errorf("geçersiz servis adı: %q", name)
	}
	if replicas <= 0 {
		replicas = 1
	}

	yaml := fmt.Sprintf(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: %s
  labels:
    app: %s
    managed-by: nanonet
    nanonet-service: "true"
spec:
  replicas: %d
  selector:
    matchLabels:
      app: %s
  template:
    metadata:
      labels:
        app: %s
        managed-by: nanonet
    spec:
      containers:
      - name: %s
        image: %s
        ports:
        - containerPort: %d
---
apiVersion: v1
kind: Service
metadata:
  name: %s
  labels:
    managed-by: nanonet
    nanonet-service: "true"
spec:
  selector:
    app: %s
  ports:
  - port: %d
    targetPort: %d
    protocol: TCP
  type: ClusterIP
`, slug, slug, replicas, slug, slug, slug, image, port, slug, slug, port, port)

	out, err := c.runKubectlWithStdin(ctx, yaml, "apply", "-f", "-")
	if err != nil {
		return slug, fmt.Errorf("deploy hatası: %w — %s", err, strings.TrimSpace(string(out)))
	}
	return slug, nil
}

// UndeployService — NanoNet servisini K8s'ten kaldırır.
func (c *Client) UndeployService(ctx context.Context, name string) error {
	slug := slugify(name)
	if slug == "" {
		return fmt.Errorf("geçersiz servis adı")
	}
	out, err := c.runKubectl(ctx, "delete", "deployment,service,hpa", slug, "--ignore-not-found", "--grace-period=5")
	if err != nil && !errors.Is(err, ErrNotFound) {
		return fmt.Errorf("undeploy hatası: %w — %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

// ListHPAs — namespace'deki tüm HPA'ları listeler.
func (c *Client) ListHPAs(ctx context.Context) ([]HPAInfo, error) {
	output, err := c.runKubectl(ctx, "get", "hpa", "-o", "json")
	if err != nil {
		return nil, fmt.Errorf("HPA'lar alınamadı: %w", err)
	}

	var result struct {
		Items []struct {
			Metadata struct {
				Name string `json:"name"`
			} `json:"metadata"`
			Spec struct {
				MinReplicas    int32 `json:"minReplicas"`
				MaxReplicas    int32 `json:"maxReplicas"`
				ScaleTargetRef struct {
					Name string `json:"name"`
				} `json:"scaleTargetRef"`
				Metrics []struct {
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
		} `json:"items"`
	}

	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("JSON parse hatası: %w", err)
	}

	var hpas []HPAInfo
	for _, item := range result.Items {
		info := HPAInfo{
			Name:            item.Metadata.Name,
			DeploymentName:  item.Spec.ScaleTargetRef.Name,
			MinReplicas:     item.Spec.MinReplicas,
			MaxReplicas:     item.Spec.MaxReplicas,
			CurrentReplicas: item.Status.CurrentReplicas,
			DesiredReplicas: item.Status.DesiredReplicas,
		}
		for _, m := range item.Spec.Metrics {
			if m.Resource.Name == "cpu" && m.Resource.Target.AverageUtilization != nil {
				info.CPUTarget = m.Resource.Target.AverageUtilization
			}
		}
		for _, m := range item.Status.CurrentMetrics {
			if m.Resource.Name == "cpu" && m.Resource.Current.AverageUtilization != nil {
				info.CPUCurrent = m.Resource.Current.AverageUtilization
			}
		}
		hpas = append(hpas, info)
	}

	return hpas, nil
}
