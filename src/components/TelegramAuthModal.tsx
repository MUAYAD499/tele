import React, { useState } from "react";
import {
  Bot,
  Phone,
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  RotateCw,
  ShieldCheck
} from "lucide-react";
import { api } from "../api/client";
import { SystemStatus } from "../types";

interface TelegramAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SystemStatus | null;
  onSuccess: () => void;
}

export const TelegramAuthModal: React.FC<TelegramAuthModalProps> = ({
  isOpen,
  onClose,
  status,
  onSuccess
}) => {
  const [step, setStep] = useState<"PHONE" | "CODE" | "2FA" | "CONNECTED">(
    status?.is_connected ? "CONNECTED" : "PHONE"
  );
  const [phone, setPhone] = useState(status?.account?.phone || "");
  const [phoneCodeHash, setPhoneCodeHash] = useState<string>("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      const res = await api.requestTelegramCode(phone.trim());
      const hash = res.phone_code_hash || (res as any).phoneCodeHash;
      if (hash) {
        setPhoneCodeHash(hash);
      }
      setInfoMessage(res.message || "تم إرسال رمز تسجيل الدخول بنجاح.");
      setStep("CODE");
    } catch (err: any) {
      setError(err.message || "فشل إرسال رمز تسجيل الدخول عبر تيليجرام");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyTelegramCode(code.trim(), undefined, phone.trim(), phoneCodeHash || undefined);
      if (res.status === "2fa_required" || res.requires_2fa) {
        setError(null);
        setStep("2FA");
        return;
      }
      if (res.success || res.status === "connected" || res.status === "RUNNING") {
        setStep("CONNECTED");
        onSuccess();
      } else {
        setError(res.error || res.message || "رمز التحقق غير صحيح");
      }
    } catch (err: any) {
      if (err.requires_2fa || err.status === "2fa_required" || (err.message && (err.message.includes("2FA") || err.message.includes("Password needed")))) {
        setError(null);
        setStep("2FA");
      } else {
        setError(err.message || "رمز التحقق غير صحيح أو منتهي الصلاحية");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyTelegramPassword(password.trim());
      if (res.success || res.status === "connected" || res.status === "RUNNING") {
        setStep("CONNECTED");
        onSuccess();
      } else {
        setError(res.error || res.message || "كلمة مرور التحقق بخطوتين (2FA) غير صحيحة");
      }
    } catch (err: any) {
      setError(err.message || "كلمة مرور التحقق بخطوتين (2FA) غير صحيحة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md p-6 rounded-2xl bg-[#0a0c10] border border-white/10 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                ربط حساب Telegram الحقيقي (MTProto)
              </h3>
              <p className="text-[11px] text-slate-400">
                اتصال مباشر بخوادم Telegram الرسمية عبر Telethon/GramJS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {infoMessage && (
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Step 1: Phone */}
        {step === "PHONE" && (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                رقم الهاتف مع المفتاح الدولي:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+967730000000"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#050608] border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-blue-500/50"
                  required
                  autoFocus
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1.5 block leading-relaxed">
                سيقوم الـ Backend بالاتصال المباشر بخوادم تيليجرام لإرسال رمز التحقق الحقيقي إلى تطبيق Telegram على هاتفك.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <RotateCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>طلب كود التحقق من خوادم Telegram</span>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 2: Code Verification */}
        {step === "CODE" && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                رمز التحقق الواصل في تطبيق تيليجرام:
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="أدخل الرمز المكون من 5 أرقام..."
                className="w-full px-4 py-2.5 rounded-xl bg-[#050608] border border-white/10 text-xs text-white font-mono tracking-widest text-center focus:outline-none focus:border-blue-500/50"
                required
                autoFocus
              />
              <span className="text-[10px] text-slate-400 mt-1.5 block text-center">
                تم إرسال الرمز للرقم: <strong className="text-blue-300 font-mono">{phone}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep("PHONE");
                  setError(null);
                }}
                className="w-1/3 py-2.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/10"
              >
                تغيير الرقم
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all cursor-pointer disabled:opacity-50 font-bold"
              >
                {loading ? <RotateCw className="w-4 h-4 animate-spin" /> : <span>التحقق من الكود وحفظ الجلسة</span>}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: 2FA */}
        {step === "2FA" && (
          <form onSubmit={handleVerifyPassword} className="space-y-4">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>الحساب محمي بالتحقق بخطوتين (2FA Password).</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                كلمة مرور التحقق بخطوتين (2FA Password):
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة مرور 2FA الخاصة بحسابك..."
                className="w-full px-4 py-2.5 rounded-xl bg-[#050608] border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500/50"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all cursor-pointer disabled:opacity-50 font-bold"
            >
              {loading ? <RotateCw className="w-4 h-4 animate-spin" /> : <span>تأكيد 2FA وإنشاء Session دائم</span>}
            </button>
          </form>
        )}

        {/* Connected State */}
        {step === "CONNECTED" && (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(16,185,129,0.4)]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">تم الاتصال بخوادم Telegram بنجاح!</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                تم حفظ الجلسة (Telegram Session) في التخزين الدائم. الـ Worker نشط الآن في الخلفية لمراقبة المجموعات فورياً.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-white/10 text-white hover:bg-white/15 transition-all cursor-pointer"
              >
                العودة إلى لوحة التحكم
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
