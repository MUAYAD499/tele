import React, { useState } from "react";
import {
  MessageSquare,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Users,
  Search,
  LogIn,
  SlidersHorizontal,
  Layers,
  ArrowUpRight,
  Sparkles,
  ShieldCheck
} from "lucide-react";
import { api } from "../api/client";
import { MonitoredGroup, SystemStatus } from "../types";

interface GroupsViewProps {
  groups: MonitoredGroup[];
  monitorMode: "ALL" | "SELECTED";
  systemStatus?: SystemStatus | null;
  onRefresh: () => void;
  onOpenTelegramModal?: () => void;
}

export const GroupsView: React.FC<GroupsViewProps> = ({
  groups,
  monitorMode: initialMonitorMode,
  systemStatus,
  onRefresh,
  onOpenTelegramModal
}) => {
  const [monitorMode, setMonitorMode] = useState<"ALL" | "SELECTED">(initialMonitorMode);
  const [searchTerm, setSearchTerm] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const isConnected = systemStatus?.is_connected ?? false;

  const filteredGroups = (groups || []).filter((g) => {
    if (!g) return false;
    const title = (g.title || "").toLowerCase();
    const uname = (g.username || "").toLowerCase();
    const chatId = String(g.chat_id || "");
    const query = searchTerm.toLowerCase().trim();
    return title.includes(query) || uname.includes(query) || chatId.includes(query);
  });

  const totalMembers = (groups || []).reduce((acc, g) => acc + (g.members_count || 0), 0);
  const totalMessagesMonitored = (groups || []).reduce((acc, g) => acc + (g.messages_count || 0), 0);
  const totalMatched = (groups || []).reduce((acc, g) => acc + (g.matched_count || 0), 0);
  const totalForwarded = (groups || []).reduce((acc, g) => acc + (g.forwarded_count || 0), 0);

  const handleToggleGroup = async (group: MonitoredGroup) => {
    try {
      await api.updateGroup(group.id, { is_monitored: !group.is_monitored });
      onRefresh();
    } catch (err: any) {
      console.error("Error toggling group:", err);
      setNotification({
        type: "error",
        message: err?.message || "فشل تحديث حالة المجموعة",
      });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleSyncGroups = async () => {
    setSyncing(true);
    try {
      const res = await api.syncGroups();
      setNotification({
        type: "success",
        message: `تمت مزامنة ${res.count} مجموعة من حساب تيليجرام الحقيقي بنجاح.`,
      });
      setTimeout(() => setNotification(null), 4500);
      onRefresh();
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err?.message || "فشلت مزامنة المجموعات من تيليجرام. تأكد من اتصال الحساب.",
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setSyncing(false);
    }
  };

  const handleModeChange = async (mode: "ALL" | "SELECTED") => {
    setSavingMode(true);
    setMonitorMode(mode);
    try {
      await api.updateSettings({ monitor_mode: mode });
      setNotification({
        type: "success",
        message: `تم ضبط نمط المراقبة إلى: ${
          mode === "ALL" ? "جميع المجموعات (All Groups)" : "مجموعات محددة فقط (Selected Groups)"
        }`,
      });
      setTimeout(() => setNotification(null), 3500);
      onRefresh();
    } catch (err: any) {
      console.error("Error updating monitor mode:", err);
      setNotification({
        type: "error",
        message: "فشل حفظ نمط المراقبة",
      });
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setSavingMode(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-6 rounded-2xl bg-[#0a0c10] border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white">المجموعات المراقبة (Telegram Groups)</h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            يستمع النظام لرسائل <strong>جميع الأعضاء</strong> في المجموعات التي ينضم إليها حسابك دون اشتراط أن تكون مالكاً أو مشرفاً (Admin). يتجاهل النظام تلقائياً المحادثات الخاصة والقنوات والبوتات.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!isConnected && onOpenTelegramModal && (
            <button
              onClick={onOpenTelegramModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer shadow-lg shadow-emerald-900/30"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>ربط حساب Telegram</span>
            </button>
          )}

          <button
            id="sync-groups-btn"
            onClick={handleSyncGroups}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-lg shadow-blue-900/30 cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>مزامنة المجموعات من تيليجرام</span>
          </button>
        </div>
      </div>

      {/* Disconnection Warning Banner if Telegram not connected */}
      {!isConnected && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              حساب Telegram غير متصل حالياً. يجب تسجيل الدخول بالحساب لجلب كافة المجموعات التي ينضم إليها وبدء الاستماع لرسائل الأعضاء.
            </span>
          </div>
          {onOpenTelegramModal && (
            <button
              onClick={onOpenTelegramModal}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/30 cursor-pointer shrink-0 transition-colors"
            >
              تسجيل الدخول الآن
            </button>
          )}
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 transition-all ${
            notification.type === "success"
              ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
              : "bg-red-500/10 border-red-500/20 text-red-300"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-[#0a0c10] border border-white/5">
          <span className="text-[11px] text-slate-400 block mb-1">إجمالي المجموعات</span>
          <div className="text-xl font-bold text-white font-mono">{groups.length}</div>
          <span className="text-[10px] text-slate-500 mt-1 block">مجموعة في الحساب</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0a0c10] border border-white/5">
          <span className="text-[11px] text-slate-400 block mb-1">نمط المراقبة</span>
          <div className="text-sm font-bold text-blue-400 font-mono mt-1">
            {monitorMode === "ALL" ? "كافة المجموعات (All)" : "محددة (Selected)"}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">
            {monitorMode === "ALL" ? "مراقبة تلقائية شاملة" : `${groups.filter((g) => g.is_monitored).length} مفعلة`}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#0a0c10] border border-white/5">
          <span className="text-[11px] text-slate-400 block mb-1">رسائل تم فحصها</span>
          <div className="text-xl font-bold text-white font-mono">{totalMessagesMonitored}</div>
          <span className="text-[10px] text-slate-500 mt-1 block">من جميع الأعضاء</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0a0c10] border border-white/5">
          <span className="text-[11px] text-slate-400 block mb-1">رسائل طابقت وحولت</span>
          <div className="text-xl font-bold text-emerald-400 font-mono">{totalMatched}</div>
          <span className="text-[10px] text-slate-500 mt-1 block">
            {totalForwarded} تحويلة ناجحة
          </span>
        </div>
      </div>

      {/* Mode Switcher Banner */}
      <div className="p-5 rounded-2xl bg-[#0a0c10] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <SlidersHorizontal className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-white">نمط مراقبة المجموعات:</span>
          </div>
          <p className="text-[11px] text-slate-400">
            عند اختيار <strong>كافة المجموعات (ALL)</strong>، يستمع البوت تلقائياً لكافة المجموعات التي ينضم إليها الحساب بدون الحاجة لتفعيلها يدويًا.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#050608] p-1.5 rounded-xl border border-white/10 shrink-0">
          <button
            onClick={() => handleModeChange("ALL")}
            disabled={savingMode}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              monitorMode === "ALL"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            كافة المجموعات (All Groups)
          </button>
          <button
            onClick={() => handleModeChange("SELECTED")}
            disabled={savingMode}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              monitorMode === "SELECTED"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            مجموعات محددة فقط (Selected)
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 rounded-2xl bg-[#0a0c10] border border-white/5 flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="بحث في المجموعات حسب اسم المجموعة، المعرف (@username)، أو Chat ID..."
          className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-white/5 cursor-pointer"
          >
            مسح
          </button>
        )}
      </div>

      {/* Groups Table or Empty State */}
      <div className="rounded-2xl bg-[#0a0c10] border border-white/5 overflow-hidden">
        {filteredGroups.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">
                {groups.length === 0 ? "لا توجد مجموعات محفوظة حالياً" : "لا توجد نتائج مطابقة للبحث"}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {groups.length === 0
                  ? isConnected
                    ? "اضغط على زر 'مزامنة المجموعات من تيليجرام' لجلب المجموعات التي يشترك فيها حسابك تلقائياً."
                    : "يرجى تسجيل الدخول بحساب Telegram أولاً ليتمكن النظام من جلب ومراقبة مجموعاتك الحقيقية."
                  : `لم يتم العثور على مجموعة تحتوي على "${searchTerm}". جرب البحث باسم آخر.`}
              </p>
            </div>
            {groups.length === 0 && (
              <div className="pt-2 flex items-center justify-center gap-3">
                {isConnected ? (
                  <button
                    onClick={handleSyncGroups}
                    disabled={syncing}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer transition-colors shadow-lg shadow-blue-900/30 disabled:opacity-50"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                    <span>مزامنة المجموعات الآن</span>
                  </button>
                ) : (
                  onOpenTelegramModal && (
                    <button
                      onClick={onOpenTelegramModal}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer transition-colors shadow-lg shadow-emerald-900/30"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>ربط حساب Telegram</span>
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#050608] text-slate-400 font-semibold border-b border-white/5">
                <tr>
                  <th className="py-3.5 px-4">#</th>
                  <th className="py-3.5 px-4">اسم المجموعة (Group Title)</th>
                  <th className="py-3.5 px-4">معرف المحادثة (Chat ID)</th>
                  <th className="py-3.5 px-4">عدد الأعضاء</th>
                  <th className="py-3.5 px-4">حالة المراقبة</th>
                  <th className="py-3.5 px-4">رسائل مفحوصة</th>
                  <th className="py-3.5 px-4">مطابقة</th>
                  <th className="py-3.5 px-4">محولة</th>
                  <th className="py-3.5 px-4">آخر نشاط</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredGroups.map((group, idx) => {
                  const membersCountFormatted =
                    typeof group.members_count === "number" && group.members_count > 0
                      ? `${group.members_count.toLocaleString("ar-EG")} عضو`
                      : "—";

                  let lastActivityStr = "لا يوجد نشاط بعد";
                  if (group.last_activity) {
                    lastActivityStr = group.last_activity;
                  } else if (group.last_activity_at) {
                    try {
                      lastActivityStr = new Date(group.last_activity_at).toLocaleTimeString("ar-EG", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      });
                    } catch (_) {}
                  }

                  return (
                    <tr key={group.id || idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-bold text-white text-sm">
                        <div className="flex items-center gap-2">
                          <span>{group.title || "مجموعة بدون اسم"}</span>
                          {group.username && (
                            <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                              {group.username}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px] dir-ltr text-right">
                        {group.chat_id}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {membersCountFormatted}
                      </td>
                      <td className="py-3.5 px-4">
                        {monitorMode === "ALL" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]"></span>
                            مراقبة تلقائية (All Active)
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleGroup(group)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                              group.is_monitored
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-white/5 text-slate-400 border border-white/10"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                group.is_monitored
                                  ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]"
                                  : "bg-slate-500"
                              }`}
                            ></span>
                            {group.is_monitored ? "مراقبة (ON)" : "معطلة (OFF)"}
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {group.messages_count ?? 0}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-orange-400 font-semibold">
                        {group.matched_count ?? 0}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-blue-400 font-semibold">
                        {group.forwarded_count ?? 0}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {lastActivityStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
