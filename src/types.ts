export interface SystemStatus {
  status: "RUNNING" | "STOPPED" | "STARTING" | "STOPPING" | "RECONNECTING" | "ERROR";
  is_connected: boolean;
  session_exists: boolean;
  account: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    phone?: string;
  } | null;
  monitor_mode: "ALL" | "SELECTED";
  matching_rule: string;
  keyword_threshold: number;
  queue_size: number;
  last_error: string | null;
}

export interface Keyword {
  id: number;
  keyword: string;
  normalized_keyword: string;
  enabled: boolean;
  matched_count: number;
  created_at: string;
  updated_at: string;
}

export interface Recipient {
  id: number;
  username: string;
  enabled: boolean;
  forwarded_count: number;
  last_forward_at: string | null;
  created_at: string;
}

export interface MonitoredGroup {
  id: number;
  chat_id: number;
  title: string;
  username: string | null;
  members_count: number;
  is_monitored: boolean;
  messages_count?: number;
  matched_count: number;
  forwarded_count: number;
  last_activity?: string | null;
  last_activity_at?: string | null;
}

export interface ForwardLog {
  id: number;
  timestamp: string;
  group_title: string;
  chat_id: number;
  message_id: number;
  sender_name: string;
  matched_keywords: string;
  recipient: string;
  status: "QUEUED" | "FORWARDED" | "FAILED" | "PROTECTED_CONTENT" | "SKIPPED" | "FLOOD_WAIT";
  error_message: string | null;
}

export interface SystemStats {
  total_messages_monitored: number;
  total_messages_matched: number;
  total_forwards_successful: number;
  total_forwards_failed: number;
  active_keywords_count: number;
  active_recipients_count: number;
  monitored_groups_count: number;
  top_keywords: { name: string; count: number }[];
  top_groups: { name: string; matched: number; forwarded: number }[];
  top_recipients: { name: string; count: number }[];
  recent_activity: {
    id: number;
    timestamp: string;
    group: string;
    matched: string;
    recipient: string;
    status: string;
  }[];
}

export interface SystemSettings {
  telegram: {
    api_id: number;
    phone: string | null;
    is_connected: boolean;
    status: string;
    session_name: string;
  };
  filtering: {
    matching_rule: string;
    keyword_threshold: number;
    threshold_editable: boolean;
    allowed_chat_types: string[];
    ignored_types: string[];
  };
  forwarding: {
    forward_delay: number;
    retry_attempts: number;
    forward_method: string;
  };
  monitoring: {
    monitor_mode: "ALL" | "SELECTED";
  };
  system: {
    timezone: string;
    log_level: string;
    dashboard_username: string;
  };
}

export interface MessageTestResult {
  raw_text: string;
  normalized_text: string;
  tokens: string[];
  is_match: boolean;
  matched_keywords: string[];
  matching_rule: string;
  explanation: string;
}
