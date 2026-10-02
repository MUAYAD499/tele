import React from "react";
import {
  Activity,
  Radio,
  Users,
  KeyRound,
  MessageSquare,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Play,
  Square,
  RotateCw,
  TrendingUp,
  Inbox,
  ShieldCheck,
  Zap
} from "lucide-react";
import { SystemStatus, SystemStats, Keyword } from "../types";

interface DashboardOverviewProps {
  status: SystemStatus | null;
  stats: SystemStats | null;
  keywords?: Keyword[];
  onNavigateTab: (tab: any) => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  actionLoading: boolean;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  status,
  stats,
  keywords = [],
  onNavigateTab,
  onStart,
  onStop,
  onRestart,
  actionLoading
}) => {
  const isRunning = status?.status === "RUNNING";

  return (
    <div className="space-y-6">
      {/* Top Banner: Matching Rule Highlight */}
      <div className="bg-[#0a0c10] border border-blue-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg shadow-blue-950/20">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] shrink-0">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">
                قاعدة المطابقة: يكفي وجود كلمة مفتاحية واحدة فقط
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono font-bold uppercase">
                Threshold = 1
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              إذا احتوت الرسالة في أي مجموعة مراقبة على <strong className="text-blue-400">أي كلمة واحدة على الأقل</strong> من قائمة الكلمات المفتاحية، يتم فوراً إدراجها في الـ Forward Queue وتحويلها لكافة المستلمين المفعلين.
            </p>
          </div>
        </div>

        <button
          id="btn-open-live-tester"
          onClick={() => onNavigateTab("tester")}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium text-xs shadow-lg shadow-blue-900/30 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <span>اختبار رسالة بالمختبر</span>
          <ArrowRight className="w-4 h-4 rotate-180" />
        </button>
      </div>

      {/* Main 4 Metric Cards (Immersive UI Archetype) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Monitored Messages */}
        <div
          onClick={() => onNavigateTab("groups")}
          className="bg-white/5 border border-white/10 rounded-2xl p-5 cursor-pointer hover:bg-white/[0.07] transition-all"
        >
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">
            Monitored (المراقبة)
          </p>
          <h3 className="text-3xl font-bold text-white mt-1 font-mono">
            {stats?.total_messages_monitored ?? 0}
          </h3>
          <p className="text-[10px] text-slate-500 mt-2 italic">
            إجمالي الرسائل الواردة من المجموعات
          </p>
        </div>

        {/* Matched Messages */}
        <div
          onClick={() => onNavigateTab("keywords")}
          className="bg-white/5 border border-white/10 rounded-2xl p-5 border-l-orange-500/50 border-l-4 cursor-pointer hover:bg-white/[0.07] transition-all"
        >
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">
            Matched (المطابقة)
          </p>
          <h3 className="text-3xl font-bold text-white mt-1 font-mono">
            {stats?.total_messages_matched ?? 0}
          </h3>
          <p className="text-[10px] text-orange-400 mt-2 font-medium">
            طابقت كلمة واحدة على الأقل
          </p>
        </div>

        {/* Forwarded Messages */}
        <div
          onClick={() => onNavigateTab("logs")}
          className="bg-white/5 border border-white/10 rounded-2xl p-5 border-l-blue-500/50 border-l-4 cursor-pointer hover:bg-white/[0.07] transition-all"
        >
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">
            Forwarded (المحولة)
          </p>
          <h3 className="text-3xl font-bold text-white mt-1 font-mono">
            {stats?.total_forwards_successful ?? 0}
          </h3>
          <p className="text-[10px] text-blue-400 mt-2 font-medium">
            تم التوجيه لـ {stats?.active_recipients_count ?? 0} مستلمين نشطين
          </p>
        </div>

        {/* Failures / Protected */}
        <div
          onClick={() => onNavigateTab("logs")}
          className="bg-white/5 border border-white/10 rounded-2xl p-5 border-l-red-500/50 border-l-4 cursor-pointer hover:bg-white/[0.07] transition-all"
        >
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">
            Failures (الأخطاء / المحمية)
          </p>
          <h3 className="text-3xl font-bold text-white mt-1 font-mono">
            {stats?.total_forwards_failed ?? 0}
          </h3>
          <p className="text-[10px] text-red-400 mt-2 font-medium italic">
            FloodWait: 0s • محتوى محمي
          </p>
        </div>
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigateTab("keywords")}
          className="bg-[#0a0c10] border border-white/5 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-white/10 transition-all"
        >
          <div>
            <span className="text-xs text-slate-400 block mb-1">الكلمات المفتاحية النشطة</span>
            <div className="text-xl font-bold text-white font-mono">
              {stats?.active_keywords_count ?? 0} كلمات
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <KeyRound className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => onNavigateTab("recipients")}
          className="bg-[#0a0c10] border border-white/5 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-white/10 transition-all"
        >
          <div>
            <span className="text-xs text-slate-400 block mb-1">المستلمون المفعلون</span>
            <div className="text-xl font-bold text-white font-mono">
              {stats?.active_recipients_count ?? 0} حسابات
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => onNavigateTab("groups")}
          className="bg-[#0a0c10] border border-white/5 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-white/10 transition-all"
        >
          <div>
            <span className="text-xs text-slate-400 block mb-1">المجموعات المراقبة</span>
            <div className="text-xl font-bold text-white font-mono">
              {status?.monitor_mode === "ALL" ? "كافة المجموعات (All)" : `${stats?.monitored_groups_count ?? 0} مجموعة`}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Two Columns: Real-time Activity Flow & Configuration Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Activity Flow */}
        <div className="lg:col-span-2 bg-[#0a0c10] border border-white/5 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <h4 className="text-sm font-semibold text-white">Real-time Activity Flow (التدفق المباشر)</h4>
            </div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
              Buffer size: 100
            </span>
          </div>

          <div className="flex-1 p-4 space-y-3 text-[13px] overflow-y-auto max-h-[380px]">
            {stats?.recent_activity && stats.recent_activity.length > 0 ? (
              stats.recent_activity.map((act, index) => {
                const isMatched = act.status === "MATCHED" || act.matched;
                const isForwarded = act.status === "FORWARDED" || act.status === "SENT";
                const isQueued = act.status === "QUEUED";

                return (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors"
                  >
                    <span className="text-slate-500 font-mono text-xs shrink-0 mt-0.5">
                      {act.timestamp}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isForwarded ? (
                          <span className="text-emerald-400 font-medium text-xs font-mono">
                            [SENT]
                          </span>
                        ) : isQueued ? (
                          <span className="text-blue-400 font-medium text-xs font-mono">
                            [QUEUED]
                          </span>
                        ) : isMatched ? (
                          <span className="text-orange-400 font-medium text-xs font-mono">
                            [MATCHED]
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium text-xs font-mono">
                            [CLEAN]
                          </span>
                        )}

                        <span className="text-slate-300 text-xs font-medium truncate">
                          {act.group || "مجموعة تيليجرام"}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 mt-1">
                        {act.matched && (
                          <span>الكلمة: <strong className="text-orange-300">{act.matched}</strong></span>
                        )}
                        {act.recipient && (
                          <span className="ml-2">➔ <strong className="text-blue-300 font-mono">{act.recipient}</strong></span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        isForwarded
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : isQueued
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                      }`}
                    >
                      {act.status}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-xs text-slate-500">
                لا توجد عمليات بعد. المحرك في وضع الاستماع لمجموعات تيليجرام...
              </div>
            )}
          </div>
        </div>

        {/* Configuration Summary Box */}
        <div className="bg-[#0a0c10] border border-white/5 rounded-2xl flex flex-col p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <h4 className="text-sm font-semibold text-white">Configuration Summary</h4>
            <span className="text-[10px] text-emerald-400 uppercase font-mono tracking-wider">
              {isRunning ? "ACTIVE" : "STANDBY"}
            </span>
          </div>

          <div className="space-y-5">
            {/* Keywords pill list */}
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-400 uppercase tracking-wider text-[11px]">
                  Active Keywords
                </span>
                <span className="text-blue-400 font-mono text-xs">
                  {keywords.filter(k => k.enabled).length} Active
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {keywords.filter(k => k.enabled).length > 0 ? (
                  keywords.filter(k => k.enabled).map((kw) => (
                    <span
                      key={kw.id}
                      className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 font-medium font-mono"
                    >
                      {kw.keyword}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic">لا توجد كلمات مفعلة</span>
                )}
              </div>
            </div>

            <div className="h-px bg-white/5"></div>

            {/* Forward Policy Table */}
            <div>
              <div className="flex justify-between text-xs mb-2.5">
                <span className="text-slate-400 uppercase tracking-wider text-[11px]">
                  Forward Policy
                </span>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex justify-between py-1 border-b border-white/[0.03]">
                  <span className="text-slate-400">Min Keywords:</span>
                  <span className="text-white font-mono font-bold">1 (ANY)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.03]">
                  <span className="text-slate-400">Delay per Send:</span>
                  <span className="text-white font-mono font-bold">2.0s</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.03]">
                  <span className="text-slate-400">Arabic Normalizer:</span>
                  <span className="text-emerald-400 font-mono font-bold">ENABLED</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.03]">
                  <span className="text-slate-400">Monitoring Scope:</span>
                  <span className="text-white font-mono uppercase font-bold">All Groups</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Deduplication:</span>
                  <span className="text-emerald-400 font-mono font-bold">ACTIVE</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="pt-2 flex flex-col gap-2">
              {isRunning ? (
                <button
                  onClick={onStop}
                  disabled={actionLoading}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-4 py-2.5 rounded-lg font-medium text-xs transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>إيقاف المحرك (Stop Engine)</span>
                </button>
              ) : (
                <button
                  onClick={onStart}
                  disabled={actionLoading}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2.5 rounded-lg font-bold text-xs shadow-lg shadow-emerald-900/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>تشغيل المحرك (Start Engine)</span>
                </button>
              )}

              <button
                onClick={onRestart}
                disabled={actionLoading}
                className="w-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 px-4 py-2 rounded-lg font-medium text-xs transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RotateCw className={`w-3.5 h-3.5 ${actionLoading ? "animate-spin" : ""}`} />
                <span>إعادة تشغيل الـ Worker</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
