import apiClient from "./client";

export interface PodInfo {
    name: string;
    status: string;
    ready: boolean;
    restarts: number;
    node: string;
    ip: string;
    start_time?: string;
    age?: string;
    container_count: number;
    ready_count: number;
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
    deployment_name?: string;
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

export interface NodeInfo {
    name: string;
    status: string;
    ready: boolean;
    roles: string[];
    version: string;
    os: string;
    arch: string;
    cpu: string;
    memory: string;
    created_at?: string;
}

export interface ServiceInfo {
    name: string;
    namespace: string;
    type: string;
    cluster_ip: string;
    external_ip: string;
    ports: string[];
    selector?: Record<string, string>;
    age?: string;
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

    getAllPods: async () => {
        const { data } = await apiClient.get("/k8s/pods/all");
        return data.data as { pods: PodInfo[]; count: number };
    },

    getPodLogs: async (name: string, lines = 100) => {
        const { data } = await apiClient.get(`/k8s/pods/${encodeURIComponent(name)}/logs?lines=${lines}`);
        return data.data as { pod: string; lines: number; logs: string };
    },

    deletePod: async (name: string) => {
        const { data } = await apiClient.delete(`/k8s/pods/${encodeURIComponent(name)}`);
        return data.data as { message: string };
    },

    getDeployment: async (name: string) => {
        const { data } = await apiClient.get(`/k8s/deployments/${name}`);
        return data.data as DeploymentInfo;
    },

    listDeployments: async () => {
        const { data } = await apiClient.get("/k8s/deployments");
        return data.data as { deployments: DeploymentInfo[]; count: number };
    },

    scaleDeployment: async (name: string, replicas: number) => {
        const { data } = await apiClient.post(`/k8s/deployments/${name}/scale`, { replicas });
        return data.data as ScaleResult;
    },

    rolloutRestart: async (name: string) => {
        const { data } = await apiClient.post(`/k8s/deployments/${name}/restart`, {});
        return data.data as { message: string };
    },

    getHPA: async (name: string) => {
        const { data } = await apiClient.get(`/k8s/hpa/${name}`);
        return data.data as HPAInfo;
    },

    listHPAs: async () => {
        const { data } = await apiClient.get("/k8s/hpa");
        return data.data as { hpas: HPAInfo[]; count: number };
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

    listServices: async () => {
        const { data } = await apiClient.get("/k8s/services");
        return data.data as { services: ServiceInfo[]; count: number };
    },

    getEndpoints: async (name: string) => {
        const { data } = await apiClient.get(`/k8s/endpoints/${name}`);
        return data.data as { service: string; endpoints: string[]; count: number };
    },

    getNodes: async () => {
        const { data } = await apiClient.get("/k8s/nodes");
        return data.data as { nodes: NodeInfo[]; count: number };
    },
};
