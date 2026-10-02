import React, { useState } from "react";
import {
  Settings,
  Radio,
  Shield,
  Clock,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  Lock,
  Bot
} from "lucide-react";
import { api } from "../api/client";
import { SystemSettings } from "../types";

interface SettingsViewProps {
  settings: SystemSettings | null;
  onRefresh: () => void;
  onOpenTelegramModal: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onRefresh,
  onOpenTelegramModal
}) => {
  const [forwardDelay, setForwardDelay] = useState<number>(settings?.forwarding.forward_delay ?? 2.0);
  const [retryAttempts, setRetryAttempts] = useState<number>(settings?.forwarding.retry_attempts ?? 3);
  const [timezone, setTimezone] = useState<string>(settings?.system.timezone ?? "Asia/Aden");
  const [logLevel, setLogLevel] = useState<string>(settings?.system.log_level ?? "INFO");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      await api.updateSettings({
        forward_delay: Number(forwardDelay),
        retry_attempts: Number(retryAttempts),
        timezone,
        log_level: logLevel
      });
      setSuccessMsg("تم حفظ وتطبيق الإعدادات بنجاح");
      setTimeout(() => setSuccessMsg(null), 3000);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || "فشل حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-6 rounded-2xl bg-[#0a0c10] border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Settings className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white">إعدادات النظام و Telegram Userbot</h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            التحكم في معايير تشغيل Userbot، مهل إعادة التوجيه لمنع قيود FloodWait، وتفاصيل أمان الجلسة والاتصال.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Telegram Credentials & Session Card */}
        <div className="p-6 rounded-2xl bg-[#0a0c10] border border-white/5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-white">جلسة وحساب Telegram Userbot (MTProto)</h3>
            </div>
            <button
              type="button"
              onClick={onOpenTelegramModal}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"
            >
              إدارة الجلسة / ربط حساب
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[#050608] border border-white/10">
              <span className="text-slate-500 block mb-1">Telegram API ID:</span>
              <span className="font-mono font-bold text-white">25002565</span>
            </div>

            <div className="p-4 rounded-xl bg-[#050608] border border-white/10">
              <span className="text-slate-500 block mb-1">API HASH:</span>
              <span className="font-mono font-bold text-slate-400">•••••••••••••••• (محمي)</span>
            </div>

            <div className="p-4 rounded-xl bg-[#050608] border border-white/10">
              <span className="text-slate-500 block mb-1">حالة الجلسة الدائمة:</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                محفوظة في Docker Volume
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#050608] border border-white/10">
              <span className="text-slate-500 block mb-1">اسم الجلسة:</span>
              <span className="font-mono text-blue-300">telegram_userbot.session</span>
            </div>
          </div>
        </div>

        {/* Engine Filtering & Rule Settings */}
        <div className="p-6 rounded-2xl bg-[#0a0c10] border border-white/5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white">قواعد الفلترة واكتشاف الرسائل</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[#050608] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">قاعدة المطابقة (Matching Rule):</span>
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono">
                  Threshold = 1
                </span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                يكفي وجود <strong className="text-blue-400">كلمة مفتاحية واحدة فقط</strong> في الرسالة لتعتبر مطابقة ويتم تحويلها فوراً لكافة المستلمين النشطين.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#050608] border border-white/10 space-y-2">
              <span className="font-bold text-white block">نطاق المحادثات المسموح:</span>
              <p className="text-emerald-400 text-[11px] font-semibold">
                ✓ المجموعات العامة والخاصة المشترك فيها الحساب (Groups Only)
              </p>
              <p className="text-slate-500 text-[10px]">
                ✕ يتم تجاهل المحادثات الخاصة (Private Chats)، القنوات، والبوتات تلقائياً لحماية الخصوصية.
              </p>
            </div>
          </div>
        </div>

        {/* Forwarding Engine & Delay Parameters */}
        <div className="p-6 rounded-2xl bg-[#0a0c10] border border-white/5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Clock className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white">معايير طابور الإرسال (Queue & Delay)</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                المهلة بين عمليات التحويل (FORWARD_DELAY بالثواني):
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="10"
                value={forwardDelay}
                onChange={(e) => setForwardDelay(parseFloat(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#050608] border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-blue-500/50"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                تمنع قيود Telegram FloodWait عند التحويل لعدة مستلمين متتاليين.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                عدد محاولات الإرسال عند الفشل (Retry Attempts):
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={retryAttempts}
                onChange={(e) => setRetryAttempts(parseInt(e.target.value, 10))}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#050608] border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-blue-500/50"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                إعادة المحاولة مع Exponential Backoff.
              </span>
            </div>
          </div>
        </div>

        {/* System & Timezone */}
        <div className="p-6 rounded-2xl bg-[#0a0c10] border border-white/5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Lock className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white">إعدادات الخادم والمنطقة الزمنية</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                المنطقة الزمنية (Timezone):
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#050608] border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500/50"
              >
                <option value="Asia/Aden">Asia/Aden (توقيت مكة واليمن +03:00)</option>
                <option value="Asia/Riyadh">Asia/Riyadh (الرياض +03:00)</option>
                <option value="Asia/Dubai">Asia/Dubai (دبي +04:00)</option>
                <option value="Africa/Cairo">Africa/Cairo (القاهرة +02:00)</option>
                <option value="UTC">UTC (توقيت غرينتش)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                مستوى السجلات (Log Level):
              </label>
              <select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#050608] border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500/50 font-mono"
              >
                <option value="INFO">INFO (موصى به للإنتاج)</option>
                <option value="DEBUG">DEBUG (تشخيص تفصيلي)</option>
                <option value="WARNING">WARNING (التحذيرات فقط)</option>
                <option value="ERROR">ERROR (الأخطاء فقط)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-lg shadow-emerald-950/30 cursor-pointer disabled:opacity-50 font-bold"
          >
            <Save className="w-4 h-4" />
            <span>حفظ وتطبيق التغييرات</span>
          </button>
        </div>
      </form>
    </div>
  );
};
