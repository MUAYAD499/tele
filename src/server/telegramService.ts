import fs from "fs";
import path from "path";
import { TelegramClient, Api, password as telegramPassword } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage, NewMessageEvent, Raw } from "telegram/events/index.js";
import { db } from "./database";

const DATA_DIR = path.join(process.cwd(), "data");
const SESSION_FILE = path.join(DATA_DIR, "telegram_session.json");

export interface TelegramAccountInfo {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  phone: string;
}

export class RealTelegramService {
  private apiId: number = 25002565;
  private apiHash: string = "9b6218bccd56051ca8ac7acb9eb71066";
  
  public client: TelegramClient | null = null;
  public pendingClient: TelegramClient | null = null;
  public pendingPhone: string = "";
  public pendingPhoneCodeHash: string = "";
  
  public isConnected: boolean = false;
  public isRunning: boolean = false;
  public account: TelegramAccountInfo | null = null;
  public lastError: string | null = null;

  // Synchronization and keep-alive timers
  private syncTimer: NodeJS.Timeout | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;
  private processedMsgCache: Map<string, number> = new Map();

  // Callbacks for incoming messages and events
  private onIncomingMessageCallback?: (data: {
    chatId: number;
    chatTitle: string;
    messageId: number;
    senderName: string;
    senderId?: string;
    senderUsername?: string | null;
    isOutgoing: boolean;
    text: string;
    rawMessage: any;
  }) => Promise<void>;

  constructor() {
    this.ensureDataDir();
  }

  private ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (e) {
      console.error("Failed to create data directory:", e);
    }
  }

  public setOnIncomingMessage(cb: (data: any) => Promise<void>) {
    this.onIncomingMessageCallback = cb;
  }

  public hasSession(): boolean {
    const s = this.loadSessionString();
    return Boolean(s && s.session);
  }

  private loadSessionString(): { session: string; phone?: string } | null {
    try {
      if (fs.existsSync(SESSION_FILE)) {
        const raw = fs.readFileSync(SESSION_FILE, "utf-8");
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error("Error reading session file:", e);
    }
    return null;
  }

  private saveSessionString(session: string, phone: string, account?: TelegramAccountInfo) {
    try {
      this.ensureDataDir();
      fs.writeFileSync(
        SESSION_FILE,
        JSON.stringify({ session, phone, account, updatedAt: new Date().toISOString() }, null, 2),
        "utf-8"
      );
      console.log("[Telegram] Session saved to", SESSION_FILE);
    } catch (e) {
      console.error("Error saving session file:", e);
    }
  }

  public isAuthError(err: any): boolean {
    if (!err) return false;
    const msg = String(err?.errorMessage || err?.message || err || "");
    return (
      msg.includes("SESSION_REVOKED") ||
      msg.includes("AUTH_KEY_UNREGISTERED") ||
      msg.includes("USER_DEACTIVATED") ||
      msg.includes("SESSION_EXPIRED") ||
      msg.includes("401") ||
      msg.includes("AUTH_KEY_INVALID")
    );
  }

  public handleSessionRevoked(reason?: string) {
    console.warn(`[Telegram] Session revoked or expired (${reason || "SESSION_REVOKED"}). Cleaning up active session...`);
    this.stopBackgroundSync();
    this.lastError = "تم إلغاء أو انتهاء صلاحية جلسة تيليجرام (SESSION_REVOKED). يرجى تسجيل الدخول مجددًا برقم الهاتف ورمز التحقق.";
    this.clearSession();
  }

  public clearSession() {
    this.stopBackgroundSync();
    try {
      if (fs.existsSync(SESSION_FILE)) {
        fs.unlinkSync(SESSION_FILE);
      }
      this.isConnected = false;
      this.isRunning = false;
      this.account = null;
      if (this.client) {
        try {
          this.client.disconnect();
        } catch (_) {}
        this.client = null;
      }
      console.log("[Telegram] Session cleared and client disconnected cleanly.");
    } catch (e) {
      console.error("Error clearing session:", e);
    }
  }

  public async autoConnect(): Promise<boolean> {
    const saved = this.loadSessionString();
    if (!saved || !saved.session) {
      console.log("[Telegram] No existing session found on disk. Waiting for user login.");
      return false;
    }

    console.log("[Telegram] Existing session found. Initializing Telegram Client...");
    try {
      const session = new StringSession(saved.session);
      this.client = new TelegramClient(session, this.apiId, this.apiHash, {
        connectionRetries: 3,
        useWSS: false,
        autoReconnect: false,
      });

      await this.client.connect();

      const authorized = await this.client.checkAuthorization();
      if (!authorized) {
        console.warn("[Telegram] Saved session is no longer authorized (SESSION_REVOKED).");
        this.handleSessionRevoked("Saved session unauthorized");
        return false;
      }

      const me = (await this.client.getMe()) as Api.User;
      this.account = {
        id: Number(me.id),
        first_name: me.firstName || "",
        last_name: me.lastName || "",
        username: me.username || "",
        phone: me.phone || saved.phone || "",
      };
      this.isConnected = true;
      this.isRunning = true;
      this.lastError = null;

      console.log(`[Telegram] Authenticated successfully as @${this.account.username || this.account.first_name} (ID: ${this.account.id})`);

      this.registerEventHandler();
      this.startBackgroundSync();
      return true;
    } catch (err: any) {
      console.error("[Telegram] Auto-connect failed:", err);
      if (this.isAuthError(err)) {
        this.handleSessionRevoked(err?.message || "SESSION_REVOKED");
      } else {
        this.lastError = err.message || String(err);
        this.isConnected = false;
        if (this.client) {
          try {
            this.client.disconnect();
          } catch (_) {}
          this.client = null;
        }
      }
      return false;
    }
  }

  // Step 1: Request Login Code from Telegram
  public async requestCode(phoneNumber: string): Promise<{ success: boolean; phoneCodeHash: string; isCodeViaApp?: boolean; message?: string }> {
    const cleanPhone = phoneNumber.trim().replace(/\s+/g, "");
    console.log(`[Telegram] Initiating MTProto sendCode for ${cleanPhone}...`);

    try {
      if (this.pendingClient) {
        try {
          await this.pendingClient.disconnect();
        } catch (_) {}
      }

      const session = new StringSession("");
      this.pendingClient = new TelegramClient(session, this.apiId, this.apiHash, {
        connectionRetries: 5,
        useWSS: false,
      });

      await this.pendingClient.connect();

      const res = await this.pendingClient.sendCode(
        { apiId: this.apiId, apiHash: this.apiHash },
        cleanPhone,
        false
      );

      this.pendingPhone = cleanPhone;
      this.pendingPhoneCodeHash = res.phoneCodeHash;

      console.log(`[Telegram] Code sent successfully via Telegram. Hash: ${res.phoneCodeHash}, ViaApp: ${res.isCodeViaApp}`);
      return {
        success: true,
        phoneCodeHash: res.phoneCodeHash,
        isCodeViaApp: res.isCodeViaApp,
        message: res.isCodeViaApp
          ? "تم إرسال رمز تسجيل الدخول إلى تطبيق Telegram على أجهزتك الأخرى."
          : "تم إرسال رمز تسجيل الدخول عبر رسالة نصية SMS إلى هاتفك."
      };
    } catch (err: any) {
      console.error("[Telegram] requestCode error:", err);
      let rawMsg = err.message || String(err);
      let userMsg = rawMsg;
      
      if (rawMsg.includes("PHONE_NUMBER_INVALID")) {
        userMsg = "رقم الهاتف غير صالح في تيليجرام (PHONE_NUMBER_INVALID). يرجى التأكد من كتابة المفتاح الدولي بشكل صحيح مثل +967xxxxxxxxx";
      } else if (rawMsg.includes("PHONE_NUMBER_UNREGISTERED")) {
        userMsg = "رقم الهاتف هذا غير مسجل في تيليجرام (PHONE_NUMBER_UNREGISTERED). يرجى تسجيل حساب في تطبيق Telegram أولاً.";
      } else if (rawMsg.includes("FLOOD_WAIT")) {
        userMsg = `تم حظرك مؤقتاً من قبل تيليجرام لتكرار المحاولات (${rawMsg}). يرجى الانتظار والمحاولة لاحقاً.`;
      } else if (rawMsg.includes("AUTH_KEY_UNREGISTERED")) {
        userMsg = "انتهت صلاحية جلسة الاتصال بمفتاح MTProto. جاري إعادة تهيئة المفتاح.";
      }
      
      const errorToThrow = new Error(`${userMsg} [الخطأ الأصلي من Telegram: ${rawMsg}]`);
      throw errorToThrow;
    }
  }

  // Step 2: Verify Code and optional 2FA Password
  public async verifyCode(
    code: string,
    password?: string
  ): Promise<{ success: boolean; requires2FA?: boolean; account?: TelegramAccountInfo; error?: string }> {
    if (!this.pendingClient || !this.pendingPhone || !this.pendingPhoneCodeHash) {
      throw new Error("لم يتم العثور على طلب تسجيل دخول نشط. يرجى طلب الرمز أولاً.");
    }

    console.log(`[Telegram] Verifying code for ${this.pendingPhone}...`);

    try {
      let user: any = null;

      try {
        const res = await this.pendingClient.invoke(
          new Api.auth.SignIn({
            phoneNumber: this.pendingPhone,
            phoneCodeHash: this.pendingPhoneCodeHash,
            phoneCode: code.trim(),
          })
        );
        user = (res as any).user;
      } catch (signInErr: any) {
        if (signInErr.message?.includes("SESSION_PASSWORD_NEEDED")) {
          if (!password) {
            console.log("[Telegram] 2FA Password is required for this account.");
            return {
              success: false,
              requires2FA: true,
              error: "هذا الحساب محمي بكلمة مرور التحقق بخطوتين (2FA). يرجى إدخال كلمة المرور للمتابعة.",
            };
          }

          console.log("[Telegram] Computing 2FA SRP Check...");
          const passwordSrp = await this.pendingClient.invoke(new Api.account.GetPassword());
          const passwordSrpResult = await telegramPassword.computeCheck(passwordSrp, password);
          const res2fa = await this.pendingClient.invoke(
            new Api.auth.CheckPassword({
              password: passwordSrpResult,
            })
          );
          user = (res2fa as any).user;
        } else {
          throw signInErr;
        }
      }

      // Successful auth!
      this.client = this.pendingClient;
      this.pendingClient = null;

      const sessionString = (this.client.session as any).save();

      const me = user || ((await this.client.getMe()) as Api.User);
      this.account = {
        id: Number(me.id),
        first_name: me.firstName || "",
        last_name: me.lastName || "",
        username: me.username || "",
        phone: me.phone || this.pendingPhone,
      };

      this.saveSessionString(sessionString, this.pendingPhone, this.account);
      this.isConnected = true;
      this.isRunning = true;
      this.lastError = null;

      console.log(`[Telegram] Login complete! User: @${this.account.username || this.account.first_name} (ID: ${this.account.id})`);

      this.registerEventHandler();

      return {
        success: true,
        account: this.account,
      };
    } catch (err: any) {
      console.error("[Telegram] verifyCode error:", err);
      let raw = err.message || String(err);
      let msg = raw;
      if (raw.includes("PHONE_CODE_INVALID") || raw.includes("PHONE_CODE_EXPIRED")) {
        msg = "رمز التحقق غير صحيح أو انتهت صلاحيته في تيليجرام (PHONE_CODE_INVALID). يرجى التأكد وإعادة المحاولة.";
      } else if (raw.includes("PASSWORD_HASH_INVALID")) {
        msg = "كلمة مرور التحقق بخطوتين (2FA) غير صحيحة (PASSWORD_HASH_INVALID).";
      }
      throw new Error(`${msg} [خطأ تيليجرام: ${raw}]`);
    }
  }

  // Step 3: Verify 2FA Cloud Password independently
  public async verifyPassword(password: string): Promise<{ success: boolean; account?: TelegramAccountInfo; error?: string }> {
    if (!this.pendingClient) {
      throw new Error("لم يتم العثور على جلسة تسجيل دخول نشطة. يرجى طلب الرمز أولاً.");
    }

    try {
      console.log("[Telegram] Computing 2FA SRP Check for verifyPassword...");
      const passwordSrp = await this.pendingClient.invoke(new Api.account.GetPassword());
      const passwordSrpResult = await telegramPassword.computeCheck(passwordSrp, password);
      const res2fa = await this.pendingClient.invoke(
        new Api.auth.CheckPassword({
          password: passwordSrpResult,
        })
      );
      const user = (res2fa as any).user;

      this.client = this.pendingClient;
      this.pendingClient = null;

      const sessionString = (this.client.session as any).save();
      const me = (await this.client.getMe()) as any;
      this.account = {
        id: Number(me.id),
        username: me.username || null,
        first_name: me.firstName || "Telegram User",
        last_name: me.lastName || null,
        phone: me.phone || this.pendingPhone,
      };

      this.saveSessionString(sessionString, this.pendingPhone || "", this.account);
      this.isConnected = true;
      this.isRunning = true;
      this.lastError = null;

      console.log(`[Telegram] 2FA Login complete! User: @${this.account.username || this.account.first_name} (ID: ${this.account.id})`);
      this.registerEventHandler();

      return {
        success: true,
        account: this.account,
      };
    } catch (err: any) {
      console.error("[Telegram] verifyPassword error:", err);
      let raw = err.message || String(err);
      let msg = raw;
      if (raw.includes("PASSWORD_HASH_INVALID")) {
        msg = "كلمة مرور التحقق بخطوتين (2FA) غير صحيحة.";
      }
      return { success: false, error: msg };
    }
  }

  // Unified Message Processing Pipeline
  public async processMessage(msg: any, knownGroupTitle?: string) {
    if (!msg || !this.isRunning) return;

    try {
      // 1. Extract text from message body or media caption
      const text = msg.message || msg.text || msg.caption || "";
      if (!text || !text.trim()) return;

      const textPreview = text.length > 80 ? text.slice(0, 80) + "..." : text;

      // 2. Determine Outgoing vs Incoming
      const isOutgoing = Boolean(msg.out);

      // 3. Sender Identification (NEVER EXCLUDE OTHER MEMBERS)
      let senderId: string = "";
      let senderUsername: string | null = null;
      let senderName: string = isOutgoing ? "حسابي (Self / Outgoing)" : "عضو في المجموعة";

      if (isOutgoing && this.account) {
        senderId = String(this.account.id || "");
        senderUsername = this.account.username ? `@${this.account.username}` : null;
        senderName = `${this.account.first_name || ""} ${this.account.last_name || ""}`.trim() || "حسابي (Self)";
      }

      if (!isOutgoing) {
        if (msg.sender) {
          const s = msg.sender;
          if (s.id) senderId = String(s.id);
          if (s.username) senderUsername = `@${s.username}`;
          if (s.firstName) senderName = `${s.firstName} ${s.lastName || ""}`.trim();
          else if (s.title) senderName = s.title;
        } else if (typeof msg.getSender === "function") {
          try {
            const s = await msg.getSender();
            if (s) {
              if (s.id) senderId = String(s.id);
              if (s.username) senderUsername = `@${s.username}`;
              if (s.firstName) senderName = `${s.firstName} ${s.lastName || ""}`.trim();
              else if (s.title) senderName = s.title;
            }
          } catch (_) {}
        }
      }

      if (!senderId && msg.fromId) {
        if ("userId" in msg.fromId) senderId = String(msg.fromId.userId);
        else if ("channelId" in msg.fromId) senderId = String(msg.fromId.channelId);
        else if ("chatId" in msg.fromId) senderId = String(msg.fromId.chatId);
      }
      if (!senderId && msg.senderId) {
        senderId = String(msg.senderId);
      }

      // 4. Chat and Peer Identification
      let chatIdStr = "";
      let chatIdNum = 0;
      const peer = msg.peerId;

      const isChannelPeer = peer instanceof Api.PeerChannel || (peer as any)?.className === "PeerChannel";
      const isChatPeer = peer instanceof Api.PeerChat || (peer as any)?.className === "PeerChat";
      const isUserPeer = peer instanceof Api.PeerUser || (peer as any)?.className === "PeerUser";

      if (isChannelPeer) {
        const rawId = String((peer as any).channelId || "");
        chatIdStr = rawId.startsWith("-100") ? rawId : `-100${rawId.replace(/^-/, "")}`;
        chatIdNum = Number(chatIdStr);
      } else if (isChatPeer) {
        const rawId = String((peer as any).chatId || "");
        chatIdStr = rawId.startsWith("-") ? rawId : `-${rawId}`;
        chatIdNum = Number(chatIdStr);
      } else if (isUserPeer) {
        chatIdStr = String((peer as any).userId || "");
        chatIdNum = Number(chatIdStr);
      } else if (typeof msg.chatId !== "undefined") {
        chatIdStr = String(msg.chatId);
        chatIdNum = Number(msg.chatId);
      }

      // 5. Robust Group vs Broadcast Channel / Private Chat Detection
      // Project Rules:
      // - Groups: monitored
      // - Private Chats: NOT monitored
      // - Channels (Broadcast): NOT monitored
      // - Bots: NOT monitored
      // - Saved Messages: NOT monitored
      let isGroup = false;

      if (isChatPeer) {
        isGroup = true;
      } else if (isChannelPeer) {
        // If msg.post is true, it is an administrative broadcast channel post, NOT a group
        if (msg.post) {
          isGroup = false;
        } else {
          isGroup = true; // Supergroup / megagroup
        }
      } else if (isUserPeer) {
        isGroup = false; // Direct message / Bot / Saved Messages
      }

      // Also check against monitored groups in database
      if (!isGroup && chatIdStr) {
        const bareId = chatIdStr.replace(/^-100|-/, "");
        const inDb = db.getMonitoredGroups().some((g) => {
          const gStr = String(g.chat_id);
          return gStr === chatIdStr || gStr.replace(/^-100|-/, "") === bareId;
        });
        if (inDb) {
          isGroup = true;
        }
      }

      // If not a group, skip
      if (!isGroup) {
        return;
      }

      // 6. Accurate Chat Title Resolution
      let chatTitle = knownGroupTitle || "";
      if (!chatTitle || chatTitle === "مجموعة تيليجرام") {
        const bareId = chatIdStr.replace(/^-100|-/, "");
        const dbGroup = db.getMonitoredGroups().find(
          (g) => String(g.chat_id) === chatIdStr || String(g.chat_id).replace(/^-100|-/, "") === bareId
        );
        if (dbGroup && dbGroup.title) {
          chatTitle = dbGroup.title;
        }
      }
      if (!chatTitle || chatTitle === "مجموعة تيليجرام") {
        try {
          if (this.client && peer) {
            const entity = await this.client.getEntity(peer);
            if (entity && "title" in entity && (entity as any).title) {
              chatTitle = (entity as any).title;
            }
          }
        } catch (_) {}
      }
      if (!chatTitle) {
        chatTitle = "مجموعة تيليجرام";
      }

      // 7. Diagnostic Logging
      console.log(`\n========================================`);
      console.log(`[Telegram Message Detected]`);
      console.log(`  chat_id: ${chatIdStr || chatIdNum}`);
      console.log(`  chat_title: "${chatTitle}"`);
      console.log(`  sender_id: ${senderId || "Unknown"}`);
      console.log(`  sender_name: "${senderName}"`);
      console.log(`  sender_username: ${senderUsername || "N/A"}`);
      console.log(`  is_outgoing: ${isOutgoing}`);
      console.log(`  message_id: ${msg.id}`);
      console.log(`  text preview: "${textPreview}"`);
      console.log(`  is_group: ${isGroup}`);
      console.log(`========================================\n`);

      // 8. Dispatch to match and forward handler
      if (this.onIncomingMessageCallback) {
        await this.onIncomingMessageCallback({
          chatId: chatIdNum,
          chatTitle,
          messageId: msg.id,
          senderName,
          senderId,
          senderUsername,
          isOutgoing,
          text,
          rawMessage: msg,
        });
      }
    } catch (err) {
      console.error("[Telegram] Error in processMessage:", err);
    }
  }

  // Register MTProto real-time event listener for Group Messages
  private registerEventHandler() {
    if (!this.client) return;

    try {
      // 1. High-Level NewMessage Listener
      this.client.addEventHandler(async (event: NewMessageEvent) => {
        if (!this.isRunning) return;
        const msg = event.message;
        if (!msg) return;

        let groupTitle = "";
        try {
          const chat = await event.getChat();
          if (chat && "title" in chat && (chat as any).title) {
            groupTitle = (chat as any).title;
          }
        } catch (_) {}

        // Resolve chatId for dedup cache
        const peer = msg.peerId;
        let cId = "";
        if (peer instanceof Api.PeerChannel || (peer as any)?.className === "PeerChannel") {
          cId = `-100${(peer as any).channelId}`;
        } else if (peer instanceof Api.PeerChat || (peer as any)?.className === "PeerChat") {
          cId = `-${(peer as any).chatId}`;
        }
        if (cId) {
          const cacheKey = `${cId}:${msg.id}`;
          if (this.processedMsgCache.has(cacheKey)) return;
          this.processedMsgCache.set(cacheKey, Date.now());
        }

        await this.processMessage(msg, groupTitle);
      }, new NewMessage({}));

      // 2. Raw MTProto Update Listener for Zero-Drop Resiliency
      this.client.addEventHandler(async (update: any) => {
        if (!this.isRunning) return;
        try {
          if (update instanceof Api.UpdateNewChannelMessage || update instanceof Api.UpdateNewMessage) {
            if (update.message instanceof Api.Message) {
              const msg = update.message;
              const peer = msg.peerId;
              let cId = "";
              if (peer instanceof Api.PeerChannel || (peer as any)?.className === "PeerChannel") {
                cId = `-100${(peer as any).channelId}`;
              } else if (peer instanceof Api.PeerChat || (peer as any)?.className === "PeerChat") {
                cId = `-${(peer as any).chatId}`;
              }
              if (cId) {
                const cacheKey = `${cId}:${msg.id}`;
                if (this.processedMsgCache.has(cacheKey)) return;
                this.processedMsgCache.set(cacheKey, Date.now());
              }
              await this.processMessage(msg);
            }
          }
        } catch (_) {}
      }, new Raw({}));

      console.log("[Telegram] MTProto Real-Time Event Listener active for ALL member messages in subscribed groups!");
    } catch (e) {
      console.error("[Telegram] Failed to register event handler:", e);
    }
  }

  // Background Channel Synchronizer & Push Keep-Alive Worker
  public startBackgroundSync() {
    this.stopBackgroundSync();

    console.log("[Telegram Sync Worker] Starting triple-layer monitoring & channel keep-alive worker...");

    // Initialize baseline message cache from current dialogs to prevent historic replay on startup
    if (this.client && this.isConnected) {
      this.client
        .getDialogs({ limit: 40 })
        .then((dialogs) => {
          for (const d of dialogs) {
            if (d.message && d.id) {
              this.processedMsgCache.set(`${Number(d.id)}:${d.message.id}`, Date.now());
            }
          }
        })
        .catch(() => {});
    }

    // 1. Keep-Alive Loop: Clean ping every 25s
    this.keepAliveTimer = setInterval(async () => {
      if (!this.client || !this.isConnected || !this.isRunning) return;
      try {
        await this.client.getDialogs({ limit: 10 });
      } catch (err: any) {
        if (this.isAuthError(err)) {
          this.handleSessionRevoked(err?.message || "SESSION_REVOKED");
        }
      }
    }, 25000);

    // 2. Active Channel Fast-Syncer: Checks active dialogs every 2.5s for instant capture across ALL groups
    this.syncTimer = setInterval(async () => {
      if (!this.client || !this.isConnected || !this.isRunning || this.isSyncing) return;
      this.isSyncing = true;

      try {
        const dialogs = await this.client.getDialogs({ limit: 35 });
        if (!dialogs || dialogs.length === 0) return;

        for (const d of dialogs) {
          if (!this.isRunning || !this.isConnected || !this.client) break;
          // Only inspect groups (regular groups, supergroups, megagroups)
          if (!d.isGroup) continue;

          const msg = d.message;
          if (!msg || !msg.id) continue;

          const chatId = Number(d.id);
          const cacheKey = `${chatId}:${msg.id}`;

          if (this.processedMsgCache.has(cacheKey)) continue;
          this.processedMsgCache.set(cacheKey, Date.now());

          // Keep cache bounded
          if (this.processedMsgCache.size > 5000) {
            const keys = Array.from(this.processedMsgCache.keys());
            for (let i = 0; i < 500; i++) {
              this.processedMsgCache.delete(keys[i]);
            }
          }

          // Process the newest message for this group
          await this.processMessage(msg, d.title);

          // If there were multiple unread messages in this group, fetch the last few unread messages
          if (d.unreadCount && d.unreadCount > 1) {
            try {
              const extraMsgs = await this.client.getMessages(d.inputEntity, {
                limit: Math.min(d.unreadCount, 5),
              });
              if (extraMsgs && extraMsgs.length > 0) {
                for (const em of extraMsgs) {
                  if (!em || !em.id) continue;
                  const eKey = `${chatId}:${em.id}`;
                  if (this.processedMsgCache.has(eKey)) continue;
                  this.processedMsgCache.set(eKey, Date.now());
                  await this.processMessage(em, d.title);
                }
              }
            } catch (_) {}
          }
        }
      } catch (err: any) {
        if (this.isAuthError(err)) {
          this.handleSessionRevoked(err?.message || "SESSION_REVOKED");
        }
      } finally {
        this.isSyncing = false;
      }
    }, 2500);
  }

  public stopBackgroundSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  // Native MTProto message forwarding
  public async forwardMessage(
    recipientUsername: string,
    fromChatId: number,
    messageId: number,
    rawMessage?: any
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.client || !this.isConnected) {
      throw new Error("Telegram client is not connected.");
    }

    try {
      const cleanUsername = recipientUsername.startsWith("@") ? recipientUsername : `@${recipientUsername}`;
      console.log(`[Telegram] Forwarding message #${messageId} from chat ${fromChatId} to ${cleanUsername}...`);

      const recipientEntity = await this.client.getInputEntity(cleanUsername);

      // Method 1: If rawMessage is available, try rawMessage.forwardTo
      if (rawMessage && typeof rawMessage.forwardTo === "function") {
        try {
          await rawMessage.forwardTo(recipientEntity);
          console.log(`[Telegram] Forwarded #${messageId} to ${cleanUsername} via rawMessage.forwardTo successfully!`);
          return { success: true };
        } catch (fwdErr: any) {
          console.warn(`[Telegram] rawMessage.forwardTo fallback to client.forwardMessages:`, fwdErr?.message || fwdErr);
        }
      }

      // Method 2: Standard client.forwardMessages
      await this.client.forwardMessages(recipientEntity, {
        messages: [messageId],
        fromPeer: fromChatId,
      });

      console.log(`[Telegram] Forwarded #${messageId} to ${cleanUsername} successfully!`);
      return { success: true };
    } catch (err: any) {
      console.error(`[Telegram] Failed to forward message #${messageId} to ${recipientUsername}:`, err);
      if (this.isAuthError(err)) {
        this.handleSessionRevoked(err?.message || "SESSION_REVOKED");
      }
      let errStr = err.message || String(err);
      if (errStr.includes("FLOOD_WAIT")) {
        errStr = "FLOOD_WAIT";
      }
      return { success: false, error: errStr };
    }
  }

  // Fetch real subscribed dialogs/groups
  public async getDialogGroups(): Promise<Array<{ id: number; chatId: number; title: string; username: string | null; membersCount: number }>> {
    if (!this.client || !this.isConnected) {
      return [];
    }

    try {
      const dialogs = await this.client.getDialogs({ limit: 200 });
      const groups = dialogs.filter((d) => {
        if (d.isGroup) return true;
        if (d.isChannel) {
          const entity = d.entity as any;
          return entity?.megagroup || entity?.gigagroup || entity?.broadcast === false;
        }
        return false;
      });

      return groups.map((g, idx) => {
        const entity = g.entity as any;
        let membersCount = 0;
        if (entity) {
          if (typeof entity.participantsCount === "number") {
            membersCount = entity.participantsCount;
          } else if (typeof entity.participants_count === "number") {
            membersCount = entity.participants_count;
          }
        }
        let username = null;
        if (entity?.username) {
          username = entity.username.startsWith("@") ? entity.username : `@${entity.username}`;
        }

        return {
          id: idx + 1,
          chatId: Number(g.id),
          title: g.title || "مجموعة تيليجرام",
          username,
          membersCount,
        };
      });
    } catch (err: any) {
      console.error("[Telegram] Failed to fetch dialogs:", err);
      if (this.isAuthError(err)) {
        this.handleSessionRevoked(err?.message || "SESSION_REVOKED");
      }
      return [];
    }
  }
}

export const telegramService = new RealTelegramService();
