import apiClient from "./client";

export interface PodInfo {
    name: string;
    status: string;
    ready: boolean;
    restarts: number;
    node: string;
    ip: string;
    start_time?: string;
    labels?: Record<string, string>;
}

export interface DeploymentInfo {
    name: string;
    namespace: string;
    replicas: number;
    ready_replicas: number;
    available_replicas: number;
    updated_replicas: number;
    strategy: string;
}

export interface HPAInfo {
    name: string;
    min_replicas: number;
    max_replicas: number;
    current_replicas: number;
    desired_replicas: number;
    cpu_target_percent?: number;
    cpu_current_percent?: number;
}

export interface ScaleResult {
    previous_replicas: number;
    desired_replicas: number;
    message: string;
}

export const k8sApi = {
    getStatus: async () => {
        const { data } = await apiClient.get("/k8s/status");
        return data.data as { available: boolean; namespace: string };
    },

    getNamespaces: async () => {
        const { data } = await apiClient.get("/k8s/namespaces");
        return data.data.namespaces as string[];
    },

    getPods: async (selector: string) => {
        const { data } = await apiClient.get(`/k8s/pods?selector=${encodeURIComponent(selector)}`);
        return data.data as { pods: PodInfo[]; count: number };
    },

    getDeployment: async (name: string) => {
        const { data } = await apiClient.get(`/k8s/deployments/${name}`);
        return data.data as DeploymentInfo;
    },

    scaleDeployment: async (name: string, replicas: number) => {
        const { data } = await apiClient.post(`/k8s/deployments/${name}/scale`, { replicas });
        return data.data as ScaleResult;
    },

    getHPA: async (name: string) => {
        const { data } = await apiClient.get(`/k8s/hpa/${name}`);
        return data.data as HPAInfo;
    },

    createOrUpdateHPA: async (deploymentName: string, minReplicas: number, maxReplicas: number, cpuTargetPercent: number) => {
        const { data } = await apiClient.post("/k8s/hpa", {
            deployment_name: deploymentName,
            min_replicas: minReplicas,
            max_replicas: maxReplicas,
            cpu_target_percent: cpuTargetPercent,
        });
        return data.data as HPAInfo;
    },

    deleteHPA: async (name: string) => {
        const { data } = await apiClient.delete(`/k8s/hpa/${name}`);
        return data.data;
    },

    getEndpoints: async (name: string) => {
        const { data } = await apiClient.get(`/k8s/endpoints/${name}`);
        return data.data as { service: string; endpoints: string[]; count: number };
    },
};
