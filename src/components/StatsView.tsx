import React from "react";
import {
  BarChart3,
  TrendingUp,
  KeyRound,
  Users,
  MessageSquare,
  Send,
  PieChart,
  CheckCircle2
} from "lucide-react";
import { SystemStats } from "../types";

interface StatsViewProps {
  stats: SystemStats | null;
}

export const StatsView: React.FC<StatsViewProps> = ({ stats }) => {
  const topKeywords = stats?.top_keywords || [];
  const topGroups = stats?.top_groups || [];
  const topRecipients = stats?.top_recipients || [];

  const maxKw = Math.max(...topKeywords.map((k) => k.count), 1);
  const maxGroup = Math.max(...topGroups.map((g) => g.matched), 1);
  const maxRec = Math.max(...topRecipients.map((r) => r.count), 1);

  const successRate =
    stats && stats.total_forwards_successful + stats.total_forwards_failed > 0
      ? Math.round(
          (stats.total_forwards_successful /
            (stats.total_forwards_successful + stats.total_forwards_failed)) *
            100
        )
      : 100;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-6 rounded-2xl bg-[#0a0c10] border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white">الإحصائيات والتحليلات البيانية</h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            تحليل معدلات الاكتشاف، وتوزيع الكلمات الأكثر تكراراً في رسائل المجموعات، ونسب نجاح عمليات إعادة التوجيه إلى المستهدفين.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono">
            نسبة النجاح: {successRate}%
          </span>
        </div>
      </div>

      {/* Top 3 Analytical Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Keywords */}
        <div className="p-6 rounded-2xl bg-[#0a0c10] border border-white/5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <KeyRound className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white">الكلمات الأكثر اكتشافاً</h3>
          </div>

          <div className="space-y-3.5">
            {topKeywords.map((kw, i) => {
              const pct = Math.round((kw.count / maxKw) * 100);
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-200">{kw.name}</span>
                    <span className="font-mono text-blue-400 font-bold">{kw.count} مرة</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#050608] border border-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Groups */}
        <div className="p-6 rounded-2xl bg-[#0a0c10] border border-white/5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white">المجموعات الأكثر نشاطاً</h3>
          </div>

          <div className="space-y-3.5">
            {topGroups.map((g, i) => {
              const pct = Math.round((g.matched / maxGroup) * 100);
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-200 truncate max-w-[170px]">{g.name}</span>
                    <span className="font-mono text-purple-400 font-bold">{g.matched} مطابقة</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#050608] border border-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 to-pink-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Recipients */}
        <div className="p-6 rounded-2xl bg-[#0a0c10] border border-white/5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Users className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white">توزيع التحويل للمستلمين</h3>
          </div>

          <div className="space-y-3.5">
            {topRecipients.map((r, i) => {
              const pct = Math.round((r.count / maxRec) * 100);
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono font-bold text-blue-300">{r.name}</span>
                    <span className="font-mono text-emerald-400 font-bold">{r.count} رسالة</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#050608] border border-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
