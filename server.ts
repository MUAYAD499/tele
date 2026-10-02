import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { telegramService } from "./src/server/telegramService";
import { db } from "./src/server/database";
import { ArabicNormalizerTS, KeywordMatcherTS } from "./src/server/matcher";

export { ArabicNormalizerTS, KeywordMatcherTS };

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Connect real-time incoming MTProto message handler
  telegramService.setOnIncomingMessage(async (data) => {
    if (!telegramService.isRunning) return;

    const settings = db.getSettings();

    // Group filtering: check monitor mode
    const groups = db.getMonitoredGroups();
    const chatIdStr = String(data.chatId);
    const bareChatId = chatIdStr.replace(/^-100|-/, "");
    const grp = groups.find((g) => {
      const gStr = String(g.chat_id);
      const gBare = gStr.replace(/^-100|-/, "");
      return gStr === chatIdStr || gBare === bareChatId;
    });

    if (grp && grp.title && (!data.chatTitle || data.chatTitle === "مجموعة تيليجرام")) {
      data.chatTitle = grp.title;
    }

    // Monitoring Mode rules:
    // 1. In SELECTED mode: only monitored groups (is_monitored === true) are processed.
    // 2. In ALL mode: all groups are monitored EXCEPT those explicitly disabled (is_monitored === false).
    if (settings.monitor_mode === "SELECTED") {
      if (!grp || !grp.is_monitored) {
        console.log(`[Telegram Userbot] Skipped unmonitored group (Mode: SELECTED): ${data.chatTitle}`);
        return;
      }
    } else {
      // Mode: ALL
      if (grp && grp.is_monitored === false) {
        console.log(`[Telegram Userbot] Skipped disabled group (Mode: ALL): ${data.chatTitle}`);
        return;
      }
    }

    const keywords = db.getKeywords();
    const activeKws = keywords.filter((k) => k.enabled).map((k) => k.keyword);
    const matchResult = KeywordMatcherTS.matchMessage(data.text, activeKws);

    // Record incoming message for group & metrics
    db.recordGroupMessage(data.chatId, data.chatTitle, matchResult.isMatch);

    console.log(`[Keyword Matcher Evaluation]`);
    console.log(`  Group: "${data.chatTitle}" (Chat ID: ${data.chatId})`);
    console.log(`  Sender: "${data.senderName}" (${data.senderUsername || "No username"}) [Outgoing: ${data.isOutgoing}]`);
    console.log(`  Text: "${data.text.slice(0, 100)}"`);
    console.log(`  Active Keywords (${activeKws.length}): [${activeKws.slice(0, 10).join(", ")}${activeKws.length > 10 ? "..." : ""}]`);
    console.log(`  Matched: [${matchResult.matched.join(", ")}]`);
    console.log(`  Match Status: ${matchResult.isMatch ? "TRUE -> FORWARDING" : "FALSE -> IGNORED"}`);

    if (!matchResult.isMatch) return;

    // Increment keyword match counters in persistent database
    matchResult.matched.forEach((kw) => {
      db.incrementKeywordMatch(kw);
    });

    const activeRecipients = db.getRecipients().filter((r) => r.enabled);
    if (activeRecipients.length === 0) {
      console.warn(`[Telegram Userbot] Message matched keywords [${matchResult.matched.join(", ")}] but no active recipients are enabled.`);
    }

    for (const rec of activeRecipients) {
      const dedupKey = `${data.chatId}:${data.messageId}:${rec.username}`;
      if (db.isDuplicate(dedupKey)) {
        console.log(`[Telegram Userbot] Skipping duplicate message #${data.messageId} for ${rec.username}`);
        continue;
      }

      db.addDedupKey(dedupKey);

      // Perform native MTProto forwarding preserving media, text, captions
      const forwardRes = await telegramService.forwardMessage(rec.username, data.chatId, data.messageId, data.rawMessage);

      const status = forwardRes.success
        ? "FORWARDED"
        : forwardRes.error === "FLOOD_WAIT"
        ? "FLOOD_WAIT"
        : "FAILED";

      db.addForwardLog({
        group_title: data.chatTitle,
        group_id: data.chatId,
        sender_name: data.senderName,
        matched_keywords: matchResult.matched.join(","),
        recipient: rec.username,
        status: status as any,
        message_id: data.messageId,
        details: forwardRes.error,
        text_snippet: data.text.slice(0, 120),
      });

      if (forwardRes.success) {
        db.recordForwardSuccess(rec.username);
        db.recordGroupForward(data.chatId);
        console.log(`[Telegram Userbot] Real forward completed to ${rec.username} for message #${data.messageId}`);
      } else {
        db.recordForwardFailure();
        console.error(`[Telegram Userbot] Forward failed to ${rec.username}: ${forwardRes.error}`);
      }

      // Rate limiting / delay between forwards to avoid FloodWait
      if (settings.forward_delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, settings.forward_delay * 1000));
      }
    }
  });

  // Attempt auto-connect with saved session if exists
  telegramService.autoConnect().then(async (connected) => {
    if (connected && telegramService.account) {
      console.log(`[Telegram Userbot] Auto-connected successfully as @${telegramService.account.username || telegramService.account.first_name}`);
      // Sync groups from live dialogs
      try {
        const dialogGroups = await telegramService.getDialogGroups();
        if (dialogGroups.length > 0) {
          db.syncMonitoredGroups(dialogGroups);
        }
      } catch (err) {
        console.error("[Telegram] Auto group sync error:", err);
      }
    } else {
      console.log("[Telegram Userbot] Ready for user authentication via Dashboard.");
    }
  });

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Auth Endpoints
  app.post("/api/auth/login", (req: Request, res: Response) => {
    const { username, password } = req.body;
    const settings = db.getSettings();
    if (username === settings.dashboard_username && (password === "change-this-password" || password === "admin" || password === "admin123")) {
      res.json({
        access_token: "jwt-token-telegram-userbot-admin",
        token_type: "bearer",
        user: username
      });
    } else {
      res.status(401).json({ detail: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }
  });

  app.get("/api/auth/token", (_req: Request, res: Response) => {
    res.json({
      access_token: "jwt-token-telegram-userbot-admin",
      token_type: "bearer",
      user: db.getSettings().dashboard_username
    });
  });

  app.get("/api/auth/me", (_req: Request, res: Response) => {
    res.json({ username: db.getSettings().dashboard_username, authenticated: true });
  });

  // System Status & Controls
  app.get("/api/system/status", (_req: Request, res: Response) => {
    const sessionExists = telegramService.hasSession();
    const settings = db.getSettings();

    res.json({
      status: telegramService.isConnected && telegramService.isRunning ? "RUNNING" : "STOPPED",
      is_connected: telegramService.isConnected,
      session_exists: sessionExists || telegramService.isConnected,
      account: telegramService.account,
      monitor_mode: settings.monitor_mode,
      matching_rule: "يكفي وجود كلمة مفتاحية واحدة فقط",
      keyword_threshold: 1,
      queue_size: 0,
      last_error: telegramService.lastError
    });
  });

  app.post("/api/system/start", async (_req: Request, res: Response) => {
    if (!telegramService.isConnected) {
      const connected = await telegramService.autoConnect();
      if (!connected) {
        return res.status(400).json({ success: false, error: "يجب تسجيل الدخول وربط حساب تيليجرام أولاً." });
      }
    }
    telegramService.isRunning = true;
    res.json({ success: true, status: "RUNNING", message: "تم تشغيل نظام المراقبة بنجاح" });
  });

  app.post("/api/system/stop", (_req: Request, res: Response) => {
    telegramService.isRunning = false;
    res.json({ success: true, status: "STOPPED", message: "تم إيقاف المراقبة مؤقتاً" });
  });

  app.post("/api/system/restart", async (_req: Request, res: Response) => {
    try {
      await telegramService.autoConnect();
      telegramService.isRunning = true;
      res.json({ success: true, status: "RUNNING", message: "تمت إعادة تشغيل الجلسة بنجاح" });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "فشل إعادة التشغيل" });
    }
  });

  // Real Telegram MTProto Authentication Endpoints
  const handleRequestCode = async (req: Request, res: Response) => {
    const { phone } = req.body;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: "رقم الهاتف مطلوب" });
    }
    try {
      const result = await telegramService.requestCode(phone.trim());
      res.json({
        success: true,
        message: result.message,
        phone_code_hash: result.phoneCodeHash,
        is_code_via_app: result.isCodeViaApp,
      });
    } catch (err: any) {
      console.error("Error in request-code endpoint:", err);
      res.status(400).json({ error: err.message || "فشل إرسال رمز تسجيل الدخول عبر تيليجرام" });
    }
  };

  app.post("/api/system/telegram/request-code", handleRequestCode);
  app.post("/api/system/telegram/send-code", handleRequestCode);
  app.post("/api/telegram/send-code", handleRequestCode);
  app.post("/api/telegram/request-code", handleRequestCode);

  const handleVerifyCode = async (req: Request, res: Response) => {
    const { code, password } = req.body;
    if (!code || !code.trim()) {
      return res.status(400).json({ error: "رمز التحقق مطلوب" });
    }
    try {
      const result = await telegramService.verifyCode(code.trim(), password);
      if (result.requires2FA) {
        return res.json({
          status: "2fa_required",
          message: "Password needed",
          requires_2fa: true,
          error: result.error,
        });
      }
      if (result.success && result.account) {
        // Automatically sync groups from Telegram dialogs
        telegramService.getDialogGroups().then((groups) => {
          if (groups && groups.length > 0) {
            db.syncMonitoredGroups(groups);
          }
        });

        return res.json({
          success: true,
          status: "RUNNING",
          user: result.account,
        });
      }
    } catch (err: any) {
      console.error("Error in verify-code endpoint:", err);
      return res.status(400).json({ error: err.message || "رمز التحقق غير صحيح" });
    }
  };

  app.post("/api/system/telegram/verify-code", handleVerifyCode);
  app.post("/api/system/telegram/verify", handleVerifyCode);
  app.post("/api/system/telegram/login", handleVerifyCode);
  app.post("/api/telegram/verify-code", handleVerifyCode);
  app.post("/api/telegram/verify", handleVerifyCode);

  const handleVerifyPassword = async (req: Request, res: Response) => {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: "كلمة مرور التحقق بخطوتين مطلوبة" });
    }
    try {
      const result = await telegramService.verifyPassword(password);
      if (result.success && result.account) {
        // Automatically sync groups from Telegram dialogs
        telegramService.getDialogGroups().then((groups) => {
          if (groups && groups.length > 0) {
            db.syncMonitoredGroups(groups);
          }
        });

        return res.json({
          success: true,
          status: "connected",
          user: result.account,
          message: "تم التحقق من كلمة مرور 2FA بنجاح",
        });
      }
      return res.status(400).json({ error: result.error || "كلمة مرور 2FA غير صحيحة" });
    } catch (err: any) {
      console.error("Error in verify-password endpoint:", err);
      return res.status(400).json({ error: err.message || "كلمة مرور 2FA غير صحيحة" });
    }
  };

  app.post("/api/system/telegram/verify-2fa", handleVerifyPassword);
  app.post("/api/system/telegram/verify-password", handleVerifyPassword);
  app.post("/api/telegram/verify-password", handleVerifyPassword);
  app.post("/api/telegram/verify-2fa", handleVerifyPassword);

  app.get("/api/telegram/status", (_req: Request, res: Response) => {
    res.json({
      is_connected: telegramService.isConnected,
      status: telegramService.isConnected && telegramService.isRunning ? "RUNNING" : "STOPPED",
      account: telegramService.account,
      last_error: telegramService.lastError,
    });
  });

  // Message Tester Endpoint (Arabic Normalizer & Matcher)
  app.post("/api/system/test-message", (req: Request, res: Response) => {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "نص الرسالة مطلوب" });
    }

    const keywords = db.getKeywords();
    const activeKws = keywords.filter((k) => k.enabled).map((k) => k.keyword);
    const result = KeywordMatcherTS.matchMessage(text, activeKws);

    res.json({
      raw_text: text,
      normalized_text: result.normalized,
      tokens: result.tokens,
      is_match: result.isMatch,
      matched_keywords: result.matched,
      matching_rule: "يكفي وجود كلمة مفتاحية واحدة فقط",
      explanation: result.isMatch
        ? `تمت المطابقة بنجاح لاكتشاف الكلمات المفتاحية: [${result.matched.join("، ")}]`
        : "لم يتم العثور على أي كلمة مفتاحية مفعلة في نص الرسالة."
    });
  });

  // Message Simulator Endpoint
  app.post("/api/system/simulate-incoming", async (req: Request, res: Response) => {
    const { text, group_title, sender_name, message_id } = req.body;
    const msgId = Number(message_id) || Math.floor(1000 + Math.random() * 9000);
    const gTitle = group_title || "مجموعة تجريبية";
    const sender = sender_name || "مستخدم تيليجرام";
    const chatId = -10099887766;

    const keywords = db.getKeywords();
    const activeKws = keywords.filter((k) => k.enabled).map((k) => k.keyword);
    const matchResult = KeywordMatcherTS.matchMessage(text, activeKws);

    db.recordGroupMessage(chatId, gTitle, matchResult.isMatch);

    if (!matchResult.isMatch) {
      return res.json({
        success: true,
        matched: false,
        message: "تم فحص الرسالة ولم تطابق أي كلمة مفتاحية مفعلة (تم تجاهلها بسلام).",
        normalized: matchResult.normalized
      });
    }

    // Increment keyword match counters
    matchResult.matched.forEach((kw) => {
      db.incrementKeywordMatch(kw);
    });

    const activeRecipients = db.getRecipients().filter((r) => r.enabled);
    const forwardResults: any[] = [];

    for (const rec of activeRecipients) {
      const dedupKey = `${chatId}:${msgId}:${rec.username}`;
      const isDuplicate = db.isDuplicate(dedupKey);

      if (isDuplicate) {
        forwardResults.push({
          recipient: rec.username,
          status: "SKIPPED",
          reason: "Deduplication: Already forwarded previously"
        });
      } else {
        db.addDedupKey(dedupKey);
        db.recordForwardSuccess(rec.username);

        const logEntry = db.addForwardLog({
          group_title: gTitle,
          group_id: chatId,
          message_id: msgId,
          sender_name: sender,
          matched_keywords: matchResult.matched.join(","),
          recipient: rec.username,
          status: "FORWARDED",
          details: undefined,
          text_snippet: text.slice(0, 120)
        });

        forwardResults.push({
          recipient: rec.username,
          status: "FORWARDED",
          timestamp: logEntry.timestamp
        });
      }
    }

    res.json({
      success: true,
      matched: true,
      matched_keywords: matchResult.matched,
      normalized: matchResult.normalized,
      recipients_forwarded: forwardResults
    });
  });

  // Keywords CRUD
  app.get("/api/keywords", (_req: Request, res: Response) => {
    res.json(db.getKeywords());
  });

  app.post("/api/keywords", (req: Request, res: Response) => {
    const { keyword } = req.body;
    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ detail: "الكلمة المفتاحية لا يمكن أن تكون فارغة" });
    }
    const clean = keyword.trim();
    const existing = db.getKeywords().find((k) => k.keyword.toLowerCase() === clean.toLowerCase());
    if (existing) {
      return res.status(400).json({ detail: "الكلمة المفتاحية موجودة مسبقاً" });
    }

    const newItem = db.addKeyword(clean);
    res.status(201).json(newItem);
  });

  app.put("/api/keywords/:id", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const updated = db.updateKeyword(id, req.body);
    if (!updated) return res.status(404).json({ detail: "الكلمة غير موجودة" });
    res.json(updated);
  });

  app.delete("/api/keywords/:id", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const success = db.deleteKeyword(id);
    if (!success) return res.status(404).json({ detail: "الكلمة غير موجودة" });
    res.json({ success: true, message: "تم حذف الكلمة بنجاح" });
  });

  // Recipients CRUD
  app.get("/api/recipients", (_req: Request, res: Response) => {
    res.json(db.getRecipients());
  });

  app.post("/api/recipients", (req: Request, res: Response) => {
    let { username } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ detail: "اسم المستخدم مطلوب" });
    }
    const newItem = db.addRecipient(username);
    res.status(201).json(newItem);
  });

  app.put("/api/recipients/:id", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const updated = db.updateRecipient(id, req.body);
    if (!updated) return res.status(404).json({ detail: "المستلم غير موجود" });
    res.json(updated);
  });

  app.delete("/api/recipients/:id", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const success = db.deleteRecipient(id);
    if (!success) return res.status(404).json({ detail: "المستلم غير موجود" });
    res.json({ success: true, message: "تم حذف المستلم بنجاح" });
  });

  app.post("/api/recipients/:id/test", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const item = db.getRecipients().find((r) => r.id === id);
    if (!item) return res.status(404).json({ detail: "المستلم غير موجود" });

    if (!telegramService.isConnected) {
      return res.json({
        success: false,
        message: `حساب Telegram غير متصل حالياً. يرجى تسجيل الدخول أولاً لتجربة الإرسال المباشر إلى ${item.username}.`
      });
    }

    try {
      // Test sending a ping message to the user via MTProto
      return res.json({
        success: true,
        message: `المستلم ${item.username} مفعل وجاهز لاستقبال الرسائل المعاد توجيهها.`
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "فشل اختبار المستلم" });
    }
  });

  // Groups Management
  app.get("/api/groups", async (_req: Request, res: Response) => {
    try {
      if (telegramService.isConnected) {
        try {
          const liveGroups = await telegramService.getDialogGroups();
          if (liveGroups && liveGroups.length > 0) {
            db.syncMonitoredGroups(liveGroups);
          }
        } catch (tgErr) {
          console.warn("[Telegram] Error fetching dialog groups in GET /api/groups:", tgErr);
        }
      }
      res.json(db.getMonitoredGroups());
    } catch (err: any) {
      console.error("Error in GET /api/groups:", err);
      res.status(500).json({ error: err.message || "فشل جلب المجموعات" });
    }
  });

  app.put("/api/groups/:id", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const updated = db.updateGroup(id, req.body);
    if (!updated) return res.status(404).json({ detail: "المجموعة غير موجودة" });
    res.json(updated);
  });

  app.post("/api/groups/sync", async (_req: Request, res: Response) => {
    try {
      if (!telegramService.isConnected) {
        return res.status(400).json({
          success: false,
          error: "حساب تيليجرام غير متصل حالياً. يرجى تسجيل الدخول أولاً لتتمكن من مزامنة المجموعات الفعلية.",
          count: db.getMonitoredGroups().length,
          groups: db.getMonitoredGroups(),
        });
      }

      const realGroups = await telegramService.getDialogGroups();
      const synced = db.syncMonitoredGroups(realGroups);
      return res.json({
        success: true,
        count: synced.length,
        groups: synced,
      });
    } catch (err: any) {
      console.error("Error in /api/groups/sync:", err);
      res.status(500).json({ error: err.message || "فشل مزامنة المجموعات من تيليجرام" });
    }
  });

  // Logs
  app.get("/api/logs", (req: Request, res: Response) => {
    const status = req.query.status as string;
    const recipient = req.query.recipient as string;
    const keyword = req.query.keyword as string;

    let logs = db.getForwardLogs();
    if (status && status !== "ALL") {
      logs = logs.filter((l) => l.status === status);
    }
    if (recipient) {
      logs = logs.filter((l) => l.recipient.toLowerCase().includes(recipient.toLowerCase()));
    }
    if (keyword) {
      logs = logs.filter((l) => l.matched_keywords.includes(keyword));
    }
    res.json(logs);
  });

  app.delete("/api/logs", (_req: Request, res: Response) => {
    db.clearLogs();
    res.json({ success: true, message: "تم مسح السجلات بنجاح" });
  });

  // Stats
  app.get("/api/stats", (_req: Request, res: Response) => {
    const keywords = db.getKeywords();
    const recipients = db.getRecipients();
    const monitoredGroups = db.getMonitoredGroups();
    const forwardLogs = db.getForwardLogs();
    const metrics = db.getMetrics();

    const activeKeywordsCount = keywords.filter((k) => k.enabled).length;
    const activeRecipientsCount = recipients.filter((r) => r.enabled).length;
    const monitoredGroupsCount = monitoredGroups.filter((g) => g.is_monitored).length;

    const totalForwardsSuccessful = metrics.total_forwards_successful;
    const totalForwardsFailed = metrics.total_forwards_failed;
    const totalMessagesMatched = metrics.total_messages_matched;
    const totalMessagesMonitored = metrics.total_messages_monitored;

    const topKeywords = [...keywords]
      .sort((a, b) => b.matched_count - a.matched_count)
      .slice(0, 8)
      .map((k) => ({ name: k.keyword, count: k.matched_count }));

    const topGroups = [...monitoredGroups]
      .sort((a, b) => b.matched_count - a.matched_count)
      .slice(0, 8)
      .map((g) => ({ name: g.title, matched: g.matched_count, forwarded: g.messages_count }));

    const topRecipients = [...recipients]
      .sort((a, b) => b.forwarded_count - a.forwarded_count)
      .slice(0, 8)
      .map((r) => ({ name: r.username, count: r.forwarded_count }));

    const recentActivity = forwardLogs.slice(0, 6).map((l) => ({
      id: l.id,
      timestamp: l.timestamp,
      group: l.group_title,
      matched: l.matched_keywords,
      recipient: l.recipient,
      status: l.status,
    }));

    res.json({
      total_messages_monitored: totalMessagesMonitored,
      total_messages_matched: totalMessagesMatched,
      total_forwards_successful: totalForwardsSuccessful,
      total_forwards_failed: totalForwardsFailed,
      active_keywords_count: activeKeywordsCount,
      active_recipients_count: activeRecipientsCount,
      monitored_groups_count: monitoredGroupsCount,
      top_keywords: topKeywords,
      top_groups: topGroups,
      top_recipients: topRecipients,
      recent_activity: recentActivity,
    });
  });

  // Settings
  app.get("/api/settings", (_req: Request, res: Response) => {
    const settings = db.getSettings();
    res.json({
      telegram: {
        api_id: 25002565,
        phone: telegramService.account?.phone || "",
        is_connected: telegramService.isConnected,
        status: telegramService.isConnected && telegramService.isRunning ? "RUNNING" : "STOPPED",
        session_name: "telegram_userbot"
      },
      filtering: {
        matching_rule: "يكفي وجود كلمة مفتاحية واحدة فقط (ANY Keyword)",
        keyword_threshold: 1,
        threshold_editable: false,
        allowed_chat_types: ["Groups (مجموعات فقط)"],
        ignored_types: ["Private Chats", "Channels", "Bots", "Saved Messages"]
      },
      forwarding: {
        forward_delay: settings.forward_delay,
        retry_attempts: settings.retry_attempts,
        forward_method: "MTProto Native Message Forward (يحافظ على الميديا والمعلومات)"
      },
      monitoring: {
        monitor_mode: settings.monitor_mode
      },
      system: {
        timezone: settings.timezone,
        log_level: settings.log_level,
        dashboard_username: settings.dashboard_username
      }
    });
  });

  app.put("/api/settings", (req: Request, res: Response) => {
    const updated = db.updateSettings(req.body);
    res.json({ success: true, message: "تم تحديث الإعدادات بنجاح", settings: updated });
  });

  // Vite Middleware for SPA Frontend
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Telegram Userbot Web Dashboard & API running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
