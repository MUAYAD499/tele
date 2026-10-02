import React, { useState } from "react";
import {
  KeyRound,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Search,
  Filter,
  Check,
  AlertCircle
} from "lucide-react";
import { api } from "../api/client";
import { Keyword } from "../types";

interface KeywordsViewProps {
  keywords: Keyword[];
  onRefresh: () => void;
}

export const KeywordsView: React.FC<KeywordsViewProps> = ({ keywords, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [editingItem, setEditingItem] = useState<Keyword | null>(null);
  const [editTextInput, setEditTextInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const filteredKeywords = keywords.filter(
    (k) =>
      k.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.normalized_keyword.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeywordInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.createKeyword(newKeywordInput.trim());
      setNewKeywordInput("");
      setSuccessMsg("تمت إضافة الكلمة المفتاحية بنجاح");
      setTimeout(() => setSuccessMsg(null), 3000);
      onRefresh();
    } catch (err: any) {
      setError(err.message || "فشلت إضافة الكلمة");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (kw: Keyword) => {
    try {
      await api.updateKeyword(kw.id, { enabled: !kw.enabled });
      onRefresh();
    } catch (err: any) {
      setError(err.message || "فشل تغيير الحالة");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !editTextInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.updateKeyword(editingItem.id, { keyword: editTextInput.trim() });
      setEditingItem(null);
      setSuccessMsg("تم تعديل الكلمة بنجاح");
      setTimeout(() => setSuccessMsg(null), 3000);
      onRefresh();
    } catch (err: any) {
      setError(err.message || "فشل تعديل الكلمة");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, kwName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف الكلمة المفتاحية "${kwName}"؟`)) return;
    try {
      await api.deleteKeyword(id);
      onRefresh();
    } catch (err: any) {
      setError(err.message || "فشل الحذف");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-6 rounded-2xl bg-[#0a0c10] border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white">إدارة الكلمات المفتاحية (Keywords)</h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            الكلمات المفتاحية المستخدمة في فحص الرسائل الواردة من المجموعات. إذا احتوت الرسالة على <strong className="text-blue-400">أي كلمة واحدة فقط</strong> من الكلمات المفعلة، سيتم تحويلها فوراً.
          </p>
        </div>

        <div className="px-3.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-mono shrink-0">
          إجمالي الكلمات: {keywords.length} (مفعل: {keywords.filter((k) => k.enabled).length})
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

      {/* Add Keyword & Search Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <form
          onSubmit={handleAddKeyword}
          className="lg:col-span-2 p-4 rounded-2xl bg-[#0a0c10] border border-white/5 flex items-center gap-3"
        >
          <input
            id="new-keyword-input"
            type="text"
            value={newKeywordInput}
            onChange={(e) => setNewKeywordInput(e.target.value)}
            placeholder="أدخل كلمة مفتاحية جديدة (مثال: بحث، مشروع، مساعدة)..."
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#050608] border border-white/10 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
          <button
            id="add-keyword-btn"
            type="submit"
            disabled={loading || !newKeywordInput.trim()}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/30 transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة كلمة</span>
          </button>
        </form>

        <div className="p-4 rounded-2xl bg-[#0a0c10] border border-white/5 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث في الكلمات..."
            className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Keywords Table */}
      <div className="rounded-2xl bg-[#0a0c10] border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#050608] text-slate-400 font-semibold border-b border-white/5">
              <tr>
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">الكلمة المفتاحية (Keyword)</th>
                <th className="py-3.5 px-4">الصيغة المطبعة (Normalized)</th>
                <th className="py-3.5 px-4">الحالة (Status)</th>
                <th className="py-3.5 px-4">مرات الاكتشاف (Matched)</th>
                <th className="py-3.5 px-4">تاريخ الإضافة</th>
                <th className="py-3.5 px-4 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredKeywords.length > 0 ? (
                filteredKeywords.map((kw, idx) => (
                  <tr key={kw.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-white text-sm">
                      <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 font-mono text-xs text-white">
                        {kw.keyword}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-blue-300">
                      {kw.normalized_keyword}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleEnabled(kw)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                          kw.enabled
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-white/5 text-slate-400 border border-white/10"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            kw.enabled ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" : "bg-slate-500"
                          }`}
                        ></span>
                        {kw.enabled ? "مفعلة (Active)" : "معطلة (Disabled)"}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300 font-medium">
                      {kw.matched_count} مرة
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(kw.created_at).toLocaleDateString("ar-SA")}
                    </td>
                    <td className="py-3 px-4 text-left">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingItem(kw);
                            setEditTextInput(kw.keyword);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="تعديل الكلمة"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(kw.id, kw.keyword)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="حذف الكلمة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    لا توجد كلمات مفتاحية تطابق البحث.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#0a0c10] border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white">تعديل الكلمة المفتاحية</h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">الكلمة المفتاحية:</label>
              <input
                type="text"
                value={editTextInput}
                onChange={(e) => setEditTextInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#050608] border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500/50"
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
                disabled={loading || !editTextInput.trim()}
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
