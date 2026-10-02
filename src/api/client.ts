import {
  SystemStatus,
  Keyword,
  Recipient,
  MonitoredGroup,
  ForwardLog,
  SystemStats,
  SystemSettings,
  MessageTestResult
} from "../types";

const BASE_URL = "/api";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("telegram_auth_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err: any = new Error(errorData.detail || errorData.error || errorData.message || `HTTP error! status: ${res.status}`);
    if (errorData.requires_2fa || errorData.status === "2fa_required") {
      err.requires_2fa = true;
      err.status = "2fa_required";
    }
    throw err;
  }

  return res.json();
}

export const api = {
  // Auth
  login: (credentials: { username: string; password: string }) =>
    request<{ access_token: string; token_type: string; user: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),
  getAutoToken: () => request<{ access_token: string; user?: string }>("/auth/token"),
  getMe: () => request<{ username: string; authenticated: boolean }>("/auth/me"),

  // System
  getStatus: () => request<SystemStatus>("/system/status"),
  startSystem: () => request<{ success: boolean; status: string; message: string }>("/system/start", { method: "POST" }),
  stopSystem: () => request<{ success: boolean; status: string; message: string }>("/system/stop", { method: "POST" }),
  restartSystem: () => request<{ success: boolean; status: string; message: string }>("/system/restart", { method: "POST" }),

  // Telegram Auth (Direct relative paths, resilient with alias fallback)
  requestTelegramCode: async (phone: string) => {
    try {
      return await request<{ success: boolean; phone_code_hash?: string; message?: string; error?: string }>("/telegram/send-code", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
    } catch (err: any) {
      return await request<{ success: boolean; phone_code_hash?: string; message?: string; error?: string }>("/system/telegram/request-code", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
    }
  },
  verifyTelegramCode: async (code: string, password?: string, phone?: string, phone_code_hash?: string) => {
    try {
      return await request<{ success: boolean; status?: string; requires_2fa?: boolean; message?: string; user?: any; error?: string }>("/telegram/verify", {
        method: "POST",
        body: JSON.stringify({ code, password, phone, phone_code_hash }),
      });
    } catch (err: any) {
      if (err.requires_2fa || err.status === "2fa_required") throw err;
      return await request<{ success: boolean; status?: string; requires_2fa?: boolean; message?: string; user?: any; error?: string }>("/system/telegram/verify-code", {
        method: "POST",
        body: JSON.stringify({ code, password, phone, phone_code_hash }),
      });
    }
  },
  verifyTelegramPassword: async (password: string) => {
    try {
      return await request<{ success: boolean; status?: string; message?: string; user?: any; error?: string }>("/telegram/verify-password", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
    } catch (err: any) {
      return await request<{ success: boolean; status?: string; message?: string; user?: any; error?: string }>("/system/telegram/verify-password", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
    }
  },

  // Message Testing & Simulation
  testMessage: (text: string) =>
    request<MessageTestResult>("/system/test-message", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  simulateIncoming: (payload: { text: string; group_title?: string; sender_name?: string; message_id?: number }) =>
    request<{
      success: boolean;
      matched: boolean;
      matched_keywords?: string[];
      normalized?: string;
      recipients_forwarded?: any[];
      message?: string;
    }>("/system/simulate-incoming", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Keywords
  getKeywords: () => request<Keyword[]>("/keywords"),
  createKeyword: (keyword: string) =>
    request<Keyword>("/keywords", {
      method: "POST",
      body: JSON.stringify({ keyword }),
    }),
  updateKeyword: (id: number, data: { keyword?: string; enabled?: boolean }) =>
    request<Keyword>(`/keywords/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteKeyword: (id: number) =>
    request<{ success: boolean; message: string }>(`/keywords/${id}`, {
      method: "DELETE",
    }),

  // Recipients
  getRecipients: () => request<Recipient[]>("/recipients"),
  createRecipient: (username: string) =>
    request<Recipient>("/recipients", {
      method: "POST",
      body: JSON.stringify({ username }),
    }),
  updateRecipient: (id: number, data: { username?: string; enabled?: boolean }) =>
    request<Recipient>(`/recipients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteRecipient: (id: number) =>
    request<{ success: boolean; message: string }>(`/recipients/${id}`, {
      method: "DELETE",
    }),
  testRecipient: (id: number) =>
    request<{ success: boolean; message?: string; error?: string }>(`/recipients/${id}/test`, {
      method: "POST",
    }),

  // Groups
  getGroups: () => request<MonitoredGroup[]>("/groups"),
  updateGroup: (id: number, data: { is_monitored: boolean }) =>
    request<MonitoredGroup>(`/groups/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  syncGroups: () => request<{ success: boolean; count: number; groups: MonitoredGroup[] }>("/groups/sync", { method: "POST" }),

  // Logs & Stats
  getLogs: (params?: { status?: string; recipient?: string; keyword?: string }) => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "ALL") query.append("status", params.status);
    if (params?.recipient) query.append("recipient", params.recipient);
    if (params?.keyword) query.append("keyword", params.keyword);
    return request<ForwardLog[]>(`/logs?${query.toString()}`);
  },
  clearLogs: () => request<{ success: boolean; message: string }>("/logs", { method: "DELETE" }),
  getStats: () => request<SystemStats>("/stats"),

  // Settings
  getSettings: () => request<SystemSettings>("/settings"),
  updateSettings: (data: Partial<SystemSettings["forwarding"] & SystemSettings["monitoring"] & SystemSettings["system"]>) =>
    request<{ success: boolean; message: string }>("/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
