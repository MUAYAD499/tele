import React, { useState } from "react";
import {
  ScrollText,
  Trash2,
  RotateCw,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Send
} from "lucide-react";
import { api } from "../api/client";
import { ForwardLog } from "../types";

interface LogsViewProps {
  logs: ForwardLog[];
  onRefresh: () => void;
}

export const LogsView: React.FC<LogsViewProps> = ({ logs, onRefresh }) => {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  const filteredLogs = logs.filter((log) => {
    const matchesStatus = statusFilter === "ALL" || log.status === statusFilter;
    const matchesSearch =
      searchTerm === "" ||
      log.group_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.sender_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.matched_keywords.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(log.message_id).includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

  const handleClearLogs = async () => {
    if (!window.confirm("هل أنت متأكد من مسح كافة السجلات الحالية؟")) return;
    setClearing(true);
    try {
      await api.clearLogs();
      onRefresh();
    } catch (err: any) {
      console.error(err);
    } finally {
      setClearing(false);
    }
  };

  const getStatusBadge = (status: ForwardLog["status"]) => {
    switch (status) {
      case "FORWARDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            FORWARDED
          </span>
        );
      case "QUEUED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock className="w-3 h-3" />
            QUEUED
          </span>
        );
      case "PROTECTED_CONTENT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldAlert className="w-3 h-3" />
            PROTECTED
          </span>
        );
      case "FLOOD_WAIT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <AlertTriangle className="w-3 h-3" />
            FLOOD_WAIT
          </span>
        );
      case "SKIPPED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-white/5 text-slate-400 border border-white/10">
            SKIPPED
          </span>
        );
      case "FAILED":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-3 h-3" />
            FAILED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-6 rounded-2xl bg-[#0a0c10] border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <ScrollText className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white">سجل العمليات المباشر (Forwarding Logs)</h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            سجل حي لكافة رسائل المجموعات التي طابقت الكلمات المفتاحية وعمليات التحويل إلى المستلمين مع رصد حالات الـ FloodWait وحماية المحتوى.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-white/5 text-slate-200 hover:text-white hover:bg-white/10 border border-white/10 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>تحديث السجل</span>
          </button>

          <button
            onClick={handleClearLogs}
            disabled={clearing || logs.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/30 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>مسح السجلات</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 p-4 rounded-2xl bg-[#0a0c10] border border-white/5 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث في السجلات (المجموعة، المرسل، الكلمة، المستلم، معرف الرسالة)..."
            className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="p-4 rounded-2xl bg-[#0a0c10] border border-white/5 flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="ALL" className="bg-[#0a0c10]">كافة الحالات (All Statuses)</option>
            <option value="FORWARDED" className="bg-[#0a0c10]">تم التحويل (FORWARDED)</option>
            <option value="QUEUED" className="bg-[#0a0c10]">في قائمة الانتظار (QUEUED)</option>
            <option value="PROTECTED_CONTENT" className="bg-[#0a0c10]">محتوى محمي (PROTECTED)</option>
            <option value="FLOOD_WAIT" className="bg-[#0a0c10]">قيود FloodWait</option>
            <option value="FAILED" className="bg-[#0a0c10]">فشل التحويل (FAILED)</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl bg-[#0a0c10] border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#050608] text-slate-400 font-semibold border-b border-white/5">
              <tr>
                <th className="py-3.5 px-4">الوقت</th>
                <th className="py-3.5 px-4">المجموعة المصدر</th>
                <th className="py-3.5 px-4">معرف الرسالة</th>
                <th className="py-3.5 px-4">كاتب الرسالة</th>
                <th className="py-3.5 px-4">الكلمات المكتشفة</th>
                <th className="py-3.5 px-4">المستلم</th>
                <th className="py-3.5 px-4">الحالة</th>
                <th className="py-3.5 px-4">التفاصيل / ملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {new Date(log.timestamp).toLocaleTimeString("ar-SA", { hour12: false })}
                    </td>
                    <td className="py-3.5 px-4 font-sans font-medium text-white max-w-[160px] truncate">
                      {log.group_title}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      #{log.message_id}
                    </td>
                    <td className="py-3.5 px-4 font-sans text-slate-300">
                      {log.sender_name}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {log.matched_keywords.split(",").map((kw, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px]"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-blue-300">
                      {log.recipient}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-sans text-[11px] max-w-[200px] truncate">
                      {log.error_message || "تمت المعالجة بنجاح عبر MTProto"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500 font-sans">
                    لا توجد سجلات تطابق عوامل التصفية الحالية.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
