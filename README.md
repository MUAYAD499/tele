# Telegram Userbot Message Filter & Forwarder 🚀
### نظام متكامل لمراقبة مجموعات تيليجرام وفلترة الرسائل حسب الكلمات المفتاحية وإعادة توجيهها مع لوحة تحكم ويب احترافية

---

## 📌 الفكرة العامة والميزات الأساسية

هذا المشروع مصمم ليعمل كـ **Telegram Userbot** حقيقي باستخدام حساب تيليجرام الشخصي (MTProto API عبر مكتبة Telethon) وليس Bot API.

- **قاعدة المطابقة الثابتة (ANY Keyword Rule):** يكفي وجود **أي كلمة مفتاحية واحدة فقط** من الكلمات المفعلة ليتم فوراً إضافة الرسالة للـ Queue وإعادة توجيهها.
- **تخصيص المجموعات فقط:** يتجاهل النظام تلقائياً المحادثات الخاصة (Private Chats)، القنوات (Channels)، البوتات (Bots)، والرسائل المحفوظة (Saved Messages).
- **التطبيع العربي الذكي (Arabic Normalization):** إزالة التشكيل والتطويل، توحيد الهمزات والألف، وتنظيف علامات الترقيم مع التحقق من حدود الكلمات لمنع المطابقات الخاطئة.
- **إعادة التوجيه الأصيل (Native MTProto Forwarding):** يحافظ على كافة الوسائط (نصوص، صور، فيديو، ملفات، مقاطع صوتية، فويس، كابشن) وهوية المرسل الأصلي.
- **منع التكرار التام (Deduplication):** قيد فريد في قاعدة البيانات على `chat_id + message_id + recipient` لمنع تكرار الإرسال حتى بعد إعادة تشغيل الخادم.
- **طابور إرسال منفصل (Queue & Worker):** مستمع الأحداث لا يتوقف؛ حيث يتم إرسال الرسائل عبر Worker مستقل يتعامل مع `FloodWait` و`Exponential Backoff` ومهلة الإرسال `FORWARD_DELAY`.
- **حماية المحتوى المحمي:** في حال كانت المجموعة أو الرسالة محمية من إعادة التوجيه (Protected Content)، يتم تسجيل ذلك بسلاسة دون محاولة كسر الحماية ودون توقف النظام.
- **لوحة تحكم Web Dashboard عصرية:** تدعم الوضع الداكن/الفاتح، إدارة الكلمات والمستلمين والمجموعات، عرض السجلات الحية، الإحصائيات، ومختبر تجربة مباشر للرسائل.

---

## 🏗️ بنية المشروع (Architecture)

```text
                    Telegram Account (Userbot MTProto)
                                    │
                                    ▼
                          Telethon Listener
                       (Groups Only Verification)
                                    │
                                    ▼
                            Message Parser
                                    │
                                    ▼
                         Arabic Normalizer
             (Tashkeel, Tatweel, Hamza & Punctuation Clean)
                                    │
                                    ▼
                          Keyword Matcher
                   (Single Keyword OR Threshold = 1)
                                    │
                                    ▼
                           Deduplication Check
                    (chat_id + message_id + recipient)
                                    │
                                    ▼
                         Forward Queue Manager
                                    │
                                    ▼
                          Async Forward Worker
                  (FloodWait + Rate Delay + Retries)
                                    │
                     ┌──────────────┼──────────────┐
                     ▼              ▼              ▼
               @topmark1st    @tamkeenco3       @m_9q6

               
                               Web Dashboard
               (React + Tailwind + Express / FastAPI REST API)
                                    │
                                    ▼
                       SQLite / PostgreSQL Database
```

---

## ⚙️ متطلبات التشغيل

- **Python:** 3.10 أو أحدث
- **Node.js:** 18 أو 20+ (لبناء لوحة التحكم)
- **Docker & Docker Compose:** (في حال النشر بالحاويات)
- **حساب تيليجرام شخصي نشط**

---

## 🔐 إعداد متغيرات البيئة (`.env`)

أنشئ ملف `.env` في المجلد الرئيسي بناءً على `.env.example`:

```env
# Telegram MTProto Credentials
TELEGRAM_API_ID=25002565
TELEGRAM_API_HASH=9b6218bccd56051ca8ac7acb9eb71066
TELEGRAM_PHONE=+966500000000
TELEGRAM_SESSION_NAME=telegram_userbot

# Dashboard Login
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=your_secure_password
SECRET_KEY=generate-a-secure-random-jwt-secret-key-32chars

# Database
DATABASE_URL=sqlite:///./data/database.db

# Engine Rules
KEYWORD_THRESHOLD=1
FORWARD_DELAY=2
MONITOR_MODE=ALL

# System
LOG_LEVEL=INFO
TIMEZONE=Asia/Aden
```

> **ملاحظة أمان هامة:** ملف `.env` وملفات جلسة التيليجرام `*.session` مستثناة تماماً من الـ Git في `.gitignore` ولا يتم رفعها أو عرضها في أي مكان عام.

---

## 🚀 التشغيل السريع بواسطة Docker Compose (موصى به للإنتاج)

1. **تشغيل الحاوية بالخلفية:**
   ```bash
   docker compose up -d --build
   ```

2. **تسجيل الدخول لأول مرة بحساب التيليجرام:**
   - افتح لوحة التحكم في المتصفح: `http://localhost:3000`
   - سجّل الدخول ببيانات الـ Admin.
   - من شريط الحالة أو صفحة الإعدادات، اضغط **ربط حساب تيليجرام**.
   - أدخل رقم هاتفك مع الرمز الدولي (مثال: `+9665...`).
   - أدخل الرمز الواصل على تطبيق تيليجرام.
   - إذا كان حسابك مفعلاً بالتحقق بخطوتين (2FA)، أدخل كلمة المرور.
   - سيتم حفظ الجلسة داخل الـ Volume الدائم `./data/` ولن يطلب الرمز مجدداً بعد أي إعادة تشغيل!

3. **متابعة السجلات:**
   ```bash
   docker compose logs -f
   ```

---

## 💻 التشغيل المحلي اليدوي (Manual / Dev)

### 1. تشغيل Backend (FastAPI / Telethon)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # في ويندوز: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. تشغيل لوحة التحكم (Frontend React)
```bash
npm install
npm run dev
```

---

## 🧪 تشغيل الاختبارات الآلية (Automated Tests)

المشروع مزود باختبارات تغطي التطبيع، واكتشاف الكلمات، وحدود الكلمات، وتجنب التكرار:

```bash
pytest backend/tests -v
```

الحالات المختبرة تشمل:
- **Test 1:** `"عندي واجب"` -> `MATCH = TRUE` (اكتشاف `واجب`)
- **Test 2:** `"السلام عليكم جميعاً"` -> `MATCH = FALSE`
- **Test 3:** `"من يعرف كيف يسوي المشروع؟"` -> `MATCH = TRUE` (اكتشاف `يعرف`, `يسوي`, `مشروع`)
- **Prefixes Test:** `"بالمشروع"` / `"للمشروع"` -> مطابقة صحيحة بدون أخطاء.
- **Disabled Keyword:** الكلمات المعطلة لا يتم احتسابها.

---

## 🌐 النشر على خادم VPS (Ubuntu 22.04 / 24.04)

### الخطوة 1: تثبيت Docker على الـ VPS
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### الخطوة 2: رفع المشروع وإعداد `.env`
```bash
git clone <your-private-repo-url> /opt/telegram-filter
cd /opt/telegram-filter
cp .env.example .env
nano .env  # عدل كلمات المرور ورقم الهاتف
```

### الخطوة 3: تشغيل الخدمة 24/7
```bash
docker compose up -d
```
بفضل إعداد `restart: always`، سيعمل النظام تلقائياً عند إعادة تشغيل الخادم (Server Reboot) أو انقطاع الشبكة.

---

## 🔒 ربط النطاق (Domain) وشهادة SSL المجانية (HTTPS)

### إعداد Nginx كـ Reverse Proxy:
1. ثبّت Nginx و Certbot:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. أنشئ ملف الإعداد `/etc/nginx/sites-available/telegram-bot.conf`:
   ```nginx
   server {
       server_name your-domain.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

3. فعّل الموقع واستخرج شهادة SSL:
   ```bash
   sudo ln -s /etc/nginx/sites-available/telegram-bot.conf /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   sudo certbot --nginx -d your-domain.com
   ```

---

## 💾 النسخ الاحتياطي واستعادة البيانات (Backup & Restore)

كافة البيانات (قاعدة البيانات وجلسة تيليجرام) موجودة في مجلد `./data/`:

### النسخ الاحتياطي:
```bash
tar -czvf telegram_userbot_backup_$(date +%F).tar.gz ./data .env
```

### الاستعادة:
```bash
tar -xzvf telegram_userbot_backup_YYYY-MM-DD.tar.gz
docker compose restart
```

---

## 🛡️ التعامل مع قيود تيليجرام و FloodWait

- **FloodWait:** عند استلام خطأ `FloodWaitError` من تيليجرام، يقرأ النظام عدد الثواني المطلوب انتظارها عبر `e.seconds` وينتظر بأمان عبر `asyncio.sleep` دون إيقاف باقي خيوط العمليات، ثم يعاود المحاولة تلقائياً.
- **Forward Delay:** مهلة افتراضية `2 ثوانٍ` بين كل عملية إرسال لمستلم والآخر لمنع الحظر.
- **Protected Content:** في حال تفعيل حماية المحتوى في مجموعة، لا يقوم النظام بالتحايل، بل يسجل حالة `PROTECTED_CONTENT` وينتقل فوراً للرسالة التالية.

---

## 📞 الدعم والمساعدة
النظام يعمل بكفاءة متكاملة ومستعد للنشر المباشر.
