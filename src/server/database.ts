import fs from "fs";
import path from "path";

export interface DBKeyword {
  id: number;
  keyword: string;
  normalized_keyword: string;
  enabled: boolean;
  matched_count: number;
  created_at: string;
}

export interface DBRecipient {
  id: number;
  username: string;
  enabled: boolean;
  forwarded_count: number;
  last_forward_at: string | null;
  created_at: string;
}

export interface DBMonitoredGroup {
  id: number;
  chat_id: number;
  title: string;
  username: string | null;
  members_count: number;
  is_monitored: boolean;
  messages_count: number;
  matched_count: number;
  forwarded_count: number;
  last_activity: string | null;
  last_activity_at: string | null;
}

export interface DBForwardLog {
  id: number;
  timestamp: string;
  group_title: string;
  group_id: number;
  sender_name: string;
  sender_id?: number;
  matched_keywords: string;
  recipient: string;
  status: "FORWARDED" | "QUEUED" | "FAILED" | "PROTECTED_CONTENT" | "FLOOD_WAIT" | "SKIPPED";
  message_id: number;
  details?: string;
  text_snippet?: string;
}

export interface DBSettings {
  forward_delay: number;
  retry_attempts: number;
  monitor_mode: "ALL" | "SELECTED";
  timezone: string;
  log_level: string;
  dashboard_username: string;
}

export interface DBMetrics {
  total_messages_monitored: number;
  total_messages_matched: number;
  total_forwards_successful: number;
  total_forwards_failed: number;
}

export interface DatabaseSchema {
  keywords: DBKeyword[];
  recipients: DBRecipient[];
  monitoredGroups: DBMonitoredGroup[];
  forwardLogs: DBForwardLog[];
  settings: DBSettings;
  metrics: DBMetrics;
  dedupKeys: string[];
}

export class JsonDatabase {
  private dbPath: string;
  private data: DatabaseSchema;

  constructor() {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (_) {}
    }
    this.dbPath = path.join(dataDir, "database.json");
    this.data = this.loadInitialData();
  }

  private normalizeText(text: string): string {
    return text
      .replace(/[\u064B-\u065F\u0670]/g, "") // remove harakat
      .replace(/\u0640/g, "") // remove tatweel
      .replace(/[إأآا]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .trim()
      .toLowerCase();
  }

  private getDefaultData(): DatabaseSchema {
    const initialKws = [
      "يحل",
      "يسوي",
      "فاهم",
      "يشرح",
      "يعرف",
      "مختص",
      "واجب",
      "تكليف",
      "مشروع"
    ];

    const initialRecipients = [
      "@topmark1st",
      "@tamkeenco3",
      "@m_9q6"
    ];

    const now = new Date().toISOString();

    return {
      keywords: initialKws.map((kw, idx) => ({
        id: idx + 1,
        keyword: kw,
        normalized_keyword: this.normalizeText(kw),
        enabled: true,
        matched_count: 0,
        created_at: now
      })),
      recipients: initialRecipients.map((rec, idx) => ({
        id: idx + 1,
        username: rec,
        enabled: true,
        forwarded_count: 0,
        last_forward_at: null,
        created_at: now
      })),
      monitoredGroups: [],
      forwardLogs: [],
      settings: {
        forward_delay: 2.0,
        retry_attempts: 3,
        monitor_mode: "ALL",
        timezone: "Asia/Aden",
        log_level: "INFO",
        dashboard_username: "admin"
      },
      metrics: {
        total_messages_monitored: 0,
        total_messages_matched: 0,
        total_forwards_successful: 0,
        total_forwards_failed: 0
      },
      dedupKeys: []
    };
  }

  private loadInitialData(): DatabaseSchema {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, "utf-8");
        const parsed = JSON.parse(raw);
        const defaults = this.getDefaultData();
        return {
          keywords: parsed.keywords || defaults.keywords,
          recipients: parsed.recipients || defaults.recipients,
          monitoredGroups: parsed.monitoredGroups || defaults.monitoredGroups,
          forwardLogs: parsed.forwardLogs || defaults.forwardLogs,
          settings: { ...defaults.settings, ...(parsed.settings || {}) },
          metrics: { ...defaults.metrics, ...(parsed.metrics || {}) },
          dedupKeys: parsed.dedupKeys || []
        };
      }
    } catch (err) {
      console.error("[Database] Error loading existing DB, initializing default:", err);
    }

    const defaultData = this.getDefaultData();
    this.save(defaultData);
    return defaultData;
  }

  private save(dataToSave?: DatabaseSchema) {
    try {
      const d = dataToSave || this.data;
      // keep dedupKeys at reasonable size (last 2000)
      if (d.dedupKeys.length > 2000) {
        d.dedupKeys = d.dedupKeys.slice(-2000);
      }
      // keep forwardLogs at last 1000
      if (d.forwardLogs.length > 1000) {
        d.forwardLogs = d.forwardLogs.slice(0, 1000);
      }
      fs.writeFileSync(this.dbPath, JSON.stringify(d, null, 2), "utf-8");
    } catch (err) {
      console.error("[Database] Failed to write database.json:", err);
    }
  }

  // --- Keywords ---
  public getKeywords(): DBKeyword[] {
    return this.data.keywords;
  }

  public addKeyword(keyword: string): DBKeyword {
    const clean = keyword.trim();
    const existing = this.data.keywords.find(
      (k) => k.keyword.toLowerCase() === clean.toLowerCase()
    );
    if (existing) return existing;

    const newId = this.data.keywords.length > 0 ? Math.max(...this.data.keywords.map((k) => k.id)) + 1 : 1;
    const item: DBKeyword = {
      id: newId,
      keyword: clean,
      normalized_keyword: this.normalizeText(clean),
      enabled: true,
      matched_count: 0,
      created_at: new Date().toISOString()
    };
    this.data.keywords.push(item);
    this.save();
    return item;
  }

  public updateKeyword(id: number, updates: Partial<DBKeyword>): DBKeyword | null {
    const kw = this.data.keywords.find((k) => k.id === id);
    if (!kw) return null;
    if (updates.keyword !== undefined) {
      kw.keyword = updates.keyword.trim();
      kw.normalized_keyword = this.normalizeText(kw.keyword);
    }
    if (updates.enabled !== undefined) kw.enabled = updates.enabled;
    if (updates.matched_count !== undefined) kw.matched_count = updates.matched_count;
    this.save();
    return kw;
  }

  public deleteKeyword(id: number): boolean {
    const idx = this.data.keywords.findIndex((k) => k.id === id);
    if (idx === -1) return false;
    this.data.keywords.splice(idx, 1);
    this.save();
    return true;
  }

  public incrementKeywordMatch(keywordStr: string) {
    const kw = this.data.keywords.find(
      (k) => k.keyword.toLowerCase() === keywordStr.toLowerCase() || k.normalized_keyword === this.normalizeText(keywordStr)
    );
    if (kw) {
      kw.matched_count += 1;
      this.save();
    }
  }

  // --- Recipients ---
  public getRecipients(): DBRecipient[] {
    return this.data.recipients;
  }

  public addRecipient(username: string): DBRecipient {
    let clean = username.trim();
    if (!clean.startsWith("@")) clean = `@${clean}`;

    const existing = this.data.recipients.find(
      (r) => r.username.toLowerCase() === clean.toLowerCase()
    );
    if (existing) return existing;

    const newId = this.data.recipients.length > 0 ? Math.max(...this.data.recipients.map((r) => r.id)) + 1 : 1;
    const item: DBRecipient = {
      id: newId,
      username: clean,
      enabled: true,
      forwarded_count: 0,
      last_forward_at: null,
      created_at: new Date().toISOString()
    };
    this.data.recipients.push(item);
    this.save();
    return item;
  }

  public updateRecipient(id: number, updates: Partial<DBRecipient>): DBRecipient | null {
    const rec = this.data.recipients.find((r) => r.id === id);
    if (!rec) return null;
    if (updates.username !== undefined) {
      let u = updates.username.trim();
      if (!u.startsWith("@")) u = `@${u}`;
      rec.username = u;
    }
    if (updates.enabled !== undefined) rec.enabled = updates.enabled;
    if (updates.forwarded_count !== undefined) rec.forwarded_count = updates.forwarded_count;
    if (updates.last_forward_at !== undefined) rec.last_forward_at = updates.last_forward_at;
    this.save();
    return rec;
  }

  public deleteRecipient(id: number): boolean {
    const idx = this.data.recipients.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.data.recipients.splice(idx, 1);
    this.save();
    return true;
  }

  public recordForwardSuccess(username: string) {
    const clean = username.startsWith("@") ? username : `@${username}`;
    const rec = this.data.recipients.find((r) => r.username.toLowerCase() === clean.toLowerCase());
    if (rec) {
      rec.forwarded_count += 1;
      rec.last_forward_at = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
    this.data.metrics.total_forwards_successful += 1;
    this.save();
  }

  public recordForwardFailure() {
    this.data.metrics.total_forwards_failed += 1;
    this.save();
  }

  // --- Monitored Groups ---
  public getMonitoredGroups(): DBMonitoredGroup[] {
    return this.data.monitoredGroups;
  }

  public syncMonitoredGroups(dialogGroups: Array<{ chatId: number; title: string; username: string | null; membersCount: number }>): DBMonitoredGroup[] {
    const currentMap = new Map(this.data.monitoredGroups.map((g) => [g.chat_id, g]));
    const updated: DBMonitoredGroup[] = [];

    dialogGroups.forEach((dg, idx) => {
      const existing = currentMap.get(dg.chatId);
      if (existing) {
        existing.title = dg.title;
        existing.username = dg.username;
        existing.members_count = dg.membersCount || existing.members_count || 0;
        updated.push(existing);
      } else {
        updated.push({
          id: idx + 1,
          chat_id: dg.chatId,
          title: dg.title,
          username: dg.username,
          members_count: dg.membersCount || 0,
          is_monitored: true,
          messages_count: 0,
          matched_count: 0,
          forwarded_count: 0,
          last_activity: null,
          last_activity_at: null,
        });
      }
    });

    this.data.monitoredGroups = updated;
    this.save();
    return this.data.monitoredGroups;
  }

  public updateGroup(id: number, updates: Partial<DBMonitoredGroup>): DBMonitoredGroup | null {
    const grp = this.data.monitoredGroups.find((g) => g.id === id);
    if (!grp) return null;
    if (updates.is_monitored !== undefined) grp.is_monitored = updates.is_monitored;
    this.save();
    return grp;
  }

  public recordGroupMessage(chatId: number, chatTitle: string, matched: boolean) {
    this.data.metrics.total_messages_monitored += 1;
    if (matched) {
      this.data.metrics.total_messages_matched += 1;
    }

    const chatIdStr = String(chatId);
    let grp = this.data.monitoredGroups.find((g) => String(g.chat_id) === chatIdStr || String(g.chat_id).endsWith(chatIdStr.replace(/^-100|-/, "")));
    const nowIso = new Date().toISOString();
    const nowStr = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    if (grp) {
      grp.messages_count = (grp.messages_count || 0) + 1;
      if (matched) grp.matched_count = (grp.matched_count || 0) + 1;
      grp.last_activity = nowStr;
      grp.last_activity_at = nowIso;
      if (chatTitle && chatTitle !== "مجموعة تيليجرام" && (!grp.title || grp.title === "مجموعة تيليجرام")) {
        grp.title = chatTitle;
      }
    } else {
      grp = {
        id: this.data.monitoredGroups.length + 1,
        chat_id: chatId,
        title: chatTitle && chatTitle !== "مجموعة تيليجرام" ? chatTitle : "مجموعة تيليجرام",
        username: null,
        members_count: 0,
        is_monitored: true,
        messages_count: 1,
        matched_count: matched ? 1 : 0,
        forwarded_count: 0,
        last_activity: nowStr,
        last_activity_at: nowIso,
      };
      this.data.monitoredGroups.push(grp);
    }
    this.save();
  }

  public recordGroupForward(chatId: number) {
    const chatIdStr = String(chatId);
    const grp = this.data.monitoredGroups.find((g) => String(g.chat_id) === chatIdStr || String(g.chat_id).endsWith(chatIdStr.replace(/^-100|-/, "")));
    if (grp) {
      grp.forwarded_count = (grp.forwarded_count || 0) + 1;
      this.save();
    }
  }

  // --- Forward Logs ---
  public getForwardLogs(): DBForwardLog[] {
    return this.data.forwardLogs;
  }

  public addForwardLog(log: Omit<DBForwardLog, "id" | "timestamp">): DBForwardLog {
    const newId = this.data.forwardLogs.length > 0 ? this.data.forwardLogs[0].id + 1 : 1;
    const now = new Date();
    const timestamp = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    const newLog: DBForwardLog = {
      id: newId,
      timestamp,
      ...log
    };
    this.data.forwardLogs.unshift(newLog);
    this.save();
    return newLog;
  }

  public clearLogs() {
    this.data.forwardLogs = [];
    this.save();
  }

  // --- Settings ---
  public getSettings(): DBSettings {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<DBSettings>): DBSettings {
    this.data.settings = { ...this.data.settings, ...updates };
    this.save();
    return this.data.settings;
  }

  // --- Metrics ---
  public getMetrics(): DBMetrics {
    return this.data.metrics;
  }

  // --- Deduplication ---
  public isDuplicate(key: string): boolean {
    return this.data.dedupKeys.includes(key);
  }

  public addDedupKey(key: string) {
    if (!this.data.dedupKeys.includes(key)) {
      this.data.dedupKeys.push(key);
      this.save();
    }
  }
}

export const db = new JsonDatabase();
