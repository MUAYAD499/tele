import React from "react";
import {
  ShieldCheck,
  Send,
  Play,
  Square,
  RotateCw,
  LogOut,
  Menu,
  Sparkles,
  Bot,
  Zap,
  User
} from "lucide-react";
import { SystemStatus } from "../types";

interface NavbarProps {
  status: SystemStatus | null;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onOpenTelegramModal: () => void;
  onLogout: () => void;
  onToggleMobileMenu: () => void;
  actionLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  status,
  onStart,
  onStop,
  onRestart,
  onOpenTelegramModal,
  onLogout,
  onToggleMobileMenu,
  actionLoading
}) => {
  const isRunning = status?.status === "RUNNING";
  const isConnected = status?.is_connected;

  const getStatusBadge = () => {
    switch (status?.status) {
      case "RUNNING":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              RUNNING (نشط)
            </span>
          </div>
        );
      case "STOPPED":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <span className="flex h-2 w-2 rounded-full bg-amber-500"></span>
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              STOPPED (متوقف)
            </span>
          </div>
        );
      case "RECONNECTING":
      case "STARTING":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 animate-pulse">
            <RotateCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              CONNECTING...
            </span>
          </div>
        );
      case "ERROR":
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <span className="flex h-2 w-2 rounded-full bg-red-500"></span>
            <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
              ERROR
            </span>
          </div>
        );
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 py-3.5 bg-[#0a0c10]/80 backdrop-blur-xl border-b border-white/5">
      {/* Brand & Mobile Toggle */}
      <div className="flex items-center gap-3">
        <button
          id="mobile-menu-toggle-btn"
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          title="القائمة"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)] text-white">
            <Zap className="w-4 h-4 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg tracking-tight text-white">
                TeleFilter<span className="text-blue-500">Pro</span>
              </span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                MTProto
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              نظام فلترة رسائل تيليجرام وإعادة التوجيه التلقائي
            </p>
          </div>
        </div>
      </div>

      {/* Center Status Badges */}
      <div className="hidden md:flex items-center gap-4">
        {getStatusBadge()}

        <div className="h-6 w-px bg-white/10"></div>

        <button
          id="nav-telegram-status-btn"
          onClick={onOpenTelegramModal}
          className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer text-right"
        >
          <div className="text-right">
            <p className="text-[10px] text-slate-400 leading-none mb-1">
              {isConnected ? "متصل بحساب" : "الحساب"}
            </p>
            <p className="text-xs font-semibold text-white font-mono leading-none">
              {isConnected
                ? status?.account?.username
                  ? `@${status.account.username}`
                  : status?.account?.phone || status?.account?.first_name || "Connected"
                : "ربط الحساب"}
            </p>
          </div>
          <div className="w-7 h-7 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-400">
            <Bot className="w-4 h-4 text-blue-400" />
          </div>
        </button>
      </div>

      {/* Control Buttons & User Profile */}
      <div className="flex items-center gap-2">
        {isRunning ? (
          <button
            id="system-stop-btn"
            onClick={onStop}
            disabled={actionLoading}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-3.5 py-2 rounded-lg font-medium text-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            title="إيقاف المراقبة مؤقتاً"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">إيقاف المحرك (Stop)</span>
          </button>
        ) : (
          <button
            id="system-start-btn"
            onClick={onStart}
            disabled={actionLoading}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-lg font-medium text-xs shadow-lg shadow-emerald-900/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 font-bold"
            title="تشغيل المراقبة"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">تشغيل المحرك (Start)</span>
          </button>
        )}

        <button
          id="system-restart-btn"
          onClick={onRestart}
          disabled={actionLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg font-medium text-xs shadow-lg shadow-blue-900/30 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          title="إعادة تشغيل الاتصال"
        >
          <RotateCw className={`w-3.5 h-3.5 ${actionLoading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">إعادة تشغيل (Restart)</span>
        </button>

        <div className="h-6 w-px bg-white/10 mx-1"></div>

        <button
          id="nav-logout-btn"
          onClick={onLogout}
          className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="تسجيل الخروج"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
