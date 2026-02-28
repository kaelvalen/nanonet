package k8s

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	autoscalingv2 "k8s.io/api/autoscaling/v2"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// Client — Kubernetes ile iletişim kuran istemci.
type Client struct {
	clientset *kubernetes.Clientset
	namespace string
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
// Cluster içindeyse in-cluster config kullanır, değilse kubeconfig.
func NewClient(namespace string) (*Client, error) {
	var config *rest.Config
	var err error

	// Cluster içinde mi diye kontrol et
	config, err = rest.InClusterConfig()
	if err != nil {
		// Cluster dışında — kubeconfig dene
		kubeconfig := os.Getenv("KUBECONFIG")
		if kubeconfig == "" {
			home, _ := os.UserHomeDir()
			kubeconfig = filepath.Join(home, ".kube", "config")
		}
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return nil, fmt.Errorf("kubernetes client oluşturulamadı: %w", err)
		}
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("kubernetes clientset oluşturulamadı: %w", err)
	}

	if namespace == "" {
		namespace = "default"
	}

	log.Printf("[K8s] Client oluşturuldu (namespace: %s)", namespace)
	return &Client{clientset: clientset, namespace: namespace}, nil
}

// GetPods — belirtilen label selector ile pod'ları listeler.
// selector örn: "app=my-service"
func (c *Client) GetPods(ctx context.Context, selector string) ([]PodInfo, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	pods, err := c.clientset.CoreV1().Pods(c.namespace).List(ctx, metav1.ListOptions{
		LabelSelector: selector,
	})
	if err != nil {
		return nil, fmt.Errorf("pod listesi alınamadı: %w", err)
	}

	var result []PodInfo
	for _, pod := range pods.Items {
		info := PodInfo{
			Name:   pod.Name,
			Status: string(pod.Status.Phase),
			Node:   pod.Spec.NodeName,
			IP:     pod.Status.PodIP,
			Labels: pod.Labels,
		}

		if pod.Status.StartTime != nil {
			t := pod.Status.StartTime.Time
			info.StartTime = &t
		}

		// Container durumunu kontrol et
		for _, cs := range pod.Status.ContainerStatuses {
			info.Ready = cs.Ready
			info.Restarts = cs.RestartCount
			// İlk container yeterli — çoğu servis tek container
			break
		}

		result = append(result, info)
	}

	return result, nil
}

// GetDeployment — deployment bilgisini döndürür.
func (c *Client) GetDeployment(ctx context.Context, name string) (*DeploymentInfo, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	dep, err := c.clientset.AppsV1().Deployments(c.namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("deployment alınamadı: %w", err)
	}

	replicas := int32(1)
	if dep.Spec.Replicas != nil {
		replicas = *dep.Spec.Replicas
	}

	return &DeploymentInfo{
		Name:              dep.Name,
		Namespace:         dep.Namespace,
		Replicas:          replicas,
		ReadyReplicas:     dep.Status.ReadyReplicas,
		AvailableReplicas: dep.Status.AvailableReplicas,
		UpdatedReplicas:   dep.Status.UpdatedReplicas,
		Strategy:          string(dep.Spec.Strategy.Type),
	}, nil
}

// ScaleDeployment — deployment'ı belirlenen replica sayısına ölçekler.
func (c *Client) ScaleDeployment(ctx context.Context, name string, replicas int32) (*ScaleResult, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	if replicas < 0 || replicas > 100 {
		return nil, fmt.Errorf("geçersiz replica sayısı: %d (0-100 arası olmalı)", replicas)
	}

	// Mevcut scale'i oku
	scale, err := c.clientset.AppsV1().Deployments(c.namespace).GetScale(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("mevcut scale okunamadı: %w", err)
	}

	previousReplicas := scale.Spec.Replicas
	scale.Spec.Replicas = replicas

	_, err = c.clientset.AppsV1().Deployments(c.namespace).UpdateScale(ctx, name, scale, metav1.UpdateOptions{})
	if err != nil {
		return nil, fmt.Errorf("scale güncellenemedi: %w", err)
	}

	log.Printf("[K8s] Deployment %s scale edildi: %d -> %d", name, previousReplicas, replicas)

	return &ScaleResult{
		PreviousReplicas: previousReplicas,
		DesiredReplicas:  replicas,
		Message:          fmt.Sprintf("Deployment %s başarıyla %d replica'ya ölçeklendi", name, replicas),
	}, nil
}

// GetHPA — HorizontalPodAutoscaler bilgisini döndürür.
func (c *Client) GetHPA(ctx context.Context, name string) (*HPAInfo, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	hpa, err := c.clientset.AutoscalingV2().HorizontalPodAutoscalers(c.namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("HPA alınamadı: %w", err)
	}

	minReplicas := int32(1)
	if hpa.Spec.MinReplicas != nil {
		minReplicas = *hpa.Spec.MinReplicas
	}

	info := &HPAInfo{
		Name:            hpa.Name,
		MinReplicas:     minReplicas,
		MaxReplicas:     hpa.Spec.MaxReplicas,
		CurrentReplicas: hpa.Status.CurrentReplicas,
		DesiredReplicas: hpa.Status.DesiredReplicas,
	}

	// Metrik hedeflerini oku
	for _, metric := range hpa.Spec.Metrics {
		if metric.Type == autoscalingv2.ResourceMetricSourceType && metric.Resource != nil {
			if metric.Resource.Name == corev1.ResourceCPU && metric.Resource.Target.AverageUtilization != nil {
				v := *metric.Resource.Target.AverageUtilization
				info.CPUTarget = &v
			}
		}
	}

	// Mevcut metrik değerlerini oku
	for _, current := range hpa.Status.CurrentMetrics {
		if current.Type == autoscalingv2.ResourceMetricSourceType && current.Resource != nil {
			if current.Resource.Name == corev1.ResourceCPU && current.Resource.Current.AverageUtilization != nil {
				v := *current.Resource.Current.AverageUtilization
				info.CPUCurrent = &v
			}
		}
	}

	return info, nil
}

// CreateOrUpdateHPA — HPA oluşturur veya günceller.
func (c *Client) CreateOrUpdateHPA(ctx context.Context, deploymentName string, minReplicas, maxReplicas int32, cpuTargetPercent int32) (*HPAInfo, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	if minReplicas < 1 {
		minReplicas = 1
	}
	if maxReplicas < minReplicas {
		maxReplicas = minReplicas
	}
	if cpuTargetPercent <= 0 || cpuTargetPercent > 100 {
		cpuTargetPercent = 70
	}

	hpaName := deploymentName + "-hpa"

	hpa := &autoscalingv2.HorizontalPodAutoscaler{
		ObjectMeta: metav1.ObjectMeta{
			Name:      hpaName,
			Namespace: c.namespace,
			Labels: map[string]string{
				"app.kubernetes.io/managed-by": "nanonet",
				"nanonet/deployment":           deploymentName,
			},
		},
		Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
			ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{
				APIVersion: "apps/v1",
				Kind:       "Deployment",
				Name:       deploymentName,
			},
			MinReplicas: &minReplicas,
			MaxReplicas: maxReplicas,
			Metrics: []autoscalingv2.MetricSpec{
				{
					Type: autoscalingv2.ResourceMetricSourceType,
					Resource: &autoscalingv2.ResourceMetricSource{
						Name: corev1.ResourceCPU,
						Target: autoscalingv2.MetricTarget{
							Type:               autoscalingv2.UtilizationMetricType,
							AverageUtilization: &cpuTargetPercent,
						},
					},
				},
			},
		},
	}

	existing, err := c.clientset.AutoscalingV2().HorizontalPodAutoscalers(c.namespace).Get(ctx, hpaName, metav1.GetOptions{})
	if err != nil {
		// Yok — oluştur
		created, err := c.clientset.AutoscalingV2().HorizontalPodAutoscalers(c.namespace).Create(ctx, hpa, metav1.CreateOptions{})
		if err != nil {
			return nil, fmt.Errorf("HPA oluşturulamadı: %w", err)
		}
		log.Printf("[K8s] HPA oluşturuldu: %s (min=%d, max=%d, cpu=%d%%)", hpaName, minReplicas, maxReplicas, cpuTargetPercent)
		return &HPAInfo{
			Name:        created.Name,
			MinReplicas: minReplicas,
			MaxReplicas: maxReplicas,
			CPUTarget:   &cpuTargetPercent,
		}, nil
	}

	// Var — güncelle
	existing.Spec = hpa.Spec
	updated, err := c.clientset.AutoscalingV2().HorizontalPodAutoscalers(c.namespace).Update(ctx, existing, metav1.UpdateOptions{})
	if err != nil {
		return nil, fmt.Errorf("HPA güncellenemedi: %w", err)
	}

	log.Printf("[K8s] HPA güncellendi: %s (min=%d, max=%d, cpu=%d%%)", hpaName, minReplicas, maxReplicas, cpuTargetPercent)
	return &HPAInfo{
		Name:            updated.Name,
		MinReplicas:     minReplicas,
		MaxReplicas:     maxReplicas,
		CurrentReplicas: updated.Status.CurrentReplicas,
		DesiredReplicas: updated.Status.DesiredReplicas,
		CPUTarget:       &cpuTargetPercent,
	}, nil
}

// DeleteHPA — HPA'yı siler.
func (c *Client) DeleteHPA(ctx context.Context, deploymentName string) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	hpaName := deploymentName + "-hpa"
	err := c.clientset.AutoscalingV2().HorizontalPodAutoscalers(c.namespace).Delete(ctx, hpaName, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("HPA silinemedi: %w", err)
	}

	log.Printf("[K8s] HPA silindi: %s", hpaName)
	return nil
}

// GetNamespaces — erişilebilir namespace'leri listeler.
func (c *Client) GetNamespaces(ctx context.Context) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	ns, err := c.clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("namespace listesi alınamadı: %w", err)
	}

	var names []string
	for _, n := range ns.Items {
		names = append(names, n.Name)
	}
	return names, nil
}

// GetServiceEndpoints — K8s service'in endpoint'lerini döndürür.
func (c *Client) GetServiceEndpoints(ctx context.Context, serviceName string) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	endpoints, err := c.clientset.CoreV1().Endpoints(c.namespace).Get(ctx, serviceName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("endpoint bilgisi alınamadı: %w", err)
	}

	var addrs []string
	for _, subset := range endpoints.Subsets {
		for _, addr := range subset.Addresses {
			for _, port := range subset.Ports {
				addrs = append(addrs, fmt.Sprintf("%s:%d", addr.IP, port.Port))
			}
		}
	}
	return addrs, nil
}

// IsAvailable — K8s cluster'a erişilebilir mi kontrol eder.
func (c *Client) IsAvailable(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	_, err := c.clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{Limit: 1})
	return err == nil
}
