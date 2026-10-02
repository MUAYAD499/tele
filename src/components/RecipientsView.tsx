import React, { useState } from "react";
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Send,
  Search,
  AlertCircle,
  Clock,
  Radio
} from "lucide-react";
import { api } from "../api/client";
import { Recipient } from "../types";

interface RecipientsViewProps {
  recipients: Recipient[];
  onRefresh: () => void;
}

export const RecipientsView: React.FC<RecipientsViewProps> = ({ recipients, onRefresh }) => {
  const [newUsername, setNewUsername] = useState("");
  const [editingItem, setEditingItem] = useState<Recipient | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.createRecipient(newUsername.trim());
      setNewUsername("");
      setSuccessMsg("تمت إضافة المستلم بنجاح");
      setTimeout(() => setSuccessMsg(null), 3000);
      onRefresh();
    } catch (err: any) {
      setError(err.message || "فشلت إضافة المستلم");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (rec: Recipient) => {
    try {
      await api.updateRecipient(rec.id, { enabled: !rec.enabled });
      onRefresh();
    } catch (err: any) {
      setError(err.message || "فشل تغيير الحالة");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !editUsername.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.updateRecipient(editingItem.id, { username: editUsername.trim() });
      setEditingItem(null);
      setSuccessMsg("تم تعديل اسم المستخدم بنجاح");
      setTimeout(() => setSuccessMsg(null), 3000);
      onRefresh();
    } catch (err: any) {
      setError(err.message || "فشل تعديل المستلم");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف المستلم ${username}؟`)) return;
    try {
      await api.deleteRecipient(id);
      onRefresh();
    } catch (err: any) {
      setError(err.message || "فشل الحذف");
    }
  };

  const handleTestPing = async (rec: Recipient) => {
    setTestingId(rec.id);
    setError(null);
    try {
      const res = await api.testRecipient(rec.id);
      if (res.success) {
        setSuccessMsg(res.message || `تم إرسال إشعار اختبار إلى ${rec.username}`);
      } else {
        setError(res.error || res.message || "تعذر إرسال الاختبار");
      }
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || "خطأ أثناء الاختبار");
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-6 rounded-2xl bg-[#0a0c10] border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white">إدارة المستلمين المستهدفين (Target Recipients)</h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            قائمة حسابات تيليجرام التي يتم تحويل الرسائل المطابقة إليها تلقائياً. كل اسم مستخدم يعتبر عنصراً مستقلاً مع منع التكرار.
          </p>
        </div>

        <div className="px-3.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-mono shrink-0">
          المستلمون: {recipients.length} (مفعل: {recipients.filter((r) => r.enabled).length})
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Add Recipient Form */}
      <form
        onSubmit={handleAddRecipient}
        className="p-4 rounded-2xl bg-[#0a0c10] border border-white/5 flex flex-col sm:flex-row items-center gap-3"
      >
        <div className="relative flex-1 w-full">
          <input
            id="new-recipient-input"
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="أدخل Username المستلم (مثال: @username أو username)..."
            className="w-full px-4 py-2.5 rounded-lg bg-[#050608] border border-white/10 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 font-mono"
          />
        </div>
        <button
          id="add-recipient-btn"
          type="submit"
          disabled={loading || !newUsername.trim()}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/30 transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مستلم جديد</span>
        </button>
      </form>

      {/* Recipients Table */}
      <div className="rounded-2xl bg-[#0a0c10] border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#050608] text-slate-400 font-semibold border-b border-white/5">
              <tr>
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">اسم المستخدم (Telegram Username)</th>
                <th className="py-3.5 px-4">الحالة (Status)</th>
                <th className="py-3.5 px-4">الرسائل المحولة إليه</th>
                <th className="py-3.5 px-4">آخر عملية تحويل</th>
                <th className="py-3.5 px-4 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recipients.map((rec, idx) => (
                <tr key={rec.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-500">{idx + 1}</td>
                  <td className="py-3.5 px-4 font-bold text-blue-300 font-mono text-sm">
                    {rec.username}
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      onClick={() => handleToggleEnabled(rec)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                        rec.enabled
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-white/5 text-slate-400 border border-white/10"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          rec.enabled ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" : "bg-slate-500"
                        }`}
                      ></span>
                      {rec.enabled ? "مفعل (Active)" : "معطل (Disabled)"}
                    </button>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-white font-semibold">
                    {rec.forwarded_count} رسالة
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                    {rec.last_forward_at ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {new Date(rec.last_forward_at).toLocaleString("ar-SA")}
                      </span>
                    ) : (
                      "لم يتم بعد"
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-left">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleTestPing(rec)}
                        disabled={testingId === rec.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/10 transition-colors"
                        title="إرسال إشعار اختبار"
                      >
                        <Send className={`w-3 h-3 ${testingId === rec.id ? "animate-spin" : ""}`} />
                        <span>اختبار</span>
                      </button>

                      <button
                        onClick={() => {
                          setEditingItem(rec);
                          setEditUsername(rec.username);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        title="تعديل اسم المستخدم"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(rec.id, rec.username)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="حذف المستلم"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#0a0c10] border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white">تعديل اسم المستخدم للمستلم</h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">اسم المستخدم (Username):</label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#050608] border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/10"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={loading || !editUsername.trim()}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/30 disabled:opacity-50"
              >
                حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
