import apiClient from './client';

export interface UserSettings {
    user_id: string;
    notif_crit: boolean;
    notif_warn: boolean;
    notif_down: boolean;
    notif_ai: boolean;
    poll_interval_sec: number;
    auto_recovery: boolean;
    ai_auto_analyze: boolean;
    ai_window_minutes: number;
    updated_at: string;
}

export interface UpdateSettingsRequest {
    notif_crit?: boolean;
    notif_warn?: boolean;
    notif_down?: boolean;
    notif_ai?: boolean;
    poll_interval_sec?: number;
    auto_recovery?: boolean;
    ai_auto_analyze?: boolean;
    ai_window_minutes?: number;
}

export const settingsApi = {
    get: async (): Promise<UserSettings> => {
        const response = await apiClient.get('/settings');
        return response.data.data;
    },

    update: async (data: UpdateSettingsRequest): Promise<UserSettings> => {
        const response = await apiClient.put('/settings', data);
        return response.data.data;
    },

    changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
        await apiClient.put('/auth/password', {
            current_password: currentPassword,
            new_password: newPassword,
        });
    },

    getAuditLogs: async (limit = 50, offset = 0): Promise<{ logs: AuditLog[]; total: number }> => {
        const response = await apiClient.get('/audit', { params: { limit, offset } });
        return response.data.data;
    },
};

export interface AuditLog {
    id: string;
    user_id: string;
    action: string;
    resource_type: string;
    resource_id: string;
    details?: string;
    ip_address?: string;
    created_at: string;
}
