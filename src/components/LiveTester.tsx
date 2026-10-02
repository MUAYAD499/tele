import React, { useState } from "react";
import {
  Sparkles,
  Play,
  CheckCircle2,
  XCircle,
  Layers,
  ArrowRight,
  Send,
  RefreshCw,
  Info,
  ShieldCheck,
  Zap
} from "lucide-react";
import { api } from "../api/client";
import { MessageTestResult } from "../types";

interface LiveTesterProps {
  onRefreshData: () => void;
}

export const LiveTester: React.FC<LiveTesterProps> = ({ onRefreshData }) => {
  const [inputText, setInputText] = useState("عندي واجب وما فهمت المطلوب.");
  const [selectedGroup, setSelectedGroup] = useState("ملتقى مشاريع التخرج وتقنية المعلومات");
  const [senderName, setSenderName] = useState("أحمد العتيبي");
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<MessageTestResult | null>(null);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const presets = [
    {
      title: "Test 1: رسالة من عضو آخر تحتوي على كلمة (واجب)",
      text: "عندي واجب وما فهمت المطلوب.",
      group: "ملتقى مشاريع التخرج وتقنية المعلومات",
      sender: "أحمد العتيبي (عضو في المجموعة)",
      expected: "MATCH = TRUE → FORWARD"
    },
    {
      title: "Test 2: رسالة من عضو آخر بدون كلمات مفتاحية",
      text: "السلام عليكم جميعاً، كيف حالكم؟",
      group: "مجموعة الطلاب العامة",
      sender: "خالد السالم (عضو في المجموعة)",
      expected: "MATCH = FALSE → IGNORED"
    },
    {
      title: "Test 3: مجموعة أنا مجرد عضو فيها (ليست ملكي وليست أدمين)",
      text: "مين يقدر يساعدني في حل هذا التكليف؟",
      group: "مجتمع المطورين والجامعيين (عضو عادي)",
      sender: "سارة محمد (عضو)",
      expected: "MATCH = TRUE (تكليف) → FORWARD"
    },
    {
      title: "Test 4: رسالة من حسابي الشخصي تحتوي على كلمة",
      text: "أنا أبحث عن شخص فاهم في البرمجة",
      group: "قروب مشاريع وهندسة",
      sender: "حسابي (Self / Outgoing)",
      expected: "MATCH = TRUE (فاهم + برمجة) → FORWARD"
    },
    {
      title: "Test 5: كلمات متعددة (يعرف + يسوي + مشروع)",
      text: "من يعرف كيف يسوي المشروع؟",
      group: "هندسة البرمجيات وتقنية المعلومات",
      sender: "فهد الدوسري",
      expected: "MATCH = TRUE (3 كلمات) → FORWARD"
    },
    {
      title: "Test 6: نص مع تشكيل وتطويل وهمزات متنوعة",
      text: "هَلْ يُوجَدُ شَخْصٌ يَـشْـرَحُ لِي هَذَا التكليـــف؟",
      group: "ملتقى الاستفسارات الأكاديمية",
      sender: "عضو في المجموعة",
      expected: "MATCH = TRUE (يشرح + تكليف)"
    },
    {
      title: "Test 7: كابشن صورة / ملف مرفق يحتوي على كلمة",
      text: "[صورة مرفقة] ملف مشروع التخرج والتقرير النهائي",
      group: "مجموعة تبادل الملفات والبحوث",
      sender: "عبدالرحمن",
      expected: "MATCH = TRUE (مشروع + تقرير)"
    }
  ];

  const handleTestOnly = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setError(null);
    setSimulationResult(null);
    try {
      const res = await api.testMessage(inputText);
      setTestResult(res);
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء فحص الرسالة");
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateFullPipeline = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // First run test analysis
      const testRes = await api.testMessage(inputText);
      setTestResult(testRes);

      // Next simulate the full incoming group event
      const simRes = await api.simulateIncoming({
        text: inputText,
        group_title: selectedGroup,
        sender_name: senderName,
        message_id: Math.floor(1000 + Math.random() * 9000)
      });
      setSimulationResult(simRes);
      onRefreshData();
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء محاكاة الإرسال");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-6 rounded-2xl bg-[#0a0c10] border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white">
              مختبر الفحص المباشر ومحاكاة رسائل المجموعات
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            اختبر محرك التطبيع العربي (Arabic Normalizer) وخوارزمية اكتشاف الكلمات (Keyword Matcher) في الوقت الفعلي. يمكنك أيضاً محاكاة وصول رسالة مجموعة لمعاينة مسار الـ Forwarding للمستلمين.
          </p>
        </div>

        <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-mono shrink-0">
          قاعدة النظام: أي كلمة واحدة = تحويل
        </div>
      </div>

      {/* Preset Quick Tests */}
      <div>
        <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider text-[11px]">
          أمثلة اختبار سريعة من المواصفات / PRESETS:
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputText(p.text);
                if (p.group) setSelectedGroup(p.group);
                if (p.sender) setSenderName(p.sender);
                setTestResult(null);
                setSimulationResult(null);
              }}
              className="p-3.5 rounded-xl bg-[#0a0c10] hover:bg-white/[0.04] border border-white/5 hover:border-white/15 text-right transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-200 group-hover:text-blue-400 transition-colors">
                  {p.title}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                  {p.expected}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono truncate">{p.text}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Message Input & Parameters */}
      <div className="p-6 rounded-2xl bg-[#0a0c10] border border-white/5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            نص الرسالة الواردة (Telegram Message / Caption):
          </label>
          <textarea
            id="tester-message-input"
            rows={3}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="اكتب أو الصق نص رسالة تيليجرام هنا للاختبار..."
            className="w-full px-4 py-3 rounded-xl bg-[#050608] border border-white/10 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 text-sm leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              المجموعة المصدر (Telegram Group):
            </label>
            <input
              type="text"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#050608] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              اسم كاتب الرسالة (Sender Name):
            </label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#050608] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            id="tester-analyze-btn"
            onClick={handleTestOnly}
            disabled={loading || !inputText.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-medium bg-white/5 text-slate-200 hover:text-white hover:bg-white/10 border border-white/10 transition-all cursor-pointer disabled:opacity-50"
          >
            <Zap className="w-4 h-4 text-blue-400" />
            <span>تحليل الكلمات والتطبيع فقط</span>
          </button>

          <button
            id="tester-simulate-btn"
            onClick={handleSimulateFullPipeline}
            disabled={loading || !inputText.trim()}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/30 transition-all cursor-pointer disabled:opacity-50 font-bold"
          >
            <Send className="w-4 h-4" />
            <span>محاكاة وصول الرسالة والتحويل للمستلمين (Full Pipeline)</span>
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Analysis Results View */}
      {testResult && (
        <div className="p-6 rounded-2xl bg-[#0a0c10] border border-white/5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              {testResult.is_match ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <h3 className="text-sm font-bold text-white">
                نتيجة الفحص:{" "}
                <span className={testResult.is_match ? "text-emerald-400" : "text-red-400"}>
                  {testResult.is_match ? "مطابقة وتستحق التحويل (MATCH = TRUE)" : "غير مطابقة (MATCH = FALSE)"}
                </span>
              </h3>
            </div>

            <span className="text-xs px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-mono">
              قاعدة المطابقة: أي كلمة واحدة (Threshold = 1)
            </span>
          </div>

          {/* Normalization breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#050608] border border-white/10 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 block">
                النص بعد التطبيع (Normalized Text):
              </span>
              <p className="text-xs font-mono text-blue-300 bg-white/[0.02] p-3 rounded-lg border border-white/5">
                {testResult.normalized_text || "(فارغ)"}
              </p>
              <p className="text-[10px] text-slate-500">
                تمت إزالة التشكيل، التطويل، توحيد الهمزات والألف، وإزالة علامات الترقيم.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#050608] border border-white/10 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 block">
                الكلمات المفتاحية المكتشفة:
              </span>
              <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 bg-white/[0.02] rounded-lg border border-white/5">
                {testResult.matched_keywords.length > 0 ? (
                  testResult.matched_keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold font-mono"
                    >
                      {kw}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">لم يتم اكتشاف أي كلمة مفتاحية</span>
                )}
              </div>
              <p className="text-[10px] text-slate-500">{testResult.explanation}</p>
            </div>
          </div>

          {/* Tokens extracted */}
          <div className="p-4 rounded-xl bg-[#050608] border border-white/10">
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">
              الكلمات المفصولة (Token Boundary Breakdown):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {testResult.tokens.map((token, i) => {
                const isHit = testResult.matched_keywords.some(
                  (mk) => token.includes(mk) || token === mk
                );
                return (
                  <span
                    key={i}
                    className={`px-2.5 py-1 rounded text-xs font-mono border ${
                      isHit
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold"
                        : "bg-white/5 text-slate-400 border-white/5"
                    }`}
                  >
                    {token}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Simulation Dispatch Results */}
      {simulationResult && (
        <div className="p-6 rounded-2xl bg-[#0a0c10] border border-blue-500/30 space-y-4 shadow-lg shadow-blue-950/20">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-400" />
              <h3 className="text-sm font-bold text-white">
                نتائج محاكاة دورة التحويل الحقيقية (Dispatched to Recipients)
              </h3>
            </div>
            <span className="text-xs px-3 py-1 rounded bg-blue-500/20 text-blue-300 font-mono font-semibold border border-blue-500/30">
              Queue Dispatched
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {simulationResult.recipients_forwarded?.map((rec: any, idx: number) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-blue-300">
                    {rec.recipient}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded font-mono ${
                      rec.status === "FORWARDED"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {rec.status}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {rec.reason || "تم التحويل بنجاح وسجل في قاعدة البيانات"}
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400 pt-1">
            ✓ تمت إضافة السجل إلى صفحة السجلات (Logs) وتم تحديث عدادات الإحصائيات فوراً.
          </p>
        </div>
      )}
    </div>
  );
};
