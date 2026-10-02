import React, { useState } from "react";
import { Send, Lock, User, AlertCircle, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { api } from "../api/client";

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("change-this-password");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login({ username, password });
      localStorage.setItem("telegram_auth_token", res.access_token);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || "اسم المستخدم أو كلمة المرور غير صحيحة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050608] flex flex-col items-center justify-center p-4 text-slate-100 selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-md p-8 rounded-3xl bg-[#0a0c10] border border-white/10 shadow-2xl space-y-6">
        {/* Brand Icon & Heading */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)] mx-auto text-white">
            <Zap className="w-6 h-6 fill-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            TeleFilter<span className="text-blue-500">Pro</span>
          </h1>
          <p className="text-xs text-slate-400">
            تسجيل الدخول للوحة تحكم فلترة رسائل تيليجرام
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              اسم المستخدم (Username):
            </label>
            <div className="relative">
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-4 py-2.5 rounded-xl bg-[#050608] border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500/50"
                required
              />
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              كلمة المرور (Password):
            </label>
            <div className="relative">
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-[#050608] border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500/50"
                required
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-lg shadow-blue-900/30 cursor-pointer disabled:opacity-50"
          >
            <span>{loading ? "جاري التحقق..." : "تسجيل الدخول"}</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
        </form>

        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-slate-400 text-center space-y-1">
          <div>بيانات الدخول الافتراضية للوحة:</div>
          <div className="font-mono text-blue-300">User: <strong>admin</strong> | Pass: <strong>change-this-password</strong></div>
        </div>
      </div>
    </div>
  );
};
